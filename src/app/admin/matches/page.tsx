'use client';

import { useEffect, useState, useCallback } from 'react';
import { Zap, CheckCircle2, XCircle, Clock, RefreshCw, Loader2 } from 'lucide-react';
import { api, parseApiError } from '@/lib/api';
import { toast } from 'sonner';

interface Match {
  id: string;
  status: string;
  score: number; // 0–100 (inteiro vindo do banco)
  lost_title: string;
  found_title: string;
  lost_category?: string;
  found_category?: string;
  created_at: string;
}

const SCORE_COLOR = (score: number) =>
  score >= 80 ? 'text-green-400' : score >= 55 ? 'text-yellow-400' : 'text-red-400';

const SCORE_BG = (score: number) =>
  score >= 80
    ? 'bg-green-500/10 border-green-500/20'
    : score >= 55
    ? 'bg-yellow-500/10 border-yellow-500/20'
    : 'bg-red-500/10 border-red-500/20';

export default function AdminMatches() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('pending');
  const [runningAll, setRunningAll] = useState(false);
  const [total, setTotal] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (filter !== 'all') params.status = filter;
      const { data } = await api.get('/admin/matches', { params });
      // Normaliza os campos: o banco retorna lost_title, found_title, score
      const items = (data?.items ?? []).map((m: Record<string, unknown>) => ({
        id: m.id,
        status: m.status,
        score: typeof m.score === 'number' ? m.score : parseFloat(String(m.score ?? '0')),
        lost_title: String(m.lost_title ?? m.object_title ?? 'Sem título'),
        found_title: String(m.found_title ?? m.matched_title ?? 'Sem título'),
        lost_category: m.lost_category,
        found_category: m.found_category,
        created_at: m.created_at,
      }));
      setMatches(items);
      setTotal(data?.total ?? items.length);
    } catch {
      setMatches([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  const handleMatch = async (id: string, action: 'confirm' | 'reject') => {
    try {
      const status = action === 'confirm' ? 'confirmed' : 'rejected';
      await api.patch(`/admin/matches/${id}`, { status });
      toast.success(action === 'confirm' ? 'Match confirmado!' : 'Match rejeitado');
      load();
    } catch (e) { toast.error(parseApiError(e)); }
  };

  const runAllMatching = async () => {
    setRunningAll(true);
    try {
      const { data } = await api.post('/admin/matching/run-all');
      toast.success(data?.message ?? 'Matching concluído');
      setTimeout(load, 1500);
    } catch (e) { toast.error(parseApiError(e)); }
    finally { setRunningAll(false); }
  };

  const counts = {
    pending:   matches.filter(m => m.status === 'pending').length,
    confirmed: matches.filter(m => m.status === 'confirmed').length,
    rejected:  matches.filter(m => m.status === 'rejected').length,
  };

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Matches</h1>
          <p className="text-white/30 text-sm mt-0.5">Cruzamento automático por IA</p>
        </div>
        <button onClick={runAllMatching} disabled={runningAll}
          className="flex items-center gap-2 bg-teal-500 hover:bg-teal-400 disabled:opacity-60 text-black text-sm font-semibold px-4 py-2.5 rounded-xl transition-all">
          {runningAll ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
          Rodar matching
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Pendentes',   value: counts.pending,   icon: Clock,        color: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20' },
          { label: 'Confirmados', value: counts.confirmed, icon: CheckCircle2, color: 'text-green-400 bg-green-500/10 border-green-500/20' },
          { label: 'Rejeitados',  value: counts.rejected,  icon: XCircle,      color: 'text-red-400 bg-red-500/10 border-red-500/20' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className={`flex items-center gap-3 p-4 rounded-2xl border ${color}`}>
            <Icon className="w-5 h-5 flex-shrink-0" />
            <div>
              <p className="text-xl font-bold text-white">{value}</p>
              <p className="text-xs opacity-60">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filter */}
      <div className="flex gap-2">
        {['all','pending','confirmed','rejected'].map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-3 py-2 rounded-xl text-xs font-medium transition-all ${filter === f ? 'bg-teal-500/15 text-teal-400 border border-teal-500/30' : 'bg-white/[0.03] text-white/40 border border-white/[0.07] hover:text-white'}`}>
            {f === 'all' ? 'Todos' : f === 'pending' ? 'Pendentes' : f === 'confirmed' ? 'Confirmados' : 'Rejeitados'}
          </button>
        ))}
        <button onClick={load} className="ml-auto w-9 h-9 flex items-center justify-center text-white/30 hover:text-white rounded-xl border border-white/[0.07] hover:bg-white/[0.04] transition-all">
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Matches list */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-24 bg-white/[0.02] rounded-2xl animate-pulse" />)}
        </div>
      ) : matches.length === 0 ? (
        <div className="text-center py-16 text-white/20">
          <Zap className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>Nenhum match {filter !== 'all' ? `com status "${filter}"` : ''}</p>
          {filter === 'pending' && (
            <p className="text-xs mt-2 text-white/10">Clique em "Rodar matching" para gerar novos matches</p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {matches.map(match => {
            // score vem como 0-100 do banco; garante que não seja NaN
            const displayScore = isNaN(match.score) ? 0 : Math.round(match.score);
            return (
              <div key={match.id} className="bg-white/[0.02] border border-white/[0.07] rounded-2xl p-4 hover:border-white/[0.12] transition-all">
                <div className="flex items-start gap-4">
                  {/* Score */}
                  <div className={`flex-shrink-0 w-14 h-14 rounded-xl border flex flex-col items-center justify-center ${SCORE_BG(displayScore)}`}>
                    <p className={`text-lg font-bold leading-none ${SCORE_COLOR(displayScore)}`}>
                      {displayScore}
                    </p>
                    <p className="text-white/20 text-[9px] mt-0.5">%</p>
                  </div>

                  {/* Objects */}
                  <div className="flex-1 min-w-0">
                    <div className="grid grid-cols-2 gap-3 mb-3">
                      <div className="bg-red-500/[0.04] border border-red-500/10 rounded-xl p-3">
                        <p className="text-[10px] text-red-400/60 uppercase tracking-wider mb-1">Perdido</p>
                        <p className="text-white text-sm font-medium truncate">{match.lost_title}</p>
                        {match.lost_category && <p className="text-white/30 text-xs truncate">{match.lost_category}</p>}
                      </div>
                      <div className="bg-teal-500/[0.04] border border-teal-500/10 rounded-xl p-3">
                        <p className="text-[10px] text-teal-400/60 uppercase tracking-wider mb-1">Achado</p>
                        <p className="text-white text-sm font-medium truncate">{match.found_title}</p>
                        {match.found_category && <p className="text-white/30 text-xs truncate">{match.found_category}</p>}
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <p className="text-white/20 text-xs">
                        {new Date(match.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </p>
                      {match.status === 'pending' && (
                        <div className="flex gap-2">
                          <button onClick={() => handleMatch(match.id, 'reject')}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-red-400 bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 transition-all">
                            <XCircle className="w-3 h-3" /> Rejeitar
                          </button>
                          <button onClick={() => handleMatch(match.id, 'confirm')}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-green-400 bg-green-500/10 border border-green-500/20 hover:bg-green-500/20 transition-all">
                            <CheckCircle2 className="w-3 h-3" /> Confirmar
                          </button>
                        </div>
                      )}
                      {match.status !== 'pending' && (
                        <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${match.status === 'confirmed' ? 'text-green-400 bg-green-500/10 border-green-500/20' : 'text-red-400 bg-red-500/10 border-red-500/20'}`}>
                          {match.status === 'confirmed' ? '✓ Confirmado' : '✕ Rejeitado'}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
