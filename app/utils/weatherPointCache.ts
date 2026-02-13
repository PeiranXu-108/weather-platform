import type { Hour, WeatherResponse } from '@/app/types/weather';
import { fetchWeatherByCoords } from '@/app/lib/api';

interface CacheEntry {
  data: WeatherResponse | null;
  timestamp: number;
}

const cache = new Map<string, CacheEntry>();
const inFlight = new Map<string, Promise<WeatherResponse | null>>();
const CACHE_TTL = 2 * 60 * 1000;

function buildKey(lat: number, lon: number): string {
  return `${lat.toFixed(4)}_${lon.toFixed(4)}`;
}

export async function fetchWeatherPoint(
  lat: number,
  lon: number,
  signal?: AbortSignal
): Promise<WeatherResponse | null> {
  const key = buildKey(lat, lon);
  const now = Date.now();
  const cached = cache.get(key);
  if (cached && now - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  const existing = inFlight.get(key);
  if (existing) {
    return existing;
  }

  const request = fetchWeatherByCoords(lat, lon, { signal })
    .then((response) => {
      if (!response.ok) return null;
      return response.json() as Promise<WeatherResponse>;
    })
    .catch(() => null)
    .then((data) => {
      cache.set(key, { data, timestamp: Date.now() });
      inFlight.delete(key);
      return data;
    });

  inFlight.set(key, request);
  return request;
}

export function getForecastHourByEpoch(
  data: WeatherResponse | null | undefined,
  targetEpoch?: number
): Hour | null {
  if (!data || typeof targetEpoch !== 'number') {
    return null;
  }

  const days = data.forecast?.forecastday;
  if (!Array.isArray(days) || days.length === 0) {
    return null;
  }

  let nearestHour: Hour | null = null;
  let nearestDiff = Number.POSITIVE_INFINITY;

  for (const day of days) {
    if (!Array.isArray(day.hour)) {
      continue;
    }
    for (const hour of day.hour) {
      const diff = Math.abs(hour.time_epoch - targetEpoch);
      if (diff < nearestDiff) {
        nearestDiff = diff;
        nearestHour = hour;
      }
    }
  }

  return nearestHour;
}

export function clearWeatherPointCache(): void {
  cache.clear();
  inFlight.clear();
}
