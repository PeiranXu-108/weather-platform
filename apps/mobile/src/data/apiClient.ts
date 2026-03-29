import { useAuthStore } from '@/state/authStore';

const DEFAULT_BASE_URL = 'http://localhost:3000';

export function getApiBaseUrl() {
  return (process.env.EXPO_PUBLIC_API_BASE_URL ?? DEFAULT_BASE_URL).replace(/\/$/, '');
}

function withAuth(headers?: HeadersInit): HeadersInit {
  const token = useAuthStore.getState().token;
  if (!token) return headers ?? {};
  return {
    ...(headers ?? {}),
    Authorization: `Bearer ${token}`,
  };
}

export async function apiFetch(path: string, init?: RequestInit) {
  const base = getApiBaseUrl();
  const response = await fetch(`${base}${path}`, {
    ...init,
    headers: withAuth(init?.headers),
  });
  return response;
}

export async function apiJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await apiFetch(path, init);
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const message = (data as { error?: string } | null)?.error ?? `Request failed: ${response.status}`;
    throw new Error(message);
  }
  return data as T;
}
