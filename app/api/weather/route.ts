import { NextResponse } from 'next/server';
import type { WeatherResponse } from '@/app/types/weather';

const API_KEY = '456019e436434c55808130937252807';
const API_BASE_URL = 'https://api.weatherapi.com/v1/forecast.json';

export async function GET() {
  try {
    const url = `${API_BASE_URL}?key=${API_KEY}&q=hangzhou&days=3&aqi=no&alerts=no`;
    
    const response = await fetch(url, {
      next: { revalidate: 1800 } // Cache for 30 minutes
    });

    if (!response.ok) {
      throw new Error(`Weather API error: ${response.status}`);
    }

    const data: WeatherResponse = await response.json();
    
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching weather data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch weather data' },
      { status: 500 }
    );
  }
}

