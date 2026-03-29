import { useCallback, useEffect, useMemo, useState } from 'react';
import * as Location from 'expo-location';
import { useQuery } from '@tanstack/react-query';

import { CURRENT_CITY_KEY, getCachedJson, setCachedJson } from '@/data/cache';
import { fetchWeatherByQuery } from '@/data/weatherRepository';
import type { WeatherResponse } from '@shared/weather/types';
import { getEnglishCityName } from '@shared/weather/citySearch';

type CachedCity = {
  city: string;
  query: string;
};

const DEFAULT_CITY: CachedCity = { city: '杭州', query: 'hangzhou' };

export function useWeatherHome() {
  const [currentCity, setCurrentCity] = useState<CachedCity>(DEFAULT_CITY);

  useEffect(() => {
    getCachedJson<CachedCity>(CURRENT_CITY_KEY).then((cached) => {
      if (cached?.query) {
        setCurrentCity(cached);
      }
    });
  }, []);

  const weatherQuery = useQuery<WeatherResponse>({
    queryKey: ['weather', currentCity.query],
    queryFn: () => fetchWeatherByQuery(currentCity.query),
  });

  const weather = weatherQuery.data;

  const locateMe = useCallback(async () => {
    const permission = await Location.requestForegroundPermissionsAsync();
    if (permission.status !== 'granted') {
      throw new Error('Location permission denied');
    }
    const position = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    const query = `${position.coords.latitude},${position.coords.longitude}`;
    const cityState = { city: '当前位置', query };
    setCurrentCity(cityState);
    await setCachedJson(CURRENT_CITY_KEY, cityState);
    await weatherQuery.refetch();
  }, [weatherQuery]);

  const setCityByInput = useCallback(async (rawInput: string) => {
    const query = getEnglishCityName(rawInput);
    const cityState = { city: rawInput, query };
    setCurrentCity(cityState);
    await setCachedJson(CURRENT_CITY_KEY, cityState);
  }, []);

  const locationLabel = useMemo(() => {
    if (!weather) return currentCity.city;
    return `${weather.location.name}, ${weather.location.country}`;
  }, [weather, currentCity.city]);

  return {
    currentCity,
    locationLabel,
    weather,
    isLoading: weatherQuery.isLoading,
    isRefetching: weatherQuery.isFetching,
    error: weatherQuery.error as Error | null,
    locateMe,
    refetch: weatherQuery.refetch,
    setCityByInput,
  };
}
