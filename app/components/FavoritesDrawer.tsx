'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { WeatherResponse } from '@/app/types/weather';
import type { TextColorTheme } from '@/app/utils/textColorTheme';
import { getCardStyle } from '@/app/utils/textColorTheme';
import { translateWeatherCondition } from '@/app/utils/weatherTranslations';
import { translateLocation } from '@/app/utils/locationTranslations';
import Icon from '@/app/components/Icon';
import { ICONS } from '@/app/utils/icons';

export type FavoriteCity = {
  query: string; // city name or "lat,lon"
  label?: string; // cached display label (Chinese)
};

type CachedWeather = {
  fetchedAt: number; // ms
  data: WeatherResponse;
};

const FAVORITES_KEY = 'wp:favorites:v1';
const WEATHER_CACHE_KEY = 'wp:favorites:weather:v1';
const WEATHER_CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes

function safeParseJson<T>(value: string | null): T | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function buildWeatherUrl(query: string): string {
  if (query.includes(',')) {
    const [lat, lon] = query.split(',');
    return `/api/weather?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}`;
  }
  return `/api/weather?city=${encodeURIComponent(query)}`;
}

export function loadFavoritesFromStorage(): FavoriteCity[] {
  if (typeof window === 'undefined') return [];
  const parsed = safeParseJson<FavoriteCity[]>(localStorage.getItem(FAVORITES_KEY));
  return Array.isArray(parsed) ? parsed.filter((x) => !!x?.query) : [];
}

export function saveFavoritesToStorage(favorites: FavoriteCity[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));
}

function loadWeatherCache(): Record<string, CachedWeather> {
  if (typeof window === 'undefined') return {};
  const parsed = safeParseJson<Record<string, CachedWeather>>(localStorage.getItem(WEATHER_CACHE_KEY));
  return parsed && typeof parsed === 'object' ? parsed : {};
}

function saveWeatherCache(cache: Record<string, CachedWeather>) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(WEATHER_CACHE_KEY, JSON.stringify(cache));
}

interface FavoritesDrawerProps {
  textColorTheme: TextColorTheme;
  currentCityQuery?: string;
  favorites: FavoriteCity[];
  onChangeFavorites: (next: FavoriteCity[]) => void;
  onSelectCity: (query: string) => void;
}

