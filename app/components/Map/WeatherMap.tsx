'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import type { Location, Current } from '@/app/types/weather';
import type { TextColorTheme } from '@/app/utils/textColorTheme';
import { getCardStyle } from '@/app/utils/textColorTheme';
import FloatingWeatherInfo from './InfoCard';
import { getTemperatureColor } from '@/app/utils/utils';

interface WeatherMapProps {
  location: Location;
  textColorTheme: TextColorTheme;
}

declare global {
  interface Window {
    AMap: any;
  }
}

const Key = process.env.NEXT_PUBLIC_AMAP_KEY 
const SecurityJsCode = process.env.NEXT_PUBLIC_AMAP_SECURITY_JS_CODE

const centerMarkerSize = 42;
const defaultCenterMarkerBorder = '#9be16a';

const formatCenterTemp = (current?: Current | null) => {
  if (!current || typeof current.temp_c !== 'number' || Number.isNaN(current.temp_c)) {
    return '--';
  }
  return `${Math.round(current.temp_c)}`;
};

const getCenterMarkerBorderColor = (current?: Current | null) => {
  if (!current || typeof current.temp_c !== 'number' || Number.isNaN(current.temp_c)) {
    return defaultCenterMarkerBorder;
  }
  return getTemperatureColor(current.temp_c);
};

const buildCenterMarkerContent = (tempText: string, borderColor: string) => `
  <div style="
    width: ${centerMarkerSize}px;
    height: ${centerMarkerSize}px;
    border-radius: 50%;
    background: #ffffff;
    border: 4px solid ${borderColor};
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.18);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 18px;
    font-weight: 700;
    color: #1f2937;
    line-height: 1;
  ">${tempText}°</div>
`;

