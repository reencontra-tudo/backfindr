'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ChevronLeft, Send, Wifi, WifiOff, Package,
  CheckCircle2, MoreVertical, Shield
} from 'lucide-react';
import { toast } from 'sonner';
import { format, isToday, isYesterday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useChat, ChatMsg } from '@/hooks/useChat';
import { useAuthStore } from '@/hooks/useAuth';
import { matchesApi, objectsApi, parseApiError } from '@/lib/api';
import { Match, RegisteredObject } from '@/types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatMsgTime(iso: string) {
  const d = new Date(iso);
  if (isToday(d)) return format(d, 'HH:mm');
  if (isYesterday(d)) return `Ontem ${format(d, 'HH:mm')}`;
  return format(d, "dd/MM · HH:mm", { locale: ptBR });
}

function groupByDate(messages: ChatMsg[]) {
  const groups: { label: string; msgs: ChatMsg[] }[] = [];
  let lastLabel = '';
  for (const msg of messages) {
    const d = new Date(msg.created_at);
    const label = isToday(d) ? 'Hoje' : isYesterday(d) ? 'Ontem' : format(d, "dd 'de' MMMM", { locale: ptBR });
    if (label !== lastLabel) {
      groups.push({ label, msgs: [] });
      lastLabel = label;
    }
    groups[groups.length - 1].msgs.push(msg);
  }
  return groups;
}

// ─── Message bubble ───────────────────────────────────────────────────────────

