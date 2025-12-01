'use client';

import { useEffect, useState } from 'react';
import CurrentWeather from './components/CurrentWeather';
import TemperatureChart from './components/TemperatureChart';
import HourlyChart from './components/HourlyChart';
import WeatherMetrics from './components/WeatherMetrics';
import type { WeatherResponse, Hour } from './types/weather';

export default function Home() {
  const [weatherData, setWeatherData] = useState<WeatherResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchWeatherData() {
      try {
        setLoading(true);
        const response = await fetch('/api/weather');
        
        if (!response.ok) {
          throw new Error('Failed to fetch weather data');
        }
        
        const data: WeatherResponse = await response.json();
        setWeatherData(data);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
        console.error('Error fetching weather data:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchWeatherData();
    
    // Auto-refresh every 30 minutes
    const interval = setInterval(fetchWeatherData, 30 * 60 * 1000);
    
    return () => clearInterval(interval);
  }, []);

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

  return (
    <main className="min-h-screen p-4 md:p-8 bg-gradient-to-br from-sky-50 via-blue-50 to-indigo-50">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <header className="text-center mb-8">
          <h1 className="text-4xl font-bold text-sky-700 mb-2">
            天气预报
          </h1>
          <p className="text-sky-600">
            实时天气预报与可视化展示
          </p>
        </header>

        {/* Current Weather */}
        <CurrentWeather
          location={weatherData.location}
          current={weatherData.current}
        />

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
        <footer className="text-center pt-8 pb-4">
          <p className="text-sm text-sky-600">
            数据来源：WeatherAPI.com • 最后更新：{weatherData.current.last_updated}
          </p>
        </footer>
      </div>
    </main>
  );
}