export default function WeatherMap({ location, textColorTheme }: WeatherMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const centerMarkerRef = useRef<any>(null);
  const scriptLoadedRef = useRef(false);
  const [centerWeather, setCenterWeather] = useState<{ location: Location; current: Current } | null>(null);
  const [loadingWeather, setLoadingWeather] = useState(false);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // 获取地图中心点的天气数据
  const fetchCenterWeather = useCallback(async (lat: number, lon: number) => {
    try {
      setLoadingWeather(true);
      const response = await fetch(`/api/weather?lat=${lat}&lon=${lon}&lang=zh`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch weather data');
      }
      
      const data = await response.json();
      setCenterWeather(data);
    } catch (error) {
      console.error('Error fetching center weather:', error);
      setCenterWeather(null);
    } finally {
      setLoadingWeather(false);
    }
  }, []);

  // 防抖函数
  const debouncedFetchWeather = useCallback((lat: number, lon: number) => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      fetchCenterWeather(lat, lon);
    }, 500); // 500ms 防抖
  }, [fetchCenterWeather]);

  useEffect(() => {
    // 如果地图已经初始化，更新中心点
    if (mapInstanceRef.current && location.lat && location.lon) {
      mapInstanceRef.current.setCenter([location.lon, location.lat]);
      if (centerMarkerRef.current) {
        centerMarkerRef.current.setPosition([location.lon, location.lat]);
      }
      // 更新中心点后获取天气数据
      fetchCenterWeather(location.lat, location.lon);
    }
  }, [location.lat, location.lon, fetchCenterWeather]);

  useEffect(() => {
    if (!mapContainerRef.current) return;

    const initMap = () => {
      if (!mapContainerRef.current || !window.AMap) return;

      // 如果地图已存在，先销毁
      if (mapInstanceRef.current) {
        mapInstanceRef.current.destroy();
        mapInstanceRef.current = null;
      }

      // 使用当前城市的经纬度作为中心点
      const center: [number, number] = [location.lon, location.lat];

      // 创建地图实例
      mapInstanceRef.current = new window.AMap.Map(mapContainerRef.current, {
        center: center,
        zoom: 10,
        viewMode: '3D', // 3D视图
        pitch: 0,
        rotation: 0,
        mapStyle: 'amap://styles/normal', // 标准样式
        features: ['bg', 'point', 'road', 'building'], // 显示要素
      });

      // 添加标记点
      const marker = new window.AMap.Marker({
        position: center,
        title: location.name || '当前位置',
        content: buildCenterMarkerContent(
          formatCenterTemp(centerWeather?.current),
          getCenterMarkerBorderColor(centerWeather?.current)
        ),
        offset: new window.AMap.Pixel(-centerMarkerSize / 2, -centerMarkerSize / 2),
      });

      mapInstanceRef.current.add(marker);
      centerMarkerRef.current = marker;

      // 添加信息窗体（可选）
      const infoWindow = new window.AMap.InfoWindow({
        content: `<div style="padding: 10px;">
          <div style="font-weight: bold; margin-bottom: 5px;">${location.name || '当前位置'}</div>
          <div style="font-size: 12px; color: #666;">${location.region || ''} ${location.country || ''}</div>
        </div>`,
        offset: new window.AMap.Pixel(0, -30),
      });

      // 点击标记显示信息
      marker.on('click', () => {
        infoWindow.open(mapInstanceRef.current, center);
      });

      // 绑定地图事件：拖拽结束、缩放结束
      const handleMoveEnd = () => {
        if (!mapInstanceRef.current) return;
        const center = mapInstanceRef.current.getCenter();
        const lat = center.getLat();
        const lon = center.getLng();
        if (centerMarkerRef.current) {
          centerMarkerRef.current.setPosition([lon, lat]);
        }
        debouncedFetchWeather(lat, lon);
      };

      const handleZoomEnd = () => {
        if (!mapInstanceRef.current) return;
        const center = mapInstanceRef.current.getCenter();
        const lat = center.getLat();
        const lon = center.getLng();
        if (centerMarkerRef.current) {
          centerMarkerRef.current.setPosition([lon, lat]);
        }
        debouncedFetchWeather(lat, lon);
      };

      mapInstanceRef.current.on('moveend', handleMoveEnd);
      mapInstanceRef.current.on('zoomend', handleZoomEnd);

      // 初始化时获取中心点天气
      setTimeout(() => {
        debouncedFetchWeather(location.lat, location.lon);
      }, 300);

      // 删除高德地图水印
      const removeWatermark = () => {
        if (!mapContainerRef.current) return;
        
        // 方法1: 通过类名查找并删除
        const selectors = [
          '[class*="amap-copyright"]',
          '[class*="amap-logo"]',
          '[class*="amap-maps"]',
          '.amap-copyright',
          '.amap-logo'
        ];
        
        selectors.forEach(selector => {
          const elements = mapContainerRef.current!.querySelectorAll(selector);
          elements.forEach((el: Element) => {
            const htmlEl = el as HTMLElement;
            if (htmlEl.textContent && (
              htmlEl.textContent.includes('高德地图') || 
              htmlEl.textContent.includes('Amap') || 
              htmlEl.textContent.includes('©') ||
              htmlEl.textContent.includes('GS(')
            )) {
              htmlEl.style.display = 'none';
              htmlEl.remove();
            }
          });
        });
        
        // 方法2: 查找所有包含水印文本的元素
        const allElements = mapContainerRef.current.querySelectorAll('*');
        allElements.forEach((el: Element) => {
          const htmlEl = el as HTMLElement;
          const text = htmlEl.textContent || '';
          if (text.includes('高德地图') || text.includes('Amap')) {
            // 检查是否是水印元素（包含版权信息）
            if (text.includes('©') || text.includes('GS(') || text.includes('Amap')) {
              htmlEl.style.display = 'none';
              htmlEl.remove();
            }
          }
        });
      };

      // 延迟删除水印，确保地图已完全加载（多次尝试确保删除成功）
      setTimeout(removeWatermark, 300);
      setTimeout(removeWatermark, 800);
      setTimeout(removeWatermark, 1500);
      
      // 监听地图加载完成事件
      mapInstanceRef.current.on('complete', () => {
        setTimeout(removeWatermark, 100);
      });
    };

    // 检查是否已经加载了高德地图脚本
    if (window.AMap) {
      scriptLoadedRef.current = true;
      initMap();
      return;
    }

    // 如果脚本正在加载，不重复加载
    if (scriptLoadedRef.current) return;

    // 设置安全密钥（JS API 2.0 必须在加载脚本前设置）
    if (SecurityJsCode) {
      (window as any)._AMapSecurityConfig = {
        securityJsCode: SecurityJsCode,
      };
    }

    // 加载高德地图脚本
    const script = document.createElement('script');
    script.src = `https://webapi.amap.com/maps?v=2.0&key=${Key}`;
    script.async = true;
    script.onload = () => {
      scriptLoadedRef.current = true;
      initMap();
    };
    document.head.appendChild(script);

    return () => {
      // 清理地图实例和定时器
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      if (mapInstanceRef.current) {
        mapInstanceRef.current.destroy();
        mapInstanceRef.current = null;
      }
      centerMarkerRef.current = null;
    };
  }, [location.lat, location.lon, location.name, location.region, location.country, debouncedFetchWeather]);

  useEffect(() => {
    if (!centerMarkerRef.current) return;
    centerMarkerRef.current.setContent(buildCenterMarkerContent(
      formatCenterTemp(centerWeather?.current),
      getCenterMarkerBorderColor(centerWeather?.current)
    ));
  }, [centerWeather]);

  return (
    <div className={`${getCardStyle(textColorTheme.backgroundType)} rounded-2xl shadow-xl p-4 h-full flex flex-col relative`}>
      <h2 className={`text-xl font-bold ${textColorTheme.textColor.primary} mb-4`}>
        地图位置
      </h2>
      <div className="flex-1 rounded-lg overflow-hidden relative" style={{ minHeight: '600px' }}>
        <div
          ref={mapContainerRef}
          className="w-full h-full"
          style={{ minHeight: '600px', position: 'relative', zIndex: 0 }}
        />
        {/* 悬浮天气信息组件 */}
        <FloatingWeatherInfo 
          location={centerWeather?.location || location}
          current={centerWeather?.current}
          loading={loadingWeather}
          textColorTheme={textColorTheme}
        />
      </div>
      <div className={`mt-3 text-sm ${textColorTheme.textColor.secondary}`}>
        <p>坐标: {location.lat.toFixed(4)}, {location.lon.toFixed(4)}</p>
      </div>
    </div>
  );
}
