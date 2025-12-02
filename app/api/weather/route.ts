import { NextRequest, NextResponse } from 'next/server';
import type { WeatherResponse } from '@/app/types/weather';

const API_KEY = process.env.API_KEY;
const API_BASE_URL = process.env.API_BASE_URL;

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    
    // Support both city name and coordinates (lat,lon)
    let query: string;
    const city = searchParams.get('city');
    const lat = searchParams.get('lat');
    const lon = searchParams.get('lon');
    
    if (lat && lon) {
      // Use coordinates if provided
      query = `${lat},${lon}`;
    } else {
      // Use city name, default to hangzhou
      query = city || 'hangzhou';
    }
    
    const url = `${API_BASE_URL}?key=${API_KEY}&q=${encodeURIComponent(query)}&days=3&aqi=no&alerts=no&lang=zh`;
    
    const response = await fetch(url, {
      next: { revalidate: 1800 } // Cache for 30 minutes
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Weather API error:', response.status, errorText);
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

