'use client';

import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

const SUN_DISC_RADIUS = 0.06;

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  precision highp float;

  uniform float uTime;
  uniform vec2  uSunPos;
  uniform vec3  uSunColor;
  uniform float uIntensity;
  uniform float uAspect;
  uniform float uVariant;

  varying vec2 vUv;

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

  vec3 hsv2rgb(vec3 c) {
    vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
    vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
    return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
  }

  float flareGhost(vec2 p, vec2 pos, float size) {
    float d = length(p - pos);
    return smoothstep(size, size * 0.08, d);
  }

  float angleDelta(float a, float b) {
    return abs(atan(sin(a - b), cos(a - b)));
  }

  void main() {
    vec2 uv = vUv;
    float sunriseMix = 1.0 - step(0.25, abs(uVariant - 1.0));
    float sunsetMix  = 1.0 - step(0.25, abs(uVariant - 2.0));
    float twilightMix = max(sunriseMix, sunsetMix);

    vec2 p    = vec2(uv.x * uAspect, uv.y);
    vec2 sunP = vec2(uSunPos.x * uAspect, uSunPos.y);

    vec2  delta = p - sunP;
    float dist  = length(delta);
    float angle = atan(delta.y, delta.x);

    vec3  col = vec3(0.0);
    float a   = 0.0;

    // 1. Sun disc – keep the core fully visible while the outer glow blooms outward.
    float discR = 0.06;
    float disc  = 1.0 - smoothstep(0.0, discR, dist);
    float core  = 1.0 - smoothstep(0.0, discR * 0.35, dist);
    col += uSunColor * disc * 1.8;
    col += vec3(1.0) * core * 1.2;
    a   += disc * 0.9;

    float b1 = exp(-dist * 8.0)  * 0.85;
    float b2 = exp(-dist * 2.8)  * 0.32;
    float b3 = exp(-dist * 0.9)  * 0.10;
    float b4 = exp(-dist * 0.45) * 0.04;

    float bloomHueT = smoothstep(0.03, 0.55, dist);
    float bloomHue  = bloomHueT * 0.72;
    float bloomSat  = bloomHueT * 0.30;
    vec3  bloomTint = hsv2rgb(vec3(bloomHue, bloomSat, 1.0));
    vec3  dawnTint  = mix(vec3(1.0, 0.80, 0.70), vec3(1.0, 0.67, 0.78), bloomHueT);
    vec3  duskTint  = mix(uSunColor, bloomTint, bloomHueT * 0.6);
    vec3  bloomCol  = mix(duskTint, dawnTint, sunriseMix * 0.72);

    col += bloomCol * (b1 + b2 + b3 + b4);
    a   += b1 * 0.7 + b2 * 0.35 + b3 * 0.12 + b4 * 0.04;

    float haloR = 0.40;
    float ringSigned = dist - haloR;

    float arcCenter = -1.57;
    float arcDiff   = angleDelta(angle, arcCenter);
    float arcMask   = 1.0 - smoothstep(0.66, 1.24, arcDiff);
    float arcMid    = pow(max(0.0, 1.0 - arcDiff / 1.05), 1.45);

    float haloW     = mix(0.026, 0.094, arcMid);
    float ringCore  = exp(-(ringSigned * ringSigned) / (2.0 * haloW * haloW));
    float ringGlow  = exp(-(ringSigned * ringSigned) / (2.0 * (haloW * 1.9) * (haloW * 1.9)));

    float haloPos = clamp(ringSigned / (haloW * 1.75) * 0.5 + 0.5, 0.0, 1.0);
    float hue     = mix(0.02, 0.82, haloPos);
    vec3  rainbow = hsv2rgb(vec3(hue, 0.76, 1.0));
    vec3  pastelRainbow = mix(rainbow, vec3(1.0), 0.24);
    vec3  dawnPearl = mix(vec3(1.0, 0.78, 0.76), vec3(0.98, 0.88, 1.0), haloPos);
    vec3  haloColor = mix(pastelRainbow, dawnPearl, sunriseMix * 0.82);

    float angVar  = 0.92 + 0.08 * sin(angle * 2.8 + uTime * 0.18);
    float breathe = 0.95 + 0.05 * sin(uTime * 0.38);
    float arcRing = (ringCore * 0.95 + ringGlow * 0.45) * arcMask;
    col += haloColor * arcRing * mix(0.46, 0.38, sunriseMix) * angVar * breathe;
    a   += arcRing * 0.068 * angVar * breathe;

    float halo2R = 0.63;
    float halo2W = 0.060;
    float ring2Signed = dist - halo2R;
    float ring2 = exp(-(ring2Signed * ring2Signed) / (2.0 * halo2W * halo2W));
    float ring2HaloPos = clamp(ring2Signed / (halo2W * 1.9) * 0.5 + 0.5, 0.0, 1.0);
    float hue2  = mix(0.03, 0.80, ring2HaloPos);
    vec3  rb2   = hsv2rgb(vec3(hue2, 0.42, 1.0));
    vec3  pastelRb2 = mix(rb2, vec3(1.0), 0.38);
    vec3  dawnRb2 = mix(vec3(1.0, 0.77, 0.72), vec3(0.90, 0.95, 1.0), ring2HaloPos);
    vec3  outerHaloColor = mix(pastelRb2, dawnRb2, sunriseMix * 0.85);
    float ring2Arc = mix(0.55, 1.0, arcMask);
    col += outerHaloColor * ring2 * mix(0.20, 0.17, sunriseMix) * ring2Arc;
    a   += ring2 * 0.027 * ring2Arc;

    float rA   = angle + uTime * 0.008;
    float rays = 0.0;
    rays += pow(max(cos(rA * 8.0), 0.0), 32.0)         * exp(-dist * 2.2) * 0.7;
    rays += pow(max(cos(rA * 6.0 + 0.6), 0.0), 44.0)   * exp(-dist * 3.0) * 0.45;
    rays += pow(max(cos(rA * 14.0 + 1.3), 0.0), 60.0)  * exp(-dist * 4.5) * 0.25;
    rays += pow(max(cos(rA * 4.0 - 0.4), 0.0), 20.0)   * exp(-dist * 1.4) * 0.18;
    col += mix(uSunColor, vec3(1.0, 0.86, 0.74), sunriseMix * 0.65) * rays * mix(0.22, 0.16, sunriseMix);
    a   += rays * mix(0.14, 0.10, sunriseMix);

    vec2 dawnGlowOffset = vec2(0.12 * uAspect, -0.055);
    float dawnGlow = exp(-pow(length((p - (sunP + dawnGlowOffset)) * vec2(0.82, 1.55)), 2.0) / 0.20);
    vec2 dawnMistOffset = vec2(0.19 * uAspect, -0.12);
    float dawnMist = exp(-pow(length((p - (sunP + dawnMistOffset)) * vec2(0.60, 1.90)), 2.0) / 0.34);
    col += vec3(1.0, 0.74, 0.72) * dawnGlow * 0.26 * sunriseMix;
    col += vec3(1.0, 0.86, 0.74) * dawnMist * 0.18 * sunriseMix;
    a   += (dawnGlow * 0.09 + dawnMist * 0.05) * sunriseMix;

    vec2  ctr   = vec2(0.5 * uAspect, 0.5);
    vec2  fAxis = ctr - sunP;
    float fLen  = length(fAxis);
    vec2  fDir  = fAxis / max(fLen, 0.001);

    float g1 = flareGhost(p, sunP + fDir * fLen * 0.22, 0.020);
    col += mix(vec3(1.0, 0.94, 0.80), vec3(1.0, 0.83, 0.76), sunriseMix * 0.9) * g1 * 0.06;
    a   += g1 * 0.04;

    float g2 = flareGhost(p, sunP + fDir * fLen * 0.44, 0.030);
    col += mix(vec3(0.70, 0.85, 1.0), vec3(1.0, 0.80, 0.84), sunriseMix * 0.88) * g2 * 0.05;
    a   += g2 * 0.035;

    float g3 = flareGhost(p, sunP + fDir * fLen * 0.58, 0.012);
    col += mix(vec3(0.88, 0.72, 1.0), vec3(1.0, 0.88, 0.78), sunriseMix * 0.72) * g3 * 0.06;
    a   += g3 * 0.04;

    float g4 = flareGhost(p, sunP + fDir * fLen * 0.74, 0.040);
    col += vec3(0.70, 1.0, 0.90) * g4 * 0.035;
    a   += g4 * 0.025;

    float g5 = flareGhost(p, sunP + fDir * fLen * 0.90, 0.016);
    col += vec3(1.0, 0.84, 0.60) * g5 * 0.05;
    a   += g5 * 0.035;

    float o1 = flareGhost(p, sunP + fDir * fLen * 0.64 + vec2(0.018, -0.010), 0.070);
    float o2 = flareGhost(p, sunP + fDir * fLen * 0.82 + vec2(-0.020, 0.014), 0.048);
    float o3 = flareGhost(p, sunP + fDir * fLen * 0.52 + vec2(-0.016, 0.006), 0.032);
    col += vec3(0.76, 0.86, 1.0) * o1 * 0.08;
    col += vec3(0.88, 0.82, 1.0) * o2 * 0.06;
    col += vec3(0.86, 0.94, 1.0) * o3 * 0.05;
    a   += o1 * 0.026 + o2 * 0.020 + o3 * 0.016;

    float circleR1 = exp(-pow((dist - 0.52) / 0.12, 2.0));
    float circleR2 = exp(-pow((dist - 0.34) / 0.09, 2.0));
    col += mix(vec3(0.80, 0.90, 1.0), vec3(1.0, 0.83, 0.78), sunriseMix * 0.78) * circleR1 * 0.05 * (0.65 + 0.35 * arcMask);
    col += mix(vec3(0.90, 0.94, 1.0), vec3(1.0, 0.92, 0.84), sunriseMix * 0.72) * circleR2 * 0.04 * (0.60 + 0.40 * arcMask);
    a   += circleR1 * 0.014 + circleR2 * 0.011;

    float shimmer = snoise(vec2(angle * 4.0 + uTime * 0.5,
                                dist  * 10.0 - uTime * 0.2));
    col += mix(uSunColor, vec3(1.0, 0.84, 0.76), sunriseMix * 0.6) * shimmer * 0.012 * exp(-dist * 3.5);

    col *= uIntensity;
    a   *= uIntensity;

    float lum = max(max(col.r, col.g), col.b);
    a = min(a, lum * 0.80 + 0.015);
    a = clamp(a, 0.0, 1.0);

    gl_FragColor = vec4(col, a);
  }
