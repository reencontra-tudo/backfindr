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
      { label: '🚨 Foi roubado', action: 'stolen' },
      { label: '🙌 Encontrei algo', action: 'found' },
      { label: '🛡️ Quero me prevenir', action: 'prevent' },
      { label: '🗺️ Navegar no site', action: 'navigate' },
      { label: '❓ Como funciona?', action: 'how' },
    ],
  },

  // ── Perdeu algo ──
  lost: {
    text: 'Sinto muito 😔\n\nJá estamos ajudando casos assim. O que você perdeu?',
    buttons: [
      { label: '🐾 Pet', action: 'lost_pet' },
      { label: '📱 Celular', action: 'lost_phone' },
      { label: '🚗 Carro / Moto', action: 'lost_car' },
      { label: '📄 Documentos', action: 'lost_docs' },
      { label: '📦 Outro objeto', action: 'lost_other' },
    ],
  },
  lost_pet: {
    text: 'Sinto muito 😔\nJá estamos ajudando casos assim. Registra agora — é gratuito 👇\n\n' + APP_URL + '/pet\n\nQuanto antes publicar, maiores as chances 🙏',
  },
  lost_phone: {
    text: 'Sinto muito 😔\nJá estamos conectando casos assim. Registra gratuitamente aqui 👇\n\n' + APP_URL + '/perdi\n\nLeva 30s e aumenta as chances.',
  },
  lost_car: {
    text: 'Sinto muito 😔\nRegistra agora — é gratuito e a rede já começa a ajudar 👇\n\n' + APP_URL + '/perdi\n\nQuanto antes, mais rápido.',
  },
  lost_docs: {
    text: 'Sinto muito 😔\nDocumentos encontrados aparecem aqui com frequência. Registra gratuitamente 👇\n\n' + APP_URL + '/perdi\n\nLeva menos de 1 minuto.',
  },
  lost_other: {
    text: 'Sinto muito 😔\nJá estamos ajudando casos assim. Registra agora — é gratuito 👇\n\n' + APP_URL + '/perdi\n\nLeva menos de 1 minuto.',
  },

  // ── Roubado ──
  stolen: {
    text: 'Complicado 😔\n\nRegistra o quanto antes — já estamos gerando alertas na rede.\nÉ gratuito 👇\n\n' + APP_URL + '/roubado',
  },

  // ── Encontrou algo ──
  found: {
    text: 'Boa atitude 🙏\n\nVocê pode tentar devolver com segurança — é gratuito e seu contato fica protegido 👇\n\n' + APP_URL + '/encontrei',
  },

  // ── Prevenir / QR Code ──
  prevent: {
    text: 'Dá pra se proteger antes 👍\n\nCrie um QR Code em menos de 1 min — é gratuito 👇\n\n' + APP_URL + '/proteger\n\nSe o objeto for encontrado, o achador te contacta direto.',
  },

  // ── Como funciona ──
  how: {
    text: 'É uma plataforma que conecta quem perdeu com quem encontrou, em tempo real.\n\nJá está funcionando e é gratuita 👇\n\n' + APP_URL,
    buttons: [
      { label: '😔 Perdi algo', action: 'lost' },
      { label: '🙌 Encontrei algo', action: 'found' },
    ],
  },

  // ── Desconfiança ──
  trust: {
    text: 'Já estamos conectando casos reais.\n\nVocê pode testar agora — é gratuito 👇\n\n' + APP_URL,
  },

  // ── Gratuito / Preço ──
  pricing: {
    text: 'Pode usar sem custo pra começar 🙏\n\nRegistra aqui 👇\n\n' + APP_URL,
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
  nav_pets: { text: 'Área de pets 👇\n\n' + APP_URL + '/pet' },
  nav_notifications: { text: 'Suas notificações 👇\n\n' + APP_URL + '/dashboard?tab=notifications' },

  // ── Buscar achados ──
  browse_found: {
    text: 'Para ver itens encontrados por outras pessoas, acesse o **Mapa ao vivo** 👇\n\n' + APP_URL + '/map\n\nVocê pode filtrar por categoria, data e localização. Se algum item combinar com o que você perdeu, o sistema notifica automaticamente.',
    buttons: [
      { label: '🗺️ Abrir mapa', action: 'nav_map' },
      { label: '😔 Registrar item perdido', action: 'lost' },
    ],
  },

  // ── Não sabe usar ──
  help_use: {
    text: 'É bem rápido 👍\n\nAbre aqui e segue os passos — leva ~30s 👇\n\n' + APP_URL + '/perdi',
  },

  // ── Já registrou ──
  already_registered: {
    text: 'Perfeito 👍\n\nSe puder, compartilha também — aumenta muito as chances 🙏\n\n' + APP_URL,
  },

  // ── Agradecimento ──
  thanks: {
    text: 'Que bom ajudar 🙏\n\nSe puder, compartilha — isso aumenta as chances de outros casos também.',
  },

  // ── Emocional ──
  emotional: {
    text: 'Entendo, é desesperador mesmo 😔\n\nVamos tentar ajudar — registra aqui (é gratuito) 👇\n\n' + APP_URL + '/perdi\n\nEstou torcendo pra dar certo 🙏',
  },

  // ── Fallback ──
  confused: {
    text: 'Me diz uma coisa 👇\n\nVocê perdeu ou encontrou algo?',
    buttons: [
      { label: '😔 Perdi algo', action: 'lost' },
      { label: '🙌 Encontrei algo', action: 'found' },
    ],
  },

  followup: {
    text: 'Posso te ajudar com mais alguma coisa? 😊',
    buttons: [
      { label: '😔 Perdi algo', action: 'lost' },
      { label: '🙌 Encontrei algo', action: 'found' },
    ],
  },
};

