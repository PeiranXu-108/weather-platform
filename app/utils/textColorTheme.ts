/**
 * 根据天气条件和时间判断背景类型，返回相应的字体颜色样式
 */

export type BackgroundType = 'dark' | 'light';

export interface TextColorTheme {
  backgroundType: BackgroundType;
  textColor: {
    primary: string;      // 主要文字颜色
    secondary: string;   // 次要文字颜色
    muted: string;       // 弱化文字颜色
    accent: string;      // 强调文字颜色
  };
}

/**
 * 判断背景类型
 * @param weatherCondition 天气状况（中文）
 * @param isSunset 是否在日落时段
 * @param isNight 是否在夜晚（优先使用 API 的 is_day 字段判断）
 * @param isDay API 的 is_day 字段（可选，1=白天，0=黑夜）
 */
export function getBackgroundType(
  weatherCondition: string,
  isSunset: boolean,
  isNight: boolean,
  isDay?: number
): BackgroundType {
  const isSnowy = weatherCondition.includes('雪');
  const isRainy = (weatherCondition.includes('雨') || weatherCondition.includes('雷'));
  const isSunny = weatherCondition.includes('晴');
  const isCloudy = weatherCondition.includes('云') || weatherCondition.includes('阴');
  const isFoggy = weatherCondition.includes('雾');
  
  // 深色背景：雪天、雨天、晴天（包括白天、日落、夜晚）
  if (isSnowy || isRainy || isSunny) {
    return 'dark';
  }
  
  // 浅色背景：阴天、雾天
  if (isCloudy || isFoggy) {
    return 'light';
  }
  
  // 默认深色背景
  return 'dark';
}

/**
 * 获取字体颜色主题
 * @param weatherCondition 天气状况（中文）
 * @param isSunset 是否在日落时段
 * @param isNight 是否在夜晚（优先使用 API 的 is_day 字段判断）
 * @param isDay API 的 is_day 字段（可选，1=白天，0=黑夜）
 */
export function getTextColorTheme(
  weatherCondition: string,
  isSunset: boolean,
  isNight: boolean,
  isDay?: number
): TextColorTheme {
  const backgroundType = getBackgroundType(weatherCondition, isSunset, isNight, isDay);
  console.log(backgroundType);
  if (backgroundType === 'dark') {
    // 深色背景使用浅色字体
    return {
      backgroundType: 'dark',
      textColor: {
        primary: 'text-white',           // 主要文字：白色
        secondary: 'text-gray-200',     // 次要文字：浅灰色
        muted: 'text-gray-300',          // 弱化文字：更浅灰色
        accent: 'text-blue-200',         // 强调文字：浅蓝色
      },
    };
  } else {
    // 浅色背景使用深色字体
    return {
      backgroundType: 'light',
      textColor: {
        primary: 'text-gray-900',       // 主要文字：深灰色
        secondary: 'text-gray-700',      // 次要文字：中灰色
        muted: 'text-gray-600',          // 弱化文字：浅灰色
        accent: 'text-sky-700',          // 强调文字：深蓝色
      },
    };
  }
}

/**
 * 获取背景卡片样式
 */
export function getCardStyle(backgroundType: BackgroundType): string {
  if (backgroundType === 'dark') {
    return 'bg-white/10';  // 深色背景：半透明白色
  } else {
    return 'bg-white/10';   // 浅色背景：半透明白色
  }
}