`;

function getParabolicSunPosition(progress: number, aspect: number): [number, number] {
  const clampedProgress = THREE.MathUtils.clamp(progress, 0, 1);
  const safeAspect = Math.max(aspect, 0.45);
  const horizontalPadding = Math.min(0.22, SUN_DISC_RADIUS / safeAspect + 0.04);
  const verticalPadding = SUN_DISC_RADIUS + 0.045;
  const startX = horizontalPadding;
  const endX = 1 - horizontalPadding;
  const horizonY = verticalPadding + 0.12;
  const apexY = 1 - verticalPadding - 0.045;
  const arcHeight = 1 - Math.pow(clampedProgress * 2 - 1, 2);

  return [
    THREE.MathUtils.lerp(startX, endX, clampedProgress),
    THREE.MathUtils.clamp(
      horizonY + (apexY - horizonY) * arcHeight,
      verticalPadding,
      1 - verticalPadding,
    ),
  ];
}

export interface SunEffectProps {
  sunPos?: [number, number];
  dayProgress?: number;
  sunColor?: THREE.Color;
  intensity?: number;
  zDepth?: number;
  planeSize?: [number, number];
  variant?: 'day' | 'sunrise' | 'sunset';
}

export default function SunEffect({
  sunPos = [0.5, 0.8],
  dayProgress,
  sunColor = new THREE.Color(1.0, 0.95, 0.8),
  intensity = 1.0,
  zDepth = -15,
  planeSize = [70, 40],
  variant = 'day',
}: SunEffectProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const { camera, size } = useThree();
  const viewportAspect = size.width / Math.max(size.height, 1);

  const effectiveSunPos = useMemo<[number, number]>(() => {
    if (typeof dayProgress === 'number') {
      return getParabolicSunPosition(dayProgress, viewportAspect);
    }

    return sunPos;
  }, [dayProgress, sunPos[0], sunPos[1], viewportAspect]);

  useLayoutEffect(() => {
    const mesh = meshRef.current;
    if (!mesh || !(camera instanceof THREE.PerspectiveCamera)) return;

    const distance = Math.abs(camera.position.z - zDepth);
    const vFov = (camera.fov * Math.PI) / 180;
    const frustumHeight = 2 * Math.tan(vFov / 2) * distance;
    const frustumWidth = frustumHeight * viewportAspect;

    const [pw, ph] = planeSize;
    const s = Math.max(frustumWidth / pw, frustumHeight / ph);
    mesh.scale.setScalar(s);
  }, [camera, viewportAspect, zDepth, planeSize[0], planeSize[1]]);

  const uniforms = useRef({
    uTime: { value: 0 },
    uSunPos: { value: new THREE.Vector2(effectiveSunPos[0], effectiveSunPos[1]) },
    uSunColor: { value: sunColor.clone() },
    uIntensity: { value: intensity },
    uAspect: { value: viewportAspect },
    uVariant: { value: 0 },
  }).current;

  useLayoutEffect(() => {
    uniforms.uSunPos.value.set(effectiveSunPos[0], effectiveSunPos[1]);
    uniforms.uSunColor.value.copy(sunColor);
    uniforms.uIntensity.value = intensity;
    uniforms.uAspect.value = viewportAspect;
    uniforms.uVariant.value = variant === 'sunrise' ? 1 : variant === 'sunset' ? 2 : 0;
  }, [effectiveSunPos[0], effectiveSunPos[1], intensity, sunColor, uniforms, variant, viewportAspect]);

  useFrame(({ clock }) => {
    uniforms.uTime.value = clock.elapsedTime;
  });

  return (
    <mesh ref={meshRef} position={[0, 0, zDepth]}>
      <planeGeometry args={[planeSize[0], planeSize[1], 1, 1]} />
      <shaderMaterial
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}
