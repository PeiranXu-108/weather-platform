import { CITY_NAME_MAP } from './locationTranslations';

export interface CityOption {
  englishName: string;
  chineseName: string;
}

const normalize = (value: string) => value.trim().toLowerCase().replace(/\s+/g, '');

export function getAllCities(): CityOption[] {
  return Object.entries(CITY_NAME_MAP).map(([englishName, chineseName]) => ({
    englishName,
    chineseName,
  }));
}

export function searchCities(query: string, maxResults: number = 10): CityOption[] {
  if (!query || !query.trim()) return [];
  const q = normalize(query);

  const matches = getAllCities().filter((city) => {
    return normalize(city.englishName).includes(q) || city.chineseName.includes(query.trim());
  });

  return matches.slice(0, maxResults);
}

export function getEnglishCityName(cityName: string): string {
  if (!cityName) return '';
  const normalized = normalize(cityName);

  if (CITY_NAME_MAP[normalized]) return normalized;

  const entry = Object.entries(CITY_NAME_MAP).find(
    ([key, zh]) => normalize(key) === normalized || zh === cityName
  );

  return entry?.[0] ?? normalized;
}
