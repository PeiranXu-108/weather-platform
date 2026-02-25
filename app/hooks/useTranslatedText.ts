'use client';

import { useState, useEffect } from 'react';

export type TranslateGeo = { country?: string; region?: string; city?: string };

/** 简单判断是否为英文等需翻译文本（含拉丁字母且几乎无 CJK） */
function isLikelyEnglish(s: string): boolean {
  if (!s?.trim()) return false;
  const t = s.trim();
  const hasLatin = /[a-zA-Z]/.test(t);
  const cjkCount = (t.match(/[\u4e00-\u9fff\u3400-\u4dbf]/g) || []).length;
  return hasLatin && cjkCount <= 1;
}

async function translateOne(text: string, geo?: TranslateGeo): Promise<string> {
  const res = await fetch('/api/translate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, ...geo }),
  });
  if (!res.ok) return text;
  const data = await res.json();
  return data.translated ?? text;
}

async function translateBatch(texts: string[], geo?: TranslateGeo): Promise<string[]> {
  const res = await fetch('/api/translate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ texts, ...geo }),
  });
  if (!res.ok) return texts;
  const data = await res.json();
  const out = Array.isArray(data.translated) ? data.translated : [data.translated];
  return texts.map((orig, i) => out[i] ?? orig);
}

/**
 * 先显示接口返回的原文，若是英文则请求 Qwen 翻译，翻译完成后显示中文。
 * @param geo 可选地理信息，传入可提升地名等翻译准确度
 */
export function useTranslatedText(original: string, geo?: TranslateGeo): string {
  const [display, setDisplay] = useState(original);

  useEffect(() => {
    setDisplay(original);
    if (!original || !isLikelyEnglish(original)) return;

    let cancelled = false;
    translateOne(original, geo).then((translated) => {
      if (!cancelled && translated) setDisplay(translated);
    });
    return () => {
      cancelled = true;
    };
  }, [original, geo?.country, geo?.region, geo?.city]);

  return display;
}

/**
 * 批量：先显示原文，若为英文则翻译后显示中文。返回与 texts 同序的显示文案数组。
 * @param geo 可选地理信息，传入可提升地名等翻译准确度
 */
export function useTranslatedTexts(originals: string[], geo?: TranslateGeo): string[] {
  const [display, setDisplay] = useState<string[]>(() => originals);

  useEffect(() => {
    setDisplay(originals);
    const toTranslate = originals
      .map((t, i) => (isLikelyEnglish(t) ? i : -1))
      .filter((i) => i >= 0);
    if (toTranslate.length === 0) return;

    let cancelled = false;
    const run = async () => {
      if (toTranslate.length === 0) return;
      if (geo?.country ?? geo?.region ?? geo?.city) {
        const translated = await translateBatch(originals, geo);
        if (!cancelled && translated) setDisplay(translated);
      } else {
        const results = await Promise.all(
          toTranslate.map((i) => translateOne(originals[i]).then((translated) => ({ i, translated })))
        );
        if (cancelled) return;
        setDisplay((prev) => {
          const next = [...prev];
          results.forEach(({ i, translated }) => {
            if (translated) next[i] = translated;
          });
          return next;
        });
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [originals.join('\0'), geo?.country, geo?.region, geo?.city]);

  return display;
}
