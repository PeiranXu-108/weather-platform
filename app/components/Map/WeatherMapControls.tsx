'use client';

import type { CSSProperties, ReactNode, RefObject } from 'react';
import type { TextColorTheme } from '@/app/utils/textColorTheme';
import SegmentedDropdown from '@/app/models/SegmentedDropdown';
import { useI18n } from '@/app/i18n';
import TemperatureLegend from './TemperatureLegend';
import PrecipLegend from './PrecipLegend';
import MapTimelinePlayback from './MapTimelinePlayback';

export type MapRenderMode = '2d' | '3d';

export interface LayerProgress {
  loading: boolean;
  progress: number;
}

interface WeatherMapHeaderProps {
  textColorTheme: TextColorTheme;
  enhanceReadableText: boolean;
  mapRenderMode: MapRenderMode;
  onMapRenderModeChange: (mode: MapRenderMode) => void;
  titleStyle?: CSSProperties;
}

export function WeatherMapHeader({
  textColorTheme,
  enhanceReadableText,
  mapRenderMode,
  onMapRenderModeChange,
  titleStyle,
}: WeatherMapHeaderProps) {
  const { t } = useI18n();

  return (
    <div className="flex items-center justify-between gap-3 mb-4">
      <h2 className={`text-xl font-bold ${textColorTheme.textColor.primary}`} style={titleStyle}>
        {t('map.title')}
      </h2>
      <SegmentedDropdown
        textColorTheme={textColorTheme}
        enhanceReadableText={enhanceReadableText}
        positionClassName="relative z-20"
        mainButton={{
          value: mapRenderMode,
          label: mapRenderMode === '3d' ? t('map.globeView') : t('map.mapView'),
          icon: mapRenderMode === '3d' ? '/icons/地球.svg' : '/icons/地图.svg',
        }}
        dropdownOptions={[
          { value: '2d', label: t('map.mapView'), icon: '/icons/地图.svg' },
          { value: '3d', label: t('map.globeView'), icon: '/icons/地球.svg' },
        ]}
        onSelect={(value) => onMapRenderModeChange(value as MapRenderMode)}
      />
    </div>
  );
}

function ProgressBar({
  progress,
  background,
  boxShadow,
}: {
  progress: number;
  background: string;
  boxShadow: string;
}) {
  return (
    <div className="h-1 w-full rounded-full overflow-hidden bg-white/30 backdrop-blur-sm">
      <div
        className="h-full rounded-full transition-[width] duration-200 ease-out"
        style={{
          width: `${progress}%`,
          background,
          boxShadow,
        }}
      />
    </div>
  );
}

interface LayerProgressBarsProps {
  temperature: LayerProgress;
  wind: LayerProgress;
  cloud: LayerProgress;
  precip: LayerProgress;
}

export function LayerProgressBars({
  temperature,
  wind,
  cloud,
  precip,
}: LayerProgressBarsProps) {
  if (!temperature.loading && !wind.loading && !cloud.loading && !precip.loading) {
    return null;
  }

  return (
    <div className="absolute top-0 left-0 right-0 z-20 pointer-events-none">
      <div className="flex flex-col">
        {temperature.loading && (
          <ProgressBar
            progress={temperature.progress}
            background="linear-gradient(90deg, #0ea5e9 0%, #06b6d4 50%, #22d3ee 100%)"
            boxShadow="0 0 12px rgba(14, 165, 233, 0.5)"
          />
        )}
        {wind.loading && (
          <ProgressBar
            progress={wind.progress}
            background="linear-gradient(90deg, #059669 0%, #10b981 50%, #34d399 100%)"
            boxShadow="0 0 12px rgba(16, 185, 129, 0.5)"
          />
        )}
        {cloud.loading && (
          <ProgressBar
            progress={cloud.progress}
            background="linear-gradient(90deg, #475569 0%, #64748b 50%, #94a3b8 100%)"
            boxShadow="0 0 12px rgba(100, 116, 139, 0.5)"
          />
        )}
        {precip.loading && (
          <ProgressBar
            progress={precip.progress}
            background="linear-gradient(90deg, #4f46e5 0%, #6366f1 50%, #818cf8 100%)"
            boxShadow="0 0 12px rgba(99, 102, 241, 0.5)"
          />
        )}
      </div>
    </div>
  );
}

