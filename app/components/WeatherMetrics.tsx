import React from 'react';
import type { Current } from '@/app/types/weather';

interface WeatherMetricsProps {
  current: Current;
}

export default function WeatherMetrics({ current }: WeatherMetricsProps) {
  const metrics = [
    {
      label: '湿度',
      value: `${current.humidity}%`,
      icon: '💧',
      color: 'bg-sky-50'
    },
    {
      label: '风速',
      value: `${Math.round(current.wind_kph)} km/h`,
      icon: '💨',
      color: 'bg-emerald-50'
    },
    {
      label: '气压',
      value: `${current.pressure_mb} mb`,
      icon: '🌡️',
      color: 'bg-violet-50'
    },
    {
      label: '紫外线',
      value: current.uv.toString(),
      icon: '☀️',
      color: 'bg-amber-50'
    },
    {
      label: '能见度',
      value: `${current.vis_km} km`,
      icon: '👁️',
      color: 'bg-indigo-50'
    },
    {
      label: '降水量',
      value: `${current.precip_mm} mm`,
      icon: '🌧️',
      color: 'bg-cyan-50'
    }
  ];

  return (
      <div className="bg-white/10 rounded-2xl shadow-xl p-6">
      <h2 className="text-xl font-bold text-sky-800 mb-4">
        天气指标
      </h2>
      <div className="grid grid-cols-2 gap-4">
        {metrics.map((metric, index) => (
          <div
            key={index}
            className={`${metric.color} rounded-xl p-4 transition-all bg-white/10 hover:scale-105 hover:shadow-md`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-2xl">{metric.icon}</span>
              <p className="text-xl font-medium text-slate-600">
                {metric.label}
              </p>
            </div>
            <p className="text-2xl font-bold text-slate-800 text-right">
              {metric.value}
            </p>
          </div>
        ))}
      </div>
      
      <div className="mt-4 pt-4">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-sky-600">风向</p>
            <p className="font-semibold text-sky-800">
              {current.wind_dir} ({current.wind_degree}°)
            </p>
          </div>
          <div>
            <p className="text-sky-600">云量</p>
            <p className="font-semibold text-sky-800">
              {current.cloud}%
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