// ─── Saudação por horário ─────────────────────────────────────────────────────

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return 'Bom dia! 🌅';
  if (hour >= 12 && hour < 18) return 'Boa tarde! ☀️';
  return 'Boa noite! 🌙';
}

// ─── Detectar intenção por texto livre ───────────────────────────────────────

function detectIntent(text: string): string | null {
  const t = text.toLowerCase();

  // Saudação
  if (/^(oi|olá|ola|hey|ei|hello|bom dia|boa tarde|boa noite|boas|salve|e aí|e ai|tudo bem|tudo bom)/.test(t)
    || /^(oi |olá |ola |hey |ei )/.test(t)) return 'greeting';

  // Navegação — só captura quando há intenção EXPLÍCITA de ir para algum lugar
  const isQuestion = /\b(como|o que|por que|quando|onde|qual|quem|quanto)\b/.test(t);
  const isNavigationIntent = /\b(ir para|abrir|acessar|navegar|quero ver|me leva|me mostra|vai para|leva para)\b/.test(t)
    || (!isQuestion && /\b(ver|mostrar)\b/.test(t));

  if (isNavigationIntent) {
    if (/mapa/.test(t)) return 'nav_map';
    if (/dashboard|painel|meus objetos/.test(t)) return 'nav_dashboard';
    if (/registrar|novo objeto|cadastrar/.test(t)) return 'nav_new';
    if (/pet|animal|cachorro|gato/.test(t) && !/perdi|achei/.test(t)) return 'nav_pets';
    if (/notifica/.test(t)) return 'nav_notifications';
    if (/início|home|começo/.test(t)) return 'nav_home';
    if (!isQuestion) return 'navigate';
  }

  // Roubado — antes de "perdeu" para não confundir
  if (/\b(roubaram|furtaram|roubado|furtado|assaltaram|assalto|furto|roubo)\b/.test(t)) return 'stolen';

  // Perdeu algo — categorias específicas
  const isLostReport = /\b(perdi|perdeu|desapareceu|sumiu)\b/.test(t)
    || (/\b(perder)\b/.test(t) && !isQuestion);
  if (isLostReport) {
    if (/pet|cachorro|gato|animal|cão/.test(t)) return 'lost_pet';
    if (/celular|telefone|iphone|android|smartphone/.test(t)) return 'lost_phone';
    if (/carro|veículo|moto|bicicleta/.test(t)) return 'lost_car';
    if (/document|rg|cpf|passaporte|carteira|cartão/.test(t)) return 'lost_docs';
    return 'lost_other';
  }

  // Encontrou algo
  if (/\b(achei|encontrei|achar|encontrar)\b/.test(t)) return 'found';

  // Prevenir / QR Code
  if (/\b(prevenir|prevenção|proteger|proteção|qr|qr code|evitar perder|antes de perder)\b/.test(t)) return 'prevent';

  // Perguntas sobre como ver/buscar itens no sistema
  if (/como.*(ver|buscar|encontrar|achar|procurar).*(perdid|achad|objeto|item|coisa|pet|celular|carro)/.test(t)
    || /(perdid|achad|objeto|item).*(onde|como).*(ver|buscar|achar|encontrar)/.test(t)
    || /onde.*(ver|achar|encontrar|buscar).*(perdid|achad|objeto|item|coisa)/.test(t)) return 'browse_found';

  // Desconfiança
  if (/\b(funciona mesmo|é confiável|é seguro|é verdade|é real|tem resultado|resolve mesmo|acreditar)\b/.test(t)) return 'trust';

  // Não sabe usar
  if (/\b(não sei usar|como usar|não sei como|não consigo|não entendo|me ajuda a usar)\b/.test(t)) return 'help_use';

  // Já registrou
  if (/\b(já registrei|já cadastrei|já publiquei|já coloquei)\b/.test(t)) return 'already_registered';

  // Agradecimento
  if (/\b(obrigad|valeu|muito obrigad|agradeço|obg|vlw|thanks)\b/.test(t)) return 'thanks';

  // Como funciona
  if (/como funciona|o que é|como usar|como cadastr/.test(t)) return 'how';

  // Gratuito
  if (/gratu|grátis|gratuito|pago|custo|preço|plano/.test(t)) return 'pricing';

  // Emocional
  if (/desespera|angustia|triste|chorando|preciso muito|importante demais/.test(t)) return 'emotional';

  return null;
}

