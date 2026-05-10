import type { WeatherResponse } from '@/app/types/weather';

export type FavoriteCity = {
  query: string; // city name or "lat,lon"
  label?: string; // cached display label
};

export type CachedFavoriteWeather = {
  fetchedAt: number; // ms
  data: WeatherResponse;
};

export const FAVORITES_STORAGE_KEY = 'wp:favorites:v1';
const FAVORITE_WEATHER_CACHE_STORAGE_KEY = 'wp:favorites:weather:v1';
export const FAVORITE_WEATHER_CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes

function safeParseJson<T>(value: string | null): T | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

export function loadFavoritesFromStorage(): FavoriteCity[] {
  if (typeof window === 'undefined') return [];
  const parsed = safeParseJson<FavoriteCity[]>(localStorage.getItem(FAVORITES_STORAGE_KEY));
  return Array.isArray(parsed) ? parsed.filter((favorite) => !!favorite?.query) : [];
}

export function saveFavoritesToStorage(favorites: FavoriteCity[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(favorites));
}

export function clearFavoritesStorage() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(FAVORITES_STORAGE_KEY);
}

export function loadFavoriteWeatherCache(): Record<string, CachedFavoriteWeather> {
  if (typeof window === 'undefined') return {};
  const parsed = safeParseJson<Record<string, CachedFavoriteWeather>>(
    localStorage.getItem(FAVORITE_WEATHER_CACHE_STORAGE_KEY),
  );
  return parsed && typeof parsed === 'object' ? parsed : {};
}

export function saveFavoriteWeatherCache(cache: Record<string, CachedFavoriteWeather>) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(FAVORITE_WEATHER_CACHE_STORAGE_KEY, JSON.stringify(cache));
}
