import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import type { WeatherResponse } from '@/app/types/weather';

import { authOptions } from '@/app/lib/auth';
import { recordApiUsage } from '@/app/lib/apiUsage';
import { isTimeoutError, withTimeoutSignal } from '@/app/lib/abort';

export const dynamic = 'force-dynamic';

const API_KEY = process.env.API_KEY;
const API_BASE_URL = process.env.API_BASE_URL;
const WEATHER_API_TIMEOUT_MS = 8_000;

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
    const timeout = withTimeoutSignal(request.signal, WEATHER_API_TIMEOUT_MS, 'WeatherAPI request timed out');
    let response: Response;

    try {
      response = await fetch(url, {
        signal: timeout.signal,
        next: { revalidate: 1800 } // Cache for 30 minutes
      });
    } finally {
      timeout.cleanup();
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Weather API error:', response.status, errorText);
      throw new Error(`Weather API error: ${response.status}`);
    }

    const data: WeatherResponse = await response.json();

    const session = await getServerSession(authOptions);
    const userId = (session?.user as { id?: string })?.id;
    if (userId) {
      await recordApiUsage(userId);
    }

    return NextResponse.json(data);
  } catch (error) {
    if (request.signal.aborted) {
      return new Response(null, { status: 499 });
    }

    console.error('Error fetching weather data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch weather data' },
      { status: isTimeoutError(error) ? 504 : 500 }
    );
  }
}
