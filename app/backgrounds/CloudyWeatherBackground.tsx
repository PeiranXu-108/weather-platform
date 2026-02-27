'use client';

import { useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import * as THREE from 'three';
import CloudLayer from './CloudLayer';
import type { CloudLayerProps } from './CloudLayer';
import NightSkyEffects from './NightSky';
import SunEffect from './SunEffect';
import MoonEffect from './MoonEffect';

// ---------------------------------------------------------------------------
// Overcast layer presets (grey sky, full dense coverage)
// ---------------------------------------------------------------------------
type LayerConfig = Omit<CloudLayerProps, 'cloudColor' | 'shadowColor'> & {
  cloudColor: THREE.Color;
  shadowColor: THREE.Color;
};

const OVERCAST_LAYERS_DAY: LayerConfig[] = [
  { zDepth: -10, speed: 0.05, scale: 2.5, opacity: 0.70, coverage: 0.42, softness: 0.18, warpStrength: 1.6, cloudColor: new THREE.Color(0.78, 0.80, 0.84), shadowColor: new THREE.Color(0.42, 0.44, 0.50), windDir: [1.0, 0.12], planeSize: [55, 32], yOffset: 1 },
  { zDepth: -5, speed: 0.07, scale: 1.8, opacity: 0.80, coverage: 0.45, softness: 0.15, warpStrength: 1.3, cloudColor: new THREE.Color(0.68, 0.70, 0.74), shadowColor: new THREE.Color(0.34, 0.36, 0.42), windDir: [1.0, 0.20], planeSize: [52, 30], yOffset: 0 },
  { zDepth: -2, speed: 0.10, scale: 1.3, opacity: 0.85, coverage: 0.48, softness: 0.14, warpStrength: 1.0, cloudColor: new THREE.Color(0.55, 0.57, 0.62), shadowColor: new THREE.Color(0.25, 0.27, 0.32), windDir: [1.0, 0.08], planeSize: [55, 30], yOffset: -1 },
  { zDepth: -0.5, speed: 0.14, scale: 2.0, opacity: 0.50, coverage: 0.52, softness: 0.16, warpStrength: 0.7, cloudColor: new THREE.Color(0.48, 0.50, 0.55), shadowColor: new THREE.Color(0.22, 0.24, 0.30), windDir: [1.0, 0.15], planeSize: [58, 28], yOffset: -2 },
];

const OVERCAST_LAYERS_SUNSET: LayerConfig[] = [
  { zDepth: -10, speed: 0.05, scale: 2.5, opacity: 0.65, coverage: 0.42, softness: 0.18, warpStrength: 1.6, cloudColor: new THREE.Color(0.62, 0.56, 0.58), shadowColor: new THREE.Color(0.32, 0.28, 0.32), windDir: [1.0, 0.12], planeSize: [55, 32], yOffset: 1 },
  { zDepth: -5, speed: 0.07, scale: 1.8, opacity: 0.75, coverage: 0.45, softness: 0.15, warpStrength: 1.3, cloudColor: new THREE.Color(0.55, 0.48, 0.52), shadowColor: new THREE.Color(0.28, 0.24, 0.28), windDir: [1.0, 0.20], planeSize: [52, 30], yOffset: 0 },
  { zDepth: -2, speed: 0.10, scale: 1.3, opacity: 0.80, coverage: 0.48, softness: 0.14, warpStrength: 1.0, cloudColor: new THREE.Color(0.48, 0.42, 0.46), shadowColor: new THREE.Color(0.22, 0.18, 0.22), windDir: [1.0, 0.08], planeSize: [55, 30], yOffset: -1 },
  { zDepth: -0.5, speed: 0.14, scale: 2.0, opacity: 0.45, coverage: 0.52, softness: 0.16, warpStrength: 0.7, cloudColor: new THREE.Color(0.42, 0.36, 0.40), shadowColor: new THREE.Color(0.20, 0.16, 0.20), windDir: [1.0, 0.15], planeSize: [58, 28], yOffset: -2 },
];

// ---------------------------------------------------------------------------
// Partly-cloudy base layer templates (before cloudAmount scaling)
// ---------------------------------------------------------------------------
const PARTLY_CLOUDY_BASE: Array<Omit<LayerConfig, 'cloudColor' | 'shadowColor'>> = [
  { zDepth: -10, speed: 0.04, scale: 2.2, opacity: 0.75, coverage: 0.48, softness: 0.18, warpStrength: 1.5, windDir: [1.0, 0.10], planeSize: [55, 32], yOffset: 2 },
  { zDepth: -5, speed: 0.06, scale: 1.6, opacity: 0.82, coverage: 0.50, softness: 0.15, warpStrength: 1.2, windDir: [1.0, 0.18], planeSize: [52, 30], yOffset: 0 },
  { zDepth: -2, speed: 0.09, scale: 1.2, opacity: 0.88, coverage: 0.52, softness: 0.14, warpStrength: 0.9, windDir: [1.0, 0.06], planeSize: [55, 30], yOffset: -1 },
  { zDepth: -0.5, speed: 0.12, scale: 1.8, opacity: 0.55, coverage: 0.55, softness: 0.15, warpStrength: 0.6, windDir: [1.0, 0.12], planeSize: [58, 28], yOffset: -2 },
];

const CLOUD_COLORS = {
  day:    { cloud: new THREE.Color(0.92, 0.93, 0.96), shadow: new THREE.Color(0.62, 0.65, 0.72) },
  sunset: { cloud: new THREE.Color(0.82, 0.68, 0.60), shadow: new THREE.Color(0.45, 0.35, 0.35) },
  night:  { cloud: new THREE.Color(0.22, 0.24, 0.30), shadow: new THREE.Color(0.08, 0.10, 0.14) },
};

function buildPartlyCloudyLayers(
  cloudAmount: number,
  timeState: 'day' | 'sunset' | 'night',
): LayerConfig[] {
  const t = Math.max(0, Math.min(100, cloudAmount)) / 100;
  const layerCount = Math.max(1, Math.min(4, Math.ceil(t * 4)));
  const colors = CLOUD_COLORS[timeState];

  return PARTLY_CLOUDY_BASE.slice(0, layerCount).map((base) => ({
    ...base,
    opacity: base.opacity * t,
    coverage: base.coverage + (1 - t) * 0.15,
    cloudColor: colors.cloud,
    shadowColor: colors.shadow,
  }));
}

const PC_DAY_SUN    = new THREE.Color(1.0, 0.96, 0.82);
const PC_SUNSET_SUN = new THREE.Color(1.0, 0.72, 0.42);

// ---------------------------------------------------------------------------
// CloudyScene – compose multiple cloud layers + sky effects
// ---------------------------------------------------------------------------
function CloudyScene({
  timeState,
  cloudAmount,
  isPartlyCloudy,
  moonPhase,
  moonIllumination,
}: {
  timeState: 'day' | 'sunset' | 'night';
  cloudAmount: number;
  isPartlyCloudy: boolean;
  moonPhase?: string;
  moonIllumination?: number;
}) {
  const layers = useMemo(() => {
    if (isPartlyCloudy) {
      return buildPartlyCloudyLayers(cloudAmount, timeState);
    }
    return timeState === 'sunset' ? OVERCAST_LAYERS_SUNSET : OVERCAST_LAYERS_DAY;
  }, [timeState, cloudAmount, isPartlyCloudy]);

  const showNightSky = isPartlyCloudy && timeState === 'night';
  const showSun      = isPartlyCloudy && timeState !== 'night';

  return (
    <>
      {showNightSky && (
        <>
          <ambientLight intensity={0.1} />
          <directionalLight position={[5, 10, 5]} intensity={0.2} color={0x8888aa} />
          <MoonEffect moonPhase={moonPhase} moonIllumination={moonIllumination} />
          <NightSkyEffects />
        </>
      )}
      {showSun && (
        <SunEffect
          sunPos={timeState === 'sunset' ? [0.15, 0.38] : [0.20, 0.94]}
          sunColor={timeState === 'sunset' ? PC_SUNSET_SUN : PC_DAY_SUN}
          intensity={timeState === 'sunset' ? 0.75 : 0.90}
          zDepth={-14}
        />
      )}
      {layers.map((cfg, i) => (
        <CloudLayer key={i} {...cfg} />
      ))}
    </>
  );
}

// ---------------------------------------------------------------------------
// Time-of-day helper
// ---------------------------------------------------------------------------
function computeTimeState(
  isDay: number | undefined,
  sunsetTime: string | undefined,
  sunriseTime: string | undefined,
  currentTime: string | undefined,
): 'day' | 'sunset' | 'night' {
  if (isDay === 0) {
    if (sunriseTime && currentTime) {
      try {
        const cur = new Date(currentTime.replace(' ', 'T'));
        const [tp, per] = sunriseTime.split(' ');
        const [h, m] = tp.split(':').map(Number);
        let h24 = h;
        if (per === 'PM' && h !== 12) h24 = h + 12;
        else if (per === 'AM' && h === 12) h24 = 0;
        const sr = new Date(cur);
        sr.setHours(h24, m, 0, 0);
        if (cur >= new Date(sr.getTime() - 3600000) && cur <= new Date(sr.getTime() + 3600000)) {
          return 'day';
        }
      } catch { /* fall through */ }
    }
    return 'night';
  }
  if (sunsetTime && currentTime) {
    try {
      const cur = new Date(currentTime.replace(' ', 'T'));
      const [tp, per] = sunsetTime.split(' ');
      const [h, m] = tp.split(':').map(Number);
      let h24 = h;
      if (per === 'PM' && h !== 12) h24 = h + 12;
      else if (per === 'AM' && h === 12) h24 = 0;
      const ss = new Date(cur);
      ss.setHours(h24, m, 0, 0);
      if (cur >= new Date(ss.getTime() - 3600000) && cur <= new Date(ss.getTime() + 3600000)) {
        return 'sunset';
      }
    } catch { /* fall through */ }
  }
  return 'day';
}

// ---------------------------------------------------------------------------
// Background gradients
// ---------------------------------------------------------------------------
const GRADIENTS = {
  overcast: {
    day: 'linear-gradient(to bottom, rgb(88, 96, 112) 0%, rgb(110, 118, 132) 20%, rgb(135, 142, 155) 45%, rgb(155, 158, 163) 65%, rgb(140, 144, 150) 85%, rgb(115, 120, 128) 100%)',
    sunset: 'linear-gradient(to bottom, rgb(62, 68, 82) 0%, rgb(82, 88, 108) 15%, rgb(100, 100, 125) 35%, rgb(120, 112, 118) 55%, rgb(138, 118, 110) 75%, rgb(120, 105, 95) 100%)',
    night: 'linear-gradient(to bottom, rgb(88, 96, 112) 0%, rgb(110, 118, 132) 20%, rgb(135, 142, 155) 45%, rgb(155, 158, 163) 65%, rgb(140, 144, 150) 85%, rgb(115, 120, 128) 100%)',
  },
  partlyCloudy: {
    day: 'linear-gradient(to bottom, rgb(120, 193, 226) 0%, rgb(63, 180, 227) 40%, rgb(3, 140, 194) 100%)',
    sunset: 'linear-gradient(to bottom, rgb(69, 89, 142) 0%, rgb(95, 114, 177) 10%, rgb(108, 160, 244) 40%, rgb(196, 174, 247) 60%, rgb(242, 194, 159) 85%, rgb(234, 163, 124) 100%)',
    night: 'linear-gradient(to bottom, rgb(10, 15, 30) 0%, rgb(5, 10, 25) 30%, rgb(0, 5, 20) 60%, rgb(0, 0, 15) 100%)',
  },
};

// ---------------------------------------------------------------------------
// Exported component
// ---------------------------------------------------------------------------
interface CloudyWeatherBackgroundProps {
  className?: string;
  sunsetTime?: string;
  sunriseTime?: string;
  currentTime?: string;
  mode?: 'overcast' | 'partly-cloudy';
  cloudAmount?: number;
  isDay?: number;
  moonPhase?: string;
  moonIllumination?: number;
}

export default function CloudyWeatherBackground({
  className = '',
  sunsetTime,
  sunriseTime,
  currentTime,
  mode = 'overcast',
  cloudAmount = 100,
  isDay,
  moonPhase,
  moonIllumination,
}: CloudyWeatherBackgroundProps) {
  const timeState = useMemo(
    () => computeTimeState(isDay, sunsetTime, sunriseTime, currentTime),
    [isDay, sunsetTime, sunriseTime, currentTime],
  );

  const isPartlyCloudy = mode === 'partly-cloudy';
  const gradientSet = isPartlyCloudy ? GRADIENTS.partlyCloudy : GRADIENTS.overcast;
  const bgGradient = gradientSet[timeState];

  return (
    <div data-weather-bg className={`fixed inset-0 -z-10 ${className}`}>
      <div className="absolute inset-0" style={{ background: bgGradient }} />

      <Canvas
        camera={{ position: [0, 0, 10], fov: 75 }}
        style={{ width: '100%', height: '100%' }}
        gl={{ alpha: true, antialias: false }}
        dpr={[1, 1]}
        performance={{ min: 0.5 }}
      >
        <CloudyScene
          timeState={timeState}
          cloudAmount={cloudAmount}
          isPartlyCloudy={isPartlyCloudy}
          moonPhase={moonPhase}
          moonIllumination={moonIllumination}
        />
      </Canvas>
    </div>
  );
}
