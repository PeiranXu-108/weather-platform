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
import { getTextColorTheme } from './utils/textColorTheme';
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

const SnowyWeatherBackground = dynamic(
  () => import('./backgrounds/SnowyWeatherBackground'),
  { ssr: false }
);

const RainyWeatherBackground = dynamic(
  () => import('./backgrounds/RainyWeatherBackground'),
  { ssr: false }
);

const FoggyWeatherBackground = dynamic(
  () => import('./backgrounds/FoggyWeatherBackground'),
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
      console.log(data);
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

  // 检查天气状况，优先级：雪 > 雨 > 晴 > 雾 > 云
  const weatherCondition = translateWeatherCondition(weatherData.current.condition);
  const isSnowy = weatherCondition.includes('雪');
  const isRainy = (weatherCondition.includes('雨') || weatherCondition.includes('雷'));
  const isSunny = weatherCondition.includes('晴');
  const isFoggy = weatherCondition.includes('雾');
  const isCloudy = !isFoggy && (weatherCondition.includes('云') || weatherCondition.includes('阴'));
  
  // 获取今天的日出、日落时间和当前时间
  const todayForecast = weatherData.forecast.forecastday[0];
  const sunsetTime = todayForecast?.astro?.sunset;
  const sunriseTime = todayForecast?.astro?.sunrise;
  const currentTime = weatherData.location.localtime;
  const isDay = weatherData.current.is_day === 1; // API 提供的白天/黑夜标识
  
  // 判断是否是日落或夜晚
  // 优先使用 API 的 is_day 字段，然后结合日出/日落时间判断日落时段
  const { isSunset, isNight } = (() => {
    // 如果 API 明确标识是黑夜，直接返回黑夜（除非在日出时段）
    if (!isDay) {
      // 检查是否在日出时段（日出前后1小时）
      if (sunriseTime && currentTime) {
        try {
          const currentDate = new Date(currentTime.replace(' ', 'T'));
          const [sunriseTimePart, sunrisePeriod] = sunriseTime.split(' ');
          const [sunriseHours, sunriseMinutes] = sunriseTimePart.split(':').map(Number);
          let sunriseHours24 = sunriseHours;
          if (sunrisePeriod === 'PM' && sunriseHours !== 12) {
            sunriseHours24 = sunriseHours + 12;
          } else if (sunrisePeriod === 'AM' && sunriseHours === 12) {
            sunriseHours24 = 0;
          }
          const sunriseDate = new Date(currentDate);
          sunriseDate.setHours(sunriseHours24, sunriseMinutes, 0, 0);
          const oneHourBeforeSunrise = new Date(sunriseDate.getTime() - 60 * 60 * 1000);
          const oneHourAfterSunrise = new Date(sunriseDate.getTime() + 60 * 60 * 1000);
          
          // 如果在日出时段，不算黑夜
          if (currentDate >= oneHourBeforeSunrise && currentDate <= oneHourAfterSunrise) {
            return { isSunset: false, isNight: false };
          }
        } catch {
          // 解析失败，使用 API 的 is_day
        }
      }
      return { isSunset: false, isNight: true };
    }
    
    // 如果是白天，检查是否在日落时段
    if (!sunsetTime || !currentTime) {
      return { isSunset: false, isNight: false };
    }
    
    try {
      const currentDate = new Date(currentTime.replace(' ', 'T'));
      
      // 解析日落时间
      const [sunsetTimePart, sunsetPeriod] = sunsetTime.split(' ');
      const [sunsetHours, sunsetMinutes] = sunsetTimePart.split(':').map(Number);
      let sunsetHours24 = sunsetHours;
      if (sunsetPeriod === 'PM' && sunsetHours !== 12) {
        sunsetHours24 = sunsetHours + 12;
      } else if (sunsetPeriod === 'AM' && sunsetHours === 12) {
        sunsetHours24 = 0;
      }
      const sunsetDate = new Date(currentDate);
      sunsetDate.setHours(sunsetHours24, sunsetMinutes, 0, 0);
      
      const oneHourBeforeSunset = new Date(sunsetDate.getTime() - 60 * 60 * 1000);
      const oneHourAfterSunset = new Date(sunsetDate.getTime() + 60 * 60 * 1000);
      
      // 判断是否在日落前后一小时（日落时段）
      const isSunsetTime = currentDate >= oneHourBeforeSunset && currentDate <= oneHourAfterSunset;
      
      return { isSunset: isSunsetTime, isNight: false };
    } catch {
      return { isSunset: false, isNight: false };
    }
  })();
  
  // 获取字体颜色主题（传递 isDay 以确保判断准确）
  const textColorTheme = getTextColorTheme(weatherCondition, isSunset, isNight, weatherData.current.is_day);

  return (
    <main className="min-h-screen p-4 md:p-8 relative">
      {/* 雪天天气背景 - 优先级最高 */}
      {isSnowy && <SnowyWeatherBackground sunsetTime={sunsetTime} currentTime={currentTime} />}
      {/* 雨天天气背景 */}
      {isRainy && <RainyWeatherBackground sunsetTime={sunsetTime} currentTime={currentTime} />}
      {/* 晴天天气背景 */}
      {isSunny && <SunnyWeatherBackground sunsetTime={sunsetTime} sunriseTime={sunriseTime} currentTime={currentTime} isDay={weatherData.current.is_day} />}
      {/* 雾天天气背景 */}
      {isFoggy && <FoggyWeatherBackground sunsetTime={sunsetTime} currentTime={currentTime} />}
      {/* 多云天气背景 */}
      {isCloudy && <CloudyWeatherBackground sunsetTime={sunsetTime} currentTime={currentTime} />}
      {/* 默认背景 */}
      {!isSnowy && !isRainy && !isSunny && !isFoggy && !isCloudy && <div className="fixed inset-0 -z-10 bg-gradient-to-br from-sky-50 via-blue-50 to-indigo-50" />}
      <div className={`max-w-7xl mx-auto space-y-6 ${textColorTheme.textColor.primary}`}>
        {/* Header with Search */}
        <Header 
          onCitySelect={handleCitySelect} 
          onLocationSelect={handleLocationSelect}
          currentCity={currentCity}
          isLocating={isLocating}
          textColorTheme={textColorTheme}
        />

        {/* Current Weather and 24h Forecast */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1">
            <CurrentWeather
              location={weatherData.location}
              current={weatherData.current}
              textColorTheme={textColorTheme}
            />
          </div>
          <div className="lg:col-span-2">
            <HourlyForecast24h 
              hourlyData={allHourlyData} 
              currentTime={weatherData.location.localtime}
              currentTimeEpoch={weatherData.location.localtime_epoch}
              textColorTheme={textColorTheme}
            />
          </div>
        </div>

        {/* Temperature Chart and Metrics Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <TemperatureChart 
              location={{
                lat: Number(weatherData.location.lat.toFixed ? weatherData.location.lat.toFixed(2) : weatherData.location.lat.toFixed(2)),
                lon: Number(weatherData.location.lon.toFixed ? weatherData.location.lon.toFixed(2) : weatherData.location.lon.toFixed(2))
              }}
              textColorTheme={textColorTheme}
            />
          </div>
          <div className="lg:col-span-1">
            <WeatherMetrics 
              current={weatherData.current}
              textColorTheme={textColorTheme}
            />
          </div>
        </div>

        {/* Hourly Forecast */}
        <HourlyChart 
          hourlyData={allHourlyData}
          textColorTheme={textColorTheme}
        />

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

