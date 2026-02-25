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
    const vec4 C = vec4(0.211324865405187, 0.366025403784439,
                       -0.577350269189626, 0.024390243902439);
    vec2 i  = floor(v + dot(v, C.yy));
    vec2 x0 = v - i + dot(i, C.xx);
    vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
    vec4 x12 = x0.xyxy + C.xxzz;
    x12.xy -= i1;
    i = mod289(i);
    vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0))
                             + i.x + vec3(0.0, i1.x, 1.0));
    vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy),
                             dot(x12.zw, x12.zw)), 0.0);
    m = m * m; m = m * m;
    vec3 x_ = 2.0 * fract(p * C.www) - 1.0;
    vec3 h  = abs(x_) - 0.5;
    vec3 ox = floor(x_ + 0.5);
    vec3 a0 = x_ - ox;
    m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
    vec3 g;
    g.x  = a0.x * x0.x + h.x * x0.y;
    g.yz = a0.yz * x12.xz + h.yz * x12.yw;
    return 130.0 * dot(m, g);
  }

  float fbm2(vec2 p) {
    return 0.5 * snoise(p) + 0.25 * snoise(p * 2.0);
  }
  float fbm3(vec2 p) {
    return 0.5 * snoise(p) + 0.25 * snoise(p * 2.0) + 0.125 * snoise(p * 4.0);
  }
  float fbm4(vec2 p) {
    return 0.5 * snoise(p) + 0.25 * snoise(p * 2.0)
         + 0.125 * snoise(p * 4.0) + 0.0625 * snoise(p * 8.0);
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
// Fragment shader – procedural volumetric clouds (optimised)
// Total: 12 snoise per pixel (was 26)
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
  uniform float uWarpStrength;
  uniform float uAspect;
  uniform vec2  uWindDir;

  varying vec2 vUv;

  void main() {
    vec2 uv = vUv;
    vec2 asp = vec2(uAspect, 1.0);
    vec2 drift = uWindDir * uTime * uSpeed;
    vec2 p = uv * asp * uScale + drift;

    // Base cloud shape – 4 octaves
    float base = fbm4(p);

    // Single-level domain warp – 2 octaves each (was double warp with 4 oct)
    vec2 q = vec2(
      fbm2(p + vec2(0.0, 0.0)),
      fbm2(p + vec2(5.2, 1.3))
    );

    // Warped cloud with temporal drift – 3 octaves
    float warped = fbm3(p + uWarpStrength * q + 0.1 * uTime * uSpeed);

    // Blend base + warped
    float cloud = mix(base, warped, 0.4);
    cloud = cloud * 0.5 + 0.5;
    cloud = smoothstep(uCoverage, uCoverage + uSoftness, cloud);

    // Lighting from vertical gradient + cheap detail
    float lightGrad = smoothstep(0.0, 1.0, uv.y) * 0.3 + 0.7;
    float detail = snoise(p * 1.5 + drift * 0.5) * 0.12;
    vec3 col = mix(uShadowColor, uCloudColor, clamp((lightGrad + detail) * cloud, 0.0, 1.0));

    // Edge vignette
    float edgeFade = smoothstep(0.0, 0.15, uv.x) * smoothstep(1.0, 0.85, uv.x)
                   * smoothstep(0.0, 0.18, uv.y) * smoothstep(1.0, 0.82, uv.y);

    gl_FragColor = vec4(col, cloud * uOpacity * edgeFade);
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
          speed: 0.05,
          scale: 2.5,
          opacity: 0.65,
          coverage: 0.42,
          softness: 0.18,
          warpStrength: 1.6,
          cloudColor: new THREE.Color(0.62, 0.56, 0.58),
          shadowColor: new THREE.Color(0.32, 0.28, 0.32),
          windDir: [1.0, 0.12] as [number, number],
          planeSize: [55, 32] as [number, number],
          yOffset: 1,
        },
        {
          zDepth: -5,
          speed: 0.07,
          scale: 1.8,
          opacity: 0.75,
          coverage: 0.45,
          softness: 0.15,
          warpStrength: 1.3,
          cloudColor: new THREE.Color(0.55, 0.48, 0.52),
          shadowColor: new THREE.Color(0.28, 0.24, 0.28),
          windDir: [1.0, 0.20] as [number, number],
          planeSize: [52, 30] as [number, number],
          yOffset: 0,
        },
        {
          zDepth: -2,
          speed: 0.10,
          scale: 1.3,
          opacity: 0.80,
          coverage: 0.48,
          softness: 0.14,
          warpStrength: 1.0,
          cloudColor: new THREE.Color(0.48, 0.42, 0.46),
          shadowColor: new THREE.Color(0.22, 0.18, 0.22),
          windDir: [1.0, 0.08] as [number, number],
          planeSize: [55, 30] as [number, number],
          yOffset: -1,
        },
        {
          zDepth: -0.5,
          speed: 0.14,
          scale: 2.0,
          opacity: 0.45,
          coverage: 0.52,
          softness: 0.16,
          warpStrength: 0.7,
          cloudColor: new THREE.Color(0.42, 0.36, 0.40),
          shadowColor: new THREE.Color(0.20, 0.16, 0.20),
          windDir: [1.0, 0.15] as [number, number],
          planeSize: [58, 28] as [number, number],
          yOffset: -2,
        },
      ];
    }

    return [
      {
        zDepth: -10,
        speed: 0.05,
        scale: 2.5,
        opacity: 0.70,
        coverage: 0.42,
        softness: 0.18,
        warpStrength: 1.6,
        cloudColor: new THREE.Color(0.78, 0.80, 0.84),
        shadowColor: new THREE.Color(0.42, 0.44, 0.50),
        windDir: [1.0, 0.12] as [number, number],
        planeSize: [55, 32] as [number, number],
        yOffset: 1,
      },
      {
        zDepth: -5,
        speed: 0.07,
        scale: 1.8,
        opacity: 0.80,
        coverage: 0.45,
        softness: 0.15,
        warpStrength: 1.3,
        cloudColor: new THREE.Color(0.68, 0.70, 0.74),
        shadowColor: new THREE.Color(0.34, 0.36, 0.42),
        windDir: [1.0, 0.20] as [number, number],
        planeSize: [52, 30] as [number, number],
        yOffset: 0,
      },
      {
        zDepth: -2,
        speed: 0.10,
        scale: 1.3,
        opacity: 0.85,
        coverage: 0.48,
        softness: 0.14,
        warpStrength: 1.0,
        cloudColor: new THREE.Color(0.55, 0.57, 0.62),
        shadowColor: new THREE.Color(0.25, 0.27, 0.32),
        windDir: [1.0, 0.08] as [number, number],
        planeSize: [55, 30] as [number, number],
        yOffset: -1,
      },
      {
        zDepth: -0.5,
        speed: 0.14,
        scale: 2.0,
        opacity: 0.50,
        coverage: 0.52,
        softness: 0.16,
        warpStrength: 0.7,
        cloudColor: new THREE.Color(0.48, 0.50, 0.55),
        shadowColor: new THREE.Color(0.22, 0.24, 0.30),
        windDir: [1.0, 0.15] as [number, number],
        planeSize: [58, 28] as [number, number],
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
        gl={{ alpha: true, antialias: false }}
        dpr={[1, 1]}
        performance={{ min: 0.5 }}
      >
        <CloudyScene isSunset={isSunset} />
      </Canvas>
    </div>
  );
}
