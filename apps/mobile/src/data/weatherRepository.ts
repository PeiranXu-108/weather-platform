import { apiFetch, apiJson } from '@/data/apiClient';
import type { QWeather30DayResponse, WeatherResponse } from '@shared/weather/types';

export function weatherUrl(query: string): string {
  if (query.includes(',')) {
    const [lat, lon] = query.split(',');
    return `/api/weather?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}`;
  }
  return `/api/weather?city=${encodeURIComponent(query)}`;
}

export async function fetchWeatherByCity(city: string): Promise<WeatherResponse> {
  return apiJson<WeatherResponse>(`/api/weather?city=${encodeURIComponent(city)}`);
}

export async function fetchWeatherByCoords(lat: number, lon: number): Promise<WeatherResponse> {
  return apiJson<WeatherResponse>(`/api/weather?lat=${lat}&lon=${lon}`);
}

export async function fetchWeatherByQuery(query: string): Promise<WeatherResponse> {
  return apiJson<WeatherResponse>(weatherUrl(query));
}

export async function fetchWeather30d(location: string): Promise<QWeather30DayResponse> {
  return apiJson<QWeather30DayResponse>(`/api/weather/30d?location=${encodeURIComponent(location)}`);
}

export async function prefetchWeather(query: string) {
  await apiFetch(weatherUrl(query));
}
