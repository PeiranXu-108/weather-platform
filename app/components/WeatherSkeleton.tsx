'use client';

import React from 'react';

export default function WeatherSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Current Weather & 24h Forecast Skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 h-56 bg-white/10 rounded-2xl backdrop-blur-md border border-white/5"></div>
        <div className="lg:col-span-2 h-56 bg-white/10 rounded-2xl backdrop-blur-md border border-white/5"></div>
      </div>

      {/* Temperature Chart & Metrics Skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 h-[480px] bg-white/10 rounded-2xl backdrop-blur-md border border-white/5"></div>
        <div className="lg:col-span-1 h-[480px] bg-white/10 rounded-2xl backdrop-blur-md border border-white/5"></div>
      </div>

      {/* Hourly Chart Skeleton */}
      <div className="h-[300px] bg-white/10 rounded-2xl backdrop-blur-md border border-white/5"></div>
    </div>
  );
}

