'use client';

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// Fireworks shader: cinematic multi-shell launch, bloom, glitter, crackle, smoke.
// Intentionally long and explicit for visual richness and easier tuning.
const fragmentShader = /* glsl */ `
  precision highp float;

  uniform float uTime;
  uniform float uAspect;
  uniform float uBurstStart;
  uniform float uBurstId;
  uniform float uIntensity;

  varying vec2 vUv;

  const float PI = 3.14159265359;
  const float TAU = 6.28318530718;

  // ---------------------------------------------------------------------------
  // Hash / noise helpers
  // ---------------------------------------------------------------------------
  float hash11(float p) {
    p = fract(p * 0.1031);
    p *= p + 33.33;
    p *= p + p;
    return fract(p);
  }

  vec2 hash21(float p) {
    vec3 p3 = fract(vec3(p) * vec3(0.1031, 0.1030, 0.0973));
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.xx + p3.yz) * p3.zy);
  }

  vec2 hash22(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.xx + p3.yz) * p3.zy);
  }

  float noise2(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    float a = hash11(dot(i + vec2(0.0, 0.0), vec2(127.1, 311.7)));
    float b = hash11(dot(i + vec2(1.0, 0.0), vec2(127.1, 311.7)));
    float c = hash11(dot(i + vec2(0.0, 1.0), vec2(127.1, 311.7)));
    float d = hash11(dot(i + vec2(1.0, 1.0), vec2(127.1, 311.7)));
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
  }

  float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    mat2 m = mat2(1.8, 1.2, -1.2, 1.8);
    for (int i = 0; i < 5; i++) {
      v += a * noise2(p);
      p = m * p;
      a *= 0.5;
    }
    return v;
  }

  // ---------------------------------------------------------------------------
  // Color helpers
  // ---------------------------------------------------------------------------
  vec3 hsv2rgb(vec3 c) {
    vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
    vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
    return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
  }

  vec3 fireworksPalette(float t, float seed) {
    float hue = fract(t + seed * 0.17);
    float sat = mix(0.65, 0.95, hash11(seed * 3.7 + 1.9));
    float val = mix(0.82, 1.0, hash11(seed * 2.3 + 7.1));
    return hsv2rgb(vec3(hue, sat, val));
  }

  vec3 warmCoreColor(float seed) {
    vec3 c1 = vec3(1.0, 0.72, 0.35);
    vec3 c2 = vec3(1.0, 0.88, 0.62);
    vec3 c3 = vec3(0.95, 0.55, 0.30);
    float t = hash11(seed * 5.91 + 0.8);
    float t2 = hash11(seed * 2.21 + 4.2);
    return mix(mix(c1, c2, t), c3, t2 * 0.45);
  }

  // ---------------------------------------------------------------------------
  // Geometry helpers
  // ---------------------------------------------------------------------------
  mat2 rot2(float a) {
    float s = sin(a);
    float c = cos(a);
    return mat2(c, -s, s, c);
  }

  float sdSegment(vec2 p, vec2 a, vec2 b) {
    vec2 pa = p - a;
    vec2 ba = b - a;
    float h = clamp(dot(pa, ba) / max(dot(ba, ba), 0.0001), 0.0, 1.0);
    return length(pa - ba * h);
  }

  float softCircle(vec2 p, vec2 c, float r, float soft) {
    float d = length(p - c);
    return 1.0 - smoothstep(r, r + soft, d);
  }

  float starKernel(vec2 p, vec2 c, float radius, float spikes, float sharpness) {
    vec2 d = p - c;
    float r = length(d);
    float a = atan(d.y, d.x);
    float rays = pow(max(cos(a * spikes), 0.0), sharpness);
    float body = exp(-r * r / max(radius * radius, 0.000001));
    float flare = exp(-r * 22.0) * rays;
    return body + flare * 1.8;
  }

  // ---------------------------------------------------------------------------
  // Rocket launch
  // ---------------------------------------------------------------------------
  void addLaunch(
    vec2 p,
    float localTime,
    float riseDur,
    vec2 startPos,
    vec2 targetPos,
    float seed,
    inout vec3 col,
    inout float alpha
  ) {
    float riseT = clamp(localTime / max(riseDur, 0.001), 0.0, 1.0);
    vec2 trailHead = mix(startPos, targetPos, riseT);
    vec2 prevHead = mix(startPos, targetPos, max(riseT - 0.06, 0.0));

    float trailDist = sdSegment(p, prevHead, trailHead);
    float trail = exp(-trailDist * 95.0) * (1.0 - smoothstep(0.0, 1.0, riseT));

    vec3 trailCol = mix(vec3(1.0, 0.75, 0.35), vec3(1.0, 0.98, 0.85), riseT);
    col += trailCol * trail * 0.55;
    alpha += trail * 0.12;

    float head = starKernel(p, trailHead, 0.012, 5.0 + hash11(seed) * 3.0, 22.0);
    col += warmCoreColor(seed) * head * 0.32;
    alpha += head * 0.12;
  }

  // ---------------------------------------------------------------------------
  // Burst style 1: peony shell
  // ---------------------------------------------------------------------------
  void addPeonyBurst(
    vec2 p,
    vec2 center,
    float age,
    float life,
    float seed,
    inout vec3 col,
    inout float alpha
  ) {
    float t = clamp(age / max(life, 0.001), 0.0, 1.0);
    float radius = mix(0.03, 0.42, t);
    float shellFade = exp(-t * 2.8);

    vec2 d = p - center;
    float r = length(d);
    float a = atan(d.y, d.x);

    float rays = 24.0 + floor(hash11(seed * 1.3 + 2.1) * 18.0);
    float spoke = pow(max(cos(a * rays + seed * 3.0), 0.0), 10.0 + hash11(seed * 2.2) * 10.0);
    float ring = exp(-pow((r - radius) / (0.018 + t * 0.06), 2.0));
    float crown = ring * (0.55 + 0.45 * spoke);

    float hueShift = hash11(seed * 8.2 + 5.0);
    vec3 baseCol = fireworksPalette(hueShift + t * 0.12, seed);
    vec3 edgeCol = fireworksPalette(hueShift + 0.08 + t * 0.3, seed + 9.0);
    vec3 shellCol = mix(baseCol, edgeCol, smoothstep(0.1, 0.95, t));

    col += shellCol * crown * shellFade * 0.95;
    alpha += crown * shellFade * 0.08;

    // Glitter particles for rich texture
    for (int i = 0; i < 18; i++) {
      float fi = float(i);
      float aSeed = seed * 13.0 + fi * 7.1;
      float ang = TAU * (fi / 18.0 + hash11(aSeed) * 0.03);
      float speed = mix(0.10, 0.42, hash11(aSeed + 2.3));
      float drift = mix(-0.05, 0.05, hash11(aSeed + 9.2));
      vec2 dir = vec2(cos(ang), sin(ang));
      vec2 sparkPos = center + dir * speed * t + vec2(drift * t * t, -0.06 * t * t);
      float spark = starKernel(p, sparkPos, 0.008 + (1.0 - t) * 0.01, 4.0, 18.0);
      vec3 sCol = mix(shellCol, vec3(1.0, 0.95, 0.85), 0.35 + 0.35 * hash11(aSeed + 5.7));
      col += sCol * spark * 0.06 * shellFade;
      alpha += spark * 0.008 * shellFade;
    }
  }

  // ---------------------------------------------------------------------------
  // Burst style 2: chrysanthemum shell
  // ---------------------------------------------------------------------------
  void addChrysanthemumBurst(
    vec2 p,
    vec2 center,
    float age,
    float life,
    float seed,
    inout vec3 col,
    inout float alpha
  ) {
    float t = clamp(age / max(life, 0.001), 0.0, 1.0);
    float fade = exp(-t * 2.2);
    vec2 d = p - center;
    float r = length(d);
    float a = atan(d.y, d.x);

    float radiusMain = mix(0.02, 0.33, t);
    float radiusSub = mix(0.00, 0.20, t);
    float thickMain = 0.012 + t * 0.05;
    float thickSub = 0.020 + t * 0.04;

    float ringMain = exp(-pow((r - radiusMain) / thickMain, 2.0));
    float ringSub = exp(-pow((r - radiusSub) / thickSub, 2.0));

    float spokesA = 0.5 + 0.5 * pow(max(cos(a * (18.0 + hash11(seed * 2.0) * 10.0) + seed * 4.4), 0.0), 8.0);
    float spokesB = 0.5 + 0.5 * pow(max(cos(a * (9.0 + hash11(seed * 0.7) * 6.0) - seed * 2.7), 0.0), 6.0);
    float burst = ringMain * spokesA + ringSub * spokesB * 0.8;

    float hue = hash11(seed * 0.91 + 8.0);
    vec3 colA = fireworksPalette(hue + 0.04, seed);
    vec3 colB = fireworksPalette(hue + 0.18, seed + 1.3);
    vec3 shellCol = mix(colA, colB, smoothstep(0.0, 1.0, t));

    col += shellCol * burst * 0.75 * fade;
    alpha += burst * 0.06 * fade;

    float embers = exp(-pow((r - (radiusMain * 1.1)) / (0.08 + t * 0.06), 2.0));
    float twinkle = smoothstep(0.45, 0.95, fbm(d * 38.0 + vec2(uTime * 6.0, -uTime * 5.0) + seed));
    col += vec3(1.0, 0.78, 0.55) * embers * twinkle * 0.22 * fade;
    alpha += embers * twinkle * 0.02 * fade;
  }

  // ---------------------------------------------------------------------------
  // Burst style 3: willow shell
  // ---------------------------------------------------------------------------
  void addWillowBurst(
    vec2 p,
    vec2 center,
    float age,
    float life,
    float seed,
    inout vec3 col,
    inout float alpha
  ) {
    float t = clamp(age / max(life, 0.001), 0.0, 1.0);
    float fade = exp(-t * 1.7);
    vec3 gold = mix(vec3(1.0, 0.78, 0.35), vec3(1.0, 0.92, 0.68), hash11(seed * 3.4));

    for (int i = 0; i < 20; i++) {
      float fi = float(i);
      float aSeed = seed * 11.1 + fi * 0.91;
      float ang = TAU * (fi / 20.0 + hash11(aSeed) * 0.04);
      float speed = mix(0.08, 0.24, hash11(aSeed + 7.0));
      float drag = mix(0.70, 0.95, hash11(aSeed + 3.0));
      float trailT = pow(t, drag);
      vec2 dir = vec2(cos(ang), sin(ang) * 0.82);
      vec2 pos = center + dir * speed * trailT + vec2(0.0, -0.28 * trailT * trailT);

      float w = 0.010 + (1.0 - t) * 0.012;
      float spark = exp(-pow(length(p - pos) / w, 2.0));
      float tail = exp(-sdSegment(p, center + dir * speed * max(trailT - 0.08, 0.0), pos) * 48.0) * 0.6;
      float glitter = smoothstep(0.76, 0.99, noise2((p - pos) * 120.0 + vec2(uTime * 16.0, -uTime * 11.0) + fi));

      col += gold * (spark + tail * 0.7) * (0.10 + glitter * 0.08) * fade;
      alpha += (spark * 0.016 + tail * 0.006) * fade;
    }
  }

  // ---------------------------------------------------------------------------
  // Crackle and smoke
  // ---------------------------------------------------------------------------
  void addCrackle(
    vec2 p,
    vec2 center,
    float age,
    float life,
    float seed,
    inout vec3 col,
    inout float alpha
  ) {
    float t = clamp(age / max(life, 0.001), 0.0, 1.0);
    float fade = exp(-t * 3.5);

    for (int i = 0; i < 14; i++) {
      float fi = float(i);
      float s = seed * 17.0 + fi * 2.1;
      vec2 rand = hash21(s) * 2.0 - 1.0;
      vec2 pos = center + rand * (0.08 + t * 0.34);
      float spark = starKernel(p, pos, 0.004 + (1.0 - t) * 0.01, 5.0, 24.0);
      float blink = step(0.62, fract(uTime * (8.0 + hash11(s) * 16.0) + fi * 0.13));
      vec3 crackCol = mix(vec3(1.0, 0.92, 0.75), vec3(1.0, 0.65, 0.35), hash11(s + 9.0));
      col += crackCol * spark * 0.09 * blink * fade;
      alpha += spark * 0.011 * blink * fade;
    }

    vec2 d = p - center;
    float smokeR = length(d);
    float smokeBody = exp(-pow(smokeR / (0.16 + t * 0.36), 2.0));
    float smokeNoise = fbm(d * 4.0 + vec2(seed * 0.5, -seed * 0.8) + vec2(0.0, t * 1.8));
    float smoke = smokeBody * smoothstep(0.35, 0.85, smokeNoise) * (1.0 - smoothstep(0.45, 1.0, t));
    col += vec3(0.45, 0.50, 0.60) * smoke * 0.16;
    alpha += smoke * 0.02;
  }

  // ---------------------------------------------------------------------------
  // Single shell renderer
  // ---------------------------------------------------------------------------
  void renderShell(
    int idx,
    vec2 p,
    float showTime,
    inout vec3 col,
    inout float alpha
  ) {
    float fi = float(idx);
    float seed = uBurstId * 13.7 + fi * 7.73;

    float delay = fi * 0.82 + hash11(seed + 0.9) * 0.30;
    float localT = showTime - delay;
    if (localT < 0.0) return;

    vec2 shellRand = hash21(seed + 4.2);
    float startX = mix(-0.78, 0.78, shellRand.x);
    float targetX = startX * 0.28 + mix(-0.32, 0.32, hash11(seed + 2.2));
    float targetY = mix(0.25, 0.78, shellRand.y);
    vec2 startPos = vec2(startX, -1.18);
    vec2 targetPos = vec2(targetX, targetY);

    float riseDur = mix(1.0, 1.8, hash11(seed + 1.1));
    if (localT < riseDur) {
      addLaunch(p, localT, riseDur, startPos, targetPos, seed, col, alpha);
      return;
    }

    float age = localT - riseDur;
    float life = mix(2.6, 4.0, hash11(seed + 8.8));
    if (age > life) return;

    float stylePick = hash11(seed + 6.4);
    if (stylePick < 0.38) {
      addPeonyBurst(p, targetPos, age, life, seed, col, alpha);
    } else if (stylePick < 0.73) {
      addChrysanthemumBurst(p, targetPos, age, life, seed, col, alpha);
    } else {
      addWillowBurst(p, targetPos, age, life, seed, col, alpha);
    }

    addCrackle(p, targetPos, age, life, seed + 10.0, col, alpha);
  }

  // ---------------------------------------------------------------------------
  // Global post sparkle and sky glow
  // ---------------------------------------------------------------------------
  void addGlobalAtmosphere(vec2 p, float showTime, inout vec3 col, inout float alpha) {
    float horizon = smoothstep(-1.0, -0.2, p.y);
    float hazeNoise = fbm(p * vec2(2.2, 1.3) + vec2(showTime * 0.04, -showTime * 0.02));
    float haze = horizon * smoothstep(0.40, 0.88, hazeNoise);
    col += vec3(0.12, 0.18, 0.28) * haze * 0.18;
    alpha += haze * 0.015;

    float glitterMask = smoothstep(0.0, 0.85, showTime) * (1.0 - smoothstep(12.0, 18.0, showTime));
    float g = noise2(p * 180.0 + vec2(showTime * 6.0, -showTime * 5.0));
    float g2 = noise2(p * 220.0 + vec2(-showTime * 8.0, showTime * 7.0));
    float glitter = smoothstep(0.94, 1.0, g * g2) * glitterMask;
    col += vec3(1.0, 0.96, 0.9) * glitter * 0.26;
    alpha += glitter * 0.04;
  }

  // ---------------------------------------------------------------------------
  // Main
  // ---------------------------------------------------------------------------
  void main() {
    vec2 uv = vUv;
    vec2 p = vec2((uv.x * 2.0 - 1.0) * uAspect, uv.y * 2.0 - 1.0);

    float showTime = uTime - uBurstStart;
    if (showTime < 0.0) {
      gl_FragColor = vec4(0.0);
      return;
    }

    float globalFadeIn = smoothstep(0.0, 0.35, showTime);
    float globalFadeOut = 1.0 - smoothstep(16.0, 19.0, showTime);
    float globalFade = globalFadeIn * globalFadeOut;
    if (globalFade <= 0.0001) {
      gl_FragColor = vec4(0.0);
      return;
    }

    vec3 col = vec3(0.0);
    float alpha = 0.0;

    // Major shells
    for (int i = 0; i < 8; i++) {
      renderShell(i, p, showTime, col, alpha);
    }

    // Atmosphere and micro sparkles
    addGlobalAtmosphere(p, showTime, col, alpha);

    // Vignette attenuation so center remains focal
    float vig = 1.0 - smoothstep(1.05, 1.75, length(p * vec2(0.85, 1.0)));
    col *= (0.72 + 0.28 * vig);
    alpha *= (0.76 + 0.24 * vig);

    // Intensity and alpha safety
    col *= uIntensity * globalFade;
    alpha *= uIntensity * globalFade;

    float lum = max(max(col.r, col.g), col.b);
    alpha = min(alpha, lum * 0.92 + 0.03);
    alpha = clamp(alpha, 0.0, 1.0);

    gl_FragColor = vec4(col, alpha);
  }
`;

