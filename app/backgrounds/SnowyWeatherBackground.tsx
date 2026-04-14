'use client';

import { useRef, useMemo, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import CloudLayer from './CloudLayer';

interface SnowConfig {
  isNight: boolean;
  nearCount: number;
  midCount: number;
  farCount: number;
  ambientIntensity: number;
  mainLightIntensity: number;
  mainLightColor: number;
  fillLightIntensity: number;
  fillLightColor: number;
  fogColor: number;
  fogNear: number;
  fogFar: number;
  nearOpacity: number;
  midOpacity: number;
  farOpacity: number;
  nearSize: [number, number];
  midSize: [number, number];
  farSize: [number, number];
  cloudColor1: THREE.Color;
  cloudShadow1: THREE.Color;
  cloudColor2: THREE.Color;
  cloudShadow2: THREE.Color;
  cloudOpacity1: number;
  cloudOpacity2: number;
}

function scaleSizeRange(range: [number, number], factor: number): [number, number] {
  return [range[0] * factor, range[1] * factor];
}

function getSnowConfig(isNight: boolean, layout: 'fullscreen' | 'embedded'): SnowConfig {
  const config: SnowConfig = isNight
    ? {
        isNight: true,
        nearCount: 140,
        midCount: 1200,
        farCount: 2000,
        ambientIntensity: 0.10,
        mainLightIntensity: 0.12,
        mainLightColor: 0x667799,
        fillLightIntensity: 0.05,
        fillLightColor: 0x445566,
        fogColor: 0x161a22,
        fogNear: 6,
        fogFar: 22,
        nearOpacity: 0.7,
        midOpacity: 0.45,
        farOpacity: 0.22,
        nearSize: [0.12, 0.26],
        midSize: [0.06, 0.14],
        farSize: [0.03, 0.07],
        cloudColor1: new THREE.Color(0.16, 0.18, 0.24),
        cloudShadow1: new THREE.Color(0.07, 0.08, 0.13),
        cloudColor2: new THREE.Color(0.12, 0.14, 0.20),
        cloudShadow2: new THREE.Color(0.05, 0.06, 0.10),
        cloudOpacity1: 0.28,
        cloudOpacity2: 0.35,
      }
    : {
        isNight: false,
        nearCount: 140,
        midCount: 1200,
        farCount: 2000,
        ambientIntensity: 0.45,
        mainLightIntensity: 0.50,
        mainLightColor: 0xccccee,
        fillLightIntensity: 0.20,
        fillLightColor: 0xaaaacc,
        fogColor: 0x5a5e68,
        fogNear: 5,
        fogFar: 20,
        nearOpacity: 0.92,
        midOpacity: 0.6,
        farOpacity: 0.30,
        nearSize: [0.12, 0.26],
        midSize: [0.06, 0.14],
        farSize: [0.03, 0.07],
        cloudColor1: new THREE.Color(0.42, 0.44, 0.50),
        cloudShadow1: new THREE.Color(0.22, 0.24, 0.30),
        cloudColor2: new THREE.Color(0.36, 0.38, 0.44),
        cloudShadow2: new THREE.Color(0.18, 0.20, 0.26),
        cloudOpacity1: 0.35,
        cloudOpacity2: 0.45,
      };

  if (layout !== 'embedded') {
    return config;
  }

  const nightBoost = config.isNight;
  return {
    ...config,
    nearCount: Math.round(config.nearCount * 1.2),
    nearSize: scaleSizeRange(config.nearSize, 2.35),
    midSize: scaleSizeRange(config.midSize, 2.15),
    farSize: scaleSizeRange(config.farSize, 2.05),
    nearOpacity: Math.min(1, config.nearOpacity + (nightBoost ? 0.2 : 0.06)),
    midOpacity: Math.min(1, config.midOpacity + (nightBoost ? 0.15 : 0.08)),
    farOpacity: Math.min(1, config.farOpacity + (nightBoost ? 0.12 : 0.07)),
  };
}

// Soft snowflake sprite texture — radial gradient with subtle crystalline sparkle
function createSnowflakeTexture(): THREE.Texture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2;

  // Soft radial core
  const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.15, 'rgba(255,255,255,0.95)');
  grad.addColorStop(0.4, 'rgba(240,245,255,0.55)');
  grad.addColorStop(0.7, 'rgba(220,230,255,0.18)');
  grad.addColorStop(1, 'rgba(200,215,255,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  // Very subtle 6-fold crystalline highlight — barely visible, adds sparkle
  ctx.save();
  ctx.translate(cx, cy);
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 6; i++) {
    ctx.rotate(Math.PI / 3);
    const armGrad = ctx.createLinearGradient(0, 0, 0, -r * 0.65);
    armGrad.addColorStop(0, 'rgba(255,255,255,0.18)');
    armGrad.addColorStop(0.5, 'rgba(255,255,255,0.06)');
    armGrad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = armGrad;
    ctx.fillRect(-0.8, 0, 1.6, -r * 0.65);
  }
  ctx.restore();

  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

