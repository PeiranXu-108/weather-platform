'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import type { Location, WeatherResponse } from '@/app/types/weather';
import type { TextColorTheme } from '@/app/utils/textColorTheme';
import { getCardStyle } from '@/app/utils/textColorTheme';
import FloatingWeatherInfo from './InfoCard';
import { TemperatureGridRenderer } from '@/app/utils/temperatureGridRenderer';
import SegmentedDropdown from '@/app/models/SegmentedDropdown';
import {
  centerMarkerSize,
  formatCenterTemp,
  buildCenterMarkerContent
} from './centerMarker';

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

export default function WeatherMap({ location, textColorTheme }: WeatherMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const centerMarkerRef = useRef<any>(null);
  const scriptLoadedRef = useRef(false);
  const [centerWeather, setCenterWeather] = useState<WeatherResponse | null>(null);
  const [loadingWeather, setLoadingWeather] = useState(false);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const temperatureLayerRef = useRef<TemperatureGridRenderer | null>(null);
  const [temperatureLayerEnabled, setTemperatureLayerEnabled] = useState(false);
  const temperatureDebounceRef = useRef<NodeJS.Timeout | null>(null);

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

  // 获取地图边界信息用于温度网格渲染
  const renderTemperatureLayer = useCallback(async (enabled: boolean = temperatureLayerEnabled) => {
    console.log('renderTemperatureLayer called with enabled:', enabled, 'mapInstanceRef:', !!mapInstanceRef.current);
    
    if (!mapInstanceRef.current) {
      console.log('Map not initialized yet');
      return;
    }

    // 检查地图是否完全加载
    try {
      // 尝试获取地图中心点，如果失败说明地图未完全初始化
      const center = mapInstanceRef.current.getCenter();
      if (!center) {
        console.log('Map center not available, waiting for initialization');
        return;
      }
    } catch (error) {
      console.log('Map not fully initialized yet:', error);
      return;
    }

    if (!enabled) {
      console.log('Temperature layer disabled, clearing grid');
      if (temperatureLayerRef.current) {
        temperatureLayerRef.current.clear();
      }
      return;
    }

    const bounds = mapInstanceRef.current.getBounds();
    if (!bounds) {
      console.error('Could not get map bounds');
      return;
    }

    // 高德地图 Bounds 对象使用方法获取坐标
    const ne = bounds.getNorthEast();
    const sw = bounds.getSouthWest();

    console.log('Map bounds:', { ne: { lat: ne.lat, lng: ne.lng }, sw: { lat: sw.lat, lng: sw.lng } });

    const mapBounds = {
      northeast: { lat: ne.lat, lng: ne.lng },
      southwest: { lat: sw.lat, lng: sw.lng },
    };

    try {
      if (!temperatureLayerRef.current) {
        console.log('Creating new TemperatureGridRenderer');
        temperatureLayerRef.current = new TemperatureGridRenderer(mapInstanceRef.current);
      }
      console.log('Starting temperature grid render');
      await temperatureLayerRef.current.renderTemperatureGrid(mapBounds);
      console.log('Temperature grid rendered successfully');
    } catch (error) {
      console.error('Error rendering temperature layer:', error);
    }
  }, [temperatureLayerEnabled]);

  // 防抖温度网格渲染
  const debouncedRenderTemperatureLayer = useCallback((enabled?: boolean) => {
    if (temperatureDebounceRef.current) {
      clearTimeout(temperatureDebounceRef.current);
    }
    temperatureDebounceRef.current = setTimeout(() => {
      renderTemperatureLayer(enabled !== undefined ? enabled : temperatureLayerEnabled);
    }, 800); // 
  }, [renderTemperatureLayer, temperatureLayerEnabled]);

  // 处理温度图层启用/禁用
  const handleTemperatureLayerChange = useCallback((enabled: boolean) => {
    console.log('handleTemperatureLayerChange called with enabled:', enabled);
    setTemperatureLayerEnabled(enabled);
    
    if (enabled) {
      // 立即渲染当前视图的温度图层
      debouncedRenderTemperatureLayer(enabled);
    } else {
      // 清除温度网格
      if (temperatureLayerRef.current) {
        temperatureLayerRef.current.clear();
      }
    }
    
    // Note: We no longer call onTemperatureLayerChange since layer is managed internally
  }, [debouncedRenderTemperatureLayer]);

  // 同步父组件的温度图层状态
  useEffect(() => {
    // 由于父组件会触发 onTemperatureLayerChange 更新，
    // 而 handleTemperatureLayerChange 已经处理了同步逻辑，
    // 这里不需要额外的同步逻辑
  }, []);

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
          centerWeather?.current?.temp_c ?? null,
          centerWeather?.forecast?.forecastday?.[0]?.day?.mintemp_c ?? null,
          centerWeather?.forecast?.forecastday?.[0]?.day?.maxtemp_c ?? null,
          formatCenterTemp(centerWeather?.current)
        ),
        offset: new window.AMap.Pixel(-centerMarkerSize / 2, -(centerMarkerSize + 15) / 2),
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
        
        // 如果启用了温度图层，也更新温度网格
        if (temperatureLayerEnabled) {
          debouncedRenderTemperatureLayer();
        }
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
        
        // 如果启用了温度图层，也更新温度网格
        if (temperatureLayerEnabled) {
          debouncedRenderTemperatureLayer();
        }
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
        // 地图加载完成后，如果启用了温度图层，渲染温度图层
        if (temperatureLayerEnabled) {
          setTimeout(() => {
            debouncedRenderTemperatureLayer();
          }, 500);
        }
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
      if (temperatureDebounceRef.current) {
        clearTimeout(temperatureDebounceRef.current);
      }
      if (temperatureLayerRef.current) {
        temperatureLayerRef.current.clear();
        temperatureLayerRef.current = null;
      }
      if (mapInstanceRef.current) {
        mapInstanceRef.current.destroy();
        mapInstanceRef.current = null;
      }
      centerMarkerRef.current = null;
    };
  }, [location.lat, location.lon, location.name, location.region, location.country, debouncedFetchWeather, debouncedRenderTemperatureLayer, temperatureLayerEnabled]);

  useEffect(() => {
    if (!centerMarkerRef.current) return;
    centerMarkerRef.current.setContent(buildCenterMarkerContent(
      centerWeather?.current?.temp_c ?? null,
      centerWeather?.forecast?.forecastday?.[0]?.day?.mintemp_c ?? null,
      centerWeather?.forecast?.forecastday?.[0]?.day?.maxtemp_c ?? null,
      formatCenterTemp(centerWeather?.current)
    ));
  }, [centerWeather]);

  return (
    <div className={`${getCardStyle(textColorTheme.backgroundType)} rounded-2xl shadow-xl p-4 h-full flex flex-col relative`}>
      <div className="flex items-center justify-between mb-4">
        <h2 className={`text-xl font-bold ${textColorTheme.textColor.primary}`}>
          地图位置
        </h2>
        {/* Temperature Layer Selector - Top Right */}
        
        <SegmentedDropdown
          textColorTheme={textColorTheme}
          mainButton={{
            value: temperatureLayerEnabled ? 'temperature' : 'none',
            label: temperatureLayerEnabled ? '温度图层：已开启' : '请选择',
            showChevron: true,
          }}
          dropdownOptions={[
            { value: 'none', label: '请选择' },
            { value: 'temperature', label: '温度图层：开始渲染' }
          ]}
          onSelect={(value) => handleTemperatureLayerChange(value === 'temperature')}
        />
      </div>
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
