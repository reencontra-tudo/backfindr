'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import { MessageCircle, X, Send, Bot, ChevronDown } from 'lucide-react';
import Cookies from 'js-cookie';

// ─── Types ────────────────────────────────────────────────────────────────────

type FlowStep =
  | 'initial'
  | 'lost_category'
  | 'found'
  | 'how_it_works'
  | 'pricing'
  | 'navigate'
  | 'done';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  buttons?: { label: string; action: string; icon?: string }[];
}

// ─── Fluxo determinístico ─────────────────────────────────────────────────────

const APP_URL = 'https://backfindr.com';

const FLOWS: Record<string, { text: string; buttons?: { label: string; action: string }[] }> = {
  initial: {
    text: 'Oi 👋\nVocê perdeu ou encontrou algo?',
    buttons: [
      { label: '😔 Perdi algo', action: 'lost' },
      { label: '🙌 Encontrei algo', action: 'found' },
      { label: '🗺️ Navegar no site', action: 'navigate' },
      { label: '❓ Como funciona?', action: 'how' },
    ],
  },

  // ── Perdeu algo ──
  lost: {
    text: 'Sinto muito 😔\n\nO que você perdeu?',
    buttons: [
      { label: '🐾 Pet', action: 'lost_pet' },
      { label: '📱 Celular', action: 'lost_phone' },
      { label: '🚗 Carro', action: 'lost_car' },
      { label: '📄 Documentos', action: 'lost_docs' },
      { label: '📦 Outro objeto', action: 'lost_other' },
    ],
  },
  lost_pet: {
    text: 'Registra agora 👇\n\n' + APP_URL + '/dashboard/new\n\nQuanto antes, maior a chance de alguém te encontrar 🙏',
  },
  lost_phone: {
    text: 'Registra agora 👇\n\n' + APP_URL + '/dashboard/new\n\nIsso já aumenta a chance de alguém te encontrar.',
  },
  lost_car: {
    text: 'Registra agora 👇\n\n' + APP_URL + '/dashboard/new\n\nQuanto antes, mais rápido a rede pode ajudar.',
  },
  lost_docs: {
    text: 'Registra agora 👇\n\n' + APP_URL + '/dashboard/new\n\nDocumentos encontrados aparecem aqui com frequência.',
  },
  lost_other: {
    text: 'Registra agora 👇\n\n' + APP_URL + '/dashboard/new\n\nLeva menos de 1 minuto e já ajuda bastante.',
  },

  // ── Encontrou algo ──
  found: {
    text: 'Boa atitude 🙏\n\nRegistra aqui 👇\n\n' + APP_URL + '/dashboard/new\n\nAssim o dono consegue te encontrar.',
  },

  // ── Como funciona ──
  how: {
    text: 'É simples:\n\nvocê registra → alguém encontra → você recebe aviso\n\nFaz aqui 👇\n\n' + APP_URL,
  },

  // ── Gratuito ──
  pricing: {
    text: 'Sim 🙏\n\nPode usar sem custo pra começar.\n\nFaz aqui 👇\n\n' + APP_URL,
  },

  // ── Navegação ──
  navigate: {
    text: 'Para onde você quer ir? 👇',
    buttons: [
      { label: '🏠 Início', action: 'nav_home' },
      { label: '🗺️ Mapa ao vivo', action: 'nav_map' },
      { label: '📦 Meus objetos', action: 'nav_dashboard' },
      { label: '➕ Registrar objeto', action: 'nav_new' },
      { label: '🐾 Pets', action: 'nav_pets' },
      { label: '🔔 Notificações', action: 'nav_notifications' },
    ],
  },
  nav_home: { text: 'Indo para o início 👇\n\n' + APP_URL },
  nav_map: { text: 'Mapa ao vivo 👇\n\n' + APP_URL + '/map' },
  nav_dashboard: { text: 'Seus objetos 👇\n\n' + APP_URL + '/dashboard' },
  nav_new: { text: 'Registrar objeto 👇\n\n' + APP_URL + '/dashboard/new' },
  nav_pets: { text: 'Área de pets 👇\n\n' + APP_URL + '/#pets' },
  nav_notifications: { text: 'Suas notificações 👇\n\n' + APP_URL + '/dashboard?tab=notifications' },

  // ── Fallback ──
  confused: {
    text: 'Me diz uma coisa 👇\n\nVocê perdeu ou encontrou algo?',
    buttons: [
      { label: '😔 Perdi algo', action: 'lost' },
      { label: '🙌 Encontrei algo', action: 'found' },
    ],
  },
  emotional: {
    text: 'Imagino como deve estar sendo 😔\n\nVamos tentar aumentar as chances 👇\n\n' + APP_URL + '\n\nEstou torcendo pra dar certo 🙏',
  },
  followup: {
    text: 'Se ainda precisar 👇\n\n' + APP_URL + '\n\nPode ajudar bastante.',
  },
};

// ─── Detectar intenção por texto livre ───────────────────────────────────────

