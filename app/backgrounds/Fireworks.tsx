'use client';

/**
 * 烟花特效（在「星空夜晚」背景启用：晴天夜、多云夜等共用了星空/Moon 的场景）
 *
 * 触发方式：在任意位置 dispatch 一个 CustomEvent。
 *   window.dispatchEvent(new CustomEvent('weather:fireworks-start'))
 *
 * 组件内部会调度一场约 7 秒的烟花秀：
 *   1) 升空（Rocket）：~0.7s 的明亮拖尾从屏幕下方边界外升起
 *   2) 起爆瞬间（FlashCore）：核心位置一道极亮的光晕闪现 ~0.3s
 *   3) 爆炸（Burst）：双色粒子向四周飞散，受重力和阻力，频闪闪烁
 *
 * 性能要点：
 *   - 每束烟花仅 1 个核心闪光 + 1 个粒子 Points（GPU 上算粒子位移）
 *   - 不再使用的烟花会及时 dispose 几何体与材质
 *   - 与现有 NightScene 共用一个 Canvas，不会额外开销
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const ROCKET_DURATION_S = 0.7;
const BURST_LIFETIME_S = 2.6;
const FLASH_DURATION_S = 0.45;
const ROCKET_TRAIL_POINTS = 22;

/**
 * 烟花调色板：每束烟花有"主色"与"副色"，副色会与主色按粒子种子做平滑过渡，
 * 让单束烟花同时呈现两种相近或对比的颜色，更接近真实烟花的层次感。
 */
type ColorTriplet = readonly [number, number, number];
type ColorPair = readonly [ColorTriplet, ColorTriplet];

/**
 * 高饱和度调色板：所有颜色刻意远离灰白，单束烟花呈现"主色 → 副色"的两色层次。
 * 配色覆盖暖色、冷色、互补色、霓虹色与节庆色，让连续烟花随机起来更有变化；
 * 同时避免 (R,G,B) 三通道同时过高，让 additive blending 后依然鲜艳。
 */
const FIREWORK_PALETTE: ReadonlyArray<ColorPair> = [
  // 朱红 → 鎏金
  [[1.00, 0.18, 0.18], [1.00, 0.72, 0.10]],
  // 金黄 → 烈橙
  [[1.00, 0.82, 0.10], [1.00, 0.42, 0.05]],
  // 翠绿 → 柠黄
  [[0.18, 1.00, 0.32], [0.95, 1.00, 0.10]],
  // 翡翠 → 薄荷
  [[0.05, 0.92, 0.45], [0.45, 1.00, 0.85]],
  // 海蓝 → 钴紫
  [[0.10, 0.45, 1.00], [0.55, 0.20, 1.00]],
  // 青绿 → 天蓝
  [[0.10, 0.95, 1.00], [0.20, 0.55, 1.00]],
  // 樱粉 → 紫罗兰
  [[1.00, 0.30, 0.85], [0.55, 0.20, 1.00]],
  // 玫红 → 金黄
  [[1.00, 0.18, 0.55], [1.00, 0.85, 0.18]],
  // 紫红 → 蓝青
  [[0.92, 0.10, 0.85], [0.10, 0.85, 1.00]],
  // 烈橙 → 朱红
  [[1.00, 0.50, 0.05], [1.00, 0.10, 0.10]],
  // 紫罗兰 → 桃粉
  [[0.62, 0.18, 1.00], [1.00, 0.40, 0.65]],
  // 钴蓝 → 翡翠
  [[0.20, 0.30, 1.00], [0.05, 0.95, 0.55]],
  // 电光蓝 → 霓虹粉
  [[0.05, 0.35, 1.00], [1.00, 0.12, 0.75]],
  // 激光绿 → 电紫
  [[0.10, 1.00, 0.18], [0.78, 0.12, 1.00]],
  // 琥珀 → 宝石红
  [[1.00, 0.58, 0.04], [0.95, 0.04, 0.18]],
  // 日落橙 → 洋红
  [[1.00, 0.34, 0.04], [1.00, 0.08, 0.55]],
  // 孔雀蓝 → 翡翠绿
  [[0.02, 0.68, 1.00], [0.02, 0.95, 0.42]],
  // 冰蓝 → 淡紫
  [[0.20, 0.85, 1.00], [0.70, 0.36, 1.00]],
  // 苹果绿 → 热粉
  [[0.45, 1.00, 0.08], [1.00, 0.10, 0.60]],
  // 皇家紫 → 金橙
  [[0.42, 0.08, 1.00], [1.00, 0.62, 0.08]],
  // 青柠 → 青蓝
  [[0.78, 1.00, 0.06], [0.05, 0.80, 1.00]],
  // 珊瑚红 → 薰衣草
  [[1.00, 0.26, 0.22], [0.72, 0.42, 1.00]],
  // 蓝紫 → 极光绿
  [[0.28, 0.10, 1.00], [0.10, 1.00, 0.62]],
  // 暖金 → 孔雀绿
  [[1.00, 0.76, 0.08], [0.00, 0.85, 0.58]],
  // 烈焰红 → 电光蓝
  [[1.00, 0.08, 0.06], [0.05, 0.48, 1.00]],
  // 玫瑰粉 → 青柠绿
  [[1.00, 0.22, 0.72], [0.58, 1.00, 0.06]],
  // 紫电 → 荧光青
  [[0.82, 0.08, 1.00], [0.05, 1.00, 0.95]],
  // 香槟金 → 樱桃红
  [[1.00, 0.88, 0.22], [1.00, 0.04, 0.26]],
  // 极光青 → 极光紫
  [[0.00, 0.95, 0.78], [0.58, 0.18, 1.00]],
  // 宝石蓝 → 火焰橙
  [[0.08, 0.22, 1.00], [1.00, 0.44, 0.04]],
  // 松石绿 → 桃红
  [[0.00, 0.78, 0.70], [1.00, 0.24, 0.46]],
  // 深紫 → 酸性黄
  [[0.55, 0.05, 1.00], [0.92, 1.00, 0.05]],
  // 湖蓝 → 烟火红
  [[0.05, 0.62, 1.00], [1.00, 0.14, 0.10]],
  // 薄荷绿 → 玫瑰紫
  [[0.30, 1.00, 0.70], [0.92, 0.14, 0.92]],
  // 橘金 → 天青
  [[1.00, 0.54, 0.02], [0.05, 0.72, 1.00]],
  // 祖母绿 → 紫红
  [[0.00, 0.90, 0.36], [0.98, 0.08, 0.78]],
];

