'use client';

import React, { useState, useRef, useEffect } from 'react';
import { searchCities, getEnglishCityName, type CityOption } from '@/app/utils/citySearch';

interface HeaderProps {
  onCitySelect: (cityName: string) => void;
  onLocationSelect?: (lat: number, lon: number) => void;
  currentCity?: string;
  isLocating?: boolean;
}

export default function Header({ onCitySelect, onLocationSelect, currentCity, isLocating = false }: HeaderProps) {
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
      {/* <div className="text-center mb-6">
        <h1 className="text-4xl font-bold text-sky-700 mb-2">
          天气预报
        </h1>
        <p className="text-sky-600">
          实时天气预报与可视化展示
        </p>
      </div> */}

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
            className={`w-full px-4 py-3 pl-12 ${currentCity ? 'pr-40' : 'pr-20'} rounded-xl focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-200 text-gray-800 placeholder-gray-400 transition-all bg-white/60 backdrop-blur-sm`}
            />
            <div className="absolute left-4 top-1/2 transform -translate-y-1/2">
              <svg
                className="w-5 h-5 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </div>
            <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex items-center gap-2">
              {currentCity && (
                <span className="text-xs text-sky-600 bg-sky-50 px-2 py-1 rounded">
                  当前: {currentCity}
                </span>
              )}
              <button
                type="button"
                onClick={handleLocationClick}
                disabled={locating || isLocating}
                className={`p-2 rounded-lg transition-all ${
                  locating || isLocating
                    ? 'border-sky-300 bg-sky-100/60 backdrop-blur-sm cursor-not-allowed'
                    : 'border-sky-200 bg-white/40 backdrop-blur-sm hover:border-sky-400 hover:bg-sky-50/60 active:bg-sky-100/60'
                }`}
                title="获取当前位置"
              >
                {locating || isLocating ? (
                  <svg
                    className="w-5 h-5 text-sky-500 animate-spin"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                ) : (
                  <svg
                    className="w-5 h-5 text-sky-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                  </svg>
                )}
              </button>
            </div>
          </div>
        </form>

        {/* Suggestions Dropdown */}
        {showSuggestions && suggestions.length > 0 && (
          <div
            ref={suggestionsRef}
            className="absolute z-50 w-full mt-2 bg-white/40 backdrop-blur-sm rounded-xl shadow-xl border border-sky-100 max-h-64 overflow-y-auto"
          >
            {suggestions.map((city, index) => (
              <button
                key={`${city.englishName}-${index}`}
                type="button"
                onClick={() => handleCitySelect(city)}
                className={`w-full text-left px-4 py-3 hover:bg-sky-50 transition-colors ${
                  index === selectedIndex ? 'bg-sky-100' : ''
                } ${
                  index === 0 ? 'rounded-t-xl' : ''
                } ${
                  index === suggestions.length - 1 ? 'rounded-b-xl' : ''
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-800">{city.chineseName}</p>
                    <p className="text-sm text-gray-500">{city.englishName}</p>
                  </div>
                  <svg
                    className="w-5 h-5 text-sky-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </header>
  );
}

