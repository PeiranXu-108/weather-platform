'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import type { Location, Current } from '@/app/types/weather';
import type { TextColorTheme } from '@/app/utils/textColorTheme';
import { getCardStyle } from '@/app/utils/textColorTheme';
import { translateLocation } from '@/app/utils/locationTranslations';
import FloatingWeatherInfo from './InfoCard';

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

export default function WeatherMap({ location, textColorTheme }: WeatherMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const scriptLoadedRef = useRef(false);
  const [centerWeather, setCenterWeather] = useState<{ location: Location; current: Current } | null>(null);
  const [loadingWeather, setLoadingWeather] = useState(false);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const displayLocation = { ...location, ...translateLocation(location) };
  const displayCenterLocation = centerWeather?.location
    ? { ...centerWeather.location, ...translateLocation(centerWeather.location) }
    : null;

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
        title: displayLocation.name || '当前位置',
        icon: new window.AMap.Icon({
          size: new window.AMap.Size(40, 50),
          image: 'https://webapi.amap.com/theme/v1.3/markers/n/mark_r.png',
          imageOffset: new window.AMap.Pixel(0, 0),
          imageSize: new window.AMap.Size(40, 50),
        }),
      });

      mapInstanceRef.current.add(marker);

      // 添加信息窗体（可选）
      const infoWindow = new window.AMap.InfoWindow({
        content: `<div style="padding: 10px;">
          <div style="font-weight: bold; margin-bottom: 5px;">${displayLocation.name || '当前位置'}</div>
          <div style="font-size: 12px; color: #666;">${displayLocation.region || ''} ${displayLocation.country || ''}</div>
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
        debouncedFetchWeather(lat, lon);
      };

      const handleZoomEnd = () => {
        if (!mapInstanceRef.current) return;
        const center = mapInstanceRef.current.getCenter();
        const lat = center.getLat();
        const lon = center.getLng();
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
    };
  }, [location.lat, location.lon, location.name, location.region, location.country, debouncedFetchWeather]);

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
          location={displayCenterLocation || displayLocation}
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

