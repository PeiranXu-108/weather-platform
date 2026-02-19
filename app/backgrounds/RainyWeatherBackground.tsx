'use client';

import { useRef, useMemo, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

// 单个雨滴组件 - 细长型
function Raindrop({ 
  position, 
  length, 
  speed, 
  seed 
}: { 
  position: [number, number, number]; 
  length: number;
  speed: number;
  seed: number;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  
  // 创建细长的雨滴几何体
  const geometry = useMemo(() => {
    // 使用细长的圆柱体或平面来表示雨滴
    return new THREE.CylinderGeometry(0.01, 0.01, length, 4);
  }, [length]);
  
  const material = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      color: 0xeaf0ff,
      transparent: true,
      opacity: 0.6,
      emissive: 0xfffff,
      emissiveIntensity: 0.2,
    });
  }, []);
  
  // 初始位置
  const initialY = useMemo(() => position[1], [position[1]]);
  const initialX = useMemo(() => position[0], [position[0]]);
  
  useFrame((state) => {
    if (meshRef.current) {
      // 快速垂直下落
      meshRef.current.position.y -= speed * 0.02;
      
      // 轻微的左右倾斜（模拟风的效果）
      const windOffset = Math.sin(state.clock.elapsedTime * 2 + seed) * 0.1;
      meshRef.current.position.x = initialX + windOffset;
      
      // 轻微的旋转（模拟雨滴下落时的倾斜）
    //   meshRef.current.rotation.z = 0.1;
      
      // 循环：当雨滴落到底部时，重新从顶部开始
      if (meshRef.current.position.y < -15) {
        meshRef.current.position.y = initialY + 30;
        meshRef.current.position.x = initialX;
      }
    }
  });
  
  return (
    <mesh ref={meshRef} position={position} geometry={geometry} material={material} />
  );
}

// 使用 InstancedMesh 批量渲染大量雨滴（性能优化）
function InstancedRaindrops({ 
  count 
}: { 
  count: number;
}) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const tempObject = useRef(new THREE.Object3D());
  
  // 生成雨滴数据并维护位置状态
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
      const length = 0.3 + random(4) * 0.4; // 雨滴长度
      
      drops.push({
        position: [x, y, z],
        length: length,
        speed: 3.0 + random(10) * 2.0, // 较快的下落速度
        seed: seed,
        initialY: y,
        initialX: x,
      });
      
      pos.push({ x, y, z, rotation: 0.1 });
    }
    
    return { raindrops: drops, positions: pos };
  }, [count]);
  
  // 创建几何体和材质 - 细长的圆柱体
  const geometry = useMemo(() => {
    return new THREE.CylinderGeometry(0.008, 0.008, 0.5, 4);
  }, []);
  
  const material = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      color: 0x88aaff,
      transparent: true,
      opacity: 0.7,
      emissive: 0x4488ff,
      emissiveIntensity: 0.15,
    });
  }, []);
  
  // 初始化实例矩阵
  useEffect(() => {
    if (!meshRef.current) return;
    meshRef.current.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    
    raindrops.forEach((drop, i) => {
      tempObject.current.position.set(positions[i].x, positions[i].y, positions[i].z);
      tempObject.current.scale.set(1, drop.length, 1); // y轴缩放表示长度
      tempObject.current.rotation.z = positions[i].rotation;
      tempObject.current.updateMatrix();
      meshRef.current!.setMatrixAt(i, tempObject.current.matrix);
    });
    
    meshRef.current.instanceMatrix.needsUpdate = true;
  }, [raindrops, positions]);
  
  // 使用 requestAnimationFrame 优化的更新循环
  useFrame((state) => {
    if (!meshRef.current) return;
    
    const elapsedTime = state.clock.elapsedTime;
    
    // 批量更新所有实例的位置
    raindrops.forEach((drop, i) => {
      // 计算新位置 - 快速下落
      let y = positions[i].y - drop.speed * 0.02;
      
      // 轻微的左右倾斜（模拟风的效果）
      const windOffset = Math.sin(elapsedTime * 2 + drop.seed) * 0.1;
      const x = drop.initialX + windOffset;
      
      // 循环：当雨滴落到底部时，重新从顶部开始
      if (y < -15) {
        y = drop.initialY + 30;
        positions[i].x = drop.initialX;
      }
      
      // 更新位置状态
      positions[i].x = x;
      positions[i].y = y;
      
      // 更新矩阵
      tempObject.current.position.set(x, y, positions[i].z);
      tempObject.current.scale.set(1, drop.length, 1);
      tempObject.current.rotation.z = 0.1; // 轻微的倾斜
      tempObject.current.updateMatrix();
      meshRef.current!.setMatrixAt(i, tempObject.current.matrix);
    });
    
    meshRef.current.instanceMatrix.needsUpdate = true;
  });
  
  return (
    <instancedMesh ref={meshRef} args={[geometry, material, count]} />
  );
}