function Bubble({ msg, isOwn }: { msg: ChatMsg; isOwn: boolean }) {
  if (msg.is_system) {
    return (
      <div className="flex justify-center my-2">
        <span className="text-xs text-slate-500 bg-surface px-3 py-1 rounded-full border border-surface-border">
          {msg.content}
        </span>
      </div>
    );
  }

  return (
    <div className={`flex gap-2 ${isOwn ? 'flex-row-reverse' : 'flex-row'} items-end mb-1`}>
      {!isOwn && (
        <div className="w-7 h-7 rounded-full bg-brand-500/20 border border-brand-500/30 flex items-center justify-center text-xs font-bold text-brand-400 flex-shrink-0">
          {msg.sender_name[0].toUpperCase()}
        </div>
      )}
      <div className={`max-w-[72%] ${isOwn ? 'items-end' : 'items-start'} flex flex-col gap-0.5`}>
        {!isOwn && (
          <span className="text-xs text-slate-500 ml-1">{msg.sender_name}</span>
        )}
        <div
          className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
            isOwn
              ? 'bg-brand-500 text-white rounded-br-sm'
              : 'bg-surface-card border border-surface-border text-slate-200 rounded-bl-sm'
          }`}
        >
          {msg.content}
        </div>
        <span className="text-xs text-slate-600 mx-1">{formatMsgTime(msg.created_at)}</span>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ChatPage() {
  const { matchId } = useParams<{ matchId: string }>();
  const router = useRouter();
  const { user } = useAuthStore();
  const { messages, typingUsers, connected, send, sendTyping } = useChat(matchId);
  const [input, setInput] = useState('');
  const [match, setMatch] = useState<Match | null>(null);
  const [object, setObject] = useState<RegisteredObject | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const typingTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load match + object info
  useEffect(() => {
    matchesApi.list().then(({ data }) => {
      const m = (data?.items ?? []).find((m: Match) => m.id === matchId);
      if (m) {
        setMatch(m);
        objectsApi.get(m.object_id).then(({ data }) => setObject(data));
      }
    }).catch((err) => toast.error(parseApiError(err)));
  }, [matchId]);

  // Auto-scroll on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = () => {
    const content = input.trim();
    if (!content) return;
    send(content);
    setInput('');
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleTyping = () => {
    sendTyping();
    clearTimeout(typingTimeout.current!);
    typingTimeout.current = setTimeout(() => {}, 2000);
  };

  const groups = groupByDate(messages);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-4 glass border-b border-surface-border flex-shrink-0">
        <button
          onClick={() => router.back()}
          className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-white transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        <div className="flex-1 min-w-0">
          {object ? (
            <>
              <div className="flex items-center gap-2">
                <p className="font-display font-semibold text-white text-sm truncate">
                  {object.title}
                </p>
                <Link
                  href={`/dashboard/objects/${object.id}`}
                  className="text-brand-400 hover:text-brand-300 transition-colors flex-shrink-0"
                >
                  <Package className="w-3.5 h-3.5" />
                </Link>
              </div>
              <p className="text-xs text-slate-500">
                Match #{matchId.slice(0, 8)} · {match ? Math.round(match.confidence_score * 100) : 0}% confiança
              </p>
            </>
          ) : (
            <div className="h-4 w-32 bg-surface-border rounded animate-pulse" />
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Connection status */}
          <div className={`flex items-center gap-1 text-xs ${connected ? 'text-green-400' : 'text-slate-500'}`}>
            {connected
              ? <Wifi className="w-3.5 h-3.5" />
              : <WifiOff className="w-3.5 h-3.5" />
            }
            <span className="hidden sm:inline">{connected ? 'Conectado' : 'Reconectando...'}</span>
          </div>

          {match?.status === 'confirmed' && (
            <div className="flex items-center gap-1 text-xs text-green-400">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Confirmado</span>
            </div>
          )}
        </div>
      </div>

      {/* Privacy notice */}
      <div className="flex items-center gap-2 px-6 py-2 bg-brand-500/5 border-b border-brand-500/10 flex-shrink-0">
        <Shield className="w-3.5 h-3.5 text-brand-500 flex-shrink-0" />
        <p className="text-xs text-slate-400">
          Conversa mediada pelo Backfindr. Seus dados de contato não são expostos.
        </p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-1">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center gap-3 py-10">
            <div className="w-14 h-14 rounded-2xl bg-surface-card border border-surface-border flex items-center justify-center">
              <Package className="w-7 h-7 text-slate-500" />
            </div>
            <p className="font-display font-semibold text-white">Nenhuma mensagem ainda</p>
            <p className="text-slate-500 text-sm max-w-xs">
              Inicie a conversa para combinar a devolução do objeto de forma segura.
            </p>
          </div>
        )}

        {groups.map(({ label, msgs }) => (
          <div key={label}>
            <div className="flex justify-center my-4">
              <span className="text-xs text-slate-500 bg-surface px-3 py-1 rounded-full border border-surface-border">
                {label}
              </span>
            </div>
            {msgs.map((msg) => (
              <Bubble
                key={msg.id}
                msg={msg}
                isOwn={msg.sender_id === user?.id}
              />
            ))}
          </div>
        ))}

        {/* Typing indicator */}
        {typingUsers.length > 0 && (
          <div className="flex items-center gap-2 ml-9">
            <div className="bg-surface-card border border-surface-border rounded-2xl rounded-bl-sm px-4 py-2.5 flex items-center gap-1">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce"
                  style={{ animationDelay: `${i * 150}ms` }}
                />
              ))}
            </div>
            <span className="text-xs text-slate-500">
              {typingUsers[0].user_name} está digitando...
            </span>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-6 py-4 glass border-t border-surface-border flex-shrink-0">
        <div className="flex items-end gap-3">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => { setInput(e.target.value); handleTyping(); }}
            onKeyDown={handleKeyDown}
            placeholder="Digite sua mensagem... (Enter para enviar)"
            rows={1}
            className="flex-1 bg-surface border border-surface-border rounded-2xl px-4 py-3 text-slate-100 placeholder-slate-500 text-sm outline-none focus:border-brand-500 transition-colors resize-none max-h-32 overflow-auto"
            style={{ lineHeight: '1.5' }}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || !connected}
            className="w-10 h-10 bg-brand-500 hover:bg-brand-400 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl flex items-center justify-center transition-all flex-shrink-0 glow-teal"
          >
            <Send className="w-4 h-4 text-white" />
          </button>
        </div>
        <p className="text-xs text-slate-600 mt-2">
          Enter para enviar · Shift+Enter para nova linha
        </p>
      </div>
    </div>
  );
}
