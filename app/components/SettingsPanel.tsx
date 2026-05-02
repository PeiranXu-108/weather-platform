'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import type { TextColorTheme } from '@/app/utils/textColorTheme';
import { getCardStyle } from '@/app/utils/textColorTheme';
import Icon from '@/app/models/Icon';
import { ICONS } from '@/app/utils/icons';
import { useI18n } from '@/app/i18n';

function splitTopLevelCss(value: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;

  for (let i = 0; i < value.length; i++) {
    const char = value[i];
    if (char === '(') depth++;
    if (char === ')') depth = Math.max(0, depth - 1);
    if (char === ',' && depth === 0) {
      parts.push(value.slice(start, i).trim());
      start = i + 1;
    }
  }

  const tail = value.slice(start).trim();
  if (tail) parts.push(tail);
  return parts;
}

function parseCssColorStop(stop: string): { color: string; pos: number | null } | null {
  const match = stop.match(/^((?:rgba?|hsla?)\([^)]+\)|#[\da-fA-F]{3,8}|[a-zA-Z]+)\s*(.*)$/);
  if (!match) return null;

  const posMatch = match[2].match(/(-?[\d.]+)%/);
  return {
    color: match[1],
    pos: posMatch ? Math.max(0, Math.min(1, parseFloat(posMatch[1]) / 100)) : null,
  };
}

function normalizeColorStops(stops: Array<{ color: string; pos: number | null }>) {
  if (stops.length === 0) return stops;

  if (stops[0].pos === null) stops[0].pos = 0;
  if (stops[stops.length - 1].pos === null) stops[stops.length - 1].pos = 1;

  for (let i = 1; i < stops.length - 1; i++) {
    if (stops[i].pos !== null) continue;

    const start = i - 1;
    let end = i + 1;
    while (end < stops.length && stops[end].pos === null) end++;

    const startPos = stops[start].pos ?? 0;
    const endPos = stops[end]?.pos ?? 1;
    const span = end - start;
    for (let j = i; j < end; j++) {
      stops[j].pos = startPos + ((endPos - startPos) * (j - start)) / span;
    }
    i = end - 1;
  }

  return stops;
}

function addColorStops(
  gradient: CanvasGradient,
  rawStops: string[],
) {
  const stops = normalizeColorStops(
    rawStops
      .map(parseCssColorStop)
      .filter((stop): stop is { color: string; pos: number | null } => Boolean(stop)),
  );

  for (const stop of stops) {
    gradient.addColorStop(stop.pos ?? 0, stop.color);
  }

  return stops.length > 0;
}

function getLinearGradientLine(direction: string, x: number, y: number, w: number, h: number) {
  if (direction.startsWith('to ')) {
    const toTop = direction.includes('top');
    const toRight = direction.includes('right');
    const toBottom = direction.includes('bottom');
    const toLeft = direction.includes('left');

    return {
      x0: toRight ? x : toLeft ? x + w : x + w / 2,
      y0: toBottom ? y : toTop ? y + h : y + h / 2,
      x1: toRight ? x + w : toLeft ? x : x + w / 2,
      y1: toBottom ? y + h : toTop ? y : y + h / 2,
    };
  }

  const angleMatch = direction.match(/^(-?[\d.]+)deg$/);
  const angle = angleMatch ? parseFloat(angleMatch[1]) : 180;
  const rad = (angle * Math.PI) / 180;
  const dx = Math.sin(rad);
  const dy = -Math.cos(rad);
  const length = Math.abs(w * dx) + Math.abs(h * dy);
  const cx = x + w / 2;
  const cy = y + h / 2;

  return {
    x0: cx - (dx * length) / 2,
    y0: cy - (dy * length) / 2,
    x1: cx + (dx * length) / 2,
    y1: cy + (dy * length) / 2,
  };
}

function isRenderableGradient(value: string) {
  return value.includes('linear-gradient') || value.includes('radial-gradient');
}

function getBackgroundLayers(style: CSSStyleDeclaration) {
  if (!style.backgroundImage || style.backgroundImage === 'none') return [];
  return splitTopLevelCss(style.backgroundImage).filter(isRenderableGradient);
}

function isTransparentColor(color: string) {
  return !color || color === 'transparent' || color === 'rgba(0, 0, 0, 0)';
}

/** 将 CSS gradient 字符串绘制到 2D canvas 上（支持 linear / radial） */
function drawCssGradient(
  ctx: CanvasRenderingContext2D,
  bg: string,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  const open = bg.indexOf('(');
  const close = bg.lastIndexOf(')');
  if (open === -1 || close === -1 || close <= open) return;

  const args = splitTopLevelCss(bg.slice(open + 1, close));
  if (args.length === 0) return;

  if (bg.includes('linear-gradient')) {
    const firstArgIsDirection = args[0].startsWith('to ') || /^-?[\d.]+deg$/.test(args[0]);
    const direction = firstArgIsDirection ? args[0] : '180deg';
    const stops = firstArgIsDirection ? args.slice(1) : args;
    const line = getLinearGradientLine(direction, x, y, w, h);
    const grad = ctx.createLinearGradient(line.x0, line.y0, line.x1, line.y1);

    if (addColorStops(grad, stops)) {
      ctx.fillStyle = grad;
      ctx.fillRect(x, y, w, h);
    }
    return;
  }

  if (bg.includes('radial-gradient')) {
    const centerMatch = bg.match(/circle\s+at\s+([\d.]+)%\s+([\d.]+)%/);
    const cx = centerMatch ? x + (parseFloat(centerMatch[1]) / 100) * w : x + w / 2;
    const cy = centerMatch ? y + (parseFloat(centerMatch[2]) / 100) * h : y + h / 2;
    const radius = Math.hypot(Math.max(cx - x, x + w - cx), Math.max(cy - y, y + h - cy));
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
    const stops = args[0].includes(' at ') || args[0] === 'circle' || args[0] === 'ellipse'
      ? args.slice(1)
      : args;

    if (addColorStops(grad, stops)) {
      ctx.fillStyle = grad;
      ctx.fillRect(x, y, w, h);
    }
  }
}

function drawElementBackground(
  ctx: CanvasRenderingContext2D,
  el: HTMLElement,
  style: CSSStyleDeclaration,
) {
  const rect = el.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return;

  if (!isTransparentColor(style.backgroundColor)) {
    ctx.fillStyle = style.backgroundColor;
    ctx.fillRect(rect.left, rect.top, rect.width, rect.height);
  }

  const layers = getBackgroundLayers(style);
  for (let i = layers.length - 1; i >= 0; i--) {
    drawCssGradient(ctx, layers[i], rect.left, rect.top, rect.width, rect.height);
  }
}

function drawCanvasElement(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
) {
  const rect = canvas.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0 || canvas.width <= 0 || canvas.height <= 0) return;
  ctx.drawImage(canvas, rect.left, rect.top, rect.width, rect.height);
}

