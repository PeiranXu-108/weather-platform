'use client';

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import type { Location, WeatherResponse } from '@/app/types/weather';
import type { TextColorTheme } from '@/app/utils/textColorTheme';
import { getCardBackgroundStyle, readableTextShadowStyle } from '@/app/utils/textColorTheme';
import FloatingWeatherInfo from './InfoCard';
import { TIMELINE_TOTAL_STEPS } from './MapTimelinePlayback';
import {
  LayerProgressBars,
  MapLayerLegends,
  MapTimelineControls,
  MapTopControls,
  MapZoomControls,
  WeatherMapHeader,
  type MapRenderMode,
} from './WeatherMapControls';
import { TemperatureGridRenderer } from '@/app/utils/temperatureGridRenderer';
import { WindFieldRenderer } from '@/app/utils/windFieldRenderer';
import { CloudLayerRenderer } from '@/app/utils/cloudLayerRenderer';
import { PrecipLayerRenderer } from '@/app/utils/precipLayerRenderer';
import {
  MapLibreCloudLayerRenderer,
  MapLibrePrecipLayerRenderer,
  MapLibreTemperatureGridRenderer,
  MapLibreWindFieldRenderer,
} from '@/app/utils/mapLibreWeatherLayerRenderer';
import {
  centerMarkerSize,
  formatCenterTemp,
  buildCenterMarkerContent
} from './centerMarker';
import { fetchWeatherByCoords } from '@/app/lib/api';
import Globe3D from './Globe3D';
import { isDomesticCity } from '@/app/utils/utils';
import { useI18n } from '@/app/i18n';
import type { Map as MapLibreMap, Marker as MapLibreMarker } from 'maplibre-gl';

interface WeatherMapProps {
  location: Location;
  textColorTheme: TextColorTheme;
  enhanceReadableText?: boolean;
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
const MAPLIBRE_STYLE_URL = process.env.NEXT_PUBLIC_MAPLIBRE_STYLE_URL || 'https://tiles.openfreemap.org/styles/liberty';
const TIMELINE_STEP_SECONDS = 2 * 3600; // 2小时
const TIMELINE_PLAY_INTERVAL_MS = 400;
type MapProvider = 'amap' | 'maplibre';
type AnyMapInstance = any | MapLibreMap;
type AnyCenterMarker = any | MapLibreMarker;

export default function WeatherMap({ location, textColorTheme, enhanceReadableText = false, opacity = 100, onGoToLocation }: WeatherMapProps) {
  const { locale, t } = useI18n();
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<AnyMapInstance | null>(null);
  const mapLabelLayerRef = useRef<any[]>([]);
  const mapLabelLayerZIndexRef = useRef<Map<any, number>>(new Map());
  const mapLabelLayerDomRef = useRef<HTMLElement | null>(null);
  const mapLabelLayerDomZIndexRef = useRef<string | null>(null);
  const mapLabelLayerBoostedRef = useRef(false);
  const centerMarkerRef = useRef<AnyCenterMarker | null>(null);
  const scriptLoadedRef = useRef(false);
  const [centerWeather, setCenterWeather] = useState<WeatherResponse | null>(null);
  const [loadingWeather, setLoadingWeather] = useState(false);
  const [viewportCenterWeather, setViewportCenterWeather] = useState<WeatherResponse | null>(null);
  const [viewportCenterLoading, setViewportCenterLoading] = useState(false);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const viewportDebounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const temperatureLayerRef = useRef<TemperatureGridRenderer | MapLibreTemperatureGridRenderer | null>(null);
  const [temperatureLayerEnabled, setTemperatureLayerEnabled] = useState(false);
  const temperatureLayerEnabledRef = useRef(false);
  const [temperatureLayerProgress, setTemperatureLayerProgress] = useState(0);
  const [temperatureLayerLoading, setTemperatureLayerLoading] = useState(false);
  const temperatureProgressHideTimerRef = useRef<NodeJS.Timeout | null>(null);
  const temperatureDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const windLayerRef = useRef<WindFieldRenderer | MapLibreWindFieldRenderer | null>(null);
  const [windLayerEnabled, setWindLayerEnabled] = useState(false);
  const windLayerEnabledRef = useRef(false);
  const [windLayerProgress, setWindLayerProgress] = useState(0);
  const [windLayerLoading, setWindLayerLoading] = useState(false);
  const windProgressHideTimerRef = useRef<NodeJS.Timeout | null>(null);
  const windDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const cloudLayerRef = useRef<CloudLayerRenderer | MapLibreCloudLayerRenderer | null>(null);
  const [cloudLayerEnabled, setCloudLayerEnabled] = useState(false);
  const cloudLayerEnabledRef = useRef(false);
  const [cloudLayerProgress, setCloudLayerProgress] = useState(0);
  const [cloudLayerLoading, setCloudLayerLoading] = useState(false);
  const cloudProgressHideTimerRef = useRef<NodeJS.Timeout | null>(null);
  const cloudDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const [cloudRenderStyle, setCloudRenderStyle] = useState<'soft' | 'noise'>('noise');
  const precipLayerRef = useRef<PrecipLayerRenderer | MapLibrePrecipLayerRenderer | null>(null);
  const [precipLayerEnabled, setPrecipLayerEnabled] = useState(false);
  const precipLayerEnabledRef = useRef(false);
  const [precipLayerProgress, setPrecipLayerProgress] = useState(0);
  const [precipLayerLoading, setPrecipLayerLoading] = useState(false);
  const precipProgressHideTimerRef = useRef<NodeJS.Timeout | null>(null);
  const precipDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const [layerDropdownOpen, setLayerDropdownOpen] = useState(false);
  const layerDropdownRef = useRef<HTMLDivElement>(null);
  const [mapRenderMode, setMapRenderMode] = useState<MapRenderMode>('2d');
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
    return new Intl.DateTimeFormat(locale === 'zh' ? 'zh-CN' : 'en', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(new Date(targetTimelineEpoch * 1000));
  }, [targetTimelineEpoch, locale]);