const BURST_PATTERNS = ['sphere', 'ring', 'willow'] as const;
type BurstPattern = (typeof BURST_PATTERNS)[number];

interface FireworkSpec {
  id: number;
  rocketStartMs: number;
  burstStartMs: number;
  origin: readonly [number, number, number]; // 爆炸点
  launchY: number; // 升空起点 Y（屏幕下方边界以下）
  colorA: ColorTriplet;
  colorB: ColorTriplet;
  pattern: BurstPattern;
  spread: number;
  particles: number;
  /** 该束烟花是否为"压轴"——闪光更强、粒子更多 */
  finale?: boolean;
}

// ---------------------------------------------------------------------------
// 着色器：升空拖尾
// ---------------------------------------------------------------------------
const rocketVertexShader = /* glsl */ `
  attribute float aOffset;
  uniform float uTime;
  uniform float uDuration;
  uniform float uPixelRatio;
  uniform vec3 uStart;
  uniform vec3 uEnd;
  varying float vAlpha;
  varying float vHead;

  void main() {
    float t = clamp(uTime / uDuration, 0.0, 1.0);
    // aOffset 0..1 表示拖尾上每个点距离头部的相位偏移
    float phase = clamp(t - aOffset * 0.18, 0.0, 1.0);
    // ease-out 让升空有"先快后慢"的感觉
    float ease = 1.0 - pow(1.0 - phase, 2.2);
    vec3 pos = mix(uStart, uEnd, ease);
    // 轻微飘动 + 拖尾内随机抖动
    pos.x += sin((uTime + aOffset) * 9.0) * 0.05;
    pos.x += sin(aOffset * 31.7 + uTime * 14.0) * 0.03;
    pos.y += sin(aOffset * 17.3) * 0.015;

    float head = 1.0 - aOffset;
    vHead = head;
    float lifeFade = 1.0 - smoothstep(0.88, 1.0, t);
    // 拖尾尾端再弱一点，凸显头部
    vAlpha = pow(head, 0.85) * lifeFade;

    vec4 mvPos = modelViewMatrix * vec4(pos, 1.0);
    // 火引整体偏小：尾部仅是细微闪烁的星屑，头部也只是一颗小星点
    float sizeFactor = 1.1 + pow(head, 1.7) * 5.6;
    gl_PointSize = sizeFactor * (32.0 / -mvPos.z) * uPixelRatio;
    gl_Position = projectionMatrix * mvPos;
  }
`;

