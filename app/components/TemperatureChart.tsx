'use client';

import React, { useState, useEffect } from 'react';
import ReactECharts from 'echarts-for-react';
import type { TextColorTheme } from '@/app/utils/textColorTheme';
import { getCardStyle } from '@/app/utils/textColorTheme';

interface TemperatureChartProps {
  location?: { lat: number; lon: number };
  textColorTheme: TextColorTheme;
}

interface DailyForecast {
  fxDate: string;
  tempMax: string;
  tempMin: string;
  textDay: string;
  uvIndex: string;
}

type ChartType = 'bar' | 'line';

export default function TemperatureChart({ location, textColorTheme }: TemperatureChartProps) {
  const [chartType, setChartType] = useState<ChartType>('bar');
  const [forecastData, setForecastData] = useState<DailyForecast[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // 构建location参数
        const locationParam = location 
          ? `${location.lon},${location.lat}` 
          : '116.41,39.92'; // 默认北京
        
        const response = await fetch(`/api/weather/30d?location=${locationParam}`);
        
        if (!response.ok) {
          throw new Error('Failed to fetch 30-day forecast');
        }
        
        const data = await response.json();
        
        if (data.code !== '200') {
          throw new Error('API returned error code: ' + data.code);
        }
        
        setForecastData(data.daily || []);
      } catch (err) {
        console.error('Error fetching 30-day forecast:', err);
        setError(err instanceof Error ? err.message : 'Failed to load data');
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, [location]);

  const dates = forecastData.map(day => {
    const date = new Date(day.fxDate);
    return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
  });

  const maxTemps = forecastData.map(day => parseInt(day.tempMax));
  const minTemps = forecastData.map(day => parseInt(day.tempMin));
  const avgTemps = forecastData.map(day => Math.round((parseInt(day.tempMax) + parseInt(day.tempMin)) / 2));

  const isBarChart = chartType === 'bar';

  // Baseline: first day's average temperature
  const baseline = avgTemps[0] || 0;

  // Generate gradient color based on temperature
  const getTemperatureColor = (temp: number): string => {
    const minTemp = -10;
    const maxTemp = 40;
    const normalized = Math.max(0, Math.min(1, (temp - minTemp) / (maxTemp - minTemp)));
    
    const colorStops = [
      { t: 0.0, r: 59, g: 130, b: 246 },
      { t: 0.2, r: 6, g: 182, b: 212 },
      { t: 0.4, r: 16, g: 185, b: 129 },
      { t: 0.6, r: 234, g: 179, b: 8 },
      { t: 0.8, r: 249, g: 115, b: 22 },
      { t: 1.0, r: 239, g: 68, b: 68 }
    ];
    
    for (let i = 0; i < colorStops.length - 1; i++) {
      if (normalized >= colorStops[i].t && normalized <= colorStops[i + 1].t) {
        const t = (normalized - colorStops[i].t) / (colorStops[i + 1].t - colorStops[i].t);
        const r = Math.round(colorStops[i].r + t * (colorStops[i + 1].r - colorStops[i].r));
        const g = Math.round(colorStops[i].g + t * (colorStops[i + 1].g - colorStops[i].g));
        const b = Math.round(colorStops[i].b + t * (colorStops[i + 1].b - colorStops[i].b));
        return `rgb(${r}, ${g}, ${b})`;
      }
    }
    
    return `rgb(59, 130, 246)`;
  };

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

  const barData = isBarChart
    ? forecastData.map((_, index) => [index, minTemps[index], maxTemps[index], avgTemps[index]])
    : [];

  const isDark = textColorTheme.backgroundType === 'dark';
  const titleColor = isDark ? '#ffffff' : '#0c4a6e';
  const axisColor = isDark ? '#e5e7eb' : '#374151';

  const option = {
    title: {
      text: '30日天气预报',
      left: 'center',
      textStyle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: titleColor
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
      show: !isBarChart,
      textStyle: {
        color: axisColor
      }
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '15%',
      containLabel: true
    },
    dataZoom: [
      {
        type: 'inside',
        start: 0,
        end: 100,
        zoomOnMouseWheel: true,
        moveOnMouseMove: true,
        moveOnMouseWheel: true
      },
      {
        type: 'slider',
        start: 0,
        end: 100,
        height: 20,
        bottom: 40,
        handleSize: '80%',
        textStyle: {
          color: axisColor
        },
        borderColor: isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.2)',
        fillerColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'
      }
    ],
    xAxis: {
      type: 'category',
      boundaryGap: isBarChart ? true : false,
      data: dates,
      axisLabel: {
        color: axisColor,
        rotate: 45
      },
      axisLine: {
        lineStyle: {
          color: axisColor
        }
      }
    },
    yAxis: {
      type: 'value',
      name: '温度 (°C)',
      nameTextStyle: {
        color: axisColor
      },
      axisLabel: {
        formatter: (value: number) => `${value.toFixed(0)}°C`,
        color: axisColor
      },
      axisLine: {
        lineStyle: {
          color: axisColor
        }
      },
      splitLine: {
        show: true,
        lineStyle: {
          type: 'dashed',
          color: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
          width: 2
        }
      }
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
          color: titleColor,
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
      }
    ]
  };



  if (error) {
    return (
      <div className={`${getCardStyle(textColorTheme.backgroundType)} rounded-2xl shadow-xl p-6 h-full relative flex items-center justify-center`}>
        <div className={`${textColorTheme.textColor.secondary}`}>加载失败: {error}</div>
      </div>
    );
  }

  return (
    <div className={`${getCardStyle(textColorTheme.backgroundType)} rounded-2xl shadow-xl p-6 h-full relative`}>
      {/* Chart Type Selector */}
      <div className="absolute top-6 right-6 z-10">
        <select
          value={chartType}
          onChange={(e) => setChartType(e.target.value as ChartType)}
          className={`px-3 py-1.5 text-sm rounded-lg border-2 ${isDark ? 'border-white/30 bg-white/10' : 'border-sky-200 bg-white/10'} ${textColorTheme.textColor.primary} focus:outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-200 transition-all cursor-pointer`}
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
      
      <div className={`text-center mt-2 text-xs ${textColorTheme.textColor.secondary}`}>
        滑动或拖动下方滑块查看更多天数
      </div>
    </div>
  );
}
