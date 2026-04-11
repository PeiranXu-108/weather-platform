'use client';

import { Current, Location } from "@/app/types/weather";
import { TextColorTheme, readableTextShadowStyle } from "@/app/utils/textColorTheme";
import { useTranslatedText } from "@/app/hooks/useTranslatedText";

export type InfoCardVariant = 'default' | 'globe';

/** 天气卡片内容 */
export function WeatherCardContent({
  location,
  current,
  textColorTheme,
  onGoToWeather,
  enhanceReadableText = false,
}: {
  location: Location;
  current: Current;
  textColorTheme: TextColorTheme;
  /** 点击右上角箭头：进入该地点天气主页 */
  onGoToWeather?: () => void;
  /** 与地图标题一致：叠在复杂背景上时为文字加阴影 */
  enhanceReadableText?: boolean;
}) {
  const rawName = location?.name ?? "";
  const rawCondition = current.condition.text ?? "";
  const geo = {
    country: location?.country,
    region: location?.region,
    city: location?.name,
  };
  const displayLocationName = useTranslatedText(rawName, geo);
  const displayCondition = useTranslatedText(rawCondition, geo);

  const shellClass = [
    'backdrop-blur-md rounded-xl shadow-2xl p-2 min-w-[90px] border border-white/10 relative',
    onGoToWeather ? 'pr-8' : '',
  ].join(' ');

  const isDarkTheme = textColorTheme.backgroundType === 'dark';
  // 深色主题字为浅色，叠在地图/地球上时始终加轻微阴影，避免与底图糊在一起
  const useReadableShadow = enhanceReadableText || isDarkTheme;
  const tempShadow = readableTextShadowStyle('primary', useReadableShadow);
  const metaShadow = readableTextShadowStyle('secondary', useReadableShadow);
  const arrowClass = isDarkTheme
    ? 'text-gray-200 hover:bg-white/15 hover:text-white'
    : 'text-gray-600 hover:bg-black/5 hover:text-gray-900';

  return (
    <div className={shellClass}>
      {onGoToWeather && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onGoToWeather();
          }}
          className={`absolute top-1.5 right-1.5 flex h-7 w-7 min-w-[28px] min-h-[28px] items-center justify-center rounded-lg transition-colors ${arrowClass}`}
          title="查看该地点天气"
          aria-label="查看该地点天气"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </button>
      )}
      <div className="flex items-center justify-between mb-2">
        <div>
          <p
            className={`text-xs mb-1 ${textColorTheme.textColor.muted}`}
            style={metaShadow}
          >
            {displayLocationName}
          </p>
          <div className="flex items-center gap-2">
            <img
              src={`https:${current.condition.icon}`}
              alt={rawCondition}
              className="w-8 h-8"
            />
            <div>
              <p
                className={`text-lg sm:text-xl font-bold ${textColorTheme.textColor.primary}`}
                style={tempShadow}
              >
                {current.temp_c.toFixed(1)}°
              </p>
              <p
                className={`text-xs ${textColorTheme.textColor.secondary}`}
                style={metaShadow}
              >
                {displayCondition}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// 悬浮天气信息组件（右下角固定，展示视口中心天气）
export default function FloatingWeatherInfo({
  location,
  current,
  loading,
  textColorTheme,
  onGoToLocation,
  variant = 'default',
  enhanceReadableText = false,
}: {
  location: Location;
  current: Current | undefined;
  loading: boolean;
  textColorTheme: TextColorTheme;
  /** 切换到该地点（视口中心坐标）的天气主页 */
  onGoToLocation?: (lat: number, lon: number) => void;
  /** globe：仅用于提高层级，避免被地球 WebGL 画布遮挡；卡片样式与 default 相同 */
  variant?: InfoCardVariant;
  enhanceReadableText?: boolean;
}) {
  if (!current && !loading) return null;

  const goToWeatherHome =
    onGoToLocation && current
      ? () => onGoToLocation(location.lat, location.lon)
      : undefined;

  return (
    <div
      className={`absolute bottom-2 right-2 sm:bottom-4 sm:right-4 ${variant === 'globe' ? 'z-[25]' : 'z-10'}`}
    >
      {loading ? null : current ? (
        <WeatherCardContent
          location={location}
          current={current}
          textColorTheme={textColorTheme}
          onGoToWeather={goToWeatherHome}
          enhanceReadableText={enhanceReadableText}
        />
      ) : null}
    </div>
  );
}
