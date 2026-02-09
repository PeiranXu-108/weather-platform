'use client';

import React, { useRef, useEffect } from 'react';

interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  isLoading: boolean;
  isDark: boolean;
}

export default function ChatInput({ value, onChange, onSend, isLoading, isDark }: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // 自动调整 textarea 高度
  useEffect(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = 'auto';
      el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
    }
  }, [value]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!isLoading && value.trim()) {
        onSend();
      }
    }
  };

  return (
    <div className={`flex items-end gap-2 p-3 border-t ${
      isDark ? 'border-white/10' : 'border-gray-200/50'
    }`}>
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="输入你的天气问题..."
        rows={1}
        disabled={isLoading}
        className={`flex-1 resize-none rounded-xl px-3 py-2 text-sm outline-none transition-all ${
          isDark
            ? 'bg-white/10 text-white placeholder-gray-400 focus:bg-white/15 focus:ring-1 focus:ring-sky-400/50'
            : 'bg-black/5 text-gray-900 placeholder-gray-500 focus:bg-black/10 focus:ring-1 focus:ring-sky-400/50'
        } ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
        style={{ maxHeight: '120px' }}
      />
      <button
        onClick={onSend}
        disabled={isLoading || !value.trim()}
        className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center transition-all active:scale-95 ${
          isLoading || !value.trim()
            ? isDark
              ? 'bg-white/5 text-gray-500 cursor-not-allowed'
              : 'bg-gray-100 text-gray-400 cursor-not-allowed'
            : isDark
              ? 'bg-sky-500 hover:bg-sky-400 text-white shadow-lg shadow-sky-500/20'
              : 'bg-sky-500 hover:bg-sky-600 text-white shadow-lg shadow-sky-200'
        }`}
        title="发送"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
          <path d="M3.105 2.288a.75.75 0 0 0-.826.95l1.414 4.926A1.5 1.5 0 0 0 5.135 9.25h6.115a.75.75 0 0 1 0 1.5H5.135a1.5 1.5 0 0 0-1.442 1.086l-1.414 4.926a.75.75 0 0 0 .826.95 28.897 28.897 0 0 0 15.293-7.155.75.75 0 0 0 0-1.114A28.897 28.897 0 0 0 3.105 2.288Z" />
        </svg>
      </button>
    </div>
  );
}