function detectIntent(text: string): string | null {
  const t = text.toLowerCase();

  // Navegação
  if (/\b(ir para|abrir|acessar|ver|mostrar|navegar|quero ver|me leva)\b/.test(t)) {
    if (/mapa/.test(t)) return 'nav_map';
    if (/dashboard|painel|meus objetos/.test(t)) return 'nav_dashboard';
    if (/registrar|novo objeto|cadastrar/.test(t)) return 'nav_new';
    if (/pet|animal|cachorro|gato/.test(t) && !/perdi|achei/.test(t)) return 'nav_pets';
    if (/notifica/.test(t)) return 'nav_notifications';
    if (/início|home|começo/.test(t)) return 'nav_home';
    return 'navigate';
  }

  // Perdeu algo — categorias específicas
  if (/\b(perdi|perder|perdeu|desapareceu|sumiu|roubaram|furtaram)\b/.test(t)) {
    if (/pet|cachorro|gato|animal|cão/.test(t)) return 'lost_pet';
    if (/celular|telefone|iphone|android|smartphone/.test(t)) return 'lost_phone';
    if (/carro|veículo|moto|bicicleta/.test(t)) return 'lost_car';
    if (/document|rg|cpf|passaporte|carteira|cartão/.test(t)) return 'lost_docs';
    return 'lost_other';
  }

  // Encontrou algo
  if (/\b(achei|encontrei|achar|encontrar)\b/.test(t)) return 'found';

  // Como funciona
  if (/como funciona|o que é|como usar|como cadastr/.test(t)) return 'how';

  // Gratuito
  if (/gratu|grátis|gratuito|pago|custo|preço|plano/.test(t)) return 'pricing';

  // Emocional
  if (/desespera|angustia|triste|chorando|preciso muito|importante demais/.test(t)) return 'emotional';

  return null;
}

// ─── Markdown simples ─────────────────────────────────────────────────────────

