'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Link2, Search, Loader2, CheckCircle2, AlertTriangle, Info, ChevronRight } from 'lucide-react';
import { api, parseApiError } from '@/lib/api';
import { toast } from 'sonner';

const STATUS_LABEL: Record<string, string> = { lost: 'Perdido', found: 'Achado', stolen: 'Roubado' };

interface SubmitResult {
  ok?: boolean;
  created?: boolean;
  already_existed?: boolean;
  is_relevant?: boolean;
  id?: string | null;
  status?: string | null;
  message?: string;
  extracted?: {
    title: string;
    category: string;
    status_guess: string;
    location_text: string | null;
    has_contact_data: boolean;
  };
}

// ─── /admin/public-signals/submit ──────────────────────────────────────────
// Item 7 do canal de entrada manual: página dedicada, sem precisar de
// terminal/curl pro uso do dia a dia. Chama o mesmo
// POST /api/v1/admin/public-signals/submit já existente — nenhuma lógica
// nova aqui, só a interface.
export default function PublicSignalsSubmitPage() {
  const [url, setUrl] = useState('');
  const [sourceType, setSourceType] = useState<'institution' | 'press' | 'other'>('press');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SubmitResult | null>(null);
  const [errorDetail, setErrorDetail] = useState<string | null>(null);

  const handleAnalyze = async () => {
    if (!url.trim()) return;
    setLoading(true);
    setResult(null);
    setErrorDetail(null);
    try {
      const { data } = await api.post('/admin/public-signals/submit', {
        source_url: url.trim(),
        source_type: sourceType,
      });
      setResult(data);
      if (data?.created) toast.success('Candidato criado — entrou na fila de pendentes');
      else if (data?.already_existed) toast('Já existia — não duplicado', { icon: 'ℹ️' });
      else if (data?.is_relevant === false) toast('Não reconhecido como ocorrência relevante', { icon: '⚠️' });
    } catch (e) {
      setErrorDetail(parseApiError(e));
      toast.error(parseApiError(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-2xl space-y-5">
      <div>
        <Link href="/admin/public-signals" className="text-white/30 hover:text-white/60 text-xs flex items-center gap-1 mb-3 transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" /> Voltar pra fila
        </Link>
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          <Link2 className="w-5 h-5 text-teal-400" /> Submeter URL manualmente
        </h1>
        <p className="text-white/30 text-sm mt-0.5">
          Cole uma URL encontrada fora do pipeline automático (Perplexity, busca manual etc.) — roda a mesma extração do cron, sem esperar por ele.
        </p>
      </div>

      <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-5 space-y-4">
        <div>
          <label className="text-white/40 text-xs font-medium block mb-1.5">URL da fonte</label>
          <input
            type="url"
            value={url}
            onChange={e => setUrl(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !loading) handleAnalyze(); }}
            placeholder="https://..."
            autoFocus
            className="w-full px-3 py-2.5 rounded-lg bg-white/[0.03] border border-white/[0.08] text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-teal-500/40"
          />
        </div>

        <div>
          <label className="text-white/40 text-xs font-medium block mb-1.5">Tipo de fonte</label>
          <div className="flex gap-2">
            {([
              { key: 'institution', label: 'Institucional' },
              { key: 'press',       label: 'Imprensa' },
              { key: 'other',       label: 'Outro' },
            ] as const).map(opt => (
              <button
                key={opt.key}
                onClick={() => setSourceType(opt.key)}
                className={`px-3.5 py-2 rounded-lg text-xs font-medium transition-all ${sourceType === opt.key ? 'bg-teal-500/15 text-teal-400 border border-teal-500/30' : 'text-white/40 border border-white/[0.07] hover:text-white'}`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={handleAnalyze}
          disabled={loading || !url.trim()}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-teal-500/15 text-teal-400 border border-teal-500/30 text-sm font-medium hover:bg-teal-500/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          Analisar
        </button>
      </div>

      {/* Resultado */}
      {errorDetail && (
        <div className="rounded-xl border border-red-500/25 bg-red-500/10 p-4 flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
          <p className="text-red-300 text-sm">{errorDetail}</p>
        </div>
      )}

      {result && (
        <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-5 space-y-3">
          <div className="flex items-center gap-2">
            {result.created ? (
              <CheckCircle2 className="w-4 h-4 text-teal-400" />
            ) : result.already_existed ? (
              <Info className="w-4 h-4 text-white/40" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-amber-400" />
            )}
            <p className={`text-sm font-medium ${result.created ? 'text-teal-400' : result.already_existed ? 'text-white/60' : 'text-amber-400'}`}>
              {result.message}
            </p>
          </div>

          {result.extracted && (
            <div className="rounded-lg bg-black/20 border border-white/[0.06] p-3.5 space-y-1.5 text-sm">
              <p className="text-white/80"><span className="text-white/35">Título:</span> {result.extracted.title}</p>
              <p className="text-white/80">
                <span className="text-white/35">Categoria:</span> {result.extracted.category}
                {' · '}
                <span className="text-white/35">Status:</span> {STATUS_LABEL[result.extracted.status_guess] ?? result.extracted.status_guess}
              </p>
              <p className="text-white/80"><span className="text-white/35">Localização:</span> {result.extracted.location_text ?? '(não identificada)'}</p>
              <p className={result.extracted.has_contact_data ? 'text-amber-400' : 'text-white/40'}>
                Contato detectado: {result.extracted.has_contact_data ? 'sim' : 'não'}
              </p>
            </div>
          )}

          {result.id && (
            <Link
              href="/admin/public-signals"
              className="flex items-center gap-1.5 text-teal-400 hover:text-teal-300 text-xs font-medium transition-colors"
            >
              Ver na fila de aprovação
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          )}

          {(result.created || result.already_existed) && (
            <button
              onClick={() => { setUrl(''); setResult(null); }}
              className="text-white/30 hover:text-white/60 text-xs transition-colors"
            >
              Analisar outra URL
            </button>
          )}
        </div>
      )}
    </div>
  );
}
