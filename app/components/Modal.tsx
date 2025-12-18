'use client';

import React, { useEffect } from 'react';
import type { TextColorTheme } from '@/app/utils/textColorTheme';
import { getCardStyle } from '@/app/utils/textColorTheme';
import Icon from '@/app/components/Icon';
import { ICONS } from '@/app/utils/icons';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  message: string;
  textColorTheme: TextColorTheme;
}

export default function Modal({ isOpen, onClose, title, message, textColorTheme }: ModalProps) {
  // Prevent scrolling when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const isDark = textColorTheme.backgroundType === 'dark';

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Overlay */}
      <div 
        className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity animate-in fade-in duration-300"
        onClick={onClose}
      />
      
      {/* Modal Content */}
      <div className={`relative w-full max-w-md p-8 rounded-3xl shadow-2xl border ${isDark ? 'border-white/20 bg-gray-900/80' : 'border-white/50 bg-white/80'} backdrop-blur-xl animate-in fade-in zoom-in duration-300`}>
        {title && (
          <h3 className={`text-xl font-bold mb-4 ${textColorTheme.textColor.primary}`}>
            {title}
          </h3>
        )}
        
        <div className="flex flex-col items-center text-center py-4">
          <div className={`mb-6 p-4 rounded-full ${isDark ? 'bg-red-500/20 text-red-400' : 'bg-red-100 text-red-500'}`}>
            <Icon src={ICONS.alert} className="w-12 h-12" title="提示" />
          </div>
          
          <div className={`text-lg font-medium mb-8 ${textColorTheme.textColor.primary} whitespace-pre-wrap`}>
            {message}
          </div>
        </div>

        <button
          onClick={onClose}
          className={`w-full py-4 rounded-2xl font-bold text-lg transition-all active:scale-95 ${
            isDark 
              ? 'bg-white/10 hover:bg-white/20 text-white border border-white/20' 
              : 'bg-sky-500 hover:bg-sky-600 text-white shadow-lg shadow-sky-200'
          }`}
        >
          确定
        </button>
      </div>
    </div>
  );
}

