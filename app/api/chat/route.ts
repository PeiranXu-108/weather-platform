/**
 * Chat API Route
 *
 * 编排 Qwen 大模型 + Weather Agent + MCP 天气工具，实现 AI 天气助手。
 * 使用 Server-Sent Events (SSE) 实现流式响应。
 */

import { NextRequest } from 'next/server';
import OpenAI from 'openai';
import { runWeatherAgent } from '@/app/lib/agent/weatherAgent';
import type { ChatSSEEvent } from '@/app/components/ChatBot/types';

const qwenClient = new OpenAI({
  apiKey: process.env.DASHSCOPE_API_KEY || '',
  baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
});

function formatSSE(event: ChatSSEEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { messages, userLocation } = body as {
      messages: Array<{ role: string; content: string }>;
      userLocation?: { latitude: number; longitude: number };
    };

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return new Response(JSON.stringify({ error: '消息不能为空' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (!process.env.DASHSCOPE_API_KEY) {
      return new Response(JSON.stringify({ error: 'DASHSCOPE_API_KEY 未配置' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const emit = (event: ChatSSEEvent) => {
          controller.enqueue(encoder.encode(formatSSE(event)));
        };

        try {
          await runWeatherAgent({
            messages,
            userLocation:
              userLocation &&
              typeof userLocation.latitude === 'number' &&
              typeof userLocation.longitude === 'number'
                ? { latitude: userLocation.latitude, longitude: userLocation.longitude }
                : undefined,
            qwenClient,
            emit,
          });

          emit({ type: 'done' });
          controller.close();
        } catch (error) {
          console.error('Chat stream error:', error);
          const errorMsg = error instanceof Error ? error.message : '未知错误';
          emit({
            type: 'error',
            content: `处理请求时出错: ${errorMsg}`,
          });
          emit({ type: 'done' });
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (error) {
    console.error('Chat API error:', error);
    return new Response(JSON.stringify({ error: '请求处理失败' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
