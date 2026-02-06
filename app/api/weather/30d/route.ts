import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';

import { authOptions } from '@/app/lib/auth';
import { recordApiUsage } from '@/app/lib/apiUsage';

// 和风天气30日预报API的响应类型
export interface QWeather30DayDaily {
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

export interface QWeather30DayResponse {
  code: string;
  updateTime: string;
  fxLink: string;
  daily: QWeather30DayDaily[];
}

const QWEATHER_API_KEY = process.env.QWEATHER_API_KEY;
const QWEATHER_API_BASE = process.env.QWEATHER_API_BASE;

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    
    // 获取 location 参数（格式：纬度,经度）
    const location = searchParams.get('location')
    
    const url = `${QWEATHER_API_BASE}?location=${location}&lang=zh`;
    
    const response = await fetch(url, {
      headers: {
        'X-QW-Api-Key': QWEATHER_API_KEY || ''
      },
      next: { revalidate: 3600 } // Cache for 1 hour
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('QWeather 30d API error:', response.status, errorText);
      throw new Error(`QWeather API error: ${response.status}`);
    }

    const data: QWeather30DayResponse = await response.json();
    
    if (data.code !== '200') {
      console.error('QWeather API returned error code:', data.code);
      throw new Error(`QWeather API error code: ${data.code}`);
    }

    const session = await getServerSession(authOptions);
    const userId = (session?.user as { id?: string })?.id;
    if (userId) {
      await recordApiUsage(userId);
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching 30-day weather data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch 30-day weather data' },
      { status: 500 }
    );
  }
}
