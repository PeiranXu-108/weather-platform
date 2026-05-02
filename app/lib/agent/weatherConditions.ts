export const WEATHER_CONDITION_VALUES = [
  'snow',
  'rain',
  'hot',
  'cold',
  'wind',
  'clear',
  'cloudy',
  'overcast',
  'fog',
  'haze',
  'thunder',
  'humid',
  'dry',
  'comfortable',
  'adverse',
] as const;

export type WeatherConditionIntent = (typeof WEATHER_CONDITION_VALUES)[number];

export const WEATHER_CONDITION_LABELS_ZH: Record<WeatherConditionIntent, string> = {
  snow: '降雪',
  rain: '降雨',
  hot: '高温',
  cold: '低温',
  wind: '大风',
  clear: '晴好',
  cloudy: '多云',
  overcast: '阴天',
  fog: '雾',
  haze: '霾',
  thunder: '雷雨',
  humid: '潮湿',
  dry: '干燥',
  comfortable: '舒适',
  adverse: '恶劣天气',
};

export const WEATHER_CONDITION_THRESHOLDS = {
  precipitationMm: 0.2,
  strongWindKph: 39,
  hotTempC: 35,
  coldTempC: 0,
  humidPercent: 80,
  dryPercent: 35,
  comfortableTempMinC: 10,
  comfortableTempMaxC: 28,
  comfortableHumidityMin: 35,
  comfortableHumidityMax: 75,
} as const;

const WEATHER_CONDITION_QUERY_PATTERNS: Array<[WeatherConditionIntent, RegExp]> = [
  ['comfortable', /(天气好|好天气|适合出门|适合户外|适合玩|舒适|舒服|宜人|comfortable|pleasant)/i],
  ['adverse', /(恶劣|糟糕|不好|不适合出门|天气差|坏天气|bad weather|severe|adverse)/i],
  ['thunder', /(雷|雷雨|雷阵雨|雷暴|thunder|storm)/i],
  ['snow', /(雪|降雪|下雪|snow|sleet|blizzard)/i],
  ['rain', /(雨|降雨|下雨|暴雨|rain|shower|drizzle)/i],
  ['fog', /(雾|大雾|有雾|fog|mist)/i],
  ['haze', /(霾|雾霾|空气差|沙尘|haze|smog|dust)/i],
  ['clear', /(天晴|晴天|晴朗|晴好|sunny|clear)/i],
  ['cloudy', /(多云|少云|云多|cloudy|partly cloudy|mostly cloudy)/i],
  ['overcast', /(阴天|阴沉|阴云|overcast)/i],
  ['humid', /(潮湿|湿度大|湿热|闷热|humid|muggy)/i],
  ['dry', /(干燥|太干|dry)/i],
  ['hot', /(高温|炎热|酷热|很热|哪里热|hot)/i],
  ['cold', /(低温|寒冷|严寒|很冷|哪里冷|cold|freezing)/i],
  ['wind', /(大风|风大|强风|windy|gale)/i],
];

export const WEATHER_CONDITION_TOOL_SCHEMA_DESCRIPTION =
  '天气条件。clear=晴朗/天晴；comfortable=天气好/舒适/适合出门；adverse=天气差/恶劣天气；hot=高温，只有用户明确问热/高温时使用。';

export function getWeatherConditionLabel(condition: WeatherConditionIntent): string {
  return WEATHER_CONDITION_LABELS_ZH[condition];
}

export function detectWeatherConditionIntent(text: string): WeatherConditionIntent | null {
  for (const [condition, pattern] of WEATHER_CONDITION_QUERY_PATTERNS) {
    if (pattern.test(text)) return condition;
  }
  return null;
}

interface MatchWeatherConditionInput {
  condition: WeatherConditionIntent;
  conditionText: string;
  tempC: number;
  precipMm: number;
  windKph: number;
  humidity: number;
}

