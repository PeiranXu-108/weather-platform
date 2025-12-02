'use client';

import { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

// 太阳组件
function Sun({ position }: { position: [number, number, number] }) {
  const sunRef = useRef<THREE.Group>(null);
  
  // 创建太阳（核心 + 光晕）
  const sunGroup = useMemo(() => {
    const group = new THREE.Group();
    
    // 太阳核心 - 明亮的黄色/白色（使用 MeshStandardMaterial 支持自发光）
    const coreGeometry = new THREE.SphereGeometry(2, 32, 32);
    const coreMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffaa,
      emissive: 0xffffaa,
      emissiveIntensity: 2.5,
    });
    const core = new THREE.Mesh(coreGeometry, coreMaterial);
    group.add(core);
    
    // 外层光晕 - 更大的半透明球体
    const glowGeometry = new THREE.SphereGeometry(3.5, 32, 32);
    const glowMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffcc,
      transparent: true,
      opacity: 0.7,
      emissive: 0xffffcc,
      emissiveIntensity: 2,
    });
    const glow = new THREE.Mesh(glowGeometry, glowMaterial);
    group.add(glow);
    
    // 最外层光晕 - 更大的半透明球体
    const outerGlowGeometry = new THREE.SphereGeometry(5.5, 32, 32);
    const outerGlowMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffdd,
      transparent: true,
      opacity: 0.4,
      emissive: 0xffffdd,
      emissiveIntensity: 1.5,
    });
    const outerGlow = new THREE.Mesh(outerGlowGeometry, outerGlowMaterial);
    group.add(outerGlow);
    
    return group;
  }, []);
  
  return (
    <group ref={sunRef} position={position}>
      <primitive object={sunGroup} />
    </group>
  );
}

// 场景组件
function SunnyWeatherScene({ isSunset }: { isSunset?: boolean }) {
  // 太阳位置：右上角
  const sunPosition: [number, number, number] = [12, 10, -20];
  
  return (
    <>
      {/* 环境光 */}
      <ambientLight intensity={isSunset ? 0.6 : 0.8} />
      {/* 主光源（模拟太阳光） */}
      <directionalLight 
        position={sunPosition} 
        intensity={isSunset ? 1.2 : 1.5} 
        color={isSunset ? 0xffaa66 : 0xffffff}
        castShadow 
      />
      {/* 补充光源 */}
      <directionalLight position={[-5, 5, -5]} intensity={isSunset ? 0.3 : 0.4} />
      {/* 点光源（从太阳位置发出强光） */}
      <pointLight 
        position={sunPosition} 
        intensity={isSunset ? 2.5 : 3} 
        color={isSunset ? 0xff8844 : 0xffffaa} 
        distance={60} 
        decay={2} 
      />
      
      {/* 雾效果，增强深度感和真实感 */}
      <fog attach="fog" args={isSunset ? [0x4a5568, 8, 25] : [0x87ceeb, 10, 30]} />
    </>
  );
}

interface SunnyWeatherBackgroundProps {
  className?: string;
  sunsetTime?: string;
  currentTime?: string;
}

export default function SunnyWeatherBackground({ 
  className = '', 
  sunsetTime,
  currentTime 
}: SunnyWeatherBackgroundProps) {
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
        // 日落渐变：深蓝 -> 蓝 -> 紫 -> 橙 -> 深橙（多级渐变）
        <div 
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(to bottom,rgb(69, 89, 142) 0%,rgb(95, 114, 177) 10%,rgb(108, 160, 244) 40%,rgb(196, 174, 247) 60%,rgb(242, 194, 159) 85%,rgb(234, 163, 124) 100%)'
          }}
        />
      ) : (
        // 正常天蓝色渐变
        <div className="absolute inset-0 bg-gradient-to-b from-sky-200 via-sky-300 to-blue-400" />
      )}
      
      {/* Three.js Canvas */}
      <Canvas
        camera={{ position: [0, 0, 10], fov: 75 }}
        style={{ width: '100%', height: '100%' }}
        gl={{ alpha: true, antialias: true }}
      >
        <SunnyWeatherScene isSunset={isSunset} />
      </Canvas>
    </div>
  );
}

