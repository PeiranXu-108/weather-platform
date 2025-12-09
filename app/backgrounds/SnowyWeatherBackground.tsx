'use client';

import { useRef, useMemo, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

// 单个雪花组件 - 使用六角星形状
function Snowflake({ 
  position, 
  size, 
  speed, 
  seed 
}: { 
  position: [number, number, number]; 
  size: number;
  speed: number;
  seed: number;
}) {
  const meshRef = useRef<THREE.Group>(null);
  
  // 创建精致的六角星雪花形状
  const snowflakeGroup = useMemo(() => {
    const group = new THREE.Group();
    
    // 使用种子值来生成固定的随机值
    const random = (offset: number) => {
      const x = Math.sin(seed * 12.9898 + offset) * 43758.5453;
      return x - Math.floor(x);
    };
    
    // 创建六角星雪花 - 使用多个交叉的平面
    const createStarBranch = (angle: number, length: number) => {
      const branchGroup = new THREE.Group();
      
      // 主分支 - 细长的矩形
      const branchGeometry = new THREE.PlaneGeometry(0.02 * size, length * size);
      const branchMaterial = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.9,
        side: THREE.DoubleSide,
        emissive: 0xffffff,
        emissiveIntensity: 0.3,
      });
      const branch = new THREE.Mesh(branchGeometry, branchMaterial);
      branch.position.y = length * size * 0.5;
      branchGroup.add(branch);
      
      // 侧分支 - 左右各3个
      for (let i = 0; i < 3; i++) {
        const sideLength = (0.3 + random(i) * 0.2) * length * size;
        const sideGeometry = new THREE.PlaneGeometry(0.015 * size, sideLength);
        const sideMaterial = branchMaterial.clone();
        const sideBranch = new THREE.Mesh(sideGeometry, sideMaterial);
        
        const sideAngle = (i + 1) * 0.3;
        const sideDistance = (0.2 + random(i + 10) * 0.3) * length * size;
        sideBranch.position.x = Math.sin(sideAngle) * sideDistance;
        sideBranch.position.y = (0.3 + random(i + 20) * 0.4) * length * size;
        sideBranch.rotation.z = sideAngle;
        branchGroup.add(sideBranch);
        
        // 另一侧的对称分支
        const sideBranch2 = new THREE.Mesh(sideGeometry, sideMaterial.clone());
        sideBranch2.position.x = -Math.sin(sideAngle) * sideDistance;
        sideBranch2.position.y = (0.3 + random(i + 30) * 0.4) * length * size;
        sideBranch2.rotation.z = -sideAngle;
        branchGroup.add(sideBranch2);
      }
      
      branchGroup.rotation.z = angle;
      return branchGroup;
    };
    
    // 创建6个主分支，形成完整的六角星
    for (let i = 0; i < 6; i++) {
      const angle = (i * Math.PI) / 3;
      const branchLength = 0.4 + random(i * 5) * 0.2;
      const branch = createStarBranch(angle, branchLength);
      group.add(branch);
    }
    
    // 中心小圆点
    const centerGeometry = new THREE.CircleGeometry(0.05 * size, 8);
    const centerMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.95,
      emissive: 0xffffff,
      emissiveIntensity: 0.4,
    });
    const center = new THREE.Mesh(centerGeometry, centerMaterial);
    group.add(center);
    
    return group;
  }, [size, seed]);
  
  // 初始位置和速度
  const initialY = useMemo(() => position[1], [position[1]]);
  const driftSpeed = useMemo(() => (Math.sin(seed * 100) - 0.5) * 0.3, [seed]);
  const rotationSpeed = useMemo(() => (Math.sin(seed * 50) - 0.5) * 0.02, [seed]);
  
  useFrame((state) => {
    if (meshRef.current) {
      // 垂直下落
      meshRef.current.position.y -= speed * 0.01;
      
      // 水平漂移（模拟风的效果）
      const windOffset = Math.sin(state.clock.elapsedTime * 0.5 + seed) * driftSpeed;
      meshRef.current.position.x = position[0] + windOffset;
      
      // 旋转效果
      meshRef.current.rotation.z += rotationSpeed;
      
      // 循环：当雪花落到底部时，重新从顶部开始
      if (meshRef.current.position.y < -15) {
        meshRef.current.position.y = initialY + 30;
        meshRef.current.position.x = position[0];
      }
    }
  });
  
  return (
    <group ref={meshRef} position={position}>
      <primitive object={snowflakeGroup} />
    </group>
  );
}