export function MapLayerLegends({
  temperatureLayerEnabled,
  precipLayerEnabled,
}: {
  temperatureLayerEnabled: boolean;
  precipLayerEnabled: boolean;
}) {
  if (!temperatureLayerEnabled && !precipLayerEnabled) return null;

  return (
    <div className="absolute top-2 left-2 sm:top-4 sm:left-4 z-10 flex flex-col gap-3">
      {precipLayerEnabled && <PrecipLegend />}
      {temperatureLayerEnabled && <TemperatureLegend />}
    </div>
  );
}

function LayerStatusIcon({
  enabled,
  fallback,
}: {
  enabled: boolean;
  fallback: ReactNode;
}) {
  return (
    <span className="w-5 h-5 flex items-center justify-center flex-shrink-0 [&>svg]:w-3.5 [&>svg]:h-3.5" aria-hidden>
      {enabled ? (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-slate-600"><polyline points="20 6 9 17 4 12" /></svg>
      ) : (
        fallback
      )}
    </span>
  );
}

function LayerToggleButton({
  enabled,
  label,
  onClick,
  fallbackIcon,
}: {
  enabled: boolean;
  label: string;
  onClick: () => void;
  fallbackIcon: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-3 w-full px-4 py-2.5 rounded-full text-sm transition-colors ${enabled ? 'bg-white/90 text-slate-800 shadow-sm' : 'bg-white/50 text-slate-600 hover:bg-white/70'}`}
    >
      <LayerStatusIcon enabled={enabled} fallback={fallbackIcon} />
      <span>{label}</span>
    </button>
  );
}

interface MapLayerMenuProps {
  layerDropdownRef: RefObject<HTMLDivElement>;
  layerDropdownOpen: boolean;
  onToggleDropdown: () => void;
  anyLayerEnabled: boolean;
  temperatureLayerEnabled: boolean;
  windLayerEnabled: boolean;
  cloudLayerEnabled: boolean;
  precipLayerEnabled: boolean;
  onTemperatureLayerChange: (enabled: boolean) => void;
  onWindLayerChange: (enabled: boolean) => void;
  onCloudLayerChange: (enabled: boolean) => void;
  onPrecipLayerChange: (enabled: boolean) => void;
}

function MapLayerMenu({
  layerDropdownRef,
  layerDropdownOpen,
  onToggleDropdown,
  anyLayerEnabled,
  temperatureLayerEnabled,
  windLayerEnabled,
  cloudLayerEnabled,
  precipLayerEnabled,
  onTemperatureLayerChange,
  onWindLayerChange,
  onCloudLayerChange,
  onPrecipLayerChange,
}: MapLayerMenuProps) {
  const { t } = useI18n();

  return (
    <div ref={layerDropdownRef} className="relative">
      <button
        type="button"
        onClick={onToggleDropdown}
        className="flex items-center justify-center w-10 h-10 min-w-[44px] min-h-[44px] rounded-full bg-white/70 backdrop-blur-sm shadow-lg border border-white/40 hover:bg-white/90 transition-colors text-slate-600"
        aria-expanded={layerDropdownOpen}
        aria-haspopup="true"
        title={anyLayerEnabled ? t('map.layersOn') : t('map.layerOptions')}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
          <rect x="3" y="7" width="14" height="14" rx="2" />
          <rect x="7" y="3" width="14" height="14" rx="2" />
        </svg>
      </button>
      {layerDropdownOpen && (
        <div className="absolute top-full right-0 mt-2 flex flex-col gap-2 min-w-[120px] max-w-[50vw] py-2 px-2 bg-white/70 backdrop-blur-sm rounded-2xl shadow-xl border border-white/40">
          <LayerToggleButton
            enabled={temperatureLayerEnabled}
            label={t('map.temperatureLayer')}
            onClick={() => onTemperatureLayerChange(!temperatureLayerEnabled)}
            fallbackIcon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-slate-400"><circle cx="12" cy="12" r="10" /></svg>}
          />
          <LayerToggleButton
            enabled={windLayerEnabled}
            label={t('map.windLayer')}
            onClick={() => onWindLayerChange(!windLayerEnabled)}
            fallbackIcon={(
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="text-slate-500">
                <path d="M3 8h8a3 3 0 1 0-3-3" />
                <path d="M3 14h13a3 3 0 1 1-3 3" />
              </svg>
            )}
          />
          <LayerToggleButton
            enabled={cloudLayerEnabled}
            label={t('map.cloudLayer')}
            onClick={() => onCloudLayerChange(!cloudLayerEnabled)}
            fallbackIcon={(
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="text-slate-500">
                <path d="M5 18h11a4 4 0 0 0 .4-7.98A5 5 0 0 0 6.2 9.8 3.5 3.5 0 0 0 5 18z" />
              </svg>
            )}
          />
          <LayerToggleButton
            enabled={precipLayerEnabled}
            label={t('map.precipLayer')}
            onClick={() => onPrecipLayerChange(!precipLayerEnabled)}
            fallbackIcon={(
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="text-slate-500">
                <path d="M8 7.5a4 4 0 0 1 8 0" />
                <path d="M6.5 10.5h11a3.5 3.5 0 1 1-2.8 5.6" />
                <path d="M9 16.5v3" />
                <path d="M13 17.5v3" />
              </svg>
            )}
          />
        </div>
      )}
    </div>
  );
}

function FullscreenButton({
  isFullscreen,
  onToggleFullscreen,
}: {
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
}) {
  const { t } = useI18n();

  return (
    <button
      type="button"
      onClick={onToggleFullscreen}
      className="flex items-center justify-center w-10 h-10 min-w-[44px] min-h-[44px] rounded-full bg-white/70 backdrop-blur-sm shadow-lg border border-white/40 hover:bg-white/90 transition-colors text-slate-600"
      title={isFullscreen ? t('map.exitFullscreen') : t('map.fullscreen')}
      aria-label={isFullscreen ? t('map.exitFullscreen') : t('map.fullscreen')}
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
  );
}

interface MapTopControlsProps extends MapLayerMenuProps {
  is3DMode: boolean;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
}

export function MapTopControls({
  is3DMode,
  isFullscreen,
  onToggleFullscreen,
  ...layerMenuProps
}: MapTopControlsProps) {
  return (
    <div className="absolute top-2 right-2 sm:top-4 sm:right-4 z-50 flex items-center gap-2">
      {!is3DMode && <MapLayerMenu {...layerMenuProps} />}
      <FullscreenButton isFullscreen={isFullscreen} onToggleFullscreen={onToggleFullscreen} />
    </div>
  );
}

export function MapZoomControls({
  onZoomIn,
  onZoomOut,
}: {
  onZoomIn: () => void;
  onZoomOut: () => void;
}) {
  const { t } = useI18n();

  return (
    <div className="absolute top-2 left-1/2 -translate-x-1/2 sm:top-4 z-10 flex flex-row gap-px">
      <button
        type="button"
        onClick={onZoomOut}
        className="w-9 h-9 min-w-[44px] min-h-[44px] flex items-center justify-center bg-white/70 backdrop-blur-sm rounded-l-lg border border-white/40 shadow-lg text-gray-800 text-xl font-light hover:bg-white/90 transition-colors leading-none"
        title={t('map.zoomOut')}
        aria-label={t('map.zoomOut')}
      >
        &minus;
      </button>
      <button
        type="button"
        onClick={onZoomIn}
        className="w-9 h-9 min-w-[44px] min-h-[44px] flex items-center justify-center bg-white/70 backdrop-blur-sm rounded-r-lg border border-white/40 shadow-lg text-gray-800 text-xl font-light hover:bg-white/90 transition-colors leading-none"
        title={t('map.zoomIn')}
        aria-label={t('map.zoomIn')}
      >
        +
      </button>
    </div>
  );
}

export function MapTimelineControls({
  step,
  isPlaying,
  timeLabel,
  onStepChange,
  onTogglePlay,
}: {
  step: number;
  isPlaying: boolean;
  timeLabel: string;
  onStepChange: (step: number) => void;
  onTogglePlay: () => void;
}) {
  return (
    <MapTimelinePlayback
      step={step}
      isPlaying={isPlaying}
      timeLabel={timeLabel}
      onStepChange={onStepChange}
      onTogglePlay={onTogglePlay}
    />
  );
}
