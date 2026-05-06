'use client';

import { useCallback, useEffect, useState } from 'react';
import { fetchWeatherByCity, fetchWeatherByCoords } from '@/app/lib/api';
import type { WeatherResponse } from '@/app/types/weather';
import { translateLocation } from '@/app/utils/locationTranslations';

const CURRENT_CITY_KEY = 'wp:currentCity:v1';

function loadCurrentCityFromStorage(): { city: string; query: string } | null {
  if (typeof window === 'undefined') return null;
  try {
    const stored = localStorage.getItem(CURRENT_CITY_KEY);
    if (!stored) return null;

    const parsed = JSON.parse(stored);
    if (parsed && typeof parsed === 'object' && parsed.query) {
      return { city: parsed.city || '杭州', query: parsed.query };
    }
  } catch {
    // Ignore invalid persisted state.
  }
  return null;
}

function saveCurrentCityToStorage(city: string, query: string) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(CURRENT_CITY_KEY, JSON.stringify({ city, query }));
  } catch {
    // Ignore storage quota/privacy mode failures.
  }
}

export function useHomeWeather() {
  const [weatherData, setWeatherData] = useState<WeatherResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentCity, setCurrentCity] = useState('杭州');
  const [currentCityQuery, setCurrentCityQuery] = useState('hangzhou');
  const [isLocating, setIsLocating] = useState(false);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const fetchWeatherData = useCallback(async (city: string = 'hangzhou') => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetchWeatherByCity(city);

      if (!response.ok) {
        throw new Error('Failed to fetch weather data');
      }

      const data: WeatherResponse = await response.json();
      const translated = translateLocation(data.location);

      setWeatherData(data);
      setCurrentCity(translated.name);
      setCurrentCityQuery(city);
      saveCurrentCityToStorage(translated.name, city);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      console.error('Error fetching weather data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchWeatherByLocation = useCallback(async (
    lat: number,
    lon: number,
    skipLocating: boolean = false
  ) => {
    try {
      setLoading(true);
      setError(null);
      if (!skipLocating) {
        setIsLocating(true);
      }

      const response = await fetchWeatherByCoords(lat, lon);

      if (!response.ok) {
        throw new Error('Failed to fetch weather data');
      }

      const data: WeatherResponse = await response.json();
      const translated = translateLocation(data.location);
      const query = `${lat},${lon}`;

      setWeatherData(data);
      setCurrentCity(translated.name);
      setCurrentCityQuery(query);
      saveCurrentCityToStorage(translated.name, query);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      console.error('Error fetching weather data:', err);
    } finally {
      setLoading(false);
      if (!skipLocating) {
        setIsLocating(false);
      }
    }
  }, []);

  useEffect(() => {
    const savedCity = loadCurrentCityFromStorage();
    if (savedCity) {
      setCurrentCity(savedCity.city);
      setCurrentCityQuery(savedCity.query);
      if (savedCity.query.includes(',')) {
        const [lat, lon] = savedCity.query.split(',');
        void fetchWeatherByLocation(parseFloat(lat), parseFloat(lon), true);
      } else {
        void fetchWeatherData(savedCity.query);
      }
      return;
    }

    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      setIsLocating(true);
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude, longitude } = pos.coords;
          void fetchWeatherByLocation(latitude, longitude, true);
          setIsLocating(false);
        },
        () => {
          setIsLocating(false);
          void fetchWeatherData();
        },
        { enableHighAccuracy: false, timeout: 20000, maximumAge: 30 * 60 * 1000 }
      );
      return;
    }

    void fetchWeatherData();
  }, [fetchWeatherByLocation, fetchWeatherData]);

  useEffect(() => {
    if (!currentCityQuery) return;

    const interval = setInterval(() => {
      if (currentCityQuery.includes(',')) {
        const [lat, lon] = currentCityQuery.split(',');
        void fetchWeatherByLocation(parseFloat(lat), parseFloat(lon));
        return;
      }
      void fetchWeatherData(currentCityQuery);
    }, 30 * 60 * 1000);

    return () => clearInterval(interval);
  }, [currentCityQuery, fetchWeatherByLocation, fetchWeatherData]);

  return {
    weatherData,
    loading,
    error,
    clearError,
    currentCity,
    currentCityQuery,
    isLocating,
    fetchWeatherData,
    fetchWeatherByLocation,
  };
}
