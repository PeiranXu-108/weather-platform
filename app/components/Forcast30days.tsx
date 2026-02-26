'use client';

import React, { useState, useEffect, useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import type { TextColorTheme } from '@/app/utils/textColorTheme';
import { getCardStyle, getCardBackgroundStyle } from '@/app/utils/textColorTheme';
import Icon from '@/app/models/Icon';
import { ICONS } from '@/app/utils/icons';
import SegmentedDropdown from '@/app/models/SegmentedDropdown';
import { getTemperatureColor } from '@/app/utils/utils';
import { fetchWeather30d } from '@/app/lib/api';

interface TemperatureChartProps {
  location?: { lat: number; lon: number };
  textColorTheme: TextColorTheme;
  opacity?: number;
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

type ChartType = 'bar' | 'line' | 'scatter' | 'pie';
type ViewType = 'chart' | 'table';

export default function TemperatureChart({ location, textColorTheme, opacity = 100 }: TemperatureChartProps) {
  const [chartType, setChartType] = useState<ChartType>('bar');
  const [viewType, setViewType] = useState<ViewType>('chart');
  const [forecastData, setForecastData] = useState<DailyForecast[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState<DailyForecast | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 639px)');
    setIsMobile(mq.matches);
    const fn = () => setIsMobile(mq.matches);
    mq.addEventListener('change', fn);
    return () => mq.removeEventListener('change', fn);
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        // 构建location参数
        const locationParam = location
          ? `${location.lon},${location.lat}`
          : '116.41,39.92'; // 默认北京

        const response = await fetchWeather30d(locationParam);
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
  // 计算温差（最高温度 - 最低温度）
  const tempRanges = forecastData.map(day => parseInt(day.tempMax) - parseInt(day.tempMin));

  const isBarChart = chartType === 'bar';
  const isScatterChart = chartType === 'scatter';
  const isPieChart = chartType === 'pie';

  // Baseline: first day's average temperature
  const baseline = avgTemps[0] || 0;

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

  // 散点图数据：每个点包含 [日期索引, 平均温度, 温差]
  const scatterData = isScatterChart
    ? forecastData.map((_, index) => [index, avgTemps[index], tempRanges[index]])
    : [];

  // 计算散点大小的范围（基于温差）
  const minRange = Math.min(...tempRanges);
  const maxRange = Math.max(...tempRanges);
  const rangeSpan = maxRange - minRange || 1; // 避免除以0

  // 统计天气分布、降温和降水
  const weatherStats = useMemo(() => {
    if (forecastData.length === 0) {
      return {
        weatherDistribution: [],
        coolingDays: 0,
        precipitationDays: 0,
      };
    }

    // 统计天气类型分布
    const weatherCount: Record<string, number> = {};
    forecastData.forEach(day => {
      const weather = day.textDay.trim();
      weatherCount[weather] = (weatherCount[weather] || 0) + 1;
    });

    // 转换为数组并按数量排序
    const weatherDistribution = Object.entries(weatherCount)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    // 统计降温次数（与前一天相比，最高温度下降）
    let coolingDays = 0;
    for (let i = 1; i < forecastData.length; i++) {
      const prevMax = parseInt(forecastData[i - 1].tempMax);
      const currMax = parseInt(forecastData[i].tempMax);
      if (currMax + 3 < prevMax) {
        coolingDays++;
      }
    }

    // 统计降水天数（precip > 0）
    const precipitationDays = forecastData.filter(day => {
      const precip = parseFloat(day.precip);
      return precip > 0;
    }).length;

    return {
      weatherDistribution,
      coolingDays,
      precipitationDays,
    };
  }, [forecastData]);

  // 饼状图颜色配置
  const pieColors = [
    '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
    '#06b6d4', '#84cc16', '#f97316', '#6366f1', '#ec4899',
    '#14b8a6', '#a855f7', '#22c55e', '#eab308', '#f43f5e'
  ];

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

  // Get current date for highlighting today
  const getTodayDateString = () => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  };

  // Generate calendar grid data
  const generateCalendarData = () => {
    if (forecastData.length === 0) return [];

    const firstDate = new Date(forecastData[0].fxDate);
    const lastDate = new Date(forecastData[forecastData.length - 1].fxDate);

    // Get first day of week for the first date (0 = Sunday, 1 = Monday, etc.)
    const firstDayOfWeek = firstDate.getDay();
    const adjustedFirstDay = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1; // Convert to Monday = 0

    // Create a map for quick lookup
    const forecastMap = new Map<string, DailyForecast>();
    forecastData.forEach(day => {
      forecastMap.set(day.fxDate, day);
    });

    const calendar: Array<{ date: Date; forecast: DailyForecast | null; isCurrentMonth: boolean }> = [];

    // Add empty cells for days before the first date
    for (let i = 0; i < adjustedFirstDay; i++) {
      const date = new Date(firstDate);
      date.setDate(date.getDate() - adjustedFirstDay + i);
      calendar.push({ date, forecast: null, isCurrentMonth: false });
    }

    // Add all forecast dates
    forecastData.forEach(day => {
      calendar.push({
        date: new Date(day.fxDate),
        forecast: day,
        isCurrentMonth: true
      });
    });

    // Fill remaining cells to complete the grid (6 rows x 7 columns = 42 cells)
    const remainingCells = 42 - calendar.length;
    for (let i = 1; i <= remainingCells; i++) {
      const date = new Date(lastDate);
      date.setDate(date.getDate() + i);
      calendar.push({ date, forecast: null, isCurrentMonth: false });
    }

    return calendar;
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

  const option = useMemo(() => {
    const titleFontSize = isMobile ? 14 : 18;
    const axisFontSize = isMobile ? 10 : 12;
    if (isPieChart) {
      return {
        title: {
          text: '30日天气分布',
          left: 'center',
          top: 10,
          textStyle: {
            fontSize: titleFontSize,
            fontWeight: 'bold',
            color: titleColor
          }
        },
        tooltip: {
          trigger: 'item',
          formatter: (params: any) => {
            return `${params.name}<br/>${params.value}天 (${params.percent}%)`;
          }
        },
        legend: {
          orient: 'vertical',
          left: 'left',
          top: 'middle',
          textStyle: {
            color: axisColor
          },
          formatter: (name: string) => {
            const item = weatherStats.weatherDistribution.find(w => w.name === name);
            return item ? `${name} (${item.value}天)` : name;
          }
        },
        series: [
          {
            name: '天气分布',
            type: 'pie',
            radius: ['40%', '70%'],
            center: ['60%', '55%'],
            avoidLabelOverlap: false,
            itemStyle: {
              borderRadius: 8,
              opacity: 0.3
            },
            label: {
              show: true,
              formatter: '{b}: {c}天',
              color: axisColor,
              fontSize: axisFontSize
            },
            emphasis: {
              label: {
                show: true,
                fontSize: 14,
                fontWeight: 'bold'
              },
              itemStyle: {
                shadowBlur: 10,
                shadowOffsetX: 0,
                shadowColor: 'rgba(0, 0, 0, 0.5)'
              }
            },
            data: weatherStats.weatherDistribution.map((item, index) => ({
              value: item.value,
              name: item.name,
              itemStyle: {
                color: pieColors[index % pieColors.length],
                opacity: 0.6
              }
            }))
          }
        ]
      };
    }

    return {
      title: {
        text: '30日天气预报',
        left: 'center',
        textStyle: {
          fontSize: titleFontSize,
          fontWeight: 'bold',
          color: titleColor
        }
      },
      tooltip: {
        trigger: isBarChart ? 'axis' : isScatterChart ? 'item' : 'axis',
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
          : isScatterChart
            ? (params: any) => {
              const index = params.dataIndex;
              return `${dates[index]}<br/>
                    平均温度: ${avgTemps[index]}°C<br/>
                    最高: ${maxTemps[index]}°C<br/>
                    最低: ${minTemps[index]}°C<br/>
                    温差: ${tempRanges[index]}°C<br/>
                    `;
            }
            : undefined,
        axisPointer: {
          type: isBarChart ? 'shadow' : 'cross'
        }
      },
      legend: {
        data: isBarChart ? [] : isScatterChart ? ['平均温度'] : ['最高温度', '最低温度', '平均温度'],
        bottom: 10,
        show: !isBarChart,
        textStyle: {
          color: axisColor
        }
      },
      grid: {
        left: isMobile ? '6%' : '3%',
        right: isMobile ? '6%' : '4%',
        bottom: isMobile ? '22%' : '15%',
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
        boundaryGap: isBarChart ? true : isScatterChart ? true : false,
        data: dates,
        axisLabel: {
          color: axisColor,
          rotate: 45,
          fontSize: axisFontSize
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
          color: axisColor,
          fontSize: axisFontSize
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
      ] : isScatterChart ? [
        {
          name: '平均温度',
          type: 'scatter',
          data: scatterData.map((item, index) => ({
            value: [item[0], item[1]], // [日期索引, 平均温度]
            symbolSize: ((item[2] as number - minRange) / rangeSpan * 50 + 10), // 根据温差计算大小，最小10，最大40
            itemStyle: {
              color: getTemperatureColor(avgTemps[index]),
              opacity: 0.7,
              borderColor: getTemperatureColor(avgTemps[index]),
              borderWidth: 2
            }
          })),
          symbol: 'circle',
          label: {
            show: true,
            formatter: (params: any) => {
              const index = params.value[0];
              return `${avgTemps[index]}°C`;
            },
            color: titleColor,
            fontSize: 10,
            fontWeight: 'bold',
            position: 'top'
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
  }, [isMobile, isPieChart, isBarChart, isScatterChart, weatherStats, pieColors, titleColor, axisColor, isDark, dates, maxTemps, minTemps, avgTemps, tempRanges, barData, scatterData, minRange, rangeSpan]);

  if (error) {
    return (
      <div className={`${getCardStyle(textColorTheme.backgroundType)} rounded-2xl shadow-xl p-6 h-full min-h-[320px] sm:min-h-[380px] relative flex items-center justify-center`}>
        <div className={`${textColorTheme.textColor.secondary}`}>加载失败: {error}</div>
      </div>
    );
  }

  const calendarData = generateCalendarData();
  const todayDateString = getTodayDateString();
  const weekDays = ['一', '二', '三', '四', '五', '六', '日'];

  return (
    <div className={`rounded-2xl shadow-xl p-6 h-full min-h-[320px] sm:min-h-[380px] relative flex flex-col`} style={{ backgroundColor: getCardBackgroundStyle(opacity, textColorTheme.backgroundType) }}>
      {/* View Type Selector */}
      <SegmentedDropdown
        textColorTheme={textColorTheme}
        mainButton={{
          value: viewType === 'chart' ? chartType : 'chart',
          label: viewType === 'chart'
            ? (chartType === 'bar' ? '柱状图' : chartType === 'line' ? '折线图' : chartType === 'scatter' ? '散点图' : '饼状图')
            : '图表',
          showChevron: viewType === 'chart',
          onClick: () => {
            if (viewType !== 'chart') {
              setViewType('chart');
            }
          },
        }}
        dropdownOptions={[
          { value: 'bar', label: '柱状图', icon: ICONS.chartBar },
          { value: 'line', label: '折线图', icon: ICONS.chartLine },
          { value: 'scatter', label: '散点图', icon: ICONS.chartScatter },
          { value: 'pie', label: '饼状图', icon: ICONS.chartPie },
        ]}
        otherButtons={[
          {
            value: 'table',
            label: '日历',
            onClick: () => {
              setViewType('table');
            },
          },
        ]}
        onSelect={(value) => {
          if (value === 'bar' || value === 'line' || value === 'scatter' || value === 'pie') {
            setChartType(value as ChartType);
            setViewType('chart');
          }
        }}
        showDropdown={viewType === 'chart'}
      />

      {viewType === 'chart' ? (
        <div className="flex-1 flex flex-col min-h-0">
          <div className="flex-1 min-h-[240px] sm:min-h-[280px]" style={{ minHeight: 0 }}>
            <ReactECharts
              option={option}
              notMerge={true}
              style={{ height: '100%', width: '100%' }}
              opts={{ renderer: 'svg' }}
              onEvents={isPieChart ? undefined : {
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
          </div>
          {/* 饼状图统计信息 - 显示在图表下方 */}
          {isPieChart && (
            <div className="mt-4 flex flex-wrap gap-4 justify-center text-sm">
              <div className={`${textColorTheme.textColor.primary} font-semibold`}>
                <span className={textColorTheme.textColor.secondary}>降温</span>
                {weatherStats.coolingDays}次，
              </div>
              <div className={`${textColorTheme.textColor.primary} font-semibold`}>
                <span className={textColorTheme.textColor.secondary}>降水</span>
                {weatherStats.precipitationDays}天
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="flex-1 flex flex-col overflow-hidden min-h-[280px] sm:min-h-[320px]">
          {/* Calendar Table View Title */}
          <h2 className={`text-lg font-semibold ${textColorTheme.textColor.primary} mb-3 text-center flex-shrink-0`}>
            30日天气预报
          </h2>

          {/* Calendar Table View */}
          <div
            className="flex-1 overflow-y-auto overflow-x-auto custom-scrollbar"
            style={{
              scrollbarWidth: 'thin',
              scrollbarColor: isDark ? 'rgba(255, 255, 255, 0.3) transparent' : 'rgba(0, 0, 0, 0.3) transparent'
            }}
          >
            <table className="w-full border-collapse">
              {/* Weekday Headers */}
              <thead>
                <tr>
                  {weekDays.map((day, index) => (
                    <th
                      key={index}
                      className={`p-2 text-center text-xs font-medium ${isDark ? 'text-gray-400' : 'text-gray-600'
                        }`}
                    >
                      {day}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: 6 }).map((_, rowIndex) => (
                  <tr key={rowIndex}>
                    {Array.from({ length: 7 }).map((_, colIndex) => {
                      const cellIndex = rowIndex * 7 + colIndex;
                      const cell = calendarData[cellIndex];
                      if (!cell) return <td key={colIndex} className="p-1" />;

                      const { date, forecast, isCurrentMonth } = cell;
                      const dateString = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
                      const isToday = dateString === todayDateString;
                      const dayNumber = date.getDate();

                      return (
                        <td
                          key={colIndex}
                          className={`p-1 ${!isCurrentMonth ? 'opacity-30' : ''
                            }`}
                        >
                          {forecast ? (
                            <button
                              type="button"
                              onClick={() => setSelectedDay(forecast)}
                              className={`w-full p-2 rounded-lg border transition-all text-left ${isToday
                                  ? isDark
                                    ? 'border-blue-400 bg-white/10'
                                    : 'border-blue-400 bg-white/20'
                                  : isDark
                                    ? 'border-white/10 bg-white/5 hover:bg-white/10'
                                    : 'border-gray-200 bg-white/20 hover:bg-white/30'
                                }`}
                            >
                              <div className={`text-xs font-semibold mb-1 ${isToday
                                  ? 'text-blue-600'
                                  : isDark
                                    ? 'text-white'
                                    : 'text-gray-900'
                                }`}>
                                {date.getMonth() + 1}月{date.getDate()}日
                              </div>
                              <div className={`text-xs mb-1 truncate ${isDark ? 'text-gray-300' : 'text-gray-700'
                                }`}>
                                {forecast.textDay}
                              </div>
                              <div className={`text-xs font-medium ${isDark ? 'text-gray-400' : 'text-gray-600'
                                }`}>
                                <span className={isDark ? 'text-white' : 'text-gray-900'}>
                                  {forecast.tempMax}°
                                </span>
                                {' / '}
                                <span className={isDark ? 'text-gray-400' : 'text-gray-500'}>
                                  {forecast.tempMin}°
                                </span>
                              </div>
                            </button>
                          ) : (
                            <div className={`w-full p-2 rounded-lg text-center ${isDark ? 'text-gray-600' : 'text-gray-400'
                              }`}>
                              {dayNumber}日
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {selectedDay && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setSelectedDay(null)}
          />
          <div className={`relative w-full max-w-3xl max-h-[90vh] overflow-hidden rounded-3xl border shadow-2xl flex flex-col ${isDarkTheme ? 'bg-gray-900/85 border-white/10 backdrop-blur-xl' : 'bg-white/90 border-white/50 backdrop-blur-xl'}`}>
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute inset-x-10 top-0 h-32 bg-gradient-to-b from-white/10 to-transparent blur-3xl" />
            </div>

            <div className="relative flex flex-col gap-4 p-4 sm:p-6 md:p-8 overflow-y-auto">
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
