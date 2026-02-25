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
  const isFoggy = weatherCondition.includes('雾');
  const isOvercast = weatherCondition.includes('阴');
  const isPartlyCloudy = !isOvercast && weatherCondition.includes('云');

  if (isSnowy || isRainy || isSunny) {
    return 'dark';
  }

  // Partly cloudy uses sky-colored backgrounds (blue/sunset/night) → light text
  if (isPartlyCloudy) {
    return 'dark';
  }

  // Overcast and foggy use light grey backgrounds → dark text
  if (isOvercast || isFoggy) {
    return 'light';
  }

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

/**
 * 获取带透明度的卡片背景样式
 * @param opacity 透明度百分比 (0-100)
 * @param backgroundType 背景类型 ('dark' 或 'light')
 */
export function getCardBackgroundStyle(opacity: number, backgroundType: BackgroundType = 'dark'): string {
  // 计算rgba值：从0（完全透明）到1（完全不透明）
  const alpha = (opacity / 100);
  
  if (backgroundType === 'dark') {
    // 深色背景：从透明调整到深色（黑色）
    return `rgba(0, 0, 0, ${alpha * 0.5})`;  // 最多50%的黑色透明度
  } else {
    // 浅色背景：从透明调整到白色
    return `rgba(255, 255, 255, ${alpha * 0.8})`;  // 最多80%的白色透明度
  }
}
