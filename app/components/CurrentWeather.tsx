import React from 'react';
import type { Location, Current } from '@/app/types/weather';
import Image from 'next/image';
import { translateWeatherCondition } from '@/app/utils/weatherTranslations';
import { translateLocation } from '@/app/utils/locationTranslations';

interface CurrentWeatherProps {
  location: Location;
  current: Current;
}

export default function CurrentWeather({ location, current }: CurrentWeatherProps) {
  const translatedLocation = translateLocation(location);
  
  return (
    <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl p-4 border border-sky-100 h-56">
      <div className="flex flex-col">
        <div className="flex-1">
          <h1 className="text-xl font-bold text-sky-800 mb-1">
            {translatedLocation.name}
          </h1>
          <p className="text-xs text-sky-600 mb-3">
            {translatedLocation.country} • {new Date().toLocaleString()}
          </p>
          <div className="flex items-center gap-3">
            <div className="flex items-center">
              <Image
                src={`https:${current.condition.icon}`}
                alt={translateWeatherCondition(current.condition)}
                width={48}
                height={48}
                className="w-12 h-12"
              />
              <div className="ml-2">
                <p className="text-3xl font-bold text-sky-700">
                  {current.temp_c.toFixed(1)}°C
                </p>
                <p className="text-sm text-sky-600">
                  {translateWeatherCondition(current.condition)}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <div className="mt-3 pt-3 border-t border-sky-100">
        <p className="text-xs text-sky-500">
          最后更新：{current.last_updated}
        </p>
      </div>
    </div>
  );
}

