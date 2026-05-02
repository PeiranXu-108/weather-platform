/**
 * Chat API Route
 *
 * 编排 Qwen 大模型 + Weather Agent + MCP 天气工具，实现 AI 天气助手。
 * 使用 Server-Sent Events (SSE) 实现流式响应。
 */

import { NextRequest } from 'next/server';
import OpenAI from 'openai';
import { runWeatherAgent } from '@/app/lib/agent/weatherAgent';
import { createAbortError, isAbortError } from '@/app/lib/abort';
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
    const { messages, userLocation, locale } = body as {
      messages: Array<{ role: string; content: string }>;
      locale?: 'zh' | 'en';
      userLocation?: { latitude: number; longitude: number };
    };
    const responseLocale = locale === 'en' ? 'en' : 'zh';

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return new Response(JSON.stringify({ error: responseLocale === 'en' ? 'Messages cannot be empty' : '消息不能为空' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (!process.env.DASHSCOPE_API_KEY) {
      return new Response(JSON.stringify({ error: responseLocale === 'en' ? 'DASHSCOPE_API_KEY is not configured' : 'DASHSCOPE_API_KEY 未配置' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const encoder = new TextEncoder();
    const abortController = new AbortController();
    const abortFromRequest = () => {
      abortController.abort(request.signal.reason ?? createAbortError());
    };

    if (request.signal.aborted) {
      abortFromRequest();
    } else {
      request.signal.addEventListener('abort', abortFromRequest, { once: true });
    }

    const stream = new ReadableStream({
      async start(controller) {
        let closed = false;
        const close = () => {
          if (closed) return;
          closed = true;
          try {
            controller.close();
          } catch {
            // The client may have already closed the stream.
          }
        };

        const emit = (event: ChatSSEEvent) => {
          if (closed || abortController.signal.aborted) return;
          try {
            controller.enqueue(encoder.encode(formatSSE(event)));
          } catch (error) {
            closed = true;
            abortController.abort(error);
          }
        };

        try {
          await runWeatherAgent({
            messages,
            locale: responseLocale,
            userLocation:
              userLocation &&
              typeof userLocation.latitude === 'number' &&
              typeof userLocation.longitude === 'number'
                ? { latitude: userLocation.latitude, longitude: userLocation.longitude }
                : undefined,
            qwenClient,
            emit,
            signal: abortController.signal,
          });

          emit({ type: 'done' });
          close();
        } catch (error) {
          if (isAbortError(error) || abortController.signal.aborted) {
            close();
            return;
          }

          console.error('Chat stream error:', error);
          const errorMsg = error instanceof Error ? error.message : (responseLocale === 'en' ? 'Unknown error' : '未知错误');
          emit({
            type: 'error',
            content: responseLocale === 'en'
              ? `An error occurred while processing the request: ${errorMsg}`
              : `处理请求时出错: ${errorMsg}`,
          });
          emit({ type: 'done' });
          close();
        } finally {
          request.signal.removeEventListener('abort', abortFromRequest);
        }
      },
      cancel(reason) {
        if (!abortController.signal.aborted) {
          abortController.abort(reason ?? createAbortError());
        }
        request.signal.removeEventListener('abort', abortFromRequest);
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