// 简单的雪花粒子（用于远处的雪花，提高性能）
function SimpleSnowflake({ 
  position, 
  size, 
  speed, 
  seed 
}: { 
  position: [number, number, number]; 
  size: number;
  speed: number;
  seed: number;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  
  const driftSpeed = useMemo(() => (Math.sin(seed * 100) - 0.5) * 0.2, [seed]);
  const initialY = useMemo(() => position[1], [position[1]]);
  
  const geometry = useMemo(() => {
    return new THREE.CircleGeometry(size * 0.08, 6);
  }, [size]);
  
  const material = useMemo(() => {
    // 计算随机不透明度
    const random = (offset: number) => {
      const x = Math.sin(seed * 12.9898 + offset) * 43758.5453;
      return x - Math.floor(x);
    };
    return new THREE.MeshStandardMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.7 + random(1) * 0.2,
      emissive: 0xffffff,
      emissiveIntensity: 0.2,
    });
  }, [seed]);
  
  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.position.y -= speed * 0.01;
      const windOffset = Math.sin(state.clock.elapsedTime * 0.5 + seed) * driftSpeed;
      meshRef.current.position.x = position[0] + windOffset;
      
      if (meshRef.current.position.y < -15) {
        meshRef.current.position.y = initialY + 30;
        meshRef.current.position.x = position[0];
      }
    }
  });
  
  return <mesh ref={meshRef} position={position} geometry={geometry} material={material} />;
}

