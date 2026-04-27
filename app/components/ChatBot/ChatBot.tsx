'use client';

import React, { useRef, useEffect } from 'react';
import type { TextColorTheme } from '@/app/utils/textColorTheme';
import ChatPanel from './ChatPanel';
import type { ChatLayoutMode } from './types';

interface ChatBotProps {
  textColorTheme: TextColorTheme;
  mode: ChatLayoutMode;
  onModeChange: (mode: ChatLayoutMode) => void;
}

export default function ChatBot({ textColorTheme, mode, onModeChange }: ChatBotProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const isDark = textColorTheme.backgroundType === 'dark';
  const isOpen = mode !== 'closed';
  const isFloating = mode === 'floating';
  const isDocked = mode === 'docked';
  const isFullscreenMobile = mode === 'fullscreen-mobile';

  // 点击外部关闭
  useEffect(() => {
    if (!isFloating) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        onModeChange('closed');
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
  }, [isFloating, onModeChange]);

  useEffect(() => {
    if (!isOpen) return;

    const mediaQuery = window.matchMedia('(min-width: 768px)');

    const syncModeWithViewport = (matchesDesktop: boolean) => {
      if (mode === 'docked' && !matchesDesktop) {
        onModeChange('fullscreen-mobile');
      } else if (mode === 'fullscreen-mobile' && matchesDesktop) {
        onModeChange('docked');
      }
    };

    syncModeWithViewport(mediaQuery.matches);

    const handleChange = (event: MediaQueryListEvent) => {
      syncModeWithViewport(event.matches);
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [isOpen, mode, onModeChange]);

  const handleToggleOpen = () => {
    onModeChange(isOpen ? 'closed' : 'floating');
  };

  const handleToggleDock = () => {
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      onModeChange(isFullscreenMobile ? 'floating' : 'fullscreen-mobile');
      return;
    }

    onModeChange(isDocked ? 'floating' : 'docked');
  };

  return (
    <>
      {!isDocked && !isFullscreenMobile && (
        <div
          ref={panelRef}
          className={`fixed right-4 md:right-6 z-[90] transition-all duration-300 ease-out ${
            isFloating
              ? 'opacity-100 translate-y-0 scale-100 pointer-events-auto'
              : 'opacity-0 translate-y-4 scale-95 pointer-events-none'
          }`}
          style={{
            width: 'min(380px, calc(100vw - 2rem))',
            height: 'min(520px, calc(100vh - 2rem))',
            bottom: 'max(6rem, calc(env(safe-area-inset-bottom, 0px) + 4rem))',
          }}
        >
          {isFloating && (
            <ChatPanel
              isDark={isDark}
              mode="floating"
              onClose={() => onModeChange('closed')}
              onToggleDock={handleToggleDock}
            />
          )}
        </div>
      )}

      {isDocked && (
        <aside
          className="hidden md:block shrink-0 h-[100dvh] relative z-[80]"
          style={{ width: 'clamp(440px, 32vw, 520px)' }}
        >
          <ChatPanel
            isDark={isDark}
            mode="docked"
            onClose={() => onModeChange('closed')}
            onToggleDock={handleToggleDock}
          />
        </aside>
      )}

      {isFullscreenMobile && (
        <div className="fixed inset-0 z-[100] md:hidden">
          <div className="h-[100dvh]">
            <ChatPanel
              isDark={isDark}
              mode="fullscreen-mobile"
              onClose={() => onModeChange('closed')}
              onToggleDock={handleToggleDock}
            />
          </div>
        </div>
      )}

      {/* 悬浮按钮：与页面玻璃拟态风格一致 */}
      {!isDocked && !isFullscreenMobile && (
        <button
          ref={buttonRef}
          onClick={handleToggleOpen}
          className={`fixed right-4 md:right-6 z-[90] w-14 h-14 rounded-full flex items-center justify-center transition-all duration-300 active:scale-95 backdrop-blur-xl border ${
            isOpen
              ? isDark
                ? 'bg-white/20 hover:bg-white/30 border-white/20 text-white shadow-lg shadow-black/15'
                : 'bg-white/95 hover:bg-white border-slate-200/80 text-slate-700 shadow-lg shadow-slate-400/20'
              : isDark
                ? 'bg-white/15 hover:bg-white/25 border-white/20 text-white shadow-lg shadow-black/15 hover:shadow-black/20'
                : 'bg-white/90 hover:bg-white border-slate-200/70 text-slate-700 shadow-lg shadow-slate-400/15 hover:shadow-slate-400/25'
          }`}
          style={{ bottom: 'max(1.5rem, env(safe-area-inset-bottom, 0px))' }}
          title={isOpen ? '关闭天气助手' : '打开天气助手'}
        >
          {isOpen ? (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5" aria-hidden>
              <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
            </svg>
          ) : (
            <img
              src="/icons/conversation.svg"
              alt=""
              className={`w-6 h-6 pointer-events-none ${!isDark ? 'invert' : ''}`}
              aria-hidden
            />
          )}
        </button>
      )}
    </>
  );
}
