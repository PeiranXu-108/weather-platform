import React from 'react';
import type { Current } from '@/app/types/weather';
import type { TextColorTheme } from '@/app/utils/textColorTheme';
import { getCardStyle, getCardBackgroundStyle } from '@/app/utils/textColorTheme';
import Icon from '@/app/models/Icon';
import { ICONS } from '@/app/utils/icons';

interface WeatherMetricsProps {
  current: Current;
  textColorTheme: TextColorTheme;
  opacity?: number;
}

export default function WeatherMetrics({ current, textColorTheme, opacity = 100 }: WeatherMetricsProps) {
  const metrics = [
    { label: '湿度', value: `${current.humidity}%`, icon: ICONS.humidity, iconColor: 'text-blue-500' },
    { label: '风速', value: `${Math.round(current.wind_kph)} km/h`, icon: ICONS.wind, iconColor: 'text-emerald-500' },
    { label: '气压', value: `${current.pressure_mb} mb`, icon: ICONS.pressure, iconColor: 'text-violet-500' },
    { label: '紫外线', value: current.uv.toString(), icon: ICONS.uv, iconColor: 'text-amber-500' },
    { label: '能见度', value: `${current.vis_km} km`, icon: ICONS.visibility, iconColor: 'text-indigo-500' },
    { label: '降水量', value: `${current.precip_mm} mm`, icon: ICONS.precipitation, iconColor: 'text-cyan-500' },
    { label: '风向', value: `${current.wind_dir} (${current.wind_degree}°)`, icon: ICONS.windDirection, iconColor: 'text-sky-500' },
    { label: '云量', value: `${current.cloud}%`, icon: ICONS.cloudAmount, iconColor: 'text-slate-400' },
  ];

  return (
    <div className={`rounded-2xl shadow-xl p-4 sm:p-6 h-full flex flex-col min-h-0`} style={{ backgroundColor: getCardBackgroundStyle(opacity, textColorTheme.backgroundType) }}>
      <h2 className={`text-base sm:text-lg font-bold ${textColorTheme.textColor.primary} mb-3 sm:mb-4`}>
        天气指标
      </h2>
      <div className="flex-1 min-h-0 flex flex-col">
        <div className="grid grid-cols-2 grid-rows-4 gap-3 sm:gap-4 flex-1 min-h-0">
          {metrics.map((metric, index) => (
            <div
              key={`${metric.label}-${index}`}
              className={`${getCardStyle(textColorTheme.backgroundType)} rounded-lg p-3 sm:p-4 transition-all hover:scale-[1.02] hover:shadow-md flex items-center gap-2 sm:gap-3 min-h-0`}
            >
              <span className="flex shrink-0 items-center justify-center">
                <Icon src={metric.icon} className={`w-7 h-7 sm:w-8 sm:h-8 ${metric.iconColor}`} title={metric.label} />
              </span>
              <div className="min-w-0 flex-1 flex flex-col justify-center text-left">
                <p className={`text-xl sm:text-2xl font-medium ${textColorTheme.textColor.secondary} truncate`}>
                  {metric.label}
                </p>
                <p className={`text-sm sm:text-base font-bold ${textColorTheme.textColor.primary} truncate`}>
                  {metric.value}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
