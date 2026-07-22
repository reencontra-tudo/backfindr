import React from 'react';

type ActivityType = 'lost' | 'found' | 'match';

export interface ActivityItem {
  id: string;
  type: ActivityType;
  emoji: string;
  text: string;
  city: string;
  time: string;
  unique_code?: string | null;
  isRecent?: boolean;
  is_boosted?: boolean;
}

export default function LiveTicker({ items }: { items: ActivityItem[] }) {
  const typeColor: Record<ActivityType, string> = {
    lost: 'text-red-400',
    found: 'text-teal-400',
    match: 'text-amber-400',
  };

  const typeLabel: Record<ActivityType, string> = {
    lost: 'Perdido',
    found: 'Achado',
    match: 'Match IA',
  };

  const doubled = [...items, ...items];

  return (
    <div className="overflow-hidden border-y border-white/[0.06] bg-white/[0.02] py-3">
      <div className="flex w-max gap-6" style={{ animation: 'ticker 30s linear infinite' }}>
        {doubled.map((item, index) => (
          <div
            key={`${item.id}-${index}`}
            className="flex flex-shrink-0 items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1"
          >
            <span className="text-sm">{item.emoji}</span>
            <span className={`text-xs font-semibold ${typeColor[item.type]}`}>{typeLabel[item.type]}</span>
            <span className="max-w-[170px] truncate text-xs text-white/55">{item.text}</span>
            <span className="text-[10px] text-white/28">{item.city}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
