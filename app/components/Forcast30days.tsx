'use client';

import React, { useState, useEffect } from 'react';
import ReactECharts from 'echarts-for-react';
import type { TextColorTheme } from '@/app/utils/textColorTheme';
import { getCardStyle } from '@/app/utils/textColorTheme';
import Icon from '@/app/components/Icon';
import { ICONS } from '@/app/utils/icons';

interface TemperatureChartProps {
  location?: { lat: number; lon: number };
  textColorTheme: TextColorTheme;
}

interface DailyForecast {
  fxDate: string;
  sunrise: string;
  sunset: string;
  moonrise: string;
  moonset: string;
  moonPhase: string;
  moonPhaseIcon: string;
  tempMax: string;
  tempMin: string;
  iconDay: string;
  textDay: string;
  iconNight: string;
  textNight: string;
  wind360Day: string;
  windDirDay: string;
  windScaleDay: string;
  windSpeedDay: string;
  wind360Night: string;
  windDirNight: string;
  windScaleNight: string;
  windSpeedNight: string;
  humidity: string;
  precip: string;
  pressure: string;
  vis: string;
  cloud: string;
  uvIndex: string;
}

type ChartType = 'bar' | 'line';

export default function TemperatureChart({ location, textColorTheme }: TemperatureChartProps) {
  const [chartType, setChartType] = useState<ChartType>('bar');
  const [forecastData, setForecastData] = useState<DailyForecast[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState<DailyForecast | null>(null);

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
        console.log(response)
        
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
  const isDarkTheme = textColorTheme.backgroundType === 'dark';
  const titleColor = isDark ? '#ffffff' : '#0c4a6e';
  const axisColor = isDark ? '#e5e7eb' : '#374151';

  // Format date to Chinese format
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const days = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    return `${month}月${day}日 ${days[date.getDay()]}`;
  };

  // Disable background scroll when modal is open
  useEffect(() => {
    if (selectedDay) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [selectedDay]);

  // Handle ESC key to close modal
  useEffect(() => {
    if (!selectedDay) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setSelectedDay(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedDay]);

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
        notMerge={true}
        style={{ height: '400px', width: '100%' }}
        opts={{ renderer: 'svg' }}
        onEvents={{
          click: (params: any) => {
            if (params.componentType === 'series') {
              const index = params.dataIndex ?? params.value[0];
              if (forecastData[index]) {
                setSelectedDay(forecastData[index]);
              }
            } else if (params.componentType === 'xAxis') {
              const index = params.dataIndex;
              if (forecastData[index]) {
                setSelectedDay(forecastData[index]);
              }
            }
          }
        }}
      />
      
      <div className={`text-center mt-2 text-xs ${textColorTheme.textColor.secondary}`}>
        点击图表中的日期查看详细信息
      </div>

      {/* Detail Modal */}
      {selectedDay && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setSelectedDay(null)}
          />
          <div className={`relative w-full max-w-3xl overflow-hidden rounded-3xl border shadow-2xl ${isDarkTheme ? 'bg-gray-900/85 border-white/10 backdrop-blur-xl' : 'bg-white/90 border-white/50 backdrop-blur-xl'}`}>
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute inset-x-10 top-0 h-32 bg-gradient-to-b from-white/10 to-transparent blur-3xl" />
            </div>

            <div className="relative flex flex-col gap-4 p-6 md:p-8">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div>
                    <p className={`text-sm ${textColorTheme.textColor.secondary}`}>
                      {formatDate(selectedDay.fxDate)}
                    </p>
                    <p className={`text-3xl font-bold ${textColorTheme.textColor.primary}`}>
                      {selectedDay.tempMax}°C / {selectedDay.tempMin}°C
                    </p>
                    <p className={`text-base ${textColorTheme.textColor.muted}`}>
                      {selectedDay.textDay} / {selectedDay.textNight}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedDay(null)}
                  className={`rounded-full p-2 transition hover:rotate-90 ${isDarkTheme ? 'hover:bg-white/10 text-white' : 'hover:bg-gray-100 text-gray-600'}`}
                  aria-label="关闭天气详情"
                >
                  <Icon src={ICONS.close} className="w-6 h-6" title="关闭" />
                </button>
              </div>

              <div className="flex flex-wrap gap-2">
                <span className={`px-3 py-1 text-xs rounded-full border ${isDarkTheme ? 'border-white/15 bg-white/5 text-white' : 'border-sky-100 bg-sky-50 text-sky-700'}`}>
                  日出 {selectedDay.sunrise}
                </span>
                <span className={`px-3 py-1 text-xs rounded-full border ${isDarkTheme ? 'border-white/15 bg-white/5 text-white' : 'border-sky-100 bg-sky-50 text-sky-700'}`}>
                  日落 {selectedDay.sunset}
                </span>
                <span className={`px-3 py-1 text-xs rounded-full border ${isDarkTheme ? 'border-white/15 bg-white/5 text-white' : 'border-sky-100 bg-sky-50 text-sky-700'}`}>
                  {selectedDay.moonPhase}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {[
                  {
                    label: '降水/降雪',
                    value: `${selectedDay.precip} mm`,
                    sub: '日降水量',
                    icon: <Icon src={ICONS.precipitation} className="w-6 h-6 text-sky-400" title="降水" />
                  },
                  {
                    label: '湿度',
                    value: `${selectedDay.humidity}%`,
                    sub: '空气相对湿度',
                    icon: <Icon src={ICONS.humidity} className="w-6 h-6 text-blue-300" title="湿度" />
                  },
                  {
                    label: '云量',
                    value: `${selectedDay.cloud}%`,
                    sub: '天空云覆盖率',
                    icon: <Icon src={ICONS.cloudAmount} className="w-6 h-6 text-indigo-300" title="云量" />
                  },
                  {
                    label: '风速 / 阵风（白天）',
                    value: `${selectedDay.windSpeedDay} km/h`,
                    sub: `${selectedDay.windDirDay} ${selectedDay.windScaleDay}级`,
                    icon: <Icon src={ICONS.wind} className="w-6 h-6 text-emerald-400" title="风速" />
                  },
                  {
                    label: '风速 / 阵风（夜间）',
                    value: `${selectedDay.windSpeedNight} km/h`,
                    sub: `${selectedDay.windDirNight} ${selectedDay.windScaleNight}级`,
                    icon: <Icon src={ICONS.wind} className="w-6 h-6 text-emerald-400" title="风速" />
                  },
                  {
                    label: '风向（白天）',
                    value: `${selectedDay.windDirDay}`,
                    sub: `${selectedDay.wind360Day}°`,
                    icon: <Icon src={ICONS.windDirection} className="w-6 h-6 text-indigo-400" title="风向" />
                  },
                  {
                    label: '气压',
                    value: `${selectedDay.pressure} mb`,
                    sub: '海平面气压',
                    icon: <Icon src={ICONS.pressure} className="w-6 h-6 text-violet-400" title="气压" />
                  },
                  {
                    label: '能见度',
                    value: `${selectedDay.vis} km`,
                    sub: '水平能见距离',
                    icon: <Icon src={ICONS.visibility} className="w-6 h-6 text-amber-400" title="能见度" />
                  },
                  {
                    label: '紫外线',
                    value: `${selectedDay.uvIndex}`,
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
