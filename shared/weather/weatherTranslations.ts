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
  1183: '小阵雨',
  1189: '中阵雨',
  1195: '大阵雨',
  1213: '小雪',
  1219: '中雪',
  1225: '大雪',
  1273: '小雷阵雨',
  1276: '大雷阵雨',
};

export const WEATHER_TEXT_MAP: Record<string, string> = {
  Sunny: '晴朗',
  Clear: '晴朗',
  'Partly cloudy': '部分多云',
  Cloudy: '多云',
  Overcast: '阴天',
  Mist: '薄雾',
  Fog: '雾',
  'Light rain': '小雨',
  'Moderate rain': '中雨',
  'Heavy rain': '大雨',
  'Light snow': '小雪',
  'Moderate snow': '中雪',
  'Heavy snow': '大雪',
  Thunderstorm: '雷暴',
};

export function translateWeatherCondition(condition: { code: number; text: string }): string {
  return WEATHER_CODE_MAP[condition.code] ?? WEATHER_TEXT_MAP[condition.text.trim()] ?? condition.text;
}