// ─── Gatilhos de transferência para GPT-mini ────────────────────────────────────
// Retorna true quando a mensagem deve ir direto para a Camada 2 (GPT-mini),
// sem passar pela detecção determinística local.

function shouldEscalateToGPT(text: string, history: Message[]): boolean {
  const t = text.toLowerCase();

  // 1. Múltiplas intenções na mesma mensagem
  const intentKeywords = [
    /\b(perdi|perdeu|sumiu|desapareceu)\b/,
    /\b(achei|encontrei)\b/,
    /\b(roubado|roubaram|furtado|furtaram|assalt)\b/,
    /\b(prevenir|proteger|qr|qr code)\b/,
    /\b(como funciona|o que é|me explica)\b/,
  ];
  const matchedIntents = intentKeywords.filter(re => re.test(t)).length;
  if (matchedIntents >= 2) return true;

  // 2. Mensagem muito longa (mais de 80 caracteres sem intenção clara)
  if (text.length > 80) return true;

  // 3. Linguagem emocional intensa (desespero, urgência extrema)
  if (/\b(desesperado|desesperada|chorando|imploro|por favor me ajuda|urgente|preciso urgente|tô desesperado|to desesperado|não sei o que fazer|nao sei o que fazer)\b/.test(t)) return true;

  // 4. Pergunta aberta sem intenção clara
  if (/^(como|por que|por quê|quando|o que acontece|o que devo|me explica|me conta|pode me dizer)/.test(t) && text.length > 30) return true;

  // 5. Repetição de dúvida (usuário já fez pergunta parecida antes)
  if (history.length >= 4) {
    const userMsgs = history.filter(m => m.role === 'user').slice(-3).map(m => m.content.toLowerCase());
    const hasSimilar = userMsgs.some(prev => {
      const words = t.split(/\s+/).filter(w => w.length > 4);
      return words.some(w => prev.includes(w)) && prev !== t;
    });
    if (hasSimilar) return true;
  }

  // 6. Mensagem ambígua com condições compostas ("mas", "e também", "além disso")
  if (/\b(mas também|e também|além disso|ao mesmo tempo|não sei se|acho que pode ser|não tenho certeza|pode ser que)\b/.test(t)) return true;

  return false;
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
  const [userHasInteracted, setUserHasInteracted] = useState(false);
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

  // Follow-up desativado — o bot responde apenas quando o usuário interage

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
    // Marcar que o usuário interagiu e cancelar follow-up pendente
    setUserHasInteracted(true);
    if (followupTimerRef.current) clearTimeout(followupTimerRef.current);
    setFollowupSent(false);

    // Adicionar mensagem do usuário visível
    const labelMap: Record<string, string> = {
      lost: '😔 Perdi algo',
      stolen: '🚨 Foi roubado',
      found: '🙌 Encontrei algo',
      prevent: '🛡️ Quero me prevenir',
      navigate: '🗺️ Navegar no site',
      how: '❓ Como funciona?',
      lost_pet: '🐾 Pet',
      lost_phone: '📱 Celular',
      lost_car: '🚗 Carro / Moto',
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

    // Marcar que o usuário interagiu e resetar follow-up
    setUserHasInteracted(true);
    if (followupTimerRef.current) clearTimeout(followupTimerRef.current);
    setFollowupSent(false);

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: msg,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMsg]);

    // Verificar se deve escalar para GPT-mini antes da detecção local
    const escalate = shouldEscalateToGPT(msg, messages);

    // Tentar detectar intenção localmente primeiro (apenas se não escalou)
    const intent = !escalate ? detectIntent(msg) : null;
    if (intent) {
      if (intent === 'greeting') {
        const greetingFlow = {
          text: `${getGreeting()}\n\nSou o **Findr**, assistente do Backfindr 🐾\n\nComo posso te ajudar?`,
          buttons: [
            { label: '😔 Perdi algo', action: 'lost' },
            { label: '🚨 Foi roubado', action: 'stolen' },
            { label: '🙌 Encontrei algo', action: 'found' },
            { label: '🛡️ Quero me prevenir', action: 'prevent' },
          ],
        };
        setTimeout(() => addBotMessage(greetingFlow), 400);
        return;
      }
      if (FLOWS[intent]) {
        setTimeout(() => addBotMessage(FLOWS[intent]), 400);
        return;
      }
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