function drawWeatherBackgroundNode(
  ctx: CanvasRenderingContext2D,
  node: Element,
  inheritedAlpha = 1,
) {
  if (!(node instanceof HTMLElement)) return;

  const style = window.getComputedStyle(node);
  if (style.display === 'none' || style.visibility === 'hidden') return;

  const opacity = Number.parseFloat(style.opacity);
  const alpha = inheritedAlpha * (Number.isFinite(opacity) ? opacity : 1);

  ctx.save();
  ctx.globalAlpha = alpha;

  if (node instanceof HTMLCanvasElement) {
    drawCanvasElement(ctx, node);
  } else {
    drawElementBackground(ctx, node, style);
    for (const child of Array.from(node.children)) {
      drawWeatherBackgroundNode(ctx, child, alpha);
    }
  }

  ctx.restore();
}

interface SettingsPanelProps {
  textColorTheme: TextColorTheme;
  opacity: number;
  onOpacityChange: (opacity: number) => void;
  showBackground: boolean;
  onShowBackgroundChange: (show: boolean) => void;
  /** 是否展示「看烟花」入口（仅在「晴天 + 夜晚」且开启背景渲染时显示） */
  showFireworksAction?: boolean;
}

const FIREWORKS_DURATION_MS = 7000;

export default function SettingsPanel({
  textColorTheme,
  opacity,
  onOpacityChange,
  showBackground,
  onShowBackgroundChange,
  showFireworksAction = false,
}: SettingsPanelProps) {
  const { locale, setLocale, t } = useI18n();
  const [showTooltip, setShowTooltip] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [captureStatus, setCaptureStatus] = useState<'success' | 'error' | null>(null);
  const [fireworksFiring, setFireworksFiring] = useState(false);
  const fireworksTimerRef = useRef<number | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const handleLaunchFireworks = useCallback(() => {
    if (typeof window === 'undefined') return;
    if (fireworksTimerRef.current !== null) {
      window.clearTimeout(fireworksTimerRef.current);
    }
    window.dispatchEvent(new CustomEvent('weather:fireworks-start'));
    setFireworksFiring(true);
    fireworksTimerRef.current = window.setTimeout(() => {
      setFireworksFiring(false);
      fireworksTimerRef.current = null;
    }, FIREWORKS_DURATION_MS);
  }, []);

  useEffect(() => {
    return () => {
      if (fireworksTimerRef.current !== null) {
        window.clearTimeout(fireworksTimerRef.current);
      }
    };
  }, []);

  // 当用户关闭背景渲染或切换到非晴天夜晚时，重置点击态
  useEffect(() => {
    if (!showFireworksAction || !showBackground) {
      if (fireworksTimerRef.current !== null) {
        window.clearTimeout(fireworksTimerRef.current);
        fireworksTimerRef.current = null;
      }
      setFireworksFiring(false);
    }
  }, [showFireworksAction, showBackground]);

  const handleCaptureBackground = useCallback(async () => {
    setCapturing(true);
    setCaptureStatus(null);
    try {
      const bgEl = document.querySelector('[data-weather-bg]') as HTMLElement | null;
      if (!bgEl) throw new Error('No background element');
      if (!navigator.clipboard?.write || typeof ClipboardItem === 'undefined') {
        throw new Error('Clipboard image writing is not supported');
      }

      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

      const w = window.innerWidth;
      const h = window.innerHeight;
      const dpr = window.devicePixelRatio || 1;

      const offscreen = document.createElement('canvas');
      offscreen.width = w * dpr;
      offscreen.height = h * dpr;
      const ctx = offscreen.getContext('2d')!;
      ctx.scale(dpr, dpr);

      drawWeatherBackgroundNode(ctx, bgEl);

      const blob = await new Promise<Blob>((resolve, reject) => {
        offscreen.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/png');
      });
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      setCaptureStatus('success');
    } catch (err) {
      console.error('[SettingsPanel] Capture failed:', err);
      setCaptureStatus('error');
    } finally {
      setCapturing(false);
      setTimeout(() => setCaptureStatus(null), 2000);
    }
  }, []);

  // Handle click outside to close tooltip
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        tooltipRef.current &&
        !tooltipRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setShowTooltip(false);
      }
    }

    if (showTooltip) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [showTooltip]);

  const isDark = textColorTheme.backgroundType === 'dark';

  return (
    <div className="relative">
      {/* Settings Button */}
      <button
        ref={buttonRef}
        onClick={() => setShowTooltip(!showTooltip)}
        className={`p-2 rounded-full transition-all active:scale-95 min-w-[44px] min-h-[44px] flex items-center justify-center ${
          isDark ? 'hover:bg-white/10' : 'hover:bg-black/5'
        }`}
        aria-label={t('settings.open')}
        title={t('settings.title')}
      >
        <Icon
          src={ICONS.settings}
          className={`w-8 h-8 ${textColorTheme.textColor.secondary}`}
          title={t('settings.title')}
        />
      </button>

      {/* Tooltip */}
      {showTooltip && (
        <div
          ref={tooltipRef}
          className={`absolute top-full right-0 mt-2 p-4 rounded-xl shadow-xl border z-50 w-80 backdrop-blur-2xl ${getCardStyle(textColorTheme.backgroundType)} ${
            isDark ? 'border-white/20' : 'border-sky-100'
          }`}
        >
          {/* Opacity Control */}
          <div className="mb-4">
            <label className={`block text-sm font-medium mb-2 ${textColorTheme.textColor.primary}`}>
              {t('settings.opacity')}
            </label>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min="0"
                max="100"
                defaultValue={0}
                value={opacity}
                onChange={(e) => onOpacityChange(Number(e.target.value))}
                className={`flex-1 h-2 rounded-lg appearance-none cursor-pointer bg-transparent ${
                  isDark 
                    ? '[&::-webkit-slider-thumb]:bg-sky-400 [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white/30 [&::-moz-range-thumb]:bg-sky-400 [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-white/30'
                    : '[&::-webkit-slider-thumb]:bg-sky-500 [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white/50 [&::-moz-range-thumb]:bg-sky-500 [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-white/50'
                } [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:cursor-pointer [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:cursor-pointer`}
                style={{
                  background: isDark
                    ? `linear-gradient(to right, rgb(56, 189, 248) 0%, rgb(56, 189, 248) ${opacity}%, rgba(255, 255, 255, 0.1) ${opacity}%, rgba(255, 255, 255, 0.1) 100%)`
                    : `linear-gradient(to right, rgb(14, 165, 233) 0%, rgb(14, 165, 233) ${opacity}%, rgba(148, 163, 184, 0.3) ${opacity}%, rgba(148, 163, 184, 0.3) 100%)`,
                }}
              />
              <span className={`text-sm font-medium w-12 text-center ${textColorTheme.textColor.secondary}`}>
                {opacity}%
              </span>
            </div>
          </div>

          {/* Background Rendering Toggle */}
          <div className="flex items-center justify-between">
            <label className={`text-sm font-medium ${textColorTheme.textColor.primary}`}>
              {t('settings.backgroundRendering')}
            </label>
            <button
              onClick={() => onShowBackgroundChange(!showBackground)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-all duration-200 ${
                showBackground
                  ? isDark
                    ? 'bg-sky-400'
                    : 'bg-sky-500'
                  : isDark
                    ? 'bg-white/20'
                    : 'bg-gray-300/60'
              }`}
              aria-label={showBackground ? t('settings.disableBackgroundRendering') : t('settings.enableBackgroundRendering')}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform duration-200 ${
                  showBackground ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* Language Toggle */}
          <div className={`mt-4 pt-3 border-t ${isDark ? 'border-white/10' : 'border-black/5'}`}>
            <div className="flex items-center justify-between gap-3">
              <label className={`text-sm font-medium ${textColorTheme.textColor.primary}`}>
                {t('settings.language')}
              </label>
              <div className={`inline-flex rounded-full p-1 ${isDark ? 'bg-white/10' : 'bg-sky-500/10'}`}>
                {(['zh', 'en'] as const).map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setLocale(item)}
                    className={`px-3 py-1 text-xs font-medium rounded-full transition-all ${
                      locale === item
                        ? isDark
                          ? 'bg-white/20 text-white'
                          : 'bg-white text-sky-700 shadow-sm'
                        : isDark
                          ? 'text-white/60 hover:text-white'
                          : 'text-sky-700/60 hover:text-sky-700'
                    }`}
                    aria-pressed={locale === item}
                  >
                    {item === 'zh' ? t('settings.languageChinese') : t('settings.languageEnglish')}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Capture Background Button */}
          <div className={`mt-4 pt-3 border-t ${isDark ? 'border-white/10' : 'border-black/5'}`}>
            <button
              onClick={handleCaptureBackground}
              disabled={!showBackground || capturing}
              className={`w-full px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 flex items-center justify-center gap-2 ${
                !showBackground || capturing
                  ? isDark
                    ? 'bg-white/5 text-white/30 cursor-not-allowed'
                    : 'bg-gray-100 text-gray-300 cursor-not-allowed'
                  : captureStatus === 'success'
                    ? isDark
                      ? 'bg-emerald-500/20 text-emerald-300'
                      : 'bg-emerald-50 text-emerald-600'
                    : captureStatus === 'error'
                      ? isDark
                        ? 'bg-red-500/20 text-red-300'
                        : 'bg-red-50 text-red-600'
                      : isDark
                        ? 'bg-white/10 hover:bg-white/20 text-white active:scale-[0.98]'
                        : 'bg-sky-500/10 hover:bg-sky-500/20 text-sky-700 active:scale-[0.98]'
              }`}
            >
              {capturing ? (
                <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                </svg>
              ) : captureStatus === 'success' ? (
                <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              ) : captureStatus === 'error' ? (
                <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              ) : (
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
                  <circle cx="12" cy="13" r="4" />
                </svg>
              )}
              {capturing
                ? t('settings.wallpaperCapturing')
                : captureStatus === 'success'
                  ? t('settings.wallpaperCopied')
                  : captureStatus === 'error'
                    ? t('settings.wallpaperFailed')
                    : t('settings.captureWallpaper')}
            </button>

            {showFireworksAction && (
              <button
                onClick={handleLaunchFireworks}
                disabled={!showBackground || fireworksFiring}
                className={`mt-2 w-full px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 flex items-center justify-center gap-2 ${
                  !showBackground || fireworksFiring
                    ? isDark
                      ? 'bg-white/5 text-white/40 cursor-not-allowed'
                      : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : isDark
                      ? 'bg-gradient-to-r from-fuchsia-500/20 via-amber-400/20 to-sky-400/20 hover:from-fuchsia-500/30 hover:via-amber-400/30 hover:to-sky-400/30 text-white border border-white/15 active:scale-[0.98]'
                      : 'bg-gradient-to-r from-fuchsia-500/15 via-amber-400/15 to-sky-400/15 hover:from-fuchsia-500/25 hover:via-amber-400/25 hover:to-sky-400/25 text-fuchsia-700 border border-fuchsia-200 active:scale-[0.98]'
                }`}
                title={fireworksFiring ? t('settings.fireworksRunningTitle') : t('settings.fireworksTitle')}
                aria-label={t('settings.launchFireworks')}
              >
                {/* Sparkle icon */}
                <svg
                  className={`w-4 h-4 ${fireworksFiring ? 'animate-pulse' : ''}`}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M12 3v3" />
                  <path d="M12 18v3" />
                  <path d="M3 12h3" />
                  <path d="M18 12h3" />
                  <path d="M5.6 5.6l2.1 2.1" />
                  <path d="M16.3 16.3l2.1 2.1" />
                  <path d="M5.6 18.4l2.1-2.1" />
                  <path d="M16.3 7.7l2.1-2.1" />
                  <circle cx="12" cy="12" r="2" />
                </svg>
                {fireworksFiring ? t('settings.fireworksRunning') : t('settings.watchFireworks')}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
