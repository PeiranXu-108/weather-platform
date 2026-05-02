'use client';

import React from 'react';
import type { Current } from '@/app/types/weather';
import type { TextColorTheme } from '@/app/utils/textColorTheme';
import { getCardStyle, getCardBackgroundStyle, readableTextShadowStyle } from '@/app/utils/textColorTheme';
import Icon from '@/app/models/Icon';
import { ICONS } from '@/app/utils/icons';
import { useI18n } from '@/app/i18n';

interface WeatherMetricsProps {
  current: Current;
  textColorTheme: TextColorTheme;
  enhanceReadableText?: boolean;
  opacity?: number;
}

export default function WeatherMetrics({ current, textColorTheme, enhanceReadableText = false, opacity = 100 }: WeatherMetricsProps) {
  const { t } = useI18n();
  const metrics = [
    { label: t('weather.humidity'), value: `${current.humidity}%`, icon: ICONS.humidity, iconColor: 'text-blue-500' },
    { label: t('weather.windSpeed'), value: `${Math.round(current.wind_kph)} km/h`, icon: ICONS.wind, iconColor: 'text-emerald-500' },
    { label: t('weather.pressure'), value: `${current.pressure_mb} mb`, icon: ICONS.pressure, iconColor: 'text-violet-500' },
    { label: t('weather.uv'), value: current.uv.toString(), icon: ICONS.uv, iconColor: 'text-amber-500' },
    { label: t('weather.visibility'), value: `${current.vis_km} km`, icon: ICONS.visibility, iconColor: 'text-indigo-500' },
    { label: t('weather.precipitation'), value: `${current.precip_mm} mm`, icon: ICONS.precipitation, iconColor: 'text-cyan-500' },
    { label: t('weather.windDirection'), value: `${current.wind_dir} (${current.wind_degree}°)`, icon: ICONS.windDirection, iconColor: 'text-sky-500' },
    { label: t('weather.cloudAmount'), value: `${current.cloud}%`, icon: ICONS.cloudAmount, iconColor: 'text-slate-400' },
  ];

  const rs = (level: 'primary' | 'secondary') =>
    readableTextShadowStyle(level, enhanceReadableText);

  return (
    <div className={`rounded-2xl shadow-xl p-4 sm:p-6 h-[400px] sm:h-[520px] flex flex-col min-h-0`} style={{ backgroundColor: getCardBackgroundStyle(opacity, textColorTheme.backgroundType) }}>
      <h2
        className={`text-base sm:text-lg font-bold ${textColorTheme.textColor.primary} mb-3 sm:mb-4`}
        style={rs('primary')}
      >
        {t('weather.metricsTitle')}
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
                <p
                  className={`text-xl sm:text-2xl font-medium ${textColorTheme.textColor.secondary} truncate`}
                  style={rs('secondary')}
                >
                  {metric.label}
                </p>
                <p
                  className={`text-sm sm:text-base font-bold ${textColorTheme.textColor.primary} truncate`}
                  style={rs('primary')}
                >
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
