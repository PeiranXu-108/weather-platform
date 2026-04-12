'use client';

import { useRef, useMemo, useEffect, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const STAR_MAX_SIZE = 0.08;
const sharedStarGeometry = new THREE.SphereGeometry(STAR_MAX_SIZE, 16, 16);

// ---------------------------------------------------------------------------
// Star – single twinkling star with emissive material (bright highlights)
// ---------------------------------------------------------------------------
export function Star({
  position,
  size,
  seed,
}: {
  position: [number, number, number];
  size: number;
  seed: number;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const scale = size / STAR_MAX_SIZE;

  const material = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        emissive: 0xffffff,
        emissiveIntensity: 1.5,
      }),
    [],
  );

  useFrame((state) => {
    if (meshRef.current) {
      const twinkleSpeed = 2 + seed * 0.5;
      const twinkleAmount = 0.3 + Math.sin(state.clock.elapsedTime * twinkleSpeed + seed) * 0.2;
      const intensity = 0.8 + twinkleAmount;
      (material as THREE.MeshStandardMaterial).emissiveIntensity = intensity;
      meshRef.current.scale.setScalar(scale * (0.8 + twinkleAmount * 0.4));
    }
  });

  return (
    <mesh ref={meshRef} position={position} geometry={sharedStarGeometry} material={material} />
  );
}

// ---------------------------------------------------------------------------
// ShootingStar – meteor with trail
// ---------------------------------------------------------------------------
export function ShootingStar({
  position,
  seed,
}: {
  position: [number, number, number];
  seed: number;
}) {
  const groupRef = useRef<THREE.Group>(null);

  const trailGroup = useMemo(() => {
    const group = new THREE.Group();

    for (let i = 0; i < 10; i++) {
      const trailLength = 0.1;
      const trailWidth = 0.01 * (1 - i * 0.1);
      const trailGeometry = new THREE.CylinderGeometry(trailWidth, trailWidth * 1.2, trailLength, 6);
      const trailMaterial = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.9 - i * 0.09,
        emissive: 0xaaccff,
        emissiveIntensity: 2.0 - i * 0.15,
      });
      const trail = new THREE.Mesh(trailGeometry, trailMaterial);
      trail.position.set(0, -i * 0.2, 0);
      trail.rotation.x = Math.PI / 2;
      group.add(trail);
    }

    const coreGeometry = new THREE.SphereGeometry(0.04, 8, 8);
    const coreMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xffffff,
      emissiveIntensity: 3,
    });
    group.add(new THREE.Mesh(coreGeometry, coreMaterial));

    const glowGeometry = new THREE.SphereGeometry(0.06, 8, 8);
    const glowMaterial = new THREE.MeshStandardMaterial({
      color: 0xaaccff,
      transparent: true,
      opacity: 0.4,
      emissive: 0xaaccff,
      emissiveIntensity: 1.5,
    });
    group.add(new THREE.Mesh(glowGeometry, glowMaterial));

    return group;
  }, []);

  const speed = useMemo(() => {
    const random = (offset: number) => {
      const x = Math.sin(seed * 12.9898 + offset) * 43758.5453;
      return x - Math.floor(x);
    };
    return 0.25 + random(10) * 0.3;
  }, [seed]);

  const angle = useMemo(() => {
    const random = (offset: number) => {
      const x = Math.sin(seed * 12.9898 + offset) * 43758.5453;
      return x - Math.floor(x);
    };
    return -Math.PI / 3 + random(20) * (Math.PI / 6);
  }, [seed]);

  useFrame(() => {
    if (groupRef.current) {
      groupRef.current.position.x += Math.cos(angle) * speed;
      groupRef.current.position.y += Math.sin(angle) * speed;
      groupRef.current.rotation.z = angle + Math.PI / 2;

      if (groupRef.current.position.y < -15 || groupRef.current.position.x > 30) {
        const random = (offset: number) => {
          const x = Math.sin(seed * 12.9898 + offset + Date.now() * 0.001) * 43758.5453;
          return x - Math.floor(x);
        };
        groupRef.current.position.x = (random(1) - 0.5) * 50 - 15;
        groupRef.current.position.y = 8 + random(2) * 12;
      }
    }
  });

  return (
    <group ref={groupRef} position={position}>
      <primitive object={trailGroup} />
    </group>
  );
}

// ---------------------------------------------------------------------------
// InstancedStars – Points-based rendering for perfect circles & performance
// ---------------------------------------------------------------------------
const starVertexShader = /* glsl */ `
  attribute float aSeed;
  attribute float aSize;
  uniform float uTime;
  uniform float uPixelRatio;
  varying float vBrightness;

  void main() {
    float twinkle = sin(uTime * (1.8 + aSeed * 0.5) + aSeed) * 0.3;
    vBrightness = 0.65 + twinkle + 0.35;

    vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * (22.0 / -mvPos.z) * uPixelRatio * (0.85 + twinkle * 0.25);
    gl_Position = projectionMatrix * mvPos;
  }
`;

