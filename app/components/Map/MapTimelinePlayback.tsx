'use client';

export const TIMELINE_TOTAL_STEPS = 24;

export interface MapTimelinePlaybackProps {
  step: number;
  isPlaying: boolean;
  timeLabel: string;
  onStepChange: (step: number) => void;
  onTogglePlay: () => void;
}

export default function MapTimelinePlayback({
  step,
  isPlaying,
  timeLabel,
  onStepChange,
  onTogglePlay,
}: MapTimelinePlaybackProps) {
  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 w-[min(680px,90%)] rounded-2xl bg-white/70 backdrop-blur-sm border border-white/50 shadow-xl px-4 py-3">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onTogglePlay}
          className="flex items-center justify-center w-9 h-9 rounded-full bg-white/90 border border-white/70 text-slate-700 hover:bg-white transition-colors"
          title={isPlaying ? '暂停播放' : '播放动画'}
          aria-label={isPlaying ? '暂停播放' : '播放动画'}
        >
          {isPlaying ? (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="5" width="4" height="14" rx="1.2" />
              <rect x="14" y="5" width="4" height="14" rx="1.2" />
            </svg>
          ) : (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5.5v13a1 1 0 0 0 1.53.85l9.75-6.5a1 1 0 0 0 0-1.7l-9.75-6.5A1 1 0 0 0 8 5.5z" />
            </svg>
          )}
        </button>
        <input
          type="range"
          min={0}
          max={TIMELINE_TOTAL_STEPS - 1}
          step={1}
          value={step}
          onChange={(e) => onStepChange(Number(e.target.value))}
          className="w-full h-2 bg-white/70 rounded-full appearance-none cursor-pointer accent-blue-500"
          aria-label="未来48小时天气时间轴"
        />
      </div>
      <div className="mt-2 flex items-center justify-between text-[11px] text-slate-600">
        <span>当前</span>
        <span>T+{step * 2}小时 · {timeLabel}</span>
        <span>未来48小时</span>
      </div>
    </div>
  );
}
