'use client';

import { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import NightSkyEffects from './NightSky';

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

// 黑夜场景组件
function NightScene() {
  return (
    <>
      <ambientLight intensity={0.1} />
      <directionalLight position={[5, 10, 5]} intensity={0.2} color={0x8888aa} />
      <NightSkyEffects />
      <fog attach="fog" args={[0x0a0a1a, 10, 30]} />
    </>
  );
}

interface SunnyWeatherBackgroundProps {
  className?: string;
  sunsetTime?: string;
  sunriseTime?: string;
  currentTime?: string;
  isDay?: number; // API 提供的 is_day 字段：1=白天，0=黑夜
}

export default function SunnyWeatherBackground({ 
  className = '', 
  sunsetTime,
  sunriseTime,
  currentTime,
  isDay 
}: SunnyWeatherBackgroundProps) {
  // 判断时间状态：日落时段、黑夜、正常白天
  // 优先使用 API 的 is_day 字段，避免时区问题
  const timeState = useMemo(() => {
    // 如果 API 明确标识是黑夜，直接返回黑夜（除非在日出时段）
    if (isDay === 0) {
      // 检查是否在日出时段（日出前后1小时）
      if (sunriseTime && currentTime) {
        try {
          const currentDate = new Date(currentTime.replace(' ', 'T'));
          const [sunriseTimePart, sunrisePeriod] = sunriseTime.split(' ');
          const [sunriseHours, sunriseMinutes] = sunriseTimePart.split(':').map(Number);
          let sunriseHours24 = sunriseHours;
          if (sunrisePeriod === 'PM' && sunriseHours !== 12) {
            sunriseHours24 = sunriseHours + 12;
          } else if (sunrisePeriod === 'AM' && sunriseHours === 12) {
            sunriseHours24 = 0;
          }
          const sunriseDate = new Date(currentDate);
          sunriseDate.setHours(sunriseHours24, sunriseMinutes, 0, 0);
          const oneHourBeforeSunrise = new Date(sunriseDate.getTime() - 60 * 60 * 1000);
          const oneHourAfterSunrise = new Date(sunriseDate.getTime() + 60 * 60 * 1000);
          
          // 如果在日出时段，不算黑夜
          if (currentDate >= oneHourBeforeSunrise && currentDate <= oneHourAfterSunrise) {
            return 'day';
          }
        } catch {
          // 解析失败，使用 API 的 is_day
        }
      }
      return 'night';
    }
    
    // 如果是白天，检查是否在日落时段
    if (!sunsetTime || !currentTime) {
      return 'day';
    }
    
    try {
      const currentDate = new Date(currentTime.replace(' ', 'T'));
      
      // 解析日落时间
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
      
      // 判断是否在日落前后一小时（日落时段）
      if (currentDate >= oneHourBeforeSunset && currentDate <= oneHourAfterSunset) {
        return 'sunset';
      }
      
      return 'day';
    } catch {
      return 'day';
    }
  }, [sunsetTime, sunriseTime, currentTime, isDay]);

  return (
    <div data-weather-bg className={`fixed inset-0 -z-10 ${className}`}>
      {/* 根据时间状态显示不同的渐变背景 */}
      {timeState === 'sunset' ? (
        // 日落渐变：深蓝 -> 蓝 -> 紫 -> 橙 -> 深橙（多级渐变）
        <div 
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(to bottom,rgb(69, 89, 142) 0%,rgb(95, 114, 177) 10%,rgb(108, 160, 244) 40%,rgb(196, 174, 247) 60%,rgb(242, 194, 159) 85%,rgb(234, 163, 124) 100%)'
          }}
        />
      ) : timeState === 'night' ? (
        // 黑夜渐变：深蓝色和黑色渐变
        <div 
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(to bottom, rgb(10, 15, 30) 0%, rgb(5, 10, 25) 30%, rgb(0, 5, 20) 60%, rgb(0, 0, 15) 100%)'
          }}
        />
      ) : (
        // 正常天蓝色渐变
        <div className="absolute inset-0"
          style={{
            background: 'linear-gradient(to bottom,rgb(120, 193, 226) 0%, rgb(63, 180, 227) 40%, rgb(3, 140, 194) 100%)'
          }}
        />
      )}
      
      {/* Three.js Canvas */}
      <Canvas
        camera={{ position: [0, 0, 10], fov: 75 }}
        style={{ width: '100%', height: '100%' }}
        gl={{ alpha: true, antialias: true, preserveDrawingBuffer: true }}
      >
        {timeState === 'night' ? (
          <NightScene />
        ) : (
          <SunnyWeatherScene isSunset={timeState === 'sunset'} />
        )}
      </Canvas>
    </div>
  );
}
