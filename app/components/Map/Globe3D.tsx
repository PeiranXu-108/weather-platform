'use client';

import { Suspense, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { Canvas, useFrame, useLoader, useThree } from '@react-three/fiber';
import { OrbitControls, Stars } from '@react-three/drei';
import * as THREE from 'three';
import type { Location } from '@/app/types/weather';
import { TextureManager } from './TextureManager';

interface Globe3DProps {
  location: Location;
  onGlobePick: (lat: number, lon: number) => void;
  className?: string;
  referenceEpoch?: number;
}

const textureManager = new TextureManager();
const EARTH_DAY_MAP_URL = textureManager.earthDayMap();
const EARTH_NORMAL_MAP_URL = textureManager.earthNormalMap();
const EARTH_SPECULAR_MAP_URL = textureManager.earthSpecularMap();
const EARTH_LIGHTS_MAP_URL = textureManager.earthLightsMap();
const EARTH_CLOUDS_MAP_URL = textureManager.earthCloudsMap();
const GLOBE_TEXTURE_URLS = [
  EARTH_DAY_MAP_URL,
  EARTH_NORMAL_MAP_URL,
  EARTH_SPECULAR_MAP_URL,
  EARTH_LIGHTS_MAP_URL,
  EARTH_CLOUDS_MAP_URL,
] as const;
const GLOBE_RADIUS = 1;
const INITIAL_CAMERA_DISTANCE = 3.85;
const MIN_CAMERA_DISTANCE = 1.65;
const MAX_CAMERA_DISTANCE = 4.2;
const INTRO_CAMERA_DISTANCE = 9.6;
const INTRO_CAMERA_ANIMATION_MS = 9_800;
const LIVE_LIGHTING_UPDATE_MS = 60_000;

if (typeof window !== 'undefined') {
  // Warm the loader cache before the user switches views so the intro can start immediately.
  GLOBE_TEXTURE_URLS.forEach((textureUrl) => {
    useLoader.preload(THREE.TextureLoader, textureUrl);
  });
}

function latLonToVector3(lat: number, lon: number, radius = GLOBE_RADIUS): THREE.Vector3 {
  const phi = THREE.MathUtils.degToRad(90 - lat);
  const theta = THREE.MathUtils.degToRad(lon + 180);
  const x = -radius * Math.sin(phi) * Math.cos(theta);
  const y = radius * Math.cos(phi);
  const z = radius * Math.sin(phi) * Math.sin(theta);
  return new THREE.Vector3(x, y, z);
}

function vector3ToLatLon(point: THREE.Vector3): { lat: number; lon: number } {
  const normalized = point.clone().normalize();
  const lat = 90 - THREE.MathUtils.radToDeg(Math.acos(THREE.MathUtils.clamp(normalized.y, -1, 1)));
  let lon = THREE.MathUtils.radToDeg(Math.atan2(normalized.z, -normalized.x)) - 180;
  if (lon < -180) lon += 360;
  if (lon > 180) lon -= 360;
  return { lat, lon };
}

const PULSE_RIPPLE_VERTEX = `
  varying vec3 vWorldPos;
  void main() {
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldPos = worldPos.xyz;
    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`;

const PULSE_RIPPLE_FRAGMENT = `
  uniform vec3 markerDir;
  uniform float time;
  varying vec3 vWorldPos;

  void main() {
    vec3 dir = normalize(vWorldPos);
    float angDist = acos(clamp(dot(dir, markerDir), -1.0, 1.0));

    float alpha = 0.0;
    for (float i = 0.0; i < 3.0; i++) {
      float phase = fract(time * 0.4 - i / 3.0);
      float radius = phase * 0.30;
      float width = 0.005 + phase * 0.016;
      float ring = smoothstep(width, 0.0, abs(angDist - radius));
      ring *= (1.0 - phase) * (1.0 - phase);
      alpha += ring;
    }

    alpha = clamp(alpha, 0.0, 0.9);
    if (alpha < 0.004) discard;

    vec3 warm = vec3(1.0, 0.92, 0.23);
    vec3 gold = vec3(1.0, 0.80, 0.0);
    vec3 col = mix(warm, gold, alpha);
    gl_FragColor = vec4(col, alpha * 0.8);
  }
`;

function PulseMarker({ position }: { position: THREE.Vector3 }) {
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const markerDir = useMemo(() => position.clone().normalize(), [position]);

  const rippleMat = useMemo(() => new THREE.ShaderMaterial({
    uniforms: {
      markerDir: { value: markerDir },
      time: { value: 0 },
    },
    vertexShader: PULSE_RIPPLE_VERTEX,
    fragmentShader: PULSE_RIPPLE_FRAGMENT,
    transparent: true,
    depthWrite: false,
    side: THREE.FrontSide,
    blending: THREE.AdditiveBlending,
  }), [markerDir]);

  useFrame(({ clock }) => {
    if (matRef.current) {
      matRef.current.uniforms.time.value = clock.getElapsedTime();
    }
  });

  useEffect(() => {
    return () => { rippleMat.dispose(); };
  }, [rippleMat]);

  return (
    <group>
      <mesh position={position}>
        <sphereGeometry args={[0.013, 16, 16]} />
        <meshBasicMaterial color="#fde047" />
      </mesh>
      <mesh position={position}>
        <sphereGeometry args={[0.021, 16, 16]} />
        <meshBasicMaterial color="#fbbf24" transparent opacity={0.25} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
      <mesh>
        <sphereGeometry args={[GLOBE_RADIUS * 1.003, 128, 128]} />
        <primitive ref={matRef} object={rippleMat} attach="material" />
      </mesh>
    </group>
  );
}

const ATMO_VERTEX = `
  varying vec3 vNormal;
  varying vec3 vWorldPosition;
  void main() {
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPosition.xyz;
    vNormal = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * worldPosition;
  }
`;

const ATMO_INNER_FRAG = `
  uniform vec3 viewVector;
  uniform vec3 lightDir;
  varying vec3 vNormal;
  varying vec3 vWorldPosition;
  void main() {
    vec3 viewDir = normalize(viewVector - vWorldPosition);
    float fresnel = 1.0 - dot(vNormal, viewDir);
    float rim = pow(fresnel, 5.0);
    float sunFactor = 0.3 + 0.7 * max(dot(normalize(vNormal), lightDir), 0.0);
    vec3 col = mix(vec3(0.45, 0.75, 1.0), vec3(0.85, 0.95, 1.0), pow(fresnel, 3.0));
    gl_FragColor = vec4(col, rim * sunFactor * 1.4);
  }
`;

const ATMO_OUTER_FRAG = `
  uniform vec3 viewVector;
  uniform vec3 lightDir;
  varying vec3 vNormal;
  varying vec3 vWorldPosition;
  void main() {
    vec3 viewDir = normalize(viewVector - vWorldPosition);
    float fresnel = dot(vNormal, viewDir);
    float rim = pow(clamp(0.65 - fresnel, 0.0, 1.0), 2.5);
    float sunFactor = 0.15 + 0.85 * max(dot(normalize(vNormal), lightDir), 0.0);
    vec3 col = mix(vec3(0.2, 0.5, 1.0), vec3(0.35, 0.7, 1.0), rim);
    gl_FragColor = vec4(col, rim * sunFactor * 0.7);
  }
`;

const AURORA_FRAG = `
  uniform vec3 viewVector;
  uniform vec3 lightDir;
  uniform float time;
  uniform float intensityScale;
  varying vec3 vNormal;
  varying vec3 vWorldPosition;

  float hash(vec2 p) {
    p = fract(p * vec2(123.34, 345.45));
    p += dot(p, p + 34.345);
    return fract(p.x * p.y);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
  }

  float fbm(vec2 p) {
    mat2 rot = mat2(1.6, 1.2, -1.2, 1.6);
    float value = 0.0;
    float amp = 0.5;
    value += amp * noise(p); p = rot * p; amp *= 0.5;
    value += amp * noise(p); p = rot * p; amp *= 0.5;
    value += amp * noise(p); p = rot * p; amp *= 0.5;
    value += amp * noise(p);
    return value;
  }

  void main() {
    vec3 normalDir = normalize(vNormal);
    vec3 viewDir = normalize(viewVector - vWorldPosition);
    vec3 sun = normalize(lightDir);

    float polar = abs(normalDir.y);
    float polarMask = smoothstep(0.52, 0.84, polar);
    float capFade = 1.0 - smoothstep(0.985, 1.0, polar);
    float poleBand = polarMask * capFade;

    float dayDot = dot(normalDir, sun);
    float dayFactor = smoothstep(-0.05, 0.45, dayDot);
    float nightDominance = mix(1.0, 0.16, dayFactor);

    float lon = atan(normalDir.z, normalDir.x) / 6.28318530718 + 0.5;
    float lat = polar;

    vec2 flowUv = vec2(lon * 5.8 + time * 0.022, lat * 4.5 - time * 0.018);
    float baseFlow = fbm(flowUv + vec2(0.0, fbm(flowUv * 1.8)));
    float detailFlow = fbm(vec2(lon * 17.0 - time * 0.095, lat * 13.0 + time * 0.05));
    float curtain = smoothstep(0.38, 0.88, baseFlow * 0.72 + detailFlow * 0.48);

    float wave = 0.65 + 0.35 * sin(time * 0.70 + lon * 26.0 + detailFlow * 5.0);
    float breath = 0.76 + 0.24 * sin(time * 0.42 + lat * 10.0 + lon * 6.0);
    float filament = pow(max(0.0, sin((lon * 90.0 + detailFlow * 8.0) - time * 2.4)), 16.0);
    filament *= (0.25 + 0.75 * poleBand);

    float fresnel = pow(1.0 - max(dot(normalDir, viewDir), 0.0), 2.2);
    float intensity = poleBand * curtain * wave * breath * fresnel * nightDominance;

    vec3 neonA = vec3(0.12, 0.98, 0.78);
    vec3 neonB = vec3(0.35, 0.62, 1.0);
    vec3 neonC = vec3(0.95, 0.36, 0.98);
    float chroma = clamp(baseFlow * 0.62 + detailFlow * 0.58, 0.0, 1.0);
    vec3 col = mix(neonA, neonB, chroma);
    col = mix(col, neonC, clamp(pow(detailFlow, 1.8) * 0.55 + filament * 0.65, 0.0, 1.0));
    col += neonC * filament * 0.55;

    float polarHalo = smoothstep(0.62, 0.95, polar) * (0.25 + 0.75 * (1.0 - dayFactor));
    col += mix(neonA, neonB, 0.35) * polarHalo * 0.45;

    float alpha = intensity * 0.82 + polarHalo * 0.05;
    col *= intensityScale;
    alpha = clamp(alpha * intensityScale, 0.0, 0.95);
    if (alpha < 0.003) discard;

    gl_FragColor = vec4(col, alpha);
  }
`;

function normalizeDegrees(value: number): number {
  return ((value % 360) + 360) % 360;
}

function normalizeLongitude(value: number): number {
  return ((value + 540) % 360) - 180;
}

function getSunSubsolarPoint(epochSeconds: number): { lat: number; lon: number } {
  const date = new Date(epochSeconds * 1000);
  const jd = date.getTime() / 86400000 + 2440587.5;
  const T = (jd - 2451545.0) / 36525;
  const meanLongitude = normalizeDegrees(280.46646 + T * (36000.76983 + T * 0.0003032));
  const meanAnomaly = 357.52911 + T * (35999.05029 - 0.0001537 * T);
  const eccentricity = 0.016708634 - T * (0.000042037 + 0.0000001267 * T);
  const meanAnomalyRad = THREE.MathUtils.degToRad(meanAnomaly);
  const equationOfCenter =
    (1.914602 - T * (0.004817 + 0.000014 * T)) * Math.sin(meanAnomalyRad) +
    (0.019993 - 0.000101 * T) * Math.sin(2 * meanAnomalyRad) +
    0.000289 * Math.sin(3 * meanAnomalyRad);
  const trueLongitude = meanLongitude + equationOfCenter;
  const omega = 125.04 - 1934.136 * T;
  const apparentLongitude = trueLongitude - 0.00569 - 0.00478 * Math.sin(THREE.MathUtils.degToRad(omega));
  const meanObliquity =
    23 +
    (26 + (21.448 - T * (46.815 + T * (0.00059 - T * 0.001813))) / 60) / 60;
  const correctedObliquity =
    meanObliquity + 0.00256 * Math.cos(THREE.MathUtils.degToRad(omega));
  const apparentLongitudeRad = THREE.MathUtils.degToRad(apparentLongitude);
  const correctedObliquityRad = THREE.MathUtils.degToRad(correctedObliquity);
  const solarDeclination = Math.asin(
    Math.sin(correctedObliquityRad) * Math.sin(apparentLongitudeRad)
  );
  const y = Math.tan(correctedObliquityRad / 2) ** 2;
  const meanLongitudeRad = THREE.MathUtils.degToRad(meanLongitude);
  const equationOfTime =
    (4 *
      (y * Math.sin(2 * meanLongitudeRad) -
        2 * eccentricity * Math.sin(meanAnomalyRad) +
        4 * eccentricity * y * Math.sin(meanAnomalyRad) * Math.cos(2 * meanLongitudeRad) -
        0.5 * y * y * Math.sin(4 * meanLongitudeRad) -
        1.25 * eccentricity * eccentricity * Math.sin(2 * meanAnomalyRad))) /
    THREE.MathUtils.DEG2RAD;
  const utcMinutes =
    date.getUTCHours() * 60 + date.getUTCMinutes() + date.getUTCSeconds() / 60;

  return {
    lat: THREE.MathUtils.radToDeg(solarDeclination),
    lon: normalizeLongitude(180 - (utcMinutes + equationOfTime) / 4),
  };
}

function getSunDirection(epochSeconds: number): THREE.Vector3 {
  const { lat, lon } = getSunSubsolarPoint(epochSeconds);
  return latLonToVector3(lat, lon, 10).normalize();
}

function easeOutCubic(progress: number): number {
  return 1 - Math.pow(1 - progress, 3);
}

function AtmosphereGlow({ radius, sunDir }: { radius: number; sunDir: THREE.Vector3 }) {
  const { camera } = useThree();
  const innerRef = useRef<THREE.ShaderMaterial>(null);
  const outerRef = useRef<THREE.ShaderMaterial>(null);
  const auroraRef = useRef<THREE.ShaderMaterial>(null);

  const innerMat = useMemo(() => new THREE.ShaderMaterial({
    uniforms: {
      viewVector: { value: new THREE.Vector3() },
      lightDir: { value: sunDir.clone() },
    },
    vertexShader: ATMO_VERTEX,
    fragmentShader: ATMO_INNER_FRAG,
    side: THREE.FrontSide,
    blending: THREE.AdditiveBlending,
    transparent: true,
    depthWrite: false,
  }), [sunDir]);

  const outerMat = useMemo(() => new THREE.ShaderMaterial({
    uniforms: {
      viewVector: { value: new THREE.Vector3() },
      lightDir: { value: sunDir.clone() },
    },
    vertexShader: ATMO_VERTEX,
    fragmentShader: ATMO_OUTER_FRAG,
    side: THREE.BackSide,
    blending: THREE.AdditiveBlending,
    transparent: true,
    depthWrite: false,
  }), [sunDir]);

  const auroraMat = useMemo(() => new THREE.ShaderMaterial({
    uniforms: {
      viewVector: { value: new THREE.Vector3() },
      lightDir: { value: sunDir.clone() },
      time: { value: 0 },
      intensityScale: { value: 1.0 },
    },
    vertexShader: ATMO_VERTEX,
    fragmentShader: AURORA_FRAG,
    side: THREE.BackSide,
    blending: THREE.AdditiveBlending,
    transparent: true,
    depthWrite: false,
  }), [sunDir]);

  useFrame(({ clock }) => {
    innerRef.current?.uniforms.viewVector.value.copy(camera.position);
    innerRef.current?.uniforms.lightDir.value.copy(sunDir);

    auroraRef.current?.uniforms.viewVector.value.copy(camera.position);
    auroraRef.current?.uniforms.lightDir.value.copy(sunDir);
    if (auroraRef.current) {
      auroraRef.current.uniforms.time.value = clock.getElapsedTime();
    }

    outerRef.current?.uniforms.viewVector.value.copy(camera.position);
    outerRef.current?.uniforms.lightDir.value.copy(sunDir);
  });

  useEffect(() => {
    return () => { innerMat.dispose(); auroraMat.dispose(); outerMat.dispose(); };
  }, [innerMat, auroraMat, outerMat]);

  return (
    <>
      <mesh>
        <sphereGeometry args={[radius * 1.015, 96, 96]} />
        <primitive ref={innerRef} object={innerMat} attach="material" />
      </mesh>
      <mesh>
        <sphereGeometry args={[radius * 1.045, 96, 96]} />
        <primitive ref={auroraRef} object={auroraMat} attach="material" />
      </mesh>
      <mesh>
        <sphereGeometry args={[radius * 1.06, 96, 96]} />
        <primitive ref={outerRef} object={outerMat} attach="material" />
      </mesh>
    </>
  );
}

function GlobeCameraController({
  location,
  controlsRef,
  introStart,
}: {
  location: Location;
  controlsRef: RefObject<any>;
  introStart: THREE.Vector3;
}) {
  const { camera } = useThree();
  const introPhaseRef = useRef<'pending' | 'animating' | 'done'>('pending');
  const introStartTimeRef = useRef(0);
  const startPosRef = useRef(introStart.clone());
  const endPosRef = useRef(
    latLonToVector3(location.lat, location.lon, 1).normalize().multiplyScalar(INITIAL_CAMERA_DISTANCE)
  );
  const prevLocationRef = useRef({ lat: location.lat, lon: location.lon });

  useFrame(() => {
    if (introPhaseRef.current === 'pending') {
      introPhaseRef.current = 'animating';
      introStartTimeRef.current = performance.now();
      camera.position.copy(startPosRef.current);
      camera.lookAt(0, 0, 0);
      if (controlsRef.current) {
        controlsRef.current.enabled = false;
        controlsRef.current.target.set(0, 0, 0);
        controlsRef.current.update();
      }
      return;
    }

    if (introPhaseRef.current === 'animating') {
      const elapsed = performance.now() - introStartTimeRef.current;
      const progress = Math.min(elapsed / INTRO_CAMERA_ANIMATION_MS, 1);
      camera.position.lerpVectors(startPosRef.current, endPosRef.current, easeOutCubic(progress));
      camera.lookAt(0, 0, 0);
      if (controlsRef.current) {
        controlsRef.current.target.set(0, 0, 0);
        controlsRef.current.update();
      }
      if (progress >= 1) {
        introPhaseRef.current = 'done';
        if (controlsRef.current) controlsRef.current.enabled = true;
      }
      return;
    }

    if (
      prevLocationRef.current.lat !== location.lat ||
      prevLocationRef.current.lon !== location.lon
    ) {
      prevLocationRef.current = { lat: location.lat, lon: location.lon };
      const newPos = latLonToVector3(location.lat, location.lon, 1)
        .normalize()
        .multiplyScalar(INITIAL_CAMERA_DISTANCE);
      camera.position.copy(newPos);
      camera.lookAt(0, 0, 0);
      if (controlsRef.current) {
        controlsRef.current.target.set(0, 0, 0);
        controlsRef.current.update();
      }
    }
  });

  return null;
}

function GlobeMesh({
  location,
  onGlobePick,
  referenceEpoch,
}: {
  location: Location;
  onGlobePick: (lat: number, lon: number) => void;
  referenceEpoch?: number;
}) {
  const [liveEpoch, setLiveEpoch] = useState(() => Math.floor(Date.now() / 1000));
  const earthMap = useLoader(THREE.TextureLoader, EARTH_DAY_MAP_URL);
  const earthNormal = useLoader(THREE.TextureLoader, EARTH_NORMAL_MAP_URL);
  const earthSpecular = useLoader(THREE.TextureLoader, EARTH_SPECULAR_MAP_URL);
  const earthLights = useLoader(THREE.TextureLoader, EARTH_LIGHTS_MAP_URL);
  const earthClouds = useLoader(THREE.TextureLoader, EARTH_CLOUDS_MAP_URL);
  const cityPosition = useMemo(
    () => latLonToVector3(location.lat, location.lon, GLOBE_RADIUS * 1.001),
    [location.lat, location.lon]
  );
  const lightingEpoch = referenceEpoch ?? liveEpoch;

  useEffect(() => {
    if (referenceEpoch !== undefined) {
      return;
    }

    const updateLiveEpoch = () => {
      setLiveEpoch(Math.floor(Date.now() / 1000));
    };

    updateLiveEpoch();
    const intervalId = window.setInterval(updateLiveEpoch, LIVE_LIGHTING_UPDATE_MS);
    return () => window.clearInterval(intervalId);
  }, [referenceEpoch]);

  const sunDir = useMemo(() => getSunDirection(lightingEpoch), [lightingEpoch]);
  const sunPos: [number, number, number] = useMemo(
    () => [sunDir.x * 10, sunDir.y * 10, sunDir.z * 10],
    [sunDir]
  );

  useEffect(() => {
    const srgbTextures = [earthMap, earthLights, earthClouds];
    srgbTextures.forEach((texture) => {
      if (texture.colorSpace !== THREE.SRGBColorSpace) {
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.needsUpdate = true;
      }
    });
  }, [earthClouds, earthLights, earthMap]);

  return (
    <>
      <ambientLight intensity={0.12} />
      <directionalLight position={sunPos} intensity={1.8} />
      <hemisphereLight args={[0x87ceeb, 0x0a0a2e, 0.25]} />
      <mesh
        onPointerDown={(event) => {
          event.stopPropagation();
          const { lat, lon } = vector3ToLatLon(event.point);
          onGlobePick(lat, lon);
        }}
      >
        <sphereGeometry args={[GLOBE_RADIUS, 96, 96]} />
        <meshPhongMaterial
          map={earthMap}
          normalMap={earthNormal}
          specularMap={earthSpecular}
          emissiveMap={earthLights}
          emissive={new THREE.Color(0x112244)}
          emissiveIntensity={0.8}
          shininess={18}
        />
      </mesh>
      <mesh>
        <sphereGeometry args={[GLOBE_RADIUS * 1.02, 72, 72]} />
        <meshLambertMaterial map={earthClouds} transparent opacity={0.85} depthWrite={false} />
      </mesh>
      <AtmosphereGlow radius={GLOBE_RADIUS} sunDir={sunDir} />
      <PulseMarker position={cityPosition} />
      <Stars radius={120} depth={60} count={5000} factor={5} saturation={0.1} fade speed={0.3} />
    </>
  );
}

function GlobeFallback({ location }: { location: Location }) {
  const cityPosition = useMemo(
    () => latLonToVector3(location.lat, location.lon, GLOBE_RADIUS * 1.001),
    [location.lat, location.lon]
  );

  return (
    <>
      <ambientLight intensity={0.2} />
      <directionalLight position={[4, 2, 6]} intensity={1.2} />
      <mesh>
        <sphereGeometry args={[GLOBE_RADIUS, 64, 64]} />
        <meshPhongMaterial color="#1f2937" shininess={10} />
      </mesh>
      <PulseMarker position={cityPosition} />
      <Stars radius={120} depth={60} count={5000} factor={5} saturation={0.1} fade speed={0.3} />
    </>
  );
}

export default function Globe3D({
  location,
  onGlobePick,
  className,
  referenceEpoch,
}: Globe3DProps) {
  const controlsRef = useRef<any>(null);

  const introStart = useMemo(
    () =>
      latLonToVector3(location.lat, location.lon, 1)
        .normalize()
        .multiplyScalar(INTRO_CAMERA_DISTANCE),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const introCameraPos = useMemo<[number, number, number]>(
    () => [introStart.x, introStart.y, introStart.z],
    [introStart]
  );

  return (
    <div className={className} style={{ width: '100%', height: '100%' }}>
      <Canvas
        className="w-full h-full"
        style={{ width: '100%', height: '100%' }}
        camera={{ position: introCameraPos, fov: 45 }}
        dpr={[1, 2]}
      >
        <color attach="background" args={['#020617']} />
        <GlobeCameraController
          location={location}
          controlsRef={controlsRef}
          introStart={introStart}
        />
        <OrbitControls
          ref={controlsRef}
          enablePan={false}
          minDistance={MIN_CAMERA_DISTANCE}
          maxDistance={MAX_CAMERA_DISTANCE}
          rotateSpeed={0.6}
          zoomSpeed={0.7}
        />
        <Suspense fallback={<GlobeFallback location={location} />}>
          <GlobeMesh location={location} onGlobePick={onGlobePick} referenceEpoch={referenceEpoch} />
        </Suspense>
      </Canvas>
    </div>
  );
}