export interface FireworksEffectProps {
  trigger?: number;
  intensity?: number;
  zDepth?: number;
  planeSize?: [number, number];
  renderOrder?: number;
}

export default function FireworksEffect({
  trigger = 0,
  intensity = 1.0,
  zDepth = 0,
  planeSize = [70, 40],
  renderOrder = 9999,
}: FireworksEffectProps) {
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const elapsedRef = useRef(0);
  const lastTriggerRef = useRef(trigger);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uAspect: { value: planeSize[0] / planeSize[1] },
      uBurstStart: { value: 99999 },
      uBurstId: { value: 0 },
      uIntensity: { value: intensity },
    }),
    [intensity, planeSize],
  );

  useFrame(({ clock }) => {
    if (!matRef.current) return;
    const t = clock.elapsedTime;
    elapsedRef.current = t;
    const u = matRef.current.uniforms;
    u.uTime.value = t;

    // Apply trigger in the same frame as clock so uBurstStart is exactly in sync
    if (trigger > 0 && lastTriggerRef.current !== trigger) {
      lastTriggerRef.current = trigger;
      u.uBurstStart.value = t;
      u.uBurstId.value = trigger;
    }
  });

  return (
    <mesh position={[0, 0, zDepth]} renderOrder={renderOrder}>
      <planeGeometry args={[planeSize[0], planeSize[1], 1, 1]} />
      <shaderMaterial
        ref={matRef}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        depthTest={false}
        blending={THREE.AdditiveBlending}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}
