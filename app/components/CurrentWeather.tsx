import React from 'react';
import type { Location, Current } from '@/app/types/weather';
import Image from 'next/image';
import { translateWeatherCondition } from '@/app/utils/weatherTranslations';
import { translateLocation } from '@/app/utils/locationTranslations';
import type { TextColorTheme } from '@/app/utils/textColorTheme';
import { getCardStyle } from '@/app/utils/textColorTheme';

interface CurrentWeatherProps {
  location: Location;
  current: Current;
  textColorTheme: TextColorTheme;
}

export default function CurrentWeather({ location, current, textColorTheme }: CurrentWeatherProps) {
  const translatedLocation = translateLocation(location);

  // Format local time from location.localtime
  const formatLocalTime = (timeString: string) => {
    try {
      const date = new Date(timeString);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      return `${year}/${month}/${day} ${hours}:${minutes}`;
    } catch (e) {
      return timeString;
    }
  };

  const formattedLocalTime = formatLocalTime(location.localtime);
  
  return (
    <div className={`${getCardStyle(textColorTheme.backgroundType)} rounded-2xl shadow-xl p-4 h-56`}>
      <div className="flex flex-col">
        <div className="flex-1">
          <h1 className={`text-5xl font-bold ${textColorTheme.textColor.primary} mb-2`}>
            {translatedLocation.name}
          </h1>
          <p className={`text-x ${textColorTheme.textColor.secondary} mb-4`}>
            {translatedLocation.country} • {formattedLocalTime}
          </p>
          <div className="flex items-center gap-3">
            <div className="flex items-center">
              <Image
                src={`https:${current.condition.icon}`}
                alt={translateWeatherCondition(current.condition)}
                width={60}
                height={60}
                className="w-12 h-12"
              />
              <div className="ml-2">
                <p className={`text-4xl font-bold ${textColorTheme.textColor.primary}`}>
                  {current.temp_c.toFixed(1)}°C
                </p>
                <p className={`text-x ${textColorTheme.textColor.secondary}`}>
                  {translateWeatherCondition(current.condition)}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <div className="mt-3 pt-3">
        <p className={`text-xs ${textColorTheme.textColor.muted}`}>
          最后更新：{current.last_updated}
        </p>
      </div>
    </div>
  );
}

