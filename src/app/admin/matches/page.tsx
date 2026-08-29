'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Zap, CheckCircle2, XCircle, Clock, RefreshCw, Loader2, ExternalLink, Phone } from 'lucide-react';
import { api, parseApiError } from '@/lib/api';
import { toast } from 'sonner';

interface Match {
  id: string;
  status: string;
  score: number; // 0–100 (inteiro vindo do banco)
  lost_id?: string;
  found_id?: string;
  lost_title: string;
  found_title: string;
  lost_category?: string;
  found_category?: string;
  created_at: string;
  // Contact Resolver (29/08/2026) — true quando o lado é Public Signal com
  // contato capturado na extração original, e portanto NÃO recebe a
  // notificação automática de match (essa só existe pra conta de usuário
  // real). Ver comentário completo em admin/matches/route.ts.
  lost_needs_contact?: boolean;
  found_needs_contact?: boolean;
  latest_contact_channel?: string;
  latest_contact_status?: string;
  latest_contact_at?: string;
}

const CONTACT_CHANNELS = [
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'ligacao', label: 'Ligação' },
  { value: 'sms', label: 'SMS' },
  { value: 'outro', label: 'Outro' },
];

const CONTACT_STATUSES = [
  { value: 'conectou', label: 'Conectou' },
  { value: 'nao_atendeu', label: 'Não atendeu' },
  { value: 'numero_invalido', label: 'Número inválido' },
  { value: 'recusou', label: 'Recusou' },
  { value: 'outro', label: 'Outro' },
];

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
  // Contact Resolver: qual "lado:objectId" tem o formulário de registro
  // aberto no momento (null = nenhum). Só um por vez, pra manter simples.
  const [openContactForm, setOpenContactForm] = useState<string | null>(null);
  const [contactForm, setContactForm] = useState({ channel: 'whatsapp', status: 'conectou', notes: '' });
  const [submittingContact, setSubmittingContact] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      // "needs_contact" não é um status de verdade — é um filtro à parte
      // (pelo menos um lado é Public Signal com contato capturado, sem
      // conta de usuário real pra notificação automática). Sempre
      // restrito a pending: um match já confirmado/rejeitado não precisa
      // mais de ação.
      if (filter === 'needs_contact') {
        params.status = 'pending';
        params.needs_contact = 'true';
      } else if (filter !== 'all') {
        params.status = filter;
      }
      const { data } = await api.get('/admin/matches', { params });
      // Normaliza os campos: o banco retorna lost_title, found_title, score
      const items = (data?.items ?? []).map((m: Record<string, unknown>) => ({
        id: m.id,
        status: m.status,
        score: typeof m.score === 'number' ? m.score : parseFloat(String(m.score ?? '0')),
        lost_id: m.lost_id,
        found_id: m.found_id,
        lost_title: String(m.lost_title ?? m.object_title ?? 'Sem título'),
        found_title: String(m.found_title ?? m.matched_title ?? 'Sem título'),
        lost_category: m.lost_category,
        found_category: m.found_category,
        created_at: m.created_at,
        lost_needs_contact: Boolean(m.lost_needs_contact),
        found_needs_contact: Boolean(m.found_needs_contact),
        latest_contact_channel: m.latest_contact_channel,
        latest_contact_status: m.latest_contact_status,
        latest_contact_at: m.latest_contact_at,
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

  const submitContactAttempt = async (matchId: string, objectId: string) => {
    setSubmittingContact(true);
    try {
      await api.post(`/admin/matches/${matchId}/contact-attempts`, {
        object_id: objectId,
        channel: contactForm.channel,
        status: contactForm.status,
        notes: contactForm.notes || undefined,
      });
      toast.success('Tentativa de contato registrada');
      setOpenContactForm(null);
      setContactForm({ channel: 'whatsapp', status: 'conectou', notes: '' });
      load();
    } catch (e) { toast.error(parseApiError(e)); }
    finally { setSubmittingContact(false); }
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
        {['all','pending','confirmed','rejected','needs_contact'].map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-3 py-2 rounded-xl text-xs font-medium transition-all flex items-center gap-1.5 ${filter === f ? 'bg-teal-500/15 text-teal-400 border border-teal-500/30' : 'bg-white/[0.03] text-white/40 border border-white/[0.07] hover:text-white'}`}>
            {f === 'needs_contact' && <Phone className="w-3 h-3" />}
            {f === 'all' ? 'Todos' : f === 'pending' ? 'Pendentes' : f === 'confirmed' ? 'Confirmados' : f === 'rejected' ? 'Rejeitados' : 'Precisa de contato manual'}
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
                      {/* Cards viram link pro detalhe do objeto (nova aba) — revisão
                          humana mais rápida enquanto não há histórico suficiente pra
                          ajustar o filtro de matching sozinho (pedido de Marcos,
                          26/08/2026). Sem lost_id/found_id (registro órfão raro),
                          cai pro <div> estático de antes. */}
                      {match.lost_id ? (
                        <Link href={`/admin/objects/${match.lost_id}`} target="_blank"
                          className="group bg-red-500/[0.04] border border-red-500/10 rounded-xl p-3 hover:bg-red-500/[0.08] hover:border-red-500/25 transition-all cursor-pointer">
                          <p className="text-[10px] text-red-400/60 uppercase tracking-wider mb-1 flex items-center gap-1">
                            Perdido <ExternalLink className="w-2.5 h-2.5 opacity-0 group-hover:opacity-60 transition-opacity" />
                          </p>
                          <p className="text-white text-sm font-medium truncate">{match.lost_title}</p>
                          {match.lost_category && <p className="text-white/30 text-xs truncate">{match.lost_category}</p>}
                        </Link>
                      ) : (
                        <div className="bg-red-500/[0.04] border border-red-500/10 rounded-xl p-3">
                          <p className="text-[10px] text-red-400/60 uppercase tracking-wider mb-1">Perdido</p>
                          <p className="text-white text-sm font-medium truncate">{match.lost_title}</p>
                          {match.lost_category && <p className="text-white/30 text-xs truncate">{match.lost_category}</p>}
                        </div>
                      )}
                      {match.found_id ? (
                        <Link href={`/admin/objects/${match.found_id}`} target="_blank"
                          className="group bg-teal-500/[0.04] border border-teal-500/10 rounded-xl p-3 hover:bg-teal-500/[0.08] hover:border-teal-500/25 transition-all cursor-pointer">
                          <p className="text-[10px] text-teal-400/60 uppercase tracking-wider mb-1 flex items-center gap-1">
                            Achado <ExternalLink className="w-2.5 h-2.5 opacity-0 group-hover:opacity-60 transition-opacity" />
                          </p>
                          <p className="text-white text-sm font-medium truncate">{match.found_title}</p>
                          {match.found_category && <p className="text-white/30 text-xs truncate">{match.found_category}</p>}
                        </Link>
                      ) : (
                        <div className="bg-teal-500/[0.04] border border-teal-500/10 rounded-xl p-3">
                          <p className="text-[10px] text-teal-400/60 uppercase tracking-wider mb-1">Achado</p>
                          <p className="text-white text-sm font-medium truncate">{match.found_title}</p>
                          {match.found_category && <p className="text-white/30 text-xs truncate">{match.found_category}</p>}
                        </div>
                      )}
                    </div>

                    {/* Contact Resolver (29/08/2026) — aparece só quando pelo
                        menos um lado é Public Signal com contato capturado,
                        já que esse lado não recebe notificação automática
                        (achado real: match de 84% entre dois Public Signals
                        ficou pendente sem ninguém saber, até ser notado por
                        acaso). Um botão por lado, já que cada lado pode
                        precisar de contato separado. */}
                    {(match.lost_needs_contact || match.found_needs_contact) && (
                      <div className="mb-3 p-3 rounded-xl bg-amber-500/[0.06] border border-amber-500/20">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <div className="flex items-center gap-1.5 text-amber-400 text-xs font-medium">
                            <Phone className="w-3.5 h-3.5" />
                            Precisa de contato manual
                            {match.latest_contact_status && (
                              <span className="text-white/40 font-normal">
                                — última tentativa: {CONTACT_STATUSES.find(s => s.value === match.latest_contact_status)?.label ?? match.latest_contact_status}
                                {match.latest_contact_at && ` (${new Date(match.latest_contact_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })})`}
                              </span>
                            )}
                          </div>
                          <div className="flex gap-2">
                            {match.lost_needs_contact && match.lost_id && (
                              <button
                                onClick={() => setOpenContactForm(openContactForm === `${match.id}:${match.lost_id}` ? null : `${match.id}:${match.lost_id}`)}
                                className="text-xs px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/20 transition-all">
                                Registrar (lado perdido)
                              </button>
                            )}
                            {match.found_needs_contact && match.found_id && (
                              <button
                                onClick={() => setOpenContactForm(openContactForm === `${match.id}:${match.found_id}` ? null : `${match.id}:${match.found_id}`)}
                                className="text-xs px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/20 transition-all">
                                Registrar (lado achado)
                              </button>
                            )}
                          </div>
                        </div>

                        {[match.lost_id, match.found_id].map(objectId => {
                          if (!objectId || openContactForm !== `${match.id}:${objectId}`) return null;
                          return (
                            <div key={objectId} className="mt-3 pt-3 border-t border-amber-500/10 space-y-2">
                              <div className="flex gap-2">
                                <select value={contactForm.channel}
                                  onChange={e => setContactForm(f => ({ ...f, channel: e.target.value }))}
                                  className="flex-1 bg-white/[0.04] border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white">
                                  {CONTACT_CHANNELS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                                </select>
                                <select value={contactForm.status}
                                  onChange={e => setContactForm(f => ({ ...f, status: e.target.value }))}
                                  className="flex-1 bg-white/[0.04] border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white">
                                  {CONTACT_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                                </select>
                              </div>
                              <textarea value={contactForm.notes}
                                onChange={e => setContactForm(f => ({ ...f, notes: e.target.value }))}
                                placeholder="Notas (opcional)"
                                rows={2}
                                className="w-full bg-white/[0.04] border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white placeholder:text-white/20 resize-none" />
                              <div className="flex justify-end gap-2">
                                <button onClick={() => setOpenContactForm(null)}
                                  className="text-xs px-3 py-1.5 rounded-lg text-white/40 hover:text-white transition-all">
                                  Cancelar
                                </button>
                                <button onClick={() => submitContactAttempt(match.id, objectId)} disabled={submittingContact}
                                  className="text-xs px-3 py-1.5 rounded-lg bg-amber-500 text-black font-medium disabled:opacity-60 transition-all">
                                  Salvar
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

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
