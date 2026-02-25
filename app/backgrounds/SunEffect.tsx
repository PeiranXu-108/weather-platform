'use client';

import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

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
// Fragment shader – Apple-Weather-style sun with optical effects
// Effects: disc, bloom, rainbow halo, god rays, lens flare, shimmer
// ---------------------------------------------------------------------------
const fragmentShader = /* glsl */ `
  precision highp float;

  uniform float uTime;
  uniform vec2  uSunPos;
  uniform vec3  uSunColor;
  uniform float uIntensity;
  uniform float uAspect;

  varying vec2 vUv;

  // ---- Simplex noise (for atmospheric shimmer) ----
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

  // ---- HSV → RGB (for rainbow halo) ----
  vec3 hsv2rgb(vec3 c) {
    vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
    vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
    return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
  }

  // ---- Single lens-flare ghost ----
  float flareGhost(vec2 p, vec2 pos, float size) {
    float d = length(p - pos);
    return smoothstep(size, size * 0.08, d);
  }

  void main() {
    vec2 uv = vUv;

    // Aspect-corrected coordinates so circles stay circular
    vec2 p    = vec2(uv.x * uAspect, uv.y);
    vec2 sunP = vec2(uSunPos.x * uAspect, uSunPos.y);

    vec2  delta = p - sunP;
    float dist  = length(delta);
    float angle = atan(delta.y, delta.x);

    vec3  col = vec3(0.0);
    float a   = 0.0;

    // ==================================================================
    // 1. Sun disc – mostly off-screen, only rim glow visible
    // ==================================================================
    float discR = 0.06;
    float disc  = 1.0 - smoothstep(0.0, discR, dist);
    float core  = 1.0 - smoothstep(0.0, discR * 0.35, dist);
    col += uSunColor * disc * 1.8;
    col += vec3(1.0) * core * 1.2;
    a   += disc * 0.9;

    // ==================================================================
    // 2. Multi-layer bloom / soft glow – chromatic rainbow gradient
    //    Inner glow warm white → outer glow shifts through rainbow
    // ==================================================================
    float b1 = exp(-dist * 8.0)  * 0.85;
    float b2 = exp(-dist * 2.8)  * 0.32;
    float b3 = exp(-dist * 0.9)  * 0.10;
    float b4 = exp(-dist * 0.45) * 0.04;

    // Distance-based hue: warm centre → red → orange → yellow → green → blue
    float bloomHueT = smoothstep(0.03, 0.55, dist);
    float bloomHue  = bloomHueT * 0.72;
    float bloomSat  = bloomHueT * 0.30;
    vec3  bloomTint = hsv2rgb(vec3(bloomHue, bloomSat, 1.0));
    vec3  bloomCol  = mix(uSunColor, bloomTint, bloomHueT * 0.6);

    col += bloomCol * (b1 + b2 + b3 + b4);
    a   += b1 * 0.7 + b2 * 0.35 + b3 * 0.12 + b4 * 0.04;

    // ==================================================================
    // 3. Rainbow halo rings – prominent chromatic dispersion
    //    Inner edge red → outer edge violet
    // ==================================================================

    // --- Primary halo (22° equivalent) ---
    float haloR = 0.38;
    float haloW = 0.05;
    float ringDist = abs(dist - haloR);
    float ring = exp(-ringDist * ringDist / (2.0 * haloW * haloW * 0.08));

    float haloPos = clamp((dist - (haloR - haloW)) / (haloW * 2.0), 0.0, 1.0);
    float hue     = mix(0.0, 0.82, haloPos);
    vec3  rainbow = hsv2rgb(vec3(hue, 0.85, 1.0));

    float angVar  = 0.90 + 0.10 * sin(angle * 3.0 + uTime * 0.18);
    float breathe = 0.94 + 0.06 * sin(uTime * 0.4);
    col += rainbow * ring * 0.38 * angVar * breathe;
    a   += ring * 0.25 * angVar * breathe;

    // --- Secondary outer halo (46° equivalent) ---
    float halo2R = 0.64;
    float halo2W = 0.035;
    float ring2Dist = abs(dist - halo2R);
    float ring2 = exp(-ring2Dist * ring2Dist / (2.0 * halo2W * halo2W * 0.10));
    float hue2  = mix(0.0, 0.82, clamp((dist - (halo2R - halo2W)) / (halo2W * 2.0), 0.0, 1.0));
    vec3  rb2   = hsv2rgb(vec3(hue2, 0.50, 1.0));
    col += rb2 * ring2 * 0.18 * angVar;
    a   += ring2 * 0.12 * angVar;

    // ==================================================================
    // 4. God rays – delicate radial streaks
    // ==================================================================
    float rA   = angle + uTime * 0.008;
    float rays = 0.0;
    rays += pow(max(cos(rA * 8.0), 0.0), 32.0)         * exp(-dist * 2.2) * 0.7;
    rays += pow(max(cos(rA * 6.0 + 0.6), 0.0), 44.0)   * exp(-dist * 3.0) * 0.45;
    rays += pow(max(cos(rA * 14.0 + 1.3), 0.0), 60.0)  * exp(-dist * 4.5) * 0.25;
    rays += pow(max(cos(rA * 4.0 - 0.4), 0.0), 20.0)   * exp(-dist * 1.4) * 0.18;
    col += uSunColor * rays * 0.22;
    a   += rays * 0.14;

    // ==================================================================
    // 5. Lens-flare ghosts – subtle chromatic spots
    // ==================================================================
    vec2  ctr   = vec2(0.5 * uAspect, 0.5);
    vec2  fAxis = ctr - sunP;
    float fLen  = length(fAxis);
    vec2  fDir  = fAxis / max(fLen, 0.001);

    // Ghost 1 – warm soft glow
    float g1 = flareGhost(p, sunP + fDir * fLen * 0.22, 0.020);
    col += vec3(1.0, 0.94, 0.80) * g1 * 0.06;
    a   += g1 * 0.04;

    // Ghost 2 – cool blue circle
    float g2 = flareGhost(p, sunP + fDir * fLen * 0.44, 0.030);
    col += vec3(0.70, 0.85, 1.0) * g2 * 0.05;
    a   += g2 * 0.035;

    // Ghost 3 – tiny violet
    float g3 = flareGhost(p, sunP + fDir * fLen * 0.58, 0.012);
    col += vec3(0.88, 0.72, 1.0) * g3 * 0.06;
    a   += g3 * 0.04;

    // Ghost 4 – diffuse teal
    float g4 = flareGhost(p, sunP + fDir * fLen * 0.74, 0.040);
    col += vec3(0.70, 1.0, 0.90) * g4 * 0.035;
    a   += g4 * 0.025;

    // Ghost 5 – small amber
    float g5 = flareGhost(p, sunP + fDir * fLen * 0.90, 0.016);
    col += vec3(1.0, 0.84, 0.60) * g5 * 0.05;
    a   += g5 * 0.035;

    // ==================================================================
    // 6. Atmospheric scintillation / shimmer
    // ==================================================================
    float shimmer = snoise(vec2(angle * 4.0 + uTime * 0.5,
                                dist  * 10.0 - uTime * 0.2));
    col += uSunColor * shimmer * 0.012 * exp(-dist * 3.5);

    // ==================================================================
    // Final intensity & clamp
    // ==================================================================
    col *= uIntensity;
    a   *= uIntensity;
    a    = clamp(a, 0.0, 1.0);

    gl_FragColor = vec4(col, a);
  }
`;

// ---------------------------------------------------------------------------
// Exported types & component
// ---------------------------------------------------------------------------
export interface SunEffectProps {
  sunPos?: [number, number];
  sunColor?: THREE.Color;
  intensity?: number;
  zDepth?: number;
  planeSize?: [number, number];
}

export default function SunEffect({
  sunPos = [-0.05, 1.08],
  sunColor = new THREE.Color(1.0, 0.95, 0.8),
  intensity = 1.0,
  zDepth = -15,
  planeSize = [70, 40],
}: SunEffectProps) {
  const matRef = useRef<THREE.ShaderMaterial>(null);

  const uniforms = useMemo(
    () => ({
      uTime:      { value: 0 },
      uSunPos:    { value: new THREE.Vector2(sunPos[0], sunPos[1]) },
      uSunColor:  { value: sunColor },
      uIntensity: { value: intensity },
      uAspect:    { value: planeSize[0] / planeSize[1] },
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
    <mesh position={[0, 0, zDepth]}>
      <planeGeometry args={[planeSize[0], planeSize[1], 1, 1]} />
      <shaderMaterial
        ref={matRef}
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
