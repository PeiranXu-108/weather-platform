'use client';

import React from 'react';
import type {
  CitySearchPanel,
  CurrentForecastPanel,
  Forecast30dPanel,
  WeatherAssistantPanel,
  WeatherErrorPanel,
} from './types';

interface WeatherPanelProps {
  panel: WeatherAssistantPanel;
  isDark: boolean;
}

function weatherIconUrl(icon?: string): string | undefined {
  if (!icon) return undefined;
  if (icon.startsWith('//')) return `https:${icon}`;
  return icon;
}

function formatDateLabel(date: string): string {
  if (!date) return '-';
  const parsed = new Date(`${date}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return date;
  const days = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  return `${parsed.getMonth() + 1}/${parsed.getDate()} ${days[parsed.getDay()]}`;
}

function formatHourLabel(time: string): string {
  if (!time) return '-';
  const hour = time.slice(11, 16);
  return hour || time;
}

function numberText(value: number, suffix = ''): string {
  return Number.isFinite(value) ? `${Math.round(value)}${suffix}` : '-';
}

function PanelShell({
  children,
  isDark,
}: {
  children: React.ReactNode;
  isDark: boolean;
}) {
  return (
    <div
      className={`mt-2 overflow-hidden rounded-2xl border text-left shadow-sm ${
        isDark
          ? 'border-white/10 bg-slate-950/45 text-white'
          : 'border-slate-200/80 bg-white/85 text-slate-900'
      }`}
    >
      {children}
    </div>
  );
}

function MetricPill({
  label,
  value,
  isDark,
}: {
  label: string;
  value: string;
  isDark: boolean;
}) {
  return (
    <div className={`rounded-xl px-2.5 py-2 ${isDark ? 'bg-white/[0.07]' : 'bg-slate-50'}`}>
      <div className={`text-[10px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{label}</div>
      <div className="mt-0.5 truncate text-xs font-semibold">{value}</div>
    </div>
  );
}

function CurrentForecastCard({ panel, isDark }: { panel: CurrentForecastPanel; isDark: boolean }) {
  const icon = weatherIconUrl(panel.current.icon);
  const dailyLabelDays = panel.daily.length || panel.requestedDays;

  return (
    <PanelShell isDark={isDark}>
      <div className={`p-3 ${isDark ? 'bg-sky-500/10' : 'bg-sky-50/90'}`}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className={`text-[11px] font-medium ${isDark ? 'text-sky-200' : 'text-sky-700'}`}>
              {panel.title}
            </div>
            <div className="mt-1 truncate text-base font-bold">
              {panel.location.name || '未知位置'}
            </div>
            <div className={`mt-0.5 truncate text-[11px] ${isDark ? 'text-slate-300' : 'text-slate-500'}`}>
              {[panel.location.region, panel.location.country].filter(Boolean).join(' · ') || panel.location.localtime || ''}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            {icon && <img src={icon} alt="" className="h-11 w-11" />}
            <div className="text-right">
              <div className="text-3xl font-bold leading-none">{numberText(panel.current.tempC, '°')}</div>
              <div className={`mt-1 max-w-24 truncate text-[11px] ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                {panel.current.condition}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <MetricPill label="体感" value={numberText(panel.current.feelsLikeC, '°C')} isDark={isDark} />
          <MetricPill label="湿度" value={numberText(panel.current.humidity, '%')} isDark={isDark} />
          <MetricPill label="风" value={`${numberText(panel.current.windKph, ' km/h')} ${panel.current.windDir}`} isDark={isDark} />
          <MetricPill label="降水 / UV" value={`${panel.current.precipMm} mm · ${panel.current.uv}`} isDark={isDark} />
        </div>
      </div>

      {panel.daily.length > 0 && (
        <div className="p-3">
          <div className={`mb-2 text-[11px] font-semibold ${isDark ? 'text-slate-300' : 'text-slate-500'}`}>
            未来{dailyLabelDays}天
          </div>
          <div className="space-y-2">
            {panel.daily.map((day) => (
              <div key={day.date} className={`rounded-xl px-2.5 py-2 ${isDark ? 'bg-white/[0.06]' : 'bg-slate-50'}`}>
                <div className="flex items-center gap-2">
                  <div className="w-14 shrink-0 text-xs font-semibold">{formatDateLabel(day.date)}</div>
                  {weatherIconUrl(day.icon) && <img src={weatherIconUrl(day.icon)} alt="" className="h-7 w-7 shrink-0" />}
                  <div className="min-w-0 flex-1 truncate text-xs">{day.condition}</div>
                  <div className="shrink-0 text-xs font-semibold">
                    {numberText(day.minTempC, '°')}~{numberText(day.maxTempC, '°')}
                  </div>
                </div>
                <div className={`mt-1 h-1.5 overflow-hidden rounded-full ${isDark ? 'bg-white/10' : 'bg-slate-200'}`}>
                  <div
                    className="h-full rounded-full bg-sky-400"
                    style={{ width: `${Math.max(4, Math.min(100, day.rainChance))}%` }}
                  />
                </div>
                <div className={`mt-1 text-[10px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  降雨概率 {day.rainChance}% · 湿度 {day.humidity}% · UV {day.uv}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {panel.hourly.length > 0 && (
        <div className={`border-t px-3 py-2.5 ${isDark ? 'border-white/10' : 'border-slate-200/80'}`}>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {panel.hourly.map((hour) => (
              <div key={hour.time} className={`w-16 shrink-0 rounded-xl px-2 py-2 text-center ${isDark ? 'bg-white/[0.06]' : 'bg-slate-50'}`}>
                <div className={`text-[10px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{formatHourLabel(hour.time)}</div>
                {weatherIconUrl(hour.icon) && <img src={weatherIconUrl(hour.icon)} alt="" className="mx-auto my-1 h-7 w-7" />}
                <div className="text-xs font-semibold">{numberText(hour.tempC, '°')}</div>
                <div className={`text-[10px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{hour.rainChance}%</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </PanelShell>
  );
}

function Forecast30dCard({ panel, isDark }: { panel: Forecast30dPanel; isDark: boolean }) {
  const temps = panel.daily.flatMap((day) => [day.tempMinC, day.tempMaxC]).filter(Number.isFinite);
  const min = temps.length ? Math.min(...temps) : 0;
  const max = temps.length ? Math.max(...temps) : 1;
  const span = Math.max(1, max - min);
  const locationLabel =
    [panel.location.name, panel.location.region, panel.location.country].filter(Boolean).join(' · ') ||
    `${panel.location.longitude.toFixed(2)}, ${panel.location.latitude.toFixed(2)}`;

  return (
    <PanelShell isDark={isDark}>
      <div className={`p-3 ${isDark ? 'bg-emerald-500/10' : 'bg-emerald-50/90'}`}>
        <div className={`text-[11px] font-medium ${isDark ? 'text-emerald-200' : 'text-emerald-700'}`}>
          {panel.title}
        </div>
        <div className="mt-1 truncate text-sm font-semibold">{locationLabel}</div>
        {panel.updateTime && (
          <div className={`mt-0.5 text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            更新 {panel.updateTime}
          </div>
        )}
      </div>
      <div className="max-h-72 space-y-2 overflow-y-auto p-3">
        {panel.daily.map((day) => {
          const left = ((day.tempMinC - min) / span) * 100;
          const width = Math.max(8, ((day.tempMaxC - day.tempMinC) / span) * 100);
          return (
            <div key={day.date} className={`rounded-xl px-2.5 py-2 ${isDark ? 'bg-white/[0.06]' : 'bg-slate-50'}`}>
              <div className="flex items-center gap-2 text-xs">
                <span className="w-14 shrink-0 font-semibold">{formatDateLabel(day.date)}</span>
                <span className="min-w-0 flex-1 truncate">{day.textDay}/{day.textNight}</span>
                <span className="shrink-0 font-semibold">{day.tempMinC}°~{day.tempMaxC}°</span>
              </div>
              <div className={`mt-2 h-2 rounded-full ${isDark ? 'bg-white/10' : 'bg-slate-200'}`}>
                <div
                  className="h-2 rounded-full bg-gradient-to-r from-sky-400 to-amber-400"
                  style={{ marginLeft: `${left}%`, width: `${Math.min(width, 100 - left)}%` }}
                />
              </div>
              <div className={`mt-1 text-[10px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                降水 {day.precipMm} mm · 湿度 {day.humidity}% · {day.windDirDay}{day.windScaleDay}级 · UV {day.uvIndex}
              </div>
            </div>
          );
        })}
      </div>
    </PanelShell>
  );
}

function CitySearchCard({ panel, isDark }: { panel: CitySearchPanel; isDark: boolean }) {
  return (
    <PanelShell isDark={isDark}>
      <div className={`p-3 ${isDark ? 'bg-indigo-500/10' : 'bg-indigo-50/90'}`}>
        <div className={`text-[11px] font-medium ${isDark ? 'text-indigo-200' : 'text-indigo-700'}`}>
          {panel.title}
        </div>
        <div className="mt-1 text-sm font-semibold">“{panel.query}” 的匹配城市</div>
      </div>
      <div className="p-3">
        {panel.results.length === 0 ? (
          <div className={`rounded-xl px-3 py-2 text-xs ${isDark ? 'bg-white/[0.06] text-slate-300' : 'bg-slate-50 text-slate-600'}`}>
            没有找到匹配城市，可以试试更完整的城市名。
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-2">
            {panel.results.map((city) => (
              <div
                key={`${city.chineseName}-${city.englishName}`}
                className={`rounded-xl px-3 py-2 ${isDark ? 'bg-white/[0.06]' : 'bg-slate-50'}`}
              >
                <div className="text-sm font-semibold">{city.chineseName}</div>
                <div className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{city.englishName}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </PanelShell>
  );
}

function ErrorCard({ panel, isDark }: { panel: WeatherErrorPanel; isDark: boolean }) {
  return (
    <PanelShell isDark={isDark}>
      <div className={`p-3 ${isDark ? 'bg-rose-500/10' : 'bg-rose-50/90'}`}>
        <div className={`text-[11px] font-medium ${isDark ? 'text-rose-200' : 'text-rose-700'}`}>
          {panel.title}
        </div>
        <div className="mt-1 text-xs leading-relaxed">{panel.message}</div>
        {panel.toolName && (
          <div className={`mt-2 text-[10px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            工具：{panel.toolName}
          </div>
        )}
      </div>
    </PanelShell>
  );
}

export default function WeatherPanel({ panel, isDark }: WeatherPanelProps) {
  if (panel.kind === 'current_forecast') {
    return <CurrentForecastCard panel={panel} isDark={isDark} />;
  }
  if (panel.kind === 'forecast_30d') {
    return <Forecast30dCard panel={panel} isDark={isDark} />;
  }
  if (panel.kind === 'city_search') {
    return <CitySearchCard panel={panel} isDark={isDark} />;
  }
  return <ErrorCard panel={panel} isDark={isDark} />;
}
