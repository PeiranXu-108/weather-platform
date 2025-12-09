'use client';

import React, { useState } from 'react';
import ReactECharts from 'echarts-for-react';
import type { ForecastDay } from '@/app/types/weather';

interface TemperatureChartProps {
  forecastDays: ForecastDay[];
}

type ChartType = 'bar' | 'line';

export default function TemperatureChart({ forecastDays }: TemperatureChartProps) {
  const [chartType, setChartType] = useState<ChartType>('bar'); // Default to bar chart

  const dates = forecastDays.map(day => {
    const date = new Date(day.date);
    return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
  });

  const maxTemps = forecastDays.map(day => Math.round(day.day.maxtemp_c));
  const minTemps = forecastDays.map(day => Math.round(day.day.mintemp_c));
  const avgTemps = forecastDays.map(day => Math.round(day.day.avgtemp_c));

  const isBarChart = chartType === 'bar';

  // Baseline: first day's average temperature
  const baseline = avgTemps[0];

  // Generate gradient color based on temperature (cold to warm)
  // Color mapping: Blue (cold) -> Cyan -> Green -> Yellow -> Orange -> Red (hot)
  const getTemperatureColor = (temp: number): string => {
    // Temperature range: -10°C to 40°C
    const minTemp = -10;
    const maxTemp = 40;
    const normalized = Math.max(0, Math.min(1, (temp - minTemp) / (maxTemp - minTemp)));
    
    // Interpolate between color stops
    const colorStops = [
      { t: 0.0, r: 59, g: 130, b: 246 },   // Blue (#3b82f6) - very cold
      { t: 0.2, r: 6, g: 182, b: 212 },    // Cyan (#06b6d4) - cold
      { t: 0.4, r: 16, g: 185, b: 129 },  // Green (#10b981) - moderate
      { t: 0.6, r: 234, g: 179, b: 8 },   // Yellow (#eab308) - warm
      { t: 0.8, r: 249, g: 115, b: 22 },  // Orange (#f97316) - hot
      { t: 1.0, r: 239, g: 68, b: 68 }    // Red (#ef4444) - very hot
    ];
    
    // Find the two color stops to interpolate between
    for (let i = 0; i < colorStops.length - 1; i++) {
      if (normalized >= colorStops[i].t && normalized <= colorStops[i + 1].t) {
        const t = (normalized - colorStops[i].t) / (colorStops[i + 1].t - colorStops[i].t);
        const r = Math.round(colorStops[i].r + t * (colorStops[i + 1].r - colorStops[i].r));
        const g = Math.round(colorStops[i].g + t * (colorStops[i + 1].g - colorStops[i].g));
        const b = Math.round(colorStops[i].b + t * (colorStops[i + 1].b - colorStops[i].b));
        return `rgb(${r}, ${g}, ${b})`;
      }
    }
    
    // Fallback
    return `rgb(59, 130, 246)`;
  };

  // Build a smooth gradient from max (top) to min (bottom) using a single bar segment
  const createBarGradient = (minTemp: number, maxTemp: number, avgTemp: number) => {
    const range = Math.max(1, maxTemp - minTemp);
    const avgOffset = Math.min(1, Math.max(0, (maxTemp - avgTemp) / range));

    return {
      type: 'linear',
      x: 0,
      y: 0,
      x2: 0,
      y2: 1,
      colorStops: [
        { offset: 0, color: getTemperatureColor(maxTemp) },
        { offset: avgOffset, color: getTemperatureColor(avgTemp) },
        { offset: 1, color: getTemperatureColor(minTemp) }
      ]
    };
  };

  // Data for custom bars: [xIndex, min, max, avg]
  const barData = isBarChart
    ? forecastDays.map((_, index) => [index, minTemps[index], maxTemps[index], avgTemps[index]])
    : [];

  const option = {
    title: {
      text: '三日温度预报',
      left: 'center',
      textStyle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#0c4a6e'
      }
    },
    tooltip: {
      trigger: isBarChart ? 'axis' : 'axis',
      formatter: isBarChart 
        ? (params: any) => {
            if (Array.isArray(params)) {
              const barItem = params.find((item) => item.seriesName === '温度范围') ?? params[0];
              const index = barItem?.dataIndex ?? 0;
              return `${dates[index]}<br/>
                      最高: ${maxTemps[index]}°C<br/>
                      最低: ${minTemps[index]}°C<br/>
                      平均: ${avgTemps[index]}°C<br/>
                      `;
            }
            return '';
          }
        : undefined,
      axisPointer: {
        type: isBarChart ? 'shadow' : 'cross'
      }
    },
    legend: {
      data: isBarChart ? [] : ['最高温度', '最低温度', '平均温度'],
      bottom: 10,
      show: !isBarChart
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '15%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      boundaryGap: isBarChart ? true : false,
      data: dates
    },
    yAxis: {
      type: 'value',
      name: '温度 (°C)',
      axisLabel: {
        formatter: (value: number) => `${value.toFixed(0)}°C`
      },
      // Mark the baseline (0 point) with a line
      splitLine: {
        show: true,
        lineStyle: {
          type: 'dashed',
          color: '#94a3b8',
          width: 2
        }
      },
      // Add markLine to highlight baseline (thinner line)
      markLine: isBarChart ? {
        silent: true,
        lineStyle: {
          color: '#94a3b8',
          width: 1,
          type: 'dashed'
        },
        label: {
          formatter: `基线: ${baseline}°C`,
          position: 'end',
          fontSize: 11
        },
        data: [
          {
            yAxis: baseline,
            name: '基线'
          }
        ]
      } : undefined
    },
    series: isBarChart ? [
      {
        name: '温度范围',
        type: 'custom',
        renderItem: (params: any, api: any) => {
          const categoryIndex = api.value(0);
          const min = api.value(1);
          const max = api.value(2);
          const avg = api.value(3);

          const start = api.coord([categoryIndex, max]);
          const end = api.coord([categoryIndex, min]);
          const barWidth = api.size([1, 0])[0] * 0.4;
          const x = start[0] - barWidth / 2;
          const y = start[1];
          const height = end[1] - start[1];

          return {
            type: 'rect',
            shape: { x, y, width: barWidth, height },
            style: {
              fill: createBarGradient(min, max, avg),
              stroke: 'transparent'
            }
          };
        },
        encode: { x: 0, y: [1, 2] },
        data: barData,
        tooltip: {
          valueFormatter: (value: number) => `${value}°C`
        },
        label: {
          show: true,
          position: 'top',
          formatter: (params: any) => {
            const avg = params.value[3];
            return `${avg}°C`;
          },
          color: '#0c4a6e',
          fontSize: 12,
          fontWeight: 'bold'
        }
      }
    ] : [
      {
        name: '最高温度',
        type: 'line',
        data: maxTemps,
        smooth: true,
        itemStyle: {
          color: '#f97316'
        },
        lineStyle: {
          width: 3
        },
        symbol: 'circle',
        symbolSize: 8
      },
      {
        name: '最低温度',
        type: 'line',
        data: minTemps,
        smooth: true,
        itemStyle: {
          color: '#0ea5e9'
        },
        lineStyle: {
          width: 3
        },
        symbol: 'circle',
        symbolSize: 8
      },
      {
        name: '平均温度',
        type: 'line',
        data: avgTemps,
        smooth: true,
        itemStyle: {
          color: '#14b8a6'
        },
        lineStyle: {
          width: 2,
          type: 'dashed'
        },
        symbol: 'diamond',
        symbolSize: 8
      }
    ]
  };

  return (
    <div className="bg-white/10 rounded-2xl shadow-xl p-6 h-full relative">
      {/* Chart Type Selector */}
      <div className="absolute top-6 right-6 z-10">
        <select
          value={chartType}
          onChange={(e) => setChartType(e.target.value as ChartType)}
          className="px-3 py-1.5 text-sm rounded-lg border-2 border-sky-200 bg-white/10 text-sky-700 focus:outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-200 transition-all cursor-pointer"
        >
          <option value="bar">柱状图</option>
          <option value="line">折线图</option>
        </select>
      </div>
      
      <ReactECharts 
        option={option} 
        style={{ height: '400px', width: '100%' }}
        opts={{ renderer: 'svg' }}
      />
    </div>
  );
}
