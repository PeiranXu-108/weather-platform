'use client';

import React, { useState, useRef, useEffect } from 'react';
import type { TextColorTheme } from '@/app/utils/textColorTheme';
import Icon from '@/app/models/Icon';
import { ICONS } from '@/app/utils/icons';

export interface DropdownOption {
  value: string;
  label: string;
  /** 左侧图标路径，如 /icons/xxx.svg，可选 */
  icon?: string;
}

export interface SegmentedButton {
  value: string;
  label: string;
  onClick?: () => void;
}

interface SegmentedDropdownProps {
  textColorTheme: TextColorTheme;
  // 主按钮（带下拉菜单的按钮）
  mainButton: {
    value: string;
    label: string;
    showChevron?: boolean; // 是否显示箭头图标
    onClick?: () => void; // 自定义点击处理（用于特殊场景）
  };
  // 下拉菜单选项
  dropdownOptions: DropdownOption[];
  // 其他按钮（可选，如"表格"按钮）
  otherButtons?: SegmentedButton[];
  // 选择回调
  onSelect: (value: string) => void;
  // 是否显示下拉菜单（用于外部控制，如 Forcast30days 的场景）
  showDropdown?: boolean;
  // 位置类名（默认 top-6 right-6）
  positionClassName?: string;
}

export default function SegmentedDropdown({
  textColorTheme,
  mainButton,
  dropdownOptions,
  otherButtons = [],
  onSelect,
  showDropdown: externalShowDropdown,
  positionClassName = 'absolute top-6 right-6 z-10',
}: SegmentedDropdownProps) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const isDark = textColorTheme.backgroundType === 'dark';

  // 如果外部控制显示状态，使用外部状态；否则使用内部状态
  const shouldShowDropdown = externalShowDropdown !== undefined 
    ? externalShowDropdown && isDropdownOpen
    : isDropdownOpen;

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };

    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isDropdownOpen]);

  const handleMainButtonClick = () => {
    if (mainButton.onClick) {
      mainButton.onClick();
      // 如果外部控制显示状态，在点击后打开下拉菜单
      if (externalShowDropdown !== undefined) {
        setIsDropdownOpen(true);
      }
    } else {
      setIsDropdownOpen(!isDropdownOpen);
    }
  };

  const handleOptionClick = (value: string) => {
    onSelect(value);
    setIsDropdownOpen(false);
  };

  const barClass = isDark
    ? 'backdrop-blur-sm rounded-xl border border-white/20 bg-white/10'
    : 'backdrop-blur-sm rounded-xl border border-white/40 bg-white/60';
  const segmentActiveClass = isDark
    ? 'bg-white/15 text-white'
    : 'bg-white/80 text-slate-800 shadow-sm';
  const segmentInactiveClass = isDark
    ? 'bg-transparent text-gray-200 hover:bg-white/10'
    : 'bg-white/50 text-slate-600 hover:bg-white/70';

  return (
    <div className={positionClassName} ref={dropdownRef}>
      <div className="relative">
        <div className={`flex items-center gap-px rounded-xl p-1.5 ${barClass}`}>
          <div className="relative">
            <button
              type="button"
              onClick={handleMainButtonClick}
              className={`flex items-center gap-1 px-3 py-2 text-xs rounded-lg transition-all min-h-[32px] ${segmentActiveClass}`}
            >
              <span>{mainButton.label}</span>
              {mainButton.showChevron !== false && (
                <Icon
                  src={ICONS.chevronRight}
                  className={`w-3 h-3 transition-transform duration-200 ${isDropdownOpen ? 'rotate-90' : ''}`}
                  title="展开"
                />
              )}
            </button>

            {shouldShowDropdown && (
              <div className="absolute left-0 mt-1.5 min-w-[120px] max-h-[300px] overflow-y-auto py-1.5 px-1 bg-white/70 backdrop-blur-sm rounded-2xl shadow-xl border border-white/40">
                {dropdownOptions.map((option) => {
                  const isSelected = mainButton.value === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => handleOptionClick(option.value)}
                      className={`w-full text-left px-3 py-2 text-sm transition-colors flex items-center gap-2.5 rounded-lg ${
                        isSelected
                          ? 'bg-white/25 text-slate-800'
                          : 'text-slate-600 hover:bg-white/20'
                      }`}
                    >
                      {option.icon && (
                        <Icon
                          src={option.icon}
                          className="w-4 h-4 flex-shrink-0 opacity-80"
                        />
                      )}
                      <span>{option.label}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {otherButtons.map((button) => (
            <button
              key={button.value}
              type="button"
              onClick={() => {
                button.onClick?.();
                setIsDropdownOpen(false);
              }}
              className={`px-3 py-2 min-h-[32px] flex items-center text-xs rounded-lg transition-all ${segmentInactiveClass}`}
            >
              {button.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

