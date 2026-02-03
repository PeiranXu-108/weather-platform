'use client';

const GRADIENT_STOPS = [
  { pct: 0, rgb: 'rgb(55, 0, 120)' },
  { pct: 12, rgb: 'rgb(59, 130, 246)' },
  { pct: 20, rgb: 'rgb(6, 182, 212)' },
  { pct: 40, rgb: 'rgb(16, 185, 129)' },
  { pct: 60, rgb: 'rgb(234, 179, 8)' },
  { pct: 80, rgb: 'rgb(249, 115, 22)' },
  { pct: 100, rgb: 'rgb(239, 68, 68)' },
];

const MIN_TEMP = -15;
const MAX_TEMP = 40;
const LABELS = [MAX_TEMP, 30, 20, 10, 0, -10, MIN_TEMP];

const gradientValue = GRADIENT_STOPS.map((s) => `${s.rgb} ${s.pct}%`).join(', ');

export default function TemperatureLegend() {
  return (
    <div className="bg-white/70 backdrop-blur-md rounded-xl shadow-2xl px-3 py-2 border border-white/40">
      <p className="text-xs font-medium text-gray-800 mb-2">气温</p>
      <div className="flex items-stretch gap-2">
        <div
          className="w-1 rounded-full flex-shrink-0"
          style={{
            background: `linear-gradient(to top, ${gradientValue})`,
            minHeight: '120px',
          }}
        />
        <div
          className="flex flex-col justify-between text-xs text-gray-800 py-0.5"
          style={{ minHeight: '120px' }}
        >
          {LABELS.map((t) => (
            <span key={t}>{t}°</span>
          ))}
        </div>
      </div>
    </div>
  );
}
