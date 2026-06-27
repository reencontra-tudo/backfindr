'use client';

import { useEffect, useState, useCallback } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CheckCircle2, Loader2, Zap, Activity, QrCode, GitMerge } from 'lucide-react';
import Cookies from 'js-cookie';

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
}

interface ObjectEvent {
  type: string;
  title: string;
  description?: string;
  source: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

interface EventSummary {
  total_scans: number;
  total_matches: number;
  total_ai_runs: number;
  last_activity: string | null;
  next_matching_at: string | null;
}

function eventIcon(type: string) {
  if (type.startsWith('matching')) return <Activity className="w-4 h-4 text-amber-400" />;
  if (type === 'match_found')      return <GitMerge className="w-4 h-4 text-brand-400" />;
  if (type === 'qr_scanned')       return <QrCode className="w-4 h-4 text-teal-400" />;
  if (type === 'owner_notified')   return <CheckCircle2 className="w-4 h-4 text-green-400" />;
  return <CheckCircle2 className="w-4 h-4 text-brand-400" />;
}

function eventColor(type: string) {
  if (type.startsWith('matching')) return 'text-amber-300';
  if (type === 'match_found')      return 'text-brand-300';
  if (type === 'qr_scanned')       return 'text-teal-300';
  return 'text-slate-200';
}

export default function ActivityCenterCard({
  object,
  matchCount = 0,
}: ActivityCenterCardProps) {
  const [events, setEvents] = useState<ObjectEvent[]>([]);
  const [summary, setSummary] = useState<EventSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const isActive = object.status === 'lost' || object.status === 'stolen';

  const fetchEvents = useCallback(async () => {
    try {
      const token = Cookies.get('access_token');
      if (!token) return;
      const res = await fetch(`/api/v1/objects/${object.id}/events`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      setEvents(data.events || []);
      setSummary(data.summary || null);
    } catch {
      // silencioso
    } finally {
      setLoading(false);
    }
  }, [object.id]);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);

  const lastUpdate = formatDistanceToNow(
    new Date(summary?.last_activity || object.updated_at),
    { addSuffix: true, locale: ptBR }
  );

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

      {summary && (
        <div className="grid grid-cols-3 gap-2 mb-4">
          <div className="bg-surface-card rounded-lg p-2 text-center">
            <div className="text-lg font-bold text-brand-400">{summary.total_ai_runs}</div>
            <div className="text-[10px] text-slate-500 leading-tight">comparações IA</div>
          </div>
          <div className="bg-surface-card rounded-lg p-2 text-center">
            <div className="text-lg font-bold text-teal-400">{summary.total_scans}</div>
            <div className="text-[10px] text-slate-500 leading-tight">scans QR</div>
          </div>
          <div className="bg-surface-card rounded-lg p-2 text-center">
            <div className={`text-lg font-bold ${summary.total_matches > 0 ? 'text-amber-400' : 'text-slate-600'}`}>
              {summary.total_matches || matchCount}
            </div>
            <div className="text-[10px] text-slate-500 leading-tight">correspondências</div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 py-2">
          <Loader2 className="w-4 h-4 text-brand-400 animate-spin" />
          <span className="text-slate-500 text-xs">Carregando atividade...</span>
        </div>
      ) : events.length === 0 ? (
        <div className="space-y-3">
          {[
            { label: 'Publicada na rede Backfindr', ts: object.created_at },
            { label: 'Indexada para busca',         ts: object.created_at },
            { label: 'Disponível no mapa público',  ts: object.created_at },
          ].map((item) => (
            <div key={item.label} className="flex items-start gap-3">
              <CheckCircle2 className="w-4 h-4 text-brand-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1 flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-slate-200">{item.label}</span>
                <span className="text-slate-600 text-[10px] flex-shrink-0">
                  {formatDistanceToNow(new Date(item.ts), { addSuffix: true, locale: ptBR })}
                </span>
              </div>
            </div>
          ))}
          {isActive && (
            <div className="flex items-start gap-3">
              <Loader2 className="w-4 h-4 text-amber-400 animate-spin flex-shrink-0 mt-0.5" />
              <span className="text-xs font-medium text-amber-300">IA monitorando continuamente...</span>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {events.map((ev, i) => (
            <div key={i} className="flex items-start gap-3">
              <div className="flex-shrink-0 mt-0.5">{eventIcon(ev.type)}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className={`text-xs font-medium leading-tight ${eventColor(ev.type)}`}>
                    {ev.title}
                  </span>
                  <span className="text-slate-600 text-[10px] flex-shrink-0">
                    {formatDistanceToNow(new Date(ev.created_at), { addSuffix: true, locale: ptBR })}
                  </span>
                </div>
                {ev.description && (
                  <span className="text-[10px] text-slate-500 mt-0.5 block">{ev.description}</span>
                )}
              </div>
            </div>
          ))}
          {isActive && (
            <div className="flex items-start gap-3">
              <Loader2 className="w-4 h-4 text-amber-400 animate-spin flex-shrink-0 mt-0.5" />
              <span className="text-xs font-medium text-amber-300">
                {summary?.next_matching_at
                  ? (() => {
                      const diff = Math.max(0, new Date(summary.next_matching_at).getTime() - Date.now());
                      const mins = Math.ceil(diff / 60000);
                      return mins <= 1
                        ? 'Nova comparação automática iniciando...'
                        : `Próxima comparação automática em ${mins} minutos`;
                    })()
                  : 'IA monitorando continuamente...'}
              </span>
            </div>
          )}
        </div>
      )}

      {isActive && !object.is_boosted && summary && summary.total_ai_runs >= 1 && (
        <div className="mt-4 pt-4 border-t border-surface-border">
          <div className="bg-amber-500/[0.07] border border-amber-500/25 rounded-xl p-3.5">
            <p className="text-amber-300 text-xs font-bold mb-1">
              A IA já fez {summary.total_ai_runs} comparação{summary.total_ai_runs > 1 ? 'ões' : ''} por você
            </p>
            <p className="text-white/45 text-[11px] leading-relaxed mb-3">
              A máquina está funcionando. Com Impulso, ela alcança mais pessoas na região — e roda com prioridade.
            </p>
            <a
              href={`/dashboard/objects/${object.id}#boost`}
              className="flex items-center justify-center gap-1.5 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 text-xs font-semibold py-2.5 rounded-lg transition-all"
            >
              <Zap className="w-3.5 h-3.5" />
              Ampliar alcance — a partir de R$ 9,90
            </a>
          </div>
        </div>
      )}

      {isActive && !object.is_boosted && summary && summary.total_ai_runs === 0 && (
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