  const isForeignCity = useMemo(() => !isDomesticCity(location.country ?? '', location.region ?? '', location.name ?? ''), [location.country, location.region, location.name]);
  const mapProvider: MapProvider = isForeignCity ? 'maplibre' : 'amap';

  const anyLayerEnabled = temperatureLayerEnabled || windLayerEnabled || cloudLayerEnabled || precipLayerEnabled;
  const is3DMode = mapRenderMode === '3d';
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

  const getMapCenter = useCallback((): { lat: number; lon: number } | null => {
    const map = mapInstanceRef.current;
    if (!map) return null;
    try {
      const center = map.getCenter?.();
      if (!center) return null;
      return {
        lat: typeof center.getLat === 'function' ? center.getLat() : center.lat,
        lon: typeof center.getLng === 'function' ? center.getLng() : center.lng,
      };
    } catch {
      return null;
    }
  }, []);

  const getLayerMapBounds = useCallback(() => {
    const map = mapInstanceRef.current;
    if (!map) return null;
    try {
      const bounds = map.getBounds?.();
      if (!bounds) return null;
      const ne = bounds.getNorthEast();
      const sw = bounds.getSouthWest();
      const zoom = map.getZoom?.() ?? 10;
      return {
        northeast: { lat: ne.lat, lng: ne.lng },
        southwest: { lat: sw.lat, lng: sw.lng },
        zoom,
      };
    } catch {
      return null;
    }
  }, []);

  const createTemperatureRenderer = useCallback(() => {
    const map = mapInstanceRef.current;
    if (!map) return null;
    return mapProvider === 'maplibre'
      ? new MapLibreTemperatureGridRenderer(map as MapLibreMap)
      : new TemperatureGridRenderer(map);
  }, [mapProvider]);

  const createWindRenderer = useCallback(() => {
    const map = mapInstanceRef.current;
    if (!map) return null;
    return mapProvider === 'maplibre'
      ? new MapLibreWindFieldRenderer(map as MapLibreMap)
      : new WindFieldRenderer(map);
  }, [mapProvider]);

  const createCloudRenderer = useCallback(() => {
    const map = mapInstanceRef.current;
    if (!map) return null;
    return mapProvider === 'maplibre'
      ? new MapLibreCloudLayerRenderer(map as MapLibreMap, { renderStyle: cloudRenderStyle })
      : new CloudLayerRenderer(map, { renderStyle: cloudRenderStyle });
  }, [cloudRenderStyle, mapProvider]);

  const createPrecipRenderer = useCallback(() => {
    const map = mapInstanceRef.current;
    if (!map) return null;
    return mapProvider === 'maplibre'
      ? new MapLibrePrecipLayerRenderer(map as MapLibreMap)
      : new PrecipLayerRenderer(map);
  }, [mapProvider]);

