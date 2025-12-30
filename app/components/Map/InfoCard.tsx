import { Current, Location } from "@/app/types/weather";
import { getCardStyle, TextColorTheme } from "@/app/utils/textColorTheme";

// 悬浮天气信息组件
export default function FloatingWeatherInfo({ 
    location, current, 
    loading, 
    textColorTheme 
  }: { 
    location: Location;
    current: Current | undefined;
    loading: boolean;
    textColorTheme: TextColorTheme;
  }) {
    if (!current && !loading) return null;
  
    return (
      loading ? null : <div className="absolute bottom-4 right-4 z-10">
        <div className="bg-white rounded-xl shadow-2xl p-2 min-w-[120px] border border-gray-200">
          {current ? (
            <>
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="text-xs text-gray-600 mb-1">
                    {location.name}
                  </p>
                  <div className="flex items-center gap-2">
                    <img 
                      src={`https:${current.condition.icon}`} 
                      alt={current.condition.text}
                      className="w-8 h-8"
                    />
                    <div>
                      <p className="text-xl font-bold text-gray-900">
                        {current.temp_c.toFixed(1)}°
                      </p>
                      <p className="text-xs text-gray-600">
                        {current.condition.text}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </>
          ) : null}
        </div>
      </div>
    );
  }