const starFragmentShader = /* glsl */ `
  varying float vBrightness;

  void main() {
    float d = length(gl_PointCoord - 0.5);
    if (d > 0.5) discard;
    float alpha = 1.0 - smoothstep(0.25, 0.5, d);
    gl_FragColor = vec4(vec3(1.0), alpha * vBrightness);
  }
`;

export function InstancedStars({ count }: { count: number }) {
  const pointsRef = useRef<THREE.Points>(null);

  const geometry = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const seeds = new Float32Array(count);
    const sizes = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      const seed = i * 0.1;
      const random = (offset: number) => {
        const x = Math.sin(seed * 12.9898 + offset) * 43758.5453;
        return x - Math.floor(x);
      };

      pos[i * 3]     = (random(1) - 0.5) * 66;
      pos[i * 3 + 1] = (random(2) - 0.5) * 42 + 4;
      pos[i * 3 + 2] = -18 + random(3) * 14;
      seeds[i] = seed;
      sizes[i] = 0.6 + random(4) * 2.0;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));
    geo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
    return geo;
  }, [count]);

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          uTime: { value: 0 },
          uPixelRatio: { value: 1 },
        },
        vertexShader: starVertexShader,
        fragmentShader: starFragmentShader,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    [],
  );

  useFrame(({ clock, gl }) => {
    material.uniforms.uTime.value = clock.elapsedTime;
    material.uniforms.uPixelRatio.value = gl.getPixelRatio();
  });

  return <points ref={pointsRef} geometry={geometry} material={material} />;
}

// ---------------------------------------------------------------------------
// NightSkyEffects – composite: point stars + detailed stars + shooting stars
// ---------------------------------------------------------------------------
/** 全屏夜空用高密度；embedded（卡片小窗）降低点数避免「噪点」感 */
const NIGHT_SKY_POINT_STARS = { fullscreen: 1650, embedded: 180 } as const;
const NIGHT_SKY_MESH_STARS = { fullscreen: 40, embedded: 5 } as const;

export default function NightSkyEffects({ layout = 'fullscreen' }: { layout?: 'fullscreen' | 'embedded' }) {
  const [shootingStars, setShootingStars] = useState<
    Array<{ position: [number, number, number]; seed: number; id: number }>
  >([]);

  const pointStarCount = NIGHT_SKY_POINT_STARS[layout];
  const detailedStarCount = NIGHT_SKY_MESH_STARS[layout];

  const detailedStars = useMemo(() => {
    const detailed: Array<{ position: [number, number, number]; size: number; seed: number }> = [];

    for (let i = 0; i < detailedStarCount; i++) {
      const seed = i * 0.1;
      const random = (offset: number) => {
        const x = Math.sin(seed * 12.9898 + offset) * 43758.5453;
        return x - Math.floor(x);
      };

      detailed.push({
        position: [(random(1) - 0.5) * 60, (random(2) - 0.5) * 36 + 5, -16 + random(3) * 12],
        size: 0.03 + random(4) * 0.05,
        seed,
      });
    }

    return detailed;
  }, [detailedStarCount]);

  useEffect(() => {
    let meteorId = 0;
    let intervalId: NodeJS.Timeout | null = null;

    const generateMeteor = () => {
      const timeSeed = Date.now() % 10000;
      const seed = timeSeed * 0.1;

      const random = (offset: number) => {
        const x = Math.sin(seed * 12.9898 + offset) * 43758.5453;
        return x - Math.floor(x);
      };

      const startX = (random(1) - 0.5) * 50 - 15;
      const startY = 8 + random(2) * 12;
      const startZ = -8 + random(3) * 5;

      const newMeteor = {
        position: [startX, startY, startZ] as [number, number, number],
        seed: seed + Math.random() * 0.1,
        id: meteorId++,
      };

      setShootingStars((prev) => [...prev, newMeteor]);

      setTimeout(() => {
        setShootingStars((prev) => prev.filter((m) => m.id !== newMeteor.id));
      }, 3000);
    };

    const initialDelay = 2000 + Math.random() * 3000;
    const timeoutId = setTimeout(() => {
      generateMeteor();

      intervalId = setInterval(() => {
        generateMeteor();
      }, 5000 + Math.random() * 10000);
    }, initialDelay);

    return () => {
      clearTimeout(timeoutId);
      if (intervalId) clearInterval(intervalId);
    };
  }, []);

  return (
    <>
      <InstancedStars count={pointStarCount} />

      {detailedStars.map((star, index) => (
        <Star key={`star-${index}`} position={star.position} size={star.size} seed={star.seed} />
      ))}

      {shootingStars.map((meteor) => (
        <ShootingStar key={`meteor-${meteor.id}`} position={meteor.position} seed={meteor.seed} />
      ))}
    </>
  );
}