// Bokeh-style blurred snowflake for out-of-focus depth layers
function createBokehSnowflakeTexture(): THREE.Texture {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2;

  const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  grad.addColorStop(0, 'rgba(255,255,255,0.8)');
  grad.addColorStop(0.3, 'rgba(245,248,255,0.45)');
  grad.addColorStop(0.6, 'rgba(230,238,255,0.15)');
  grad.addColorStop(1, 'rgba(210,220,240,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

interface FlakeData {
  x: number;
  y: number;
  z: number;
  initialX: number;
  initialY: number;
  size: number;
  speed: number;
  driftFreq: number;
  driftAmp: number;
  wobbleFreq: number;
  wobbleAmp: number;
  rotSpeed: number;
  phase: number;
}

function seededRandom(seed: number, offset: number): number {
  const x = Math.sin(seed * 12.9898 + offset * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

function generateFlakes(
  count: number,
  sizeRange: [number, number],
  zRange: [number, number],
  baseSeed: number,
): FlakeData[] {
  const flakes: FlakeData[] = [];
  for (let i = 0; i < count; i++) {
    const seed = baseSeed + i * 0.137;
    const r = (o: number) => seededRandom(seed, o);
    const x = (r(1) - 0.5) * 45;
    const y = (r(2) - 0.5) * 35 + 5;
    const z = zRange[0] + r(3) * (zRange[1] - zRange[0]);
    const size = sizeRange[0] + r(4) * (sizeRange[1] - sizeRange[0]);
    flakes.push({
      x, y, z,
      initialX: x,
      initialY: y,
      size,
      speed: 0.90 + r(5) * 1.2,
      driftFreq: 0.15 + r(6) * 0.35,
      driftAmp: 0.3 + r(7) * 0.8,
      wobbleFreq: 0.8 + r(8) * 1.5,
      wobbleAmp: 0.04 + r(9) * 0.08,
      rotSpeed: (r(10) - 0.5) * 0.6,
      phase: r(11) * Math.PI * 2,
    });
  }
  return flakes;
}

function SnowLayer({
  flakes,
  opacity,
  texture,
  isNight,
}: {
  flakes: FlakeData[];
  opacity: number;
  texture: THREE.Texture;
  isNight: boolean;
}) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useRef(new THREE.Object3D());
  const posRef = useRef<{ x: number; y: number }[]>([]);

  const count = flakes.length;

  useEffect(() => {
    posRef.current = flakes.map(f => ({ x: f.x, y: f.y }));
  }, [flakes]);

  const material = useMemo(() => {
    return new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      opacity,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      color: isNight ? 0x99aacc : 0xffffff,
    });
  }, [texture, opacity, isNight]);

  const geometry = useMemo(() => new THREE.PlaneGeometry(1, 1), []);

  useEffect(() => {
    if (!meshRef.current) return;
    meshRef.current.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    flakes.forEach((f, i) => {
      dummy.current.position.set(f.x, f.y, f.z);
      dummy.current.scale.setScalar(f.size);
      dummy.current.updateMatrix();
      meshRef.current!.setMatrixAt(i, dummy.current.matrix);
    });
    meshRef.current.instanceMatrix.needsUpdate = true;
  }, [flakes]);

  useFrame((state) => {
    if (!meshRef.current) return;
    const t = state.clock.elapsedTime;
    const positions = posRef.current;

    for (let i = 0; i < count; i++) {
      const f = flakes[i];
      let { y } = positions[i];

      y -= f.speed * 0.012;

      if (y < -18) {
        y = f.initialY + 36;
        positions[i].x = f.initialX;
      }

      const drift = Math.sin(t * f.driftFreq + f.phase) * f.driftAmp;
      const wobble = Math.sin(t * f.wobbleFreq + f.phase * 2.7) * f.wobbleAmp;
      const x = f.initialX + drift + wobble;

      positions[i].x = x;
      positions[i].y = y;

      dummy.current.position.set(x, y, f.z);
      dummy.current.scale.setScalar(f.size);
      dummy.current.rotation.z = t * f.rotSpeed + f.phase;
      dummy.current.updateMatrix();
      meshRef.current!.setMatrixAt(i, dummy.current.matrix);
    }

    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  return <instancedMesh ref={meshRef} args={[geometry, material, count]} />;
}

function SnowyScene({ config }: { config: SnowConfig }) {
  const sharpTex = useMemo(() => createSnowflakeTexture(), []);
  const bokehTex = useMemo(() => createBokehSnowflakeTexture(), []);

  const nearFlakes = useMemo(
    () => generateFlakes(config.nearCount, config.nearSize, [-2, 2], 0),
    [config.nearCount, config.nearSize],
  );
  const midFlakes = useMemo(
    () => generateFlakes(config.midCount, config.midSize, [-6, -2], 1000),
    [config.midCount, config.midSize],
  );
  const farFlakes = useMemo(
    () => generateFlakes(config.farCount, config.farSize, [-12, -6], 5000),
    [config.farCount, config.farSize],
  );

  useEffect(() => {
    return () => {
      sharpTex.dispose();
      bokehTex.dispose();
    };
  }, [sharpTex, bokehTex]);

  return (
    <>
      <ambientLight intensity={config.ambientIntensity} />
      <directionalLight
        position={[5, 10, 5]}
        intensity={config.mainLightIntensity}
        color={config.mainLightColor}
      />
      <directionalLight
        position={[0, -5, -5]}
        intensity={config.fillLightIntensity}
        color={config.fillLightColor}
      />

      <CloudLayer
        zDepth={-14}
        speed={0.02}
        scale={2.2}
        opacity={config.cloudOpacity1}
        coverage={0.44}
        softness={0.22}
        warpStrength={1.3}
        cloudColor={config.cloudColor1}
        shadowColor={config.cloudShadow1}
        windDir={[1.0, 0.08]}
        planeSize={[55, 32]}
        yOffset={2}
      />
      <CloudLayer
        zDepth={-10}
        speed={0.035}
        scale={1.5}
        opacity={config.cloudOpacity2}
        coverage={0.46}
        softness={0.18}
        warpStrength={0.9}
        cloudColor={config.cloudColor2}
        shadowColor={config.cloudShadow2}
        windDir={[1.0, 0.12]}
        planeSize={[52, 30]}
        yOffset={0}
      />

      {/* Far layer — small bokeh dots, lowest opacity */}
      <SnowLayer
        flakes={farFlakes}
        opacity={config.farOpacity}
        texture={bokehTex}
        isNight={config.isNight}
      />

      {/* Mid layer — medium bokeh dots */}
      <SnowLayer
        flakes={midFlakes}
        opacity={config.midOpacity}
        texture={bokehTex}
        isNight={config.isNight}
      />

      {/* Near layer — crisp snowflakes with crystalline detail */}
      <SnowLayer
        flakes={nearFlakes}
        opacity={config.nearOpacity}
        texture={sharpTex}
        isNight={config.isNight}
      />

      <fog attach="fog" args={[config.fogColor, config.fogNear, config.fogFar]} />
    </>
  );
}

interface SnowyWeatherBackgroundProps {
  className?: string;
  sunsetTime?: string;
  currentTime?: string;
  isDay?: number;
  layout?: 'fullscreen' | 'embedded';
}

export default function SnowyWeatherBackground({
  className = '',
  sunsetTime,
  currentTime,
  isDay = 1,
  layout = 'fullscreen',
}: SnowyWeatherBackgroundProps) {
  const isNight = isDay !== 1;
  const config = useMemo(() => getSnowConfig(isNight, layout), [isNight, layout]);

  const isSunset = Boolean(sunsetTime && currentTime &&
    (() => {
      try {
        const currentDate = new Date(currentTime.replace(' ', 'T'));
        const [timePart, period] = sunsetTime.split(' ');
        const [hours, minutes] = timePart.split(':').map(Number);
        let sunsetHours = hours;
        if (period === 'PM' && hours !== 12) sunsetHours = hours + 12;
        else if (period === 'AM' && hours === 12) sunsetHours = 0;
        const sunsetDate = new Date(currentDate);
        sunsetDate.setHours(sunsetHours, minutes, 0, 0);
        const oneHourBefore = new Date(sunsetDate.getTime() - 60 * 60 * 1000);
        const oneHourAfter = new Date(sunsetDate.getTime() + 60 * 60 * 1000);
        return currentDate >= oneHourBefore && currentDate <= oneHourAfter;
      } catch {
        return false;
      }
    })());

  const bgGradient = isNight
    ? 'linear-gradient(to bottom, rgb(16, 20, 30) 0%, rgb(22, 28, 38) 40%, rgb(18, 22, 32) 100%)'
    : isSunset
      ? 'linear-gradient(to bottom, rgb(55, 60, 72) 0%, rgb(65, 70, 82) 30%, rgb(75, 80, 90) 60%, rgb(80, 85, 95) 100%)'
      : 'linear-gradient(to bottom, rgb(70, 78, 88) 0%, rgb(82, 88, 98) 50%, rgb(68, 74, 82) 100%)';

  return (
    <div data-weather-bg className={`${layout === 'embedded' ? 'absolute inset-0 z-0 rounded-2xl pointer-events-none overflow-hidden' : 'fixed inset-0 z-0'} ${className}`}>
      <div className="absolute inset-0" style={{ background: bgGradient }} />

      <Canvas
        camera={
          layout === 'embedded'
            ? { position: [0, 0, 8.2], fov: 72 }
            : { position: [0, 0, 10], fov: 75 }
        }
        style={{ width: '100%', height: '100%' }}
        gl={{
          alpha: true,
          antialias: false,
          preserveDrawingBuffer: true,
          powerPreference: 'high-performance',
          stencil: false,
          depth: true,
        }}
        dpr={layout === 'embedded' ? [1.5, 2] : [1, 2]}
        performance={{ min: 0.5 }}
        frameloop="always"
      >
        <SnowyScene config={config} />
      </Canvas>
    </div>
  );
}
