'use client';

import { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

// 云朵组件
function Cloud({ 
  position, 
  scale, 
  seed 
}: { 
  position: [number, number, number]; 
  scale: number;
  seed: number;
}) {
  const meshRef = useRef<THREE.Group>(null);
  
  // 创建云朵形状（使用多个球体组合）
  const cloudGroup = useMemo(() => {
    const group = new THREE.Group();
    
    // 使用共享的几何体和材质以提高性能
    const sphereGeometry = new THREE.SphereGeometry(1, 16, 16);
    const material = new THREE.MeshStandardMaterial({
      color: 0xd4d4d4, // 灰色云朵，更符合阴天效果
      transparent: true,
      opacity: 0.85,
      fog: true,
    });
    
    // 使用种子值来生成固定的随机位置，确保每次渲染云朵形状一致
    const random = (offset: number) => {
      const x = Math.sin(seed * 12.9898 + offset) * 43758.5453;
      return x - Math.floor(x);
    };
    
    // 生成云朵的球体位置
    const sphereCount = 15 + Math.floor(random(1) * 4);
    const positions: Array<[number, number, number]> = [];
    
    for (let i = 0; i < sphereCount; i++) {
      positions.push([
        (random(i * 3) - 0.5) * 2.5,
        (random(i * 3 + 1) - 0.5) * 1.5,
        (random(i * 3 + 2) - 0.5) * 1.5,
      ]);
    }
    
    positions.forEach((pos, i) => {
      const sphere = new THREE.Mesh(sphereGeometry, material.clone());
      sphere.position.set(pos[0], pos[1], pos[2]);
      const sphereScale = 0.5 + random(i * 10) * 0.5;
      sphere.scale.setScalar(sphereScale);
      group.add(sphere);
    });
    
    return group;
  }, [seed]);
  
  useFrame((state) => {
    if (meshRef.current) {
      // 缓慢的水平移动（速度根据scale调整）
      const speed = 0.0008 * scale;
      meshRef.current.position.x += speed;
      
      // 循环移动：当云朵移出视野时，从另一侧重新进入
      if (meshRef.current.position.x > 20) {
        meshRef.current.position.x = -20;
      }
      
      // 轻微的上下浮动（使用正弦波）
      const floatAmount = 0.4;
      const floatSpeed = 0.2 + seed * 0.1;
      meshRef.current.position.y = position[1] + Math.sin(state.clock.elapsedTime * floatSpeed + seed) * floatAmount;
    }
  });
  
  return (
    <group ref={meshRef} position={position} scale={scale}>
      <primitive object={cloudGroup} />
    </group>
  );
}

// 场景组件
function CloudyScene({ isSunset }: { isSunset?: boolean }) {
  const clouds = useMemo(() => {
    // 生成多个云朵，分布在页面上方
    const cloudData: Array<{ 
      position: [number, number, number]; 
      scale: number;
      seed: number;
    }> = [];
    
    // 使用固定的种子值确保云朵位置可重现
    for (let i = 0; i < 15; i++) {
      const seed = i * 0.1;
      const random = (offset: number) => {
        const x = Math.sin(seed * 12.9898 + offset) * 43758.5453;
        return x - Math.floor(x);
      };
      
      cloudData.push({
        position: [
          (random(1) - 0.5) * 35, // x: -17.5 到 17.5
          4 + random(2) * 10, // y: 4 到 14 (页面上方)
          -12 + random(3) * 8, // z: -12 到 -4
        ],
        scale: 0.7 + random(4) * 0.8, // 0.7 到 1.5
        seed: seed,
      });
    }
    
    return cloudData;
  }, []);
  
  return (
    <>
      {/* 环境光 - 阴天时更暗 */}
      <ambientLight intensity={isSunset ? 0.4 : 0.5} />
      {/* 主光源（模拟太阳光）- 阴天时更暗，颜色偏灰 */}
      <directionalLight 
        position={[10, 10, 5]} 
        intensity={isSunset ? 0.5 : 0.6} 
        color={isSunset ? 0xffaa66 : 0xcccccc}
        castShadow 
      />
      {/* 补充光源 - 阴天时更暗 */}
      <directionalLight position={[-5, 5, -5]} intensity={isSunset ? 0.15 : 0.2} />
      
      {/* 渲染所有云朵 */}
      {clouds.map((cloud, index) => (
        <Cloud 
          key={index} 
          position={cloud.position} 
          scale={cloud.scale}
          seed={cloud.seed}
        />
      ))}
      
      {/* 雾效果，增强深度感和真实感 - 阴天使用灰色雾 */}
      <fog attach="fog" args={isSunset ? [0x4a5568, 8, 25] : [0x9ca3af, 8, 25]} />
    </>
  );
}

interface CloudyWeatherBackgroundProps {
  className?: string;
  sunsetTime?: string;
  currentTime?: string;
}

export default function CloudyWeatherBackground({ 
  className = '', 
  sunsetTime,
  currentTime 
}: CloudyWeatherBackgroundProps) {
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
    <div className={`fixed inset-0 -z-10 ${className}`}>
      {/* 根据时间显示不同的渐变背景 */}
      {isSunset ? (
        // 日落渐变：深灰 -> 灰蓝 -> 灰紫 -> 灰橙（多级渐变，阴天效果）
        <div 
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(to bottom,rgb(75, 85, 99) 0%,rgb(100, 116, 139) 10%,rgb(120, 140, 160) 40%,rgb(140, 150, 170) 60%,rgb(160, 150, 140) 85%,rgb(150, 130, 120) 100%)'
          }}
        />
      ) : (
        // 阴天灰色渐变：浅灰 -> 中灰 -> 深灰
        <div 
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(to bottom, rgb(209, 211, 213) 0%, rgb(135, 144, 154) 50%, rgb(100, 106, 112) 100%)'
          }}
        />
      )}
      
      {/* Three.js Canvas */}
      <Canvas
        camera={{ position: [0, 0, 10], fov: 75 }}
        style={{ width: '100%', height: '100%' }}
        gl={{ alpha: true, antialias: true }}
      >
        <CloudyScene isSunset={isSunset} />
      </Canvas>
    </div>
  );
}

