'use client';

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import type { Location, WeatherResponse } from '@/app/types/weather';
import type { TextColorTheme } from '@/app/utils/textColorTheme';
import { getCardBackgroundStyle } from '@/app/utils/textColorTheme';
import FloatingWeatherInfo from './InfoCard';
import TemperatureLegend from './TemperatureLegend';
import PrecipLegend from './PrecipLegend';
import MapTimelinePlayback, { TIMELINE_TOTAL_STEPS } from './MapTimelinePlayback';
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
import Globe3D from './Globe3D';
import SegmentedDropdown from '@/app/models/SegmentedDropdown';

interface WeatherMapProps {
  location: Location;
  textColorTheme: TextColorTheme;
  opacity?: number;
  /** 点击卡片「查看详情」时，切换到该坐标的天气主页并刷新 */
  onGoToLocation?: (lat: number, lon: number) => void;
}

declare global {
  interface Window {
    AMap: any;
  }
}

const Key = process.env.NEXT_PUBLIC_AMAP_KEY 
const SecurityJsCode = process.env.NEXT_PUBLIC_AMAP_SECURITY_JS_CODE
const TIMELINE_STEP_SECONDS = 2 * 3600; // 2小时
const TIMELINE_PLAY_INTERVAL_MS = 400;

export default function WeatherMap({ location, textColorTheme, opacity = 100 }: WeatherMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const mapLabelLayerRef = useRef<any[]>([]);
  const mapLabelLayerZIndexRef = useRef<Map<any, number>>(new Map());
  const mapLabelLayerDomRef = useRef<HTMLElement | null>(null);
  const mapLabelLayerDomZIndexRef = useRef<string | null>(null);
  const mapLabelLayerBoostedRef = useRef(false);
  const centerMarkerRef = useRef<any>(null);
  const scriptLoadedRef = useRef(false);
  const [centerWeather, setCenterWeather] = useState<WeatherResponse | null>(null);
  const [loadingWeather, setLoadingWeather] = useState(false);
  const [viewportCenterWeather, setViewportCenterWeather] = useState<WeatherResponse | null>(null);
  const [viewportCenterLoading, setViewportCenterLoading] = useState(false);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const viewportDebounceTimerRef = useRef<NodeJS.Timeout | null>(null);
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
  const [mapRenderMode, setMapRenderMode] = useState<'2d' | '3d'>('2d');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const fullscreenContainerRef = useRef<HTMLDivElement>(null);
  const [timelineStep, setTimelineStep] = useState(0);
  const [isTimelinePlaying, setIsTimelinePlaying] = useState(false);
  const debouncedFetchWeatherRef = useRef<((lat: number, lon: number) => void) | null>(null);
  const debouncedFetchViewportWeatherRef = useRef<((lat: number, lon: number) => void) | null>(null);
  const debouncedRenderTemperatureLayerRef = useRef<((enabled?: boolean, targetEpoch?: number) => void) | null>(null);
  const debouncedRenderWindLayerRef = useRef<((enabled?: boolean, targetEpoch?: number) => void) | null>(null);
  const debouncedRenderCloudLayerRef = useRef<((enabled?: boolean, targetEpoch?: number) => void) | null>(null);
  const debouncedRenderPrecipLayerRef = useRef<((enabled?: boolean, targetEpoch?: number) => void) | null>(null);
  const targetTimelineEpochRef = useRef(0);
  const playbackFrameRenderingRef = useRef(false);
  const mapContainerClickCaptureRef = useRef<((e: MouseEvent) => void) | null>(null);

  const timelineBaseEpoch = useMemo(() => {
    const sourceEpoch =
      centerWeather?.location?.localtime_epoch ?? location.localtime_epoch ?? Math.floor(Date.now() / 1000);
    return Math.floor(sourceEpoch / 3600) * 3600;
  }, [centerWeather?.location?.localtime_epoch, location.localtime_epoch]);

  const targetTimelineEpoch = useMemo(
    () => timelineBaseEpoch + timelineStep * TIMELINE_STEP_SECONDS,
    [timelineBaseEpoch, timelineStep]
  );

  const timelineTimeLabel = useMemo(() => {
    return new Intl.DateTimeFormat('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(new Date(targetTimelineEpoch * 1000));
  }, [targetTimelineEpoch]);

  const anyLayerEnabled = temperatureLayerEnabled || windLayerEnabled || cloudLayerEnabled || precipLayerEnabled;
  const is3DMode = mapRenderMode === '3d';
  const showLayerProgress =
    (temperatureLayerEnabled && temperatureLayerLoading) ||
    (windLayerEnabled && windLayerLoading) ||
    (cloudLayerEnabled && cloudLayerLoading) ||
    (precipLayerEnabled && precipLayerLoading);

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

  const syncMapTextLayer = useCallback((enabled: boolean) => {
    const container = mapInstanceRef.current?.getContainer?.() as HTMLElement | undefined;
    const map = mapInstanceRef.current;
    if (!container || !map) return;

    const boostLayerObjects = () => {
      const layers = map.getLayers?.() || [];
      const labelLayers = layers.filter((layer: any) => {
        const name = layer?.CLASS_NAME || layer?.constructor?.name || '';
        return typeof name === 'string' && /label/i.test(name);
      });
      if (labelLayers.length) {
        labelLayers.forEach((layer: any) => {
          if (!mapLabelLayerZIndexRef.current.has(layer)) {
            const current =
              typeof layer.getzIndex === 'function'
                ? layer.getzIndex()
                : typeof layer.getZIndex === 'function'
                ? layer.getZIndex()
                : layer.zIndex ?? 0;
            mapLabelLayerZIndexRef.current.set(layer, typeof current === 'number' ? current : 0);
          }
          if (typeof layer.setzIndex === 'function') {
            layer.setzIndex(300);
          } else if (typeof layer.setZIndex === 'function') {
            layer.setZIndex(300);
          }
        });
        mapLabelLayerRef.current = labelLayers;
        return true;
      }
      return false;
    };

    const boostLabelDom = () => {
      if (!mapLabelLayerDomRef.current) {
        const selectors = [
          '.amap-labels-layer',
          '.amap-labels',
          '.amap-label',
          '.amap-text',
        ];
        for (const selector of selectors) {
          const found = container.querySelector(selector) as HTMLElement | null;
          if (found) {
            mapLabelLayerDomRef.current = found;
            break;
          }
        }
        if (!mapLabelLayerDomRef.current) {
          const candidates = Array.from(container.querySelectorAll('[class]')) as HTMLElement[];
          mapLabelLayerDomRef.current =
            candidates.find((el) => /amap.*label/i.test(el.className) && /layer|labels?/i.test(el.className)) ||
            null;
        }
      }

      if (!mapLabelLayerDomRef.current) return false;
      if (mapLabelLayerDomZIndexRef.current === null) {
        mapLabelLayerDomZIndexRef.current = mapLabelLayerDomRef.current.style.zIndex || '';
      }
      mapLabelLayerDomRef.current.style.zIndex = '300';
      mapLabelLayerDomRef.current.style.pointerEvents = 'none';
      return true;
    };

    if (enabled) {
      const boosted = boostLayerObjects() || boostLabelDom();
      if (boosted) {
        mapLabelLayerBoostedRef.current = true;
      }
    } else if (mapLabelLayerBoostedRef.current) {
      mapLabelLayerRef.current.forEach((layer) => {
        const original = mapLabelLayerZIndexRef.current.get(layer);
        if (typeof original === 'number') {
          if (typeof layer.setzIndex === 'function') {
            layer.setzIndex(original);
          } else if (typeof layer.setZIndex === 'function') {
            layer.setZIndex(original);
          }
        }
      });
      mapLabelLayerRef.current = [];
      mapLabelLayerZIndexRef.current.clear();

      if (mapLabelLayerDomRef.current) {
        mapLabelLayerDomRef.current.style.zIndex = mapLabelLayerDomZIndexRef.current || '';
        mapLabelLayerDomRef.current.style.pointerEvents = '';
      }
      mapLabelLayerDomZIndexRef.current = null;
      mapLabelLayerBoostedRef.current = false;
    }
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

  // 防抖函数（用于选中 location 的天气，供中心标记使用）
  const debouncedFetchWeather = useCallback((lat: number, lon: number) => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      fetchCenterWeather(lat, lon);
    }, 500); // 500ms 防抖
  }, [fetchCenterWeather]);

  // 获取视口中心坐标的天气数据（供右下角 InfoCard 展示）
  const fetchViewportCenterWeather = useCallback(async (lat: number, lon: number) => {
    try {
      setViewportCenterLoading(true);
      const response = await fetchWeatherByCoords(lat, lon);
      if (!response.ok) throw new Error('Failed to fetch weather data');
      const data = await response.json();
      setViewportCenterWeather(data);
    } catch (error) {
      console.error('Error fetching viewport center weather:', error);
      setViewportCenterWeather(null);
    } finally {
      setViewportCenterLoading(false);
    }
  }, []);

  // 防抖：视口中心天气（用于 InfoCard）
  const debouncedFetchViewportWeather = useCallback((lat: number, lon: number) => {
    if (viewportDebounceTimerRef.current) clearTimeout(viewportDebounceTimerRef.current);
    viewportDebounceTimerRef.current = setTimeout(() => {
      fetchViewportCenterWeather(lat, lon);
    }, 500);
  }, [fetchViewportCenterWeather]);

  const clearLayerState = useCallback(() => {
    temperatureLayerEnabledRef.current = false;
    windLayerEnabledRef.current = false;
    cloudLayerEnabledRef.current = false;
    precipLayerEnabledRef.current = false;
    setTemperatureLayerEnabled(false);
    setWindLayerEnabled(false);
    setCloudLayerEnabled(false);
    setPrecipLayerEnabled(false);
    setTemperatureLayerLoading(false);
    setWindLayerLoading(false);
    setCloudLayerLoading(false);
    setPrecipLayerLoading(false);
    setTemperatureLayerProgress(0);
    setWindLayerProgress(0);
    setCloudLayerProgress(0);
    setPrecipLayerProgress(0);
    setIsTimelinePlaying(false);
    setTimelineStep(0);

    if (temperatureLayerRef.current) temperatureLayerRef.current.clear();
    if (windLayerRef.current) windLayerRef.current.clear();
    if (cloudLayerRef.current) cloudLayerRef.current.clear();
    if (precipLayerRef.current) precipLayerRef.current.clear();

    if (temperatureProgressHideTimerRef.current) clearTimeout(temperatureProgressHideTimerRef.current);
    if (windProgressHideTimerRef.current) clearTimeout(windProgressHideTimerRef.current);
    if (cloudProgressHideTimerRef.current) clearTimeout(cloudProgressHideTimerRef.current);
    if (precipProgressHideTimerRef.current) clearTimeout(precipProgressHideTimerRef.current);

    temperatureProgressHideTimerRef.current = null;
    windProgressHideTimerRef.current = null;
    cloudProgressHideTimerRef.current = null;
    precipProgressHideTimerRef.current = null;

    syncMapTextLayer(false);
  }, [syncMapTextLayer]);

  const handleGlobePick = useCallback(async (lat: number, lon: number) => {
    try {
      setViewportCenterLoading(true);
      const response = await fetchWeatherByCoords(lat, lon);
      if (!response.ok) throw new Error('Failed to fetch weather data');
      const data = await response.json();
      setViewportCenterWeather(data);
    } catch (error) {
      console.error('Error fetching picked globe weather:', error);
    } finally {
      setViewportCenterLoading(false);
    }
  }, []);

  // 获取地图边界信息用于温度网格渲染
  const renderTemperatureLayer = useCallback(async (
    enabled: boolean = temperatureLayerEnabled,
    targetEpoch: number = targetTimelineEpoch
  ) => {
    if (!mapInstanceRef.current) {
      return;
    }

    // 检查地图是否完全加载
    try {
      // 尝试获取地图中心点，如果失败说明地图未完全初始化
      const center = mapInstanceRef.current.getCenter();
      if (!center) {
        return;
      }
    } catch (error) {
      return;
    }

    if (!enabled) {
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

    const mapBounds = {
      northeast: { lat: ne.lat, lng: ne.lng },
      southwest: { lat: sw.lat, lng: sw.lng },
      zoom: zoom, // 传递缩放级别
    };

    try {
      if (!temperatureLayerRef.current) {
        temperatureLayerRef.current = new TemperatureGridRenderer(mapInstanceRef.current);
      } else {
        // 如果 renderer 已存在，更新地图实例（地图可能重新初始化了）
        temperatureLayerRef.current.setMapInstance(mapInstanceRef.current);
      }
      await temperatureLayerRef.current.renderTemperatureGrid(mapBounds, {
        onProgress: handleTemperatureProgress,
        targetEpoch,
      });
    } catch (error) {
      console.error('Error rendering temperature layer:', error);
    }
  }, [handleTemperatureProgress, targetTimelineEpoch, temperatureLayerEnabled]);

  // 防抖温度网格渲染
  const debouncedRenderTemperatureLayer = useCallback((enabled?: boolean, targetEpoch?: number) => {
    if (temperatureDebounceRef.current) {
      clearTimeout(temperatureDebounceRef.current);
    }
    if (isTimelinePlaying) {
      void renderTemperatureLayer(
        enabled !== undefined ? enabled : temperatureLayerEnabled,
        targetEpoch ?? targetTimelineEpoch
      );
      return;
    }
    temperatureDebounceRef.current = setTimeout(() => {
      renderTemperatureLayer(
        enabled !== undefined ? enabled : temperatureLayerEnabled,
        targetEpoch ?? targetTimelineEpoch
      );
    }, 800); // 
  }, [isTimelinePlaying, renderTemperatureLayer, targetTimelineEpoch, temperatureLayerEnabled]);

  // 获取地图边界信息用于风力图层渲染
  const renderWindLayer = useCallback(async (
    enabled: boolean = windLayerEnabled,
    targetEpoch: number = targetTimelineEpoch
  ) => {
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
        targetEpoch,
      });
    } catch (error) {
      console.error('Error rendering wind layer:', error);
    }
  }, [handleWindProgress, targetTimelineEpoch, windLayerEnabled]);

  // 防抖风力图层渲染
  const debouncedRenderWindLayer = useCallback((enabled?: boolean, targetEpoch?: number) => {
    if (windDebounceRef.current) {
      clearTimeout(windDebounceRef.current);
    }
    if (isTimelinePlaying) {
      void renderWindLayer(enabled !== undefined ? enabled : windLayerEnabled, targetEpoch ?? targetTimelineEpoch);
      return;
    }
    windDebounceRef.current = setTimeout(() => {
      renderWindLayer(enabled !== undefined ? enabled : windLayerEnabled, targetEpoch ?? targetTimelineEpoch);
    }, 800);
  }, [isTimelinePlaying, renderWindLayer, targetTimelineEpoch, windLayerEnabled]);

  // 获取地图边界信息用于云量图层渲染
  const renderCloudLayer = useCallback(async (
    enabled: boolean = cloudLayerEnabled,
    targetEpoch: number = targetTimelineEpoch
  ) => {
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
        targetEpoch,
      });
    } catch (error) {
      console.error('Error rendering cloud layer:', error);
    }
  }, [cloudLayerEnabled, cloudRenderStyle, handleCloudProgress, targetTimelineEpoch]);

  // 防抖云量图层渲染
  const debouncedRenderCloudLayer = useCallback((enabled?: boolean, targetEpoch?: number) => {
    if (cloudDebounceRef.current) {
      clearTimeout(cloudDebounceRef.current);
    }
    if (isTimelinePlaying) {
      void renderCloudLayer(enabled !== undefined ? enabled : cloudLayerEnabled, targetEpoch ?? targetTimelineEpoch);
      return;
    }
    cloudDebounceRef.current = setTimeout(() => {
      renderCloudLayer(enabled !== undefined ? enabled : cloudLayerEnabled, targetEpoch ?? targetTimelineEpoch);
    }, 800);
  }, [isTimelinePlaying, renderCloudLayer, targetTimelineEpoch, cloudLayerEnabled]);

  // 获取地图边界信息用于降水图层渲染
  const renderPrecipLayer = useCallback(async (
    enabled: boolean = precipLayerEnabled,
    targetEpoch: number = targetTimelineEpoch
  ) => {
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
        targetEpoch,
      });
    } catch (error) {
      console.error('Error rendering precip layer:', error);
    }
  }, [handlePrecipProgress, precipLayerEnabled, targetTimelineEpoch]);

  // 防抖降水图层渲染
  const debouncedRenderPrecipLayer = useCallback((enabled?: boolean, targetEpoch?: number) => {
    if (precipDebounceRef.current) {
      clearTimeout(precipDebounceRef.current);
    }
    if (isTimelinePlaying) {
      void renderPrecipLayer(enabled !== undefined ? enabled : precipLayerEnabled, targetEpoch ?? targetTimelineEpoch);
      return;
    }
    precipDebounceRef.current = setTimeout(() => {
      renderPrecipLayer(enabled !== undefined ? enabled : precipLayerEnabled, targetEpoch ?? targetTimelineEpoch);
    }, 800);
  }, [isTimelinePlaying, renderPrecipLayer, targetTimelineEpoch, precipLayerEnabled]);

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
    syncMapTextLayer(anyLayerEnabled);
  }, [anyLayerEnabled, syncMapTextLayer]);

  useEffect(() => {
    debouncedFetchWeatherRef.current = debouncedFetchWeather;
  }, [debouncedFetchWeather]);

  useEffect(() => {
    debouncedFetchViewportWeatherRef.current = debouncedFetchViewportWeather;
  }, [debouncedFetchViewportWeather]);

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
    targetTimelineEpochRef.current = targetTimelineEpoch;
  }, [targetTimelineEpoch]);

  useEffect(() => {
    if (!is3DMode) return;
    clearLayerState();
    debouncedFetchViewportWeatherRef.current?.(location.lat, location.lon);
  }, [clearLayerState, is3DMode, location.lat, location.lon]);

  useEffect(() => {
    const enabledTasks: Array<Promise<void>> = [];
    if (temperatureLayerEnabledRef.current) {
      const task = isTimelinePlaying
        ? renderTemperatureLayer(true, targetTimelineEpoch)
        : new Promise<void>((resolve) => {
            debouncedRenderTemperatureLayerRef.current?.(true, targetTimelineEpoch);
            resolve();
          });
      enabledTasks.push(task);
    }
    if (windLayerEnabledRef.current) {
      const task = isTimelinePlaying
        ? renderWindLayer(true, targetTimelineEpoch)
        : new Promise<void>((resolve) => {
            debouncedRenderWindLayerRef.current?.(true, targetTimelineEpoch);
            resolve();
          });
      enabledTasks.push(task);
    }
    if (cloudLayerEnabledRef.current) {
      const task = isTimelinePlaying
        ? renderCloudLayer(true, targetTimelineEpoch)
        : new Promise<void>((resolve) => {
            debouncedRenderCloudLayerRef.current?.(true, targetTimelineEpoch);
            resolve();
          });
      enabledTasks.push(task);
    }
    if (precipLayerEnabledRef.current) {
      const task = isTimelinePlaying
        ? renderPrecipLayer(true, targetTimelineEpoch)
        : new Promise<void>((resolve) => {
            debouncedRenderPrecipLayerRef.current?.(true, targetTimelineEpoch);
            resolve();
          });
      enabledTasks.push(task);
    }

    if (!isTimelinePlaying || enabledTasks.length === 0) {
      return;
    }

    playbackFrameRenderingRef.current = true;
    void Promise.all(enabledTasks).finally(() => {
      playbackFrameRenderingRef.current = false;
    });
  }, [
    isTimelinePlaying,
    renderCloudLayer,
    renderPrecipLayer,
    renderTemperatureLayer,
    renderWindLayer,
    targetTimelineEpoch,
  ]);

  useEffect(() => {
    if (!isTimelinePlaying) {
      return;
    }
    const timer = setInterval(() => {
      if (playbackFrameRenderingRef.current) {
        return;
      }
      const hasActiveLayerLoading =
        (temperatureLayerEnabledRef.current && temperatureLayerLoading) ||
        (windLayerEnabledRef.current && windLayerLoading) ||
        (cloudLayerEnabledRef.current && cloudLayerLoading) ||
        (precipLayerEnabledRef.current && precipLayerLoading);
      if (hasActiveLayerLoading) {
        return;
      }
      setTimelineStep((prev) => {
        const next = prev + 1;
        if (next >= TIMELINE_TOTAL_STEPS) {
          queueMicrotask(() => setIsTimelinePlaying(false));
          return 0;
        }
        return next;
      });
    }, TIMELINE_PLAY_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [
    cloudLayerLoading,
    isTimelinePlaying,
    precipLayerLoading,
    temperatureLayerLoading,
    windLayerLoading,
  ]);

  useEffect(() => {
    if (!cloudLayerEnabled || !cloudLayerRef.current) return;
    cloudLayerRef.current.setRenderStyle(cloudRenderStyle);
  }, [cloudLayerEnabled, cloudRenderStyle]);

  const handleTimelineChange = useCallback((nextStep: number) => {
    setIsTimelinePlaying(false);
    setTimelineStep(nextStep);
  }, []);

  const handleToggleTimelinePlay = useCallback(() => {
    setIsTimelinePlaying((prev) => !prev);
  }, []);

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
    setTemperatureLayerEnabled(enabled);
    
    if (enabled) {
      setTemperatureLayerProgress(0);
      // 立即渲染当前视图的温度图层
      debouncedRenderTemperatureLayer(enabled, targetTimelineEpoch);
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
  }, [debouncedRenderTemperatureLayer, targetTimelineEpoch]);

  // 处理风力图层启用/禁用
  const handleWindLayerChange = useCallback((enabled: boolean) => {
    setWindLayerEnabled(enabled);

    if (enabled) {
      setWindLayerProgress(0);
      debouncedRenderWindLayer(enabled, targetTimelineEpoch);
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
  }, [debouncedRenderWindLayer, targetTimelineEpoch]);

  // 处理云量图层启用/禁用
  const handleCloudLayerChange = useCallback((enabled: boolean) => {
    setCloudLayerEnabled(enabled);

    if (enabled) {
      setCloudLayerProgress(0);
      debouncedRenderCloudLayer(enabled, targetTimelineEpoch);
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
  }, [debouncedRenderCloudLayer, targetTimelineEpoch]);

  // 处理降水图层启用/禁用
  const handlePrecipLayerChange = useCallback((enabled: boolean) => {
    setPrecipLayerEnabled(enabled);

    if (enabled) {
      setPrecipLayerProgress(0);
      debouncedRenderPrecipLayer(enabled, targetTimelineEpoch);
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
  }, [debouncedRenderPrecipLayer, targetTimelineEpoch]);

  // 同步父组件的温度图层状态
  useEffect(() => {
    // 由于父组件会触发 onTemperatureLayerChange 更新，
    // 而 handleTemperatureLayerChange 已经处理了同步逻辑，
    // 这里不需要额外的同步逻辑
  }, []);

  useEffect(() => {
    // 如果地图已经初始化，更新中心点
    if (is3DMode) return;
    if (mapInstanceRef.current && location.lat && location.lon) {
      mapInstanceRef.current.setCenter([location.lon, location.lat]);
      if (centerMarkerRef.current) {
        centerMarkerRef.current.setPosition([location.lon, location.lat]);
      }
      // 标记用：选中 location 的天气
      fetchCenterWeather(location.lat, location.lon);
      // InfoCard 用：视口中心即新 location，同步拉取
      debouncedFetchViewportWeatherRef.current?.(location.lat, location.lon);
    }
  }, [fetchCenterWeather, is3DMode, location.lat, location.lon]);

  useEffect(() => {
    if (is3DMode) return;
    if (!mapContainerRef.current) return;

    const mapContainerEl = mapContainerRef.current;
    const timeoutIds: number[] = [];
    let disposed = false;
    let activeMap: any = null;
    let activeMoveEndHandler: (() => void) | null = null;
    let activeZoomEndHandler: (() => void) | null = null;
    let activeCompleteHandler: (() => void) | null = null;

    const scheduleTimeout = (callback: () => void, delay: number) => {
      const timeoutId = window.setTimeout(() => {
        if (!disposed) {
          callback();
        }
      }, delay);
      timeoutIds.push(timeoutId);
    };

    const destroyMapInstance = () => {
      if (mapContainerClickCaptureRef.current) {
        mapContainerEl.removeEventListener('click', mapContainerClickCaptureRef.current, true);
        mapContainerClickCaptureRef.current = null;
      }

      if (activeMap?.off) {
        if (activeMoveEndHandler) activeMap.off('moveend', activeMoveEndHandler);
        if (activeZoomEndHandler) activeMap.off('zoomend', activeZoomEndHandler);
        if (activeCompleteHandler) activeMap.off('complete', activeCompleteHandler);
      }

      if (mapInstanceRef.current) {
        try {
          mapInstanceRef.current.destroy();
        } catch (error) {
          console.error('Error destroying map instance:', error);
        } finally {
          mapInstanceRef.current = null;
        }
      }

      activeMap = null;
      activeMoveEndHandler = null;
      activeZoomEndHandler = null;
      activeCompleteHandler = null;
    };

    const initMap = () => {
      if (!window.AMap || disposed) return;

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
        try {
          mapInstanceRef.current.destroy();
        } catch (error) {
          console.error('Error destroying previous map instance:', error);
        } finally {
          mapInstanceRef.current = null;
        }
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
      mapInstanceRef.current = new window.AMap.Map(mapContainerEl, {
        center: center,
        zoom: 10,
        viewMode: '3D', // 3D视图
        pitch: 0,
        rotation: 0,
        mapStyle: 'amap://styles/normal', // 标准样式
        features: ['bg', 'point', 'road', 'building'], // 显示要素
      });
      activeMap = mapInstanceRef.current;

      syncMapTextLayer(
        temperatureLayerEnabledRef.current ||
          windLayerEnabledRef.current ||
          cloudLayerEnabledRef.current ||
          precipLayerEnabledRef.current
      );

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

      // 绑定地图事件：拖拽结束、缩放结束（中心标记固定于 location 经纬度，不随视口移动）
      const handleMoveEnd = () => {
        if (!mapInstanceRef.current) return;
        // 右下角 InfoCard 展示视口中心坐标的天气
        const center = mapInstanceRef.current.getCenter();
        const lat = center.getLat();
        const lon = center.getLng();
        debouncedFetchViewportWeatherRef.current?.(lat, lon);
        // 刷新各类图层以匹配当前视口
        if (temperatureLayerEnabledRef.current) {
          debouncedRenderTemperatureLayerRef.current?.(true, targetTimelineEpochRef.current);
        }
        if (windLayerEnabledRef.current) {
          debouncedRenderWindLayerRef.current?.(true, targetTimelineEpochRef.current);
        }
        if (cloudLayerEnabledRef.current) {
          debouncedRenderCloudLayerRef.current?.(true, targetTimelineEpochRef.current);
        }
        if (precipLayerEnabledRef.current) {
          debouncedRenderPrecipLayerRef.current?.(true, targetTimelineEpochRef.current);
        }
      };

      const handleZoomEnd = () => {
        if (!mapInstanceRef.current) return;
        // 右下角 InfoCard 展示视口中心坐标的天气
        const center = mapInstanceRef.current.getCenter();
        const lat = center.getLat();
        const lon = center.getLng();
        debouncedFetchViewportWeatherRef.current?.(lat, lon);
        // 刷新各类图层以匹配当前视口
        if (temperatureLayerEnabledRef.current) {
          debouncedRenderTemperatureLayerRef.current?.(true, targetTimelineEpochRef.current);
        }
        if (windLayerEnabledRef.current) {
          debouncedRenderWindLayerRef.current?.(true, targetTimelineEpochRef.current);
        }
        if (cloudLayerEnabledRef.current) {
          debouncedRenderCloudLayerRef.current?.(true, targetTimelineEpochRef.current);
        }
        if (precipLayerEnabledRef.current) {
          debouncedRenderPrecipLayerRef.current?.(true, targetTimelineEpochRef.current);
        }
      };

      mapInstanceRef.current.on('moveend', handleMoveEnd);
      mapInstanceRef.current.on('zoomend', handleZoomEnd);

      // 单击地图：把点击位置天气同步到右下角 InfoCard
      const handleContainerClickCapture = (e: MouseEvent) => {
        const map = mapInstanceRef.current;
        const container = mapContainerRef.current;
        if (!map || !container) return;
        const rect = container.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const Pixel = window.AMap?.Pixel;
        const lnglat = Pixel != null
          ? map.containerToLngLat(new window.AMap.Pixel(x, y))
          : (map.containerToLngLat as ((p: { x: number; y: number }) => any))?.({ x, y });
        if (!lnglat) return;
        const lat = typeof lnglat.getLat === 'function' ? lnglat.getLat() : lnglat.lat;
        const lon = typeof lnglat.getLng === 'function' ? lnglat.getLng() : lnglat.lng;
        void fetchViewportCenterWeather(lat, lon);
      };
      mapContainerClickCaptureRef.current = handleContainerClickCapture;
      mapContainerEl.addEventListener('click', handleContainerClickCapture, true);

      // 初始化时：标记用 location 天气，InfoCard 用视口中心天气（初始时与 location 一致）
      scheduleTimeout(() => {
        debouncedFetchWeatherRef.current?.(location.lat, location.lon);
        debouncedFetchViewportWeatherRef.current?.(location.lat, location.lon);
      }, 300);

      // 删除高德地图水印
      const removeWatermark = () => {
        if (disposed) return;
        
        // 只隐藏水印节点，不直接 remove，避免与地图 SDK 自身的销毁流程冲突
        const selectors = [
          '[class*="amap-copyright"]',
          '[class*="amap-logo"]',
          '[class*="amap-maps"]',
          '.amap-copyright',
          '.amap-logo'
        ];
        
        selectors.forEach(selector => {
          const elements = mapContainerEl.querySelectorAll(selector);
          elements.forEach((el: Element) => {
            const htmlEl = el as HTMLElement;
            if (htmlEl.textContent && (
              htmlEl.textContent.includes('高德地图') || 
              htmlEl.textContent.includes('Amap') || 
              htmlEl.textContent.includes('©') ||
              htmlEl.textContent.includes('GS(')
            )) {
              htmlEl.style.display = 'none';
              htmlEl.style.pointerEvents = 'none';
              htmlEl.style.opacity = '0';
            }
          });
        });
        
        const allElements = mapContainerEl.querySelectorAll('*');
        allElements.forEach((el: Element) => {
          const htmlEl = el as HTMLElement;
          const text = htmlEl.textContent || '';
          if (text.includes('高德地图') || text.includes('Amap')) {
            if (text.includes('©') || text.includes('GS(') || text.includes('Amap')) {
              htmlEl.style.display = 'none';
              htmlEl.style.pointerEvents = 'none';
              htmlEl.style.opacity = '0';
            }
          }
        });
      };

      // 延迟删除水印，确保地图已完全加载（多次尝试确保删除成功）
      scheduleTimeout(removeWatermark, 300);
      scheduleTimeout(removeWatermark, 800);
      scheduleTimeout(removeWatermark, 1500);
      
      // 监听地图加载完成事件
      activeMoveEndHandler = handleMoveEnd;
      activeZoomEndHandler = handleZoomEnd;
      activeCompleteHandler = () => {
        scheduleTimeout(removeWatermark, 100);
        const hasLayer =
          temperatureLayerEnabledRef.current ||
          windLayerEnabledRef.current ||
          cloudLayerEnabledRef.current ||
          precipLayerEnabledRef.current;
        syncMapTextLayer(hasLayer);
        scheduleTimeout(() => syncMapTextLayer(hasLayer), 300);
        scheduleTimeout(() => syncMapTextLayer(hasLayer), 800);
        // 地图加载完成后，如果启用了温度图层，渲染温度图层
        if (temperatureLayerEnabledRef.current) {
          scheduleTimeout(() => {
            debouncedRenderTemperatureLayerRef.current?.(true, targetTimelineEpochRef.current);
          }, 500);
        }
        if (windLayerEnabledRef.current) {
          scheduleTimeout(() => {
            debouncedRenderWindLayerRef.current?.(true, targetTimelineEpochRef.current);
          }, 500);
        }
        if (cloudLayerEnabledRef.current) {
          scheduleTimeout(() => {
            debouncedRenderCloudLayerRef.current?.(true, targetTimelineEpochRef.current);
          }, 500);
        }
        if (precipLayerEnabledRef.current) {
          scheduleTimeout(() => {
            debouncedRenderPrecipLayerRef.current?.(true, targetTimelineEpochRef.current);
          }, 500);
        }
      };

      activeMap.on('moveend', activeMoveEndHandler);
      activeMap.on('zoomend', activeZoomEndHandler);
      activeMap.on('complete', activeCompleteHandler);
    };

    const cleanup = () => {
      disposed = true;

      timeoutIds.forEach((timeoutId) => {
        clearTimeout(timeoutId);
      });

      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      if (viewportDebounceTimerRef.current) {
        clearTimeout(viewportDebounceTimerRef.current);
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

      destroyMapInstance();
      mapLabelLayerBoostedRef.current = false;
      mapLabelLayerRef.current = [];
      mapLabelLayerZIndexRef.current.clear();
      mapLabelLayerDomRef.current = null;
      mapLabelLayerDomZIndexRef.current = null;
      centerMarkerRef.current = null;
    };

    // 检查是否已经加载了高德地图脚本
    if (window.AMap) {
      scriptLoadedRef.current = true;
      initMap();
      return cleanup;
    }

    // 如果脚本正在加载，不重复加载
    if (scriptLoadedRef.current) return cleanup;

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
      if (disposed) return;
      scriptLoadedRef.current = true;
      initMap();
    };
    document.head.appendChild(script);

    return cleanup;
  }, [fetchViewportCenterWeather, is3DMode, location.lat, location.lon, location.name, location.region, location.country, syncMapTextLayer]);

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
    <div className="rounded-2xl shadow-xl p-4 h-full flex flex-col relative" style={{ backgroundColor: getCardBackgroundStyle(opacity, textColorTheme.backgroundType) }}>
      <div className="flex items-center justify-between gap-3 mb-4">
        <h2 className={`text-xl font-bold ${textColorTheme.textColor.primary}`}>
          地图位置
        </h2>
        <SegmentedDropdown
          textColorTheme={textColorTheme}
          positionClassName="relative z-20"
          mainButton={{
            value: mapRenderMode,
            label: mapRenderMode === '3d' ? '地球视图' : '地图视图',
            icon: mapRenderMode === '3d' ? '/icons/地球.svg' : '/icons/地图.svg',
          }}
          dropdownOptions={[
            { value: '2d', label: '地图视图', icon: '/icons/地图.svg' },
            { value: '3d', label: '地球视图', icon: '/icons/地球.svg' },
          ]}
          onSelect={(value) => setMapRenderMode(value as '2d' | '3d')}
        />
      </div>
      <div className="flex-1 rounded-lg overflow-hidden relative min-h-[280px] sm:min-h-[360px] lg:min-h-[800px]" ref={fullscreenContainerRef}>
        {is3DMode && (
          <div className="absolute inset-0 z-0">
            <Globe3D
              location={location}
              onGlobePick={handleGlobePick}
              className="w-full h-full"
              referenceEpoch={anyLayerEnabled ? targetTimelineEpoch : undefined}
            />
          </div>
        )}
        <div
          ref={mapContainerRef}
          className="w-full h-full min-h-[280px] sm:min-h-[360px] lg:min-h-[800px]"
          style={{
            position: is3DMode ? 'absolute' : 'relative',
            zIndex: 0,
            visibility: is3DMode ? 'hidden' : 'visible',
            pointerEvents: is3DMode ? 'none' : 'auto',
            width: '100%',
            height: '100%',
          }}
        />
        {!is3DMode && showLayerProgress && (
          <div className="absolute top-0 left-0 right-0 z-20 pointer-events-none">
            <div className="flex flex-col">
              {temperatureLayerLoading && (
                <div className="h-1 w-full rounded-full overflow-hidden bg-white/30 backdrop-blur-sm">
                  <div
                    className="h-full rounded-full transition-[width] duration-200 ease-out"
                    style={{
                      width: `${temperatureLayerProgress}%`,
                      background: 'linear-gradient(90deg, #0ea5e9 0%, #06b6d4 50%, #22d3ee 100%)',
                      boxShadow: '0 0 12px rgba(14, 165, 233, 0.5)',
                    }}
                  />
                </div>
              )}
              {windLayerLoading && (
                <div className="h-1 w-full rounded-full overflow-hidden bg-white/30 backdrop-blur-sm">
                  <div
                    className="h-full rounded-full transition-[width] duration-200 ease-out"
                    style={{
                      width: `${windLayerProgress}%`,
                      background: 'linear-gradient(90deg, #059669 0%, #10b981 50%, #34d399 100%)',
                      boxShadow: '0 0 12px rgba(16, 185, 129, 0.5)',
                    }}
                  />
                </div>
              )}
              {cloudLayerLoading && (
                <div className="h-1 w-full rounded-full overflow-hidden bg-white/30 backdrop-blur-sm">
                  <div
                    className="h-full rounded-full transition-[width] duration-200 ease-out"
                    style={{
                      width: `${cloudLayerProgress}%`,
                      background: 'linear-gradient(90deg, #475569 0%, #64748b 50%, #94a3b8 100%)',
                      boxShadow: '0 0 12px rgba(100, 116, 139, 0.5)',
                    }}
                  />
                </div>
              )}
              {precipLayerLoading && (
                <div className="h-1 w-full rounded-full overflow-hidden bg-white/30 backdrop-blur-sm">
                  <div
                    className="h-full rounded-full transition-[width] duration-200 ease-out"
                    style={{
                      width: `${precipLayerProgress}%`,
                      background: 'linear-gradient(90deg, #4f46e5 0%, #6366f1 50%, #818cf8 100%)',
                      boxShadow: '0 0 12px rgba(99, 102, 241, 0.5)',
                    }}
                  />
                </div>
              )}
            </div>
          </div>
        )}
        {!is3DMode && (precipLayerEnabled || temperatureLayerEnabled) && (
          <div className="absolute top-2 left-2 sm:top-4 sm:left-4 z-10 flex flex-col gap-3">
            {precipLayerEnabled && <PrecipLegend />}
            {temperatureLayerEnabled && <TemperatureLegend />}
          </div>
        )}
        <div className="absolute top-2 right-2 sm:top-4 sm:right-4 z-50 flex items-center gap-2">
          {!is3DMode && (
            <div ref={layerDropdownRef} className="relative">
              <button
                type="button"
                onClick={() => setLayerDropdownOpen((v) => !v)}
                className="flex items-center justify-center w-10 h-10 min-w-[44px] min-h-[44px] rounded-full bg-white/70 backdrop-blur-sm shadow-lg border border-white/40 hover:bg-white/90 transition-colors text-slate-600"
                aria-expanded={layerDropdownOpen}
                aria-haspopup="true"
                title={anyLayerEnabled ? '图层：已开启' : '图层选项'}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
                  <rect x="3" y="7" width="14" height="14" rx="2" />
                  <rect x="7" y="3" width="14" height="14" rx="2" />
                </svg>
              </button>
              {layerDropdownOpen && (
                <div className="absolute top-full right-0 mt-2 flex flex-col gap-2 min-w-[120px] max-w-[50vw] py-2 px-2 bg-white/70 backdrop-blur-sm rounded-2xl shadow-xl border border-white/40">
                  <button type="button" onClick={() => handleTemperatureLayerChange(!temperatureLayerEnabled)} className={`flex items-center gap-3 w-full px-4 py-2.5 rounded-full text-sm transition-colors ${temperatureLayerEnabled ? 'bg-white/90 text-slate-800 shadow-sm' : 'bg-white/50 text-slate-600 hover:bg-white/70'}`}>
                    <span className="w-5 h-5 flex items-center justify-center flex-shrink-0 [&>svg]:w-3.5 [&>svg]:h-3.5" aria-hidden>
                      {temperatureLayerEnabled ? (
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-slate-600"><polyline points="20 6 9 17 4 12" /></svg>
                      ) : (
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-slate-400"><circle cx="12" cy="12" r="10" /></svg>
                      )}
                    </span>
                    <span>气温</span>
                  </button>
                  <button type="button" onClick={() => handleWindLayerChange(!windLayerEnabled)} className={`flex items-center gap-3 w-full px-4 py-2.5 rounded-full text-sm transition-colors ${windLayerEnabled ? 'bg-white/90 text-slate-800 shadow-sm' : 'bg-white/50 text-slate-600 hover:bg-white/70'}`}>
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
                  <button type="button" onClick={() => handleCloudLayerChange(!cloudLayerEnabled)} className={`flex items-center gap-3 w-full px-4 py-2.5 rounded-full text-sm transition-colors ${cloudLayerEnabled ? 'bg-white/90 text-slate-800 shadow-sm' : 'bg-white/50 text-slate-600 hover:bg-white/70'}`}>
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
                  <button type="button" onClick={() => handlePrecipLayerChange(!precipLayerEnabled)} className={`flex items-center gap-3 w-full px-4 py-2.5 rounded-full text-sm transition-colors ${precipLayerEnabled ? 'bg-white/90 text-slate-800 shadow-sm' : 'bg-white/50 text-slate-600 hover:bg-white/70'}`}>
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
                </div>
              )}
            </div>
          )}

          <button
            type="button"
            onClick={toggleFullscreen}
            className="flex items-center justify-center w-10 h-10 min-w-[44px] min-h-[44px] rounded-full bg-white/70 backdrop-blur-sm shadow-lg border border-white/40 hover:bg-white/90 transition-colors text-slate-600"
            title={isFullscreen ? '退出全屏' : '全屏'}
            aria-label={isFullscreen ? '退出全屏' : '全屏'}
          >
            {isFullscreen ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
                <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3" />
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
                <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
              </svg>
            )}
          </button>
        </div>
        {/* 上方正中间：缩放按钮（左右排布） */}
        {!is3DMode && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 sm:top-4 z-10 flex flex-row gap-px">
          <button
            type="button"
            onClick={handleZoomOut}
            className="w-9 h-9 min-w-[44px] min-h-[44px] flex items-center justify-center bg-white/70 backdrop-blur-sm rounded-l-lg border border-white/40 shadow-lg text-gray-800 text-xl font-light hover:bg-white/90 transition-colors leading-none"
            title="缩小"
            aria-label="缩小"
          >
            −
          </button>
          <button
            type="button"
            onClick={handleZoomIn}
            className="w-9 h-9 min-w-[44px] min-h-[44px] flex items-center justify-center bg-white/70 backdrop-blur-sm rounded-r-lg border border-white/40 shadow-lg text-gray-800 text-xl font-light hover:bg-white/90 transition-colors leading-none"
            title="放大"
            aria-label="放大"
          >
            +
          </button>
        </div>
        )}
        {!is3DMode && anyLayerEnabled && (
          <MapTimelinePlayback
            step={timelineStep}
            isPlaying={isTimelinePlaying}
            timeLabel={timelineTimeLabel}
            onStepChange={handleTimelineChange}
            onTogglePlay={handleToggleTimelinePlay}
          />
        )}
        {/* 右下角：悬浮天气信息组件（展示窗口中央对应坐标的天气） */}
        <FloatingWeatherInfo 
          location={viewportCenterWeather?.location ?? location}
          current={viewportCenterWeather?.current}
          loading={viewportCenterLoading}
          textColorTheme={textColorTheme}
        />
      </div>
      <div className={`mt-3 text-sm ${textColorTheme.textColor.secondary}`}>
        <p>坐标: {location.lat.toFixed(4)}, {location.lon.toFixed(4)}</p>
      </div>
    </div>
  );
}