const rocketFragmentShader = /* glsl */ `
  uniform vec3 uColor;
  varying float vAlpha;
  varying float vHead;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c);
    if (d > 0.5) discard;
    float core = 1.0 - smoothstep(0.0, 0.5, d);
    // 头部偏白炽，尾部带饱和原色
    float whiteness = pow(core, 1.6) * (0.45 + vHead * 0.45);
    vec3 col = mix(uColor, vec3(1.0), whiteness);
    float intensity = core * vAlpha * (0.85 + vHead * 0.35);
    gl_FragColor = vec4(col * (1.0 + vHead * 0.4), intensity);
  }
`;

// ---------------------------------------------------------------------------
// 着色器：爆炸 + 余烬
// ---------------------------------------------------------------------------
const burstVertexShader = /* glsl */ `
  attribute vec3 aVelocity;
  attribute float aSeed;
  attribute float aSize;
  uniform float uTime;
  uniform float uLifetime;
  uniform float uPixelRatio;
  varying float vAlpha;
  varying float vSparkle;
  varying float vSeed;
  varying float vLife;

  void main() {
    float t = max(uTime, 0.0);
    // 阻力衰减位移：v * (1 - e^{-k t}) / k  —— 让粒子初期飞得快、末期慢
    // 降低 k 让粒子飞得更远，爆炸范围更大
    float k = 1.05;
    vec3 motion = aVelocity * (1.0 - exp(-k * t)) / k;
    // 重力（柳型烟花会下垂）
    vec3 gravity = vec3(0.0, -1.55 * t * t, 0.0);
    // 微弱湍流，让粒子轨迹不那么"完美"，更像真实烟花
    vec3 turb = vec3(
      sin(t * 4.0 + aSeed * 6.28) * 0.05,
      cos(t * 3.2 + aSeed * 5.13) * 0.04,
      sin(t * 3.6 + aSeed * 4.7) * 0.05
    ) * t;
    vec3 pos = position + motion + gravity + turb;

    float life = clamp(t / uLifetime, 0.0, 1.0);
    vLife = life;
    vSeed = aSeed;

    // 起爆瞬间最亮（更强的初闪），然后 power 曲线缓慢衰减
    float flash = exp(-life * 11.0) * 1.1;
    float fade = pow(1.0 - life, 1.55);
    vAlpha = clamp(fade + flash, 0.0, 1.0);

    // 粒子大小：起爆时显著放大，末期收敛为微小的星点
    float sizeFactor = aSize * mix(1.7, 0.42, life);
    // 闪光初期再加一点核外亮圈
    sizeFactor += 1.6 * exp(-life * 14.0);

    // 频闪（让粒子像花火一样闪烁），后期更密集、更明显
    float baseSparkle = 0.62 + 0.42 * sin(t * (24.0 + aSeed * 18.0) + aSeed * 6.28);
    float lateTwinkle = smoothstep(0.4, 1.0, life)
      * (0.5 + 0.5 * sin(t * 60.0 + aSeed * 41.0));
    vSparkle = clamp(baseSparkle + lateTwinkle * 0.45, 0.0, 1.4);

    vec4 mvPos = modelViewMatrix * vec4(pos, 1.0);
    gl_PointSize = sizeFactor * (78.0 / -mvPos.z) * uPixelRatio;
    gl_Position = projectionMatrix * mvPos;
  }
`;

