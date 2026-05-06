'use client';

import { useEffect, useMemo, useState, Suspense } from 'react';
import Header from './components/Header';
import CurrentWeather from './components/CurrentWeather';
import TemperatureChart from './components/Forcast30days';
import HourlyChart from './components/HourlyChart';
import HourlyForecast24h from './components/HourlyForecast24h';
import WeatherMetrics from './components/WeatherMetrics';
import Modal from './models/Modal';
import WeatherSkeleton from './components/WeatherSkeleton';
import FavoritesDrawer, { type FavoriteCity, loadFavoritesFromStorage, saveFavoritesToStorage } from './components/FavoritesDrawer';
import { translateWeatherCondition } from './utils/weatherTranslations';
import { getTextColorTheme, readableTextShadowStyle, shouldEnhanceReadableText } from './utils/textColorTheme';
import dynamic from 'next/dynamic';
import type { Hour } from './types/weather';
import { useSyncFavorites } from './hooks/useSyncFavorites';
import { useHomeWeather } from './hooks/useHomeWeather';
import { useSession } from 'next-auth/react';
import { favoritesApi } from './lib/api';
import ChatBot from './components/ChatBot/ChatBot';
import type { ChatLayoutMode } from './components/ChatBot/types';
import { useI18n } from './i18n';

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

// 动态导入地图组件，禁用 SSR
const WeatherMap = dynamic(
  () => import('./components/Map/WeatherMap'),
  { ssr: false }
);

