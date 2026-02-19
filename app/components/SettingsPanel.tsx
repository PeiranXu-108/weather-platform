'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import type { TextColorTheme } from '@/app/utils/textColorTheme';
import { getCardStyle } from '@/app/utils/textColorTheme';
import Icon from '@/app/models/Icon';
import { ICONS } from '@/app/utils/icons';

/**
 * 从元素中获取含 gradient 的背景值（兼容浏览器对 background 短属性的拆解）。
 * 优先读 inline style，回退到 computedStyle。
 */
function getElementGradient(el: HTMLElement): string {
  for (const src of [
    el.style.backgroundImage,
    el.style.background,
    window.getComputedStyle(el).backgroundImage,
  ]) {
    if (src && src.includes('gradient')) return src;
  }
  return '';
}

/** 将 CSS gradient 字符串绘制到 2D canvas 上（支持 linear / radial） */
function drawCssGradient(
  ctx: CanvasRenderingContext2D,
  bg: string,
  w: number,
  h: number
) {
  const stopRe = /(rgba?\(\s*[\d.]+\s*,\s*[\d.]+\s*,\s*[\d.]+(?:\s*,\s*[\d.]+)?\s*\))\s+([\d.]+)%/g;

  if (bg.includes('linear-gradient')) {
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    let m;
    let found = false;
    while ((m = stopRe.exec(bg))) {
      grad.addColorStop(parseFloat(m[2]) / 100, m[1]);
      found = true;
    }
    if (found) {
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
    }
    return;
  }

  if (bg.includes('radial-gradient')) {
    const centerMatch = bg.match(/circle\s+at\s+([\d.]+)%\s+([\d.]+)%/);
    const cx = centerMatch ? (parseFloat(centerMatch[1]) / 100) * w : w / 2;
    const cy = centerMatch ? (parseFloat(centerMatch[2]) / 100) * h : h / 2;
    const radius = Math.max(w, h);
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);

    const colorRe = /(rgba?\(\s*[\d.]+\s*,\s*[\d.]+\s*,\s*[\d.]+(?:\s*,\s*[\d.]+)?\s*\))(?:\s+([\d.]+)%)?/g;
    const stops: { color: string; pos: number | null }[] = [];
    let sm;
    while ((sm = colorRe.exec(bg))) {
      stops.push({ color: sm[1], pos: sm[2] != null ? parseFloat(sm[2]) / 100 : null });
    }
    if (stops.length > 0) {
      if (stops[0].pos === null) stops[0].pos = 0;
      if (stops[stops.length - 1].pos === null) stops[stops.length - 1].pos = 1;
      for (let i = 1; i < stops.length - 1; i++) {
        if (stops[i].pos !== null) continue;
        let next = i + 1;
        while (next < stops.length && stops[next].pos === null) next++;
        const prev = i - 1;
        stops[i].pos =
          stops[prev].pos! +
          ((stops[next].pos! - stops[prev].pos!) * (i - prev)) / (next - prev);
      }
      for (const s of stops) grad.addColorStop(s.pos!, s.color);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
    }
  }
}

interface SettingsPanelProps {
  textColorTheme: TextColorTheme;
  opacity: number;
  onOpacityChange: (opacity: number) => void;
  showBackground: boolean;
  onShowBackgroundChange: (show: boolean) => void;
}

export default function SettingsPanel({
  textColorTheme,
  opacity,
  onOpacityChange,
  showBackground,
  onShowBackgroundChange,
}: SettingsPanelProps) {
  const [showTooltip, setShowTooltip] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [captureStatus, setCaptureStatus] = useState<'success' | 'error' | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const handleCaptureBackground = useCallback(async () => {
    setCapturing(true);
    setCaptureStatus(null);
    try {
      const bgEl = document.querySelector('[data-weather-bg]') as HTMLElement | null;
      if (!bgEl) throw new Error('No background element');

      const w = window.innerWidth;
      const h = window.innerHeight;
      const dpr = window.devicePixelRatio || 1;

      const offscreen = document.createElement('canvas');
      offscreen.width = w * dpr;
      offscreen.height = h * dpr;
      const ctx = offscreen.getContext('2d')!;
      ctx.scale(dpr, dpr);

      // 按 DOM 顺序绘制所有 CSS 渐变层（兼容浏览器对 background 短属性的拆解）
      const childDivs = Array.from(bgEl.querySelectorAll<HTMLElement>('div'));
      for (const div of childDivs) {
        const bg = getElementGradient(div);
        if (bg) {
          drawCssGradient(ctx, bg, w, h);
        }
      }

      // 在渐变之上绘制 Three.js WebGL canvas
      const glCanvas = bgEl.querySelector('canvas');
      if (glCanvas) {
        ctx.drawImage(glCanvas, 0, 0, w, h);
      }

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
        className={`p-2 rounded-full transition-all active:scale-95 ${
          isDark ? 'hover:bg-white/10' : 'hover:bg-black/5'
        }`}
        aria-label="打开设置"
        title="设置"
      >
        <Icon
          src={ICONS.settings}
          className={`w-8 h-8 ${textColorTheme.textColor.secondary}`}
          title="设置"
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
              透明度
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
              背景渲染
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
              aria-label={showBackground ? '禁用背景渲染' : '启用背景渲染'}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform duration-200 ${
                  showBackground ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
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
                ? '截取中…'
                : captureStatus === 'success'
                  ? '已复制到剪贴板'
                  : captureStatus === 'error'
                    ? '截取失败'
                    : '截取壁纸'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
