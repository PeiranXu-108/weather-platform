'use client';

import { useEffect } from 'react';
import NProgress from 'nprogress';
import 'nprogress/nprogress.css';

interface LoadingBarProps {
  isLoading: boolean;
}

// 配置 NProgress
if (typeof window !== 'undefined') {
  NProgress.configure({
    showSpinner: false, // 隐藏默认的 spinner
    trickleSpeed: 200, // 进度条递增速度（毫秒）
    minimum: 0.08, // 最小百分比
    easing: 'ease',
    speed: 500, // 动画速度
  });
}

export default function LoadingBar({ isLoading }: LoadingBarProps) {
  useEffect(() => {
    if (isLoading) {
      NProgress.start();
      // 模拟进度，让进度条更平滑
      const timer = setInterval(() => {
        NProgress.inc(0.1);
      }, 200);
      
      return () => {
        clearInterval(timer);
        NProgress.done();
      };
    } else {
      NProgress.done();
    }
  }, [isLoading]);

  return null;
}

