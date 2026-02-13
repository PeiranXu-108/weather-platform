/**
 * Chat API Route
 * 
 * 编排 Qwen 大模型 + MCP 天气工具，实现 AI 天气助手。
 * 使用 Server-Sent Events (SSE) 实现流式响应。
 * 
 * 流程：
 * 1. 接收用户消息
 * 2. 创建 MCP Client，获取工具列表
 * 3. 调用 Qwen API (OpenAI 兼容)，带 tools
 * 4. 处理 tool_calls → MCP 工具执行 → 再调 Qwen
 * 5. 流式返回最终回复
 */

import { NextRequest } from 'next/server';
import OpenAI from 'openai';
import { createMcpClient, mcpToolsToOpenAITools } from '@/app/lib/mcp/createMcpClient';

// Qwen 使用 OpenAI 兼容接口
const qwenClient = new OpenAI({
  apiKey: process.env.DASHSCOPE_API_KEY || '',
  baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
});

const SYSTEM_PROMPT_BASE = `你是一个专业的天气助手，名叫"天气小助手"。你可以帮用户查询全球城市的实时天气、未来天气预报等信息。

请遵循以下规则：
1. 使用提供的工具获取天气数据，然后用简洁友好的方式回答用户
2. 温度使用摄氏度，使用中文回复
3. 回答时适当使用天气相关的 emoji 让回复更生动
4. 如果用户询问的城市不明确，可以先使用搜索工具确认
5. 如果用户只是闲聊或问好，友好地回应并引导他们查询天气
6. 不要在回复中展示原始 JSON 数据，而是用自然语言描述天气情况
7. 如果工具调用失败，友好地告知用户并建议重试`;

function buildSystemPrompt(userLocation?: { latitude: number; longitude: number }): string {
  let prompt = SYSTEM_PROMPT_BASE;

  if (userLocation) {
    prompt += `

【重要】用户已授权分享其当前位置：
- 纬度：${userLocation.latitude}
- 经度：${userLocation.longitude}

当用户询问"我这的天气"、"这里的天气"、"当前位置天气"、"我所在地的天气"、"查一下我这"等类似问题时，请调用 get_weather_at_my_location 工具，并传入上述经纬度。`;
  }

  return prompt;
}

// SSE 事件类型
interface SSEEvent {
  type: 'text' | 'tool_start' | 'tool_end' | 'error' | 'done';
  content?: string;
  name?: string;
  args?: Record<string, unknown>;
}

function formatSSE(event: SSEEvent): string {
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

    // 创建 SSE 流
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // 1. 创建 MCP Client 并获取工具
          const mcpClient = await createMcpClient();
          const { tools: mcpTools } = await mcpClient.listTools();
          const openaiTools = mcpToolsToOpenAITools(mcpTools);

          // 2. 构建消息历史
          const systemPrompt = buildSystemPrompt(
            userLocation &&
            typeof userLocation.latitude === 'number' &&
            typeof userLocation.longitude === 'number'
              ? { latitude: userLocation.latitude, longitude: userLocation.longitude }
              : undefined
          );

          const allMessages: OpenAI.ChatCompletionMessageParam[] = [
            { role: 'system', content: systemPrompt },
            ...messages.map((m) => ({
              role: m.role as 'user' | 'assistant',
              content: m.content,
            })),
          ];

          // 3. 工具调用循环（最多3轮工具调用）
          let toolCallRound = 0;
          const MAX_TOOL_ROUNDS = 3;

          while (toolCallRound < MAX_TOOL_ROUNDS) {
            // 调用 Qwen (非流式，用于检测 tool_calls)
            const completion = await qwenClient.chat.completions.create({
              model: 'qwen-plus',
              messages: allMessages,
              tools: openaiTools as OpenAI.ChatCompletionTool[],
              stream: false,
            });

            const choice = completion.choices[0];
            const responseMessage = choice.message;

            // 如果没有工具调用，进入流式生成最终回复
            if (!responseMessage.tool_calls || responseMessage.tool_calls.length === 0) {
              // 如果已经有内容（非工具回复），直接发送
              if (responseMessage.content) {
                controller.enqueue(encoder.encode(formatSSE({
                  type: 'text',
                  content: responseMessage.content,
                })));
                controller.enqueue(encoder.encode(formatSSE({ type: 'done' })));
                controller.close();
                await mcpClient.close();
                return;
              }
              break;
            }

            // 有工具调用 → 执行工具
            allMessages.push({
              role: 'assistant',
              content: responseMessage.content || null,
              tool_calls: responseMessage.tool_calls,
            } as OpenAI.ChatCompletionMessageParam);

            for (const toolCall of responseMessage.tool_calls) {
              // 仅处理 function 类型的工具调用
              if (toolCall.type !== 'function') continue;
              const fnToolCall = toolCall as OpenAI.Chat.Completions.ChatCompletionMessageFunctionToolCall;
              const toolName = fnToolCall.function.name;
              const toolArgs = JSON.parse(fnToolCall.function.arguments);

              // 通知前端工具开始执行
              controller.enqueue(encoder.encode(formatSSE({
                type: 'tool_start',
                name: toolName,
                args: toolArgs,
              })));

              // 通过 MCP Client 调用工具
              try {
                const result = await mcpClient.callTool({
                  name: toolName,
                  arguments: toolArgs,
                });

                const toolResultText = (result.content as Array<{ type: string; text: string }>)
                  .filter((c) => c.type === 'text')
                  .map((c) => c.text)
                  .join('\n');

                // 将工具结果追加到消息
                allMessages.push({
                  role: 'tool',
                  content: toolResultText,
                  tool_call_id: toolCall.id,
                } as OpenAI.ChatCompletionMessageParam);
              } catch (toolError) {
                const errorMsg = toolError instanceof Error ? toolError.message : '工具调用失败';
                allMessages.push({
                  role: 'tool',
                  content: `工具调用失败: ${errorMsg}`,
                  tool_call_id: toolCall.id,
                } as OpenAI.ChatCompletionMessageParam);
              }

              // 通知前端工具执行结束
              controller.enqueue(encoder.encode(formatSSE({
                type: 'tool_end',
                name: toolName,
              })));
            }

            toolCallRound++;
          }

          // 4. 最终流式生成回复
          const finalStream = await qwenClient.chat.completions.create({
            model: 'qwen-plus',
            messages: allMessages,
            stream: true,
          });

          for await (const chunk of finalStream) {
            const delta = chunk.choices[0]?.delta;
            if (delta?.content) {
              controller.enqueue(encoder.encode(formatSSE({
                type: 'text',
                content: delta.content,
              })));
            }
          }

          controller.enqueue(encoder.encode(formatSSE({ type: 'done' })));
          controller.close();
          await mcpClient.close();
        } catch (error) {
          console.error('Chat stream error:', error);
          const errorMsg = error instanceof Error ? error.message : '未知错误';
          controller.enqueue(encoder.encode(formatSSE({
            type: 'error',
            content: `处理请求时出错: ${errorMsg}`,
          })));
          controller.enqueue(encoder.encode(formatSSE({ type: 'done' })));
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
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
