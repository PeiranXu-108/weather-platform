/**
 * City search utility
 * Supports searching cities by both Chinese and English names
 */

import { CITY_NAME_MAP } from './locationTranslations';

export interface CityOption {
  englishName: string;
  chineseName: string;
}

/**
 * Get all available cities as options
 */
export function getAllCities(): CityOption[] {
  return Object.entries(CITY_NAME_MAP).map(([englishName, chineseName]) => ({
    englishName,
    chineseName,
  }));
}

/**
 * Search cities by query (supports both Chinese and English)
 * @param query - Search query (can be Chinese or English)
 * @param maxResults - Maximum number of results to return
 * @returns Array of matching city options
 */
export function searchCities(query: string, maxResults: number = 10): CityOption[] {
  if (!query || query.trim().length === 0) {
    return [];
  }

  const normalizedQuery = query.trim().toLowerCase();
  const allCities = getAllCities();
  const results: CityOption[] = [];

  for (const city of allCities) {
    const matchesEnglish = city.englishName.toLowerCase().includes(normalizedQuery);
    const matchesChinese = city.chineseName.includes(normalizedQuery);
    
    if (matchesEnglish || matchesChinese) {
      results.push(city);
      if (results.length >= maxResults) {
        break;
      }
    }
  }

  return results;
}

/**
 * Get the English name for a city (for API query)
 * If input is already English, return as is
 * If input is Chinese, find the corresponding English name
 * @param cityName - City name in Chinese or English
 * @returns English city name for API query
 */
export function getEnglishCityName(cityName: string): string {
  if (!cityName) return '';
  
  const normalized = cityName.trim().toLowerCase();
  
  // Check if it's already an English name in our map
  if (CITY_NAME_MAP[normalized]) {
    return normalized;
  }
  
  // Check if it's a Chinese name, find the English equivalent
  for (const [englishName, chineseName] of Object.entries(CITY_NAME_MAP)) {
    if (chineseName === cityName || chineseName.toLowerCase() === normalized) {
      return englishName;
    }
  }
  
  // If not found, return the original (might be a valid city name not in our map)
  return normalized;
}

