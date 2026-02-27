'use client';

import { useRef, useMemo, useEffect, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const MOON_TEXTURE_URL =
  'https://cdn.jsdelivr.net/gh/mrdoob/three.js@r161/examples/textures/planets/moon_1024.jpg';

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
  uniform vec2  uMoonPos;
  uniform float uMoonSize;
  uniform float uIllumination;
  uniform float uPhaseDir;
  uniform float uAspect;
  uniform sampler2D uMoonTex;

  varying vec2 vUv;

  void main() {
    vec2 uv = vUv;
    vec2 p    = vec2(uv.x * uAspect, uv.y);
    vec2 moonP = vec2(uMoonPos.x * uAspect, uMoonPos.y);

    float dist = length(p - moonP);
    vec3 col = vec3(0.0);
    float moonR = uMoonSize;

    // ================================================================
    // Moon disc – sample CDN texture (moon_1024.jpg)
    // ================================================================
    vec2 surfUV = (p - moonP) / moonR;
    float r2 = dot(surfUV, surfUV);

    if (r2 < 1.0) {
      float z = sqrt(1.0 - r2);
      vec3 N = vec3(surfUV, z);

      // Phase illumination
      float cosTheta = 2.0 * uIllumination - 1.0;
      float sinTheta = sqrt(max(0.0, 1.0 - cosTheta * cosTheta));
      vec3 L = vec3(uPhaseDir * sinTheta, 0.0, cosTheta);
      float NdotL = dot(N, L);

      float lit = smoothstep(-0.035, 0.035, NdotL);

      // Texture coords: disc center = texture center (0.5, 0.5), Y flipped for standard moon map
      vec2 texCoord = vec2(surfUV.x * 0.5 + 0.5, 1.0 - (surfUV.y * 0.5 + 0.5));
      vec3 surface = texture2D(uMoonTex, texCoord).rgb;

      // Earthshine on dark side
      float earthshine = 0.022;

      // Limb darkening
      float limb = pow(z, 0.28);

      // Warm glow near terminator
      float termDist = abs(NdotL);
      float termGlow = exp(-termDist * termDist * 12.0) * 0.04 * lit;
      vec3 termCol = vec3(0.95, 0.70, 0.40) * termGlow;

      // Final surface colour
      vec3 moonCol = surface * (lit + earthshine * (1.0 - lit)) * limb;
      moonCol += termCol;

      // Edge anti-aliasing
      float edge = 1.0 - smoothstep(1.0 - 0.025, 1.0, sqrt(r2));

      col += moonCol * edge;
    }

    // ================================================================
    // Atmospheric glow (multi-layer)
    // ================================================================
    float glowNorm = dist / moonR;

    float g1 = exp(-glowNorm * glowNorm * 1.0)  * 0.10;
    float g2 = exp(-glowNorm * glowNorm * 0.18) * 0.04;
    float g3 = exp(-glowNorm * glowNorm * 0.04) * 0.012;

    vec3  glowCol   = vec3(0.72, 0.78, 0.88);
    float glowScale = 0.3 + 0.7 * uIllumination;

    float breathe = 0.97 + 0.03 * sin(uTime * 0.25);
    col += glowCol * (g1 + g2 + g3) * glowScale * breathe;

    float haze = exp(-glowNorm * glowNorm * 0.012) * 0.006;
    col += vec3(0.50, 0.55, 0.65) * haze * uIllumination;

    gl_FragColor = vec4(col, 0.0);
  }
`;

// ---------------------------------------------------------------------------
// Phase direction from API moon_phase string
// ---------------------------------------------------------------------------
function getPhaseDir(phase: string): number {
  const lower = phase.toLowerCase();
  if (lower.includes('waning') || lower.includes('last') || lower.includes('third')) {
    return -1.0;
  }
  return 1.0;
}

// ---------------------------------------------------------------------------
// Exported types & component
// ---------------------------------------------------------------------------
export interface MoonEffectProps {
  moonPos?: [number, number];
  moonSize?: number;
  moonPhase?: string;
  moonIllumination?: number;
  zDepth?: number;
  planeSize?: [number, number];
}

// Placeholder 1x1 texture so shader has a valid sampler until CDN texture loads
function createPlaceholderMoonTexture(): THREE.Texture {
  const canvas = document.createElement('canvas');
  canvas.width = 1;
  canvas.height = 1;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#888';
  ctx.fillRect(0, 0, 1, 1);
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

export default function MoonEffect({
  moonPos = [0.72, 0.78],
  moonSize = 0.09,
  moonPhase = 'Full Moon',
  moonIllumination = 100,
  zDepth = -17,
  planeSize = [70, 40],
}: MoonEffectProps) {
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const loadedTexRef = useRef<THREE.Texture | null>(null);
  const [moonTexture, setMoonTexture] = useState<THREE.Texture | null>(null);

  const placeholderTex = useMemo(() => createPlaceholderMoonTexture(), []);

  useEffect(() => {
    const loader = new THREE.TextureLoader();
    loader.load(
      MOON_TEXTURE_URL,
      (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.minFilter = THREE.LinearMipmapLinearFilter;
        tex.magFilter = THREE.LinearFilter;
        tex.wrapS = THREE.ClampToEdgeWrapping;
        tex.wrapT = THREE.ClampToEdgeWrapping;
        loadedTexRef.current = tex;
        setMoonTexture(tex);
      },
      undefined,
      () => setMoonTexture(placeholderTex),
    );
    return () => {
      if (loadedTexRef.current) {
        loadedTexRef.current.dispose();
        loadedTexRef.current = null;
      }
    };
  }, [placeholderTex]);

  const phaseDir = useMemo(() => getPhaseDir(moonPhase), [moonPhase]);
  const illum = Math.max(0, Math.min(100, moonIllumination)) / 100;

  const uniforms = useMemo(
    () => ({
      uTime:          { value: 0 },
      uMoonPos:       { value: new THREE.Vector2(moonPos[0], moonPos[1]) },
      uMoonSize:      { value: moonSize },
      uIllumination:  { value: illum },
      uPhaseDir:      { value: phaseDir },
      uAspect:        { value: planeSize[0] / planeSize[1] },
      uMoonTex:       { value: placeholderTex },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  useFrame(({ clock }) => {
    if (matRef.current) {
      matRef.current.uniforms.uTime.value = clock.elapsedTime;
      matRef.current.uniforms.uIllumination.value = illum;
      matRef.current.uniforms.uPhaseDir.value = phaseDir;
      matRef.current.uniforms.uMoonTex.value = moonTexture ?? placeholderTex;
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
        blending={THREE.CustomBlending}
        blendSrc={THREE.OneFactor}
        blendDst={THREE.OneFactor}
        blendSrcAlpha={THREE.ZeroFactor}
        blendDstAlpha={THREE.OneFactor}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}
