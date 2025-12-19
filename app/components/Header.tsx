'use client';

import React, { useState, useRef, useEffect } from 'react';
import { searchCities, getEnglishCityName, type CityOption } from '@/app/utils/citySearch';
import type { TextColorTheme } from '@/app/utils/textColorTheme';
import { getCardStyle } from '@/app/utils/textColorTheme';
import Icon from '@/app/components/Icon';
import { ICONS } from '@/app/utils/icons';

interface HeaderProps {
  onCitySelect: (cityName: string) => void;
  onLocationSelect?: (lat: number, lon: number) => void;
  currentCity?: string;
  isLocating?: boolean;
  textColorTheme?: TextColorTheme;
}

export default function Header({ onCitySelect, onLocationSelect, currentCity, isLocating = false, textColorTheme }: HeaderProps) {
  // 默认主题（如果没有提供）
  const theme = textColorTheme || {
    backgroundType: 'light' as const,
    textColor: {
      primary: 'text-gray-900',
      secondary: 'text-gray-700',
      muted: 'text-gray-600',
      accent: 'text-sky-700',
    },
  };
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState<CityOption[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [locating, setLocating] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // Update suggestions when search query changes
  useEffect(() => {
    if (searchQuery.trim().length > 0) {
      const results = searchCities(searchQuery, 8);
      setSuggestions(results);
      setShowSuggestions(results.length > 0);
      setSelectedIndex(-1);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  }, [searchQuery]);

  // Handle click outside to close suggestions
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(event.target as Node) &&
        searchInputRef.current &&
        !searchInputRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };

  const handleCitySelect = (city: CityOption) => {
    const englishName = getEnglishCityName(city.chineseName);
    setSearchQuery('');
    setShowSuggestions(false);
    onCitySelect(englishName);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim().length > 0) {
      const englishName = getEnglishCityName(searchQuery);
      setSearchQuery('');
      setShowSuggestions(false);
      onCitySelect(englishName);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showSuggestions || suggestions.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex((prev) => 
          prev < suggestions.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1));
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
          handleCitySelect(suggestions[selectedIndex]);
        } else if (suggestions.length > 0) {
          handleCitySelect(suggestions[0]);
        } else {
          handleSubmit(e);
        }
        break;
      case 'Escape':
        setShowSuggestions(false);
        setSearchQuery('');
        break;
    }
  };

  const handleLocationClick = () => {
    if (!onLocationSelect) return;
    
    if (!navigator.geolocation) {
      alert('您的浏览器不支持地理位置功能');
      return;
    }

    setLocating(true);
    
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        onLocationSelect(latitude, longitude);
        setLocating(false);
      },
      (error) => {
        setLocating(false);
        let errorMessage = '获取位置失败：';
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage += '用户拒绝了地理位置请求';
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage += '位置信息不可用';
            break;
          case error.TIMEOUT:
            errorMessage += '获取位置超时';
            break;
          default:
            errorMessage += '未知错误';
            break;
        }
        alert(errorMessage);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
  };

  return (
    <header className="mb-8">

      {/* Search Bar */}
      <div className="max-w-2xl mx-auto relative">
        <form onSubmit={handleSubmit} className="relative">
          <div className="relative">
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              onFocus={() => {
                if (suggestions.length > 0) {
                  setShowSuggestions(true);
                }
              }}
            placeholder="搜索城市"
            className={`w-full px-4 py-3 pl-12 ${currentCity ? 'pr-40' : 'pr-20'} rounded-xl focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-200 ${theme.textColor.primary} placeholder-gray-400 transition-all ${getCardStyle(theme.backgroundType)}`}
            />
            <div className="absolute left-4 top-1/2 transform -translate-y-1/2">
              <Icon
                src={ICONS.search}
                className={`w-5 h-5 ${theme.textColor.muted}`}
                title="搜索"
                />
            </div>
            <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex items-center gap-2">
              <button
                type="button"
                onClick={handleLocationClick}
                disabled={locating || isLocating}
                className={`p-2 rounded-lg transition-all ${
                  locating || isLocating
                    ? 'border-sky-300 bg-sky-100/60 cursor-not-allowed'
                    : 'border-sky-200 bg-white/10 hover:border-sky-400 hover:bg-sky-50/60 active:bg-sky-100/60'
                }`}
                title="获取当前位置"
              >
                {locating || isLocating ? (
                  <Icon
                    src={ICONS.spinner}
                    className="w-5 h-5 text-sky-500 animate-spin"
                    title="定位中"
                    />
                ) : (
                  <Icon
                    src={ICONS.location}
                    className="w-5 h-5 text-sky-600"
                    title="获取当前位置"
                    />
                )}
              </button>
            </div>
          </div>
        </form>

        {/* Suggestions Dropdown */}
        {showSuggestions && suggestions.length > 0 && (
          <div
            ref={suggestionsRef}
            className={`absolute z-50 w-full mt-2 ${getCardStyle(theme.backgroundType)} rounded-xl shadow-xl border ${theme.backgroundType === 'dark' ? 'border-white/20' : 'border-sky-100'} max-h-64 overflow-y-auto`}
          >
            {suggestions.map((city, index) => (
              <button
                key={`${city.englishName}-${index}`}
                type="button"
                onClick={() => handleCitySelect(city)}
                className={`w-full text-left px-4 py-3 ${theme.backgroundType === 'dark' ? 'hover:bg-white/20' : 'hover:bg-sky-50'} transition-colors ${
                  index === selectedIndex ? (theme.backgroundType === 'dark' ? 'bg-white/30' : 'bg-sky-100') : ''
                } ${
                  index === 0 ? 'rounded-t-xl' : ''
                } ${
                  index === suggestions.length - 1 ? 'rounded-b-xl' : ''
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className={`font-medium ${theme.textColor.primary}`}>{city.chineseName}</p>
                    <p className={`text-sm ${theme.textColor.muted}`}>{city.englishName}</p>
                  </div>
                  <Icon
                    src={ICONS.chevronRight}
                    className="w-5 h-5 text-sky-400"
                    title="选择"
                    />
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </header>
  );
}

