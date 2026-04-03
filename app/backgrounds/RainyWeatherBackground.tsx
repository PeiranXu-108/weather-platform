'use client';

import { useRef, useMemo, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import CloudLayer from './CloudLayer';

interface RainConfig {
  totalCount: number;
  detailedCount: number;
  lengthMin: number;
  lengthRange: number;
  radiusTop: number;
  radiusBottom: number;
  speedMin: number;
  speedRange: number;
  detailedSpeedMin: number;
  detailedSpeedRange: number;
  opacity: number;
  emissiveIntensity: number;
  fogNear: number;
  fogFar: number;
}

function getRainConfig(precipMm: number): RainConfig {
  // precipMm 映射到 0~1 的强度值，使用对数曲线使小雨/中雨变化更明显
  // 0mm → 0.05, 0.5mm → 0.2, 2.5mm → 0.5, 7.5mm → 0.75, 20mm → 0.9, 50mm+ → 1.0
  const t = Math.min(1, Math.max(0.05, Math.log(1 + precipMm * 2) / Math.log(1 + 100)));

  const lerp = (a: number, b: number, p: number) => a + (b - a) * p;

  return {
    totalCount: Math.round(lerp(800, 6000, t)),
    detailedCount: Math.round(lerp(10, 65, t)),
    lengthMin: lerp(0.2, 0.55, t),
    lengthRange: lerp(0.2, 0.6, t),
    radiusTop: lerp(0.012, 0.026, t),
    radiusBottom: lerp(0.008, 0.018, t),
    speedMin: lerp(1.5, 5.0, t),
    speedRange: lerp(1.0, 3.5, t),
    detailedSpeedMin: lerp(2.5, 7.0, t),
    detailedSpeedRange: lerp(1.0, 3.0, t),
    opacity: lerp(0.35, 0.78, t),
    emissiveIntensity: lerp(0.15, 0.42, t),
    fogNear: lerp(12, 7, t),
    fogFar: lerp(30, 23, t),
  };
}

const RAINDROP_BASE_LENGTH = 0.5;

function Raindrop({
  position,
  length,
  speed,
  seed,
  config,
}: {
  position: [number, number, number];
  length: number;
  speed: number;
  seed: number;
  config: RainConfig;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const scaleY = length / RAINDROP_BASE_LENGTH;
  const scaleXZ = config.radiusTop / 0.025;

  const initialY = useMemo(() => position[1], [position[1]]);
  const initialX = useMemo(() => position[0], [position[0]]);

  const geometry = useMemo(
    () => new THREE.CylinderGeometry(0.025, 0.018, RAINDROP_BASE_LENGTH, 6),
    [],
  );
  const material = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: 0xdde4f0,
        transparent: true,
        opacity: Math.min(1, config.opacity + 0.05),
        emissive: 0xc0d0e8,
        emissiveIntensity: config.emissiveIntensity + 0.05,
      }),
    [config.opacity, config.emissiveIntensity],
  );

  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.position.y -= speed * 0.02;
      const windOffset = Math.sin(state.clock.elapsedTime * 2 + seed) * 0.1;
      meshRef.current.position.x = initialX + windOffset;
      if (meshRef.current.position.y < -15) {
        meshRef.current.position.y = initialY + 30;
        meshRef.current.position.x = initialX;
      }
    }
  });

  return (
    <mesh
      ref={meshRef}
      position={position}
      geometry={geometry}
      material={material}
      scale={[scaleXZ, scaleY, scaleXZ]}
    />
  );
}

function InstancedRaindrops({
  count,
  config,
}: {
  count: number;
  config: RainConfig;
}) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const tempObject = useRef(new THREE.Object3D());

  const { raindrops, positions } = useMemo(() => {
    const drops: Array<{
      position: [number, number, number];
      length: number;
      speed: number;
      seed: number;
      initialY: number;
      initialX: number;
    }> = [];

    const pos: Array<{ x: number; y: number; z: number; rotation: number }> = [];

    for (let i = 0; i < count; i++) {
      const seed = i * 0.1;
      const random = (offset: number) => {
        const x = Math.sin(seed * 12.9898 + offset) * 43758.5453;
        return x - Math.floor(x);
      };

      const x = (random(1) - 0.5) * 40;
      const y = (random(2) - 0.5) * 30 + 5;
      const z = -8 + random(3) * 4;
      const length = config.lengthMin + random(4) * config.lengthRange;

      drops.push({
        position: [x, y, z],
        length,
        speed: config.speedMin + random(10) * config.speedRange,
        seed,
        initialY: y,
        initialX: x,
      });

      pos.push({ x, y, z, rotation: 0.1 });
    }

    return { raindrops: drops, positions: pos };
  }, [count, config.lengthMin, config.lengthRange, config.speedMin, config.speedRange]);

  const geometry = useMemo(
    () => new THREE.CylinderGeometry(config.radiusTop * 0.8, config.radiusBottom * 0.8, 0.5, 6),
    [config.radiusTop, config.radiusBottom],
  );

  const material = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: 0xc8d4e8,
        transparent: true,
        opacity: config.opacity,
        emissive: 0xb0c0d8,
        emissiveIntensity: config.emissiveIntensity,
      }),
    [config.opacity, config.emissiveIntensity],
  );

  useEffect(() => {
    if (!meshRef.current) return;
    meshRef.current.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

    raindrops.forEach((drop, i) => {
      tempObject.current.position.set(positions[i].x, positions[i].y, positions[i].z);
      tempObject.current.scale.set(1, drop.length, 1);
      tempObject.current.rotation.z = positions[i].rotation;
      tempObject.current.updateMatrix();
      meshRef.current!.setMatrixAt(i, tempObject.current.matrix);
    });

    meshRef.current.instanceMatrix.needsUpdate = true;
  }, [raindrops, positions]);

  useFrame((state) => {
    if (!meshRef.current) return;

    const elapsedTime = state.clock.elapsedTime;

    raindrops.forEach((drop, i) => {
      let y = positions[i].y - drop.speed * 0.02;

      const windOffset = Math.sin(elapsedTime * 2 + drop.seed) * 0.1;
      const x = drop.initialX + windOffset;

      if (y < -15) {
        y = drop.initialY + 30;
        positions[i].x = drop.initialX;
      }

      positions[i].x = x;
      positions[i].y = y;

      tempObject.current.position.set(x, y, positions[i].z);
      tempObject.current.scale.set(1, drop.length, 1);
      tempObject.current.rotation.z = 0.1;
      tempObject.current.updateMatrix();
      meshRef.current!.setMatrixAt(i, tempObject.current.matrix);
    });

    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[geometry, material, count]} />
  );
}

