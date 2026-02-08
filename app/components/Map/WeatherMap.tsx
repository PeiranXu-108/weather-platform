'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import type { Location, WeatherResponse } from '@/app/types/weather';
import type { TextColorTheme } from '@/app/utils/textColorTheme';
import { getCardStyle } from '@/app/utils/textColorTheme';
import FloatingWeatherInfo from './InfoCard';
import TemperatureLegend from './TemperatureLegend';
import PrecipLegend from './PrecipLegend';
import { TemperatureGridRenderer } from '@/app/utils/temperatureGridRenderer';
import { WindFieldRenderer } from '@/app/utils/windFieldRenderer';
import { CloudLayerRenderer } from '@/app/utils/cloudLayerRenderer';
import { PrecipLayerRenderer } from '@/app/utils/precipLayerRenderer';
import {
  centerMarkerSize,
  formatCenterTemp,
  buildCenterMarkerContent
} from './centerMarker';
import { fetchWeatherByCoords } from '@/app/lib/api';

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
  const temperatureLayerEnabledRef = useRef(false);
  const [temperatureLayerProgress, setTemperatureLayerProgress] = useState(0);
  const [temperatureLayerLoading, setTemperatureLayerLoading] = useState(false);
  const temperatureProgressHideTimerRef = useRef<NodeJS.Timeout | null>(null);
  const temperatureDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const windLayerRef = useRef<WindFieldRenderer | null>(null);
  const [windLayerEnabled, setWindLayerEnabled] = useState(false);
  const windLayerEnabledRef = useRef(false);
  const [windLayerProgress, setWindLayerProgress] = useState(0);
  const [windLayerLoading, setWindLayerLoading] = useState(false);
  const windProgressHideTimerRef = useRef<NodeJS.Timeout | null>(null);
  const windDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const cloudLayerRef = useRef<CloudLayerRenderer | null>(null);
  const [cloudLayerEnabled, setCloudLayerEnabled] = useState(false);
  const cloudLayerEnabledRef = useRef(false);
  const [cloudLayerProgress, setCloudLayerProgress] = useState(0);
  const [cloudLayerLoading, setCloudLayerLoading] = useState(false);
  const cloudProgressHideTimerRef = useRef<NodeJS.Timeout | null>(null);
  const cloudDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const [cloudRenderStyle, setCloudRenderStyle] = useState<'soft' | 'noise'>('noise');
  const precipLayerRef = useRef<PrecipLayerRenderer | null>(null);
  const [precipLayerEnabled, setPrecipLayerEnabled] = useState(false);
  const precipLayerEnabledRef = useRef(false);
  const [precipLayerProgress, setPrecipLayerProgress] = useState(0);
  const [precipLayerLoading, setPrecipLayerLoading] = useState(false);
  const precipProgressHideTimerRef = useRef<NodeJS.Timeout | null>(null);
  const precipDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const [layerDropdownOpen, setLayerDropdownOpen] = useState(false);
  const layerDropdownRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const fullscreenContainerRef = useRef<HTMLDivElement>(null);
  const debouncedFetchWeatherRef = useRef<((lat: number, lon: number) => void) | null>(null);
  const debouncedRenderTemperatureLayerRef = useRef<((enabled?: boolean) => void) | null>(null);
  const debouncedRenderWindLayerRef = useRef<((enabled?: boolean) => void) | null>(null);
  const debouncedRenderCloudLayerRef = useRef<((enabled?: boolean) => void) | null>(null);
  const debouncedRenderPrecipLayerRef = useRef<((enabled?: boolean) => void) | null>(null);

  // 点击外部关闭温度图层下拉
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (layerDropdownRef.current && !layerDropdownRef.current.contains(e.target as Node)) {
        setLayerDropdownOpen(false);
      }
    };
    if (layerDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [layerDropdownOpen]);

  const handleTemperatureProgress = useCallback((progress: number) => {
    if (!temperatureLayerEnabledRef.current) {
      setTemperatureLayerLoading(false);
      setTemperatureLayerProgress(0);
      return;
    }
    setTemperatureLayerProgress(progress);

    if (progress >= 100) {
      if (temperatureProgressHideTimerRef.current) {
        clearTimeout(temperatureProgressHideTimerRef.current);
      }
      temperatureProgressHideTimerRef.current = setTimeout(() => {
        setTemperatureLayerLoading(false);
      }, 200);
      return;
    }

    if (temperatureProgressHideTimerRef.current) {
      clearTimeout(temperatureProgressHideTimerRef.current);
      temperatureProgressHideTimerRef.current = null;
    }
    setTemperatureLayerLoading(true);
  }, []);

  const handleWindProgress = useCallback((progress: number) => {
    if (!windLayerEnabledRef.current) {
      setWindLayerLoading(false);
      setWindLayerProgress(0);
      return;
    }
    setWindLayerProgress(progress);

    if (progress >= 100) {
      if (windProgressHideTimerRef.current) {
        clearTimeout(windProgressHideTimerRef.current);
      }
      windProgressHideTimerRef.current = setTimeout(() => {
        setWindLayerLoading(false);
      }, 200);
      return;
    }

    if (windProgressHideTimerRef.current) {
      clearTimeout(windProgressHideTimerRef.current);
      windProgressHideTimerRef.current = null;
    }
    setWindLayerLoading(true);
  }, []);

  const handleCloudProgress = useCallback((progress: number) => {
    if (!cloudLayerEnabledRef.current) {
      setCloudLayerLoading(false);
      setCloudLayerProgress(0);
      return;
    }
    setCloudLayerProgress(progress);

    if (progress >= 100) {
      if (cloudProgressHideTimerRef.current) {
        clearTimeout(cloudProgressHideTimerRef.current);
      }
      cloudProgressHideTimerRef.current = setTimeout(() => {
        setCloudLayerLoading(false);
      }, 200);
      return;
    }

    if (cloudProgressHideTimerRef.current) {
      clearTimeout(cloudProgressHideTimerRef.current);
      cloudProgressHideTimerRef.current = null;
    }
    setCloudLayerLoading(true);
  }, []);

  const handlePrecipProgress = useCallback((progress: number) => {
    if (!precipLayerEnabledRef.current) {
      setPrecipLayerLoading(false);
      setPrecipLayerProgress(0);
      return;
    }
    setPrecipLayerProgress(progress);

    if (progress >= 100) {
      if (precipProgressHideTimerRef.current) {
        clearTimeout(precipProgressHideTimerRef.current);
      }
      precipProgressHideTimerRef.current = setTimeout(() => {
        setPrecipLayerLoading(false);
      }, 200);
      return;
    }

    if (precipProgressHideTimerRef.current) {
      clearTimeout(precipProgressHideTimerRef.current);
      precipProgressHideTimerRef.current = null;
    }
    setPrecipLayerLoading(true);
  }, []);

  // 获取地图中心点的天气数据
  const fetchCenterWeather = useCallback(async (lat: number, lon: number) => {
    try {
      setLoadingWeather(true);
      const response = await fetchWeatherByCoords(lat, lon);
      
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
      setTemperatureLayerLoading(false);
      setTemperatureLayerProgress(0);
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
    
    // 获取地图缩放级别，用于动态调整网格密度
    const zoom = mapInstanceRef.current.getZoom();

    console.log('Map bounds:', { ne: { lat: ne.lat, lng: ne.lng }, sw: { lat: sw.lat, lng: sw.lng }, zoom });

    const mapBounds = {
      northeast: { lat: ne.lat, lng: ne.lng },
      southwest: { lat: sw.lat, lng: sw.lng },
      zoom: zoom, // 传递缩放级别
    };

    try {
      if (!temperatureLayerRef.current) {
        console.log('Creating new TemperatureGridRenderer');
        temperatureLayerRef.current = new TemperatureGridRenderer(mapInstanceRef.current);
      } else {
        // 如果 renderer 已存在，更新地图实例（地图可能重新初始化了）
        temperatureLayerRef.current.setMapInstance(mapInstanceRef.current);
      }
      console.log('Starting temperature grid render');
      await temperatureLayerRef.current.renderTemperatureGrid(mapBounds, {
        onProgress: handleTemperatureProgress,
      });
      console.log('Temperature grid rendered successfully');
    } catch (error) {
      console.error('Error rendering temperature layer:', error);
    }
  }, [handleTemperatureProgress, temperatureLayerEnabled]);

  // 防抖温度网格渲染
  const debouncedRenderTemperatureLayer = useCallback((enabled?: boolean) => {
    if (temperatureDebounceRef.current) {
      clearTimeout(temperatureDebounceRef.current);
    }
    temperatureDebounceRef.current = setTimeout(() => {
      renderTemperatureLayer(enabled !== undefined ? enabled : temperatureLayerEnabled);
    }, 800); // 
  }, [renderTemperatureLayer, temperatureLayerEnabled]);

  // 获取地图边界信息用于风力图层渲染
  const renderWindLayer = useCallback(async (enabled: boolean = windLayerEnabled) => {
    if (!mapInstanceRef.current) {
      return;
    }

    try {
      const center = mapInstanceRef.current.getCenter();
      if (!center) {
        return;
      }
    } catch (error) {
      return;
    }

    if (!enabled) {
      if (windLayerRef.current) {
        windLayerRef.current.clear();
      }
      setWindLayerLoading(false);
      setWindLayerProgress(0);
      return;
    }

    const bounds = mapInstanceRef.current.getBounds();
    if (!bounds) {
      return;
    }

    const ne = bounds.getNorthEast();
    const sw = bounds.getSouthWest();
    const zoom = mapInstanceRef.current.getZoom();

    const mapBounds = {
      northeast: { lat: ne.lat, lng: ne.lng },
      southwest: { lat: sw.lat, lng: sw.lng },
      zoom: zoom,
    };

    try {
      if (!windLayerRef.current) {
        windLayerRef.current = new WindFieldRenderer(mapInstanceRef.current);
      } else {
        windLayerRef.current.setMapInstance(mapInstanceRef.current);
      }
      await windLayerRef.current.renderWindField(mapBounds, {
        onProgress: handleWindProgress,
      });
    } catch (error) {
      console.error('Error rendering wind layer:', error);
    }
  }, [handleWindProgress, windLayerEnabled]);

  // 防抖风力图层渲染
  const debouncedRenderWindLayer = useCallback((enabled?: boolean) => {
    if (windDebounceRef.current) {
      clearTimeout(windDebounceRef.current);
    }
    windDebounceRef.current = setTimeout(() => {
      renderWindLayer(enabled !== undefined ? enabled : windLayerEnabled);
    }, 800);
  }, [renderWindLayer, windLayerEnabled]);

  // 获取地图边界信息用于云量图层渲染
  const renderCloudLayer = useCallback(async (enabled: boolean = cloudLayerEnabled) => {
    if (!mapInstanceRef.current) {
      return;
    }

    try {
      const center = mapInstanceRef.current.getCenter();
      if (!center) {
        return;
      }
    } catch (error) {
      return;
    }

    if (!enabled) {
      if (cloudLayerRef.current) {
        cloudLayerRef.current.clear();
      }
      setCloudLayerLoading(false);
      setCloudLayerProgress(0);
      return;
    }

    const bounds = mapInstanceRef.current.getBounds();
    if (!bounds) {
      return;
    }

    const ne = bounds.getNorthEast();
    const sw = bounds.getSouthWest();
    const zoom = mapInstanceRef.current.getZoom();

    const mapBounds = {
      northeast: { lat: ne.lat, lng: ne.lng },
      southwest: { lat: sw.lat, lng: sw.lng },
      zoom: zoom,
    };

    try {
      if (!cloudLayerRef.current) {
        cloudLayerRef.current = new CloudLayerRenderer(mapInstanceRef.current, {
          renderStyle: cloudRenderStyle,
        });
      } else {
        cloudLayerRef.current.setMapInstance(mapInstanceRef.current);
        cloudLayerRef.current.setRenderStyle(cloudRenderStyle);
      }
      await cloudLayerRef.current.renderCloudLayer(mapBounds, {
        onProgress: handleCloudProgress,
      });
    } catch (error) {
      console.error('Error rendering cloud layer:', error);
    }
  }, [cloudLayerEnabled, cloudRenderStyle, handleCloudProgress]);

  // 防抖云量图层渲染
  const debouncedRenderCloudLayer = useCallback((enabled?: boolean) => {
    if (cloudDebounceRef.current) {
      clearTimeout(cloudDebounceRef.current);
    }
    cloudDebounceRef.current = setTimeout(() => {
      renderCloudLayer(enabled !== undefined ? enabled : cloudLayerEnabled);
    }, 800);
  }, [renderCloudLayer, cloudLayerEnabled]);

  // 获取地图边界信息用于降水图层渲染
  const renderPrecipLayer = useCallback(async (enabled: boolean = precipLayerEnabled) => {
    if (!mapInstanceRef.current) {
      return;
    }

    try {
      const center = mapInstanceRef.current.getCenter();
      if (!center) {
        return;
      }
    } catch (error) {
      return;
    }

    if (!enabled) {
      if (precipLayerRef.current) {
        precipLayerRef.current.clear();
      }
      setPrecipLayerLoading(false);
      setPrecipLayerProgress(0);
      return;
    }

    const bounds = mapInstanceRef.current.getBounds();
    if (!bounds) {
      return;
    }

    const ne = bounds.getNorthEast();
    const sw = bounds.getSouthWest();
    const zoom = mapInstanceRef.current.getZoom();

    const mapBounds = {
      northeast: { lat: ne.lat, lng: ne.lng },
      southwest: { lat: sw.lat, lng: sw.lng },
      zoom: zoom,
    };

    try {
      if (!precipLayerRef.current) {
        precipLayerRef.current = new PrecipLayerRenderer(mapInstanceRef.current);
      } else {
        precipLayerRef.current.setMapInstance(mapInstanceRef.current);
      }
      await precipLayerRef.current.renderPrecipLayer(mapBounds, {
        onProgress: handlePrecipProgress,
      });
    } catch (error) {
      console.error('Error rendering precip layer:', error);
    }
  }, [handlePrecipProgress, precipLayerEnabled]);

  // 防抖降水图层渲染
  const debouncedRenderPrecipLayer = useCallback((enabled?: boolean) => {
    if (precipDebounceRef.current) {
      clearTimeout(precipDebounceRef.current);
    }
    precipDebounceRef.current = setTimeout(() => {
      renderPrecipLayer(enabled !== undefined ? enabled : precipLayerEnabled);
    }, 800);
  }, [renderPrecipLayer, precipLayerEnabled]);

  useEffect(() => {
    temperatureLayerEnabledRef.current = temperatureLayerEnabled;
  }, [temperatureLayerEnabled]);

  useEffect(() => {
    windLayerEnabledRef.current = windLayerEnabled;
  }, [windLayerEnabled]);

  useEffect(() => {
    cloudLayerEnabledRef.current = cloudLayerEnabled;
  }, [cloudLayerEnabled]);

  useEffect(() => {
    precipLayerEnabledRef.current = precipLayerEnabled;
  }, [precipLayerEnabled]);

  useEffect(() => {
    debouncedFetchWeatherRef.current = debouncedFetchWeather;
  }, [debouncedFetchWeather]);

  useEffect(() => {
    debouncedRenderTemperatureLayerRef.current = debouncedRenderTemperatureLayer;
  }, [debouncedRenderTemperatureLayer]);

  useEffect(() => {
    debouncedRenderWindLayerRef.current = debouncedRenderWindLayer;
  }, [debouncedRenderWindLayer]);

  useEffect(() => {
    debouncedRenderCloudLayerRef.current = debouncedRenderCloudLayer;
  }, [debouncedRenderCloudLayer]);

  useEffect(() => {
    debouncedRenderPrecipLayerRef.current = debouncedRenderPrecipLayer;
  }, [debouncedRenderPrecipLayer]);

  useEffect(() => {
    if (!cloudLayerEnabled || !cloudLayerRef.current) return;
    cloudLayerRef.current.setRenderStyle(cloudRenderStyle);
  }, [cloudLayerEnabled, cloudRenderStyle]);

  const handleZoomIn = useCallback(() => {
    if (!mapInstanceRef.current) return;
    const zoom = mapInstanceRef.current.getZoom();
    mapInstanceRef.current.setZoom(Math.min(18, Math.round(zoom) + 1));
  }, []);

  const handleZoomOut = useCallback(() => {
    if (!mapInstanceRef.current) return;
    const zoom = mapInstanceRef.current.getZoom();
    mapInstanceRef.current.setZoom(Math.max(3, Math.round(zoom) - 1));
  }, []);

  // 切换全屏模式
  const toggleFullscreen = useCallback(() => {
    if (!fullscreenContainerRef.current) return;

    const element = fullscreenContainerRef.current;
    
    // 检查是否支持全屏 API
    if (!document.fullscreenElement && 
        !(document as any).webkitFullscreenElement && 
        !(document as any).mozFullScreenElement && 
        !(document as any).msFullscreenElement) {
      // 进入全屏
      if (element.requestFullscreen) {
        element.requestFullscreen();
      } else if ((element as any).webkitRequestFullscreen) {
        (element as any).webkitRequestFullscreen();
      } else if ((element as any).mozRequestFullScreen) {
        (element as any).mozRequestFullScreen();
      } else if ((element as any).msRequestFullscreen) {
        (element as any).msRequestFullscreen();
      }
    } else {
      // 退出全屏
      if (document.exitFullscreen) {
        document.exitFullscreen();
      } else if ((document as any).webkitExitFullscreen) {
        (document as any).webkitExitFullscreen();
      } else if ((document as any).mozCancelFullScreen) {
        (document as any).mozCancelFullScreen();
      } else if ((document as any).msExitFullscreen) {
        (document as any).msExitFullscreen();
      }
    }
  }, []);

  // 处理温度图层启用/禁用
  const handleTemperatureLayerChange = useCallback((enabled: boolean) => {
    console.log('handleTemperatureLayerChange called with enabled:', enabled);
    setTemperatureLayerEnabled(enabled);
    
    if (enabled) {
      setTemperatureLayerProgress(0);
      // 立即渲染当前视图的温度图层
      debouncedRenderTemperatureLayer(enabled);
    } else {
      // 清除温度网格
      if (temperatureLayerRef.current) {
        temperatureLayerRef.current.clear();
      }
      if (temperatureProgressHideTimerRef.current) {
        clearTimeout(temperatureProgressHideTimerRef.current);
        temperatureProgressHideTimerRef.current = null;
      }
      setTemperatureLayerLoading(false);
      setTemperatureLayerProgress(0);
    }
    
    // Note: We no longer call onTemperatureLayerChange since layer is managed internally
  }, [debouncedRenderTemperatureLayer]);

  // 处理风力图层启用/禁用
  const handleWindLayerChange = useCallback((enabled: boolean) => {
    setWindLayerEnabled(enabled);

    if (enabled) {
      setWindLayerProgress(0);
      debouncedRenderWindLayer(enabled);
    } else {
      if (windLayerRef.current) {
        windLayerRef.current.clear();
      }
      if (windProgressHideTimerRef.current) {
        clearTimeout(windProgressHideTimerRef.current);
        windProgressHideTimerRef.current = null;
      }
      setWindLayerLoading(false);
      setWindLayerProgress(0);
    }
  }, [debouncedRenderWindLayer]);

  // 处理云量图层启用/禁用
  const handleCloudLayerChange = useCallback((enabled: boolean) => {
    setCloudLayerEnabled(enabled);

    if (enabled) {
      setCloudLayerProgress(0);
      debouncedRenderCloudLayer(enabled);
    } else {
      if (cloudLayerRef.current) {
        cloudLayerRef.current.clear();
      }
      if (cloudProgressHideTimerRef.current) {
        clearTimeout(cloudProgressHideTimerRef.current);
        cloudProgressHideTimerRef.current = null;
      }
      setCloudLayerLoading(false);
      setCloudLayerProgress(0);
    }
  }, [debouncedRenderCloudLayer]);

  // 处理降水图层启用/禁用
  const handlePrecipLayerChange = useCallback((enabled: boolean) => {
    setPrecipLayerEnabled(enabled);

    if (enabled) {
      setPrecipLayerProgress(0);
      debouncedRenderPrecipLayer(enabled);
    } else {
      if (precipLayerRef.current) {
        precipLayerRef.current.clear();
      }
      if (precipProgressHideTimerRef.current) {
        clearTimeout(precipProgressHideTimerRef.current);
        precipProgressHideTimerRef.current = null;
      }
      setPrecipLayerLoading(false);
      setPrecipLayerProgress(0);
    }
  }, [debouncedRenderPrecipLayer]);

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
        // 清除温度图层
        if (temperatureLayerRef.current) {
          temperatureLayerRef.current.clear();
        }
        if (windLayerRef.current) {
          windLayerRef.current.clear();
        }
      if (cloudLayerRef.current) {
        cloudLayerRef.current.clear();
      }
      if (precipLayerRef.current) {
        precipLayerRef.current.clear();
      }
        mapInstanceRef.current.destroy();
        mapInstanceRef.current = null;
      }
      
      // 重置温度图层 renderer（地图重新初始化后需要重新创建）
      if (temperatureLayerRef.current) {
        temperatureLayerRef.current = null;
      }
      if (windLayerRef.current) {
        windLayerRef.current = null;
      }
      if (cloudLayerRef.current) {
        cloudLayerRef.current = null;
      }
      if (precipLayerRef.current) {
        precipLayerRef.current = null;
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
        debouncedFetchWeatherRef.current?.(lat, lon);
        
        // 如果启用了温度图层，也更新温度网格
        if (temperatureLayerEnabledRef.current) {
          debouncedRenderTemperatureLayerRef.current?.(true);
        }
        if (windLayerEnabledRef.current) {
          debouncedRenderWindLayerRef.current?.(true);
        }
        if (cloudLayerEnabledRef.current) {
          debouncedRenderCloudLayerRef.current?.(true);
        }
        if (precipLayerEnabledRef.current) {
          debouncedRenderPrecipLayerRef.current?.(true);
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
        debouncedFetchWeatherRef.current?.(lat, lon);
        
        // 如果启用了温度图层，也更新温度网格
        if (temperatureLayerEnabledRef.current) {
          debouncedRenderTemperatureLayerRef.current?.(true);
        }
        if (windLayerEnabledRef.current) {
          debouncedRenderWindLayerRef.current?.(true);
        }
        if (cloudLayerEnabledRef.current) {
          debouncedRenderCloudLayerRef.current?.(true);
        }
        if (precipLayerEnabledRef.current) {
          debouncedRenderPrecipLayerRef.current?.(true);
        }
      };

      mapInstanceRef.current.on('moveend', handleMoveEnd);
      mapInstanceRef.current.on('zoomend', handleZoomEnd);

      // 初始化时获取中心点天气
      setTimeout(() => {
        debouncedFetchWeatherRef.current?.(location.lat, location.lon);
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
        if (temperatureLayerEnabledRef.current) {
          setTimeout(() => {
            debouncedRenderTemperatureLayerRef.current?.(true);
          }, 500);
        }
        if (windLayerEnabledRef.current) {
          setTimeout(() => {
            debouncedRenderWindLayerRef.current?.(true);
          }, 500);
        }
        if (cloudLayerEnabledRef.current) {
          setTimeout(() => {
            debouncedRenderCloudLayerRef.current?.(true);
          }, 500);
        }
        if (precipLayerEnabledRef.current) {
          setTimeout(() => {
            debouncedRenderPrecipLayerRef.current?.(true);
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
      if (windDebounceRef.current) {
        clearTimeout(windDebounceRef.current);
      }
      if (cloudDebounceRef.current) {
        clearTimeout(cloudDebounceRef.current);
      }
      if (precipDebounceRef.current) {
        clearTimeout(precipDebounceRef.current);
      }
      if (temperatureProgressHideTimerRef.current) {
        clearTimeout(temperatureProgressHideTimerRef.current);
        temperatureProgressHideTimerRef.current = null;
      }
      if (windProgressHideTimerRef.current) {
        clearTimeout(windProgressHideTimerRef.current);
        windProgressHideTimerRef.current = null;
      }
      if (cloudProgressHideTimerRef.current) {
        clearTimeout(cloudProgressHideTimerRef.current);
        cloudProgressHideTimerRef.current = null;
      }
      if (precipProgressHideTimerRef.current) {
        clearTimeout(precipProgressHideTimerRef.current);
        precipProgressHideTimerRef.current = null;
      }
      if (temperatureLayerRef.current) {
        temperatureLayerRef.current.clear();
        temperatureLayerRef.current = null;
      }
      if (windLayerRef.current) {
        windLayerRef.current.clear();
        windLayerRef.current = null;
      }
      if (cloudLayerRef.current) {
        cloudLayerRef.current.clear();
        cloudLayerRef.current = null;
      }
      if (precipLayerRef.current) {
        precipLayerRef.current.clear();
        precipLayerRef.current = null;
      }
      if (mapInstanceRef.current) {
        mapInstanceRef.current.destroy();
        mapInstanceRef.current = null;
      }
      centerMarkerRef.current = null;
    };
  }, [location.lat, location.lon, location.name, location.region, location.country]);

  useEffect(() => {
    if (!centerMarkerRef.current) return;
    centerMarkerRef.current.setContent(buildCenterMarkerContent(
      centerWeather?.current?.temp_c ?? null,
      centerWeather?.forecast?.forecastday?.[0]?.day?.mintemp_c ?? null,
      centerWeather?.forecast?.forecastday?.[0]?.day?.maxtemp_c ?? null,
      formatCenterTemp(centerWeather?.current)
    ));
  }, [centerWeather]);

  // 监听全屏状态变化
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isCurrentlyFullscreen = !!(
        document.fullscreenElement ||
        (document as any).webkitFullscreenElement ||
        (document as any).mozFullScreenElement ||
        (document as any).msFullscreenElement
      );
      setIsFullscreen(isCurrentlyFullscreen);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
    };
  }, []);

  return (
    <div className={`${getCardStyle(textColorTheme.backgroundType)} rounded-2xl shadow-xl p-4 h-full flex flex-col relative`}>
      <div className="flex items-center mb-4">
        <h2 className={`text-xl font-bold ${textColorTheme.textColor.primary}`}>
          地图位置
        </h2>
      </div>
      <div className="flex-1 rounded-lg overflow-hidden relative" style={{ minHeight: '800px' }} ref={fullscreenContainerRef}>
        <div
          ref={mapContainerRef}
          className="w-full h-full"
          style={{ minHeight: '800px', position: 'relative', zIndex: 0 }}
        />
        {(temperatureLayerLoading || windLayerLoading || cloudLayerLoading || precipLayerLoading) && (
          <div className="absolute top-0 left-0 right-0 z-20 pointer-events-none">
            <div className="flex flex-col">
              {temperatureLayerLoading && (
                <div className="h-1 w-full bg-white/50 backdrop-blur-sm">
                  <div
                    className="h-full bg-sky-500 transition-[width] duration-200 ease-out"
                    style={{ width: `${temperatureLayerProgress}%` }}
                  />
                </div>
              )}
              {windLayerLoading && (
                <div className="h-1 w-full bg-white/50 backdrop-blur-sm">
                  <div
                    className="h-full bg-emerald-500 transition-[width] duration-200 ease-out"
                    style={{ width: `${windLayerProgress}%` }}
                  />
                </div>
              )}
              {cloudLayerLoading && (
                <div className="h-1 w-full bg-white/50 backdrop-blur-sm">
                  <div
                    className="h-full bg-slate-500 transition-[width] duration-200 ease-out"
                    style={{ width: `${cloudLayerProgress}%` }}
                  />
                </div>
              )}
              {precipLayerLoading && (
                <div className="h-1 w-full bg-white/50 backdrop-blur-sm">
                  <div
                    className="h-full bg-indigo-500 transition-[width] duration-200 ease-out"
                    style={{ width: `${precipLayerProgress}%` }}
                  />
                </div>
              )}
            </div>
          </div>
        )}
        {/* 左上角：图例（降水在上，温度在下） */}
        {(precipLayerEnabled || temperatureLayerEnabled) && (
          <div className="absolute top-4 left-4 z-10 flex flex-col gap-3">
            {precipLayerEnabled && <PrecipLegend />}
            {temperatureLayerEnabled && <TemperatureLegend />}
          </div>
        )}
        {/* 右上角：图层按钮和全屏按钮（苹果天气风格：浅色模糊 + 图层 icon + 选项为胶囊按钮） */}
        <div className="absolute top-4 right-4 z-10 flex items-center gap-2">
          <div ref={layerDropdownRef}>
            <button
              type="button"
              onClick={() => setLayerDropdownOpen((v) => !v)}
              className="flex items-center justify-center w-10 h-10 rounded-full bg-white/70 backdrop-blur-md shadow-lg border border-white/40 hover:bg-white/90 transition-colors text-slate-600"
              aria-expanded={layerDropdownOpen}
              aria-haspopup="true"
              title={temperatureLayerEnabled || windLayerEnabled || cloudLayerEnabled || precipLayerEnabled ? '图层：已开启' : '图层选项'}
            >
              {/* 苹果天气风格：两层叠放图标 */}
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
                <rect x="3" y="7" width="14" height="14" rx="2" />
                <rect x="7" y="3" width="14" height="14" rx="2" />
              </svg>
            </button>
          {layerDropdownOpen && (
            <div className="absolute top-full right-0 mt-2 flex flex-col gap-2 min-w-[140px] py-2 px-2 bg-white/70 backdrop-blur-md rounded-2xl shadow-xl border border-white/40">
              <button
                type="button"
                onClick={() => {
                  handleTemperatureLayerChange(!temperatureLayerEnabled);
                }}
                className={`flex items-center gap-3 w-full px-4 py-2.5 rounded-full text-sm transition-colors ${temperatureLayerEnabled ? 'bg-white/90 text-slate-800 shadow-sm' : 'bg-white/50 text-slate-600 hover:bg-white/70'}`}
              >
                <span className="w-5 h-5 flex items-center justify-center flex-shrink-0 [&>svg]:w-3.5 [&>svg]:h-3.5" aria-hidden>
                  {temperatureLayerEnabled ? (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-slate-600"><polyline points="20 6 9 17 4 12" /></svg>
                  ) : (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-slate-400"><circle cx="12" cy="12" r="10" /></svg>
                  )}
                </span>
                <span>气温</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  handleWindLayerChange(!windLayerEnabled);
                }}
                className={`flex items-center gap-3 w-full px-4 py-2.5 rounded-full text-sm transition-colors ${windLayerEnabled ? 'bg-white/90 text-slate-800 shadow-sm' : 'bg-white/50 text-slate-600 hover:bg-white/70'}`}
              >
                <span className="w-5 h-5 flex items-center justify-center flex-shrink-0 [&>svg]:w-3.5 [&>svg]:h-3.5" aria-hidden>
                  {windLayerEnabled ? (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-slate-600"><polyline points="20 6 9 17 4 12" /></svg>
                  ) : (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="text-slate-500">
                      <path d="M3 8h8a3 3 0 1 0-3-3" />
                      <path d="M3 14h13a3 3 0 1 1-3 3" />
                    </svg>
                  )}
                </span>
                <span>风力</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  handleCloudLayerChange(!cloudLayerEnabled);
                }}
                className={`flex items-center gap-3 w-full px-4 py-2.5 rounded-full text-sm transition-colors ${cloudLayerEnabled ? 'bg-white/90 text-slate-800 shadow-sm' : 'bg-white/50 text-slate-600 hover:bg-white/70'}`}
              >
                <span className="w-5 h-5 flex items-center justify-center flex-shrink-0 [&>svg]:w-3.5 [&>svg]:h-3.5" aria-hidden>
                  {cloudLayerEnabled ? (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-slate-600"><polyline points="20 6 9 17 4 12" /></svg>
                  ) : (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="text-slate-500">
                      <path d="M5 18h11a4 4 0 0 0 .4-7.98A5 5 0 0 0 6.2 9.8 3.5 3.5 0 0 0 5 18z" />
                    </svg>
                  )}
                </span>
                <span>云量</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  handlePrecipLayerChange(!precipLayerEnabled);
                }}
                className={`flex items-center gap-3 w-full px-4 py-2.5 rounded-full text-sm transition-colors ${precipLayerEnabled ? 'bg-white/90 text-slate-800 shadow-sm' : 'bg-white/50 text-slate-600 hover:bg-white/70'}`}
              >
                <span className="w-5 h-5 flex items-center justify-center flex-shrink-0 [&>svg]:w-3.5 [&>svg]:h-3.5" aria-hidden>
                  {precipLayerEnabled ? (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-slate-600"><polyline points="20 6 9 17 4 12" /></svg>
                  ) : (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="text-slate-500">
                      <path d="M8 7.5a4 4 0 0 1 8 0" />
                      <path d="M6.5 10.5h11a3.5 3.5 0 1 1-2.8 5.6" />
                      <path d="M9 16.5v3" />
                      <path d="M13 17.5v3" />
                    </svg>
                  )}
                </span>
                <span>降水</span>
              </button>
              {/* {process.env.NODE_ENV !== 'production' && (
                <button
                  type="button"
                  onClick={() => {
                    setCloudRenderStyle((prev) => (prev === 'noise' ? 'soft' : 'noise'));
                  }}
                  className="flex items-center gap-2 w-full px-4 py-2 rounded-full text-xs text-slate-600 bg-white/50 hover:bg-white/70 transition-colors"
                  title="云量渲染风格（开发用）"
                >
                  <span className="inline-flex w-2 h-2 rounded-full bg-slate-400" />
                  <span>云量风格：{cloudRenderStyle === 'noise' ? '噪声' : '柔和'}</span>
                </button>
              )} */}
            </div>
          )}
          </div>
          {/* 全屏按钮 */}
          <button
            type="button"
            onClick={toggleFullscreen}
            className="flex items-center justify-center w-10 h-10 rounded-full bg-white/70 backdrop-blur-md shadow-lg border border-white/40 hover:bg-white/90 transition-colors text-slate-600"
            title={isFullscreen ? '退出全屏' : '全屏'}
            aria-label={isFullscreen ? '退出全屏' : '全屏'}
          >
            {isFullscreen ? (
              // 退出全屏图标
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
                <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3" />
              </svg>
            ) : (
              // 全屏图标
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
                <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
              </svg>
            )}
          </button>
        </div>
        {/* 上方正中间：缩放按钮（左右排布） */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 flex flex-row gap-px">
          <button
            type="button"
            onClick={handleZoomOut}
            className="w-9 h-9 flex items-center justify-center bg-white/70 backdrop-blur-md rounded-l-lg border border-white/40 shadow-lg text-gray-800 text-xl font-light hover:bg-white/90 transition-colors leading-none"
            title="缩小"
            aria-label="缩小"
          >
            −
          </button>
          <button
            type="button"
            onClick={handleZoomIn}
            className="w-9 h-9 flex items-center justify-center bg-white/70 backdrop-blur-md rounded-r-lg border border-white/40 shadow-lg text-gray-800 text-xl font-light hover:bg-white/90 transition-colors leading-none"
            title="放大"
            aria-label="放大"
          >
            +
          </button>
        </div>
        {/* 右下角：悬浮天气信息组件 */}
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
