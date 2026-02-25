'use client';

import { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

// ---------------------------------------------------------------------------
// GLSL: simplex noise + FBM
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
// Vertex shader
// ---------------------------------------------------------------------------
const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// ---------------------------------------------------------------------------
// Fragment shader – soft fog wisps (optimised)
// Total: 12 snoise per pixel (was 22)
// ---------------------------------------------------------------------------
const fragmentShader = /* glsl */ `
  ${noiseGLSL}

  uniform float uTime;
  uniform float uSpeed;
  uniform float uScale;
  uniform vec3  uFogColor;
  uniform vec3  uFogShadow;
  uniform float uOpacity;
  uniform float uCoverage;
  uniform float uSoftness;
  uniform float uWarpStrength;
  uniform float uAspect;
  uniform vec2  uWindDir;
  uniform float uVerticalFade;

  varying vec2 vUv;

  void main() {
    vec2 uv = vUv;
    vec2 asp = vec2(uAspect, 1.0);
    vec2 drift = uWindDir * uTime * uSpeed;
    vec2 p = uv * asp * uScale + drift;

    // Base fog shape – 4 octaves
    float base = fbm4(p);

    // Single-level domain warp – 2 octaves each
    vec2 q = vec2(
      fbm2(p + vec2(0.0, 0.0)),
      fbm2(p + vec2(5.2, 1.3))
    );

    // Warped fog with temporal evolution – 3 octaves
    float warped = fbm3(p + uWarpStrength * q + 0.08 * uTime * uSpeed);

    float n = mix(base, warped, 0.35);
    n = n * 0.5 + 0.5;

    float fog = smoothstep(uCoverage, uCoverage + uSoftness, n);

    // Brightness variation
    float detail = snoise(p * 1.8 + drift * 0.4) * 0.10;
    float shade = clamp(fog * 0.7 + 0.3 + detail, 0.0, 1.0);
    vec3 col = mix(uFogShadow, uFogColor, shade);

    // Vertical density: denser at bottom
    float vertFade = mix(1.0, smoothstep(0.0, 0.85, 1.0 - uv.y), uVerticalFade);

    // Edge vignette
    float edgeFade = smoothstep(0.0, 0.12, uv.x) * smoothstep(1.0, 0.88, uv.x)
                   * smoothstep(0.0, 0.10, uv.y) * smoothstep(1.0, 0.90, uv.y);

    gl_FragColor = vec4(col, fog * uOpacity * edgeFade * vertFade);
  }
`;

// ---------------------------------------------------------------------------
// FogLayer component
// ---------------------------------------------------------------------------
interface FogLayerProps {
  zDepth: number;
  speed: number;
  scale: number;
  opacity: number;
  coverage: number;
  softness: number;
  fogColor: THREE.Color;
  fogShadow: THREE.Color;
  warpStrength?: number;
  windDir?: [number, number];
  planeSize?: [number, number];
  yOffset?: number;
  verticalFade?: number;
}

function FogLayerMesh({
  zDepth,
  speed,
  scale,
  opacity,
  coverage,
  softness,
  fogColor,
  fogShadow,
  warpStrength = 1.0,
  windDir = [1.0, 0.1],
  planeSize = [50, 28],
  yOffset = 0,
  verticalFade = 0.5,
}: FogLayerProps) {
  const matRef = useRef<THREE.ShaderMaterial>(null);

  const uniforms = useMemo(
    () => ({
      uTime:         { value: 0 },
      uSpeed:        { value: speed },
      uScale:        { value: scale },
      uFogColor:     { value: fogColor },
      uFogShadow:    { value: fogShadow },
      uOpacity:      { value: opacity },
      uCoverage:     { value: coverage },
      uSoftness:     { value: softness },
      uWarpStrength: { value: warpStrength },
      uWindDir:      { value: new THREE.Vector2(windDir[0], windDir[1]) },
      uAspect:       { value: planeSize[0] / planeSize[1] },
      uVerticalFade: { value: verticalFade },
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
// FoggyScene – multiple fog layers at different depths
// ---------------------------------------------------------------------------
function FoggyScene({ isSunset }: { isSunset?: boolean }) {
  const layers = useMemo(() => {
    if (isSunset) {
      return [
        {
          zDepth: -10,
          speed: 0.03,
          scale: 1.6,
          opacity: 0.58,
          coverage: 0.32,
          softness: 0.24,
          warpStrength: 0.9,
          fogColor: new THREE.Color(0.55, 0.51, 0.53),
          fogShadow: new THREE.Color(0.35, 0.31, 0.35),
          windDir: [1.0, 0.06] as [number, number],
          planeSize: [58, 34] as [number, number],
          yOffset: 0,
          verticalFade: 0.35,
        },
        {
          zDepth: -5,
          speed: 0.055,
          scale: 1.1,
          opacity: 0.75,
          coverage: 0.38,
          softness: 0.20,
          warpStrength: 1.2,
          fogColor: new THREE.Color(0.48, 0.44, 0.46),
          fogShadow: new THREE.Color(0.28, 0.24, 0.28),
          windDir: [1.0, 0.04] as [number, number],
          planeSize: [60, 28] as [number, number],
          yOffset: -3,
          verticalFade: 0.6,
        },
        {
          zDepth: -2,
          speed: 0.08,
          scale: 2.2,
          opacity: 0.60,
          coverage: 0.42,
          softness: 0.18,
          warpStrength: 0.6,
          fogColor: new THREE.Color(0.45, 0.42, 0.44),
          fogShadow: new THREE.Color(0.25, 0.22, 0.26),
          windDir: [1.0, 0.02] as [number, number],
          planeSize: [62, 22] as [number, number],
          yOffset: -5,
          verticalFade: 0.75,
        },
        {
          zDepth: -0.5,
          speed: 0.11,
          scale: 2.8,
          opacity: 0.40,
          coverage: 0.48,
          softness: 0.16,
          warpStrength: 0.5,
          fogColor: new THREE.Color(0.42, 0.38, 0.42),
          fogShadow: new THREE.Color(0.22, 0.20, 0.24),
          windDir: [1.0, 0.03] as [number, number],
          planeSize: [64, 18] as [number, number],
          yOffset: -6,
          verticalFade: 0.85,
        },
      ];
    }

    return [
      // Deep background haze – slow, full coverage, lightest
      {
        zDepth: -11,
        speed: 0.03,
        scale: 1.6,
        opacity: 0.62,
        coverage: 0.30,
        softness: 0.25,
        warpStrength: 0.9,
        fogColor: new THREE.Color(0.86, 0.88, 0.90),
        fogShadow: new THREE.Color(0.65, 0.67, 0.71),
        windDir: [1.0, 0.05] as [number, number],
        planeSize: [58, 34] as [number, number],
        yOffset: 0,
        verticalFade: 0.32,
      },
      // Mid rolling fog
      {
        zDepth: -6,
        speed: 0.05,
        scale: 1.2,
        opacity: 0.75,
        coverage: 0.36,
        softness: 0.20,
        warpStrength: 1.2,
        fogColor: new THREE.Color(0.80, 0.82, 0.85),
        fogShadow: new THREE.Color(0.55, 0.58, 0.62),
        windDir: [1.0, 0.08] as [number, number],
        planeSize: [58, 30] as [number, number],
        yOffset: -2,
        verticalFade: 0.45,
      },
      // Lower dense fog band
      {
        zDepth: -3.5,
        speed: 0.065,
        scale: 1.0,
        opacity: 0.82,
        coverage: 0.38,
        softness: 0.18,
        warpStrength: 1.3,
        fogColor: new THREE.Color(0.78, 0.80, 0.83),
        fogShadow: new THREE.Color(0.50, 0.53, 0.58),
        windDir: [1.0, 0.04] as [number, number],
        planeSize: [62, 26] as [number, number],
        yOffset: -4,
        verticalFade: 0.6,
      },
      // Near ground mist
      {
        zDepth: -1.5,
        speed: 0.09,
        scale: 2.0,
        opacity: 0.65,
        coverage: 0.42,
        softness: 0.16,
        warpStrength: 0.7,
        fogColor: new THREE.Color(0.82, 0.84, 0.86),
        fogShadow: new THREE.Color(0.58, 0.60, 0.64),
        windDir: [1.0, 0.02] as [number, number],
        planeSize: [64, 20] as [number, number],
        yOffset: -6,
        verticalFade: 0.75,
      },
      // Foreground wisp
      {
        zDepth: -0.3,
        speed: 0.12,
        scale: 2.6,
        opacity: 0.45,
        coverage: 0.46,
        softness: 0.15,
        warpStrength: 0.5,
        fogColor: new THREE.Color(0.85, 0.86, 0.88),
        fogShadow: new THREE.Color(0.60, 0.62, 0.66),
        windDir: [1.0, 0.03] as [number, number],
        planeSize: [66, 16] as [number, number],
        yOffset: -7,
        verticalFade: 0.9,
      },
    ];
  }, [isSunset]);

  return (
    <>
      {layers.map((cfg, i) => (
        <FogLayerMesh key={i} {...cfg} />
      ))}
    </>
  );
}

// ---------------------------------------------------------------------------
// Exported component
// ---------------------------------------------------------------------------
interface FoggyWeatherBackgroundProps {
  className?: string;
  sunsetTime?: string;
  currentTime?: string;
}

export default function FoggyWeatherBackground({
  className = '',
  sunsetTime,
  currentTime,
}: FoggyWeatherBackgroundProps) {
  const isSunset = useMemo(() => {
    if (!sunsetTime || !currentTime) return false;
    try {
      const currentDate = new Date(currentTime.replace(' ', 'T'));
      const [sunsetTimePart, sunsetPeriod] = sunsetTime.split(' ');
      const [sunsetHours, sunsetMinutes] = sunsetTimePart.split(':').map(Number);
      let sunsetHours24 = sunsetHours;
      if (sunsetPeriod === 'PM' && sunsetHours !== 12) {
        sunsetHours24 = sunsetHours + 12;
      } else if (sunsetPeriod === 'AM' && sunsetHours === 12) {
        sunsetHours24 = 0;
      }
      const sunsetDate = new Date(currentDate);
      sunsetDate.setHours(sunsetHours24, sunsetMinutes, 0, 0);
      const oneHourBefore = new Date(sunsetDate.getTime() - 60 * 60 * 1000);
      const oneHourAfter = new Date(sunsetDate.getTime() + 60 * 60 * 1000);
      return currentDate >= oneHourBefore && currentDate <= oneHourAfter;
    } catch {
      return false;
    }
  }, [sunsetTime, currentTime]);

  return (
    <div data-weather-bg className={`fixed inset-0 -z-10 ${className}`}>
      {isSunset ? (
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(to bottom, rgb(145, 140, 148) 0%, rgb(125, 120, 128) 30%, rgb(110, 108, 115) 60%, rgb(95, 92, 100) 100%)',
          }}
        />
      ) : (
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(to bottom, rgb(205, 210, 216) 0%, rgb(190, 196, 204) 25%, rgb(175, 182, 192) 50%, rgb(160, 168, 178) 75%, rgb(148, 155, 165) 100%)',
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
        <FoggyScene isSunset={isSunset} />
      </Canvas>
    </div>
  );
}
