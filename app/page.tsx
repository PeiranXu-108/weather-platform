'use client';

import { useEffect, useState, Suspense } from 'react';
import Header from './components/Header';
import CurrentWeather from './components/CurrentWeather';
import TemperatureChart from './components/TemperatureChart';
import HourlyChart from './components/HourlyChart';
import HourlyForecast24h from './components/HourlyForecast24h';
import WeatherMetrics from './components/WeatherMetrics';
import Modal from './components/Modal';
import WeatherSkeleton from './components/WeatherSkeleton';
import FavoritesDrawer, { type FavoriteCity, loadFavoritesFromStorage, saveFavoritesToStorage } from './components/FavoritesDrawer';
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
  const [favorites, setFavorites] = useState<FavoriteCity[]>([]);
  const [isLocating, setIsLocating] = useState(false);
  const [modalConfig, setModalConfig] = useState<{ isOpen: boolean; message: string }>({
    isOpen: false,
    message: '',
  });

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

  // Load favorites from localStorage once
  useEffect(() => {
    setFavorites(loadFavoritesFromStorage());
  }, []);

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

  const handleSelectFavorite = (query: string) => {
    if (query.includes(',')) {
      const [lat, lon] = query.split(',');
      fetchWeatherByLocation(parseFloat(lat), parseFloat(lon));
    } else {
      fetchWeatherData(query);
    }
  };

  const handleToggleFavorite = (cityQuery: string, displayName: string) => {
    setFavorites((prev) => {
      const exists = prev.some((f) => f.query === cityQuery);
      const next = exists
        ? prev.filter((f) => f.query !== cityQuery)
        : [{ query: cityQuery, label: displayName }, ...prev.filter((f) => f.query !== cityQuery)];
      saveFavoritesToStorage(next);
      return next;
    });
  };

  // Show error modal if there's an error
  useEffect(() => {
    if (error) {
      setModalConfig({
        isOpen: true,
        message: `加载天气数据失败：${error}\n\n请稍后重试。`,
      });
      setError(null); // Clear error after showing modal
    }
  }, [error]);

  const handleCloseModal = () => {
    setModalConfig(prev => ({ ...prev, isOpen: false }));
  };

  // 默认字体颜色主题（用于初始加载或无数据时）
  const defaultTheme = {
    backgroundType: 'dark' as const,
    textColor: {
      primary: 'text-white',
      secondary: 'text-gray-200',
      muted: 'text-gray-300',
      accent: 'text-blue-200',
    },
  };

  // 计算当前天气状况和主题
  const weatherCondition = weatherData ? translateWeatherCondition(weatherData.current.condition) : '';
  const isSnowy = weatherCondition.includes('雪');
  const isRainy = (weatherCondition.includes('雨') || weatherCondition.includes('雷'));
  const isSunny = weatherCondition.includes('晴');
  const isFoggy = weatherCondition.includes('雾');
  const isCloudy = !isFoggy && (weatherCondition.includes('云') || weatherCondition.includes('阴'));
  
  const todayForecast = weatherData?.forecast.forecastday[0];
  const sunsetTime = todayForecast?.astro?.sunset;
  const sunriseTime = todayForecast?.astro?.sunrise;
  const currentTime = weatherData?.location.localtime;
  const isDay = weatherData?.current.is_day === 1;

  const { isSunset, isNight } = (() => {
    if (!weatherData) return { isSunset: false, isNight: false };
    if (!isDay) {
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
          if (currentDate >= oneHourBeforeSunrise && currentDate <= oneHourAfterSunrise) {
            return { isSunset: false, isNight: false };
          }
        } catch { }
      }
      return { isSunset: false, isNight: true };
    }
    if (!sunsetTime || !currentTime) return { isSunset: false, isNight: false };
    try {
      const currentDate = new Date(currentTime.replace(' ', 'T'));
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
      return { isSunset: currentDate >= oneHourBeforeSunset && currentDate <= oneHourAfterSunset, isNight: false };
    } catch {
      return { isSunset: false, isNight: false };
    }
  })();
  
  const textColorTheme = weatherData 
    ? getTextColorTheme(weatherCondition, isSunset, isNight, weatherData.current.is_day)
    : defaultTheme;

  // Collect all hourly data
  const allHourlyData: Hour[] = weatherData?.forecast.forecastday.reduce((acc, day) => {
    return [...acc, ...day.hour];
  }, [] as Hour[]) || [];

  return (
    <main className="min-h-screen p-4 md:p-8 relative">
      {/* Favorites Drawer */}
      <FavoritesDrawer
        textColorTheme={textColorTheme}
        currentCityQuery={currentCityQuery}
        favorites={favorites}
        onChangeFavorites={setFavorites}
        onSelectCity={handleSelectFavorite}
      />
      {/* Backgrounds */}
      {isSnowy && <SnowyWeatherBackground sunsetTime={sunsetTime} currentTime={currentTime} />}
      {isRainy && <RainyWeatherBackground sunsetTime={sunsetTime} currentTime={currentTime} />}
      {isSunny && <SunnyWeatherBackground sunsetTime={sunsetTime} sunriseTime={sunriseTime} currentTime={currentTime} isDay={weatherData?.current.is_day} />}
      {isFoggy && <FoggyWeatherBackground sunsetTime={sunsetTime} currentTime={currentTime} />}
      {isCloudy && <CloudyWeatherBackground sunsetTime={sunsetTime} currentTime={currentTime} />}
      {!weatherData && <div className="fixed inset-0 -z-10 bg-gradient-to-br from-sky-50 via-blue-50 to-indigo-50" />}
      {!isSnowy && !isRainy && !isSunny && !isFoggy && !isCloudy && weatherData && <div className="fixed inset-0 -z-10 bg-gradient-to-br from-sky-50 via-blue-50 to-indigo-50" />}

      <div className={`max-w-7xl mx-auto space-y-6 ${textColorTheme.textColor.primary}`}>
        {/* Header with Search - Always visible */}
        <Header 
          onCitySelect={handleCitySelect} 
          onLocationSelect={handleLocationSelect}
          currentCity={currentCity}
          isLocating={isLocating}
          textColorTheme={textColorTheme}
        />

        <Suspense fallback={<WeatherSkeleton />}>
          {loading || !weatherData ? (
            <WeatherSkeleton />
          ) : (
            <div className="space-y-6 animate-in fade-in duration-500">
              {/* Current Weather and 24h Forecast */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-1">
                  <CurrentWeather
                    location={weatherData.location}
                    current={weatherData.current}
                    textColorTheme={textColorTheme}
                    cityQuery={currentCityQuery}
                    isFavorite={favorites.some((f) => f.query === currentCityQuery)}
                    onToggleFavorite={handleToggleFavorite}
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
                      lat: Number(weatherData.location.lat.toFixed(2)),
                      lon: Number(weatherData.location.lon.toFixed(2))
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
              <footer className="text-center pt-8 pb-4">
                <p className="text-sm text-white-100 opacity-80">
                  数据来源：WeatherAPI.com • 最后更新：{weatherData.current.last_updated}
                </p>
              </footer>
            </div>
          )}
        </Suspense>
      </div>

      {/* Custom Modal */}
      <Modal
        isOpen={modalConfig.isOpen}
        onClose={handleCloseModal}
        message={modalConfig.message}
        textColorTheme={textColorTheme}
      />
    </main>
  );
}

