import type { WeatherResponse } from '@/app/types/weather';
import { translateWeatherCondition } from '@/app/utils/weatherTranslations';

export interface ConditionFlags {
  weatherCondition: string;
  isSnowy: boolean;
  isRainy: boolean;
  isSunny: boolean;
  isFoggy: boolean;
  isOvercast: boolean;
  isPartlyCloudy: boolean;
}

export interface SolarFlags {
  isSunset: boolean;
  isNight: boolean;
}

export interface WeatherBackgroundProps {
  sunsetTime?: string;
  sunriseTime?: string;
  currentTime?: string;
  currentTimeEpoch?: number;
  isDay?: number;
  moonPhase?: string;
  moonIllumination?: number;
  precipMm?: number;
  cloudAmount?: number;
}

/**
 * Derive the six mutually-exclusive condition booleans from a WeatherResponse.
 * Priority order mirrors page.tsx: snowy/rainy/sunny/foggy checked first,
 * then overcast (!foggy), then partly-cloudy (!foggy && !overcast).
 */
export function getConditionFlags(weather: WeatherResponse): ConditionFlags {
  const weatherCondition = translateWeatherCondition(weather.current.condition);
  const isSnowy = weatherCondition.includes('雪');
  const isRainy = weatherCondition.includes('雨') || weatherCondition.includes('雷');
  const isSunny = weatherCondition.includes('晴');
  const isFoggy = weatherCondition.includes('雾');
  const isOvercast = !isFoggy && weatherCondition.includes('阴');
  const isPartlyCloudy = !isFoggy && !isOvercast && weatherCondition.includes('云');
  return { weatherCondition, isSnowy, isRainy, isSunny, isFoggy, isOvercast, isPartlyCloudy };
}

function parseTimeHour(timeStr: string): { hours24: number; minutes: number } | null {
  try {
    const [timePart, period] = timeStr.split(' ');
    const [hours, minutes] = timePart.split(':').map(Number);
    let hours24 = hours;
    if (period === 'PM' && hours !== 12) hours24 = hours + 12;
    else if (period === 'AM' && hours === 12) hours24 = 0;
    return { hours24, minutes };
  } catch {
    return null;
  }
}

function isWithinOneHour(currentTime: string, targetTimeStr: string): boolean {
  try {
    const currentDate = new Date(currentTime.replace(' ', 'T'));
    const parsed = parseTimeHour(targetTimeStr);
    if (!parsed) return false;
    const targetDate = new Date(currentDate);
    targetDate.setHours(parsed.hours24, parsed.minutes, 0, 0);
    const oneHourBefore = new Date(targetDate.getTime() - 60 * 60 * 1000);
    const oneHourAfter = new Date(targetDate.getTime() + 60 * 60 * 1000);
    return currentDate >= oneHourBefore && currentDate <= oneHourAfter;
  } catch {
    return false;
  }
}

/**
 * Derive isSunset / isNight from a WeatherResponse.
 * Logic matches the IIFE in page.tsx exactly.
 */
export function getSolarFlags(weather: WeatherResponse): SolarFlags {
  const todayForecast = weather.forecast.forecastday[0];
  const sunsetTime = todayForecast?.astro?.sunset;
  const sunriseTime = todayForecast?.astro?.sunrise;
  const currentTime = weather.location.localtime;
  const isDay = weather.current.is_day === 1;

  if (!isDay) {
    if (sunriseTime && currentTime && isWithinOneHour(currentTime, sunriseTime)) {
      return { isSunset: false, isNight: false };
    }
    return { isSunset: false, isNight: true };
  }

  if (!sunsetTime || !currentTime) return { isSunset: false, isNight: false };
  return { isSunset: isWithinOneHour(currentTime, sunsetTime), isNight: false };
}

/**
 * Collect props needed by the various background components from a WeatherResponse.
 */
export function getBackgroundProps(weather: WeatherResponse): WeatherBackgroundProps {
  const today = weather.forecast.forecastday[0];
  return {
    sunsetTime: today?.astro?.sunset,
    sunriseTime: today?.astro?.sunrise,
    currentTime: weather.location.localtime,
    currentTimeEpoch: weather.location.localtime_epoch,
    isDay: weather.current.is_day,
    moonPhase: today?.astro?.moon_phase,
    moonIllumination: today?.astro?.moon_illumination,
    precipMm: weather.current.precip_mm,
    cloudAmount: weather.current.cloud,
  };
}