// 使用 InstancedMesh 批量渲染大量简单雪花（性能优化）
function InstancedSnowflakes({ 
  count, 
  detailedFlakes 
}: { 
  count: number;
  detailedFlakes: Array<{ position: [number, number, number]; size: number; speed: number; seed: number }>;
}) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const tempObject = useRef(new THREE.Object3D());
  
  // 生成简单雪花数据并维护位置状态
  const { simpleFlakes, positions } = useMemo(() => {
    const flakes: Array<{
      position: [number, number, number];
      size: number;
      speed: number;
      seed: number;
      initialY: number;
      initialX: number;
      driftSpeed: number;
    }> = [];
    
    const pos: Array<{ x: number; y: number; z: number }> = [];
    
    for (let i = 0; i < count; i++) {
      const seed = (i + detailedFlakes.length) * 0.1;
      const random = (offset: number) => {
        const x = Math.sin(seed * 12.9898 + offset) * 43758.5453;
        return x - Math.floor(x);
      };
      
      const x = (random(1) - 0.5) * 40;
      const y = (random(2) - 0.5) * 30 + 5;
      const z = -10 + random(3) * 5;
      
      flakes.push({
        position: [x, y, z],
        size: 0.4 + random(4) * 0.4,
        speed: 1.5 + random(10) * 0.6,
        seed: seed,
        initialY: y,
        initialX: x,
        driftSpeed: (Math.sin(seed * 100) - 0.5) * 0.2,
      });
      
      pos.push({ x, y, z });
    }
    
    return { simpleFlakes: flakes, positions: pos };
  }, [count, detailedFlakes.length]);
  
  // 创建几何体和材质
  const geometry = useMemo(() => {
    return new THREE.CircleGeometry(0.08, 6);
  }, []);
  
  const material = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.7,
      emissive: 0xffffff,
      emissiveIntensity: 0.2,
    });
  }, []);
  
  // 初始化实例矩阵 - 使用 useEffect 确保在组件挂载后执行
  useEffect(() => {
    if (!meshRef.current) return;
    
    simpleFlakes.forEach((flake, i) => {
      tempObject.current.position.set(positions[i].x, positions[i].y, positions[i].z);
      tempObject.current.scale.setScalar(flake.size);
      tempObject.current.updateMatrix();
      meshRef.current!.setMatrixAt(i, tempObject.current.matrix);
    });
    
    meshRef.current.instanceMatrix.needsUpdate = true;
  }, [simpleFlakes, positions]);
  
  // 使用 requestAnimationFrame 优化的更新循环
  useFrame((state) => {
    if (!meshRef.current) return;
    
    const elapsedTime = state.clock.elapsedTime;
    
    // 批量更新所有实例的位置
    simpleFlakes.forEach((flake, i) => {
      // 计算新位置
      let y = positions[i].y - flake.speed * 0.01;
      const windOffset = Math.sin(elapsedTime * 0.5 + flake.seed) * flake.driftSpeed;
      const x = flake.initialX + windOffset;
      
      // 循环：当雪花落到底部时，重新从顶部开始
      if (y < -15) {
        y = flake.initialY + 30;
        positions[i].x = flake.initialX;
      }
      
      // 更新位置状态
      positions[i].x = x;
      positions[i].y = y;
      
      // 更新矩阵
      tempObject.current.position.set(x, y, positions[i].z);
      tempObject.current.scale.setScalar(flake.size);
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
function SnowyScene() {
  // 分离精致雪花和简单雪花
  const { detailedFlakes, simpleCount } = useMemo(() => {
    const detailed: Array<{ 
      position: [number, number, number]; 
      size: number;
      speed: number;
      seed: number;
    }> = [];
    
    const detailedCount = 50;
    const totalCount = 1000;
    
    // 生成精致雪花数据
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
        size: 0.8 + random(4) * 0.6,
        speed: 1.5 + random(10) * 0.6,
        seed: seed,
      });
    }
    
    return { detailedFlakes: detailed, simpleCount: totalCount - detailedCount };
  }, []);
  
  return (
    <>
      {/* 环境光 - 雪天时较暗 */}
      <ambientLight intensity={0.4} />
      {/* 主光源 - 柔和的冷光 */}
      <directionalLight 
        position={[5, 10, 5]} 
        intensity={0.5} 
        color={0xccccff}
      />
      {/* 补充光源 - 从下方反射的冷光 */}
      <directionalLight position={[0, -5, -5]} intensity={0.2} color={0xaaaaaa} />
      
      {/* 使用 InstancedMesh 批量渲染大量简单雪花 */}
      <InstancedSnowflakes count={simpleCount} detailedFlakes={detailedFlakes} />
      
      {/* 渲染精致的六角星雪花 */}
      {detailedFlakes.map((flake, index) => (
        <Snowflake 
          key={`detailed-${index}`}
          position={flake.position} 
          size={flake.size}
          speed={flake.speed}
          seed={flake.seed}
        />
      ))}
      
      {/* 雾效果，增强深度感和真实感 - 雪天使用深灰色雾 */}
      <fog attach="fog" args={[0x4a4a4a, 5, 20]} />
    </>
  );
}

interface SnowyWeatherBackgroundProps {
  className?: string;
  sunsetTime?: string;
  currentTime?: string;
}

export default function SnowyWeatherBackground({ 
  className = '', 
  sunsetTime,
  currentTime 
}: SnowyWeatherBackgroundProps) {
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
      <div className="absolute inset-0">
        <div 
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(to bottom, rgb(60, 65, 70) 0%, rgb(70, 75, 80) 50%, rgb(55, 60, 65) 100%)'
          }}
        />
      </div>
      
      {/* Three.js Canvas - 优化性能配置 */}
      <Canvas
        camera={{ position: [0, 0, 10], fov: 75 }}
        style={{ width: '100%', height: '100%' }}
        gl={{ 
          alpha: true, 
          antialias: true,
          powerPreference: "high-performance",
          stencil: false,
          depth: true,
        }}
        dpr={[1, 2]} // 限制像素比以提高性能
        performance={{ min: 0.5 }} // 性能监控，低于50%时降低质量
        frameloop="always" // 始终使用 requestAnimationFrame
      >
        <SnowyScene />
      </Canvas>
    </div>
  );
}
