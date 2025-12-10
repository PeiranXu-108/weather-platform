'use client';

import React from 'react';
import ReactECharts from 'echarts-for-react';
import type { Hour } from '@/app/types/weather';
import type { TextColorTheme } from '@/app/utils/textColorTheme';
import { getCardStyle } from '@/app/utils/textColorTheme';

interface HourlyChartProps {
  hourlyData: Hour[];
  textColorTheme: TextColorTheme;
}

export default function HourlyChart({ hourlyData, textColorTheme }: HourlyChartProps) {
  // Get next 24 hours from current time
  const next24Hours = hourlyData.slice(0, 24);

  const hours = next24Hours.map(hour => {
    const date = new Date(hour.time);
    return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  });

  const temperatures = next24Hours.map(hour => Math.round(hour.temp_c));
  const feelsLike = next24Hours.map(hour => Math.round(hour.feelslike_c));

  const isDark = textColorTheme.backgroundType === 'dark';
  const titleColor = isDark ? '#ffffff' : '#0c4a6e';
  const axisColor = isDark ? '#e5e7eb' : '#374151';
  
  const option = {
    title: {
      text: '24小时温度预报',
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
          result += `${param.marker}${param.seriesName}：${param.value}°C<br/>`;
        });
        return result;
      }
    },
    legend: {
      data: ['温度', '体感温度'],
      bottom: 10
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
      name: '温度 (°C)',
      nameTextStyle: {
        color: axisColor
      },
      axisLabel: {
        formatter: '{value}°C',
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
        name: '温度',
        type: 'line',
        data: temperatures,
        smooth: true,
        itemStyle: {
          color: '#fb923c'
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
              { offset: 0, color: 'rgba(251, 146, 60, 0.4)' },
              { offset: 1, color: 'rgba(251, 146, 60, 0.05)' }
            ]
          }
        },
        symbol: 'circle',
        symbolSize: 6
      },
      {
        name: '体感温度',
        type: 'line',
        data: feelsLike,
        smooth: true,
        itemStyle: {
          color: '#a78bfa'
        },
        lineStyle: {
          width: 2,
          type: 'dashed'
        },
        symbol: 'circle',
        symbolSize: 4
      }
    ]
  };

  return (
    <div className={`${getCardStyle(textColorTheme.backgroundType)} rounded-2xl shadow-xl p-6`}>
      <ReactECharts 
        option={option} 
        style={{ height: '400px', width: '100%' }}
        opts={{ renderer: 'svg' }}
      />
    </div>
  );
}

