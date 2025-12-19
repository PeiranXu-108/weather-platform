'use client';

import React, { useEffect, useState } from 'react';
import type { Hour } from '@/app/types/weather';
import Image from 'next/image';
import { translateWeatherCondition } from '@/app/utils/weatherTranslations';
import type { TextColorTheme } from '@/app/utils/textColorTheme';
import { getCardStyle } from '@/app/utils/textColorTheme';
import Icon from '@/app/components/Icon';
import { ICONS } from '@/app/utils/icons';

interface HourlyForecast24hProps {
  hourlyData: Hour[];
  currentTime: string; // Current time in format "YYYY-MM-DD HH:mm"
  currentTimeEpoch?: number; // Optional: current time epoch (more accurate)
  textColorTheme: TextColorTheme;
}

export default function HourlyForecast24h({ hourlyData, currentTime, currentTimeEpoch: providedEpoch, textColorTheme }: HourlyForecast24hProps) {
  const [selectedHour, setSelectedHour] = useState<Hour | null>(null);
  // Parse current time correctly (format: "YYYY-MM-DD HH:mm")
  // Use provided epoch if available (more accurate), otherwise parse from string
  const currentTimeEpoch = providedEpoch ?? new Date(currentTime.replace(' ', 'T')).getTime() / 1000;
  const isDarkTheme = textColorTheme.backgroundType === 'dark';
  
  // Find the index of the current hour in hourlyData
  // The hourly data contains hourly forecasts, we need to find the hour that contains the current time
  let currentHourIndex = -1;
  
  // Find the hour that contains the current time
  // Each hour in hourlyData represents the start of that hour (e.g., 06:00 represents 06:00-06:59)
  for (let i = 0; i < hourlyData.length; i++) {
    const hourTimeEpoch = hourlyData[i].time_epoch;
    const nextHourTimeEpoch = i < hourlyData.length - 1 ? hourlyData[i + 1].time_epoch : hourTimeEpoch + 3600;
    
    // Check if current time falls within this hour (hour start <= current time < next hour start)
    if (currentTimeEpoch >= hourTimeEpoch && currentTimeEpoch < nextHourTimeEpoch) {
      currentHourIndex = i;
      break;
    }
  }
  
  // If we couldn't find the current hour, use the closest hour
  if (currentHourIndex === -1) {
    // Find the hour that's closest to current time
    let minDiff = Infinity;
    for (let i = 0; i < hourlyData.length; i++) {
      const diff = Math.abs(hourlyData[i].time_epoch - currentTimeEpoch);
      if (diff < minDiff) {
        minDiff = diff;
        currentHourIndex = i;
      }
    }
    
    // Fallback: if still not found, use the first hour that's >= current time
    if (currentHourIndex === -1) {
      currentHourIndex = hourlyData.findIndex(hour => hour.time_epoch >= currentTimeEpoch);
      if (currentHourIndex === -1) {
        currentHourIndex = 0; // Fallback to first hour
      }
    }
  }
  
  // Start from 1 hour before current hour (if available)
  const startIndex = Math.max(0, currentHourIndex - 1);
  // Get 1 hour before, current, and 24 hours after (total 26 hours)
  const displayHours = hourlyData.slice(startIndex, startIndex + 26);
  
  // Calculate which index in displayHours is the current hour
  const currentDisplayIndex = currentHourIndex - startIndex;

  // Format time to Chinese format (e.g., "下午4时", "上午10时")
  // timeString is in local time format "YYYY-MM-DD HH:mm"
  const formatTime = (timeString: string) => {
    // Parse local time string (already in local timezone)
    const date = new Date(timeString.replace(' ', 'T'));
    const hour = date.getHours();
    const minute = date.getMinutes();
    
    let period = '';
    let displayHour = hour;
    
    if (hour >= 0 && hour < 6) {
      period = '凌晨';
    } else if (hour >= 6 && hour < 12) {
      period = '上午';
      displayHour = hour;
    } else if (hour >= 12 && hour < 18) {
      period = '下午';
      displayHour = hour === 12 ? 12 : hour - 12;
    } else {
      period = '晚上';
      displayHour = hour - 12;
    }
    
    return `${period}${displayHour}时`;
  };

  // Get day of week in Chinese
  // timeString is in local time format "YYYY-MM-DD HH:mm"
  const getDayOfWeek = (timeString: string) => {
    // Parse local time string (already in local timezone)
    const date = new Date(timeString.replace(' ', 'T'));
    const days = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    return days[date.getDay()];
  };

  const formatFullDateTime = (timeString: string) => {
    const date = new Date(timeString.replace(' ', 'T'));
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${month}月${day}日 ${getDayOfWeek(timeString)} ${hours}:${minutes}`;
  };

  useEffect(() => {
    // Disable background scroll when modal is open
    if (selectedHour) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [selectedHour]);

  useEffect(() => {
    if (!selectedHour) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setSelectedHour(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedHour]);

  return (
    <div className={`${getCardStyle(textColorTheme.backgroundType)} rounded-2xl shadow-xl p-4 h-full`}>
      <h2 className={`text-lg font-semibold ${textColorTheme.textColor.primary} mb-4`}>未来24小时</h2>
      <div className="overflow-x-auto h-40">
        <div className="flex gap-3 min-w-max pb-2 pr-1">
          {displayHours.map((hour, index) => {
            const isCurrentHour = index === currentDisplayIndex;
            
            return (
              <button
                type="button"
                onClick={() => setSelectedHour(hour)}
                key={`${hour.time_epoch}-${index}`}
                className={`group flex-shrink-0 w-20 text-center flex flex-col items-center rounded-xl px-2 py-2 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${
                  isCurrentHour
                    ? `${textColorTheme.backgroundType === 'dark' ? 'ring-2 ring-blue-300/70' : 'ring-2 ring-sky-400/80'}`
                    : ''
                } ${isDarkTheme ? 'hover:bg-white/10 focus-visible:ring-white/60 focus-visible:ring-offset-gray-900/60' : 'hover:bg-white/30 focus-visible:ring-sky-200 focus-visible:ring-offset-white/60'} shadow-sm`}
                aria-label={`查看${formatTime(hour.time)}天气详情`}
              >
                <p className={`text-xs mb-1 whitespace-nowrap ${
                  isCurrentHour ? `${textColorTheme.textColor.accent} font-semibold` : textColorTheme.textColor.muted
                }`}>
                  {isCurrentHour ? '现在' : formatTime(hour.time)}
                </p>
                <p className={`text-[11px] font-medium ${textColorTheme.textColor.secondary} mb-1`}>
                  {getDayOfWeek(hour.time)}
                </p>
                <div className="flex justify-center mb-2">
                  <Image
                    src={`https:${hour.condition.icon}`}
                    alt={translateWeatherCondition(hour.condition)}
                    width={40}
                    height={40}
                    className="w-10 h-10 transition-transform duration-200 group-hover:scale-110"
                  />
                </div>
                <p className={`text-sm font-semibold ${
                  isCurrentHour ? textColorTheme.textColor.accent : textColorTheme.textColor.primary
                }`}>
                  {hour.temp_c.toFixed(1)}°C
                </p>
                <p className={`text-[11px] ${textColorTheme.textColor.muted}`}>
                  体感 {hour.feelslike_c.toFixed(1)}°C
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {selectedHour && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setSelectedHour(null)}
          />
          <div className={`relative w-full max-w-3xl overflow-hidden rounded-3xl border shadow-2xl ${isDarkTheme ? 'bg-gray-900/85 border-white/10 backdrop-blur-xl' : 'bg-white/90 border-white/50 backdrop-blur-xl'}`}>
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute inset-x-10 top-0 h-32 bg-gradient-to-b from-white/10 to-transparent blur-3xl" />
            </div>

            <div className="relative flex flex-col gap-4 p-6 md:p-8">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className={`p-3 rounded-2xl ${isDarkTheme ? 'bg-white/5' : 'bg-sky-50'} shadow-inner`}>
                    <Image
                      src={`https:${selectedHour.condition.icon}`}
                      alt={translateWeatherCondition(selectedHour.condition)}
                      width={72}
                      height={72}
                      className="w-14 h-14"
                    />
                  </div>
                  <div>
                    <p className={`text-sm ${textColorTheme.textColor.secondary}`}>
                      {formatFullDateTime(selectedHour.time)}
                    </p>
                    <p className={`text-3xl font-bold ${textColorTheme.textColor.primary}`}>
                      {selectedHour.temp_c.toFixed(1)}°C
                    </p>
                    <p className={`text-base ${textColorTheme.textColor.muted}`}>
                      {translateWeatherCondition(selectedHour.condition)}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedHour(null)}
                  className={`rounded-full p-2 transition hover:rotate-90 ${isDarkTheme ? 'hover:bg-white/10 text-white' : 'hover:bg-gray-100 text-gray-600'}`}
                  aria-label="关闭天气详情"
                >
                  <Icon src={ICONS.close} className="w-6 h-6" title="关闭" />
                </button>
              </div>

              <div className="flex flex-wrap gap-2">
                <span className={`px-3 py-1 text-xs rounded-full border ${isDarkTheme ? 'border-white/15 bg-white/5 text-white' : 'border-sky-100 bg-sky-50 text-sky-700'}`}>
                  {selectedHour.is_day === 1 ? '白天时段' : '夜间时段'}
                </span>
                <span className={`px-3 py-1 text-xs rounded-full border ${isDarkTheme ? 'border-white/15 bg-white/5 text-white' : 'border-sky-100 bg-sky-50 text-sky-700'}`}>
                  体感 {selectedHour.feelslike_c.toFixed(1)}°C
                </span>
                <span className={`px-3 py-1 text-xs rounded-full border ${isDarkTheme ? 'border-white/15 bg-white/5 text-white' : 'border-sky-100 bg-sky-50 text-sky-700'}`}>
                  降水概率 {selectedHour.chance_of_rain ?? 0}%
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {[
                  {
                    label: '降水/降雪',
                    value: `${selectedHour.precip_mm} mm`,
                    sub: `雨概率 ${selectedHour.chance_of_rain ?? 0}% · 雪概率 ${selectedHour.chance_of_snow ?? 0}%`,
                    icon: <Icon src={ICONS.precipitation} className="w-6 h-6 text-sky-400" title="降水" />
                  },
                  {
                    label: '湿度',
                    value: `${selectedHour.humidity}%`,
                    sub: '空气相对湿度',
                    icon: <Icon src={ICONS.humidity} className="w-6 h-6 text-blue-300" title="湿度" />
                  },
                  {
                    label: '云量',
                    value: `${selectedHour.cloud}%`,
                    sub: '天空云覆盖率',
                    icon: <Icon src={ICONS.cloudAmount} className="w-6 h-6 text-indigo-300" title="云量" />
                  },
                  {
                    label: '风速 / 阵风',
                    value: `${Math.round(selectedHour.wind_kph)} km/h`,
                    sub: `阵风 ${Math.round(selectedHour.gust_kph)} km/h`,
                    icon: <Icon src={ICONS.wind} className="w-6 h-6 text-emerald-400" title="风" />
                  },
                  {
                    label: '风向',
                    value: `${selectedHour.wind_dir}`,
                    sub: `${selectedHour.wind_degree}°`,
                    icon: <Icon src={ICONS.windDirection} className="w-6 h-6 text-indigo-400" title="风向" />
                  },
                  {
                    label: '气压',
                    value: `${selectedHour.pressure_mb} mb`,
                    sub: '海平面气压',
                    icon: <Icon src={ICONS.pressure} className="w-6 h-6 text-violet-400" title="气压" />
                  },
                  {
                    label: '露点',
                    value: `${selectedHour.dewpoint_c.toFixed(1)}°C`,
                    sub: '空气水汽饱和温度',
                    icon: <Icon src={ICONS.humidity} className="w-6 h-6 text-cyan-400" title="露点" />
                  },
                  {
                    label: '能见度',
                    value: `${selectedHour.vis_km} km`,
                    sub: '水平能见距离',
                    icon: <Icon src={ICONS.visibility} className="w-6 h-6 text-amber-400" title="能见度" />
                  },
                  {
                    label: '紫外线',
                    value: `${selectedHour.uv}`,
                    sub: 'UV 指数',
                    icon: <Icon src={ICONS.uv} className="w-6 h-6 text-amber-500" title="紫外线" />
                  },
                ].map(stat => (
                  <div
                    key={stat.label}
                    className={`flex items-center gap-3 rounded-2xl border p-3 shadow-sm ${isDarkTheme ? 'bg-white/5 border-white/10' : 'bg-white/70 border-white/60'}`}
                  >
                    <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${isDarkTheme ? 'bg-white/10' : 'bg-sky-50'}`}>
                      {stat.icon}
                    </div>
                    <div className="flex-1">
                      <p className={`text-xs ${textColorTheme.textColor.secondary}`}>{stat.label}</p>
                      <p className={`text-lg font-semibold ${textColorTheme.textColor.primary}`}>{stat.value}</p>
                      <p className={`text-xs ${textColorTheme.textColor.muted}`}>{stat.sub}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