const burstFragmentShader = /* glsl */ `
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  varying float vAlpha;
  varying float vSparkle;
  varying float vSeed;
  varying float vLife;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c);
    if (d > 0.5) discard;
    // 硬核（亮中心）+ 柔和外晕
    float core = 1.0 - smoothstep(0.0, 0.5, d);
    float halo = pow(1.0 - smoothstep(0.0, 0.5, d), 2.0);
    float bright = pow(core, 2.4);

    // 双色混合：以粒子种子做主轴，再随生命周期略微偏移，
    // 让单束烟花呈现两种颜色的层次。
    float mixK = smoothstep(0.2, 0.8, vSeed);
    mixK = clamp(mixK + (vLife - 0.5) * 0.3, 0.0, 1.0);
    vec3 baseColor = mix(uColorA, uColorB, mixK);

    // 提高饱和度：把基色往"远离灰"的方向轻推
    float gray = (baseColor.r + baseColor.g + baseColor.b) / 3.0;
    baseColor = mix(vec3(gray), baseColor, 1.18);
    baseColor = clamp(baseColor, 0.0, 1.0);

    // 仅在粒子最中心一小块给到白炽，避免大面积"白化"洗掉颜色
    float whiteShift = pow(core, 4.0) * (0.55 + (1.0 - vLife) * 0.35);
    vec3 col = mix(baseColor, vec3(1.0), whiteShift);

    // HDR 风格：起爆早期把亮度往上推一些；通过乘法保留色相，
    // 让饱和的色彩在 additive blending 下也保持鲜艳。
    float hdr = 1.0 + exp(-vLife * 8.0) * 1.9
              + smoothstep(0.0, 0.15, vLife) * 0.0; // 仅作为占位，可拓展
    col *= hdr;

    float alpha = (core * 0.85 + halo * 0.15) * vAlpha * vSparkle;
    gl_FragColor = vec4(col, alpha);
  }
`;

// ---------------------------------------------------------------------------
// 着色器：起爆核心闪光（FlashCore）
// ---------------------------------------------------------------------------
const flashVertexShader = /* glsl */ `
  uniform float uTime;
  uniform float uLifetime;
  uniform float uPixelRatio;
  uniform float uIntensity;
  varying float vAlpha;
  varying float vLife;

  void main() {
    float t = max(uTime, 0.0);
    float life = clamp(t / uLifetime, 0.0, 1.0);
    vLife = life;
    // 极亮的初闪，0.45s 内快速衰减
    vAlpha = exp(-life * 7.5);

    // 起爆瞬间巨大，0.1s 后快速收缩
    float size = (28.0 + 14.0 * exp(-life * 18.0)) * uIntensity;

    vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = size * (88.0 / -mvPos.z) * uPixelRatio;
    gl_Position = projectionMatrix * mvPos;
  }
`;

const flashFragmentShader = /* glsl */ `
  uniform vec3 uColor;
  varying float vAlpha;
  varying float vLife;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c);
    if (d > 0.5) discard;
    // 三层叠加：极亮内核（白）+ 中间冲光（白偏色）+ 外晕（原色）
    float core   = 1.0 - smoothstep(0.0, 0.18, d);
    float middle = 1.0 - smoothstep(0.10, 0.40, d);
    float halo   = 1.0 - smoothstep(0.20, 0.50, d);
    vec3 col = vec3(1.0) * core
             + mix(uColor, vec3(1.0), 0.65) * middle * 0.55
             + uColor * halo * 0.35;
    float alpha = (core + middle * 0.6 + halo * 0.4) * vAlpha;
    gl_FragColor = vec4(col, alpha);
  }
`;

// ---------------------------------------------------------------------------
// Rocket：升空拖尾
// ---------------------------------------------------------------------------
function Rocket({ spec }: { spec: FireworkSpec }) {
  const geometry = useMemo(() => {
    const positions = new Float32Array(ROCKET_TRAIL_POINTS * 3);
    const offsets = new Float32Array(ROCKET_TRAIL_POINTS);
    for (let i = 0; i < ROCKET_TRAIL_POINTS; i++) {
      offsets[i] = i / ROCKET_TRAIL_POINTS;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('aOffset', new THREE.BufferAttribute(offsets, 1));
    return geo;
  }, []);

  const material = useMemo(() => {
    // 火引采用偏白偏暖的颜色，统一感更强（与具体烟花主色弱关联）
    const trailColor = new THREE.Color(
      Math.min(1, spec.colorA[0] * 0.6 + 0.5),
      Math.min(1, spec.colorA[1] * 0.6 + 0.55),
      Math.min(1, spec.colorA[2] * 0.6 + 0.45),
    );
    return new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uDuration: { value: ROCKET_DURATION_S },
        uPixelRatio: { value: 1 },
        uStart: { value: new THREE.Vector3(spec.origin[0], spec.launchY, spec.origin[2]) },
        uEnd: { value: new THREE.Vector3(spec.origin[0], spec.origin[1], spec.origin[2]) },
        uColor: { value: trailColor },
      },
      vertexShader: rocketVertexShader,
      fragmentShader: rocketFragmentShader,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
  }, [spec]);

  useEffect(() => {
    return () => {
      geometry.dispose();
      material.dispose();
    };
  }, [geometry, material]);

  useFrame(({ gl }) => {
    const elapsed = (performance.now() - spec.rocketStartMs) / 1000;
    if (elapsed < 0) return;
    material.uniforms.uTime.value = elapsed;
    material.uniforms.uPixelRatio.value = gl.getPixelRatio();
  });

  return <points geometry={geometry} material={material} frustumCulled={false} />;
}

