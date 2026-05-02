'use client';

import { useState, useEffect } from 'react';
import { translateLocationName } from '@/app/utils/locationTranslations';
import { translateWeatherCondition } from '@/app/utils/weatherTranslations';
import { fetchTranslate } from '@/app/lib/api';
import { useI18n } from '@/app/i18n';

export type TranslateGeo = { country?: string; region?: string; city?: string };
const TRANSLATION_SESSION_CACHE_KEY = 'weather.translation.cache.v1';

type TranslationCacheMap = Record<string, string>;

/** 简单判断是否为英文等需翻译文本（含拉丁字母且几乎无 CJK） */
function isLikelyEnglish(s: string): boolean {
  if (!s?.trim()) return false;
  const t = s.trim();
  const hasLatin = /[a-zA-Z]/.test(t);
  const cjkCount = (t.match(/[\u4e00-\u9fff\u3400-\u4dbf]/g) || []).length;
  return hasLatin && cjkCount <= 1;
}

function normalizeValue(value?: string): string {
  return value?.trim().toLowerCase() ?? '';
}

function createCacheKey(text: string, geo?: TranslateGeo): string {
  return JSON.stringify({
    text: normalizeValue(text),
    country: normalizeValue(geo?.country),
    region: normalizeValue(geo?.region),
    city: normalizeValue(geo?.city),
  });
}

function readTranslationCache(): TranslationCacheMap {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.sessionStorage.getItem(TRANSLATION_SESSION_CACHE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    return parsed as TranslationCacheMap;
  } catch {
    return {};
  }
}

function writeTranslationCache(cache: TranslationCacheMap) {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(TRANSLATION_SESSION_CACHE_KEY, JSON.stringify(cache));
  } catch {
    // ignore sessionStorage errors (quota/privacy mode)
  }
}

function getCachedTranslation(text: string, geo?: TranslateGeo): string | null {
  if (!text) return null;
  const cache = readTranslationCache();
  const key = createCacheKey(text, geo);
  return cache[key] ?? null;
}

function setCachedTranslation(text: string, translated: string, geo?: TranslateGeo) {
  if (!text || !translated) return;
  const cache = readTranslationCache();
  const key = createCacheKey(text, geo);
  cache[key] = translated;
  writeTranslationCache(cache);
}

function resolveLocalTranslation(text: string, geo?: TranslateGeo): string | null {
  if (!text) return null;
  const normalizedText = normalizeValue(text);
  if (!normalizedText) return null;

  if (normalizedText === normalizeValue(geo?.city)) {
    const city = translateLocationName(text, 'city');
    if (city !== text) return city;
  }
  if (normalizedText === normalizeValue(geo?.region)) {
    const region = translateLocationName(text, 'region');
    if (region !== text) return region;
  }
  if (normalizedText === normalizeValue(geo?.country)) {
    const country = translateLocationName(text, 'country');
    if (country !== text) return country;
  }

  const location = translateLocationName(text, 'city');
  if (location !== text) return location;

  const weather = translateWeatherCondition({ code: -1, text });
  if (weather !== text) return weather;

  return null;
}

function resolveImmediateTranslation(text: string, geo?: TranslateGeo): string {
  const local = resolveLocalTranslation(text, geo);
  if (local) return local;
  const cached = getCachedTranslation(text, geo);
  if (cached) return cached;
  return text;
}

async function translateOne(text: string, geo?: TranslateGeo): Promise<string> {
  const local = resolveLocalTranslation(text, geo);
  if (local) return local;

  const cached = getCachedTranslation(text, geo);
  if (cached) return cached;

  const res = await fetchTranslate({ text, ...geo });
  if (!res.ok) return text;
  const data = await res.json();
  const translated = data.translated ?? text;
  if (translated && translated !== text) {
    setCachedTranslation(text, translated, geo);
  }
  return translated;
}

async function translateBatch(texts: string[], geo?: TranslateGeo): Promise<string[]> {
  if (texts.length === 0) return [];

  const results = [...texts];
  const unknownIndices: number[] = [];
  const unknownTexts: string[] = [];

  texts.forEach((text, i) => {
    const local = resolveLocalTranslation(text, geo);
    if (local) {
      results[i] = local;
      return;
    }
    const cached = getCachedTranslation(text, geo);
    if (cached) {
      results[i] = cached;
      return;
    }
    unknownIndices.push(i);
    unknownTexts.push(text);
  });

  if (unknownTexts.length === 0) return results;

  const res = await fetchTranslate({ texts: unknownTexts, ...geo });
  if (!res.ok) return results;
  const data = await res.json();
  const out = Array.isArray(data.translated) ? data.translated : [data.translated];
  unknownIndices.forEach((index, i) => {
    const original = texts[index];
    const translated = out[i] ?? original;
    results[index] = translated;
    if (translated && translated !== original) {
      setCachedTranslation(original, translated, geo);
    }
  });

  return results;
}

/**
 * 先显示接口返回的原文，若是英文则请求 Qwen 翻译，翻译完成后显示中文。
 * @param geo 可选地理信息，传入可提升地名等翻译准确度
 */
export function useTranslatedText(original: string, geo?: TranslateGeo): string {
  const { locale } = useI18n();
  const [display, setDisplay] = useState(() => resolveImmediateTranslation(original, geo));

  useEffect(() => {
    if (locale === 'en') {
      setDisplay(original);
      return;
    }
    const immediate = resolveImmediateTranslation(original, geo);
    setDisplay(immediate);
    if (!original || !isLikelyEnglish(original)) return;
    if (immediate !== original) return;

    let cancelled = false;
    translateOne(original, geo).then((translated) => {
      if (!cancelled && translated) setDisplay(translated);
    });
    return () => {
      cancelled = true;
    };
  }, [original, geo?.country, geo?.region, geo?.city, locale]);

  return locale === 'en' ? original : display;
}

/**
 * 批量：先显示原文，若为英文则翻译后显示中文。返回与 texts 同序的显示文案数组。
 * @param geo 可选地理信息，传入可提升地名等翻译准确度
 */
export function useTranslatedTexts(originals: string[], geo?: TranslateGeo): string[] {
  const { locale } = useI18n();
  const [display, setDisplay] = useState<string[]>(() =>
    originals.map((text) => resolveImmediateTranslation(text, geo))
  );

  useEffect(() => {
    if (locale === 'en') {
      setDisplay(originals);
      return;
    }
    const immediate = originals.map((text) => resolveImmediateTranslation(text, geo));
    setDisplay(immediate);
    const toTranslate = originals
      .map((t, i) => (isLikelyEnglish(t) && immediate[i] === t ? i : -1))
      .filter((i) => i >= 0);
    if (toTranslate.length === 0) return;

    let cancelled = false;
    const run = async () => {
      const unknownTexts = toTranslate.map((i) => originals[i]);
      const translatedUnknown = await translateBatch(unknownTexts, geo);
      if (cancelled) return;
      setDisplay((prev) => {
        const next = [...prev];
        toTranslate.forEach((originalIndex, i) => {
          next[originalIndex] = translatedUnknown[i] ?? next[originalIndex];
        });
        return next;
      });
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [originals.join('\0'), geo?.country, geo?.region, geo?.city, locale]);

  return locale === 'en' ? originals : display;
}