function renderMarkdown(text: string) {
  let html = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="text-brand-400 underline" target="_blank">$1</a>');
  // URLs isoladas viram links clicáveis
  html = html.replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" class="text-brand-400 underline font-medium" target="_blank">$1</a>');
  html = html.replace(/\n/g, '<br />');
  return html;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function AssistantWidget() {
  const pathname = usePathname();
  const isMap = pathname === '/map';

  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [unread, setUnread] = useState(0);
  const [followupSent, setFollowupSent] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const followupTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    if (open) {
      scrollToBottom();
      setUnread(0);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open, messages, scrollToBottom]);

  // Mensagem inicial ao abrir pela primeira vez
  useEffect(() => {
    if (open && messages.length === 0) {
      addBotMessage(FLOWS.initial);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Follow-up automático após 15s sem resposta do usuário
  useEffect(() => {
    if (open && messages.length > 0 && !followupSent) {
      const lastMsg = messages[messages.length - 1];
      if (lastMsg.role === 'assistant') {
        followupTimerRef.current = setTimeout(() => {
          if (!followupSent) {
            setFollowupSent(true);
            addBotMessage(FLOWS.followup);
          }
        }, 15000);
      }
    }
    return () => {
      if (followupTimerRef.current) clearTimeout(followupTimerRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, open, followupSent]);

  const addBotMessage = useCallback((flow: typeof FLOWS[string]) => {
    const msg: Message = {
      id: Date.now().toString() + Math.random(),
      role: 'assistant',
      content: flow.text,
      timestamp: new Date(),
      buttons: flow.buttons,
    };
    setMessages(prev => [...prev, msg]);
    if (!open) setUnread(prev => prev + 1);
  }, [open]);

  const handleAction = useCallback((action: string) => {
    // Cancelar follow-up se usuário interagiu
    if (followupTimerRef.current) clearTimeout(followupTimerRef.current);
    setFollowupSent(true);

    // Adicionar mensagem do usuário visível
    const labelMap: Record<string, string> = {
      lost: '😔 Perdi algo',
      found: '🙌 Encontrei algo',
      navigate: '🗺️ Navegar no site',
      how: '❓ Como funciona?',
      lost_pet: '🐾 Pet',
      lost_phone: '📱 Celular',
      lost_car: '🚗 Carro',
      lost_docs: '📄 Documentos',
      lost_other: '📦 Outro objeto',
      nav_home: '🏠 Início',
      nav_map: '🗺️ Mapa ao vivo',
      nav_dashboard: '📦 Meus objetos',
      nav_new: '➕ Registrar objeto',
      nav_pets: '🐾 Pets',
      nav_notifications: '🔔 Notificações',
    };

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: labelMap[action] ?? action,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMsg]);

    // Responder com o fluxo correspondente
    setTimeout(() => {
      const flow = FLOWS[action];
      if (flow) {
        addBotMessage(flow);
      } else {
        addBotMessage(FLOWS.confused);
      }
    }, 400);
  }, [addBotMessage, followupSent]);

  const handleSend = useCallback(async () => {
    const msg = input.trim();
    if (!msg || loading) return;
    setInput('');

    // Cancelar follow-up se usuário digitou
    if (followupTimerRef.current) clearTimeout(followupTimerRef.current);
    setFollowupSent(true);

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: msg,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMsg]);

    // Tentar detectar intenção localmente primeiro
    const intent = detectIntent(msg);
    if (intent && FLOWS[intent]) {
      setTimeout(() => addBotMessage(FLOWS[intent]), 400);
      return;
    }

    // Fallback para API (OpenAI quando disponível, guided flow caso contrário)
    setLoading(true);
    try {
      const token = Cookies.get('access_token');
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const allMessages = [...messages, userMsg];
      const res = await fetch('/api/v1/assistant/chat', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          messages: allMessages.map(m => ({ role: m.role, content: m.content })),
          context: { page: typeof window !== 'undefined' ? window.location.pathname : '/' },
        }),
      });

      const data = await res.json();
      const assistantMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.reply ?? 'Desculpe, não consegui processar sua mensagem.',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, assistantMsg]);
      if (!open) setUnread(prev => prev + 1);
    } catch {
      addBotMessage(FLOWS.confused);
    } finally {
      setLoading(false);
    }
  }, [input, loading, messages, open, addBotMessage]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Posicionamento: esquerda no mapa, direita nas demais páginas
  const positionClass = isMap
    ? 'fixed bottom-6 left-6 z-50 flex flex-col items-start gap-3'
    : 'fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3';

  const windowAlignClass = isMap ? 'origin-bottom-left' : 'origin-bottom-right';

  return (
    <>
      <div className={positionClass}>
        {/* Chat window */}
        {open && (
          <div
            className={`w-[340px] max-w-[calc(100vw-3rem)] bg-[#0f1117] border border-white/10 rounded-2xl shadow-2xl flex flex-col overflow-hidden ${windowAlignClass}`}
            style={{ height: 'min(500px, calc(100vh - 120px))' }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-gradient-to-r from-brand-600/20 to-transparent flex-shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl gradient-brand flex items-center justify-center flex-shrink-0">
                  <Bot className="w-4 h-4 text-white" />
                </div>
                <div>
                  <p className="text-white font-semibold text-sm leading-none">Findr</p>
                  <p className="text-brand-400 text-xs mt-0.5">Assistente Backfindr</p>
                </div>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="p-1.5 rounded-lg hover:bg-white/[0.06] text-slate-400 hover:text-white transition-colors"
              >
                <ChevronDown className="w-4 h-4" />
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 scrollbar-thin">
              {messages.map((msg) => (
                <div key={msg.id} className="space-y-2">
                  <div className={`flex gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                    {msg.role === 'assistant' && (
                      <div className="w-6 h-6 rounded-lg gradient-brand flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Bot className="w-3 h-3 text-white" />
                      </div>
                    )}
                    <div
                      className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                        msg.role === 'user'
                          ? 'bg-brand-500 text-white rounded-tr-sm'
                          : 'bg-white/[0.06] text-slate-200 rounded-tl-sm'
                      }`}
                      dangerouslySetInnerHTML={{
                        __html: msg.role === 'assistant' ? renderMarkdown(msg.content) : msg.content,
                      }}
                    />
                  </div>

                  {/* Botões de ação */}
                  {msg.role === 'assistant' && msg.buttons && msg.buttons.length > 0 && (
                    <div className="ml-8 flex flex-wrap gap-1.5">
                      {msg.buttons.map((btn) => (
                        <button
                          key={btn.action}
                          onClick={() => handleAction(btn.action)}
                          className="text-xs px-3 py-1.5 rounded-full border border-brand-500/40 text-brand-300 hover:bg-brand-500/15 hover:border-brand-400 transition-all active:scale-95"
                        >
                          {btn.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}

              {loading && (
                <div className="flex gap-2">
                  <div className="w-6 h-6 rounded-lg gradient-brand flex items-center justify-center flex-shrink-0">
                    <Bot className="w-3 h-3 text-white" />
                  </div>
                  <div className="bg-white/[0.06] rounded-2xl rounded-tl-sm px-3.5 py-2.5">
                    <div className="flex gap-1 items-center">
                      <span className="w-1.5 h-1.5 bg-brand-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-1.5 h-1.5 bg-brand-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-1.5 h-1.5 bg-brand-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="px-4 pb-4 pt-2 border-t border-white/[0.06] flex-shrink-0">
              <div className="flex items-center gap-2 bg-white/[0.06] rounded-xl px-3 py-2">
                <input
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Digite sua mensagem..."
                  className="flex-1 bg-transparent text-slate-200 placeholder-slate-500 text-sm outline-none"
                  disabled={loading}
                />
                <button
                  onClick={handleSend}
                  disabled={!input.trim() || loading}
                  className="p-1.5 rounded-lg bg-brand-500 hover:bg-brand-400 text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Toggle button */}
        <button
          onClick={() => setOpen(prev => !prev)}
          className="relative w-14 h-14 rounded-2xl gradient-brand shadow-lg hover:scale-105 active:scale-95 transition-all flex items-center justify-center glow-teal"
          aria-label="Abrir assistente"
        >
          {open ? (
            <X className="w-6 h-6 text-white" />
          ) : (
            <MessageCircle className="w-6 h-6 text-white" />
          )}
          {!open && unread > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-white text-xs font-bold flex items-center justify-center">
              {unread}
            </span>
          )}
        </button>
      </div>
    </>
  );
}
