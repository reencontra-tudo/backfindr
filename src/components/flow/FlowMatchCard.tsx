'use client';

import Link from 'next/link';
import { MapPin, Package, ArrowRight } from 'lucide-react';

export interface MatchItem {
  id: string;
  title: string;
  description?: string;
  location?: { address?: string } | null;
  photos?: string[];
  created_at?: string;
  unique_code?: string;
}

interface FlowMatchCardProps {
  item: MatchItem;
  onSelect?: (item: MatchItem) => void;
  label?: string;
}

function timeAgo(dateStr?: string): string {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `há ${mins} min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `há ${hrs}h`;
  return `há ${Math.floor(hrs / 24)} dias`;
}

export default function FlowMatchCard({ item, onSelect, label }: FlowMatchCardProps) {
  return (
    <div
      className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-4 flex gap-3 cursor-pointer hover:border-teal-500/40 hover:bg-white/[0.06] transition-all"
      onClick={() => onSelect?.(item)}
    >
      {/* Foto */}
      <div className="w-14 h-14 rounded-xl bg-white/[0.05] border border-white/[0.06] flex-shrink-0 overflow-hidden">
        {item.photos?.[0] ? (
          <img src={item.photos[0]} alt={item.title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Package className="w-5 h-5 text-white/20" />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2 mb-0.5">
          <h3 className="text-white font-semibold text-sm leading-tight truncate">{item.title}</h3>
          {item.created_at && (
            <span className="text-white/30 text-xs flex-shrink-0">{timeAgo(item.created_at)}</span>
          )}
        </div>
        {item.description && (
          <p className="text-white/40 text-xs line-clamp-1 mb-1">{item.description}</p>
        )}
        {item.location?.address && (
          <p className="text-white/30 text-xs flex items-center gap-1 mb-1.5">
            <MapPin className="w-3 h-3" />
            {item.location.address}
          </p>
        )}
        <span className="inline-flex items-center gap-1 text-xs text-teal-400 font-semibold">
          {label || 'É parecido com o meu'} <ArrowRight className="w-3 h-3" />
        </span>
      </div>
    </div>
  );
}
