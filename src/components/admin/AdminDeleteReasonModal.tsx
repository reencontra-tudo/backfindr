'use client';

/**
 * Exclusão de ocorrência por ADMIN: o motivo é OBRIGATÓRIO (lista fixa), para auditoria.
 * A exclusão é lógica (lixeira, restaurável). Texto livre só em "Outro" (máx. REASON_TEXT_MAX, tratado como dado).
 */
import { useEffect, useState } from 'react';
import { ADMIN_REASONS, REASON_TEXT_MAX, retentionDays } from '@/lib/governance';

interface Props {
  open: boolean;
  title?: string;
  onClose: () => void;
  /** deve lançar erro se falhar; o modal mostra e permanece aberto */
  onConfirm: (reason: string, reasonText: string | null) => Promise<void>;
}

export default function AdminDeleteReasonModal({ open, title, onClose, onConfirm }: Props) {
  const [reason, setReason] = useState('');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { if (!open) { setReason(''); setText(''); setBusy(false); setError(null); } }, [open]);
  if (!open) return null;
  const days = retentionDays();
  const submit = async () => {
    if (!reason) { setError('Escolha o motivo da exclusão.'); return; }
    setBusy(true); setError(null);
    try { await onConfirm(reason, reason === 'adm_outro' && text.trim() ? text.trim().slice(0, REASON_TEXT_MAX) : null); }
    catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível excluir.'); setBusy(false); }
  };
  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 p-4" role="presentation"
         onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) onClose(); }}>
      <div role="dialog" aria-modal="true" aria-labelledby="adm-del-title" className="w-full max-w-md bg-[#0b1220] border border-white/10 rounded-2xl p-5 space-y-4">
        <h2 id="adm-del-title" className="text-white font-semibold">Excluir ocorrência (admin)</h2>
        {title && <p className="text-white/50 text-xs truncate">“{title}”</p>}
        <p className="text-white/70 text-sm">O motivo é obrigatório e fica registrado na auditoria. A ocorrência vai para a lixeira por {days} dias e pode ser restaurada.</p>
        <fieldset className="space-y-1">
          <legend className="sr-only">Motivo</legend>
          {ADMIN_REASONS.map((r) => (
            <label key={r.code} className="flex items-center gap-3 min-h-[44px] px-3 rounded-lg border border-white/10 text-white/85 text-sm cursor-pointer hover:bg-white/5">
              <input type="radio" name="adm-reason" value={r.code} checked={reason === r.code} onChange={() => setReason(r.code)} />
              {r.label}
            </label>
          ))}
        </fieldset>
        {reason === 'adm_outro' && (
          <div>
            <textarea value={text} maxLength={REASON_TEXT_MAX} onChange={(e) => setText(e.target.value)} rows={2}
                      className="w-full rounded-xl bg-white/5 border border-white/10 text-white text-sm p-3" placeholder="Descreva em poucas palavras (sem dados pessoais)" />
            <p className="text-white/40 text-xs text-right">{text.length}/{REASON_TEXT_MAX}</p>
          </div>
        )}
        {error && <p role="alert" className="text-red-400 text-xs">{error}</p>}
        <div className="flex gap-3 justify-between">
          <button onClick={onClose} disabled={busy} className="flex-1 min-h-[44px] rounded-xl border border-white/10 text-white/70 text-sm hover:bg-white/5">Cancelar</button>
          <button onClick={submit} disabled={busy || !reason} className="flex-1 min-h-[44px] rounded-xl bg-red-500/90 hover:bg-red-500 text-white text-sm font-medium disabled:opacity-50">{busy ? 'Excluindo…' : 'Excluir'}</button>
        </div>
      </div>
    </div>
  );
}
