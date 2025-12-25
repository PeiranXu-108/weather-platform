'use client';

import { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

// 薄雾层组件（柔和朦胧）
function FogLayer({ 
  position, 
  scale,
  opacity,
  seed,
  speed
}: { 
  position: [number, number, number]; 
  scale: [number, number];
  opacity: number;
  seed: number;
  speed: number;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  
  // 创建薄雾几何体和材质
  const { geometry, material } = useMemo(() => {
    const geo = new THREE.PlaneGeometry(scale[0], scale[1], 1, 1);
    
    // 创建柔和噪声纹理用于更自然的雾效果（低频+平滑）
    const random = (x: number, y: number) => {
      const value = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
      return value - Math.floor(value);
    };
    
    const smoothNoise = (x: number, y: number) => {
      // 叠加多层低频噪声，减少粗糙感
      const n1 = random(x * 0.05 + seed, y * 0.05 + seed);
      const n2 = random(x * 0.02 + seed * 2, y * 0.02 + seed * 2);
      const n3 = random(x * 0.01 + seed * 3, y * 0.01 + seed * 3);
      return (n1 * 0.6 + n2 * 0.3 + n3 * 0.1);
    };
    
    const size = 128; // 更小的纹理，降低噪点感
    const dataArray = new Uint8Array(size * size * 4);
    for (let i = 0; i < size * size; i++) {
      const x = i % size;
      const y = Math.floor(i / size);
      const noise = smoothNoise(x, y);
      const value = Math.floor(noise * 180 + 50); // 更柔和的亮度范围
      dataArray[i * 4] = value;     // R
      dataArray[i * 4 + 1] = value; // G
      dataArray[i * 4 + 2] = value; // B
      dataArray[i * 4 + 3] = Math.floor(noise * 120 + 30); // 更低透明度
    }
    
    const texture = new THREE.DataTexture(
      dataArray,
      size,
      size,
      THREE.RGBAFormat
    );
    texture.needsUpdate = true;
    
    const mat = new THREE.MeshBasicMaterial({
      color: 0xf7f7f7, // 更淡的浅灰
      transparent: true,
      opacity: opacity,
      side: THREE.DoubleSide,
      fog: true,
      map: texture,
      alphaMap: texture,
      depthWrite: false, // 防止遮挡导致的生硬边缘
    });
    
    return { geometry: geo, material: mat };
  }, [scale, opacity, seed]);
  
  useFrame((state) => {
    if (meshRef.current) {
      // 水平移动创造流动效果
      meshRef.current.position.x += speed * 0.006;
      
      // 循环移动
      if (meshRef.current.position.x > 35) {
        meshRef.current.position.x = -35;
      }
      
      // 轻微的上下浮动
      const floatAmount = 0.25;
      const floatSpeed = 0.12 + seed * 0.04;
      meshRef.current.position.y = position[1] + Math.sin(state.clock.elapsedTime * floatSpeed + seed * 10) * floatAmount;
      
      // 轻微的透明度变化
      if (meshRef.current.material instanceof THREE.MeshBasicMaterial) {
        const opacityVariation = 0.035;
        const opacitySpeed = 0.09 + seed * 0.04;
        meshRef.current.material.opacity = opacity + Math.sin(state.clock.elapsedTime * opacitySpeed + seed * 20) * opacityVariation;
      }
    }
  });
  
  return (
    <mesh ref={meshRef} geometry={geometry} material={material} position={position} />
  );
}

// 场景组件
function FoggyScene() {
  const fogLayers = useMemo(() => {
    const layers: Array<{
      position: [number, number, number];
      scale: [number, number];
      opacity: number;
      seed: number;
      speed: number;
    }> = [];
    
    // 创建多层薄雾，不同位置、大小和透明度
    for (let i = 0; i < 6; i++) {
      const seed = i * 0.2;
      const random = (offset: number) => {
        const x = Math.sin(seed * 12.9898 + offset) * 43758.5453;
        return x - Math.floor(x);
      };
      
      layers.push({
        position: [
          (random(1) - 0.5) * 32, // x: -16 到 16，覆盖视野
          (random(2) - 0.5) * 10 + 1.5, // y: 轻微上下分布
          -3 - i * 1.2, // z: 从近到远分布，前景更靠近相机
        ] as [number, number, number],
        scale: [
          18 + random(3) * 12, // 更宽
          10 + random(4) * 6,   // 更高
        ] as [number, number],
        opacity: 0.12 + random(5) * 0.18, // 更柔和的透明度
        seed: seed,
        speed: 0.22 + random(6) * 0.25, // 更慢的移动速度
      });
    }
    
    return layers;
  }, []);
  
  return (
    <>
      {/* 环境光 - 柔和的光照 */}
      <ambientLight intensity={0.6} color={0xf5f5f5} />
      <directionalLight position={[10, 10, 5]} intensity={0.4} color={0xffffff} />
      
      {/* 渲染薄雾层 */}
      {fogLayers.map((layer, index) => (
        <FogLayer
          key={`fog-${index}`}
          position={layer.position}
          scale={layer.scale}
          opacity={layer.opacity}
          seed={layer.seed}
          speed={layer.speed}
        />
      ))}
      
      {/* 雾效果 - 增强朦胧感 */}
      <fog attach="fog" args={[0xd0d0d0, 8, 25]} />
    </>
  );
}

interface FoggyWeatherBackgroundProps {
  className?: string;
  sunsetTime?: string;
  currentTime?: string;
}

export default function FoggyWeatherBackground({ 
  className = '', 
  sunsetTime,
  currentTime 
}: FoggyWeatherBackgroundProps) {
  // 判断是否是日落时段
  const isSunset = useMemo(() => {
    if (!sunsetTime || !currentTime) {
      return false;
    }
    
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
      
      const oneHourBeforeSunset = new Date(sunsetDate.getTime() - 60 * 60 * 1000);
      const oneHourAfterSunset = new Date(sunsetDate.getTime() + 60 * 60 * 1000);
      
      return currentDate >= oneHourBeforeSunset && currentDate <= oneHourAfterSunset;
    } catch {
      return false;
    }
  }, [sunsetTime, currentTime]);

  return (
    <div className={`fixed inset-0 -z-10 ${className}`}>
      {/* 浅灰色渐变背景 */}
      {isSunset ? (
        // 日落时的深灰色渐变
        <div 
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(to bottom, rgb(180, 185, 190) 0%, rgb(140, 145, 150) 50%, rgb(100, 105, 110) 100%)'
          }}
        />
      ) : (
        // 正常雾天的浅灰色渐变
        <div 
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(to bottom, rgb(230, 232, 235) 0%, rgb(200, 205, 210) 50%, rgb(170, 175, 180) 100%)'
          }}
        />
      )}
      {/* 柔化边缘的叠加层，避免颗粒感过强 */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(circle at 50% 20%, rgba(255,255,255,0.35), rgba(255,255,255,0.1) 40%, rgba(255,255,255,0.02) 70%, rgba(255,255,255,0))'
        }}
      />
      
      {/* Three.js Canvas - 薄雾效果 */}
      <Canvas
        camera={{ position: [0, 0, 10], fov: 75 }}
        style={{ width: '100%', height: '100%' }}
        gl={{ alpha: true, antialias: true }}
        dpr={[1, 2]}
        performance={{ min: 0.5 }}
      >
        <FoggyScene />
      </Canvas>
    </div>
  );
}
