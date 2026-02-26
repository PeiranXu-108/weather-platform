'use client';

import { Current, Location } from "@/app/types/weather";
import { TextColorTheme } from "@/app/utils/textColorTheme";
import { useTranslatedText } from "@/app/hooks/useTranslatedText";

/** 天气卡片内容（与 InfoCard 气泡样式一致，供右下角 InfoCard 与地图点击气泡复用） */
export function WeatherCardContent({
  location,
  current,
  textColorTheme,
}: {
  location: Location;
  current: Current;
  textColorTheme: TextColorTheme;
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

  return (
    <div className="backdrop-blur-md rounded-xl shadow-2xl p-2 min-w-[90px] border border-white/10">
      <div className="flex items-center justify-between mb-2">
        <div>
          <p className="text-xs text-gray-600 mb-1">{displayLocationName}</p>
          <div className="flex items-center gap-2">
            <img
              src={`https:${current.condition.icon}`}
              alt={rawCondition}
              className="w-8 h-8"
            />
            <div>
              <p className="text-lg sm:text-xl font-bold text-gray-900">
                {current.temp_c.toFixed(1)}°
              </p>
              <p className="text-xs text-gray-600">{displayCondition}</p>
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
}: {
  location: Location;
  current: Current | undefined;
  loading: boolean;
  textColorTheme: TextColorTheme;
}) {
  if (!current && !loading) return null;

  return (
    <div className="absolute bottom-2 right-2 sm:bottom-4 sm:right-4 z-10">
      {loading ? null : current ? (
        <WeatherCardContent location={location} current={current} textColorTheme={textColorTheme} />
      ) : null}
    </div>
  );
}
