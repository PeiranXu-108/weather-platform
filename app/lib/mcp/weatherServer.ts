/**
 * MCP Weather Server
 * 
 * 使用 @modelcontextprotocol/sdk 创建 MCP Server，
 * 注册天气相关工具，供 LLM 通过 MCP 协议调用。
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getEnglishCityName, searchCities } from '@/app/utils/citySearch';

const API_KEY = process.env.API_KEY;
const API_BASE_URL = process.env.API_BASE_URL;
const QWEATHER_API_KEY = process.env.QWEATHER_API_KEY;
const QWEATHER_API_BASE = process.env.QWEATHER_API_BASE;

/**
 * 创建并配置 MCP Weather Server
 */
export function createWeatherServer(): McpServer {
  const server = new McpServer({
    name: 'weather-tools',
    version: '1.0.0',
  });

  // ============================================================
  // Tool 1: get_current_weather - 获取实时天气 + 3天预报
  // ============================================================
  server.registerTool(
    'get_current_weather',
    {
      description: '获取指定城市的实时天气信息和未来3天预报。支持中文和英文城市名。返回温度、体感温度、天气状况、湿度、风速、气压、能见度、紫外线等详细信息。',
      inputSchema: {
        city: z.string().describe('城市名称，支持中文（如"杭州"、"北京"）或英文（如"hangzhou"、"beijing"）'),
      },
    },
    async ({ city }) => {
      try {
        if (!API_KEY || !API_BASE_URL) {
          return {
            content: [{ type: 'text' as const, text: '天气 API 未配置，请检查环境变量 API_KEY 和 API_BASE_URL' }],
            isError: true,
          };
        }

        // 将中文城市名转为英文
        const englishCity = getEnglishCityName(city);
        const url = `${API_BASE_URL}?key=${API_KEY}&q=${encodeURIComponent(englishCity)}&days=3&aqi=no&alerts=no&lang=zh`;

        const response = await fetch(url);

        if (!response.ok) {
          return {
            content: [{ type: 'text' as const, text: `天气查询失败，HTTP 状态码: ${response.status}` }],
            isError: true,
          };
        }

        const data = await response.json();

        // 格式化当前天气
        const current = data.current;
        const location = data.location;
        const forecast = data.forecast?.forecastday || [];

        let result = `📍 ${location.name}（${location.country}）\n`;
        result += `🕐 当地时间：${location.localtime}\n\n`;
        result += `【当前天气】\n`;
        result += `天气：${current.condition.text}\n`;
        result += `温度：${current.temp_c}°C（体感 ${current.feelslike_c}°C）\n`;
        result += `湿度：${current.humidity}%\n`;
        result += `风速：${current.wind_kph} km/h（${current.wind_dir}）\n`;
        result += `气压：${current.pressure_mb} hPa\n`;
        result += `能见度：${current.vis_km} km\n`;
        result += `紫外线指数：${current.uv}\n`;
        result += `云量：${current.cloud}%\n`;
        result += `降水量：${current.precip_mm} mm\n`;

        // 格式化未来3天预报
        if (forecast.length > 0) {
          result += `\n【未来${forecast.length}天预报】\n`;
          for (const day of forecast) {
            result += `\n${day.date}：${day.day.condition.text}\n`;
            result += `  温度：${day.day.mintemp_c}°C ~ ${day.day.maxtemp_c}°C\n`;
            result += `  降雨概率：${day.day.daily_chance_of_rain}%\n`;
            result += `  湿度：${day.day.avghumidity}%\n`;
            result += `  紫外线：${day.day.uv}\n`;
          }
        }

        return {
          content: [{ type: 'text' as const, text: result }],
        };
      } catch (error) {
        return {
          content: [{ type: 'text' as const, text: `天气查询出错: ${error instanceof Error ? error.message : '未知错误'}` }],
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
      description: '获取指定位置未来30天的天气预报。需要提供经度和纬度坐标。返回每日最高温、最低温、天气状况、风力、湿度等信息。',
      inputSchema: {
        longitude: z.number().describe('经度，如 120.15'),
        latitude: z.number().describe('纬度，如 30.28'),
      },
    },
    async ({ longitude, latitude }) => {
      try {
        if (!QWEATHER_API_KEY || !QWEATHER_API_BASE) {
          return {
            content: [{ type: 'text' as const, text: '和风天气 API 未配置，请检查环境变量 QWEATHER_API_KEY 和 QWEATHER_API_BASE' }],
            isError: true,
          };
        }

        // 和风天气 location 格式为 "经度,纬度"
        const location = `${longitude.toFixed(2)},${latitude.toFixed(2)}`;
        const url = `${QWEATHER_API_BASE}?location=${location}&lang=zh`;

        const response = await fetch(url, {
          headers: {
            'X-QW-Api-Key': QWEATHER_API_KEY,
          },
        });

        if (!response.ok) {
          return {
            content: [{ type: 'text' as const, text: `30天预报查询失败，HTTP 状态码: ${response.status}` }],
            isError: true,
          };
        }

        const data = await response.json();

        if (data.code !== '200') {
          return {
            content: [{ type: 'text' as const, text: `30天预报查询失败，错误码: ${data.code}` }],
            isError: true,
          };
        }

        const daily = data.daily || [];
        let result = `📅 未来30天天气预报（经度: ${longitude}, 纬度: ${latitude}）\n\n`;

        // 只显示关键信息，避免过长
        for (const day of daily.slice(0, 15)) {
          result += `${day.fxDate}：${day.textDay}/${day.textNight}，${day.tempMin}°C~${day.tempMax}°C，湿度${day.humidity}%，${day.windDirDay}${day.windScaleDay}级\n`;
        }

        if (daily.length > 15) {
          result += `\n...（共${daily.length}天数据，已显示前15天）`;
        }

        return {
          content: [{ type: 'text' as const, text: result }],
        };
      } catch (error) {
        return {
          content: [{ type: 'text' as const, text: `30天预报查询出错: ${error instanceof Error ? error.message : '未知错误'}` }],
          isError: true,
        };
      }
    }
  );

  // ============================================================
  // Tool 3: search_city - 搜索城市
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
          return {
            content: [{ type: 'text' as const, text: `未找到匹配"${query}"的城市。请尝试使用完整的城市名或英文名。` }],
          };
        }

        let result = `找到 ${results.length} 个匹配的城市：\n\n`;
        for (const city of results) {
          result += `• ${city.chineseName}（${city.englishName}）\n`;
        }

        return {
          content: [{ type: 'text' as const, text: result }],
        };
      } catch (error) {
        return {
          content: [{ type: 'text' as const, text: `城市搜索出错: ${error instanceof Error ? error.message : '未知错误'}` }],
          isError: true,
        };
      }
    }
  );

  return server;
}
