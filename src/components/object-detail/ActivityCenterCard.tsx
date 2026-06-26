'use client';

import { useEffect, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CheckCircle2, Circle, Loader2, Zap } from 'lucide-react';

interface ActivityCenterCardProps {
  object: {
    id: string;
    status: string;
    category: string;
    created_at: string;
    updated_at: string;
    is_boosted?: boolean;
  };
  matchCount?: number;
  scanCount?: number;
  shareCount?: number;
}

interface ActivityItem {
  id: string;
  label: string;
  sublabel?: string;
  status: 'done' | 'loading' | 'pending' | 'count';
  value?: string | number;
  timestamp?: string;
}

export default function ActivityCenterCard({
  object,
  matchCount = 0,
  scanCount = 0,
  shareCount = 0,
}: ActivityCenterCardProps) {
  const [items, setItems] = useState<ActivityItem[]>([]);
  const isActive = object.status === 'lost' || object.status === 'stolen';

  useEffect(() => {
    const createdAt = object.created_at;
    const updatedAt = object.updated_at;

    const baseItems: ActivityItem[] = [
      { id: 'published', label: 'Publicada na rede Backfindr', status: 'done', timestamp: createdAt },
      { id: 'indexed',   label: 'Indexada para busca',         status: 'done', timestamp: createdAt },
      { id: 'map',       label: 'Disponível no mapa público',  status: 'done', timestamp: createdAt },
    ];

    if (isActive) {
      baseItems.push({ id: 'ai', label: 'IA comparando objetos semelhantes', sublabel: 'em andamento...', status: 'loading' });
    }

    baseItems.push(
      { id: 'shares',  label: 'Compartilhamentos',              status: 'count', value: shareCount },
      { id: 'scans',   label: 'Avistamentos (QR escaneado)',     status: 'count', value: scanCount },
      { id: 'matches', label: 'Possíveis correspondências',      status: 'count', value: matchCount },
    );

    if (object.is_boosted) {
      baseItems.push({ id: 'boost', label: 'Boost ativo — alcance ampliado', status: 'done', timestamp: updatedAt });
    }

    setItems(baseItems);
  }, [object, matchCount, scanCount, shareCount, isActive]);

  const lastUpdate = formatDistanceToNow(new Date(object.updated_at), { addSuffix: true, locale: ptBR });

  return (
    <div className="glass rounded-2xl p-4 sm:p-5 border border-brand-500/20 bg-brand-500/[0.03]">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="relative flex h-2.5 w-2.5 flex-shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-400 opacity-60" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-brand-500" />
          </div>
          <h3 className="font-display font-semibold text-white text-sm">Atividade da Ocorrência</h3>
        </div>
        <span className="text-slate-500 text-[10px]">atualizado {lastUpdate}</span>
      </div>

      <div className="space-y-3">
        {items.map((item) => (
          <div key={item.id} className="flex items-start gap-3">
            <div className="flex-shrink-0 mt-0.5">
              {item.status === 'done'    && <CheckCircle2 className="w-4 h-4 text-brand-400" />}
              {item.status === 'loading' && <Loader2 className="w-4 h-4 text-amber-400 animate-spin" />}
              {item.status === 'pending' && <Circle className="w-4 h-4 text-slate-600" />}
              {item.status === 'count'   && <Circle className={`w-4 h-4 ${Number(item.value) > 0 ? 'text-brand-400' : 'text-slate-600'}`} />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span className={`text-xs font-medium leading-tight ${
                  item.status === 'done' ? 'text-slate-200' :
                  item.status === 'loading' ? 'text-amber-300' :
                  item.status === 'count' && Number(item.value) > 0 ? 'text-slate-200' : 'text-slate-500'
                }`}>{item.label}</span>
                {item.status === 'count' && (
                  <span className={`text-xs font-bold flex-shrink-0 ${Number(item.value) > 0 ? 'text-brand-400' : 'text-slate-600'}`}>{item.value}</span>
                )}
                {item.status === 'done' && item.timestamp && (
                  <span className="text-slate-600 text-[10px] flex-shrink-0">
                    {formatDistanceToNow(new Date(item.timestamp), { addSuffix: true, locale: ptBR })}
                  </span>
                )}
              </div>
              {item.sublabel && <span className="text-[10px] text-slate-500 mt-0.5 block">{item.sublabel}</span>}
            </div>
          </div>
        ))}
      </div>

      {isActive && !object.is_boosted && (
        <div className="mt-4 pt-3 border-t border-surface-border flex items-center gap-2">
          <Zap className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
          <span className="text-slate-500 text-[11px] leading-tight">
            Ative o Boost para ampliar o alcance e aumentar as oportunidades de reencontro.
          </span>
        </div>
      )}
    </div>
  );
}
