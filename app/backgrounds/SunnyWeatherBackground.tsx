'use client';

import { startTransition, useEffect, useMemo, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import * as THREE from 'three';
import NightSkyEffects from './NightSky';
import SunEffect from './SunEffect';
import MoonEffect from './MoonEffect';
import { getDaytimeProgress, getLiveLocalDate, getTimeState, type TimeState } from '../utils/solarTime';

const DAY_SUN_COLOR = new THREE.Color(1.0, 0.96, 0.82);
const SUNRISE_SUN_COLOR = new THREE.Color(1.0, 0.82, 0.72);
const SUNSET_SUN_COLOR = new THREE.Color(1.0, 0.72, 0.42);
const CLOCK_TICK_MS = 1000;

function SunnyWeatherScene({
  timeState,
  dayProgress,
}: {
  timeState: TimeState;
  dayProgress?: number;
}) {
  const isSunrise = timeState === 'sunrise';
  const isSunset = timeState === 'sunset';

  return (
    <SunEffect
      sunPos={isSunrise ? [0.15, 0.38] : isSunset ? [0.85, 0.38] : undefined}
      dayProgress={isSunrise || isSunset ? undefined : dayProgress}
      sunColor={isSunrise ? SUNRISE_SUN_COLOR : isSunset ? SUNSET_SUN_COLOR : DAY_SUN_COLOR}
      intensity={isSunrise ? 0.92 : isSunset ? 0.85 : 1.0}
      variant={isSunrise ? 'sunrise' : isSunset ? 'sunset' : 'day'}
    />
  );
}

function NightScene({
  moonPhase,
  moonIllumination,
  layout,
}: {
  moonPhase?: string;
  moonIllumination?: number;
  layout: 'fullscreen' | 'embedded';
}) {
  return (
    <>
      <ambientLight intensity={0.1} />
      <directionalLight position={[5, 10, 5]} intensity={0.2} color={0x8888aa} />
      <MoonEffect moonPhase={moonPhase} moonIllumination={moonIllumination} zDepth={-17} />
      <NightSkyEffects layout={layout} />
      <fog attach="fog" args={[0x0a0a1a, 10, 30]} />
    </>
  );
}

interface SunnyWeatherBackgroundProps {
  className?: string;
  sunsetTime?: string;
  sunriseTime?: string;
  currentTime?: string;
  currentTimeEpoch?: number;
  isDay?: number;
  moonPhase?: string;
  moonIllumination?: number;
  layout?: 'fullscreen' | 'embedded';
}

export default function SunnyWeatherBackground({
  className = '',
  sunsetTime,
  sunriseTime,
  currentTime,
  currentTimeEpoch,
  isDay,
  moonPhase,
  moonIllumination,
  layout = 'fullscreen',
}: SunnyWeatherBackgroundProps) {
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const timerId = window.setInterval(() => {
      startTransition(() => {
        setNowMs(Date.now());
      });
    }, CLOCK_TICK_MS);

    return () => window.clearInterval(timerId);
  }, []);

  const fallbackSnapshotAtMs = useMemo(() => Date.now(), [currentTime, currentTimeEpoch]);

  const liveLocalTime = useMemo(
    () => getLiveLocalDate(currentTime, currentTimeEpoch, nowMs, fallbackSnapshotAtMs),
    [currentTime, currentTimeEpoch, nowMs, fallbackSnapshotAtMs],
  );

  const daytimeSunProgress = useMemo(
    () => getDaytimeProgress(liveLocalTime, sunriseTime, sunsetTime),
    [liveLocalTime, sunriseTime, sunsetTime],
  );

  const timeState = useMemo<TimeState>(() => {
    return getTimeState(isDay, sunsetTime, sunriseTime, liveLocalTime);
  }, [isDay, sunsetTime, sunriseTime, liveLocalTime]);

  return (
    <div data-weather-bg className={`${layout === 'embedded' ? 'absolute inset-0 z-0 rounded-2xl pointer-events-none overflow-hidden' : 'fixed inset-0 z-0'} ${className}`} aria-hidden>
      {timeState === 'sunset' ? (
        <div
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(to bottom,rgb(69, 89, 142) 0%,rgb(95, 114, 177) 10%,rgb(108, 160, 244) 40%,rgb(196, 174, 247) 60%,rgb(242, 194, 159) 85%,rgb(234, 163, 124) 100%)',
          }}
        />
      ) : timeState === 'sunrise' ? (
        <div
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(to bottom,rgb(111, 160, 205) 0%,rgb(142, 193, 225) 22%,rgb(234, 206, 200) 58%,rgb(248, 193, 160) 82%,rgb(245, 182, 138) 100%)',
          }}
        />
      ) : timeState === 'night' ? (
        <div
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(to bottom, rgb(10, 20, 52) 0%, rgb(8, 16, 44) 25%, rgb(5, 12, 36) 50%, rgb(3, 8, 28) 75%, rgb(1, 5, 22) 100%)',
          }}
        />
      ) : (
        <div
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(to bottom,rgb(120, 193, 226) 0%, rgb(63, 180, 227) 40%, rgb(3, 140, 194) 100%)',
          }}
        />
      )}

      <Canvas
        camera={{ position: [0, 0, 10], fov: 75 }}
        style={{ width: '100%', height: '100%' }}
        gl={{
          alpha: true,
          antialias: true,
          preserveDrawingBuffer: true,
          powerPreference: 'high-performance',
          stencil: false,
        }}
        dpr={[1, 2]}
        performance={{ min: 0.5 }}
      >
        {timeState === 'night' ? (
          <NightScene moonPhase={moonPhase} moonIllumination={moonIllumination} layout={layout} />
        ) : (
          <SunnyWeatherScene timeState={timeState} dayProgress={daytimeSunProgress} />
        )}
      </Canvas>
    </div>
  );
}
