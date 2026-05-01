import OpenAI from 'openai';
import { createMcpClient, mcpToolsToOpenAITools } from '@/app/lib/mcp/createMcpClient';
import { isAbortError, throwIfAborted } from '@/app/lib/abort';
import {
  WEATHER_ASSISTANT_SCHEMA_VERSION,
  type ChatSSEEvent,
  type WeatherAssistantPanel,
  type WeatherErrorPanel,
} from '@/app/components/ChatBot/types';
import { AREA_CONDITION_SUMMARY_PROMPT, buildSystemPrompt } from './prompts';
import type { AgentEmit, AreaConditionIntent, WeatherConditionIntent } from './types';

interface RunWeatherAgentOptions {
  messages: Array<{ role: string; content: string }>;
  userLocation?: { latitude: number; longitude: number };
  qwenClient: OpenAI;
  emit: AgentEmit;
  signal?: AbortSignal;
}

const QWEN_NON_STREAM_TIMEOUT_MS = 30_000;
const QWEN_STREAM_TIMEOUT_MS = 60_000;
const FOLLOWUP_QUESTIONS_PROMPT = `你是天气助手的推荐问题生成器。
根据用户与助手的历史对话，以及助手刚刚给出的回答，生成 1-3 个用户最可能继续追问的问题。
要求：
- 只输出 JSON 数组，例如 ["明天还会下雨吗？","周末适合户外活动吗？"]
- 问题必须简短、自然、可点击后直接发送
- 优先围绕当前地点、时间、天气风险、穿衣、出行、未来趋势继续追问
- 不要重复用户刚问过的问题，不要输出解释文字`;

const MAX_CONDITION_SEARCH_LIMIT = 300;
const configuredConditionSearchLimit = Number(process.env.WEATHER_CONDITION_SEARCH_LIMIT);
const DEFAULT_CONDITION_SEARCH_LIMIT = Number.isFinite(configuredConditionSearchLimit)
  ? Math.min(MAX_CONDITION_SEARCH_LIMIT, Math.max(1, Math.round(configuredConditionSearchLimit)))
  : 150;

const CONDITION_PHRASES: Record<WeatherConditionIntent, string> = {
  snow: '下雪',
  rain: '下雨',
  hot: '高温',
  cold: '低温',
  wind: '大风',
  clear: '晴好',
  cloudy: '多云',
  overcast: '阴天',
  fog: '有雾',
  haze: '有霾',
  thunder: '雷雨',
  humid: '潮湿',
  dry: '干燥',
  comfortable: '舒适宜出行',
  adverse: '天气较差',
};

const PROVINCES = [
  '北京', '天津', '上海', '重庆', '河北', '山西', '辽宁', '吉林', '黑龙江', '江苏', '浙江', '安徽',
  '福建', '江西', '山东', '河南', '湖北', '湖南', '广东', '海南', '四川', '贵州', '云南', '陕西',
  '甘肃', '青海', '台湾', '内蒙古', '广西', '西藏', '宁夏', '新疆', '香港', '澳门',
];