export default function FavoritesDrawer({
  textColorTheme,
  currentCityQuery,
  favorites,
  onChangeFavorites,
  onSelectCity,
}: FavoritesDrawerProps) {
  const [open, setOpen] = useState(false);
  const [weatherByQuery, setWeatherByQuery] = useState<Record<string, CachedWeather>>({});
  const [loadingQueries, setLoadingQueries] = useState<Record<string, boolean>>({});
  const cacheRef = useRef<Record<string, CachedWeather>>({});
  const inFlightRef = useRef<Set<string>>(new Set());
  const openRef = useRef(false);

  const isDark = textColorTheme.backgroundType === 'dark';

  // preload cache on mount
  useEffect(() => {
    const cached = loadWeatherCache();
    cacheRef.current = cached;
    setWeatherByQuery(cached);
  }, []);

  // Lock body scroll when drawer is open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [open]);

  // fetch when opened
  useEffect(() => {
    // only trigger on closed -> open transition
    if (!open) {
      openRef.current = false;
      return;
    }
    if (openRef.current) return;
    openRef.current = true;

    if (favorites.length === 0) return;

    let cancelled = false;
    // merge latest storage cache into ref (source of truth)
    cacheRef.current = { ...cacheRef.current, ...loadWeatherCache() };

    async function fetchOne(query: string) {
      if (inFlightRef.current.has(query)) return;
      const cached = cacheRef.current[query];
      const isFresh = cached && Date.now() - cached.fetchedAt < WEATHER_CACHE_TTL_MS;
      if (isFresh) return;

      inFlightRef.current.add(query);
      setLoadingQueries((prev) => ({ ...prev, [query]: true }));
      try {
        const res = await fetch(buildWeatherUrl(query));
        if (!res.ok) throw new Error('Failed to fetch weather');
        const data: WeatherResponse = await res.json();
        const next: CachedWeather = { fetchedAt: Date.now(), data };
        cacheRef.current[query] = next;
        if (!cancelled) {
          setWeatherByQuery((prev) => ({ ...prev, [query]: next }));
        }
      } catch {
        // ignore; keep card in "failed" state
      } finally {
        inFlightRef.current.delete(query);
        if (!cancelled) {
          setLoadingQueries((prev) => ({ ...prev, [query]: false }));
        }
      }
    }

    (async () => {
      await Promise.allSettled(favorites.map((f) => fetchOne(f.query)));
      if (!cancelled) {
        saveWeatherCache(cacheRef.current);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, favorites]);

  const isCurrentFavorite = useMemo(() => {
    if (!currentCityQuery) return false;
    return favorites.some((f) => f.query === currentCityQuery);
  }, [favorites, currentCityQuery]);

  const toggleCurrentFavorite = () => {
    if (!currentCityQuery) return;
    if (isCurrentFavorite) {
      const next = favorites.filter((f) => f.query !== currentCityQuery);
      onChangeFavorites(next);
      saveFavoritesToStorage(next);
      return;
    }
    const next = [{ query: currentCityQuery }, ...favorites.filter((f) => f.query !== currentCityQuery)];
    onChangeFavorites(next);
    saveFavoritesToStorage(next);
  };

  const removeFavorite = (query: string) => {
    const next = favorites.filter((f) => f.query !== query);
    onChangeFavorites(next);
    saveFavoritesToStorage(next);
  };

  return (
    <>
      {/* Entry button: shown on page left when drawer is closed */}
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={`fixed top-4 left-4 z-[85] rounded-xl p-2 transition-all active:scale-95 ${
            isDark ? 'hover:bg-white/10' : 'hover:bg-black/5'
          }`}
          aria-label="打开收藏城市抽屉"
          title="收藏城市"
        >
          <Icon
            src={ICONS.sidebar}
            className={`w-6 h-6 ${textColorTheme.textColor.secondary}`}
            title="收藏抽屉"
          />
        </button>
      )}

      {/* Drawer */}
      <div className={`fixed inset-0 z-[80] ${open ? 'pointer-events-auto' : 'pointer-events-none'}`}>
        {/* overlay */}
        <div
          className={`absolute inset-0 transition-opacity duration-300 ${open ? 'opacity-100' : 'opacity-0'} bg-black/35 backdrop-blur-sm ${open ? '' : 'pointer-events-none'}`}
          onClick={() => setOpen(false)}
        />

        <aside
          className={`absolute left-0 top-0 h-full w-[40vw] max-w-xs md:max-w-sm transition-transform duration-300 ease-out ${
            open ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <div className={`h-full ${getCardStyle(textColorTheme.backgroundType)} ${isDark ? 'bg-gray-900/70' : 'bg-white/70'} backdrop-blur-2xl border-r ${isDark ? 'border-white/10' : 'border-white/50'} shadow-2xl`}>
            <div className="p-5 flex items-center justify-between">
              <div>
                <h3 className={`text-lg font-bold ${textColorTheme.textColor.primary}`}>收藏城市</h3>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className={`rounded-xl p-2 transition ${isDark ? 'hover:bg-white/10' : 'hover:bg-gray-100'}`}
                aria-label="收起收藏抽屉"
              >
                <Icon src={ICONS.sidebar} className={`w-6 h-6 ${textColorTheme.textColor.secondary}`} title="收起" />
              </button>
            </div>

            <div className="px-5 pb-2 overflow-y-auto h-[calc(100%-102px)]">
              {favorites.length === 0 ? (
                <div className={`mt-10 text-center ${textColorTheme.textColor.muted}`}>
                  暂无收藏城市
                </div>
              ) : (
                <div className="space-y-4">
                  {favorites.map((fav) => {
                    const cached = weatherByQuery[fav.query];
                    const isLoading = !!loadingQueries[fav.query];
                    const isFresh = cached && Date.now() - cached.fetchedAt < WEATHER_CACHE_TTL_MS;

                    const displayName = cached
                      ? translateLocation(cached.data.location).name
                      : (fav.label || fav.query);
                    const temp = cached ? `${cached.data.current.temp_c.toFixed(0)}°C` : '--';
                    const cond = cached ? translateWeatherCondition(cached.data.current.condition) : (isLoading ? '加载中…' : '未加载');

                    return (
                      <div
                        key={fav.query}
                        className={`group relative h-[15vh] rounded-2xl border shadow-lg overflow-hidden transition-all ${
                          isDark ? 'border-white/10 bg-white/5 hover:bg-white/10' : 'border-white/60 bg-white/70 hover:bg-white/90'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            onSelectCity(fav.query);
                            setOpen(false);
                          }}
                          className="w-full text-left p-4"
                          aria-label={`查看${displayName}天气`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className={`text-3xl font-bold ${textColorTheme.textColor.primary}`}>{displayName}</p>
                              <p className={`text-xs ${textColorTheme.textColor.muted}`}>
                                {isLoading ? '正在更新…' : isFresh ? '' : '待更新'}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className={`text-3xl font-extrabold ${textColorTheme.textColor.primary}`}>{temp}</p>
                              <p className={`text-sm mt-12 ${textColorTheme.textColor.secondary}`}>{cond}</p>
                            </div>
                          </div>
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </aside>
      </div>
    </>
  );
}