  const setCenterMarkerPosition = useCallback((lon: number, lat: number) => {
    const marker = centerMarkerRef.current;
    if (!marker) return;
    if (typeof marker.setPosition === 'function') {
      marker.setPosition([lon, lat]);
      return;
    }
    if (typeof marker.setLngLat === 'function') {
      marker.setLngLat([lon, lat]);
    }
  }, []);

  const setCenterMarkerContent = useCallback((content: string) => {
    const marker = centerMarkerRef.current;
    if (!marker) return;
    if (typeof marker.setContent === 'function') {
      marker.setContent(content);
      return;
    }
    if (typeof marker.getElement === 'function') {
      marker.getElement().innerHTML = content;
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

    if (!getMapCenter()) {
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

    const mapBounds = getLayerMapBounds();
    if (!mapBounds) {
      console.error('Could not get map bounds');
      return;
    }

    try {
      if (!temperatureLayerRef.current) {
        temperatureLayerRef.current = createTemperatureRenderer();
      } else {
        // 如果 renderer 已存在，更新地图实例（地图可能重新初始化了）
        temperatureLayerRef.current.setMapInstance(mapInstanceRef.current);
      }
      if (!temperatureLayerRef.current) return;
      await temperatureLayerRef.current.renderTemperatureGrid(mapBounds, {
        onProgress: handleTemperatureProgress,
        targetEpoch,
      });
    } catch (error) {
      console.error('Error rendering temperature layer:', error);
    }
  }, [createTemperatureRenderer, getLayerMapBounds, getMapCenter, handleTemperatureProgress, targetTimelineEpoch, temperatureLayerEnabled]);

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

    if (!getMapCenter()) {
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

    const mapBounds = getLayerMapBounds();
    if (!mapBounds) return;

    try {
      if (!windLayerRef.current) {
        windLayerRef.current = createWindRenderer();
      } else {
        windLayerRef.current.setMapInstance(mapInstanceRef.current);
      }
      if (!windLayerRef.current) return;
      await windLayerRef.current.renderWindField(mapBounds, {
        onProgress: handleWindProgress,
        targetEpoch,
      });
    } catch (error) {
      console.error('Error rendering wind layer:', error);
    }
  }, [createWindRenderer, getLayerMapBounds, getMapCenter, handleWindProgress, targetTimelineEpoch, windLayerEnabled]);

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

    if (!getMapCenter()) {
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

    const mapBounds = getLayerMapBounds();
    if (!mapBounds) return;

    try {
      if (!cloudLayerRef.current) {
        cloudLayerRef.current = createCloudRenderer();
      } else {
        cloudLayerRef.current.setMapInstance(mapInstanceRef.current);
        cloudLayerRef.current.setRenderStyle(cloudRenderStyle);
      }
      if (!cloudLayerRef.current) return;
      await cloudLayerRef.current.renderCloudLayer(mapBounds, {
        onProgress: handleCloudProgress,
        targetEpoch,
      });
    } catch (error) {
      console.error('Error rendering cloud layer:', error);
    }
  }, [cloudLayerEnabled, cloudRenderStyle, createCloudRenderer, getLayerMapBounds, getMapCenter, handleCloudProgress, targetTimelineEpoch]);

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

