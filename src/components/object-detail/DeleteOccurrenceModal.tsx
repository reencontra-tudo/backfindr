'use client';

/**
 * Modal de exclusão de ocorrência (dono) — substitui o confirm() nativo.
 * Princípios: uma pergunta de um toque, NUNCA obrigatória ("Prefiro não dizer" sempre disponível); alternativas que
 * resolvem em vez de só registrar o motivo; aviso honesto sobre compartilhamentos; sem pressão emocional nem falsa urgência.
 * A decisão de cada passo vem de src/lib/governance.ts (testada). Texto livre: máximo de REASON_TEXT_MAX, tratado como dado.
 */

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { X, Loader2 } from 'lucide-react';
import { objectsApi, parseApiError } from '@/lib/api';
import {
  OWNER_REASONS, REASON_TEXT_MAX, SHARE_WARNING, modalStepFor, retentionDays, retentionNotice, type ModalStep,
} from '@/lib/governance';

export interface DeleteModalResult {
  kind: 'deleted' | 'recovered' | 'paused';
  reason?: string;
  restorableUntil?: string;
}

interface Props {
  objectId: string;
  title: string;
  open: boolean;
  onClose: () => void;
  onDone: (r: DeleteModalResult) => void;
}

interface Similar { id: string; title: string; status: string; created_at: string }

