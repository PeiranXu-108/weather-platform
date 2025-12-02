'use client';

import { useEffect, useState } from 'react';
import Header from './components/Header';
import CurrentWeather from './components/CurrentWeather';
import TemperatureChart from './components/TemperatureChart';
import HourlyChart from './components/HourlyChart';
import HourlyForecast24h from './components/HourlyForecast24h';
import WeatherMetrics from './components/WeatherMetrics';
import { translateLocation } from './utils/locationTranslations';
import { translateWeatherCondition } from './utils/weatherTranslations';
import dynamic from 'next/dynamic';
import type { WeatherResponse, Hour } from './types/weather';

// 动态导入 Three.js 组件，禁用 SSR
const CloudyWeatherBackground = dynamic(
  () => import('./backgrounds/CloudyWeatherBackground'),
  { ssr: false }
);

const SunnyWeatherBackground = dynamic(
  () => import('./backgrounds/SunnyWeatherBackground'),
  { ssr: false }
);

export default function Home() {
  const [weatherData, setWeatherData] = useState<WeatherResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentCity, setCurrentCity] = useState<string>('杭州');
  const [currentCityQuery, setCurrentCityQuery] = useState<string>('hangzhou');
  const [isLocating, setIsLocating] = useState(false);

  const fetchWeatherData = async (city: string = 'hangzhou') => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`/api/weather?city=${encodeURIComponent(city)}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch weather data');
      }
      
      const data: WeatherResponse = await response.json();
      setWeatherData(data);
      
      // Update current city display name and query
      const translated = translateLocation(data.location);
      setCurrentCity(translated.name);
      setCurrentCityQuery(city);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      console.error('Error fetching weather data:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchWeatherByLocation = async (lat: number, lon: number) => {
    try {
      setLoading(true);
      setError(null);
      setIsLocating(true);
      const response = await fetch(`/api/weather?lat=${lat}&lon=${lon}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch weather data');
      }
      
      const data: WeatherResponse = await response.json();
      setWeatherData(data);
      
      // Update current city display name and query
      const translated = translateLocation(data.location);
      setCurrentCity(translated.name);
      setCurrentCityQuery(`${lat},${lon}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      console.error('Error fetching weather data:', err);
    } finally {
      setLoading(false);
      setIsLocating(false);
    }
  };

  // Initial load - only run once on mount
  useEffect(() => {
    fetchWeatherData();
  }, []); // Empty dependency array - only run on mount

  // Auto-refresh - run every 30 minutes for current city/location
  useEffect(() => {
    if (!currentCityQuery) return;
    
    const interval = setInterval(() => {
      // Check if it's coordinates (lat,lon format) or city name
      if (currentCityQuery.includes(',')) {
        const [lat, lon] = currentCityQuery.split(',');
        fetchWeatherByLocation(parseFloat(lat), parseFloat(lon));
      } else {
        fetchWeatherData(currentCityQuery);
      }
    }, 30 * 60 * 1000);
    
    return () => clearInterval(interval);
  }, [currentCityQuery]);

  const handleCitySelect = (cityName: string) => {
    fetchWeatherData(cityName);
  };

  const handleLocationSelect = (lat: number, lon: number) => {
    fetchWeatherByLocation(lat, lon);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-sky-50 via-blue-50 to-indigo-50">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-16 w-16 border-b-2 border-sky-400"></div>
          <p className="mt-4 text-xl text-sky-700">正在加载天气数据...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-sky-50 via-blue-50 to-indigo-50">
        <div className="bg-red-50 border border-red-200 text-red-700 px-6 py-4 rounded-lg max-w-lg shadow-lg">
          <h2 className="text-xl font-bold mb-2">加载天气数据失败</h2>
          <p>{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 bg-red-400 hover:bg-red-500 text-white font-semibold py-2 px-4 rounded transition-colors"
          >
            重试
          </button>
        </div>
      </div>
    );
  }

  if (!weatherData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-sky-50 via-blue-50 to-indigo-50">
        <p className="text-xl text-sky-700">暂无天气数据</p>
      </div>
    );
  }

  // Collect all hourly data from all forecast days
  const allHourlyData: Hour[] = weatherData.forecast.forecastday.reduce((acc, day) => {
    return [...acc, ...day.hour];
  }, [] as Hour[]);

  // 检查天气状况是否包含"云"或"晴"
  const weatherCondition = translateWeatherCondition(weatherData.current.condition);
  const isCloudy = weatherCondition.includes('云');
  const isSunny = weatherCondition.includes('晴');
  
  // 获取今天的日落时间和当前时间
  const todayForecast = weatherData.forecast.forecastday[0];
  const sunsetTime = todayForecast?.astro?.sunset;
  const currentTime = weatherData.location.localtime;

  return (
    <main className="min-h-screen p-4 md:p-8 relative">
      {/* 多云天气背景 */}
      {isCloudy && <CloudyWeatherBackground sunsetTime={sunsetTime} currentTime={currentTime} />}
      {/* 晴天天气背景 */}
      {isSunny && !isCloudy && <SunnyWeatherBackground sunsetTime={sunsetTime} currentTime={currentTime} />}
      {/* 非多云非晴天时的默认背景 */}
      {!isCloudy && !isSunny && <div className="fixed inset-0 -z-10 bg-gradient-to-br from-sky-50 via-blue-50 to-indigo-50" />}
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header with Search */}
        <Header 
          onCitySelect={handleCitySelect} 
          onLocationSelect={handleLocationSelect}
          currentCity={currentCity}
          isLocating={isLocating}
        />

        {/* Current Weather and 24h Forecast */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1">
            <CurrentWeather
              location={weatherData.location}
              current={weatherData.current}
            />
          </div>
          <div className="lg:col-span-2">
            <HourlyForecast24h 
              hourlyData={allHourlyData} 
              currentTime={weatherData.location.localtime}
            />
          </div>
        </div>

        {/* Temperature Chart and Metrics Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <TemperatureChart forecastDays={weatherData.forecast.forecastday} />
          </div>
          <div className="lg:col-span-1">
            <WeatherMetrics current={weatherData.current} />
          </div>
        </div>

        {/* Hourly Forecast */}
        <HourlyChart hourlyData={allHourlyData} />

        {/* Footer */}
        {/* <footer className="text-center pt-8 pb-4">
          <p className="text-sm text-sky-600">
            数据来源：WeatherAPI.com • 最后更新：{weatherData.current.last_updated}
          </p>
        </footer> */}
      </div>
    </main>
  );
}