// ---------------------------------------------------------------------------
// Burst：爆炸 + 余烬
// ---------------------------------------------------------------------------
function Burst({ spec }: { spec: FireworkSpec }) {
  const geometry = useMemo(() => {
    const n = spec.particles;
    const positions = new Float32Array(n * 3);
    const velocities = new Float32Array(n * 3);
    const seeds = new Float32Array(n);
    const sizes = new Float32Array(n);

    for (let i = 0; i < n; i++) {
      positions[i * 3] = spec.origin[0];
      positions[i * 3 + 1] = spec.origin[1];
      positions[i * 3 + 2] = spec.origin[2];

      let vx = 0;
      let vy = 0;
      let vz = 0;

      if (spec.pattern === 'ring') {
        // 环形花
        const a = Math.random() * Math.PI * 2;
        const r = spec.spread * (0.85 + Math.random() * 0.25);
        const tilt = (Math.random() - 0.5) * 0.4;
        vx = Math.cos(a) * r;
        vy = Math.sin(a) * r * (1.0 - Math.abs(tilt));
        vz = tilt * r * 0.6;
      } else if (spec.pattern === 'willow') {
        // 柳型：先向上向外散开，靠重力拉出"垂柳"形态
        const a = Math.random() * Math.PI * 2;
        const r = spec.spread * (0.55 + Math.random() * 0.55);
        vx = Math.cos(a) * r;
        vy = Math.abs(Math.sin(a)) * r * 0.8 + 0.6 + Math.random() * 0.4;
        vz = (Math.random() - 0.5) * r * 0.6;
      } else {
        // 球形（菊花）
        const u = Math.random() * 2 - 1;
        const t = Math.random() * Math.PI * 2;
        const w = Math.sqrt(Math.max(0, 1 - u * u));
        const r = spec.spread * (0.7 + Math.random() * 0.55);
        vx = w * Math.cos(t) * r;
        vy = w * Math.sin(t) * r;
        vz = u * r * 0.6; // Z 方向略压扁，让画面感更强
      }

      velocities[i * 3] = vx;
      velocities[i * 3 + 1] = vy;
      velocities[i * 3 + 2] = vz;
      seeds[i] = Math.random();
      // 更大的粒子尺寸范围，整体更醒目；少量"亮星"明显大一截
      const isBigStar = Math.random() < 0.18;
      sizes[i] = isBigStar
        ? 2.4 + Math.random() * 1.6
        : 1.6 + Math.random() * 1.7;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('aVelocity', new THREE.BufferAttribute(velocities, 3));
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));
    geo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
    return geo;
  }, [spec]);

  const material = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: -1 },
        uLifetime: { value: BURST_LIFETIME_S },
        uPixelRatio: { value: 1 },
        uColorA: {
          value: new THREE.Color(spec.colorA[0], spec.colorA[1], spec.colorA[2]),
        },
        uColorB: {
          value: new THREE.Color(spec.colorB[0], spec.colorB[1], spec.colorB[2]),
        },
      },
      vertexShader: burstVertexShader,
      fragmentShader: burstFragmentShader,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
  }, [spec]);

  useEffect(() => {
    return () => {
      geometry.dispose();
      material.dispose();
    };
  }, [geometry, material]);

  useFrame(({ gl }) => {
    const elapsed = (performance.now() - spec.burstStartMs) / 1000;
    material.uniforms.uTime.value = elapsed;
    material.uniforms.uPixelRatio.value = gl.getPixelRatio();
  });

  return <points geometry={geometry} material={material} frustumCulled={false} />;
}

