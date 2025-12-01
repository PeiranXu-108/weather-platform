/**
 * Weather condition code to Chinese translation mapping
 * Based on WeatherAPI condition codes: https://www.weatherapi.com/docs/weather_conditions.json
 */

// Weather condition code to Chinese text mapping
export const WEATHER_CODE_MAP: Record<number, string> = {
  1000: '晴朗',
  1003: '部分多云',
  1006: '多云',
  1009: '阴天',
  1030: '薄雾',
  1063: '小雨',
  1066: '阵雪',
  1069: '雨夹雪',
  1072: '冻雨',
  1087: '雷暴',
  1114: '吹雪',
  1117: '暴雪',
  1135: '雾',
  1147: '冻雾',
  1150: '轻雾',
  1153: '轻雾',
  1168: '冻雾',
  1171: '浓冻雾',
  1180: '小阵雨',
  1183: '小阵雨',
  1186: '小阵雨',
  1189: '中阵雨',
  1192: '大阵雨',
  1195: '大阵雨',
  1198: '冻雨',
  1201: '中冻雨',
  1204: '小雨夹雪',
  1207: '中雨夹雪',
  1210: '小阵雪',
  1213: '小阵雪',
  1216: '中阵雪',
  1219: '中阵雪',
  1222: '大阵雪',
  1225: '大阵雪',
  1237: '冰雹',
  1240: '小阵雨',
  1243: '中阵雨',
  1246: '大阵雨',
  1249: '小阵雨夹雪',
  1252: '中阵雨夹雪',
  1255: '小阵雪',
  1258: '大阵雪',
  1261: '小冰雹',
  1264: '大冰雹',
  1273: '小雷阵雨',
  1276: '大雷阵雨',
  1279: '小雷阵雪',
  1282: '大雷阵雪',
};

// Fallback text mapping for common English weather descriptions
// This is a fallback in case API doesn't return Chinese text
export const WEATHER_TEXT_MAP: Record<string, string> = {
  'Sunny': '晴朗',
  'Clear': '晴朗',
  'Partly cloudy': '部分多云',
  'Cloudy': '多云',
  'Overcast': '阴天',
  'Mist': '薄雾',
  'Fog': '雾',
  'Freezing fog': '冻雾',
  'Light rain': '小雨',
  'Moderate rain': '中雨',
  'Heavy rain': '大雨',
  'Light snow': '小雪',
  'Moderate snow': '中雪',
  'Heavy snow': '大雪',
  'Light sleet': '小雨夹雪',
  'Moderate sleet': '中雨夹雪',
  'Heavy sleet': '大雨夹雪',
  'Light snow showers': '小阵雪',
  'Moderate snow showers': '中阵雪',
  'Heavy snow showers': '大阵雪',
  'Light rain showers': '小阵雨',
  'Moderate rain showers': '中阵雨',
  'Heavy rain showers': '大阵雨',
  'Thunderstorm': '雷暴',
  'Light drizzle': '毛毛雨',
  'Moderate drizzle': '中毛毛雨',
  'Heavy drizzle': '大毛毛雨',
  'Freezing drizzle': '冻毛毛雨',
  'Heavy freezing drizzle': '大冻毛毛雨',
  'Light freezing rain': '小冻雨',
  'Moderate freezing rain': '中冻雨',
  'Heavy freezing rain': '大冻雨',
  'Light rain shower': '小阵雨',
  'Moderate rain shower': '中阵雨',
  'Heavy rain shower': '大阵雨',
  'Torrential rain shower': '暴雨',
  'Light sleet showers': '小阵雨夹雪',
  'Moderate sleet showers': '中阵雨夹雪',
  'Heavy sleet showers': '大阵雨夹雪',
  'Light snow and rain': '小雨雪',
  'Moderate snow and rain': '中雨雪',
  'Heavy snow and rain': '大雨雪',
  'Light showers of ice pellets': '小冰雹',
  'Moderate showers of ice pellets': '中冰雹',
  'Heavy showers of ice pellets': '大冰雹',
  'Patches of freezing fog': '局部冻雾',
  'Shallow fog': '浅雾',
  'Partial fog': '部分雾',
  'Light thunderstorm': '小雷暴',
  'Moderate thunderstorm': '中雷暴',
  'Heavy thunderstorm': '大雷暴',
  'Thunderstorm with light rain': '小雷阵雨',
  'Thunderstorm with moderate rain': '中雷阵雨',
  'Thunderstorm with heavy rain': '大雷阵雨',
  'Thunderstorm with light drizzle': '小雷毛毛雨',
  'Thunderstorm with moderate drizzle': '中雷毛毛雨',
  'Thunderstorm with heavy drizzle': '大雷毛毛雨',
  'Thunderstorm with hail': '雷暴冰雹',
};

/**
 * Translate weather condition to Chinese
 * Priority: code mapping > text mapping > original text
 */
export function translateWeatherCondition(condition: { code: number; text: string }): string {
  // First try code-based mapping (most reliable)
  if (WEATHER_CODE_MAP[condition.code]) {
    return WEATHER_CODE_MAP[condition.code];
  }
  
  // Then try text-based mapping (fallback)
  const normalizedText = condition.text.trim();
  if (WEATHER_TEXT_MAP[normalizedText]) {
    return WEATHER_TEXT_MAP[normalizedText];
  }
  
  // If no mapping found, return original text (shouldn't happen with lang=zh, but safe fallback)
  return condition.text;
}

