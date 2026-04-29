/**
 * MCP Weather Server
 * 
 * 使用 @modelcontextprotocol/sdk 创建 MCP Server，
 * 注册天气相关工具，供 LLM 通过 MCP 协议调用。
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getEnglishCityName, searchCities } from '@/app/utils/citySearch';
import type {
  CitySearchPanel,
  CurrentForecastPanel,
  Forecast30dPanel,
  WeatherAssistantPanel,
  WeatherErrorPanel,
} from '@/app/components/ChatBot/types';

const API_KEY = process.env.API_KEY;
const API_BASE_URL = process.env.API_BASE_URL;
const QWEATHER_API_KEY = process.env.QWEATHER_API_KEY;
const QWEATHER_API_BASE = process.env.QWEATHER_API_BASE;
const SCHEMA_VERSION = 'weather.assistant.v1' as const;
const MIN_FORECAST_DAYS = 1;
const WEATHER_API_DAYS = 3;
const MAX_FORECAST_DAYS = 30;

function panelId(kind: WeatherAssistantPanel['kind']): string {
  return `${kind}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function textContent(panel: WeatherAssistantPanel) {
  return [{ type: 'text' as const, text: JSON.stringify(panel) }];
}

function toNumber(value: unknown, fallback = 0): number {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeForecastDays(days: unknown): number {
  const n = Math.round(toNumber(days, 3));
  return Math.min(MAX_FORECAST_DAYS, Math.max(MIN_FORECAST_DAYS, n));
}

function currentForecastTitle(prefix: string, days: number): string {
  return `${prefix}与未来${days}天预报`;
}

function forecastTitle(days: number): string {
  return `未来${days}天天气预报`;
}

function buildErrorPanel(title: string, message: string, toolName?: string): WeatherErrorPanel {
  return {
    schemaVersion: SCHEMA_VERSION,
    id: panelId('error'),
    kind: 'error',
    title,
    message,
    toolName,
  };
}

function buildCurrentForecastPanel(
  data: any,
  title: string,
  requestedDays: number
): CurrentForecastPanel {
  const current = data.current ?? {};
  const location = data.location ?? {};
  const forecast = Array.isArray(data.forecast?.forecastday) ? data.forecast.forecastday : [];
  const todayHours = Array.isArray(forecast[0]?.hour) ? forecast[0].hour : [];
  const currentEpoch = toNumber(location.localtime_epoch ?? current.last_updated_epoch);

  const hourly = todayHours
    .filter((hour: any) => toNumber(hour.time_epoch) >= currentEpoch)
    .slice(0, 8)
    .map((hour: any) => ({
      time: String(hour.time ?? ''),
      tempC: toNumber(hour.temp_c),
      condition: String(hour.condition?.text ?? ''),
      icon: hour.condition?.icon ? String(hour.condition.icon) : undefined,
      rainChance: toNumber(hour.chance_of_rain),
    }));

  return {
    schemaVersion: SCHEMA_VERSION,
    id: panelId('current_forecast'),
    kind: 'current_forecast',
    title,
    requestedDays,
    location: {
      name: String(location.name ?? ''),
      region: location.region ? String(location.region) : undefined,
      country: location.country ? String(location.country) : undefined,
      lat: typeof location.lat === 'number' ? location.lat : undefined,
      lon: typeof location.lon === 'number' ? location.lon : undefined,
      localtime: location.localtime ? String(location.localtime) : undefined,
    },
    current: {
      tempC: toNumber(current.temp_c),
      feelsLikeC: toNumber(current.feelslike_c),
      condition: String(current.condition?.text ?? ''),
      icon: current.condition?.icon ? String(current.condition.icon) : undefined,
      humidity: toNumber(current.humidity),
      windKph: toNumber(current.wind_kph),
      windDir: String(current.wind_dir ?? ''),
      pressureMb: toNumber(current.pressure_mb),
      visibilityKm: toNumber(current.vis_km),
      uv: toNumber(current.uv),
      cloud: toNumber(current.cloud),
      precipMm: toNumber(current.precip_mm),
      lastUpdated: current.last_updated ? String(current.last_updated) : undefined,
    },
    daily: forecast.slice(0, requestedDays).map((day: any) => ({
      date: String(day.date ?? ''),
      condition: String(day.day?.condition?.text ?? ''),
      icon: day.day?.condition?.icon ? String(day.day.condition.icon) : undefined,
      minTempC: toNumber(day.day?.mintemp_c),
      maxTempC: toNumber(day.day?.maxtemp_c),
      rainChance: toNumber(day.day?.daily_chance_of_rain),
      humidity: toNumber(day.day?.avghumidity),
      uv: toNumber(day.day?.uv),
    })),
    hourly,
  };
}

function buildForecast30dPanel(
  data: any,
  longitude: number,
  latitude: number,
  requestedDays: number,
  locationName?: { name?: string; region?: string; country?: string }
): Forecast30dPanel {
  const daily = Array.isArray(data.daily) ? data.daily : [];

  return {
    schemaVersion: SCHEMA_VERSION,
    id: panelId('forecast_30d'),
    kind: 'forecast_30d',
    title: forecastTitle(requestedDays),
    requestedDays,
    location: {
      longitude,
      latitude,
      name: locationName?.name,
      region: locationName?.region,
      country: locationName?.country,
    },
    updateTime: data.updateTime ? String(data.updateTime) : undefined,
    daily: daily.slice(0, requestedDays).map((day: any) => ({
      date: String(day.fxDate ?? ''),
      textDay: String(day.textDay ?? ''),
      textNight: String(day.textNight ?? ''),
      tempMinC: toNumber(day.tempMin),
      tempMaxC: toNumber(day.tempMax),
      humidity: toNumber(day.humidity),
      precipMm: toNumber(day.precip),
      windDirDay: String(day.windDirDay ?? ''),
      windScaleDay: String(day.windScaleDay ?? ''),
      uvIndex: toNumber(day.uvIndex),
    })),
  };
}

async function fetchWeatherApiForecast(query: string) {
  if (!API_KEY || !API_BASE_URL) {
    throw new Error('天气 API 未配置，请检查环境变量 API_KEY 和 API_BASE_URL');
  }

  const url = `${API_BASE_URL}?key=${API_KEY}&q=${encodeURIComponent(query)}&days=${WEATHER_API_DAYS}&aqi=no&alerts=no&lang=zh`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`天气查询失败，HTTP 状态码: ${response.status}`);
  }

  return response.json();
}

async function fetchQWeather30d(longitude: number, latitude: number) {
  if (!QWEATHER_API_KEY || !QWEATHER_API_BASE) {
    throw new Error('和风天气 API 未配置，请检查环境变量 QWEATHER_API_KEY 和 QWEATHER_API_BASE');
  }

  const location = `${longitude.toFixed(2)},${latitude.toFixed(2)}`;
  const url = `${QWEATHER_API_BASE}?location=${location}&lang=zh`;
  const response = await fetch(url, {
    headers: {
      'X-QW-Api-Key': QWEATHER_API_KEY,
    },
  });

  if (!response.ok) {
    throw new Error(`30天预报查询失败，HTTP 状态码: ${response.status}`);
  }

  const data = await response.json();
  if (data.code !== '200') {
    throw new Error(`30天预报查询失败，错误码: ${data.code}`);
  }

  return data;
}

/**
 * 创建并配置 MCP Weather Server
 */