// ---------------------------------------------------------------------------
// FlashCore：起爆瞬间的核心强光（约 0.45s）
// ---------------------------------------------------------------------------
function FlashCore({ spec }: { spec: FireworkSpec }) {
  const geometry = useMemo(() => {
    const positions = new Float32Array([
      spec.origin[0],
      spec.origin[1],
      spec.origin[2],
    ]);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    return geo;
  }, [spec.origin]);

  const material = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: -1 },
        uLifetime: { value: FLASH_DURATION_S },
        uPixelRatio: { value: 1 },
        uIntensity: { value: spec.finale ? 1.55 : 1.0 },
        uColor: {
          value: new THREE.Color(spec.colorA[0], spec.colorA[1], spec.colorA[2]),
        },
      },
      vertexShader: flashVertexShader,
      fragmentShader: flashFragmentShader,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
  }, [spec]);

  useEffect(() => {
    return () => {
      geometry.dispose();
      material.dispose();
    };
  }, [geometry, material]);

  useFrame(({ gl }) => {
    const elapsed = (performance.now() - spec.burstStartMs) / 1000;
    material.uniforms.uTime.value = elapsed;
    material.uniforms.uPixelRatio.value = gl.getPixelRatio();
  });

  return <points geometry={geometry} material={material} frustumCulled={false} />;
}

// ---------------------------------------------------------------------------
// Fireworks：监听全局事件，调度一场约 7 秒的烟花秀
// ---------------------------------------------------------------------------
export const FIREWORKS_START_EVENT = 'weather:fireworks-start';

interface ActiveFirework extends FireworkSpec {
  removeAtMs: number;
  rocketEndsAtMs: number;
}

/**
 * 屏幕底部以下的发射点。相机在 z=10、FOV=75（垂直），
 * 在 z = -6 ~ -12 的爆炸点对应的屏幕底部约为 y ≈ -11 ~ -16，
 * 因此 launchY 取 -17 ~ -21.5，能确保火引"从屏幕底部下方升起"。
 */
const LAUNCH_Y_MIN = -21.5;
const LAUNCH_Y_MAX = -17.0;

function pickPalette(exclude?: ColorPair): ColorPair {
  if (!exclude) {
    return FIREWORK_PALETTE[Math.floor(Math.random() * FIREWORK_PALETTE.length)];
  }
  let pair = FIREWORK_PALETTE[Math.floor(Math.random() * FIREWORK_PALETTE.length)];
  // 简单避免相邻烟花颜色重复
  for (let attempts = 0; attempts < 4 && pair === exclude; attempts++) {
    pair = FIREWORK_PALETTE[Math.floor(Math.random() * FIREWORK_PALETTE.length)];
  }
  return pair;
}

function makeShow(now: number): FireworkSpec[] {
  // 主体 10 束 + 压轴 1 束。所有烟花在 ~8s 内完结视觉高潮。
  const COUNT = 10;
  const specs: FireworkSpec[] = [];
  let lastPalette: ColorPair | undefined;

  for (let i = 0; i < COUNT; i++) {
    const t = i / (COUNT - 1); // 0..1

    // 在 0..6200ms 范围内分布起爆点，并附加少量随机抖动
    const baseDelayMs = t * 6200 + (Math.random() - 0.5) * 360;
    const burstStartMs = now + Math.max(0, baseDelayMs);
    const rocketStartMs = burstStartMs - ROCKET_DURATION_S * 1000;

    // 横向位置：左右交替散布，并添加随机扰动；Z 略有错落形成纵深
    const sign = i % 2 === 0 ? -1 : 1;
    const x = sign * (1.6 + Math.random() * 8.8);
    const y = 2.4 + Math.random() * 4.2; // 起爆点更分散，便于铺满夜空
    const z = -11.5 + Math.random() * 6.5; // -11.5 ~ -5

    const launchY = LAUNCH_Y_MIN + Math.random() * (LAUNCH_Y_MAX - LAUNCH_Y_MIN);

    const pattern = BURST_PATTERNS[Math.floor(Math.random() * BURST_PATTERNS.length)];
    const palette = pickPalette(lastPalette);
    lastPalette = palette;

    // 更大、更密的爆炸；柳型整体小一档，但粒子数多以呈现垂柳
    const spread =
      pattern === 'willow'
        ? 4.4 + Math.random() * 0.9
        : 5.6 + Math.random() * 2.2;
    const particles =
      pattern === 'willow'
        ? 240
        : 260 + Math.floor(Math.random() * 60);

    specs.push({
      id: now + i,
      rocketStartMs,
      burstStartMs,
      origin: [x, y, z],
      launchY,
      colorA: palette[0],
      colorB: palette[1],
      pattern,
      spread,
      particles,
    });
  }

  // 压轴：中央上空的特大球形烟花
  const finaleBurstMs = now + 6800;
  const finalePalette = pickPalette(lastPalette);
  specs.push({
    id: now + 99,
    rocketStartMs: finaleBurstMs - ROCKET_DURATION_S * 1000,
    burstStartMs: finaleBurstMs,
    origin: [(Math.random() - 0.5) * 3.0, 4.8 + Math.random() * 0.8, -8.8 + Math.random() * 1.8],
    launchY: LAUNCH_Y_MIN + Math.random() * 1.4,
    colorA: finalePalette[0],
    colorB: finalePalette[1],
    pattern: 'sphere',
    spread: 7.2,
    particles: 420,
    finale: true,
  });

  return specs;
}

