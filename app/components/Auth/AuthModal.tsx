'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import type { TextColorTheme } from '@/app/utils/textColorTheme';
import Icon from '@/app/models/Icon';
import { ICONS } from '@/app/utils/icons';

export default function AuthModal({
  isOpen,
  onClose,
  textColorTheme,
}: {
  isOpen: boolean;
  onClose: () => void;
  textColorTheme: TextColorTheme;
}) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const isDark = textColorTheme.backgroundType === 'dark';

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await signIn('credentials', {
        redirect: false,
        email,
        password,
        isRegister: isLogin ? 'false' : 'true',
      });
      if (res?.error) setError(res.error);
      else onClose();
    } catch {
      setError('发生错误，请稍后再试');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 max-h-[100dvh] overflow-y-auto">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      <div
        className={`relative w-full max-w-md max-h-[90vh] overflow-y-auto p-4 sm:p-6 md:p-8 rounded-3xl shadow-2xl border ${
          isDark ? 'border-white/20 bg-gray-900/80' : 'border-white/50 bg-white/80'
        } backdrop-blur-xl`}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full min-w-[44px] min-h-[44px] flex items-center justify-center hover:bg-black/5 transition-colors"
        >
          <Icon src={ICONS.close} className={`w-5 h-5 ${textColorTheme.textColor.muted}`} title="关闭" />
        </button>

        <h3 className={`text-2xl font-bold mb-6 text-center ${textColorTheme.textColor.primary}`}>
          {isLogin ? '欢迎回来' : '注册账号'}
        </h3>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className={`block text-sm font-medium mb-1 ${textColorTheme.textColor.secondary}`}>邮箱</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className={`w-full min-h-[44px] px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-sky-400 transition-all ${
                isDark ? 'bg-white/5 border-white/10 text-white' : 'bg-white border-gray-200 text-gray-900'
              }`}
              placeholder="your@email.com"
            />
          </div>
          <div>
            <label className={`block text-sm font-medium mb-1 ${textColorTheme.textColor.secondary}`}>密码</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className={`w-full min-h-[44px] px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-sky-400 transition-all ${
                isDark ? 'bg-white/5 border-white/10 text-white' : 'bg-white border-gray-200 text-gray-900'
              }`}
              placeholder="••••••••"
            />
          </div>

          {error && <div className="text-red-500 text-sm text-center">{error}</div>}

          <button
            type="submit"
            disabled={loading}
            className={`w-full py-3 rounded-xl font-bold text-lg transition-all active:scale-95 flex justify-center items-center ${
              isDark ? 'bg-sky-600 hover:bg-sky-500 text-white shadow-lg' : 'bg-sky-500 hover:bg-sky-400 text-white shadow-lg shadow-sky-200'
            } ${loading ? 'opacity-70 cursor-not-allowed' : ''}`}
          >
            {loading ? <Icon src={ICONS.spinner} className="w-5 h-5 animate-spin" title="加载中" /> : isLogin ? '登录' : '注册'}
          </button>
        </form>

        <p className={`mt-6 text-center text-sm ${textColorTheme.textColor.secondary}`}>
          {isLogin ? '还没有账号？' : '已有账号？'}
          <button type="button" onClick={() => setIsLogin(!isLogin)} className="ml-1 text-sky-500 font-bold hover:underline">
            {isLogin ? '去注册' : '去登录'}
          </button>
        </p>
      </div>
    </div>
  );
}