export function createWeatherServer(): McpServer {
  const server = new McpServer({
    name: 'weather-tools',
    version: '1.0.0',
  });

  // ============================================================
  // Tool 1: get_current_weather - 获取实时天气 + 可变天数预报
  // ============================================================
  server.registerTool(
    'get_current_weather',
    {
      description: '获取指定城市的天气预报，支持未来1到30天。内部兼容策略：1到3天使用3天接口并截取；4到30天使用30天接口并截取。用户问未来一周时传 days=7，问未来5天时传 days=5，未说明天数时传 days=3。',
      inputSchema: {
        city: z.string().describe('城市名称，支持中文（如"杭州"、"北京"）或英文（如"hangzhou"、"beijing"）'),
        days: z.number().min(1).max(30).optional().describe('预报天数，1到30。未来一周=7，未来5天=5，未说明默认3。'),
      },
    },
    async ({ city, days }) => {
      try {
        const forecastDays = normalizeForecastDays(days);

        // 将中文城市名转为英文
        const englishCity = getEnglishCityName(city);
        const weatherData = await fetchWeatherApiForecast(englishCity);
        const location = weatherData.location ?? {};
        const panel =
          forecastDays <= WEATHER_API_DAYS
            ? buildCurrentForecastPanel(
                weatherData,
                currentForecastTitle('实时天气', forecastDays),
                forecastDays
              )
            : buildForecast30dPanel(
                await fetchQWeather30d(toNumber(location.lon), toNumber(location.lat)),
                toNumber(location.lon),
                toNumber(location.lat),
                forecastDays,
                {
                  name: location.name ? String(location.name) : undefined,
                  region: location.region ? String(location.region) : undefined,
                  country: location.country ? String(location.country) : undefined,
                }
              );

        return {
          content: textContent(panel),
        };
      } catch (error) {
        const panel = buildErrorPanel(
          '天气查询出错',
          `天气查询出错: ${error instanceof Error ? error.message : '未知错误'}`,
          'get_current_weather'
        );
        return {
          content: textContent(panel),
          isError: true,
        };
      }
    }
  );

  // ============================================================
  // Tool 2: get_forecast_30d - 获取30天预报
  // ============================================================
  server.registerTool(
    'get_forecast_30d',
    {
      description: '获取指定位置未来1到30天的天气预报。需要提供经度和纬度坐标。返回每日最高温、最低温、天气状况、风力、湿度等信息。',
      inputSchema: {
        longitude: z.number().describe('经度，如 120.15'),
        latitude: z.number().describe('纬度，如 30.28'),
        days: z.number().min(1).max(30).optional().describe('预报天数，1到30。未来一周=7，未说明默认30。'),
      },
    },
    async ({ longitude, latitude, days }) => {
      try {
        const forecastDays = normalizeForecastDays(days ?? 30);
        const panel = buildForecast30dPanel(
          await fetchQWeather30d(longitude, latitude),
          longitude,
          latitude,
          forecastDays
        );

        return {
          content: textContent(panel),
        };
      } catch (error) {
        const panel = buildErrorPanel(
          '30天预报查询出错',
          `30天预报查询出错: ${error instanceof Error ? error.message : '未知错误'}`,
          'get_forecast_30d'
        );
        return {
          content: textContent(panel),
          isError: true,
        };
      }
    }
  );

  // ============================================================
  // Tool 3: get_weather_at_my_location - 根据经纬度获取当前位置天气
  // ============================================================
  server.registerTool(
    'get_weather_at_my_location',
    {
      description: '根据用户提供的经纬度坐标查询当前位置天气预报，支持未来1到30天。内部兼容策略：1到3天使用3天接口并截取；4到30天使用30天接口并截取。用户问未来一周时传 days=7，问未来5天时传 days=5。',
      inputSchema: {
        latitude: z.number().describe('纬度，如 30.28'),
        longitude: z.number().describe('经度，如 120.15'),
        days: z.number().min(1).max(30).optional().describe('预报天数，1到30。未来一周=7，未来5天=5，未说明默认3。'),
      },
    },
    async ({ latitude, longitude, days }) => {
      try {
        const forecastDays = normalizeForecastDays(days);
        const query = `${latitude},${longitude}`;
        const weatherData =
          forecastDays <= WEATHER_API_DAYS ? await fetchWeatherApiForecast(query) : null;
        const panel =
          forecastDays <= WEATHER_API_DAYS && weatherData
            ? buildCurrentForecastPanel(
                weatherData,
                currentForecastTitle('当前位置天气', forecastDays),
                forecastDays
              )
            : buildForecast30dPanel(
                await fetchQWeather30d(longitude, latitude),
                longitude,
                latitude,
                forecastDays
              );

        return {
          content: textContent(panel),
        };
      } catch (error) {
        const panel = buildErrorPanel(
          '当前位置天气查询出错',
          `天气查询出错: ${error instanceof Error ? error.message : '未知错误'}`,
          'get_weather_at_my_location'
        );
        return {
          content: textContent(panel),
          isError: true,
        };
      }
    }
  );

  // ============================================================
  // Tool 4: search_city - 搜索城市
  // ============================================================
  server.registerTool(
    'search_city',
    {
      description: '根据关键词搜索城市。支持中文和英文搜索。返回匹配的城市列表及其中英文名称。当用户输入的城市名不确定时，可先搜索确认。',
      inputSchema: {
        query: z.string().describe('搜索关键词，如"杭"、"shang"、"北京"'),
      },
    },
    async ({ query }) => {
      try {
        const results = searchCities(query, 10);

        if (results.length === 0) {
          const panel: CitySearchPanel = {
            schemaVersion: SCHEMA_VERSION,
            id: panelId('city_search'),
            kind: 'city_search',
            title: '城市搜索',
            query,
            results: [],
          };
          return {
            content: textContent(panel),
          };
        }

        const panel: CitySearchPanel = {
          schemaVersion: SCHEMA_VERSION,
          id: panelId('city_search'),
          kind: 'city_search',
          title: '城市搜索',
          query,
          results: results.map((city) => ({
            chineseName: city.chineseName,
            englishName: city.englishName,
          })),
        };

        return {
          content: textContent(panel),
        };
      } catch (error) {
        const panel = buildErrorPanel(
          '城市搜索出错',
          `城市搜索出错: ${error instanceof Error ? error.message : '未知错误'}`,
          'search_city'
        );
        return {
          content: textContent(panel),
          isError: true,
        };
      }
    }
  );

  return server;
}
