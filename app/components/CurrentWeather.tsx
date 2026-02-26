'use client';

import React from 'react';
import type { Location, Current } from '@/app/types/weather';
import Image from 'next/image';
import type { TextColorTheme } from '@/app/utils/textColorTheme';
import { getCardBackgroundStyle } from '@/app/utils/textColorTheme';
import Icon from '@/app/models/Icon';
import { ICONS } from '@/app/utils/icons';
import { useTranslatedTexts } from '@/app/hooks/useTranslatedText';
import { translateLocationName } from '@/app/utils/locationTranslations';
import { translateWeatherCondition } from '@/app/utils/weatherTranslations';

interface CurrentWeatherProps {
  location: Location;
  current: Current;
  textColorTheme: TextColorTheme;
  cityQuery?: string;
  isFavorite?: boolean;
  onToggleFavorite?: (cityQuery: string, displayName: string) => void;
  opacity?: number;
}

export default function CurrentWeather({ location, current, textColorTheme, cityQuery, isFavorite, onToggleFavorite, opacity = 100 }: CurrentWeatherProps) {
  const originals = [
    location.name ?? '',
    location.region ?? '',
    location.country ?? '',
    current.condition.text ?? '',
  ];
  const geo = {
    country: location.country ?? undefined,
    region: location.region ?? undefined,
    city: location.name ?? undefined,
  };
  const translated = useTranslatedTexts(originals, geo);
  // 优先用静态映射（如 China→中国），避免翻译 API 未就绪时仍显示英文
  const staticName = translateLocationName(originals[0], 'city');
  const staticRegion = translateLocationName(originals[1], 'region');
  const staticCountry = translateLocationName(originals[2], 'country');
  const staticCondition = translateWeatherCondition(current.condition);
  const displayName = staticName !== originals[0] ? staticName : translated[0];
  const displayRegion = staticRegion !== originals[1] ? staticRegion : translated[1];
  const displayCountry = staticCountry !== originals[2] ? staticCountry : translated[2];
  const displayCondition = staticCondition !== originals[3] ? staticCondition : translated[3];

  // Format local time from location.localtime
  const formatTime = (timeString: string) => {
    try {
      const date = new Date(timeString);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      return `${year} 年 ${month} 月 ${day} 日 ${hours}:${minutes}`;
    } catch (e) {
      return timeString;
    }
  };


  const formattedLocalTime = formatTime(location.localtime);
  
  return (
    <div className={`rounded-2xl shadow-xl p-3 sm:p-4 h-full relative overflow-hidden flex flex-col`} style={{ backgroundColor: getCardBackgroundStyle(opacity, textColorTheme.backgroundType) }}>
      {/* Favorite button */}
      {cityQuery && onToggleFavorite && (
        <button
          type="button"
          onClick={() => onToggleFavorite(cityQuery, displayName)}
          className={`absolute top-2 right-2 z-10 rounded-full p-2 transition-all active:scale-95 min-w-[44px] min-h-[44px] flex items-center justify-center ${
            textColorTheme.backgroundType === 'dark'
              ? 'hover:bg-white/10'
              : 'hover:bg-black/5'
          }`}
          aria-label={isFavorite ? '取消收藏城市' : '收藏该城市'}
          title={isFavorite ? '已收藏，点击取消' : '点击收藏'}
        >
          <Icon
            src={isFavorite ? ICONS.bookmarkFilled : ICONS.bookmark}
            className={`w-5 h-5 ${isFavorite ? 'text-amber-400' : textColorTheme.textColor.secondary}`}
            title={isFavorite ? '已收藏' : '收藏'}
          />
        </button>
      )}
      <div className="flex flex-col flex-1 justify-between">
        <div>
          <h1 className={`text-3xl sm:text-5xl lg:text-6xl font-bold ${textColorTheme.textColor.primary} mb-2`}>
            {displayName}
          </h1>
          <p className={`text-base sm:text-xl ${textColorTheme.textColor.secondary} mb-4`}>
            {displayCountry} {displayRegion}
          </p>


          <div className="flex items-center gap-3">
            <div className="flex items-center">
              <Image
                src={`https:${current.condition.icon}`}
                alt={displayCondition}
                width={60}
                height={60}
                className="w-12 h-12"
              />
              <div className="ml-2">
                <p className={`text-3xl sm:text-4xl font-bold ${textColorTheme.textColor.primary}`}>
                  {current.temp_c.toFixed(1)}°C
                </p>
                <p className={`text-x ${textColorTheme.textColor.secondary}`}>
                  {displayCondition}
                </p>
              </div>
            </div>
          </div>
        </div>
      
        <div className="mt-3 pt-3">
          <p className={`text-xs ${textColorTheme.textColor.muted}`}>
            最后更新：北京时间 {formatTime(current.last_updated)}
          </p>
          <p className={`text-xs ${textColorTheme.textColor.secondary}`}>
            当地时间 {formattedLocalTime}
          </p>
        </div>
      </div>
    </div>
  );
}