export default function Home() {
  const { t } = useI18n();
  useSyncFavorites();
  const { status } = useSession();
  const {
    weatherData,
    loading,
    error,
    clearError,
    currentCity,
    currentCityQuery,
    isLocating,
    fetchWeatherData,
    fetchWeatherByLocation,
  } = useHomeWeather();
  const [favorites, setFavorites] = useState<FavoriteCity[]>([]);
  const [opacity, setOpacity] = useState(0);
  const [showBackground, setShowBackground] = useState(true);
  const [uiHidden, setUiHidden] = useState(false);
  const [chatMode, setChatMode] = useState<ChatLayoutMode>('closed');
  const [modalConfig, setModalConfig] = useState<{ isOpen: boolean; message: string }>({
    isOpen: false,
    message: '',
  });

  // Ctrl+Shift+H: toggle UI visibility (show only background)
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === 'h') {
        event.preventDefault();
        event.stopPropagation();
        setUiHidden((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Load favorites: authed from DB, guest from localStorage
  useEffect(() => {
    if (status === 'authenticated') {
      favoritesApi
        .list()
        .then((r) => (r.ok ? r.json() : []))
        .then((data) => setFavorites(Array.isArray(data) ? data : []))
        .catch(() => { });
      return;
    }
    if (status === 'unauthenticated') {
      setFavorites(loadFavoritesFromStorage());
    }
  }, [status]);

  // After local->db sync completes, refresh favorites from DB
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onSynced = () => {
      if (status !== 'authenticated') return;
      favoritesApi
        .list()
        .then((r) => (r.ok ? r.json() : []))
        .then((data) => setFavorites(Array.isArray(data) ? data : []))
        .catch(() => { });
    };
    window.addEventListener('favorites:synced', onSynced);
    return () => window.removeEventListener('favorites:synced', onSynced);
  }, [status]);

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

  const handleToggleFavorite = async (cityQuery: string, displayName: string) => {
    const exists = favorites.some((f) => f.query === cityQuery);

    if (status === 'authenticated') {
      if (exists) {
        const res = await favoritesApi.remove(cityQuery);
        if (res.ok) {
          const next = await res.json();
          if (Array.isArray(next)) setFavorites(next);
        }
        return;
      }

      const res = await favoritesApi.add({ query: cityQuery, label: displayName });
      if (res.ok) {
        const next = await res.json();
        if (Array.isArray(next)) setFavorites(next);
      }
      return;
    }

    // guest: localStorage
    setFavorites((prev) => {
      const has = prev.some((f) => f.query === cityQuery);
      const next = has
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
        message: t('weather.errorModalMessage', { error }),
      });
      clearError();
    }
  }, [clearError, error, t]);

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
  const isOvercast = !isFoggy && weatherCondition.includes('阴');
  const isPartlyCloudy = !isFoggy && !isOvercast && weatherCondition.includes('云');

  const todayForecast = weatherData?.forecast.forecastday[0];
  const sunsetTime = todayForecast?.astro?.sunset;
  const sunriseTime = todayForecast?.astro?.sunrise;
  const currentTime = weatherData?.location.localtime;
  const currentTimeEpoch = weatherData?.location.localtime_epoch;
  const isDay = weatherData?.current.is_day === 1;
  const moonPhase = todayForecast?.astro?.moon_phase;
  const moonIllumination = todayForecast?.astro?.moon_illumination;

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

  const textColorTheme = !showBackground
    ? {
      backgroundType: 'light' as const,
      textColor: {
        primary: 'text-gray-900',
        secondary: 'text-gray-700',
        muted: 'text-gray-600',
        accent: 'text-sky-700',
      },
    }
    : (weatherData
      ? getTextColorTheme(weatherCondition, isSunset, isNight, weatherData.current.is_day)
      : defaultTheme);

  const enhanceReadableText = shouldEnhanceReadableText(showBackground, textColorTheme);

  // Collect all hourly data
  const allHourlyData: Hour[] = weatherData?.forecast.forecastday.reduce((acc, day) => {
    return [...acc, ...day.hour];
  }, [] as Hour[]) || [];
  const forecast30dLocation = useMemo(() => {
    if (!weatherData) return undefined;

    return {
      lat: Number(weatherData.location.lat.toFixed(2)),
      lon: Number(weatherData.location.lon.toFixed(2)),
    };
  }, [weatherData?.location.lat, weatherData?.location.lon]);
  const liveFavoriteWeather = useMemo(
    () => ({ query: currentCityQuery, data: weatherData }),
    [currentCityQuery, weatherData]
  );
  const isChatDocked = chatMode === 'docked';
  const primaryGridClass = isChatDocked
    ? 'grid grid-cols-1 xl:grid-cols-3 gap-4 sm:gap-6'
    : 'grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6';
  const secondaryGridClass = isChatDocked
    ? 'grid grid-cols-1 xl:grid-cols-3 gap-4 sm:gap-6'
    : 'grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6';

  return (
    <main
      className={`min-h-screen relative ${isChatDocked ? 'md:h-screen md:overflow-hidden' : ''}`}
      style={{ paddingBottom: isChatDocked ? undefined : 'max(5rem, env(safe-area-inset-bottom, 0px))' }}
    >
      {/* Backgrounds */}
      {showBackground && isSnowy && <SnowyWeatherBackground sunsetTime={sunsetTime} currentTime={currentTime} isDay={weatherData?.current.is_day} />}
      {showBackground && isRainy && <RainyWeatherBackground sunsetTime={sunsetTime} currentTime={currentTime} precipMm={weatherData?.current.precip_mm} isDay={weatherData?.current.is_day} />}
      {showBackground && isSunny && <SunnyWeatherBackground sunsetTime={sunsetTime} sunriseTime={sunriseTime} currentTime={currentTime} currentTimeEpoch={currentTimeEpoch} isDay={weatherData?.current.is_day} moonPhase={moonPhase} moonIllumination={moonIllumination} />}
      {showBackground && isFoggy && <FoggyWeatherBackground sunsetTime={sunsetTime} sunriseTime={sunriseTime} currentTime={currentTime} isDay={weatherData?.current.is_day} />}
      {showBackground && isOvercast && <CloudyWeatherBackground sunsetTime={sunsetTime} currentTime={currentTime} currentTimeEpoch={currentTimeEpoch} />}
      {showBackground && isPartlyCloudy && <CloudyWeatherBackground mode="partly-cloudy" cloudAmount={weatherData?.current.cloud} isDay={weatherData?.current.is_day} sunsetTime={sunsetTime} sunriseTime={sunriseTime} currentTime={currentTime} currentTimeEpoch={currentTimeEpoch} moonPhase={moonPhase} moonIllumination={moonIllumination} />}
      {!weatherData && <div className="fixed inset-0 z-0 bg-gradient-to-br from-sky-50 via-blue-50 to-indigo-50" />}
      {showBackground && !isSnowy && !isRainy && !isSunny && !isFoggy && !isOvercast && !isPartlyCloudy && weatherData && <div className="fixed inset-0 z-0 bg-gradient-to-br from-sky-50 via-blue-50 to-indigo-50" />}
      {!showBackground && <div className="fixed inset-0 z-0 bg-gradient-to-br from-sky-50 via-blue-50 to-indigo-50" />}

      <div className={uiHidden ? 'invisible pointer-events-none' : ''}>
        <div className={`relative z-10 ${isChatDocked ? 'md:flex md:min-h-screen' : ''}`}>
          <div className={`min-w-0 ${isChatDocked ? 'flex-1 md:h-screen md:overflow-y-auto' : ''}`}>
            <div
              className={`${isChatDocked ? 'px-4 pt-4 pb-8 md:px-8 md:pt-8' : 'p-4 md:p-8'} ${isChatDocked ? '' : 'pb-20'}`}
              style={isChatDocked ? undefined : { paddingBottom: 'max(5rem, env(safe-area-inset-bottom, 0px))' }}
            >
              <FavoritesDrawer
                textColorTheme={textColorTheme}
                currentCityQuery={currentCityQuery}
                favorites={favorites}
                onChangeFavorites={setFavorites}
                onSelectCity={handleSelectFavorite}
                showBackground={showBackground}
                isAuthenticated={status === 'authenticated'}
                liveWeather={liveFavoriteWeather}
              />
              <div className={`w-full mx-auto space-y-6 ${isChatDocked ? 'max-w-none' : 'max-w-7xl'} ${textColorTheme.textColor.primary}`}>
                {/* Header with Search - Always visible */}
                <Header
                  onCitySelect={handleCitySelect}
                  onLocationSelect={handleLocationSelect}
                  currentCity={currentCity}
                  isLocating={isLocating}
                  textColorTheme={textColorTheme}
                  opacity={opacity}
                  onOpacityChange={setOpacity}
                  showBackground={showBackground}
                  onShowBackgroundChange={setShowBackground}
                  showFireworksAction={
                    showBackground &&
                    isNight &&
                    (isSunny || isPartlyCloudy)
                  }
                />

                <Suspense fallback={<WeatherSkeleton />}>
                  {loading || !weatherData ? (
                    <WeatherSkeleton />
                  ) : (
                    <div className="space-y-6 animate-in fade-in duration-500">
                      {/* Current Weather and 24h Forecast */}
                      <div className={primaryGridClass}>
                        <div className="lg:col-span-1">
                          <CurrentWeather
                            location={weatherData.location}
                            current={weatherData.current}
                            textColorTheme={textColorTheme}
                            enhanceReadableText={enhanceReadableText}
                            cityQuery={currentCityQuery}
                            isFavorite={favorites.some((f) => f.query === currentCityQuery)}
                            onToggleFavorite={handleToggleFavorite}
                            opacity={opacity}
                          />
                        </div>
                        <div className="lg:col-span-2">
                          <HourlyForecast24h
                            hourlyData={allHourlyData}
                            currentTime={weatherData.location.localtime}
                            currentTimeEpoch={weatherData.location.localtime_epoch}
                            textColorTheme={textColorTheme}
                            enhanceReadableText={enhanceReadableText}
                            opacity={opacity}
                            astro={weatherData.forecast.forecastday[0]?.astro ?? null}
                            astroNextDay={weatherData.forecast.forecastday[1]?.astro ?? null}
                          />
                        </div>
                      </div>

                      {/* Temperature Chart and Metrics Row */}
                      <div className={secondaryGridClass}>
                        <div className="lg:col-span-2">
                          <TemperatureChart
                            location={forecast30dLocation}
                            textColorTheme={textColorTheme}
                            enhanceReadableText={enhanceReadableText}
                            opacity={opacity}
                          />
                        </div>
                        <div className="lg:col-span-1">
                          <WeatherMetrics
                            current={weatherData.current}
                            textColorTheme={textColorTheme}
                            enhanceReadableText={enhanceReadableText}
                            opacity={opacity}
                          />
                        </div>
                      </div>

                      {/* Hourly Forecast */}
                      <HourlyChart
                        hourlyData={allHourlyData}
                        textColorTheme={textColorTheme}
                        enhanceReadableText={enhanceReadableText}
                        opacity={opacity}
                      />

                      <WeatherMap
                        location={weatherData.location}
                        textColorTheme={textColorTheme}
                        enhanceReadableText={enhanceReadableText}
                        opacity={opacity}
                        onGoToLocation={handleLocationSelect}
                      />

                      {/* Footer */}
                      <footer className="text-center pt-8 pb-4">
                        <p
                          className="text-sm text-white-100 opacity-80"
                          style={readableTextShadowStyle('secondary', enhanceReadableText)}
                        >
                          {t('weather.dataSourceFooter', { time: weatherData.current.last_updated })}
                        </p>
                      </footer>
                    </div>
                  )}
                </Suspense>
              </div>
            </div>
          </div>

          <ChatBot
            textColorTheme={textColorTheme}
            mode={chatMode}
            onModeChange={setChatMode}
          />
        </div>

        {/* Custom Modal */}
        <Modal
          isOpen={modalConfig.isOpen}
          onClose={handleCloseModal}
          message={modalConfig.message}
          textColorTheme={textColorTheme}
        />
      </div>
    </main>
  );
}