export default function Fireworks() {
  const [active, setActive] = useState<ActiveFirework[]>([]);
  // 用 ref 防止闭包陈旧
  const tickRef = useRef<() => void>();

  const tick = useCallback(() => {
    const now = performance.now();
    setActive((prev) => {
      const next = prev.filter((f) => f.removeAtMs > now);
      return next.length === prev.length ? prev : next;
    });
  }, []);

  tickRef.current = tick;

  useEffect(() => {
    const handler = () => {
      const now = performance.now();
      const specs = makeShow(now);
      const newItems: ActiveFirework[] = specs.map((s) => ({
        ...s,
        rocketEndsAtMs: s.burstStartMs,
        removeAtMs: s.burstStartMs + (BURST_LIFETIME_S + 0.4) * 1000,
      }));
      setActive((prev) => [...prev, ...newItems]);
    };

    window.addEventListener(FIREWORKS_START_EVENT, handler);
    return () => window.removeEventListener(FIREWORKS_START_EVENT, handler);
  }, []);

  // 周期性地清理已结束的烟花
  useEffect(() => {
    if (active.length === 0) return;
    const interval = window.setInterval(() => tickRef.current?.(), 250);
    // 在最后一束结束后再做一次"兜底"清理
    const last = active.reduce((m, f) => Math.max(m, f.removeAtMs), 0);
    const safety = window.setTimeout(() => tickRef.current?.(), Math.max(0, last - performance.now()) + 600);
    return () => {
      window.clearInterval(interval);
      window.clearTimeout(safety);
    };
  }, [active.length]);

  // 注：useFrame 必须在 Canvas 内部使用；本组件只能放在 <Canvas> 子树中
  if (active.length === 0) return null;

  return (
    <group>
      {active.map((f) => (
        <FireworkSlot key={f.id} spec={f} />
      ))}
    </group>
  );
}

// 只在合适的时间窗口里把 Rocket / Burst 渲染上去，减少不必要的着色器更新
function FireworkSlot({ spec }: { spec: FireworkSpec }) {
  const [phase, setPhase] = useState<'rocket' | 'burst' | 'done'>(() => {
    const now = performance.now();
    if (now < spec.burstStartMs) return 'rocket';
    if (now < spec.burstStartMs + (BURST_LIFETIME_S + 0.3) * 1000) return 'burst';
    return 'done';
  });

  useEffect(() => {
    const now = performance.now();
    const toBurst = spec.burstStartMs - now;
    const toDone = spec.burstStartMs + (BURST_LIFETIME_S + 0.3) * 1000 - now;
    const timers: number[] = [];

    if (toBurst > 0) {
      timers.push(window.setTimeout(() => setPhase('burst'), toBurst));
    } else if (phase === 'rocket') {
      setPhase('burst');
    }

    if (toDone > 0) {
      timers.push(window.setTimeout(() => setPhase('done'), Math.max(0, toDone)));
    }

    return () => {
      for (const id of timers) window.clearTimeout(id);
    };
    // 仅依赖 spec.id：每束烟花只调度一次
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spec.id]);

  if (phase === 'done') return null;
  if (phase === 'rocket') return <Rocket spec={spec} />;
  // 起爆相位同时渲染：核心强光 + 爆炸粒子
  return (
    <>
      <FlashCore spec={spec} />
      <Burst spec={spec} />
    </>
  );
}
