'use client';

import React, { useEffect, useMemo, useState } from 'react';
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
const WEATHER_CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

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

  const isDark = textColorTheme.backgroundType === 'dark';

  // preload cache on mount
  useEffect(() => {
    setWeatherByQuery(loadWeatherCache());
  }, []);

  // fetch when opened
  useEffect(() => {
    if (!open) return;
    if (favorites.length === 0) return;

    let cancelled = false;
    const cache = { ...weatherByQuery, ...loadWeatherCache() };

    async function fetchOne(query: string) {
      const cached = cache[query];
      const isFresh = cached && Date.now() - cached.fetchedAt < WEATHER_CACHE_TTL_MS;
      if (isFresh) return;

      setLoadingQueries((prev) => ({ ...prev, [query]: true }));
      try {
        const res = await fetch(buildWeatherUrl(query));
        if (!res.ok) throw new Error('Failed to fetch weather');
        const data: WeatherResponse = await res.json();
        const next: CachedWeather = { fetchedAt: Date.now(), data };
        cache[query] = next;
        if (!cancelled) {
          setWeatherByQuery((prev) => ({ ...prev, [query]: next }));
        }
      } catch {
        // ignore; keep card in "failed" state
      } finally {
        if (!cancelled) {
          setLoadingQueries((prev) => ({ ...prev, [query]: false }));
        }
      }
    }

    (async () => {
      await Promise.allSettled(favorites.map((f) => fetchOne(f.query)));
      if (!cancelled) {
        saveWeatherCache(cache);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, favorites, weatherByQuery]);

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
      {/* Top-right entry button (doesn't take layout space) */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`fixed top-4 right-4 z-[85] rounded-2xl p-2.5 shadow-xl border backdrop-blur-xl transition-all active:scale-95 ${
          isDark
            ? 'bg-gray-900/40 border-white/10 hover:bg-gray-900/60'
            : 'bg-white/60 border-white/60 hover:bg-white/85'
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

      {/* Drawer */}
      <div className={`fixed inset-0 z-[80] ${open ? 'pointer-events-auto' : 'pointer-events-none'}`}>
        {/* overlay */}
        <div
          className={`absolute inset-0 transition-opacity duration-300 ${open ? 'opacity-100' : 'opacity-0'} bg-black/35 backdrop-blur-sm ${open ? '' : 'pointer-events-none'}`}
          onClick={() => setOpen(false)}
        />

        <aside
          className={`absolute left-0 top-0 h-full w-[88vw] max-w-sm md:max-w-md transition-transform duration-300 ease-out ${
            open ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <div className={`h-full ${getCardStyle(textColorTheme.backgroundType)} ${isDark ? 'bg-gray-900/70' : 'bg-white/70'} backdrop-blur-2xl border-r ${isDark ? 'border-white/10' : 'border-white/50'} shadow-2xl`}>
            <div className="p-5 flex items-center justify-between">
              <div>
                <h3 className={`text-lg font-bold ${textColorTheme.textColor.primary}`}>收藏城市</h3>
                <p className={`text-xs ${textColorTheme.textColor.muted}`}>打开时自动更新并缓存 30 分钟</p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className={`rounded-xl p-2 transition ${isDark ? 'hover:bg-white/10' : 'hover:bg-gray-100'}`}
                aria-label="关闭收藏抽屉"
              >
                <Icon src={ICONS.close} className={`w-6 h-6 ${textColorTheme.textColor.secondary}`} title="关闭" />
              </button>
            </div>

            <div className="px-5 pb-4">
              <button
                type="button"
                onClick={toggleCurrentFavorite}
                disabled={!currentCityQuery}
                className={`w-full rounded-2xl px-4 py-3 font-semibold text-sm transition active:scale-[0.99] border ${
                  isDark
                    ? 'bg-white/10 hover:bg-white/15 border-white/10'
                    : 'bg-white/70 hover:bg-white/90 border-white/60'
                } ${!currentCityQuery ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {isCurrentFavorite ? '取消收藏当前城市' : '收藏当前城市'}
              </button>
            </div>

            <div className="px-5 pb-6 overflow-y-auto h-[calc(100%-152px)]">
              {favorites.length === 0 ? (
                <div className={`mt-10 text-center ${textColorTheme.textColor.muted}`}>
                  暂无收藏城市
                </div>
              ) : (
                <div className="space-y-3">
                  {favorites.map((fav) => {
                    const cached = weatherByQuery[fav.query];
                    const isLoading = !!loadingQueries[fav.query];
                    const isFresh = cached && Date.now() - cached.fetchedAt < WEATHER_CACHE_TTL_MS;

                    const displayName = cached
                      ? translateLocation(cached.data.location).name
                      : (fav.label || fav.query);
                    const temp = cached ? `${cached.data.current.temp_c.toFixed(1)}°C` : '--';
                    const cond = cached ? translateWeatherCondition(cached.data.current.condition) : (isLoading ? '加载中…' : '未加载');

                    return (
                      <div
                        key={fav.query}
                        className={`group rounded-3xl border shadow-lg overflow-hidden transition-all ${
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
                              <p className={`text-lg font-bold ${textColorTheme.textColor.primary}`}>{displayName}</p>
                              <p className={`text-xs ${textColorTheme.textColor.muted}`}>
                                {isLoading ? '正在更新…' : isFresh ? '已缓存' : '待更新'}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className={`text-2xl font-extrabold ${textColorTheme.textColor.primary}`}>{temp}</p>
                              <p className={`text-xs ${textColorTheme.textColor.secondary}`}>{cond}</p>
                            </div>
                          </div>
                        </button>
                        <div className="px-4 pb-4 flex items-center justify-between">
                          <div className={`text-xs ${textColorTheme.textColor.muted}`}>
                            {fav.query.includes(',') ? '坐标收藏' : '城市收藏'}
                          </div>
                          <button
                            type="button"
                            onClick={() => removeFavorite(fav.query)}
                            className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
                              isDark ? 'hover:bg-white/10 text-gray-200' : 'hover:bg-gray-100 text-gray-700'
                            }`}
                            aria-label={`移除${displayName}收藏`}
                          >
                            移除
                          </button>
                        </div>
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


