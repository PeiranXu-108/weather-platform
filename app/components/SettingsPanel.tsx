'use client';

import React, { useEffect, useRef, useState } from 'react';
import type { TextColorTheme } from '@/app/utils/textColorTheme';
import { getCardStyle } from '@/app/utils/textColorTheme';
import Icon from '@/app/models/Icon';
import { ICONS } from '@/app/utils/icons';

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
  const tooltipRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

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
        </div>
      )}
    </div>
  );
}
