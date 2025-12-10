import React from 'react';
import type { Current } from '@/app/types/weather';
import type { TextColorTheme } from '@/app/utils/textColorTheme';
import { getCardStyle } from '@/app/utils/textColorTheme';

interface WeatherMetricsProps {
  current: Current;
  textColorTheme: TextColorTheme;
}

export default function WeatherMetrics({ current, textColorTheme }: WeatherMetricsProps) {
  const metrics = [
    {
      label: '湿度',
      value: `${current.humidity}%`,
      icon: (
        <svg className="w-8 h-8 text-blue-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" />
        </svg>
      ),
      color: 'bg-sky-50'
    },
    {
      label: '风速',
      value: `${Math.round(current.wind_kph)} km/h`,
      icon: (
        <svg className="w-8 h-8 text-emerald-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9.59 4.59A2 2 0 1 1 11 8H2m10.59 11.41A2 2 0 1 0 14 16H2m15.73-8.27A2.5 2.5 0 1 1 19.5 12H2" />
        </svg>
      ),
      color: 'bg-emerald-50'
    },
    {
      label: '气压',
      value: `${current.pressure_mb} mb`,
      icon: (
        <svg className="w-8 h-8 text-violet-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <path d="M16.2 7.8l-2 6.3-1.5 2" />
          <path d="M6 12h4" />
        </svg>
      ),
      color: 'bg-violet-50'
    },
    {
      label: '紫外线',
      value: current.uv.toString(),
      icon: (
        <svg className="w-8 h-8 text-amber-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="5" />
          <path d="M12 1v2m0 18v2M4.22 4.22l1.42 1.42m12.72 12.72 1.42 1.42M1 12h2m18 0h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
        </svg>
      ),
      color: 'bg-amber-50'
    },
    {
      label: '能见度',
      value: `${current.vis_km} km`,
      icon: (
        <svg className="w-8 h-8 text-indigo-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      ),
      color: 'bg-indigo-50'
    },
    {
      label: '降水量',
      value: `${current.precip_mm} mm`,
      icon: (
        <svg className="w-8 h-8 text-cyan-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 16.2A4.5 4.5 0 0 0 21.42 8 5.35 5.35 0 0 0 16.1 5.75C15.65 2.5 12.9 0 9.6 0A7.5 7.5 0 0 0 2.65 7.15 4.5 4.5 0 0 0 5 15.6" />
          <path d="M16 14v6M8 14v6M12 16v6" />
        </svg>
      ),
      color: 'bg-cyan-50'
    }
  ];

  return (
    <div className={`${getCardStyle(textColorTheme.backgroundType)} rounded-2xl shadow-xl p-6`}>
      <h2 className={`text-xl font-bold ${textColorTheme.textColor.primary} mb-4`}>
        天气指标
      </h2>
      <div className="grid grid-cols-2 gap-4">
        {metrics.map((metric, index) => (
          <div
            key={index}
            className={`${getCardStyle(textColorTheme.backgroundType)} rounded-xl p-4 transition-all hover:scale-105 hover:shadow-md`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="flex items-center justify-center p-2 rounded-full">
                {metric.icon}
              </span>
              <p className={`text-xl font-medium ${textColorTheme.textColor.secondary}`}>
                {metric.label}
              </p>
            </div>
            <p className={`text-2xl font-bold ${textColorTheme.textColor.primary} text-right`}>
              {metric.value}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-4 pt-4">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className={textColorTheme.textColor.secondary}>风向</p>
            <p className={`font-semibold ${textColorTheme.textColor.primary}`}>
              {current.wind_dir} ({current.wind_degree}°)
            </p>
          </div>
          <div>
            <p className={textColorTheme.textColor.secondary}>云量</p>
            <p className={`font-semibold ${textColorTheme.textColor.primary}`}>
              {current.cloud}%
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
