'use client';

import React, { useState, useRef, useEffect } from 'react';
import { searchCities, getEnglishCityName, type CityOption } from '@/app/utils/citySearch';
import type { TextColorTheme } from '@/app/utils/textColorTheme';
import { getCardStyle, readableTextShadowStyle, shouldEnhanceReadableText } from '@/app/utils/textColorTheme';
import Icon from '@/app/models/Icon';
import { ICONS } from '@/app/utils/icons';
import { useSession } from 'next-auth/react';
import AuthModal from '@/app/components/Auth/AuthModal';
import ProfileModal from '@/app/components/Auth/ProfileModal';
import SettingsPanel from '@/app/components/SettingsPanel';
import { useI18n } from '@/app/i18n';

interface HeaderProps {
  onCitySelect: (cityName: string) => void;
  onLocationSelect?: (lat: number, lon: number) => void;
  currentCity?: string;
  isLocating?: boolean;
  textColorTheme?: TextColorTheme;
  opacity?: number;
  onOpacityChange?: (opacity: number) => void;
  showBackground?: boolean;
  onShowBackgroundChange?: (show: boolean) => void;
  showFireworksAction?: boolean;
}

export default function Header({ onCitySelect, onLocationSelect, currentCity, isLocating = false, textColorTheme, opacity = 0, onOpacityChange, showBackground = true, onShowBackgroundChange, showFireworksAction = false }: HeaderProps) {
  const { locale, t } = useI18n();
  const { data: session } = useSession();
  const [authOpen, setAuthOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

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
  const enhanceReadableText = shouldEnhanceReadableText(showBackground, theme);
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
      alert(t('header.geolocationUnsupported'));
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
        let errorMessage = t('header.locationFailedPrefix');
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage += t('header.locationDenied');
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage += t('header.locationUnavailable');
            break;
          case error.TIMEOUT:
            errorMessage += t('header.locationTimeout');
            break;
          default:
            errorMessage += t('header.locationUnknown');
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
    <header className="mb-8 relative pl-16 pr-[7rem] lg:pr-0">
      <div className="absolute top-0 right-0 flex items-center gap-3">
        {opacity !== undefined && onOpacityChange !== undefined && showBackground !== undefined && onShowBackgroundChange !== undefined && (
          <SettingsPanel
            textColorTheme={theme}
            opacity={opacity}
            onOpacityChange={onOpacityChange}
            showBackground={showBackground}
            onShowBackgroundChange={onShowBackgroundChange}
            showFireworksAction={showFireworksAction}
          />
        )}
        {session?.user ? (
          <>
            <span
              className={`hidden sm:inline text-sm font-medium ${theme.textColor.primary}`}
              style={readableTextShadowStyle('primary', enhanceReadableText)}
            >
              {session.user.name || session.user.email}
            </span>
            <button
              type="button"
              onClick={() => setProfileOpen(true)}
              className={`p-2 rounded-full transition-all active:scale-95 min-w-[44px] min-h-[44px] flex items-center justify-center ${
                theme.backgroundType === 'dark' ? 'hover:bg-white/10' : 'hover:bg-black/5'
              }`}
              title={t('header.profileCenter')}
            >
              <Icon
                src={ICONS.profile}
                className={`w-8 h-8 ${theme.textColor.secondary}`}
                title={t('header.profileCenter')}
              />
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => setAuthOpen(true)}
            className={`p-2 rounded-full transition-all active:scale-95 min-w-[44px] min-h-[44px] flex items-center justify-center ${
              theme.backgroundType === 'dark' ? 'hover:bg-white/10' : 'hover:bg-black/5'
            }`}
          >
            <Icon
              src={ICONS.profile}
              className={`w-8 h-8 ${theme.textColor.secondary}`}
              title={t('header.login')}
            />
          </button>
        )}
      </div>

      <AuthModal isOpen={authOpen} onClose={() => setAuthOpen(false)} textColorTheme={theme} />
      <ProfileModal
        isOpen={profileOpen}
        onClose={() => setProfileOpen(false)}
        textColorTheme={theme}
        session={session}
      />

      {/* Search Bar - pr on header reserves space for right-aligned buttons on mobile */}
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
              placeholder={t('header.searchCity')}
              className={`w-full px-4 py-3 pl-12 ${currentCity ? 'pr-12 sm:pr-20 md:pr-40' : 'pr-12 sm:pr-20'} rounded-xl focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-200 ${theme.textColor.primary} placeholder-gray-400 transition-all ${getCardStyle(theme.backgroundType)}`}
              style={readableTextShadowStyle('primary', enhanceReadableText)}
            />
            <div className="absolute left-4 top-1/2 transform -translate-y-1/2">
              <Icon
                src={ICONS.search}
                className={`w-5 h-5 ${theme.textColor.muted}`}
                title={t('common.search')}
              />
            </div>
            <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex items-center gap-2">
              <button
                type="button"
                onClick={handleLocationClick}
                disabled={locating || isLocating}
                className={`p-2 rounded-lg transition-all min-w-[44px] min-h-[44px] flex items-center justify-center  ${locating || isLocating
                  }`}
                title={t('header.getCurrentLocation')}
              >
                {locating || isLocating ? (
                  <Icon
                    src={ICONS.spinner}
                    className="w-5 h-5 text-sky-500 animate-spin"
                    title={t('header.locating')}
                  />
                ) : (
                  <Icon
                    src={ICONS.location}
                    className="w-5 h-5 text-sky-600"
                    title={t('header.getCurrentLocation')}
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
                className={`w-full text-left px-4 py-3 ${theme.backgroundType === 'dark' ? 'hover:bg-white/20' : 'hover:bg-sky-50'} transition-colors ${index === selectedIndex ? (theme.backgroundType === 'dark' ? 'bg-white/30' : 'bg-sky-100') : ''
                  } ${index === 0 ? 'rounded-t-xl' : ''
                  } ${index === suggestions.length - 1 ? 'rounded-b-xl' : ''
                  }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p
                      className={`font-medium ${theme.textColor.primary}`}
                      style={readableTextShadowStyle('primary', enhanceReadableText)}
                    >
                      {locale === 'zh' ? city.chineseName : city.englishName}
                    </p>
                    <p
                      className={`text-sm ${theme.textColor.muted}`}
                      style={readableTextShadowStyle('secondary', enhanceReadableText)}
                    >
                      {locale === 'zh' ? city.englishName : city.chineseName}
                    </p>
                  </div>
                  <Icon
                    src={ICONS.chevronRight}
                    className="w-5 h-5 text-sky-400"
                    title={t('common.select')}
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

