'use client';

import { useEffect, useMemo, useRef, type RefObject } from 'react';
import { Canvas, useFrame, useLoader, useThree } from '@react-three/fiber';
import { OrbitControls, Stars } from '@react-three/drei';
import * as THREE from 'three';
import type { Location } from '@/app/types/weather';
import { TextureManager } from './TextureManager';

interface Globe3DProps {
  location: Location;
  onGlobePick: (lat: number, lon: number) => void;
  className?: string;
}

const textureManager = new TextureManager();
const GLOBE_RADIUS = 1;
const INITIAL_CAMERA_DISTANCE = 3.85;
const MIN_CAMERA_DISTANCE = 1.65;
const MAX_CAMERA_DISTANCE = 4.2;

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

function PulseMarker({ position }: { position: THREE.Vector3 }) {
  const ringRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    if (!ringRef.current) return;
    const t = clock.getElapsedTime();
    const pulse = 1 + (Math.sin(t * 3) + 1) * 0.2;
    ringRef.current.scale.setScalar(pulse);
    (ringRef.current.material as THREE.MeshBasicMaterial).opacity = 0.35 + (Math.sin(t * 3) + 1) * 0.2;
  });

  return (
    <group position={position}>
      <mesh>
        <sphereGeometry args={[0.015, 16, 16]} />
        <meshBasicMaterial color="#f97316" />
      </mesh>
      <mesh ref={ringRef} rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.024, 0.038, 48]} />
        <meshBasicMaterial color="#fb923c" transparent opacity={0.5} side={THREE.DoubleSide} />
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

function getSunDirection(): THREE.Vector3 {
  const now = new Date();
  const jd = now.getTime() / 86400000 + 2440587.5;
  const n = jd - 2451545.0;
  const L = (280.460 + 0.9856474 * n) % 360;
  const g = THREE.MathUtils.degToRad((357.528 + 0.9856003 * n) % 360);
  const eclipticLon = THREE.MathUtils.degToRad(
    L + 1.915 * Math.sin(g) + 0.020 * Math.sin(2 * g)
  );
  const obliquity = THREE.MathUtils.degToRad(23.439 - 0.0000004 * n);
  const ra = Math.atan2(Math.cos(obliquity) * Math.sin(eclipticLon), Math.cos(eclipticLon));
  const dec = Math.asin(Math.sin(obliquity) * Math.sin(eclipticLon));

  const utcHours = now.getUTCHours() + now.getUTCMinutes() / 60 + now.getUTCSeconds() / 3600;
  const gmst = (280.46061837 + 360.98564736629 * n) % 360;
  const ha = THREE.MathUtils.degToRad(gmst + utcHours * 0) - ra;

  const sunLon = -THREE.MathUtils.radToDeg(ha) + (utcHours - 12) * 15;
  const sunLat = THREE.MathUtils.radToDeg(dec);

  return latLonToVector3(sunLat, sunLon, 10).normalize();
}

function AtmosphereGlow({ radius, sunDir }: { radius: number; sunDir: THREE.Vector3 }) {
  const { camera } = useThree();
  const innerRef = useRef<THREE.ShaderMaterial>(null);
  const outerRef = useRef<THREE.ShaderMaterial>(null);

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

  useFrame(() => {
    innerRef.current?.uniforms.viewVector.value.copy(camera.position);
    outerRef.current?.uniforms.viewVector.value.copy(camera.position);
  });

  useEffect(() => {
    return () => { innerMat.dispose(); outerMat.dispose(); };
  }, [innerMat, outerMat]);

  return (
    <>
      <mesh>
        <sphereGeometry args={[radius * 1.015, 96, 96]} />
        <primitive ref={innerRef} object={innerMat} attach="material" />
      </mesh>
      <mesh>
        <sphereGeometry args={[radius * 1.06, 96, 96]} />
        <primitive ref={outerRef} object={outerMat} attach="material" />
      </mesh>
    </>
  );
}

function GlobeCameraController({ location, controlsRef }: { location: Location; controlsRef: RefObject<any> }) {
  const { camera } = useThree();

  useEffect(() => {
    const cityDirection = latLonToVector3(location.lat, location.lon, 1).normalize();
    const desiredPosition = cityDirection.multiplyScalar(INITIAL_CAMERA_DISTANCE);
    camera.position.copy(desiredPosition);
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
    if (controlsRef.current) {
      controlsRef.current.target.set(0, 0, 0);
      controlsRef.current.update();
    }
  }, [camera, controlsRef, location.lat, location.lon]);

  return null;
}

function GlobeMesh({
  location,
  onGlobePick,
}: {
  location: Location;
  onGlobePick: (lat: number, lon: number) => void;
}) {
  const controlsRef = useRef<any>(null);
  const earthMapRaw = useLoader(THREE.TextureLoader, textureManager.earthDayMap());
  const earthNormalRaw = useLoader(THREE.TextureLoader, textureManager.earthNormalMap());
  const earthSpecularRaw = useLoader(THREE.TextureLoader, textureManager.earthSpecularMap());
  const earthLightsRaw = useLoader(THREE.TextureLoader, textureManager.earthLightsMap());
  const earthCloudsRaw = useLoader(THREE.TextureLoader, textureManager.earthCloudsMap());
  const earthMap = useMemo(() => earthMapRaw.clone(), [earthMapRaw]);
  const earthNormal = useMemo(() => earthNormalRaw.clone(), [earthNormalRaw]);
  const earthSpecular = useMemo(() => earthSpecularRaw.clone(), [earthSpecularRaw]);
  const earthLights = useMemo(() => earthLightsRaw.clone(), [earthLightsRaw]);
  const earthClouds = useMemo(() => earthCloudsRaw.clone(), [earthCloudsRaw]);
  const cityPosition = useMemo(
    () => latLonToVector3(location.lat, location.lon, GLOBE_RADIUS * 1.001),
    [location.lat, location.lon]
  );

  const sunDir = useMemo(() => getSunDirection(), []);
  const sunPos: [number, number, number] = useMemo(
    () => [sunDir.x * 10, sunDir.y * 10, sunDir.z * 10],
    [sunDir]
  );

  useEffect(() => {
    earthMap.colorSpace = THREE.SRGBColorSpace;
    earthLights.colorSpace = THREE.SRGBColorSpace;
    earthClouds.colorSpace = THREE.SRGBColorSpace;
    return () => {
      earthMap.dispose();
      earthNormal.dispose();
      earthSpecular.dispose();
      earthLights.dispose();
      earthClouds.dispose();
    };
  }, [earthClouds, earthLights, earthMap, earthNormal, earthSpecular]);

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
      <Stars radius={120} depth={50} count={2500} factor={3} saturation={0} fade speed={0.2} />
      <GlobeCameraController location={location} controlsRef={controlsRef} />
      <OrbitControls
        ref={controlsRef}
        enablePan={false}
        minDistance={MIN_CAMERA_DISTANCE}
        maxDistance={MAX_CAMERA_DISTANCE}
        rotateSpeed={0.6}
        zoomSpeed={0.7}
      />
    </>
  );
}

export default function Globe3D({ location, onGlobePick, className }: Globe3DProps) {
  return (
    <div className={className} style={{ width: '100%', height: '100%' }}>
      <Canvas
        className="w-full h-full"
        style={{ width: '100%', height: '100%' }}
        camera={{ position: [0, 0, INITIAL_CAMERA_DISTANCE], fov: 45 }}
        dpr={[1, 2]}
      >
        <color attach="background" args={['#020617']} />
        <GlobeMesh location={location} onGlobePick={onGlobePick} />
      </Canvas>
    </div>
  );
}
