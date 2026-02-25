'use client';

import { useRef, useMemo, useEffect, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

// ---------------------------------------------------------------------------
// Star – single twinkling star with emissive material
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

  const geometry = useMemo(() => new THREE.SphereGeometry(size, 8, 8), [size]);

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
      meshRef.current.scale.setScalar(0.8 + twinkleAmount * 0.4);
    }
  });

  return <mesh ref={meshRef} position={position} geometry={geometry} material={material} />;
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

  const initialX = useMemo(() => position[0], [position[0]]);
  const initialY = useMemo(() => position[1], [position[1]]);

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
// InstancedStars – batch-rendered twinkling stars
// ---------------------------------------------------------------------------
export function InstancedStars({ count }: { count: number }) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const tempObject = useRef(new THREE.Object3D());

  const { stars, positions } = useMemo(() => {
    const starData: Array<{ position: [number, number, number]; size: number; seed: number }> = [];
    const pos: Array<{ x: number; y: number; z: number; size: number }> = [];

    for (let i = 0; i < count; i++) {
      const seed = i * 0.1;
      const random = (offset: number) => {
        const x = Math.sin(seed * 12.9898 + offset) * 43758.5453;
        return x - Math.floor(x);
      };

      const x = (random(1) - 0.5) * 50;
      const y = (random(2) - 0.5) * 30 + 5;
      const z = -15 + random(3) * 10;
      const size = 0.02 + random(4) * 0.03;

      starData.push({ position: [x, y, z], size, seed });
      pos.push({ x, y, z, size });
    }

    return { stars: starData, positions: pos };
  }, [count]);

  const geometry = useMemo(() => new THREE.SphereGeometry(0.03, 6, 6), []);

  const material = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        emissive: 0xffffff,
        emissiveIntensity: 1.2,
      }),
    [],
  );

  useEffect(() => {
    if (!meshRef.current) return;
    meshRef.current.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

    stars.forEach((star, i) => {
      tempObject.current.position.set(positions[i].x, positions[i].y, positions[i].z);
      tempObject.current.scale.setScalar(positions[i].size);
      tempObject.current.updateMatrix();
      meshRef.current!.setMatrixAt(i, tempObject.current.matrix);
    });

    meshRef.current.instanceMatrix.needsUpdate = true;
  }, [stars, positions]);

  useFrame((state) => {
    if (!meshRef.current) return;

    stars.forEach((star, i) => {
      const twinkleSpeed = 2 + star.seed * 0.5;
      const twinkleAmount = Math.sin(state.clock.elapsedTime * twinkleSpeed + star.seed) * 0.3;
      const scale = positions[i].size * (0.8 + twinkleAmount);

      tempObject.current.position.set(positions[i].x, positions[i].y, positions[i].z);
      tempObject.current.scale.setScalar(scale);
      tempObject.current.updateMatrix();
      meshRef.current!.setMatrixAt(i, tempObject.current.matrix);
    });

    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  return <instancedMesh ref={meshRef} args={[geometry, material, count]} />;
}

// ---------------------------------------------------------------------------
// NightSkyEffects – composite: instanced stars + detailed stars + shooting stars
// Renders only the sky objects (no lights / fog) so the caller can compose them.
// ---------------------------------------------------------------------------
export default function NightSkyEffects() {
  const [shootingStars, setShootingStars] = useState<
    Array<{ position: [number, number, number]; seed: number; id: number }>
  >([]);

  const detailedStars = useMemo(() => {
    const detailed: Array<{ position: [number, number, number]; size: number; seed: number }> = [];

    for (let i = 0; i < 80; i++) {
      const seed = i * 0.1;
      const random = (offset: number) => {
        const x = Math.sin(seed * 12.9898 + offset) * 43758.5453;
        return x - Math.floor(x);
      };

      detailed.push({
        position: [(random(1) - 0.5) * 50, (random(2) - 0.5) * 30 + 5, -15 + random(3) * 10],
        size: 0.03 + random(4) * 0.04,
        seed,
      });
    }

    return detailed;
  }, []);

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
      <InstancedStars count={600} />

      {detailedStars.map((star, index) => (
        <Star key={`star-${index}`} position={star.position} size={star.size} seed={star.seed} />
      ))}

      {shootingStars.map((meteor) => (
        <ShootingStar key={`meteor-${meteor.id}`} position={meteor.position} seed={meteor.seed} />
      ))}
    </>
  );
}