export function matchesWeatherCondition(input: MatchWeatherConditionInput): boolean {
  const { condition, conditionText, tempC, precipMm, windKph, humidity } = input;
  const normalizedConditionText = conditionText.toLowerCase();
  const hasPrecipitation =
    precipMm > WEATHER_CONDITION_THRESHOLDS.precipitationMm ||
    /雨|雪|rain|shower|drizzle|snow|sleet/.test(normalizedConditionText);
  const hasStrongWind =
    /大风|强风|wind|gale/.test(normalizedConditionText) ||
    windKph >= WEATHER_CONDITION_THRESHOLDS.strongWindKph;

  if (condition === 'snow') return /雪|snow|sleet|blizzard|freezing rain/.test(normalizedConditionText);
  if (condition === 'rain') return /雨|rain|shower|drizzle|storm/.test(normalizedConditionText) || precipMm > WEATHER_CONDITION_THRESHOLDS.precipitationMm;
  if (condition === 'hot') return Number.isFinite(tempC) && tempC >= WEATHER_CONDITION_THRESHOLDS.hotTempC;
  if (condition === 'cold') return Number.isFinite(tempC) && tempC <= WEATHER_CONDITION_THRESHOLDS.coldTempC;
  if (condition === 'wind') return hasStrongWind;
  if (condition === 'cloudy') return /多云|少云|cloudy|partly cloudy|mostly cloudy/.test(normalizedConditionText);
  if (condition === 'overcast') return /阴|阴天|阴沉|overcast/.test(normalizedConditionText);
  if (condition === 'fog') return /雾|fog|mist/.test(normalizedConditionText);
  if (condition === 'haze') return /霾|雾霾|沙尘|haze|smog|dust/.test(normalizedConditionText);
  if (condition === 'thunder') return /雷|thunder|storm/.test(normalizedConditionText);
  if (condition === 'humid') return Number.isFinite(humidity) && humidity >= WEATHER_CONDITION_THRESHOLDS.humidPercent;
  if (condition === 'dry') return Number.isFinite(humidity) && humidity <= WEATHER_CONDITION_THRESHOLDS.dryPercent;

  if (condition === 'comfortable') {
    return (
      !hasPrecipitation &&
      !hasStrongWind &&
      (!Number.isFinite(tempC) ||
        (tempC >= WEATHER_CONDITION_THRESHOLDS.comfortableTempMinC &&
          tempC <= WEATHER_CONDITION_THRESHOLDS.comfortableTempMaxC)) &&
      (!Number.isFinite(humidity) ||
        (humidity >= WEATHER_CONDITION_THRESHOLDS.comfortableHumidityMin &&
          humidity <= WEATHER_CONDITION_THRESHOLDS.comfortableHumidityMax)) &&
      !/霾|雾霾|沙尘|haze|smog|dust|雷|thunder|storm/.test(normalizedConditionText)
    );
  }

  if (condition === 'adverse') {
    return (
      hasPrecipitation ||
      hasStrongWind ||
      /霾|雾霾|沙尘|haze|smog|dust|雾|fog|mist|雷|thunder|storm|blizzard/.test(normalizedConditionText) ||
      (Number.isFinite(tempC) &&
        (tempC >= WEATHER_CONDITION_THRESHOLDS.hotTempC ||
          tempC <= WEATHER_CONDITION_THRESHOLDS.coldTempC))
    );
  }

  return (
    /晴|少云|局部多云|sunny|clear|partly cloudy/.test(normalizedConditionText) &&
    precipMm <= WEATHER_CONDITION_THRESHOLDS.precipitationMm &&
    windKph < WEATHER_CONDITION_THRESHOLDS.strongWindKph &&
    (!Number.isFinite(tempC) ||
      (tempC > WEATHER_CONDITION_THRESHOLDS.coldTempC &&
        tempC < WEATHER_CONDITION_THRESHOLDS.hotTempC))
  );
}
