import type { FavoriteCity } from '@shared/weather/types';
import { apiJson } from '@/data/apiClient';

export async function fetchFavorites() {
  return apiJson<FavoriteCity[]>('/api/favorites');
}

export async function addFavorite(payload: FavoriteCity) {
  return apiJson<FavoriteCity[]>('/api/favorites', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export async function removeFavorite(query: string) {
  return apiJson<FavoriteCity[]>(`/api/favorites?query=${encodeURIComponent(query)}`, {
    method: 'DELETE',
  });
}

export async function syncFavorites(favorites: FavoriteCity[]) {
  return apiJson<FavoriteCity[]>('/api/favorites/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ favorites }),
  });
}

export async function fetchUsage() {
  return apiJson<{ total: number; daily: { date: string; count: number }[] }>('/api/usage');
}
