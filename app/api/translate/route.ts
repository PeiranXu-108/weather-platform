/**
 * 翻译 API：使用 Qwen 大模型将英文等地名/天气描述翻译为中文。
 * 与 chat 接口共用 DASHSCOPE_API_KEY 与 Qwen 客户端。
 */

import { NextRequest } from 'next/server';
import OpenAI from 'openai';

const qwenClient = new OpenAI({
  apiKey: process.env.DASHSCOPE_API_KEY || '',
  baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
});

const TRANSLATE_SYSTEM_BASE = `你是一个专业翻译。将用户给出的英文地名、天气描述等短文本翻译成中文。
规则：
1. 只输出翻译结果，不要解释、不要加引号、不要换行。
2. 若已是中文或无法判断语言，直接原样输出。
3. 地名、天气术语使用常见中文译名。`;

function buildSystemPrompt(geo?: { country?: string; region?: string; city?: string }): string {
  if (!geo || (!geo.country && !geo.region && !geo.city)) return TRANSLATE_SYSTEM_BASE;
  const parts = [
    TRANSLATE_SYSTEM_BASE,
    '',
    '【已知地理信息】以下内容来自同一地点的天气数据，翻译时请结合该上下文提高准确度：',
  ];
  if (geo.country) parts.push(`- 国家：${geo.country}`);
  if (geo.region) parts.push(`- 地区/省/州：${geo.region}`);
  if (geo.city) parts.push(`- 城市/地点：${geo.city}`);
  parts.push('例如：国家名按该国常用中文译名；若原文已是该国官方语言或本地名称，可酌情保留或按通用译名翻译。');
  return parts.join('\n');
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { text, texts, country, region, city } = body as {
      text?: string;
      texts?: string[];
      country?: string;
      region?: string;
      city?: string;
    };

    if (!process.env.DASHSCOPE_API_KEY) {
      return new Response(JSON.stringify({ error: 'DASHSCOPE_API_KEY 未配置' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const list = Array.isArray(texts) ? texts : typeof text === 'string' ? [text] : [];
    if (list.length === 0) {
      return new Response(JSON.stringify({ error: '请提供 text 或 texts' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const geo = [country, region, city].some(Boolean)
      ? { country: country ?? undefined, region: region ?? undefined, city: city ?? undefined }
      : undefined;
    const systemPrompt = buildSystemPrompt(geo);

    const prompt =
      list.length === 1
        ? list[0]
        : list.map((t, i) => `${i + 1}. ${t}`).join('\n') +
          '\n\n请按行输出翻译，每行一个结果，不要编号。';

    const completion = await qwenClient.chat.completions.create({
      model: 'qwen-turbo',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt },
      ],
      stream: false,
    });

    const raw = completion.choices[0]?.message?.content?.trim() ?? '';
    let translated: string[];

    if (list.length === 1) {
      translated = [raw.split('\n')[0].trim() || list[0]];
    } else {
      translated = raw.split('\n').map((line) => line.replace(/^\d+\.\s*/, '').trim());
      while (translated.length < list.length) translated.push(list[translated.length]);
      translated = list.map((orig, i) => translated[i] || orig);
    }

    return new Response(
      JSON.stringify(list.length === 1 ? { translated: translated[0] } : { translated }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Translate API error:', error);
    return new Response(JSON.stringify({ error: '翻译请求失败' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
