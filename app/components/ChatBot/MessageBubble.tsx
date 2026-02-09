'use client';

import React from 'react';
import ReactMarkdown from 'react-markdown';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'tool';
  content: string;
  toolName?: string;
  toolStatus?: 'calling' | 'done';
}

interface MessageBubbleProps {
  message: ChatMessage;
  isDark: boolean;
}

// 工具名称映射为中文
const TOOL_NAME_MAP: Record<string, string> = {
  get_current_weather: '实时天气',
  get_forecast_30d: '30天预报',
  search_city: '城市搜索',
};

function ToolCallIndicator({ toolName, status, isDark }: { toolName: string; status: 'calling' | 'done'; isDark: boolean }) {
  const displayName = TOOL_NAME_MAP[toolName] || toolName;
  const isCalling = status === 'calling';

  return (
    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium ${
      isDark
        ? 'bg-sky-500/20 text-sky-300'
        : 'bg-sky-50 text-sky-600'
    }`}>
      {isCalling ? (
        <>
          <svg className="w-3 h-3 animate-spin" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="2" strokeDasharray="28" strokeDashoffset="8" strokeLinecap="round" />
          </svg>
          <span>正在查询{displayName}...</span>
        </>
      ) : (
        <>
          <svg className="w-3 h-3" viewBox="0 0 16 16" fill="currentColor">
            <path fillRule="evenodd" d="M8 15A7 7 0 1 0 8 1a7 7 0 0 0 0 14Zm3.844-8.791a.75.75 0 0 0-1.188-.918l-3.7 4.79-1.649-1.833a.75.75 0 1 0-1.114 1.004l2.25 2.5a.75.75 0 0 0 1.15-.043l4.25-5.5Z" clipRule="evenodd" />
          </svg>
          <span>{displayName}查询完成</span>
        </>
      )}
    </div>
  );
}

export default function MessageBubble({ message, isDark }: MessageBubbleProps) {
  const isUser = message.role === 'user';
  const isTool = message.role === 'tool';

  // 工具状态指示器
  if (isTool && message.toolName) {
    return (
      <div className="flex justify-start mb-2">
        <ToolCallIndicator
          toolName={message.toolName}
          status={message.toolStatus || 'done'}
          isDark={isDark}
        />
      </div>
    );
  }

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-3`}>
      <div
        className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
          isUser
            ? 'bg-sky-500 text-white rounded-br-md'
            : isDark
              ? 'bg-white/10 text-white/90 rounded-bl-md'
              : 'bg-black/5 text-gray-800 rounded-bl-md'
        }`}
      >
        {/* 使用 ReactMarkdown 渲染 Markdown 格式 */}
        <ReactMarkdown
          components={{
            // 段落 - 减少默认间距
            p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
            
            // 行内代码
            code: ({ children, className }) => {
              // 检查是否为代码块（有 language- 前缀）
              const isCodeBlock = className?.startsWith('language-');
              
              if (isCodeBlock) {
                // 代码块
                return (
                  <pre
                    className={`my-2 p-2.5 rounded-lg overflow-x-auto text-xs ${
                      isUser
                        ? 'bg-white/15 text-white'
                        : isDark
                          ? 'bg-black/30 text-gray-100'
                          : 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    <code>{children}</code>
                  </pre>
                );
              }
              
              // 行内代码
              return (
                <code
                  className={`px-1.5 py-0.5 rounded font-mono ${
                    isUser
                      ? 'bg-white/20 text-white'
                      : isDark
                        ? 'bg-white/10 text-gray-100'
                        : 'bg-gray-200 text-gray-800'
                  }`}
                >
                  {children}
                </code>
              );
            },
            
            // 预格式化文本（代码块的包裹层）
            pre: ({ children }) => <>{children}</>,
            
            // 无序列表
            ul: ({ children }) => (
              <ul className="list-disc list-inside mb-2 space-y-1 last:mb-0">
                {children}
              </ul>
            ),
            
            // 有序列表
            ol: ({ children }) => (
              <ol className="list-decimal list-inside mb-2 space-y-1 last:mb-0">
                {children}
              </ol>
            ),
            
            // 列表项
            li: ({ children }) => <li className="leading-relaxed">{children}</li>,
            
            // 链接
            a: ({ children, href }) => (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className={`underline underline-offset-2 hover:opacity-80 transition-opacity ${
                  isUser
                    ? 'text-white font-medium'
                    : isDark
                      ? 'text-sky-300'
                      : 'text-sky-600'
                }`}
              >
                {children}
              </a>
            ),
            
            // 加粗
            strong: ({ children }) => (
              <strong className="font-bold">{children}</strong>
            ),
            
            // 斜体
            em: ({ children }) => <em className="italic">{children}</em>,
            
            // 删除线
            del: ({ children }) => (
              <del className="line-through opacity-75">{children}</del>
            ),
            
            // 标题（在聊天场景中使用较小的尺寸）
            h1: ({ children }) => (
              <h1 className="text-base font-bold mb-1.5 mt-2 first:mt-0">
                {children}
              </h1>
            ),
            h2: ({ children }) => (
              <h2 className="text-base font-bold mb-1.5 mt-2 first:mt-0">
                {children}
              </h2>
            ),
            h3: ({ children }) => (
              <h3 className="text-sm font-bold mb-1 mt-1.5 first:mt-0">
                {children}
              </h3>
            ),
            
            // 引用块
            blockquote: ({ children }) => (
              <blockquote
                className={`border-l-2 pl-3 py-1 my-2 italic ${
                  isUser
                    ? 'border-white/40'
                    : isDark
                      ? 'border-white/30'
                      : 'border-gray-400'
                }`}
              >
                {children}
              </blockquote>
            ),
            
            // 水平分割线
            hr: () => (
              <hr
                className={`my-3 border-t ${
                  isUser
                    ? 'border-white/30'
                    : isDark
                      ? 'border-white/20'
                      : 'border-gray-300'
                }`}
              />
            ),
            
            // 表格
            table: ({ children }) => (
              <div className="overflow-x-auto my-2">
                <table className="min-w-full text-xs border-collapse">
                  {children}
                </table>
              </div>
            ),
            thead: ({ children }) => (
              <thead
                className={`${
                  isUser
                    ? 'bg-white/10'
                    : isDark
                      ? 'bg-white/5'
                      : 'bg-gray-100'
                }`}
              >
                {children}
              </thead>
            ),
            th: ({ children }) => (
              <th className="px-2 py-1 text-left font-semibold border border-current/20">
                {children}
              </th>
            ),
            td: ({ children }) => (
              <td className="px-2 py-1 border border-current/20">
                {children}
              </td>
            ),
          }}
        >
          {message.content}
        </ReactMarkdown>
        
        {/* 助手消息流式加载时的闪烁光标 */}
        {!isUser && message.content === '' && (
          <span className="inline-block w-1.5 h-4 bg-current animate-pulse rounded-sm" />
        )}
      </div>
    </div>
  );
}
