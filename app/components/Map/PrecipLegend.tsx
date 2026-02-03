'use client';

const LABELS = [50, 25, 10, 5, 1, 0.1, 0];
const COLORS = [
  'rgb(140, 60, 190)',
  'rgb(110, 70, 200)',
  'rgb(80, 90, 220)',
  'rgb(60, 120, 240)',
  'rgb(90, 165, 255)',
  'rgb(140, 200, 255)',
  'rgb(230, 240, 255)',
];

const gradientValue = COLORS.map((color, index) => {
  const pct = Math.round((index / (COLORS.length - 1)) * 100);
  return `${color} ${pct}%`;
}).join(', ');

export default function PrecipLegend() {
  return (
    <div className="bg-white/70 backdrop-blur-md rounded-xl shadow-2xl px-3 py-2 border border-white/40">
      <p className="text-xs font-medium text-gray-800 mb-2">降水量 (mm)</p>
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
          {LABELS.map((v) => (
            <span key={v}>{v}</span>
          ))}
        </div>
      </div>
    </div>
  );
}
