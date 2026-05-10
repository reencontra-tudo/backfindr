'use client';

interface ProgressBarProps {
  current: number;
  total: number;
}

export default function ProgressBar({ current, total }: ProgressBarProps) {
  const pct = Math.round((current / total) * 100);
  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-white/30 text-xs">Passo {current} de {total}</span>
        <span className="text-white/30 text-xs">{pct}%</span>
      </div>
      <div className="w-full h-1 bg-white/[0.06] rounded-full overflow-hidden">
        <div
          className="h-full bg-teal-500 rounded-full transition-all duration-500 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
