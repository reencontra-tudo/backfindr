'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, Send, Package, CheckCircle2, Shield, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { format, isToday, isYesterday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { api, matchesApi, objectsApi, parseApiError } from '@/lib/api';
import { useAuthStore } from '@/hooks/useAuth';
import { Match, RegisteredObject } from '@/types';

interface ChatMsg {
  id: string;
  sender_id: string;
  sender_name: string;
  content: string;
  created_at: string;
  is_system: boolean;
}

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
    if (label !== lastLabel) { groups.push({ label, msgs: [] }); lastLabel = label; }
    groups[groups.length - 1].msgs.push(msg);
  }
  return groups;
}

function Bubble({ msg, isOwn }: { msg: ChatMsg; isOwn: boolean }) {
  if (msg.is_system) {
    return (
      <div className="flex justify-center my-2">
        <span className="text-xs text-white/30 bg-white/[0.04] px-3 py-1 rounded-full border border-white/[0.06]">
          {msg.content}
        </span>
      </div>
    );
  }
  return (
    <div className={`flex gap-2 ${isOwn ? 'flex-row-reverse' : 'flex-row'} items-end mb-1`}>
      {!isOwn && (
        <div className="w-7 h-7 rounded-full bg-teal-500/20 border border-teal-500/30 flex items-center justify-center text-xs font-bold text-teal-400 flex-shrink-0">
          {msg.sender_name?.[0]?.toUpperCase() ?? '?'}
        </div>
      )}
      <div className={`max-w-[72%] flex flex-col gap-0.5 ${isOwn ? 'items-end' : 'items-start'}`}>
        {!isOwn && <span className="text-xs text-white/30 ml-1">{msg.sender_name}</span>}
        <div className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
          isOwn
            ? 'bg-teal-500 text-white rounded-br-sm'
            : 'bg-white/[0.06] border border-white/[0.08] text-white/80 rounded-bl-sm'
        }`}>
          {msg.content}
        </div>
        <span className="text-xs text-white/20 mx-1">{formatMsgTime(msg.created_at)}</span>
      </div>
    </div>
  );
}

export default function ChatPage() {
  const { matchId } = useParams<{ matchId: string }>();
  const router = useRouter();
  const { user } = useAuthStore();
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [match, setMatch] = useState<Match | null>(null);
  const [object, setObject] = useState<RegisteredObject | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval>>();

  const loadMessages = useCallback(async (silent = false) => {
    try {
      const { data } = await api.get(`/chat/${matchId}/messages`);
      setMessages(data?.items ?? []);
    } catch (e) {
      if (!silent) toast.error(parseApiError(e));
    }
  }, [matchId]);

  useEffect(() => {
    matchesApi.list().then(({ data }) => {
      const m = (data?.items ?? []).find((m: Match) => m.id === matchId);
      if (m) {
        setMatch(m);
        objectsApi.get(m.object_id).then(({ data }) => setObject(data));
      }
    });
    loadMessages();
    pollRef.current = setInterval(() => loadMessages(true), 3000);
    return () => clearInterval(pollRef.current);
  }, [matchId, loadMessages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    const content = input.trim();
    if (!content || sending) return;
    setSending(true);
    try {
      await api.post(`/chat/${matchId}/messages`, { content });
      setInput('');
      await loadMessages(true);
      inputRef.current?.focus();
    } catch (e) {
      toast.error(parseApiError(e));
    } finally {
      setSending(false);
    }
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const groups = groupByDate(messages);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-white/[0.06] flex-shrink-0">
        <button onClick={() => router.back()} className="w-8 h-8 flex items-center justify-center text-white/40 hover:text-white transition-colors">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0">
          {object ? (
            <>
              <div className="flex items-center gap-2">
                <p className="font-semibold text-white text-sm truncate">{object.title}</p>
                <Link href={`/dashboard/objects/${object.id}`} className="text-teal-400 hover:text-teal-300 transition-colors flex-shrink-0">
                  <Package className="w-3.5 h-3.5" />
                </Link>
              </div>
              <p className="text-xs text-white/30">
                Match #{matchId.slice(0, 8)} · {match ? Math.round(match.confidence_score * 100) : 0}% confiança
              </p>
            </>
          ) : (
            <div className="h-4 w-32 bg-white/[0.06] rounded animate-pulse" />
          )}
        </div>
        <div className="flex items-center gap-1 text-xs text-white/20">
          <RefreshCw className="w-3 h-3" /> 3s
        </div>
        {match?.status === 'confirmed' && (
          <div className="flex items-center gap-1 text-xs text-green-400">
            <CheckCircle2 className="w-3.5 h-3.5" /> Confirmado
          </div>
        )}
      </div>

      {/* Privacy notice */}
      <div className="flex items-center gap-2 px-6 py-2 bg-teal-500/[0.04] border-b border-teal-500/[0.08] flex-shrink-0">
        <Shield className="w-3.5 h-3.5 text-teal-500 flex-shrink-0" />
        <p className="text-xs text-white/30">Conversa mediada pelo Backfindr. Seus dados não são expostos.</p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center gap-3 py-10">
            <div className="w-14 h-14 rounded-2xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center">
              <Package className="w-7 h-7 text-white/20" />
            </div>
            <p className="font-semibold text-white">Nenhuma mensagem ainda</p>
            <p className="text-white/30 text-sm max-w-xs">Inicie a conversa para combinar a devolução do objeto de forma segura.</p>
          </div>
        ) : (
          groups.map(({ label, msgs }) => (
            <div key={label}>
              <div className="flex justify-center my-4">
                <span className="text-xs text-white/20 bg-white/[0.04] px-3 py-1 rounded-full border border-white/[0.06]">{label}</span>
              </div>
              {msgs.map(msg => (
                <Bubble key={msg.id} msg={msg} isOwn={msg.sender_id === user?.id} />
              ))}
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-6 py-4 border-t border-white/[0.06] flex-shrink-0">
        <div className="flex items-end gap-3">
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Digite sua mensagem..."
            rows={1}
            className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-white placeholder-white/20 text-sm outline-none focus:border-teal-500/50 transition-all resize-none max-h-32"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || sending}
            className="w-10 h-10 bg-teal-500 hover:bg-teal-400 disabled:opacity-40 rounded-xl flex items-center justify-center transition-all flex-shrink-0"
            style={{ boxShadow: '0 0 0 1px rgba(20,184,166,0.4)' }}
          >
            <Send className="w-4 h-4 text-white" />
          </button>
        </div>
        <p className="text-xs text-white/20 mt-2">Enter para enviar · Shift+Enter para nova linha</p>
      </div>
    </div>
  );
}
