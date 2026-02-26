'use client';

import { useEffect, useMemo, useState } from 'react';
import { signOut } from 'next-auth/react';
import ReactECharts from 'echarts-for-react';
import type { Session } from 'next-auth';
import type { TextColorTheme } from '@/app/utils/textColorTheme';
import { getCardStyle } from '@/app/utils/textColorTheme';
import Icon from '@/app/models/Icon';
import { ICONS } from '@/app/utils/icons';
import { fetchUsage } from '@/app/lib/api';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  textColorTheme: TextColorTheme;
  session: Session | null | undefined;
}

interface UsageData {
  total: number;
  daily: { date: string; count: number }[];
}

function getAvatarInitial(email: string | null | undefined): string {
  if (!email) return '?';
  const first = email.charAt(0).toUpperCase();
  if (/[A-Za-z0-9]/.test(first)) return first;
  return email.slice(0, 2).toUpperCase() || '?';
}

export default function ProfileModal({
  isOpen,
  onClose,
  textColorTheme,
  session,
}: ProfileModalProps) {
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [loading, setLoading] = useState(false);

  const userId = (session?.user as { id?: string } | undefined)?.id;

  useEffect(() => {
    if (!isOpen || !userId) return;

    setLoading(true);
    fetchUsage()
      .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch usage');
        return res.json();
      })
      .then((data: UsageData) => setUsage(data))
      .catch(() => setUsage({ total: 0, daily: [] }))
      .finally(() => setLoading(false));
  }, [isOpen, userId]);

  const isDark = textColorTheme.backgroundType === 'dark';
  const titleColor = isDark ? '#ffffff' : '#0c4a6e';
  const axisColor = isDark ? '#e5e7eb' : '#374151';

  const chartOption = useMemo(() => {
    const daily = usage?.daily ?? [];
    const dates = daily.map((d) => {
      const date = new Date(d.date);
      return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
    });
    const counts = daily.map((d) => d.count);

    return {
      tooltip: {
        trigger: 'axis',
        formatter: (params: { axisValue: string; data: number }[]) => {
          if (!params?.[0]) return '';
          const idx = params[0].axisValue ? dates.indexOf(params[0].axisValue) : -1;
          const dateStr = idx >= 0 && daily[idx] ? daily[idx].date : params[0].axisValue ?? '';
          return `${dateStr}<br/>API 调用：${params[0].data} 次`;
        },
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '12%',
        top: '8%',
        containLabel: true,
      },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: dates,
        axisLabel: {
          rotate: 35,
          interval: 2,
          color: axisColor,
        },
        axisLine: { lineStyle: { color: axisColor } },
      },
      yAxis: {
        type: 'value',
        name: '次数',
        nameTextStyle: { color: axisColor },
        axisLabel: { color: axisColor },
        axisLine: { lineStyle: { color: axisColor } },
        splitLine: {
          lineStyle: { color: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' },
        },
      },
      series: [
        {
          name: 'API 用量',
          type: 'line',
          data: counts,
          smooth: true,
          itemStyle: { color: isDark ? '#38bdf8' : '#0ea5e9' },
          lineStyle: { width: 2 },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: isDark ? 'rgba(56,189,248,0.4)' : 'rgba(14,165,233,0.3)' },
                { offset: 1, color: isDark ? 'rgba(56,189,248,0.05)' : 'rgba(14,165,233,0.05)' },
              ],
            },
          },
          symbol: 'circle',
          symbolSize: 5,
        },
      ],
    };
  }, [usage?.daily, isDark, titleColor, axisColor]);

  if (!isOpen) return null;
  if (!session?.user) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 max-h-[100dvh] overflow-y-auto">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      <div
        className={`relative w-full max-w-md max-h-[90vh] overflow-y-auto p-4 sm:p-6 rounded-2xl shadow-2xl border ${
          isDark ? 'border-white/20 bg-gray-900/90' : 'border-white/50 bg-white/90'
        } backdrop-blur-xl`}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full min-w-[44px] min-h-[44px] flex items-center justify-center hover:bg-black/5 transition-colors"
        >
          <Icon src={ICONS.close} className={`w-5 h-5 ${textColorTheme.textColor.muted}`} title="关闭" />
        </button>

        {/* 头像 + 邮箱 */}
        <div className="flex flex-col items-center mb-5">
          <div
            className={`w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold mb-2 ${
              isDark ? 'bg-sky-600/50 text-white' : 'bg-sky-500/30 text-sky-800'
            }`}
          >
            {getAvatarInitial(session.user.email)}
          </div>
          <span className={`text-base font-medium ${textColorTheme.textColor.primary}`}>
            {session.user.name || session.user.email}
          </span>
          {session.user.email && (
            <span className={`text-sm ${textColorTheme.textColor.muted}`}>{session.user.email}</span>
          )}
        </div>

        {/* API 总用量 */}
        <div className={`mb-4 px-3 py-2 rounded-lg ${getCardStyle(textColorTheme.backgroundType)}`}>
          <span className={`text-sm ${textColorTheme.textColor.secondary}`}>API 总用量：</span>
          <span className={`font-bold ${textColorTheme.textColor.primary}`}>
            {loading ? '...' : usage?.total ?? 0} 次
          </span>
        </div>

        {/* 折线图 - 过去 30 天 */}
        <div className="mb-5">
          <p className={`text-sm font-medium mb-2 ${textColorTheme.textColor.primary}`}>过去 30 天 API 用量</p>
          <div className="h-48">
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <Icon src={ICONS.spinner} className="w-8 h-8 animate-spin text-sky-500" title="加载中" />
              </div>
            ) : (
              <ReactECharts
                option={chartOption}
                style={{ height: '100%', width: '100%' }}
                opts={{ renderer: 'svg' }}
              />
            )}
          </div>
        </div>

        {/* 退出登录 */}
        <button
          type="button"
          onClick={() => {
            onClose();
            signOut({ callbackUrl: '/' });
          }}
          className={`w-full py-3 rounded-xl font-bold text-base transition-all active:scale-95 flex justify-center items-center gap-2 ${
            isDark ? 'bg-sky-600 hover:bg-sky-500 text-white' : 'bg-sky-500 hover:bg-sky-400 text-white shadow-sky-200'
          }`}
        >
          退出登录
        </button>
      </div>
    </div>
  );
}
