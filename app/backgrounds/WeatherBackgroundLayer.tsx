'use client';

import dynamic from 'next/dynamic';
import type { WeatherResponse } from '@/app/types/weather';
import { getConditionFlags, getBackgroundProps } from '@/app/utils/weatherBackgroundMapping';

const CloudyWeatherBackground = dynamic(() => import('./CloudyWeatherBackground'), { ssr: false });
const SunnyWeatherBackground = dynamic(() => import('./SunnyWeatherBackground'), { ssr: false });
const SnowyWeatherBackground = dynamic(() => import('./SnowyWeatherBackground'), { ssr: false });
const RainyWeatherBackground = dynamic(() => import('./RainyWeatherBackground'), { ssr: false });
const FoggyWeatherBackground = dynamic(() => import('./FoggyWeatherBackground'), { ssr: false });

interface WeatherBackgroundLayerProps {
  weather: WeatherResponse | null;
  layout?: 'fullscreen' | 'embedded';
  show?: boolean;
}

export default function WeatherBackgroundLayer({
  weather,
  layout = 'fullscreen',
  show = true,
}: WeatherBackgroundLayerProps) {
  if (!show || !weather) {
    return (
      <div
        className={`${layout === 'embedded' ? 'absolute inset-0 z-0 rounded-2xl overflow-hidden' : 'fixed inset-0 z-0'} bg-gradient-to-br from-sky-50 via-blue-50 to-indigo-50`}
      />
    );
  }

  const flags = getConditionFlags(weather);
  const props = getBackgroundProps(weather);

  if (flags.isSnowy) {
    return <SnowyWeatherBackground layout={layout} sunsetTime={props.sunsetTime} currentTime={props.currentTime} />;
  }
  if (flags.isRainy) {
    return <RainyWeatherBackground layout={layout} sunsetTime={props.sunsetTime} currentTime={props.currentTime} precipMm={props.precipMm} isDay={props.isDay} />;
  }
  if (flags.isSunny) {
    return <SunnyWeatherBackground layout={layout} sunsetTime={props.sunsetTime} sunriseTime={props.sunriseTime} currentTime={props.currentTime} isDay={props.isDay} moonPhase={props.moonPhase} moonIllumination={props.moonIllumination} />;
  }
  if (flags.isFoggy) {
    return <FoggyWeatherBackground layout={layout} sunsetTime={props.sunsetTime} sunriseTime={props.sunriseTime} currentTime={props.currentTime} isDay={props.isDay} />;
  }
  if (flags.isOvercast) {
    return <CloudyWeatherBackground layout={layout} sunsetTime={props.sunsetTime} currentTime={props.currentTime} />;
  }
  if (flags.isPartlyCloudy) {
    return <CloudyWeatherBackground layout={layout} mode="partly-cloudy" cloudAmount={props.cloudAmount} isDay={props.isDay} sunsetTime={props.sunsetTime} sunriseTime={props.sunriseTime} currentTime={props.currentTime} moonPhase={props.moonPhase} moonIllumination={props.moonIllumination} />;
  }

  return (
    <div
      className={`${layout === 'embedded' ? 'absolute inset-0 z-0 rounded-2xl overflow-hidden' : 'fixed inset-0 z-0'} bg-gradient-to-br from-sky-50 via-blue-50 to-indigo-50`}
    />
  );
}
