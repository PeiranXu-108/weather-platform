'use client';

import React from 'react';
import ReactECharts from 'echarts-for-react';
import type { ForecastDay } from '@/app/types/weather';

interface TemperatureChartProps {
  forecastDays: ForecastDay[];
}

export default function TemperatureChart({ forecastDays }: TemperatureChartProps) {
  const dates = forecastDays.map(day => {
    const date = new Date(day.date);
    return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
  });

  const maxTemps = forecastDays.map(day => Math.round(day.day.maxtemp_c));
  const minTemps = forecastDays.map(day => Math.round(day.day.mintemp_c));
  const avgTemps = forecastDays.map(day => Math.round(day.day.avgtemp_c));

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
      trigger: 'axis',
      axisPointer: {
        type: 'cross'
      }
    },
    legend: {
      data: ['最高温度', '最低温度', '平均温度'],
      bottom: 10
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '15%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: dates
    },
    yAxis: {
      type: 'value',
      name: '温度 (°C)',
      axisLabel: {
        formatter: '{value}°C'
      }
    },
    series: [
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
    <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl p-6 border border-sky-100">
      <ReactECharts 
        option={option} 
        style={{ height: '400px', width: '100%' }}
        opts={{ renderer: 'svg' }}
      />
    </div>
  );
}

