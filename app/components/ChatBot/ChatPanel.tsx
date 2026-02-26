'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import MessageBubble, { type ChatMessage } from './MessageBubble';
import ChatInput from './ChatInput';
import { fetchChat } from '@/app/lib/api';

interface ChatPanelProps {
  isDark: boolean;
  onClose: () => void;
}

// 快捷问题池
const QUICK_QUESTIONS = [
  '北京明天会下雨吗？',
  '上海未来一周天气预报',
  '杭州今天天气怎么样？',
  '深圳未来3天会下雨吗？',
  '成都的紫外线强不强？',
  '广州现在湿度多少？',
  '南京明天适合户外活动吗？',
  '武汉周末天气如何？',
  '西安最近会降温吗？',
  '苏州空气质量怎么样？',
  '厦门海边风大吗？',
  '青岛适合去玩吗？',
];

// 需要定位的快捷问题（当有 userLocation 时加入候选池）
const LOCATION_QUICK_QUESTION = '我这的天气怎么样？';

/** 打乱数组并取前 n 个 */
function shuffleAndPick<T>(arr: T[], n: number): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, Math.min(n, copy.length));
}

// 生成唯一 ID
let msgIdCounter = 0;
function genId() {
  return `msg-${Date.now()}-${++msgIdCounter}`;
}