function buildErrorPanel(title: string, message: string, toolName?: string): WeatherErrorPanel {
  return {
    schemaVersion: WEATHER_ASSISTANT_SCHEMA_VERSION,
    id: `error-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    kind: 'error',
    title,
    message,
    toolName,
  };
}

function isWeatherAssistantPanel(value: unknown): value is WeatherAssistantPanel {
  if (!value || typeof value !== 'object') return false;
  const panel = value as Partial<WeatherAssistantPanel>;
  return panel.schemaVersion === WEATHER_ASSISTANT_SCHEMA_VERSION && typeof panel.kind === 'string';
}

function parseWeatherPanel(text: string): WeatherAssistantPanel | null {
  try {
    const parsed = JSON.parse(text);
    return isWeatherAssistantPanel(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function latestUserMessage(messages: Array<{ role: string; content: string }>): string {
  return [...messages].reverse().find((message) => message.role === 'user')?.content ?? '';
}

function parseFollowupQuestions(text: string): string[] {
  const trimmed = text.trim();
  const jsonText = trimmed.match(/\[[\s\S]*\]/)?.[0] ?? trimmed;

  try {
    const parsed = JSON.parse(jsonText);
    if (!Array.isArray(parsed)) return [];

    const seen = new Set<string>();
    return parsed
      .filter((item): item is string => typeof item === 'string')
      .map((item) => item.trim())
      .filter((item) => item.length > 0 && item.length <= 40)
      .filter((item) => {
        if (seen.has(item)) return false;
        seen.add(item);
        return true;
      })
      .slice(0, 3);
  } catch {
    return [];
  }
}

async function generateFollowupQuestions(
  qwenClient: OpenAI,
  messages: Array<{ role: string; content: string }>,
  assistantAnswer: string,
  signal?: AbortSignal
): Promise<string[]> {
  if (!assistantAnswer.trim()) return [];

  throwIfAborted(signal);
  const recentMessages = messages.slice(-8);
  const completion = await qwenClient.chat.completions.create({
    model: 'qwen-plus',
    messages: [
      { role: 'system', content: FOLLOWUP_QUESTIONS_PROMPT },
      {
        role: 'user',
        content: JSON.stringify({
          history: recentMessages,
          assistantAnswer,
        }),
      },
    ],
    stream: false,
  }, {
    signal,
    timeout: QWEN_NON_STREAM_TIMEOUT_MS,
  });

  return parseFollowupQuestions(completion.choices[0]?.message?.content ?? '');
}

async function emitFollowupQuestions(
  options: RunWeatherAgentOptions,
  assistantAnswer: string
) {
  try {
    const questions = await generateFollowupQuestions(
      options.qwenClient,
      options.messages,
      assistantAnswer,
      options.signal
    );

    if (questions.length > 0) {
      options.emit({ type: 'followup_questions', questions });
    }
  } catch (error) {
    if (isAbortError(error) || options.signal?.aborted) throw error;
    console.warn('Failed to generate follow-up questions:', error);
  }
}

function detectCondition(text: string): WeatherConditionIntent | null {
  if (/(天气好|好天气|适合出门|适合户外|适合玩|舒适|舒服|宜人|comfortable|pleasant)/i.test(text)) return 'comfortable';
  if (/(恶劣|糟糕|不好|不适合出门|天气差|坏天气|bad weather|severe|adverse)/i.test(text)) return 'adverse';
  if (/(雷|雷雨|雷阵雨|雷暴|thunder|storm)/i.test(text)) return 'thunder';
  if (/(雪|降雪|下雪|snow|sleet|blizzard)/i.test(text)) return 'snow';
  if (/(雨|降雨|下雨|暴雨|rain|shower|drizzle)/i.test(text)) return 'rain';
  if (/(雾|大雾|有雾|fog|mist)/i.test(text)) return 'fog';
  if (/(霾|雾霾|空气差|沙尘|haze|smog|dust)/i.test(text)) return 'haze';
  if (/(天晴|晴天|晴朗|晴好|sunny|clear)/i.test(text)) return 'clear';
  if (/(多云|少云|云多|cloudy|partly cloudy|mostly cloudy)/i.test(text)) return 'cloudy';
  if (/(阴天|阴沉|阴云|overcast)/i.test(text)) return 'overcast';
  if (/(潮湿|湿度大|湿热|闷热|humid|muggy)/i.test(text)) return 'humid';
  if (/(干燥|太干|dry)/i.test(text)) return 'dry';
  if (/(高温|炎热|酷热|很热|哪里热|hot)/i.test(text)) return 'hot';
  if (/(低温|寒冷|严寒|很冷|哪里冷|cold|freezing)/i.test(text)) return 'cold';
  if (/(大风|风大|强风|windy|gale)/i.test(text)) return 'wind';
  return null;
}

function detectProvince(text: string): string | undefined {
  return PROVINCES.find((province) => text.includes(province));
}

function detectAreaConditionIntent(text: string): AreaConditionIntent | null {
  const condition = detectCondition(text);
  if (!condition) return null;

  const asksForArea =
    /(哪里|哪儿|哪些|什么地方|哪些地方|有没有|正在|在下|在刮|全国|中国)/.test(text) ||
    /where|which/i.test(text);

  if (!asksForArea) return null;

  const province = detectProvince(text);
  const hasChinaScope = /(中国|全国|国内|我国)/.test(text);
  if (!province && !hasChinaScope) return null;

  return {
    taskType: 'area_condition_search',
    condition,
    scope: province ? 'province' : 'china',
    province,
    phrase: CONDITION_PHRASES[condition],
  };
}

function emitEvent(emit: AgentEmit, event: ChatSSEEvent) {
  emit(event);
}

async function summarizeAreaConditionResult(
  qwenClient: OpenAI,
  userMessage: string,
  toolResultText: string,
  signal?: AbortSignal
): Promise<string> {
  throwIfAborted(signal);
  const completion = await qwenClient.chat.completions.create({
    model: 'qwen-plus',
    messages: [
      { role: 'system', content: AREA_CONDITION_SUMMARY_PROMPT },
      {
        role: 'user',
        content: `用户问题：${userMessage}\n\n工具结果：${toolResultText}`,
      },
    ],
    stream: false,
  }, {
    signal,
    timeout: QWEN_NON_STREAM_TIMEOUT_MS,
  });

  return completion.choices[0]?.message?.content || '已完成区域天气检索，详细结果见面板。';
}

async function runAreaConditionSearch(
  options: RunWeatherAgentOptions,
  intent: AreaConditionIntent
) {
  throwIfAborted(options.signal);
  const mcpClient = await createMcpClient({ signal: options.signal });
  const userMessage = latestUserMessage(options.messages);
  const scopeLabel = intent.scope === 'province' && intent.province ? intent.province : '全国主要城市';
  const toolName = 'search_weather_by_condition';

  try {
    throwIfAborted(options.signal);
    emitEvent(options.emit, {
      type: 'agent_plan',
      content: `识别为区域天气检索：扫描${scopeLabel}，筛选正在${intent.phrase}的地点。`,
    });
    emitEvent(options.emit, {
      type: 'agent_step',
      title: '检索候选城市并批量查询实时天气',
      toolName,
      status: 'running',
    });

    const result = await mcpClient.callTool({
      name: toolName,
      arguments: {
        scope: intent.scope,
        province: intent.province,
        condition: intent.condition,
        limit: DEFAULT_CONDITION_SEARCH_LIMIT,
      },
    }, undefined, { signal: options.signal });
    throwIfAborted(options.signal);

    const toolResultText = (result.content as Array<{ type: string; text: string }>)
      .filter((content) => content.type === 'text')
      .map((content) => content.text)
      .join('\n');

    const panel = parseWeatherPanel(toolResultText);
    if (panel) {
      options.emit({ type: 'panel', panel });
      if (panel.kind === 'condition_search') {
        options.emit({
          type: 'agent_observation',
          content: `已检查 ${panel.checkedCount} 个城市，发现 ${panel.matchedLocations.length} 个匹配地点。`,
        });
      }
    }

    const summary = await summarizeAreaConditionResult(
      options.qwenClient,
      userMessage,
      toolResultText,
      options.signal
    );
    throwIfAborted(options.signal);
    options.emit({ type: 'text', content: summary });
    await emitFollowupQuestions(options, summary);
    options.emit({
      type: 'agent_step',
      title: '区域天气检索完成',
      toolName,
      status: 'done',
    });
  } catch (error) {
    if (isAbortError(error) || options.signal?.aborted) throw error;
    const errorMsg = error instanceof Error ? error.message : '区域天气检索失败';
    options.emit({
      type: 'panel',
      panel: buildErrorPanel('区域天气检索失败', errorMsg, toolName),
    });
    options.emit({ type: 'text', content: `区域天气检索失败：${errorMsg}` });
    options.emit({
      type: 'agent_step',
      title: '区域天气检索失败',
      toolName,
      status: 'done',
    });
  } finally {
    await mcpClient.close();
  }
}

async function runToolCallingChat(options: RunWeatherAgentOptions) {
  throwIfAborted(options.signal);
  const mcpClient = await createMcpClient({ signal: options.signal });

  try {
    const { tools: mcpTools } = await mcpClient.listTools(undefined, { signal: options.signal });
    const openaiTools = mcpToolsToOpenAITools(mcpTools);
    const systemPrompt = buildSystemPrompt(options.userLocation);
    const allMessages: OpenAI.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
      ...options.messages.map((message) => ({
        role: message.role as 'user' | 'assistant',
        content: message.content,
      })),
    ];

    let toolCallRound = 0;
    const maxToolRounds = 5;

    while (toolCallRound < maxToolRounds) {
      throwIfAborted(options.signal);
      const completion = await options.qwenClient.chat.completions.create({
        model: 'qwen-plus',
        messages: allMessages,
        tools: openaiTools as OpenAI.ChatCompletionTool[],
        stream: false,
      }, {
        signal: options.signal,
        timeout: QWEN_NON_STREAM_TIMEOUT_MS,
      });

      throwIfAborted(options.signal);
      const responseMessage = completion.choices[0]?.message;
      if (!responseMessage) break;

      if (!responseMessage.tool_calls || responseMessage.tool_calls.length === 0) {
        if (responseMessage.content) {
          options.emit({ type: 'text', content: responseMessage.content });
          await emitFollowupQuestions(options, responseMessage.content);
          return;
        }
        break;
      }

      allMessages.push({
        role: 'assistant',
        content: responseMessage.content || null,
        tool_calls: responseMessage.tool_calls,
      } as OpenAI.ChatCompletionMessageParam);

      for (const toolCall of responseMessage.tool_calls) {
        throwIfAborted(options.signal);
        if (toolCall.type !== 'function') continue;
        const fnToolCall = toolCall as OpenAI.Chat.Completions.ChatCompletionMessageFunctionToolCall;
        const toolName = fnToolCall.function.name;
        let toolArgs: Record<string, unknown> = {};

        try {
          toolArgs = JSON.parse(fnToolCall.function.arguments || '{}');
        } catch {
          toolArgs = {};
        }

        options.emit({ type: 'tool_start', name: toolName, args: toolArgs });

        try {
          const result = await mcpClient.callTool({
            name: toolName,
            arguments: toolArgs,
          }, undefined, { signal: options.signal });
          throwIfAborted(options.signal);
          const toolResultText = (result.content as Array<{ type: string; text: string }>)
            .filter((content) => content.type === 'text')
            .map((content) => content.text)
            .join('\n');

          const panel = parseWeatherPanel(toolResultText);
          if (panel) {
            options.emit({ type: 'panel', panel });
          }

          allMessages.push({
            role: 'tool',
            content: toolResultText,
            tool_call_id: toolCall.id,
          } as OpenAI.ChatCompletionMessageParam);
        } catch (toolError) {
          if (isAbortError(toolError) || options.signal?.aborted) throw toolError;
          const errorMsg = toolError instanceof Error ? toolError.message : '工具调用失败';
          const panel = buildErrorPanel('工具调用失败', errorMsg, toolName);
          options.emit({ type: 'panel', panel });
          allMessages.push({
            role: 'tool',
            content: JSON.stringify(panel),
            tool_call_id: toolCall.id,
          } as OpenAI.ChatCompletionMessageParam);
        }

        options.emit({ type: 'tool_end', name: toolName });
      }

      toolCallRound++;
    }

    const finalStream = await options.qwenClient.chat.completions.create({
      model: 'qwen-plus',
      messages: allMessages,
      stream: true,
    }, {
      signal: options.signal,
      timeout: QWEN_STREAM_TIMEOUT_MS,
    });

    let assistantAnswer = '';
    for await (const chunk of finalStream) {
      throwIfAborted(options.signal);
      const delta = chunk.choices[0]?.delta;
      if (delta?.content) {
        assistantAnswer += delta.content;
        options.emit({ type: 'text', content: delta.content });
      }
    }

    await emitFollowupQuestions(options, assistantAnswer);
  } finally {
    await mcpClient.close();
  }
}

export async function runWeatherAgent(options: RunWeatherAgentOptions) {
  throwIfAborted(options.signal);
  const userMessage = latestUserMessage(options.messages);
  const areaConditionIntent = detectAreaConditionIntent(userMessage);

  if (areaConditionIntent) {
    await runAreaConditionSearch(options, areaConditionIntent);
    return;
  }

  await runToolCallingChat(options);
}