function RainyScene({ config }: { config: RainConfig }) {
  const { detailedDrops, simpleCount } = useMemo(() => {
    const detailed: Array<{
      position: [number, number, number];
      length: number;
      speed: number;
      seed: number;
    }> = [];

    for (let i = 0; i < config.detailedCount; i++) {
      const seed = i * 0.1;
      const random = (offset: number) => {
        const x = Math.sin(seed * 12.9898 + offset) * 43758.5453;
        return x - Math.floor(x);
      };

      detailed.push({
        position: [
          (random(1) - 0.5) * 40,
          (random(2) - 0.5) * 30 + 5,
          -5 + random(3) * 3,
        ],
        length: config.lengthMin * 1.15 + random(4) * config.lengthRange * 1.1,
        speed: config.detailedSpeedMin + random(10) * config.detailedSpeedRange,
        seed,
      });
    }

    return {
      detailedDrops: detailed,
      simpleCount: config.totalCount - config.detailedCount,
    };
  }, [config.totalCount, config.detailedCount, config.lengthMin, config.lengthRange, config.detailedSpeedMin, config.detailedSpeedRange]);

  return (
    <>
      <ambientLight intensity={0.3} />
      <directionalLight
        position={[5, 10, 5]}
        intensity={0.4}
        color={0xaaaaaa}
      />
      <directionalLight position={[0, -5, -5]} intensity={0.15} color={0x888888} />

      <CloudLayer
        zDepth={-12}
        speed={0.03}
        scale={2.2}
        opacity={0.40}
        coverage={0.44}
        softness={0.20}
        warpStrength={1.4}
        cloudColor={new THREE.Color(0.38, 0.40, 0.44)}
        shadowColor={new THREE.Color(0.18, 0.20, 0.24)}
        windDir={[1.0, 0.10]}
        planeSize={[55, 32]}
        yOffset={2}
      />
      <CloudLayer
        zDepth={-8}
        speed={0.05}
        scale={1.5}
        opacity={0.50}
        coverage={0.46}
        softness={0.16}
        warpStrength={1.0}
        cloudColor={new THREE.Color(0.32, 0.34, 0.38)}
        shadowColor={new THREE.Color(0.14, 0.16, 0.20)}
        windDir={[1.0, 0.15]}
        planeSize={[52, 30]}
        yOffset={0}
      />

      <InstancedRaindrops count={simpleCount} config={config} />

      {detailedDrops.map((drop, index) => (
        <Raindrop
          key={`detailed-${index}`}
          position={drop.position}
          length={drop.length}
          speed={drop.speed}
          seed={drop.seed}
          config={config}
        />
      ))}

      <fog attach="fog" args={[0x4a4a4a, config.fogNear, config.fogFar]} />
    </>
  );
}

interface RainyWeatherBackgroundProps {
  className?: string;
  sunsetTime?: string;
  currentTime?: string;
  precipMm?: number;
}

export default function RainyWeatherBackground({
  className = '',
  sunsetTime,
  currentTime,
  precipMm = 2.5,
}: RainyWeatherBackgroundProps) {
  const config = useMemo(() => getRainConfig(precipMm), [precipMm]);

  const isSunset = Boolean(sunsetTime && currentTime &&
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
        const oneHourBefore = new Date(sunsetDate.getTime() - 60 * 60 * 1000);
        const oneHourAfter = new Date(sunsetDate.getTime() + 60 * 60 * 1000);
        return currentDate >= oneHourBefore && currentDate <= oneHourAfter;
      } catch {
        return false;
      }
    })());

  return (
    <div data-weather-bg className={`fixed inset-0 z-0 ${className}`}>
      {isSunset ? (
        <div
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(to bottom, rgb(50, 55, 65) 0%, rgb(60, 65, 75) 30%, rgb(70, 75, 85) 60%, rgb(80, 85, 95) 100%)'
          }}
        />
      ) : (
        <div
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(to bottom, rgb(60, 65, 70) 0%, rgb(70, 75, 80) 50%, rgb(55, 60, 65) 100%)'
          }}
        />
      )}

      <Canvas
        camera={{ position: [0, 0, 10], fov: 75 }}
        style={{ width: '100%', height: '100%' }}
        gl={{
          alpha: true,
          antialias: false,
          preserveDrawingBuffer: true,
          powerPreference: "high-performance",
          stencil: false,
          depth: true,
        }}
        dpr={[1, 2]}
        performance={{ min: 0.5 }}
        frameloop="always"
      >
        <RainyScene config={config} />
      </Canvas>
    </div>
  );
}
