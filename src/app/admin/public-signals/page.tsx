'use client';

import { useState, useEffect, useCallback } from 'react';
import { Radar, Newspaper, Building2, Megaphone, CheckCircle2, XCircle, RefreshCw, Loader2, ExternalLink, MapPin, ShieldAlert, Link2, Send } from 'lucide-react';
import { api, parseApiError } from '@/lib/api';
import { toast } from 'sonner';

interface ExtractedFields {
  title: string;
  category: string;
  status_guess: string;
  location_text: string | null;
  confidence_score: number;
  raw_title?: string;
}

interface Evidence {
  id: string;
  source_url: string;
  source_type: 'press_rss' | 'institution' | 'google_alert_corroboration' | 'manual_other';
  has_contact_data: boolean;
  extracted_fields: ExtractedFields | null;
  status: string;
  captured_at: string;
}

const SOURCE_STYLE: Record<string, { icon: typeof Newspaper; label: string; color: string }> = {
  press_rss:                    { icon: Newspaper, label: 'Imprensa',      color: 'text-blue-400 bg-blue-500/10 border-blue-500/20' },
  institution:                  { icon: Building2,  label: 'Instituição',  color: 'text-teal-400 bg-teal-500/10 border-teal-500/20' },
  google_alert_corroboration:   { icon: Megaphone,  label: 'Alerta',       color: 'text-purple-400 bg-purple-500/10 border-purple-500/20' },
  manual_other:                 { icon: Link2,      label: 'Manual',       color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
};

interface SubmitResult {
  ok?: boolean;
  created?: boolean;
  already_existed?: boolean;
  is_relevant?: boolean;
  status?: string;
  message?: string;
  extracted?: {
    title: string;
    category: string;
    status_guess: string;
    location_text: string | null;
    has_contact_data: boolean;
  };
}

const STATUS_LABEL: Record<string, string> = { lost: 'Perdido', found: 'Achado', stolen: 'Roubado' };

export default function AdminPublicSignals() {
  const [items, setItems] = useState<Evidence[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('pending');
  const [total, setTotal] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);
  const [acting, setActing] = useState<string | null>(null);

  // ── Submissão manual (canal de entrada avulsa, sem esperar o cron) ──────
  const [submitUrl, setSubmitUrl] = useState('');
  const [submitType, setSubmitType] = useState<'institution' | 'press' | 'other'>('press');
  const [submitting, setSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<SubmitResult | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/admin/public-signals', { params: { status: filter } });
      setItems(data?.items ?? []);
      setTotal(data?.total ?? 0);
      setPendingCount(data?.pending ?? 0);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  const handleSubmitUrl = async () => {
    if (!submitUrl.trim()) return;
    setSubmitting(true);
    setSubmitResult(null);
    try {
      const { data } = await api.post('/admin/public-signals/submit', {
        source_url: submitUrl.trim(),
        source_type: submitType,
      });
      setSubmitResult(data);
      if (data?.created) {
        toast.success('Evidência criada — entrou na fila de pendentes');
        setSubmitUrl('');
        if (filter === 'pending') load();
      } else if (data?.already_existed) {
        toast('Já existia — não duplicado', { icon: 'ℹ️' });
      } else if (data?.is_relevant === false) {
        toast('Extraído, mas não reconhecido como ocorrência relevante', { icon: '⚠️' });
      }
    } catch (e) {
      const message = parseApiError(e);
      setSubmitResult({ message });
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleAction = async (evidenceId: string, action: 'approve' | 'reject') => {
    const label = action === 'approve' ? 'Aprovar e publicar no mapa' : 'Rejeitar';
    if (!confirm(`Confirmar: ${label}?`)) return;
    setActing(evidenceId);
    try {
      const { data } = await api.post('/admin/public-signals', { evidence_id: evidenceId, action });
      if (action === 'approve') {
        toast.success(data?.geocoded ? 'Aprovado e publicado no mapa' : 'Aprovado — sem localização geocodificada, não aparece como pin ainda');
      } else {
        toast.success('Rejeitado');
      }
      load();
    } catch (e) {
      toast.error(parseApiError(e));
    } finally {
      setActing(null);
    }
  };

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Radar className="w-5 h-5 text-teal-400" /> Public Signals
          </h1>
          <p className="text-white/30 text-sm mt-0.5">Ocorrências coletadas de fontes públicas, aguardando revisão manual antes de publicar</p>
        </div>
        <div className="flex items-center gap-2">
          {pendingCount > 0 && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-yellow-500/10 border border-yellow-500/20">
              <ShieldAlert className="w-3.5 h-3.5 text-yellow-400" />
              <span className="text-yellow-400 text-xs font-medium">{pendingCount} pendente{pendingCount > 1 ? 's' : ''}</span>
            </div>
          )}
          <button onClick={load} className="w-9 h-9 flex items-center justify-center text-white/30 hover:text-white rounded-xl border border-white/[0.07] hover:bg-white/[0.04] transition-all">
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Submissão manual — achou uma URL fora do pipeline automático (ex:
          via Perplexity, busca manual) e quer submeter sem esperar o cron */}
      <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4 space-y-3">
        <p className="text-white/50 text-xs font-medium flex items-center gap-1.5">
          <Link2 className="w-3.5 h-3.5" /> Submeter URL manualmente
        </p>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="url"
            value={submitUrl}
            onChange={e => setSubmitUrl(e.target.value)}
            placeholder="https://..."
            className="flex-1 px-3 py-2 rounded-lg bg-white/[0.03] border border-white/[0.08] text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-teal-500/40"
          />
          <select
            value={submitType}
            onChange={e => setSubmitType(e.target.value as 'institution' | 'press' | 'other')}
            className="px-3 py-2 rounded-lg bg-white/[0.03] border border-white/[0.08] text-white text-sm focus:outline-none focus:border-teal-500/40"
          >
            <option value="institution">Institucional</option>
            <option value="press">Imprensa</option>
            <option value="other">Outro</option>
          </select>
          <button
            onClick={handleSubmitUrl}
            disabled={submitting || !submitUrl.trim()}
            className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-teal-500/15 text-teal-400 border border-teal-500/30 text-sm font-medium hover:bg-teal-500/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Submeter
          </button>
        </div>

        {/* Resultado — pra confirmar visualmente que a extração fez sentido
            antes de seguir pra próxima submissão */}
        {submitResult && (
          <div className="rounded-lg border border-white/[0.07] bg-black/20 p-3 text-xs space-y-1.5">
            {submitResult.extracted ? (
              <>
                <p className="text-white/70"><span className="text-white/40">Título:</span> {submitResult.extracted.title}</p>
                <p className="text-white/70"><span className="text-white/40">Categoria:</span> {submitResult.extracted.category} · <span className="text-white/40">Status:</span> {STATUS_LABEL[submitResult.extracted.status_guess] ?? submitResult.extracted.status_guess}</p>
                <p className="text-white/70"><span className="text-white/40">Localização:</span> {submitResult.extracted.location_text ?? '(não identificada)'}</p>
                <p className={submitResult.extracted.has_contact_data ? 'text-amber-400' : 'text-white/40'}>
                  Contato detectado: {submitResult.extracted.has_contact_data ? 'sim' : 'não'}
                </p>
              </>
            ) : null}
            <p className={submitResult.created ? 'text-teal-400' : submitResult.already_existed ? 'text-white/40' : 'text-amber-400'}>
              {submitResult.message}
            </p>
          </div>
        )}
      </div>

      {/* Filtros */}
      <div className="flex gap-2">
        {[
          { key: 'pending',  label: 'Pendentes' },
          { key: 'approved', label: 'Aprovados' },
          { key: 'rejected', label: 'Rejeitados' },
        ].map(f => (
          <button key={f.key} onClick={() => setFilter(f.key)}
            className={`px-3 py-2 rounded-xl text-xs font-medium transition-all ${filter === f.key ? 'bg-teal-500/15 text-teal-400 border border-teal-500/30' : 'text-white/40 border border-white/[0.07] hover:text-white'}`}>
            {f.label}
          </button>
        ))}
      </div>

      {/* Lista */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 text-teal-500 animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-16 text-white/20">
          <Radar className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>Nenhuma evidência com status &quot;{filter}&quot;</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map(item => {
            const fields = item.extracted_fields;
            const src = SOURCE_STYLE[item.source_type] ?? SOURCE_STYLE.press_rss;
            const SrcIcon = src.icon;
            return (
              <div key={item.id} className={`bg-white/[0.02] border rounded-2xl p-4 transition-all ${item.status === 'pending' ? 'border-yellow-500/20' : 'border-white/[0.07]'}`}>
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-xl bg-teal-500/10 flex items-center justify-center flex-shrink-0">
                      <Radar className="w-4 h-4 text-teal-400" />
                    </div>
                    <div>
                      <p className="text-white text-sm font-medium">{fields?.title || '(sem título extraído)'}</p>
                      <div className="flex flex-wrap items-center gap-2 mt-1.5">
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${src.color}`}>
                          <SrcIcon className="w-2.5 h-2.5 inline mr-1 -mt-0.5" />{src.label}
                        </span>
                        {fields?.status_guess && (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border text-white/50 bg-white/[0.04] border-white/[0.08]">
                            {STATUS_LABEL[fields.status_guess] ?? fields.status_guess}
                          </span>
                        )}
                        {fields?.category && (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border text-white/50 bg-white/[0.04] border-white/[0.08] capitalize">
                            {fields.category}
                          </span>
                        )}
                        {fields?.location_text && (
                          <span className="text-white/30 text-xs flex items-center gap-0.5">
                            <MapPin className="w-3 h-3" /> {fields.location_text}
                          </span>
                        )}
                        {item.has_contact_data && (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border text-orange-400 bg-orange-500/10 border-orange-500/20">
                            Contato sensível
                          </span>
                        )}
                      </div>
                      <a href={item.source_url} target="_blank" rel="noopener noreferrer"
                         className="text-white/20 text-xs mt-1.5 flex items-center gap-1 hover:text-white/40 transition-colors truncate max-w-md">
                        <ExternalLink className="w-3 h-3 flex-shrink-0" /> {item.source_url}
                      </a>
                    </div>
                  </div>
                  <span className="text-white/20 text-xs whitespace-nowrap">
                    {new Date(item.captured_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>

                {item.status === 'pending' && (
                  <div className="flex flex-wrap gap-2 pt-2 border-t border-white/[0.06]">
                    <button
                      onClick={() => handleAction(item.id, 'approve')}
                      disabled={acting === item.id}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-green-400 bg-green-500/10 border border-green-500/20 hover:bg-green-500/20 transition-all disabled:opacity-50">
                      <CheckCircle2 className="w-3 h-3" /> Aprovar e publicar
                    </button>
                    <button
                      onClick={() => handleAction(item.id, 'reject')}
                      disabled={acting === item.id}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-red-400 bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 transition-all disabled:opacity-50">
                      <XCircle className="w-3 h-3" /> Rejeitar
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {total > items.length && (
        <p className="text-center text-white/20 text-xs">
          Mostrando {items.length} de {total}
        </p>
      )}
    </div>
  );
}
