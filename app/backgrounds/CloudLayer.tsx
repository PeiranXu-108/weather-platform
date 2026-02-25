'use client';

import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

// ---------------------------------------------------------------------------
// GLSL helpers: simplex noise + unrolled FBM
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

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

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

    float base = fbm4(p);

    vec2 q = vec2(
      fbm2(p + vec2(0.0, 0.0)),
      fbm2(p + vec2(5.2, 1.3))
    );

    float warped = fbm3(p + uWarpStrength * q + 0.1 * uTime * uSpeed);

    float cloud = mix(base, warped, 0.4);
    cloud = cloud * 0.5 + 0.5;
    cloud = smoothstep(uCoverage, uCoverage + uSoftness, cloud);

    float lightGrad = smoothstep(0.0, 1.0, uv.y) * 0.3 + 0.7;
    float detail = snoise(p * 1.5 + drift * 0.5) * 0.12;
    vec3 col = mix(uShadowColor, uCloudColor, clamp((lightGrad + detail) * cloud, 0.0, 1.0));

    float edgeFade = smoothstep(0.0, 0.15, uv.x) * smoothstep(1.0, 0.85, uv.x)
                   * smoothstep(0.0, 0.18, uv.y) * smoothstep(1.0, 0.82, uv.y);

    gl_FragColor = vec4(col, cloud * uOpacity * edgeFade);
  }
`;

// ---------------------------------------------------------------------------
// Exported types & component
// ---------------------------------------------------------------------------
export interface CloudLayerProps {
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

export default function CloudLayer({
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
