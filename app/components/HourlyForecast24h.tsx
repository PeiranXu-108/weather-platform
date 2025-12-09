import React from 'react';
import type { Hour } from '@/app/types/weather';
import Image from 'next/image';
import { translateWeatherCondition } from '@/app/utils/weatherTranslations';

interface HourlyForecast24hProps {
  hourlyData: Hour[];
  currentTime: string; // Current time in format "YYYY-MM-DD HH:mm"
}

export default function HourlyForecast24h({ hourlyData, currentTime }: HourlyForecast24hProps) {
  // Get current time epoch
  const currentTimeEpoch = new Date(currentTime).getTime() / 1000;
  
  // Find the index of the current hour in hourlyData
  // The hourly data contains hourly forecasts, we need to find the hour that contains the current time
  let currentHourIndex = -1;
  for (let i = 0; i < hourlyData.length; i++) {
    const hourTimeEpoch = hourlyData[i].time_epoch;
    // Check if current time falls within this hour (current time >= hour start and < next hour start)
    if (hourTimeEpoch <= currentTimeEpoch) {
      // Check if this is the last hour or if next hour is after current time
      if (i === hourlyData.length - 1 || hourlyData[i + 1].time_epoch > currentTimeEpoch) {
        currentHourIndex = i;
        break;
      }
    }
  }
  
  // If we couldn't find the current hour, use the first hour that's >= current time
  if (currentHourIndex === -1) {
    currentHourIndex = hourlyData.findIndex(hour => hour.time_epoch >= currentTimeEpoch);
    if (currentHourIndex === -1) {
      currentHourIndex = 0; // Fallback to first hour
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

  return (
    <div className="bg-white/10 rounded-2xl shadow-xl p-4 h-full">
      <h2 className="text-lg font-semibold text-sky-800 mb-4">未来24小时</h2>
      <div className="overflow-x-auto h-36">
        <div className="flex gap-3 min-w-max pb-2">
          {displayHours.map((hour, index) => {
            const isCurrentHour = index === currentDisplayIndex;
            
            return (
            <div
              key={`${hour.time_epoch}-${index}`}
              className={`flex-shrink-0 w-16 text-center flex flex-col items-center ${
                isCurrentHour ? 'ring-2 ring-sky-400 rounded-lg p-1' : ''
              }`}
            >
              <p className={`text-xs mb-1 whitespace-nowrap ${
                isCurrentHour ? 'text-sky-600 font-semibold' : 'text-gray-500'
              }`}>
                {isCurrentHour ? '现在' : formatTime(hour.time)}
              </p>
              <p className="text-xs font-medium text-gray-800 mb-2">
                {getDayOfWeek(hour.time)}
              </p>
              <div className="flex justify-center mb-2">
                <Image
                  src={`https:${hour.condition.icon}`}
                  alt={translateWeatherCondition(hour.condition)}
                  width={36}
                  height={36}
                  className="w-9 h-9"
                />
              </div>
              <p className={`text-sm font-semibold ${
                isCurrentHour ? 'text-sky-700' : 'text-gray-800'
              }`}>
                {hour.temp_c.toFixed(1)}°C
              </p>
            </div>
          );
          })}
        </div>
      </div>
    </div>
  );
}