export default function ChatPanel({ isDark, onClose }: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // 根据 userLocation 是否开启展示快捷问题：开启时「我这的天气怎么样？」一定展示 + 随机 2 个；未开启时随机 2 或 3 个
  // 使用 useState + useEffect 避免 SSR 水合错误（random 在服务端与客户端结果不同）
  const [displayedQuestions, setDisplayedQuestions] = useState<string[]>(() =>
    QUICK_QUESTIONS.slice(0, 3)
  );

  useEffect(() => {
    if (userLocation) {
      const picked = shuffleAndPick(QUICK_QUESTIONS, 2);
      setDisplayedQuestions([LOCATION_QUICK_QUESTION, ...picked]);
    } else {
      const count = Math.random() < 0.5 ? 2 : 3;
      setDisplayedQuestions(shuffleAndPick(QUICK_QUESTIONS, count));
    }
  }, [userLocation]);

  // 获取用户当前位置（打开面板时请求一次）
  useEffect(() => {
    if (!navigator.geolocation) return;

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLocation({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        });
      },
      () => {
        // 用户拒绝或获取失败，静默忽略
      },
      { enableHighAccuracy: false, timeout: 5000, maximumAge: 5 * 60 * 1000 }
    );
  }, []);

  // 自动滚动到底部
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // 发送消息
  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isLoading) return;

    const userMsg: ChatMessage = {
      id: genId(),
      role: 'user',
      content: text.trim(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    // 创建助手消息占位
    const assistantId = genId();
    setMessages((prev) => [
      ...prev,
      { id: assistantId, role: 'assistant', content: '' },
    ]);

    try {
      // 构建发送给 API 的消息历史（不包括当前占位消息）
      const historyMessages = [...messages, userMsg]
        .filter((m) => m.role === 'user' || (m.role === 'assistant' && m.content))
        .map((m) => ({ role: m.role, content: m.content }));

      abortRef.current = new AbortController();

      const response = await fetchChat(historyMessages, {
        userLocation: userLocation ?? undefined,
        signal: abortRef.current.signal,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: '请求失败' }));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      // 读取 SSE 流
      const reader = response.body?.getReader();
      if (!reader) throw new Error('无法读取响应流');

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // 处理 SSE 行
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // 保留未完成的行

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6).trim();
          if (!data) continue;

          try {
            const event = JSON.parse(data);

            switch (event.type) {
              case 'text':
                // 追加文本到当前助手消息
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId
                      ? { ...m, content: m.content + (event.content || '') }
                      : m
                  )
                );
                break;

              case 'tool_start':
                // 添加工具调用指示器
                setMessages((prev) => [
                  ...prev.filter((m) => !(m.role === 'tool' && m.toolName === event.name && m.toolStatus === 'done')),
                  {
                    id: genId(),
                    role: 'tool',
                    content: '',
                    toolName: event.name,
                    toolStatus: 'calling',
                  },
                ]);
                break;

              case 'tool_end':
                // 更新工具状态为完成
                setMessages((prev) =>
                  prev.map((m) =>
                    m.role === 'tool' && m.toolName === event.name && m.toolStatus === 'calling'
                      ? { ...m, toolStatus: 'done' }
                      : m
                  )
                );
                break;

              case 'error':
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId
                      ? { ...m, content: event.content || '抱歉，出现了错误，请稍后再试。' }
                      : m
                  )
                );
                break;

              case 'done':
                break;
            }
          } catch {
            // 忽略解析错误
          }
        }
      }
    } catch (error) {
      if ((error as Error).name === 'AbortError') return;

      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? { ...m, content: `抱歉，请求出现了问题：${(error as Error).message || '未知错误'}。请稍后再试。` }
            : m
        )
      );
    } finally {
      setIsLoading(false);
      abortRef.current = null;
    }
  }, [isLoading, messages, userLocation]);

  const handleSend = useCallback(() => {
    sendMessage(input);
  }, [input, sendMessage]);

  const handleQuickQuestion = useCallback((q: string) => {
    sendMessage(q);
  }, [sendMessage]);

  return (
    <div
      className={`flex flex-col w-full h-full rounded-2xl overflow-hidden border shadow-2xl ${
        isDark
          ? 'border-white/15 bg-gray-900/80 shadow-black/30'
          : 'border-white/50 bg-white/85 shadow-black/10'
      } backdrop-blur-2xl`}
    >
      {/* Header */}
      <div className={`flex items-center justify-between px-4 py-3 border-b ${
        isDark ? 'border-white/10' : 'border-gray-200/50'
      }`}>
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${isDark ? 'bg-green-400' : 'bg-green-500'}`} />
          <h3 className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-gray-800'}`}>
            天气小助手
          </h3>
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
            isDark ? 'bg-sky-500/20 text-sky-300' : 'bg-sky-100 text-sky-600'
          }`}>
            AI
          </span>
        </div>
        <button
          onClick={onClose}
          className={`w-9 h-9 min-w-[44px] min-h-[44px] rounded-lg flex items-center justify-center transition-all active:scale-95 ${
            isDark
              ? 'hover:bg-white/10 text-gray-400 hover:text-white'
              : 'hover:bg-black/5 text-gray-500 hover:text-gray-700'
          }`}
          title="关闭"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
            <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
          </svg>
        </button>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto px-4 py-3 custom-scrollbar">
        {messages.length === 0 ? (
          /* 欢迎界面 */
          <div className="flex flex-col items-center justify-center h-full text-center px-2">
            {/* AI 图标 */}
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-4 ${
              isDark ? 'bg-gray-800/70' : 'bg-gray-200/70'
            }`}>
              <img src="/icons/weather.svg" alt="" className="w-7 h-7" />
            </div>

            <h4 className={`text-base font-semibold mb-1.5 ${isDark ? 'text-white' : 'text-gray-800'}`}>
              你好，我是天气小助手
            </h4>
            <p className={`text-xs mb-5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
              可以帮你查询全球城市的天气信息
            </p>

            {/* 快捷问题 - 根据 userLocation 随机展示 2 或 3 个 */}
            <div className="w-full space-y-2">
              <p className={`text-[10px] font-medium uppercase tracking-wider ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                试试问我
              </p>
              {displayedQuestions.map((q) => (
                <button
                  key={q}
                  onClick={() => handleQuickQuestion(q)}
                  className={`w-full text-left text-xs px-3 py-2.5 rounded-xl transition-all active:scale-[0.98] ${
                    isDark
                      ? 'bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white'
                      : 'bg-black/[0.03] hover:bg-black/[0.06] text-gray-600 hover:text-gray-800'
                  }`}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        ) : (
          /* 消息列表 */
          <>
            {messages.map((msg) => (
              <MessageBubble key={msg.id} message={msg} isDark={isDark} />
            ))}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Input Area */}
      <ChatInput
        value={input}
        onChange={setInput}
        onSend={handleSend}
        isLoading={isLoading}
        isDark={isDark}
      />
    </div>
  );
}