// 场景组件
function RainyScene() {
  // 分离精致雨滴和简单雨滴
  const { detailedDrops, simpleCount } = useMemo(() => {
    const detailed: Array<{ 
      position: [number, number, number]; 
      length: number;
      speed: number;
      seed: number;
    }> = [];
    
    const detailedCount = 150; // 前30个使用独立组件（更精致）
    const totalCount = 5000; // 总雨滴数量
    
    // 生成精致雨滴数据
    for (let i = 0; i < detailedCount; i++) {
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
        length: 0.4 + random(4) * 0.4,
        speed: 6.0 + random(10) * 2.0,
        seed: seed,
      });
    }
    
    return { detailedDrops: detailed, simpleCount: totalCount - detailedCount };
  }, []);
  
  return (
    <>
      {/* 环境光 - 雨天时较暗 */}
      <ambientLight intensity={0.3} />
      {/* 主光源 - 柔和的冷光 */}
      <directionalLight 
        position={[5, 10, 5]} 
        intensity={0.4} 
        color={0xaaaaaa}
      />
      {/* 补充光源 - 从下方反射的冷光 */}
      <directionalLight position={[0, -5, -5]} intensity={0.15} color={0x888888} />
      
      {/* 使用 InstancedMesh 批量渲染大量雨滴 */}
      <InstancedRaindrops count={simpleCount} />
      
      {/* 渲染精致的雨滴 */}
      {detailedDrops.map((drop, index) => (
        <Raindrop 
          key={`detailed-${index}`}
          position={drop.position} 
          length={drop.length}
          speed={drop.speed}
          seed={drop.seed}
        />
      ))}
      
      {/* 雾效果，增强深度感和真实感 - 雨天使用深灰色雾 */}
      <fog attach="fog" args={[0x4a4a4a, 5, 20]} />
    </>
  );
}

interface RainyWeatherBackgroundProps {
  className?: string;
  sunsetTime?: string;
  currentTime?: string;
}

export default function RainyWeatherBackground({ 
  className = '', 
  sunsetTime,
  currentTime 
}: RainyWeatherBackgroundProps) {
  // 判断是否在日落前后一小时
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
    <div data-weather-bg className={`fixed inset-0 -z-10 ${className}`}>
      {/* 深灰色渐变背景 */}
      {isSunset ? (
        // 日落时的深灰蓝渐变
        <div 
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(to bottom, rgb(50, 55, 65) 0%, rgb(60, 65, 75) 30%, rgb(70, 75, 85) 60%, rgb(80, 85, 95) 100%)'
          }}
        />
      ) : (
        // 正常雨天的深灰色渐变：深灰 -> 中灰 -> 深灰
        <div 
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(to bottom, rgb(60, 65, 70) 0%, rgb(70, 75, 80) 50%, rgb(55, 60, 65) 100%)'
          }}
        />
      )}
      
      {/* Three.js Canvas - 优化性能配置 */}
      <Canvas
        camera={{ position: [0, 0, 10], fov: 75 }}
        style={{ width: '100%', height: '100%' }}
        gl={{ 
          alpha: true, 
          antialias: true,
          preserveDrawingBuffer: true,
          powerPreference: "high-performance",
          stencil: false,
          depth: true,
        }}
        dpr={[1, 2]}
        performance={{ min: 0.5 }}
        frameloop="always"
      >
        <RainyScene />
      </Canvas>
    </div>
  );
}
