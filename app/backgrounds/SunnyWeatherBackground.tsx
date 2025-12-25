'use client';

import { useRef, useMemo, useEffect, useState } from 'react';
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

// 星星组件 - 闪耀效果
function Star({ 
  position, 
  size, 
  seed 
}: { 
  position: [number, number, number]; 
  size: number;
  seed: number;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  
  const geometry = useMemo(() => {
    return new THREE.SphereGeometry(size, 8, 8);
  }, [size]);
  
  const material = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xffffff,
      emissiveIntensity: 1.5,
    });
  }, []);
  
  // 闪烁动画
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

// 流星组件
function ShootingStar({ 
  position, 
  seed 
}: { 
  position: [number, number, number]; 
  seed: number;
}) {
  const groupRef = useRef<THREE.Group>(null);
  
  const trailGroup = useMemo(() => {
    const group = new THREE.Group();
    
    // 创建流星尾迹 - 使用细长的圆柱体形成尾迹效果（缩小尺寸）
    for (let i = 0; i < 10; i++) {
      const trailLength = 0.1; // 减小长度
      const trailWidth = 0.01 * (1 - i * 0.1); // 减小宽度
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
      trail.rotation.x = Math.PI / 2; // 旋转90度使其水平
      group.add(trail);
    }
    
    // 流星核心（缩小）
    const coreGeometry = new THREE.SphereGeometry(0.04, 8, 8);
    const coreMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xffffff,
      emissiveIntensity: 3,
    });
    const core = new THREE.Mesh(coreGeometry, coreMaterial);
    group.add(core);
    
    // 外层光晕（缩小）
    const glowGeometry = new THREE.SphereGeometry(0.06, 8, 8);
    const glowMaterial = new THREE.MeshStandardMaterial({
      color: 0xaaccff,
      transparent: true,
      opacity: 0.4,
      emissive: 0xaaccff,
      emissiveIntensity: 1.5,
    });
    const glow = new THREE.Mesh(glowGeometry, glowMaterial);
    group.add(glow);
    
    return group;
  }, []);
  
  const initialX = useMemo(() => position[0], [position[0]]);
  const initialY = useMemo(() => position[1], [position[1]]);
  // 使用 seed 生成随机的速度和角度
  const speed = useMemo(() => {
    const random = (offset: number) => {
      const x = Math.sin(seed * 12.9898 + offset) * 43758.5453;
      return x - Math.floor(x);
    };
    return 0.25 + random(10) * 0.3; // 速度范围：0.25-0.55
  }, [seed]);
  
  const angle = useMemo(() => {
    const random = (offset: number) => {
      const x = Math.sin(seed * 12.9898 + offset) * 43758.5453;
      return x - Math.floor(x);
    };
    // 角度范围：-60度到-30度（斜向下）
    return -Math.PI / 3 + random(20) * (Math.PI / 6);
  }, [seed]);
  
  useFrame(() => {
    if (groupRef.current) {
      // 斜向下移动
      groupRef.current.position.x += Math.cos(angle) * speed;
      groupRef.current.position.y += Math.sin(angle) * speed;
      
      // 旋转尾迹
      groupRef.current.rotation.z = angle + Math.PI / 2;
      
      // 循环：当流星移出视野时，重新从随机位置开始
      if (groupRef.current.position.y < -15 || groupRef.current.position.x > 30) {
        // 重新随机化起始位置
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

// 批量渲染星星
function InstancedStars({ count }: { count: number }) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const tempObject = useRef(new THREE.Object3D());
  
  const { stars, positions } = useMemo(() => {
    const starData: Array<{
      position: [number, number, number];
      size: number;
      seed: number;
    }> = [];
    
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
      
      starData.push({
        position: [x, y, z],
        size: size,
        seed: seed,
      });
      
      pos.push({ x, y, z, size });
    }
    
    return { stars: starData, positions: pos };
  }, [count]);
  
  const geometry = useMemo(() => {
    return new THREE.SphereGeometry(0.03, 6, 6);
  }, []);
  
  const material = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xffffff,
      emissiveIntensity: 1.2,
    });
  }, []);
  
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
  
  // 闪烁效果
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

// 黑夜场景组件
function NightScene() {
  const [shootingStars, setShootingStars] = useState<Array<{
    position: [number, number, number];
    seed: number;
    id: number;
  }>>([]);
  
  const detailedStars = useMemo(() => {
    const detailed: Array<{
      position: [number, number, number];
      size: number;
      seed: number;
    }> = [];
    
    // 生成精致星星（前50个）
    for (let i = 0; i < 80; i++) {
      const seed = i * 0.1;
      const random = (offset: number) => {
        const x = Math.sin(seed * 12.9898 + offset) * 43758.5453;
        return x - Math.floor(x);
      };
      
      detailed.push({
        position: [
          (random(1) - 0.5) * 50,
          (random(2) - 0.5) * 30 + 5,
          -15 + random(3) * 10,
        ],
        size: 0.03 + random(4) * 0.04,
        seed: seed,
      });
    }
    
    return detailed;
  }, []);
  
  // 定时器：每隔 5-10 秒生成一颗流星
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
      
      // 随机起始位置
      const startX = (random(1) - 0.5) * 50 - 15;
      const startY = 8 + random(2) * 12;
      const startZ = -8 + random(3) * 5;
      
      const newMeteor = {
        position: [startX, startY, startZ] as [number, number, number],
        seed: seed + Math.random() * 0.1,
        id: meteorId++,
      };
      
      setShootingStars(prev => [...prev, newMeteor]);
      
      // 流星消失后移除
      setTimeout(() => {
        setShootingStars(prev => prev.filter(m => m.id !== newMeteor.id));
      }, 3000);
    };
    
    // 初始延迟后生成第一颗流星
    const initialDelay = 2000 + Math.random() * 3000;
    const timeoutId = setTimeout(() => {
      generateMeteor();
      
      // 设置定时器，每隔 5-15 秒生成一颗
      intervalId = setInterval(() => {
        generateMeteor();
      }, 5000 + Math.random() * 10000);
    }, initialDelay);
    
    return () => {
      clearTimeout(timeoutId);
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, []);
  
  return (
    <>
      {/* 环境光 - 夜晚很暗 */}
      <ambientLight intensity={0.1} />
      {/* 微弱的月光 */}
      <directionalLight 
        position={[5, 10, 5]} 
        intensity={0.2} 
        color={0x8888aa}
      />
      
      {/* 使用 InstancedMesh 批量渲染大量星星 */}
      <InstancedStars count={600} />
      
      {/* 渲染精致的星星 */}
      {detailedStars.map((star, index) => (
        <Star 
          key={`star-${index}`}
          position={star.position} 
          size={star.size}
          seed={star.seed}
        />
      ))}
      
      {/* 渲染流星 */}
      {shootingStars.map((meteor) => (
        <ShootingStar 
          key={`meteor-${meteor.id}`}
          position={meteor.position} 
          seed={meteor.seed}
        />
      ))}
      
      {/* 雾效果 - 夜晚使用深色雾 */}
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
    <div className={`fixed inset-0 -z-10 ${className}`}>
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
            background: 'linear-gradient(to bottom,rgb(188, 220, 235) 0%, rgb(135, 206, 235) 20%, rgb(35, 177, 233) 100%)'
          }}
        />
      )}
      
      {/* Three.js Canvas */}
      <Canvas
        camera={{ position: [0, 0, 10], fov: 75 }}
        style={{ width: '100%', height: '100%' }}
        gl={{ alpha: true, antialias: true }}
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
