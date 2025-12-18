import React from 'react';
import type { Current } from '@/app/types/weather';
import type { TextColorTheme } from '@/app/utils/textColorTheme';
import { getCardStyle } from '@/app/utils/textColorTheme';
import Icon from '@/app/components/Icon';
import { ICONS } from '@/app/utils/icons';

interface WeatherMetricsProps {
  current: Current;
  textColorTheme: TextColorTheme;
}

export default function WeatherMetrics({ current, textColorTheme }: WeatherMetricsProps) {
  const metrics = [
    {
      label: '湿度',
      value: `${current.humidity}%`,
      icon: <Icon src={ICONS.humidity} className="w-8 h-8 text-blue-500" title="湿度" />,
    },
    {
      label: '风速',
      value: `${Math.round(current.wind_kph)} km/h`,
      icon: <Icon src={ICONS.wind} className="w-8 h-8 text-emerald-500" title="风速" />,
    },
    {
      label: '气压',
      value: `${current.pressure_mb} mb`,
      icon: <Icon src={ICONS.pressure} className="w-8 h-8 text-violet-500" title="气压" />,
    },
    {
      label: '紫外线',
      value: current.uv.toString(),
      icon: <Icon src={ICONS.uv} className="w-8 h-8 text-amber-500" title="紫外线" />,
    },
    {
      label: '能见度',
      value: `${current.vis_km} km`,
      icon: <Icon src={ICONS.visibility} className="w-8 h-8 text-indigo-500" title="能见度" />,
    },
    {
      label: '降水量',
      value: `${current.precip_mm} mm`,
      icon: <Icon src={ICONS.precipitation} className="w-8 h-8 text-cyan-500" title="降水量" />,
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
