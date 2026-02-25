'use client';

import { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

// ---------------------------------------------------------------------------
// GLSL helpers: classic 2-D Perlin noise → FBM
// ---------------------------------------------------------------------------

const noiseGLSL = /* glsl */ `
  vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec3 permute(vec3 x) { return mod289(((x * 34.0) + 10.0) * x); }

  float snoise(vec2 v) {
    const vec4 C = vec4(
       0.211324865405187,   // (3.0-sqrt(3.0))/6.0
       0.366025403784439,   // 0.5*(sqrt(3.0)-1.0)
      -0.577350269189626,   // -1.0 + 2.0 * C.x
       0.024390243902439);  // 1.0/41.0
    vec2 i  = floor(v + dot(v, C.yy));
    vec2 x0 = v -   i + dot(i, C.xx);
    vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
    vec4 x12 = x0.xyxy + C.xxzz;
    x12.xy -= i1;
    i = mod289(i);
    vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0))
                             + i.x + vec3(0.0, i1.x, 1.0));
    vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy),
                             dot(x12.zw,x12.zw)), 0.0);
    m = m * m;
    m = m * m;
    vec3 x_ = 2.0 * fract(p * C.www) - 1.0;
    vec3 h  = abs(x_) - 0.5;
    vec3 ox = floor(x_ + 0.5);
    vec3 a0 = x_ - ox;
    m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);
    vec3 g;
    g.x = a0.x * x0.x  + h.x * x0.y;
    g.yz = a0.yz * x12.xz + h.yz * x12.yw;
    return 130.0 * dot(m, g);
  }

  float fbm(vec2 p, int octaves) {
    float value = 0.0;
    float amp   = 0.5;
    float freq  = 1.0;
    for (int i = 0; i < 8; i++) {
      if (i >= octaves) break;
      value += amp * snoise(p * freq);
      freq  *= 2.0;
      amp   *= 0.5;
    }
    return value;
  }
`;

// ---------------------------------------------------------------------------
// Vertex shader – pass UVs through
// ---------------------------------------------------------------------------
const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// ---------------------------------------------------------------------------
// Fragment shader – procedural volumetric clouds
// ---------------------------------------------------------------------------
const fragmentShader = /* glsl */ `
  ${noiseGLSL}

  uniform float uTime;
  uniform float uSpeed;
  uniform float uScale;
  uniform vec3  uCloudColor;
  uniform vec3  uShadowColor;
  uniform float uOpacity;
  uniform float uCoverage;
  uniform float uSoftness;
  uniform vec2  uWindDir;

  varying vec2 vUv;

  void main() {
    vec2 uv = vUv;

    // Drift with time
    vec2 drift = uWindDir * uTime * uSpeed;
    vec2 p = uv * uScale + drift;

    // Primary cloud shape (5 octaves)
    float n = fbm(p, 5);

    // Warp the domain for more organic shapes
    vec2 q = vec2(
      fbm(p + vec2(0.0, 0.0), 4),
      fbm(p + vec2(5.2, 1.3), 4)
    );
    vec2 r = vec2(
      fbm(p + 4.0 * q + vec2(1.7, 9.2) + 0.15 * uTime * uSpeed, 4),
      fbm(p + 4.0 * q + vec2(8.3, 2.8) + 0.12 * uTime * uSpeed, 4)
    );
    float f = fbm(p + 4.0 * r, 5);

    // Blend primary noise with warped noise
    float cloud = mix(n, f, 0.6);
    // Remap to [0,1] and apply coverage threshold
    cloud = smoothstep(uCoverage - uSoftness, uCoverage + uSoftness, cloud * 0.5 + 0.5);

    // Lighting variation: use the warp vectors to fake illumination
    float light = dot(normalize(q), vec2(0.4, 0.7)) * 0.5 + 0.5;
    vec3 col = mix(uShadowColor, uCloudColor, light * 0.6 + cloud * 0.4);

    // Edge vignette so the plane fades smoothly rather than hard-cutting
    float edgeFade = 1.0;
    edgeFade *= smoothstep(0.0, 0.18, uv.x) * smoothstep(1.0, 0.82, uv.x);
    edgeFade *= smoothstep(0.0, 0.22, uv.y) * smoothstep(1.0, 0.78, uv.y);

    float alpha = cloud * uOpacity * edgeFade;

    gl_FragColor = vec4(col, alpha);
  }
`;

// ---------------------------------------------------------------------------
// CloudLayer – a single plane with the cloud shader
// ---------------------------------------------------------------------------
interface CloudLayerProps {
  zDepth: number;
  speed: number;
  scale: number;
  opacity: number;
  coverage: number;
  softness: number;
  cloudColor: THREE.Color;
  shadowColor: THREE.Color;
  warpStrength?: number;
  windDir?: [number, number];
  planeSize?: [number, number];
  yOffset?: number;
}

function CloudLayer({
  zDepth,
  speed,
  scale,
  opacity,
  coverage,
  softness,
  cloudColor,
  shadowColor,
  warpStrength = 1.5,
  windDir = [1.0, 0.3],
  planeSize = [45, 25],
  yOffset = 0,
}: CloudLayerProps) {
  const matRef = useRef<THREE.ShaderMaterial>(null);

  const uniforms = useMemo(
    () => ({
      uTime:         { value: 0 },
      uSpeed:        { value: speed },
      uScale:        { value: scale },
      uCloudColor:   { value: cloudColor },
      uShadowColor:  { value: shadowColor },
      uOpacity:      { value: opacity },
      uCoverage:     { value: coverage },
      uSoftness:     { value: softness },
      uWarpStrength: { value: warpStrength },
      uWindDir:      { value: new THREE.Vector2(windDir[0], windDir[1]) },
      uAspect:       { value: planeSize[0] / planeSize[1] },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  useFrame(({ clock }) => {
    if (matRef.current) {
      matRef.current.uniforms.uTime.value = clock.elapsedTime;
    }
  });

  return (
    <mesh position={[0, yOffset, zDepth]}>
      <planeGeometry args={[planeSize[0], planeSize[1], 1, 1]} />
      <shaderMaterial
        ref={matRef}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

// ---------------------------------------------------------------------------
// CloudyScene – compose multiple cloud layers
// ---------------------------------------------------------------------------
function CloudyScene({ isSunset }: { isSunset?: boolean }) {
  const layers = useMemo(() => {
    if (isSunset) {
      return [
        {
          zDepth: -10,
          speed: 0.012,
          scale: 3.2,
          opacity: 0.45,
          coverage: 0.32,
          softness: 0.28,
          cloudColor: new THREE.Color(0.55, 0.50, 0.52),
          shadowColor: new THREE.Color(0.32, 0.28, 0.32),
          windDir: [1.0, 0.2] as [number, number],
          planeSize: [50, 30] as [number, number],
          yOffset: 2,
        },
        {
          zDepth: -6,
          speed: 0.02,
          scale: 2.2,
          opacity: 0.58,
          coverage: 0.30,
          softness: 0.25,
          cloudColor: new THREE.Color(0.52, 0.45, 0.48),
          shadowColor: new THREE.Color(0.28, 0.24, 0.28),
          windDir: [1.0, 0.35] as [number, number],
          planeSize: [48, 28] as [number, number],
          yOffset: 0,
        },
        {
          zDepth: -3,
          speed: 0.032,
          scale: 1.4,
          opacity: 0.68,
          coverage: 0.28,
          softness: 0.22,
          cloudColor: new THREE.Color(0.45, 0.38, 0.42),
          shadowColor: new THREE.Color(0.22, 0.18, 0.22),
          windDir: [1.0, 0.15] as [number, number],
          planeSize: [50, 28] as [number, number],
          yOffset: -1,
        },
        {
          zDepth: -0.5,
          speed: 0.045,
          scale: 0.9,
          opacity: 0.35,
          coverage: 0.38,
          softness: 0.2,
          cloudColor: new THREE.Color(0.38, 0.32, 0.36),
          shadowColor: new THREE.Color(0.18, 0.14, 0.18),
          windDir: [1.0, 0.4] as [number, number],
          planeSize: [52, 26] as [number, number],
          yOffset: -2,
        },
      ];
    }

    return [
      {
        zDepth: -10,
        speed: 0.01,
        scale: 3.0,
        opacity: 0.5,
        coverage: 0.30,
        softness: 0.28,
        cloudColor: new THREE.Color(0.72, 0.73, 0.76),
        shadowColor: new THREE.Color(0.48, 0.50, 0.54),
        windDir: [1.0, 0.2] as [number, number],
        planeSize: [50, 30] as [number, number],
        yOffset: 2,
      },
      {
        zDepth: -6,
        speed: 0.018,
        scale: 2.0,
        opacity: 0.62,
        coverage: 0.28,
        softness: 0.25,
        cloudColor: new THREE.Color(0.60, 0.62, 0.66),
        shadowColor: new THREE.Color(0.38, 0.40, 0.44),
        windDir: [1.0, 0.35] as [number, number],
        planeSize: [48, 28] as [number, number],
        yOffset: 0,
      },
      {
        zDepth: -3,
        speed: 0.028,
        scale: 1.2,
        opacity: 0.72,
        coverage: 0.26,
        softness: 0.22,
        cloudColor: new THREE.Color(0.50, 0.52, 0.56),
        shadowColor: new THREE.Color(0.30, 0.32, 0.36),
        windDir: [1.0, 0.15] as [number, number],
        planeSize: [50, 28] as [number, number],
        yOffset: -1,
      },
      {
        zDepth: -0.5,
        speed: 0.04,
        scale: 0.8,
        opacity: 0.38,
        coverage: 0.35,
        softness: 0.2,
        cloudColor: new THREE.Color(0.40, 0.42, 0.46),
        shadowColor: new THREE.Color(0.22, 0.24, 0.28),
        windDir: [1.0, 0.4] as [number, number],
        planeSize: [52, 26] as [number, number],
        yOffset: -2,
      },
    ];
  }, [isSunset]);

  return (
    <>
      {layers.map((cfg, i) => (
        <CloudLayer key={i} {...cfg} />
      ))}
    </>
  );
}

// ---------------------------------------------------------------------------
// Exported component
// ---------------------------------------------------------------------------
interface CloudyWeatherBackgroundProps {
  className?: string;
  sunsetTime?: string;
  currentTime?: string;
}

export default function CloudyWeatherBackground({
  className = '',
  sunsetTime,
  currentTime,
}: CloudyWeatherBackgroundProps) {
  const isSunset = Boolean(
    sunsetTime &&
      currentTime &&
      (() => {
        try {
          const currentDate = new Date(currentTime.replace(' ', 'T'));
          const [timePart, period] = sunsetTime.split(' ');
          const [hours, minutes] = timePart.split(':').map(Number);
          let sunsetHours = hours;
          if (period === 'PM' && hours !== 12) {
            sunsetHours = hours + 12;
          } else if (period === 'AM' && hours === 12) {
            sunsetHours = 0;
          }
          const sunsetDate = new Date(currentDate);
          sunsetDate.setHours(sunsetHours, minutes, 0, 0);
          const oneHourBefore = new Date(
            sunsetDate.getTime() - 60 * 60 * 1000,
          );
          const oneHourAfter = new Date(
            sunsetDate.getTime() + 60 * 60 * 1000,
          );
          return currentDate >= oneHourBefore && currentDate <= oneHourAfter;
        } catch {
          return false;
        }
      })(),
  );

  return (
    <div data-weather-bg className={`fixed inset-0 -z-10 ${className}`}>
      {isSunset ? (
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(to bottom, rgb(62, 68, 82) 0%, rgb(82, 88, 108) 15%, rgb(100, 100, 125) 35%, rgb(120, 112, 118) 55%, rgb(138, 118, 110) 75%, rgb(120, 105, 95) 100%)',
          }}
        />
      ) : (
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(to bottom, rgb(88, 96, 112) 0%, rgb(110, 118, 132) 20%, rgb(135, 142, 155) 45%, rgb(155, 158, 163) 65%, rgb(140, 144, 150) 85%, rgb(115, 120, 128) 100%)',
          }}
        />
      )}

      <Canvas
        camera={{ position: [0, 0, 10], fov: 75 }}
        style={{ width: '100%', height: '100%' }}
        gl={{ alpha: true, antialias: true }}
        dpr={[1, 1.5]}
        performance={{ min: 0.5 }}
      >
        <CloudyScene isSunset={isSunset} />
      </Canvas>
    </div>
  );
}
