import AsyncStorage from '@react-native-async-storage/async-storage';

export const CURRENT_CITY_KEY = 'wp:currentCity:v1';
export const FAVORITES_KEY = 'wp:favorites:v1';
export const FAVORITES_WEATHER_KEY = 'wp:favorites:weather:v1';

export async function getCachedJson<T>(key: string): Promise<T | null> {
  const raw = await AsyncStorage.getItem(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function setCachedJson<T>(key: string, value: T) {
  await AsyncStorage.setItem(key, JSON.stringify(value));
}