export default function DeleteOccurrenceModal({ objectId, title, open, onClose, onDone }: Props) {
  const [step, setStep] = useState<'reasons' | ModalStep>('reasons');
  const [reason, setReason] = useState<string>('nao_informado');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [similar, setSimilar] = useState<Similar[] | null>(null);
  const firstFocus = useRef<HTMLButtonElement | null>(null);
  const days = retentionDays();

  useEffect(() => {
    if (!open) { setStep('reasons'); setReason('nao_informado'); setText(''); setBusy(false); setError(null); setSimilar(null); }
    else setTimeout(() => firstFocus.current?.focus(), 0);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !busy) onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, busy, onClose]);

  if (!open) return null;

  const choose = (code: string) => {
    setReason(code); setError(null);
    const next = modalStepFor(code);
    setStep(next);
    if (next === 'duplicates') {
      setSimilar(null);
      objectsApi.similar(objectId).then(({ data }) => setSimilar((data?.items ?? data?.data?.items ?? []) as Similar[])).catch(() => setSimilar([]));
    }
  };

  const run = async (fn: () => Promise<DeleteModalResult>) => {
    setBusy(true); setError(null);
    try { onDone(await fn()); } catch (err) { setError(parseApiError(err)); setBusy(false); }
  };

  const doDelete = (code: string) => run(async () => {
    const body: { reason: string; reason_text?: string } = { reason: code };
    if (code === 'outro' && text.trim()) body.reason_text = text.trim().slice(0, REASON_TEXT_MAX);
    const { data } = await objectsApi.delete(objectId, body);
    const d = (data?.data ?? data) as { restorable_until?: string };
    return { kind: 'deleted', reason: code, restorableUntil: d?.restorable_until };
  });
  const doRecovered = (helped?: 'sim' | 'nao') => run(async () => { await objectsApi.recovered(objectId, helped); return { kind: 'recovered' }; });
  const doPause = () => run(async () => { await objectsApi.pause(objectId, true); return { kind: 'paused' }; });

  const btn = 'min-h-[44px] px-4 rounded-xl text-sm font-medium transition-colors disabled:opacity-50';
  const secondary = `${btn} border border-white/10 text-white/70 hover:bg-white/5`;
  const primary = `${btn} bg-brand-500 hover:bg-brand-400 text-white`;
  const danger = `${btn} bg-red-500/90 hover:bg-red-500 text-white`;

  return (
    <div className="fixed inset-0 z-[10000] flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4" role="presentation"
         onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) onClose(); }}>
      <div role="dialog" aria-modal="true" aria-labelledby="del-title"
           className="w-full sm:max-w-md bg-[#0b1220] border border-white/10 rounded-t-2xl sm:rounded-2xl p-5 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between gap-3">
          <h2 id="del-title" className="text-white font-semibold text-base">
            {step === 'reasons' ? 'Quer excluir esta ocorrência?' : 'Excluir ocorrência'}
          </h2>
          <button onClick={onClose} disabled={busy} aria-label="Fechar" className="w-11 h-11 -m-2 flex items-center justify-center text-white/50 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>
        <p className="text-white/50 text-xs truncate">“{title}”</p>

        {step === 'reasons' && (
          <div className="space-y-2">
            <p className="text-white/70 text-sm">Se quiser, conte o motivo — é opcional e ajuda a melhorar o Backfindr.</p>
            {OWNER_REASONS.map((r, i) => (
              <button key={r.code} ref={i === 0 ? firstFocus : undefined} onClick={() => choose(r.code)}
                      className="w-full text-left min-h-[48px] px-4 rounded-xl border border-white/10 text-white/85 text-sm hover:bg-white/5">
                {r.label}
              </button>
            ))}
            <button onClick={onClose} className={`${secondary} w-full mt-1`}>Manter a ocorrência</button>
          </div>
        )}

        {step === 'recovered' && (
          <div className="space-y-3">
            <p className="text-white/80 text-sm">Que bom! Em vez de excluir, você pode <b>marcar como recuperado</b>: o cartão e o QR passam a mostrar que foi recuperado.</p>
            <p className="text-white/60 text-xs">O Backfindr ajudou? (opcional)</p>
            <div className="grid grid-cols-3 gap-2">
              <button disabled={busy} onClick={() => doRecovered('sim')} className={primary}>Sim</button>
              <button disabled={busy} onClick={() => doRecovered('nao')} className={secondary}>Não</button>
              <button disabled={busy} onClick={() => doRecovered()} className={secondary}>Pular</button>
            </div>
            <button disabled={busy} onClick={() => setStep('confirm')} className="text-white/50 text-xs underline min-h-[44px]">Prefiro excluir mesmo assim</button>
          </div>
        )}

        {step === 'duplicates' && (
          <div className="space-y-3">
            {similar === null && <p className="text-white/60 text-sm flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Procurando ocorrências parecidas…</p>}
            {similar !== null && similar.length === 0 && <p className="text-white/70 text-sm">Não encontramos outra ocorrência parecida sua. Se for mesmo repetida, você pode excluir esta.</p>}
            {similar !== null && similar.length > 0 && (
              <>
                <p className="text-white/80 text-sm">Encontramos {similar.length === 1 ? 'esta ocorrência parecida' : 'estas ocorrências parecidas'} no seu cadastro. Mantendo a outra, só esta será excluída:</p>
                <ul className="space-y-1">
                  {similar.map((s) => (
                    <li key={s.id}><Link href={`/dashboard/objects/${s.id}`} className="block min-h-[44px] px-3 py-2 rounded-lg border border-white/10 text-white/80 text-sm hover:bg-white/5 truncate">{s.title}</Link></li>
                  ))}
                </ul>
              </>
            )}
            <div className="flex gap-2 justify-end pt-1">
              <button onClick={onClose} disabled={busy} className={secondary}>Cancelar</button>
              <button onClick={() => setStep('confirm')} disabled={busy || similar === null} className={danger}>Excluir esta</button>
            </div>
          </div>
        )}

        {step === 'edit' && (
          <div className="space-y-3">
            <p className="text-white/80 text-sm">Em vez de excluir, você pode <b>corrigir os dados</b>. O cartão e o QR continuam os mesmos.</p>
            <div className="flex flex-col sm:flex-row gap-2">
              <Link href={`/dashboard/objects/${objectId}/edit`} className={`${primary} flex items-center justify-center`}>Corrigir agora</Link>
              <button onClick={() => setStep('confirm')} className={secondary}>Excluir mesmo assim</button>
            </div>
          </div>
        )}

        {step === 'pause' && (
          <div className="space-y-3">
            <p className="text-white/80 text-sm"><b>Pausar</b> tira a ocorrência das buscas e do mapa, sem excluir. Você pode reativar quando quiser.</p>
            <div className="flex gap-2 justify-end">
              <button onClick={onClose} disabled={busy} className={secondary}>Cancelar</button>
              <button onClick={doPause} disabled={busy} className={primary}>{busy ? 'Pausando…' : 'Pausar'}</button>
            </div>
          </div>
        )}

        {step === 'privacy' && (
          <div className="space-y-3">
            <p className="text-white/80 text-sm">Excluir esta ocorrência <b>não apaga seus dados pessoais</b>. O pedido de exclusão de dados (LGPD) é outro caminho, nas configurações da conta.</p>
            <div className="flex flex-col sm:flex-row gap-2">
              <Link href="/dashboard/settings" className={`${primary} flex items-center justify-center`}>Ir para as configurações</Link>
              <button onClick={() => setStep('confirm')} className={secondary}>Só excluir a ocorrência</button>
            </div>
          </div>
        )}

        {step === 'text' && (
          <div className="space-y-3">
            <label className="text-white/70 text-sm block" htmlFor="del-text">Quer contar em poucas palavras? (opcional)</label>
            <textarea id="del-text" value={text} maxLength={REASON_TEXT_MAX} onChange={(e) => setText(e.target.value)} rows={3}
                      className="w-full rounded-xl bg-white/5 border border-white/10 text-white text-sm p-3" placeholder="Não inclua dados pessoais" />
            <p className="text-white/40 text-xs text-right">{text.length}/{REASON_TEXT_MAX}</p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setStep('reasons')} disabled={busy} className={secondary}>Voltar</button>
              <button onClick={() => setStep('confirm')} className={danger}>Continuar</button>
            </div>
          </div>
        )}

        {step === 'confirm' && (
          <div className="space-y-3">
            <p className="text-white/80 text-sm">{SHARE_WARNING}</p>
            <p className="text-white/60 text-xs">Você pode desfazer logo depois de excluir. {retentionNotice(days)}</p>
            <div className="flex gap-3 justify-between pt-1">
              <button onClick={onClose} disabled={busy} className={`${secondary} flex-1`}>Cancelar</button>
              <button onClick={() => doDelete(reason)} disabled={busy} className={`${danger} flex-1`}>{busy ? 'Excluindo…' : 'Excluir'}</button>
            </div>
          </div>
        )}

        {error && <p role="alert" className="text-red-400 text-xs">{error}</p>}
      </div>
    </div>
  );
}