    if (!getMapCenter()) {
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

    const mapBounds = getLayerMapBounds();
    if (!mapBounds) return;

    try {
      if (!precipLayerRef.current) {
        precipLayerRef.current = createPrecipRenderer();
      } else {
        precipLayerRef.current.setMapInstance(mapInstanceRef.current);
      }
      if (!precipLayerRef.current) return;
      await precipLayerRef.current.renderPrecipLayer(mapBounds, {
        onProgress: handlePrecipProgress,
        targetEpoch,
      });
    } catch (error) {
      console.error('Error rendering precip layer:', error);
    }
  }, [createPrecipRenderer, getLayerMapBounds, getMapCenter, handlePrecipProgress, precipLayerEnabled, targetTimelineEpoch]);

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
      setCenterMarkerPosition(location.lon, location.lat);
      // 标记用：选中 location 的天气
      fetchCenterWeather(location.lat, location.lon);
      // InfoCard 用：视口中心即新 location，同步拉取
      debouncedFetchViewportWeatherRef.current?.(location.lat, location.lon);
    }
  }, [fetchCenterWeather, is3DMode, location.lat, location.lon, setCenterMarkerPosition]);

  useEffect(() => {
    if (is3DMode) return;
    if (mapProvider !== 'amap') return;
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
        title: location.name || t('map.currentLocation'),
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
          <div style="font-weight: bold; margin-bottom: 5px;">${location.name || t('map.currentLocation')}</div>
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
  }, [fetchViewportCenterWeather, is3DMode, location.lat, location.lon, location.name, location.region, location.country, mapProvider, syncMapTextLayer, t]);

  useEffect(() => {
    if (is3DMode) return;
    if (mapProvider !== 'maplibre') return;
    if (!mapContainerRef.current) return;

    const mapContainerEl = mapContainerRef.current;
    const timeoutIds: number[] = [];
    let disposed = false;
    let activeMap: MapLibreMap | null = null;
    let activeMarker: MapLibreMarker | null = null;

    const scheduleTimeout = (callback: () => void, delay: number) => {
      const timeoutId = window.setTimeout(() => {
        if (!disposed) callback();
      }, delay);
      timeoutIds.push(timeoutId);
    };

    const clearRenderers = () => {
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
    };

    const refreshViewport = () => {
      const center = getMapCenter();
      if (!center) return;
      debouncedFetchViewportWeatherRef.current?.(center.lat, center.lon);
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

    const cleanup = () => {
      disposed = true;
      timeoutIds.forEach((timeoutId) => clearTimeout(timeoutId));
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      if (viewportDebounceTimerRef.current) clearTimeout(viewportDebounceTimerRef.current);
      if (temperatureDebounceRef.current) clearTimeout(temperatureDebounceRef.current);
      if (windDebounceRef.current) clearTimeout(windDebounceRef.current);
      if (cloudDebounceRef.current) clearTimeout(cloudDebounceRef.current);
      if (precipDebounceRef.current) clearTimeout(precipDebounceRef.current);
      if (temperatureProgressHideTimerRef.current) clearTimeout(temperatureProgressHideTimerRef.current);
      if (windProgressHideTimerRef.current) clearTimeout(windProgressHideTimerRef.current);
      if (cloudProgressHideTimerRef.current) clearTimeout(cloudProgressHideTimerRef.current);
      if (precipProgressHideTimerRef.current) clearTimeout(precipProgressHideTimerRef.current);
      clearRenderers();
      if (activeMarker) {
        activeMarker.remove();
        activeMarker = null;
      }
      if (activeMap) {
        try {
          activeMap.remove();
        } catch (error) {
          console.error('Error destroying MapLibre map instance:', error);
        }
      }
      if (mapInstanceRef.current === activeMap) {
        mapInstanceRef.current = null;
      }
      centerMarkerRef.current = null;
      activeMap = null;
    };

    void (async () => {
      try {
        const maplibregl = await import('maplibre-gl');
        if (disposed) return;
        clearRenderers();

        const map = new maplibregl.Map({
          container: mapContainerEl,
          style: MAPLIBRE_STYLE_URL,
          center: [location.lon, location.lat],
          zoom: 10,
          pitch: 0,
          bearing: 0,
          attributionControl: { compact: true },
        });
        activeMap = map;
        mapInstanceRef.current = map;

        const markerEl = document.createElement('div');
        markerEl.style.width = `${centerMarkerSize}px`;
        markerEl.style.height = `${centerMarkerSize + 15}px`;
        markerEl.style.pointerEvents = 'auto';
        markerEl.style.zIndex = '2';
        markerEl.innerHTML = buildCenterMarkerContent(
          null,
          null,
          null,
          '--'
        );
        const marker = new maplibregl.Marker({ element: markerEl, anchor: 'bottom' })
          .setLngLat([location.lon, location.lat])
          .addTo(map);
        centerMarkerRef.current = marker;
        activeMarker = marker;

        const popup = new maplibregl.Popup({ offset: 30 }).setHTML(`<div style="padding: 10px;">
          <div style="font-weight: bold; margin-bottom: 5px;">${location.name || t('map.currentLocation')}</div>
          <div style="font-size: 12px; color: #666;">${location.region || ''} ${location.country || ''}</div>
        </div>`);
        markerEl.addEventListener('click', () => {
          popup.setLngLat([location.lon, location.lat]).addTo(map);
        });

        const handleMapLoaded = () => {
          if (disposed) return;
          scheduleTimeout(() => {
            debouncedFetchWeatherRef.current?.(location.lat, location.lon);
            debouncedFetchViewportWeatherRef.current?.(location.lat, location.lon);
          }, 300);
          scheduleTimeout(() => {
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
          }, 500);
        };

        map.on('load', handleMapLoaded);
        map.on('moveend', refreshViewport);
        map.on('zoomend', refreshViewport);
        map.on('click', (event) => {
          void fetchViewportCenterWeather(event.lngLat.lat, event.lngLat.lng);
        });
      } catch (error) {
        console.error('Error initializing MapLibre map:', error);
      }
    })();

    return cleanup;
  }, [
    fetchViewportCenterWeather,
    getMapCenter,
    is3DMode,
    location.country,
    location.lat,
    location.lon,
    location.name,
    location.region,
    mapProvider,
    t,
  ]);

  useEffect(() => {
    if (!centerMarkerRef.current) return;
    setCenterMarkerContent(buildCenterMarkerContent(
      centerWeather?.current?.temp_c ?? null,
      centerWeather?.forecast?.forecastday?.[0]?.day?.mintemp_c ?? null,
      centerWeather?.forecast?.forecastday?.[0]?.day?.maxtemp_c ?? null,
      formatCenterTemp(centerWeather?.current)
    ));
  }, [centerWeather, setCenterMarkerContent]);

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

  const mapTitleShadow = readableTextShadowStyle('primary', enhanceReadableText);
  const mapFooterShadow = readableTextShadowStyle('secondary', enhanceReadableText);

  return (
    <div className="rounded-2xl shadow-xl p-4 h-full flex flex-col relative" style={{ backgroundColor: getCardBackgroundStyle(opacity, textColorTheme.backgroundType) }}>
      <WeatherMapHeader
        textColorTheme={textColorTheme}
        enhanceReadableText={enhanceReadableText}
        mapRenderMode={mapRenderMode}
        onMapRenderModeChange={setMapRenderMode}
        titleStyle={mapTitleShadow}
      />
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
        {!is3DMode && (
          <LayerProgressBars
            temperature={{ loading: temperatureLayerLoading, progress: temperatureLayerProgress }}
            wind={{ loading: windLayerLoading, progress: windLayerProgress }}
            cloud={{ loading: cloudLayerLoading, progress: cloudLayerProgress }}
            precip={{ loading: precipLayerLoading, progress: precipLayerProgress }}
          />
        )}
        {!is3DMode && (
          <MapLayerLegends
            precipLayerEnabled={precipLayerEnabled}
            temperatureLayerEnabled={temperatureLayerEnabled}
          />
        )}
        <MapTopControls
          is3DMode={is3DMode}
          layerDropdownRef={layerDropdownRef}
          layerDropdownOpen={layerDropdownOpen}
          onToggleDropdown={() => setLayerDropdownOpen((v) => !v)}
          anyLayerEnabled={anyLayerEnabled}
          temperatureLayerEnabled={temperatureLayerEnabled}
          windLayerEnabled={windLayerEnabled}
          cloudLayerEnabled={cloudLayerEnabled}
          precipLayerEnabled={precipLayerEnabled}
          onTemperatureLayerChange={handleTemperatureLayerChange}
          onWindLayerChange={handleWindLayerChange}
          onCloudLayerChange={handleCloudLayerChange}
          onPrecipLayerChange={handlePrecipLayerChange}
          isFullscreen={isFullscreen}
          onToggleFullscreen={toggleFullscreen}
        />
        {!is3DMode && (
          <MapZoomControls
            onZoomIn={handleZoomIn}
            onZoomOut={handleZoomOut}
          />
        )}
        {!is3DMode && anyLayerEnabled && (
          <MapTimelineControls
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
          onGoToLocation={onGoToLocation}
          variant={is3DMode ? 'globe' : 'default'}
          enhanceReadableText={enhanceReadableText}
        />
      </div>
      <div className={`mt-3 text-sm ${textColorTheme.textColor.secondary}`} style={mapFooterShadow}>
        <p>{t('map.coordinates', { lat: location.lat.toFixed(4), lon: location.lon.toFixed(4) })}</p>
      </div>
    </div>
  );
}
