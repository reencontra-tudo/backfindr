'use client';
import { useState } from 'react';
import { Send, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { api, parseApiError } from '@/lib/api';
import { useAuthStore } from '@/hooks/useAuth';
import {
  PLATFORM_MESSAGE_TITLE_MAX,
  PLATFORM_MESSAGE_TEXT_MAX,
  isInternalPath,
} from '@/lib/platformMessage';

const TEMPLATES = [
  { label: 'Adicionar foto', title: 'Melhore as buscas do seu objeto', message: 'Adicione uma foto para melhorar as buscas.' },
  { label: 'Informar local', title: 'Complete o seu registro', message: 'Informe o local onde aconteceu.' },
  { label: 'Completar descrição', title: 'Complete o seu registro', message: 'Complete a descrição.' },
];

interface Props {
  /** Destinatário direto (tela do usuário). */
  userId?: string;
  /** Objeto do dono (tela do objeto): o destinatário é o dono e o link padrão aponta para o objeto. */
  objectId?: string;
  defaultLink?: string;
  isLegacy?: boolean;
}

export default function PlatformMessageBox({ userId, objectId, defaultLink, isLegacy }: Props) {
  const adminEmail = useAuthStore((s) => s.impersonatedByEmail ?? s.user?.email ?? null);
  const impersonating = useAuthStore((s) => s.impersonating);
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [link, setLink] = useState(defaultLink ?? '');
  const [sending, setSending] = useState(false);
  const [push, setPush] = useState(false);
  const [urgent, setUrgent] = useState(false);

  const linkInvalid = link.trim() !== '' && !isInternalPath(link.trim());
  const canSend = !isLegacy && !sending && !linkInvalid && title.trim() !== '' && message.trim() !== '';

  const send = async () => {
    setSending(true);
    try {
      const res = await api.post('/admin/platform-messages', {
        user_id: userId, object_id: objectId, title, message, link: link.trim() || undefined,
        ...(push ? { push: true } : {}), ...(urgent ? { urgent: true } : {}),
      });
      toast.success('Mensagem enviada');
      // Resultado do push em uma linha (a mensagem em si foi criada em todos os casos).
      const pushInfo = (res.data as { push?: { sent: boolean; label: string } } | undefined)?.push;
      if (pushInfo) (pushInfo.sent ? toast.success : toast.info)(pushInfo.label.charAt(0).toUpperCase() + pushInfo.label.slice(1));
      setTitle(''); setMessage(''); setPush(false); setUrgent(false);
    } catch (e) { toast.error(parseApiError(e)); }
    finally { setSending(false); }
  };

  const field = 'w-full bg-white/[0.06] border border-white/[0.08] rounded-xl px-3 py-2.5 text-white text-sm outline-none focus:border-teal-500/50 transition-all';

  return (
    <div className="bg-white/[0.04] rounded-2xl p-4 space-y-3">
      <h2 className="text-white/60 text-xs font-semibold uppercase tracking-wider">Enviar mensagem ao dono</h2>

      {isLegacy && (
        <p className="flex items-start gap-2 text-xs text-yellow-400 bg-yellow-500/10 rounded-xl p-3">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          Dono legado (Webjetos): o envio é bloqueado. Legado não recebe mensagens da plataforma.
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {TEMPLATES.map((t) => (
          <button key={t.label} type="button" disabled={isLegacy}
            onClick={() => { setTitle(t.title); setMessage(t.message); }}
            className="px-3 py-1.5 rounded-xl text-xs border border-white/[0.08] text-white/50 hover:text-white disabled:opacity-40">
            {t.label}
          </button>
        ))}
      </div>

      <input value={title} maxLength={PLATFORM_MESSAGE_TITLE_MAX} onChange={(e) => setTitle(e.target.value)}
        placeholder="Título" disabled={isLegacy} className={field} />
      <textarea value={message} maxLength={PLATFORM_MESSAGE_TEXT_MAX} onChange={(e) => setMessage(e.target.value)}
        rows={3} placeholder="Texto (apenas texto, sem HTML)" disabled={isLegacy} className={`${field} resize-none`} />
      <input value={link} onChange={(e) => setLink(e.target.value)} placeholder="Link interno (opcional), ex.: /dashboard/objects/..."
        disabled={isLegacy} className={field} />
      {linkInvalid && <p className="text-xs text-red-400">O link deve começar com "/" (apenas caminhos internos).</p>}

      <div className="space-y-1.5">
        <label className="flex items-center gap-2 text-xs text-white/70">
          <input type="checkbox" checked={push} disabled={isLegacy} onChange={(e) => setPush(e.target.checked)} />
          Enviar também por push
        </label>
        <label className="flex items-center gap-2 text-xs text-white/70">
          <input type="checkbox" checked={urgent} disabled={isLegacy}
            onChange={(e) => { setUrgent(e.target.checked); if (e.target.checked) setPush(true); }} />
          Urgente
        </label>
        {push && (
          <p className="text-[11px] text-white/40">
            O push avisa só que há uma mensagem da equipe, sem o texto. Quem desligou esse aviso não recebe.
          </p>
        )}
      </div>

      {(title || message) && (
        <div className="rounded-xl border border-teal-500/20 bg-teal-500/5 p-3">
          <p className="text-[10px] uppercase tracking-wider text-teal-400 mb-1">Pré-visualização · Mensagem do Backfindr</p>
          <p className="text-white text-sm font-medium whitespace-pre-wrap">{title}</p>
          <p className="text-white/60 text-xs mt-0.5 whitespace-pre-wrap">{message}</p>
        </div>
      )}

      <p className="text-xs text-white/40">
        Será enviada em nome de <span className="text-white/70">{adminEmail ?? 'seu usuário admin'}</span>
        {impersonating ? ' (seu admin real, não o usuário que você está acessando)' : ''}. Na caixa de notificações do app (e por push, se marcado); limite de 1 mensagem por usuário a cada 24 h.
      </p>

      <button onClick={send} disabled={!canSend}
        className="w-full flex items-center justify-center gap-2 bg-teal-500 hover:bg-teal-400 disabled:opacity-40 text-black font-semibold py-2.5 rounded-xl text-sm transition-all">
        <Send className="w-4 h-4" />
        {sending ? 'Enviando...' : 'Enviar mensagem'}
      </button>
    </div>
  );
}
