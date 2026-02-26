'use client';

import React, { useState, useRef, useEffect } from 'react';
import type { TextColorTheme } from '@/app/utils/textColorTheme';
import ChatPanel from './ChatPanel';

interface ChatBotProps {
  textColorTheme: TextColorTheme;
}

export default function ChatBot({ textColorTheme }: ChatBotProps) {
  const [isOpen, setIsOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const isDark = textColorTheme.backgroundType === 'dark';

  // 点击外部关闭
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    // 延迟绑定，避免点击按钮时触发
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 100);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  return (
    <>
      {/* 对话面板 */}
      <div
        ref={panelRef}
        className={`fixed right-4 md:right-6 z-[90] transition-all duration-300 ease-out ${
          isOpen
            ? 'opacity-100 translate-y-0 scale-100 pointer-events-auto'
            : 'opacity-0 translate-y-4 scale-95 pointer-events-none'
        }`}
        style={{
          width: 'min(380px, calc(100vw - 2rem))',
          height: 'min(520px, calc(100vh - 2rem))',
          bottom: 'max(6rem, calc(env(safe-area-inset-bottom, 0px) + 4rem))',
        }}
      >
        <ChatPanel isDark={isDark} onClose={() => setIsOpen(false)} />
      </div>

      {/* 悬浮按钮 */}
      <button
        ref={buttonRef}
        onClick={() => setIsOpen((prev) => !prev)}
        className={`fixed right-4 md:right-6 z-[90] w-14 h-14 rounded-full flex items-center justify-center transition-all duration-300 active:scale-90 shadow-xl ${
          isOpen
            ? isDark
              ? 'bg-white/20 hover:bg-white/30 text-white shadow-black/20 ring-1 ring-white/20'
              : 'bg-sky-500 hover:bg-sky-600 text-white shadow-sky-300/40'
            : isDark
              ? 'bg-sky-500/80 hover:bg-sky-500 text-white shadow-sky-500/30 hover:shadow-sky-500/50'
              : 'bg-sky-500 hover:bg-sky-600 text-white shadow-sky-300/50 hover:shadow-sky-300/70'
        }`}
        style={{ bottom: 'max(1.5rem, env(safe-area-inset-bottom, 0px))' }}
        title={isOpen ? '关闭天气助手' : '打开天气助手'}
      >
        {isOpen ? (
          /* 关闭图标 */
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
            <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
          </svg>
        ) : (
          /* 天气+对话图标 */
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
            <path fillRule="evenodd" d="M4.848 2.771A49.144 49.144 0 0 1 12 2.25c2.43 0 4.817.178 7.152.52a1.595 1.595 0 0 1 1.348 1.58v7.95a1.595 1.595 0 0 1-1.348 1.58 49.144 49.144 0 0 1-7.152.52 49.144 49.144 0 0 1-7.152-.52 1.595 1.595 0 0 1-1.348-1.58V4.35c0-.806.6-1.49 1.348-1.58ZM6.75 7.5a.75.75 0 0 1 .75-.75h9a.75.75 0 0 1 0 1.5h-9a.75.75 0 0 1-.75-.75Zm.75 2.25a.75.75 0 0 0 0 1.5h5.25a.75.75 0 0 0 0-1.5H7.5Z" clipRule="evenodd" />
            <path d="M2.25 18a.75.75 0 0 0 0 1.5c7.592 0 13.108.22 17.25.545a.75.75 0 0 0 0-1.5c-4.258-.334-9.893-.545-17.25-.545Z" />
            <path fillRule="evenodd" d="M7.495 17.139a49.702 49.702 0 0 0 4.505.245 49.702 49.702 0 0 0 4.505-.245l.353 1.77a.75.75 0 0 1-.534.877 32.36 32.36 0 0 1-8.648 0 .75.75 0 0 1-.534-.877l.353-1.77Z" clipRule="evenodd" />
          </svg>
        )}
      </button>
    </>
  );
}
