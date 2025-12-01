import React from 'react';
import type { Location, Current } from '@/app/types/weather';
import Image from 'next/image';

interface CurrentWeatherProps {
  location: Location;
  current: Current;
}

export default function CurrentWeather({ location, current }: CurrentWeatherProps) {
  return (
    <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl p-6 border border-sky-100">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center">
        <div className="flex-1">
          <h1 className="text-3xl font-bold text-sky-800 mb-2">
            {location.name}, {location.region}
          </h1>
          <p className="text-sm text-sky-600 mb-4">
            {location.country} • {location.localtime}
          </p>
          <div className="flex items-center gap-4">
            <div className="flex items-center">
              <Image
                src={`https:${current.condition.icon}`}
                alt={current.condition.text}
                width={64}
                height={64}
                className="w-16 h-16"
              />
              <div className="ml-2">
                <p className="text-5xl font-bold text-sky-700">
                  {current.temp_c.toFixed(1)}°C
                </p>
                <p className="text-lg text-sky-600">
                  {current.condition.text}
                </p>
              </div>
            </div>
          </div>
        </div>
        
        <div className="mt-4 md:mt-0 grid grid-cols-2 gap-4 md:gap-6">
          <div className="text-center">
            <p className="text-sm text-sky-600">体感温度</p>
            <p className="text-2xl font-semibold text-sky-800">
              {current.feelslike_c.toFixed(1)}°C
            </p>
          </div>
          <div className="text-center">
            <p className="text-sm text-sky-600">湿度</p>
            <p className="text-2xl font-semibold text-sky-800">
              {current.humidity}%
            </p>
          </div>
          <div className="text-center">
            <p className="text-sm text-sky-600">风速</p>
            <p className="text-2xl font-semibold text-sky-800">
              {current.wind_kph.toFixed(2)} km/h
            </p>
          </div>
          <div className="text-center">
            <p className="text-sm text-sky-600">紫外线指数</p>
            <p className="text-2xl font-semibold text-sky-800">
              {current.uv}
            </p>
          </div>
        </div>
      </div>
      
      <div className="mt-4 pt-4 border-t border-sky-100">
        <p className="text-xs text-sky-500">
          最后更新：{current.last_updated}
        </p>
      </div>
    </div>
  );
}

