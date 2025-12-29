'use client';

import React, { useState, useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import type { Hour } from '@/app/types/weather';
import type { TextColorTheme } from '@/app/utils/textColorTheme';
import { getCardStyle } from '@/app/utils/textColorTheme';
import SegmentedDropdown from '@/app/models/SegmentedDropdown';

interface HourlyChartProps {
  hourlyData: Hour[];
  textColorTheme: TextColorTheme;
}

type DataType = 
  | 'temperature' 
  | 'humidity' 
  | 'wind' 
  | 'pressure' 
  | 'precipitation' 
  | 'visibility' 
  | 'cloud' 
  | 'uv' 
  | 'gust' 
  | 'dewpoint';

interface DataTypeConfig {
  label: string;
  unit: string;
  yAxisName: string;
  formatter: (value: number) => string;
  extractor: (hour: Hour) => number;
  color: string;
  areaColor: string;
}

export default function HourlyChart({ hourlyData, textColorTheme }: HourlyChartProps) {
  const [selectedDataType, setSelectedDataType] = useState<DataType>('temperature');

  // Get next 24 hours from current time
  const next24Hours = hourlyData.slice(0, 24);

  const hours = next24Hours.map(hour => {
    const date = new Date(hour.time);
    return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  });

  const isDark = textColorTheme.backgroundType === 'dark';
  const titleColor = isDark ? '#ffffff' : '#0c4a6e';
  const axisColor = isDark ? '#e5e7eb' : '#374151';

  // Data type configurations
  const dataTypeConfigs: Record<DataType, DataTypeConfig> = {
    temperature: {
      label: '温度',
      unit: '°C',
      yAxisName: '温度 (°C)',
      formatter: (v) => `${v}°C`,
      extractor: (h) => h.temp_c,
      color: '#fb923c',
      areaColor: 'rgba(251, 146, 60, 0.4)'
    },
    humidity: {
      label: '湿度',
      unit: '%',
      yAxisName: '湿度 (%)',
      formatter: (v) => `${v}%`,
      extractor: (h) => h.humidity,
      color: '#3b82f6',
      areaColor: 'rgba(59, 130, 246, 0.4)'
    },
    wind: {
      label: '风速',
      unit: 'km/h',
      yAxisName: '风速 (km/h)',
      formatter: (v) => `${v} km/h`,
      extractor: (h) => h.wind_kph,
      color: '#10b981',
      areaColor: 'rgba(16, 185, 129, 0.4)'
    },
    pressure: {
      label: '气压',
      unit: 'mb',
      yAxisName: '气压 (mb)',
      formatter: (v) => `${v} mb`,
      extractor: (h) => h.pressure_mb,
      color: '#8b5cf6',
      areaColor: 'rgba(139, 92, 246, 0.4)'
    },
    precipitation: {
      label: '降水量',
      unit: 'mm',
      yAxisName: '降水量 (mm)',
      formatter: (v) => `${v} mm`,
      extractor: (h) => h.precip_mm,
      color: '#06b6d4',
      areaColor: 'rgba(6, 182, 212, 0.4)'
    },
    visibility: {
      label: '能见度',
      unit: 'km',
      yAxisName: '能见度 (km)',
      formatter: (v) => `${v} km`,
      extractor: (h) => h.vis_km,
      color: '#f59e0b',
      areaColor: 'rgba(245, 158, 11, 0.4)'
    },
    cloud: {
      label: '云量',
      unit: '%',
      yAxisName: '云量 (%)',
      formatter: (v) => `${v}%`,
      extractor: (h) => h.cloud,
      color: '#6366f1',
      areaColor: 'rgba(99, 102, 241, 0.4)'
    },
    uv: {
      label: '紫外线指数',
      unit: '',
      yAxisName: '紫外线指数',
      formatter: (v) => `${v}`,
      extractor: (h) => h.uv,
      color: '#ef4444',
      areaColor: 'rgba(239, 68, 68, 0.4)'
    },
    gust: {
      label: '阵风',
      unit: 'km/h',
      yAxisName: '阵风 (km/h)',
      formatter: (v) => `${v} km/h`,
      extractor: (h) => h.gust_kph,
      color: '#14b8a6',
      areaColor: 'rgba(20, 184, 166, 0.4)'
    },
    dewpoint: {
      label: '露点',
      unit: '°C',
      yAxisName: '露点 (°C)',
      formatter: (v) => `${v}°C`,
      extractor: (h) => h.dewpoint_c,
      color: '#84cc16',
      areaColor: 'rgba(132, 204, 22, 0.4)'
    }
  };

  const currentConfig = dataTypeConfigs[selectedDataType];
  const chartData = useMemo(() => {
    return next24Hours.map(dataTypeConfigs[selectedDataType].extractor);
  }, [next24Hours, selectedDataType]);

  // Prepare dropdown options
  const dropdownOptions = Object.entries(dataTypeConfigs).map(([key, config]) => ({
    value: key,
    label: config.label,
  }));
  
  const option = useMemo(() => {
    const config = dataTypeConfigs[selectedDataType];
    return {
      title: {
        text: `24小时${config.label}预报`,
        left: 'center',
        textStyle: {
          fontSize: 18,
          fontWeight: 'bold',
          color: titleColor
        }
      },
      tooltip: {
        trigger: 'axis',
        axisPointer: {
          type: 'cross'
        },
        formatter: function(params: any) {
          let result = `<strong>${params[0].axisValue}</strong><br/>`;
          params.forEach((param: any) => {
            result += `${param.marker}${param.seriesName}：${config.formatter(param.value)}<br/>`;
          });
          return result;
        }
      },
      legend: {
        data: [config.label],
        bottom: 10,
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
          end: 50
        },
        {
          start: 0,
          end: 50,
          height: 20,
          bottom: 50
        }
      ],
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: hours,
        axisLabel: {
          rotate: 45,
          interval: 2,
          color: axisColor
        },
        axisLine: {
          lineStyle: {
            color: axisColor
          }
        }
      },
      yAxis: {
        type: 'value',
        name: config.yAxisName,
        nameTextStyle: {
          color: axisColor
        },
        axisLabel: {
          formatter: (value: number) => config.formatter(value),
          color: axisColor
        },
        axisLine: {
          lineStyle: {
            color: axisColor
          }
        },
        splitLine: {
          lineStyle: {
            color: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'
          }
        }
      },
      series: [
        {
          name: config.label,
          type: 'line',
          data: chartData,
          smooth: true,
          itemStyle: {
            color: config.color
          },
          lineStyle: {
            width: 3
          },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: config.areaColor },
                { offset: 1, color: config.areaColor.replace('0.4', '0.05') }
              ]
            }
          },
          symbol: 'circle',
          symbolSize: 6
        }
      ]
    };
  }, [hours, chartData, selectedDataType, titleColor, axisColor, isDark]);

  return (
    <div className={`${getCardStyle(textColorTheme.backgroundType)} rounded-2xl shadow-xl p-6 relative`}>
      {/* Dropdown selector in top right */}
      <SegmentedDropdown
        textColorTheme={textColorTheme}
        mainButton={{
          value: selectedDataType,
          label: currentConfig.label,
        }}
        dropdownOptions={dropdownOptions}
        onSelect={(value) => setSelectedDataType(value as DataType)}
      />

      <ReactECharts 
        option={option} 
        style={{ height: '400px', width: '100%' }}
        opts={{ renderer: 'svg' }}
      />
    </div>
  );
}

