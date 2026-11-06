'use client';

/**
 * "Anonimizar agora" (admin): IRREVERSÍVEL. Proteção contra clique acidental: motivo obrigatório, caixa de entendimento e
 * palavra digitada. Texto honesto sobre o que acontece e o que NÃO acontece (posts/arquivos já copiados fora do Backfindr).
 */
import { useEffect, useState } from 'react';
import { ANON_REASONS, ANON_CONFIRM_WORD } from '@/lib/governance';

interface Props {
  open: boolean;
  title?: string;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<void>;
}

export default function AdminAnonymizeModal({ open, title, onClose, onConfirm }: Props) {
  const [reason, setReason] = useState('');
  const [understood, setUnderstood] = useState(false);
  const [word, setWord] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { if (!open) { setReason(''); setUnderstood(false); setWord(''); setBusy(false); setError(null); } }, [open]);
  if (!open) return null;
  const ready = !!reason && understood && word === ANON_CONFIRM_WORD && !busy;
  const submit = async () => {
    if (!ready) return;
    setBusy(true); setError(null);
    try { await onConfirm(reason); } catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível anonimizar.'); setBusy(false); }
  };
  return (
    <div className="fixed inset-0 z-[10001] flex items-center justify-center bg-black/70 p-4" role="presentation"
         onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) onClose(); }}>
      <div role="dialog" aria-modal="true" aria-labelledby="anon-title" className="w-full max-w-md bg-[#0b1220] border border-red-500/30 rounded-2xl p-5 space-y-4">
        <h2 id="anon-title" className="text-white font-semibold">Anonimizar agora (irreversível)</h2>
        {title && <p className="text-white/50 text-xs truncate">“{title}”</p>}
        <p className="text-white/70 text-sm">
          A ocorrência passa a ter só dados genéricos (categoria, status, ano e trimestre, macro-região). Título, descrição, local, coordenadas, fotos, QR e
          dono são removidos e <b>não há como desfazer</b>. Os arquivos de foto entram numa fila de remoção. Cópias que já saíram do Backfindr (posts, prints) não são afetadas.
        </p>
        <fieldset className="space-y-1">
          <legend className="sr-only">Motivo</legend>
          {ANON_REASONS.map((r) => (
            <label key={r.code} className="flex items-center gap-3 min-h-[44px] px-3 rounded-lg border border-white/10 text-white/85 text-sm cursor-pointer hover:bg-white/5">
              <input type="radio" name="anon-reason" value={r.code} checked={reason === r.code} onChange={() => setReason(r.code)} />
              {r.label}
            </label>
          ))}
        </fieldset>
        <label className="flex items-start gap-3 text-white/80 text-sm min-h-[44px] cursor-pointer">
          <input type="checkbox" className="mt-1" checked={understood} onChange={(e) => setUnderstood(e.target.checked)} />
          Entendo que isso é irreversível.
        </label>
        <div>
          <label htmlFor="anon-word" className="text-white/60 text-xs block mb-1">Digite {ANON_CONFIRM_WORD} para liberar o botão</label>
          <input id="anon-word" value={word} onChange={(e) => setWord(e.target.value)} autoComplete="off"
                 className="w-full rounded-xl bg-white/5 border border-white/10 text-white text-sm p-3" />
        </div>
        {error && <p role="alert" className="text-red-400 text-xs">{error}</p>}
        <div className="flex gap-3 justify-between">
          <button onClick={onClose} disabled={busy} className="flex-1 min-h-[44px] rounded-xl border border-white/10 text-white/70 text-sm hover:bg-white/5">Cancelar</button>
          <button onClick={submit} disabled={!ready} className="flex-1 min-h-[44px] rounded-xl bg-red-600 hover:bg-red-500 text-white text-sm font-medium disabled:opacity-40">{busy ? 'Anonimizando…' : 'Anonimizar'}</button>
        </div>
      </div>
    </div>
  );
}
