/**
 * 前端 API 层：所有与 app/api 的通信集中在此，便于维护和修改路径。
 * 所有接口均对应 app/api 下的 Route Handler。
 */

const BASE = '';

/** 根据 query（城市名或 "lat,lon"）生成天气接口 URL */
export function weatherUrl(query: string): string {
  if (query.includes(',')) {
    const [lat, lon] = query.split(',');
    return `${BASE}/api/weather?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}`;
  }
  return `${BASE}/api/weather?city=${encodeURIComponent(query)}`;
}

/** 天气接口：按城市名 */
export function fetchWeatherByCity(city: string): Promise<Response> {
  return fetch(`${BASE}/api/weather?city=${encodeURIComponent(city)}`);
}

/** 天气接口：按经纬度，可选 AbortSignal */
export function fetchWeatherByCoords(
  lat: number,
  lon: number,
  options?: { signal?: AbortSignal }
): Promise<Response> {
  return fetch(`${BASE}/api/weather?lat=${lat}&lon=${lon}`, options);
}

/** 30 日预报接口 */
export function weather30dUrl(location: string): string {
  return `${BASE}/api/weather/30d?location=${encodeURIComponent(location)}`;
}

export function fetchWeather30d(location: string): Promise<Response> {
  return fetch(weather30dUrl(location));
}

/** 收藏夹接口 */
export const favoritesApi = {
  list: (): Promise<Response> =>
    fetch(`${BASE}/api/favorites`, { credentials: 'include' }),

  add: (body: { query: string; label?: string }): Promise<Response> =>
    fetch(`${BASE}/api/favorites`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      credentials: 'include',
    }),

  remove: (query: string): Promise<Response> =>
    fetch(`${BASE}/api/favorites?query=${encodeURIComponent(query)}`, {
      method: 'DELETE',
      credentials: 'include',
    }),

  sync: (favorites: Array<{ query: string; label?: string }>): Promise<Response> =>
    fetch(`${BASE}/api/favorites/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ favorites }),
      credentials: 'include',
    }),
};

/** 使用量接口 */
export function fetchUsage(): Promise<Response> {
  return fetch(`${BASE}/api/usage`, { credentials: 'include' });
}

export function fetchChat(historyMessages: Array<{ role: string; content: string }>): Promise<Response> {
  return fetch(`${BASE}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages: historyMessages }),
  });
}
