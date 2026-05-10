'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CheckCircle2, XCircle, Zap, Clock, Package, Shield, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { matchesApi, objectsApi, parseApiError } from '@/lib/api';
import { Match, RegisteredObject } from '@/types';

const EMOJI: Record<string, string> = { phone:'📱',wallet:'👛',keys:'🔑',bag:'🎒',pet:'🐾',bike:'🚲',document:'📄',jewelry:'💍',electronics:'💻',clothing:'👕',other:'📦' };

// Chave de localStorage para rastrear quais matches já viram o briefing
const BRIEFING_SEEN_KEY = 'backfindr:safety_briefing_seen';

function getSeen(): Set<string> {
  try {
    const raw = localStorage.getItem(BRIEFING_SEEN_KEY);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch { return new Set(); }
}
function markSeen(matchId: string) {
  try {
    const seen = getSeen();
    seen.add(matchId);
    localStorage.setItem(BRIEFING_SEEN_KEY, JSON.stringify([...seen]));
  } catch {}
}

// ─── Modal de segurança F22 ───────────────────────────────────────────────────
function SafetyBriefingModal({ matchId, onConfirm }: { matchId: string; onConfirm: () => void }) {
  const SAFE_PLACES = [
    { emoji: '📮', label: 'Agência dos Correios' },
    { emoji: '🏦', label: 'Lotérica ou banco' },
    { emoji: '🛍️', label: 'Entrada de shopping' },
    { emoji: '🏪', label: 'Supermercado' },
    { emoji: '👮', label: 'Delegacia ou posto policial' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-md bg-[#0f1520] border border-white/[0.1] rounded-3xl overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/15 border border-amber-500/25 flex items-center justify-center flex-shrink-0">
              <Shield className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <p className="text-white font-bold text-base">Antes de abrir o chat</p>
              <p className="text-white/40 text-xs">Como combinar a devolução com segurança</p>
            </div>
          </div>
        </div>

        {/* Corpo */}
        <div className="px-6 py-5 space-y-5">
          {/* Locais sugeridos */}
          <div>
            <p className="text-white/60 text-xs font-semibold uppercase tracking-wider mb-3">
              Combine em um local público
            </p>
            <div className="grid grid-cols-1 gap-2">
              {SAFE_PLACES.map(p => (
                <div key={p.label} className="flex items-center gap-3 bg-white/[0.03] border border-white/[0.06] rounded-xl px-4 py-2.5">
                  <span className="text-lg">{p.emoji}</span>
                  <span className="text-white/70 text-sm">{p.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Avisos */}
          <div className="bg-amber-500/[0.06] border border-amber-500/[0.15] rounded-2xl p-4 space-y-2">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
              <p className="text-amber-200/80 text-xs leading-relaxed">Não vá à casa ou local isolado de desconhecidos.</p>
            </div>
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
              <p className="text-amber-200/80 text-xs leading-relaxed">Avise alguém de confiança sobre o encontro.</p>
            </div>
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
              <p className="text-amber-200/80 text-xs leading-relaxed">Prefira horário diurno e local movimentado.</p>
            </div>
          </div>
        </div>

        {/* Botão */}
        <div className="px-6 pb-6">
          <button
            onClick={() => { markSeen(matchId); onConfirm(); }}
            className="w-full flex items-center justify-center gap-2 bg-teal-500 hover:bg-teal-400 text-white font-bold py-3.5 rounded-2xl transition-all text-sm"
            style={{ boxShadow: '0 0 0 1px rgba(20,184,166,0.4), 0 8px 24px rgba(20,184,166,0.15)' }}
          >
            <CheckCircle2 className="w-4 h-4" />
            Entendido — abrir o chat
          </button>
        </div>
      </div>
    </div>
  );
}

interface MatchFull extends Match { object?: RegisteredObject; matched_object?: RegisteredObject; }

function ConfidenceBadge({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  const c = pct >= 80 ? 'text-green-400 bg-green-500/10 border-green-500/20' : pct >= 60 ? 'text-brand-400 bg-brand-500/10 border-brand-500/20' : 'text-orange-400 bg-orange-500/10 border-orange-500/20';
  return <span className={`inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full border ${c}`}><Zap className="w-3 h-3" />{pct}% match</span>;
}

export default function MatchesPage() {
  const [matches, setMatches] = useState<MatchFull[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const { data } = await matchesApi.list();
        const items: Match[] = data?.matches ?? [];
        const enriched = await Promise.all(items.map(async (m) => {
          try {
            const [a, b] = await Promise.all([objectsApi.get(m.lost_object_id), objectsApi.get(m.found_object_id)]);
            return { ...m, object: a.data, matched_object: b.data };
          } catch { return m; }
        }));
        setMatches(enriched);
      } catch (e) { toast.error(parseApiError(e)); }
      finally { setLoading(false); }
    };
    load();
  }, []);

  const act = async (id: string, action: 'confirm' | 'reject') => {
    setActing(id);
    try {
      if (action === 'confirm') await matchesApi.confirm(id);
      else await matchesApi.reject(id);
      setMatches(p => p.map(m => m.id === id ? { ...m, status: action === 'confirm' ? 'confirmed' : 'rejected' } : m));
      toast.success(action === 'confirm' ? 'Match confirmado!' : 'Match rejeitado.');
    } catch (e) { toast.error(parseApiError(e)); }
    finally { setActing(null); }
  };

  const pending = matches.filter(m => m.status === 'pending');
  const confirmed = matches.filter(m => m.status === 'confirmed');
  const rejected = matches.filter(m => m.status === 'rejected');

  return (
    <div className="p-8">
      <div className="mb-8"><h1 className="font-display text-2xl font-bold text-white">Matches</h1><p className="text-slate-400 text-sm mt-0.5">Nossa IA cruzou seus objetos com achados próximos.</p></div>
      <div className="grid grid-cols-3 gap-4 mb-8">
        {[{label:'Pendentes',value:pending.length,color:'text-brand-400'},{label:'Confirmados',value:confirmed.length,color:'text-green-400'},{label:'Rejeitados',value:rejected.length,color:'text-slate-400'}].map(s => (
          <div key={s.label} className="glass rounded-xl p-4 text-center"><p className={`text-2xl font-display font-bold ${s.color}`}>{loading ? '—' : s.value}</p><p className="text-slate-500 text-xs mt-0.5">{s.label}</p></div>
        ))}
      </div>
      {loading ? <div className="space-y-4">{[1,2,3].map(i => <div key={i} className="h-40 bg-surface-card rounded-2xl animate-pulse" />)}</div>
        : matches.length === 0 ? (
          <div className="text-center py-20"><div className="text-5xl mb-4">🔍</div><p className="font-display font-semibold text-white text-lg mb-2">Nenhum match ainda</p><p className="text-slate-500 text-sm max-w-sm mx-auto">A IA está monitorando continuamente. Você será notificado quando encontrar um objeto compatível.</p></div>
        ) : (
          <div className="space-y-6">
            {pending.length > 0 && <div><h2 className="font-display font-semibold text-white text-sm mb-3 flex items-center gap-2"><Clock className="w-4 h-4 text-brand-400" />Aguardando avaliação ({pending.length})</h2><div className="space-y-4">{pending.map(m => <MatchCard key={m.id} match={m} onAct={act} acting={acting} />)}</div></div>}
            {confirmed.length > 0 && <div><h2 className="font-display font-semibold text-white text-sm mb-3 flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-green-400" />Confirmados ({confirmed.length})</h2><div className="space-y-3">{confirmed.map(m => <MatchCard key={m.id} match={m} onAct={act} acting={acting} />)}</div></div>}
            {rejected.length > 0 && <div className="opacity-60"><h2 className="font-display font-semibold text-white text-sm mb-3 flex items-center gap-2"><XCircle className="w-4 h-4 text-slate-500" />Rejeitados ({rejected.length})</h2><div className="space-y-3">{rejected.map(m => <MatchCard key={m.id} match={m} onAct={act} acting={acting} />)}</div></div>}
          </div>
        )}
    </div>
  );
}

function MatchCard({ match, onAct, acting }: { match: MatchFull; onAct: (id:string,a:'confirm'|'reject')=>void; acting:string|null }) {
  const router = useRouter();
  const isPending = match.status === 'pending';
  const [showBriefing, setShowBriefing] = useState(false);

  function handleOpenChat() {
    const seen = getSeen();
    if (seen.has(match.id)) {
      router.push(`/dashboard/chat/${match.id}`);
    } else {
      setShowBriefing(true);
    }
  }

  return (
    <>
      {showBriefing && (
        <SafetyBriefingModal
          matchId={match.id}
          onConfirm={() => {
            setShowBriefing(false);
            router.push(`/dashboard/chat/${match.id}`);
          }}
        />
      )}
      <div className={`glass rounded-2xl p-5 ${match.status==='confirmed'?'border-green-500/30':''}`}>
        <div className="flex items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-2"><ConfidenceBadge score={match.confidence_score ?? match.score ?? 0} /><span className="text-slate-500 text-xs">{formatDistanceToNow(new Date(match.created_at),{addSuffix:true,locale:ptBR})}</span></div>
          {match.status==='confirmed' && <span className="text-xs text-green-400 flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" />Confirmado</span>}
        </div>
        <div className="grid grid-cols-2 gap-4 mb-4">
          {[match.object, match.matched_object].map((obj, i) => (
            <div key={i} className="bg-surface rounded-xl p-4 border border-surface-border">
              <div className="flex items-center gap-2 mb-2"><span className="text-xl">{obj ? EMOJI[obj.category]??'📦' : '📦'}</span><span className="text-xs font-medium text-slate-400">{i===0?'Seu objeto':'Objeto encontrado'}</span></div>
              {obj ? (<><p className="text-white text-sm font-medium mb-1 line-clamp-1">{obj.title}</p><p className="text-slate-500 text-xs line-clamp-2">{obj.description}</p><Link href={`/dashboard/objects/${obj.id}`} className="inline-flex items-center gap-1 text-brand-400 text-xs mt-2"><Package className="w-3 h-3" />Ver detalhes</Link></>) : <p className="text-slate-600 text-xs">Carregando...</p>}
            </div>
          ))}
        </div>
        {isPending && (
          <div className="flex gap-3">
            <button onClick={() => onAct(match.id,'confirm')} disabled={acting===match.id} className="flex-1 flex items-center justify-center gap-2 bg-brand-500 hover:bg-brand-400 disabled:opacity-50 text-white text-sm font-semibold py-2.5 rounded-xl transition-all glow-teal"><CheckCircle2 className="w-4 h-4" />Confirmar match</button>
            <button onClick={() => onAct(match.id,'reject')} disabled={acting===match.id} className="flex-1 flex items-center justify-center gap-2 glass hover:bg-surface text-slate-400 hover:text-white text-sm font-medium py-2.5 rounded-xl transition-all"><XCircle className="w-4 h-4" />Rejeitar</button>
          </div>
        )}
        {match.status==='confirmed' && (
          <button
            onClick={handleOpenChat}
            className="flex items-center justify-center gap-2 w-full bg-brand-500/10 hover:bg-brand-500/20 border border-brand-500/20 text-brand-400 text-sm font-medium py-2.5 rounded-xl transition-all"
          >
            <Shield className="w-3.5 h-3.5" />
            Abrir chat →
          </button>
        )}
      </div>
    </>
  );
}
