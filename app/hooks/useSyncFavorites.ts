'use client';

import { useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { loadFavoritesFromStorage } from '@/app/components/FavoritesDrawer';
import { favoritesApi } from '@/app/lib/api';

const FAVORITES_KEY = 'wp:favorites:v1';

export function useSyncFavorites() {
  const { status } = useSession();
  const syncedRef = useRef(false);

  useEffect(() => {
    if (status !== 'authenticated' || syncedRef.current) return;

    const localFavs = loadFavoritesFromStorage();
    syncedRef.current = true;
    if (localFavs.length === 0) return;

    (async () => {
      const res = await favoritesApi.sync(localFavs);
      if (res.ok) {
        localStorage.removeItem(FAVORITES_KEY);
        // 让页面其它逻辑可选择监听
        window.dispatchEvent(new Event('favorites:synced'));
      }
    })().catch(() => {
      // ignore: keep local data
      syncedRef.current = false;
    });
  }, [status]);
}

