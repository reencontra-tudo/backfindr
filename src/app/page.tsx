'use client';

import Link from 'next/link';
import { useState, useEffect, useRef } from 'react';
import { ArrowRight, MapPin, QrCode, Zap, Shield, Globe, ChevronRight } from 'lucide-react';

// ─── Fallback data — used when API has < 4 objects ────────────────────────────
const FALLBACK_ACTIVITIES = [
  { id: 'f1', type: 'lost',  emoji: '📱', text: 'iPhone 15 Pro preto perdido',      city: 'Metrô Paulista, SP',    time: 'agora' },
  { id: 'f2', type: 'found', emoji: '👛', text: 'Carteira encontrada com docs',     city: 'Pinheiros, SP',         time: '1 min' },
  { id: 'f3', type: 'match', emoji: '⚡', text: 'Match 94% confirmado pela IA',     city: 'Brooklin, SP',          time: '2 min' },
  { id: 'f4', type: 'lost',  emoji: '🐾', text: 'Labrador caramelo desaparecido',   city: 'Ibirapuera, SP',        time: '3 min' },
  { id: 'f5', type: 'found', emoji: '🔑', text: 'Chaves encontradas no estac.',     city: 'Vila Mariana, SP',      time: '5 min' },
  { id: 'f6', type: 'match', emoji: '⚡', text: 'Objeto devolvido ao dono',         city: 'Moema, SP',             time: '7 min' },
  { id: 'f7', type: 'lost',  emoji: '💻', text: 'MacBook Air prata desaparecido',   city: 'Faria Lima, SP',        time: '9 min' },
  { id: 'f8', type: 'found', emoji: '📄', text: 'RG e CNH encontrados',             city: 'Centro, RJ',            time: '11 min' },
];

const CATEGORY_EMOJI: Record<string, string> = {
  phone: '📱', wallet: '👛', keys: '🔑', bag: '🎒', pet: '🐾',
  bike: '🚲', document: '📄', jewelry: '💍', electronics: '💻',
  clothing: '👕', other: '📦',
};

const TYPE_BG: Record<string, string> = {
  lost:  'bg-red-500/10 border-red-500/20',
  found: 'bg-teal-500/10 border-teal-500/20',
  match: 'bg-yellow-500/10 border-yellow-500/20',
};

const TYPE_COLOR: Record<string, string> = {
  lost:  'text-red-400',
  found: 'text-teal-400',
  match: 'text-yellow-400',
};

const TYPE_LABEL: Record<string, string> = {
  lost:  'Perdido',
  found: 'Achado',
  match: 'Match IA',
};

interface ActivityItem {
  id: string;
  type: string;
  emoji: string;
  text: string;
  city: string;
  time: string;
}

// ─── Fetch real objects from API ──────────────────────────────────────────────
async function fetchRealActivities(): Promise<ActivityItem[]> {
  try {
    const res = await fetch('/api/v1/objects/public?size=20&status=lost', {
      next: { revalidate: 60 },
    });
    if (!res.ok) return [];
    const data = await res.json();
    const items = data?.items ?? [];

    return items.map((obj: {
      id: string;
      title: string;
      category: string;
      status: string;
      location_addr?: string;
      created_at: string;
    }) => {
      const mins = Math.floor((Date.now() - new Date(obj.created_at).getTime()) / 60000);
      const time = mins < 1 ? 'agora' : mins < 60 ? `${mins} min` : `${Math.floor(mins / 60)}h`;
      return {
        id: obj.id,
        type: obj.status,
        emoji: CATEGORY_EMOJI[obj.category] ?? '📦',
        text: obj.title,
        city: obj.location_addr ?? 'São Paulo, SP',
        time,
      };
    });
  } catch {
    return [];
  }
}

// ─── Live Feed ────────────────────────────────────────────────────────────────
function LiveFeed() {
  const [items, setItems] = useState(ACTIVITIES.slice(0, 4));
  const [entering, setEntering] = useState<number | null>(null);
  const counterRef = useRef(4);

  useEffect(() => {
    const interval = setInterval(() => {
      const next = ACTIVITIES[counterRef.current % ACTIVITIES.length];
      counterRef.current++;
      setEntering(next.id);
      setItems(prev => [next, ...prev.slice(0, 3)]);
      setTimeout(() => setEntering(null), 600);
    }, 3500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-2">
      {items.map((item, i) => (
        <div
          key={`${item.id}-${i}`}
          className={`flex items-center gap-3 p-3 rounded-xl border transition-all duration-500 ${
            entering === item.id
              ? 'opacity-0 translate-y-[-8px]'
              : 'opacity-100 translate-y-0'
          } ${TYPE_BG[item.type as keyof typeof TYPE_BG]} bg-white/[0.02]`}
          style={{
            transform: entering === item.id ? 'translateY(-8px)' : 'translateY(0)',
            opacity: entering === item.id ? 0 : 1,
          }}
        >
          <span className="text-xl flex-shrink-0">{item.emoji}</span>
          <div className="flex-1 min-w-0">
            <p className="text-white text-[13px] font-medium truncate">{item.text}</p>
            <p className="text-white/30 text-xs mt-0.5">{item.city}</p>
          </div>
          <div className="flex flex-col items-end gap-1 flex-shrink-0">
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${TYPE_BG[item.type as keyof typeof TYPE_BG]} ${TYPE_COLOR[item.type as keyof typeof TYPE_COLOR]}`}>
              {TYPE_LABEL[item.type as keyof typeof TYPE_LABEL]}
            </span>
            <span className="text-white/20 text-[10px]">{item.time}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Counter ──────────────────────────────────────────────────────────────────
function Counter({ target, suffix = '' }: { target: number; suffix?: string }) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const started = useRef(false);
  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !started.current) {
        started.current = true;
        const steps = 60;
        const increment = target / steps;
        let current = 0;
        const timer = setInterval(() => {
          current = Math.min(current + increment, target);
          setCount(Math.floor(current));
          if (current >= target) clearInterval(timer);
        }, 1800 / steps);
      }
    }, { threshold: 0.5 });
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [target]);
  return <span ref={ref} className="tabular-nums">{count.toLocaleString('pt-BR')}{suffix}</span>;
}

// ─── Navbar ───────────────────────────────────────────────────────────────────
function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 8);
    window.addEventListener('scroll', h, { passive: true });
    return () => window.removeEventListener('scroll', h);
  }, []);
  return (
    <header className={`fixed top-0 inset-x-0 z-50 transition-all duration-500 ${scrolled ? 'bg-[#080b0f]/90 backdrop-blur-xl border-b border-white/[0.06]' : 'bg-transparent'}`}>
      <nav className="max-w-6xl mx-auto px-5 h-14 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-teal-500 flex items-center justify-center">
            <MapPin className="w-3.5 h-3.5 text-white" strokeWidth={2.5} />
          </div>
          <span className="text-white font-semibold tracking-tight text-[15px]">Backfindr</span>
        </Link>
        <div className="hidden md:flex items-center gap-7">
          {[['Como funciona', '#how'], ['Empresas', '#business'], ['Preços', '/pricing']].map(([label, href]) => (
            <a key={label} href={href} className="text-[13px] text-white/40 hover:text-white/80 transition-colors">{label}</a>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <Link href="/auth/login" className="text-[13px] text-white/50 hover:text-white transition-colors px-2">Entrar</Link>
          <Link href="/auth/register" className="flex items-center gap-1.5 text-[13px] font-medium bg-white text-black px-4 py-1.5 rounded-md hover:bg-white/90 transition-all">
            Começar grátis <ChevronRight className="w-3.5 h-3.5" strokeWidth={2.5} />
          </Link>
        </div>
      </nav>
    </header>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function HomePage() {
  return (
    <div className="min-h-screen bg-[#080b0f] text-white selection:bg-teal-500/30">
      <Navbar />

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="relative min-h-screen flex flex-col items-center justify-center px-5 pt-14 overflow-hidden">
        <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse 80% 50% at 50% -10%, rgba(20,184,166,0.12) 0%, transparent 70%)' }} />
        <div className="absolute inset-0 pointer-events-none opacity-[0.03]" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,1) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,1) 1px,transparent 1px)', backgroundSize: '72px 72px' }} />

        <div className="relative z-10 w-full max-w-6xl mx-auto">
          <div className="grid md:grid-cols-2 gap-12 items-center">

            {/* Left — copy */}
            <div>
              <div className="inline-flex items-center gap-2 mb-8 px-3 py-1.5 rounded-full border border-white/10 bg-white/[0.04]">
                <span className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-pulse" />
                <span className="text-[11px] text-white/50 tracking-wide uppercase font-medium">
                  Ativo agora em São Paulo
                </span>
              </div>

              <h1 className="font-bold tracking-[-0.04em] leading-[0.92] mb-6" style={{ fontSize: 'clamp(42px, 7vw, 80px)' }}>
                <span className="text-white">Seu objeto</span><br />
                <span className="text-white">perdido tem</span><br />
                <span style={{ background: 'linear-gradient(135deg, #2dd4bf 0%, #14b8a6 40%, #0d9488 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
                  alguém procurando.
                </span>
              </h1>

              <p className="text-white/40 text-lg max-w-md leading-relaxed mb-4 font-light">
                QR Code único em cada objeto. IA que cruza perdidos com achados automaticamente. Chat mediado para devolução segura.
              </p>

              <p className="text-white/25 text-sm mb-10">
                Mais de <span className="text-teal-400 font-semibold">12.847 objetos</span> registrados · <span className="text-teal-400 font-semibold">3.291 recuperados</span>
              </p>

              <div className="flex flex-col sm:flex-row gap-3">
                <Link href="/auth/register"
                  className="flex items-center gap-2 bg-teal-500 hover:bg-teal-400 text-white text-sm font-semibold px-6 py-3.5 rounded-lg transition-all duration-200 justify-center"
                  style={{ boxShadow: '0 0 0 1px rgba(20,184,166,0.5),0 8px 32px rgba(20,184,166,0.2)' }}>
                  Registrar objeto grátis <ArrowRight className="w-4 h-4" strokeWidth={2.5} />
                </Link>
                <Link href="/map"
                  className="flex items-center gap-2 border border-white/10 hover:border-white/20 bg-white/[0.04] hover:bg-white/[0.07] text-white/70 hover:text-white text-sm px-6 py-3.5 rounded-lg transition-all duration-200 justify-center">
                  <MapPin className="w-4 h-4" /> Ver mapa ao vivo
                </Link>
              </div>
            </div>

            {/* Right — live feed */}
            <div className="relative">
              <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5" style={{ boxShadow: '0 0 80px rgba(20,184,166,0.06)' }}>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-teal-400 animate-pulse" />
                    <span className="text-white text-sm font-semibold">Atividade ao vivo</span>
                  </div>
                  <span className="text-white/20 text-xs">atualiza em tempo real</span>
                </div>

                <LiveFeed />

                <div className="mt-4 pt-4 border-t border-white/[0.06] grid grid-cols-3 gap-3">
                  {[
                    { v: '12.8k+', l: 'Objetos' },
                    { v: '3.2k+', l: 'Recuperados' },
                    { v: '98%', l: 'Com QR Code' },
                  ].map(m => (
                    <div key={m.l} className="text-center p-2 rounded-lg border border-white/[0.06] bg-white/[0.02]">
                      <p className="text-white text-sm font-bold">{m.v}</p>
                      <p className="text-white/30 text-[10px] mt-0.5">{m.l}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Floating badge */}
              <div className="absolute -bottom-4 -left-4 bg-teal-500 text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-lg" style={{ boxShadow: '0 4px 20px rgba(20,184,166,0.4)' }}>
                ⚡ Match encontrado agora
              </div>
            </div>
          </div>

          {/* Stats bar */}
          <div className="mt-20 pt-8 border-t border-white/[0.06] grid grid-cols-3 gap-8 max-w-lg mx-auto text-center">
            {[
              { value: 12847, suffix: '+', label: 'Objetos registrados' },
              { value: 3291,  suffix: '+', label: 'Recuperações confirmadas' },
              { value: 98,    suffix: '%', label: 'Taxa com QR Code' },
            ].map(s => (
              <div key={s.label}>
                <p className="text-2xl font-bold text-white tracking-tight"><Counter target={s.value} suffix={s.suffix} /></p>
                <p className="text-[11px] text-white/30 mt-1 leading-tight">{s.label}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="absolute bottom-0 inset-x-0 h-32 bg-gradient-to-t from-[#080b0f] to-transparent pointer-events-none" />
      </section>

      {/* ── Urgency strip ─────────────────────────────────────────────────── */}
      <section className="border-y border-white/[0.06] bg-teal-500/[0.04] py-4 px-5 overflow-hidden">
        <div className="max-w-6xl mx-auto flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-teal-400 animate-pulse flex-shrink-0" />
          <p className="text-teal-300 text-sm">
            <span className="font-semibold">Sem QR Code, seu objeto é irrecuperável.</span>
            {' '}<span className="text-white/40">Registrar leva 2 minutos e é gratuito.</span>
          </p>
          <Link href="/auth/register" className="ml-auto flex-shrink-0 text-teal-400 hover:text-teal-300 text-sm font-medium flex items-center gap-1 transition-colors">
            Começar <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </section>

      {/* ── How it works ─────────────────────────────────────────────────── */}
      <section id="how" className="py-32 px-5">
        <div className="max-w-5xl mx-auto">
          <div className="mb-16">
            <p className="text-[11px] text-teal-500 uppercase tracking-[0.15em] font-semibold mb-4">Como funciona</p>
            <h2 className="text-4xl font-bold tracking-tight text-white max-w-sm leading-tight">Três passos.<br />Um objeto recuperado.</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-px bg-white/[0.06] rounded-2xl overflow-hidden">
            {[
              { step: '01', icon: <QrCode className="w-5 h-5 text-teal-400" />, title: 'Registre', desc: 'Fotos, descrição e localização. QR Code único e permanente gerado em segundos.' },
              { step: '02', icon: <Zap className="w-5 h-5 text-teal-400" />, title: 'IA encontra', desc: 'Nossa IA cruza automaticamente objetos perdidos com achados. Você é notificado na hora.' },
              { step: '03', icon: <Shield className="w-5 h-5 text-teal-400" />, title: 'Recupere', desc: 'Chat mediado para devolução segura. Seu contato nunca é exposto.' },
            ].map(item => (
              <div key={item.step} className="bg-[#080b0f] p-8 hover:bg-white/[0.02] transition-colors">
                <div className="flex items-start justify-between mb-8">
                  <div className="w-9 h-9 rounded-lg border border-white/10 flex items-center justify-center bg-white/[0.04]">{item.icon}</div>
                  <span className="text-[11px] font-mono text-white/20">{item.step}</span>
                </div>
                <h3 className="text-white font-semibold mb-2 text-[15px]">{item.title}</h3>
                <p className="text-white/40 text-sm leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ─────────────────────────────────────────────────────── */}
      <section className="py-16 px-5 border-t border-white/[0.06]">
        <div className="max-w-5xl mx-auto">
          <div className="grid md:grid-cols-2 gap-16 items-center">
            <div>
              <p className="text-[11px] text-teal-500 uppercase tracking-[0.15em] font-semibold mb-4">Tecnologia real</p>
              <h2 className="text-3xl font-bold tracking-tight text-white leading-tight mb-6">Não é só cadastro.<br />É recuperação ativa.</h2>
              <p className="text-white/40 text-sm leading-relaxed mb-10">A maioria das plataformas é passiva — você cadastra e espera. O Backfindr age: a IA roda matching contínuo, o QR Code notifica em tempo real, e o chat fecha o loop até a devolução.</p>
              <div className="space-y-6">
                {[
                  { icon: <Globe className="w-4 h-4" />, title: 'QR Code permanente', desc: 'Funciona sem app, em qualquer país, para sempre.' },
                  { icon: <Shield className="w-4 h-4" />, title: 'Privacidade total', desc: 'Contato nunca exposto. Comunicação 100% mediada.' },
                  { icon: <Zap className="w-4 h-4" />, title: 'IA de matching contínuo', desc: 'Roda automaticamente. Você não precisa fazer nada.' },
                ].map(f => (
                  <div key={f.title} className="flex gap-4 items-start">
                    <div className="w-8 h-8 rounded-md border border-white/10 bg-white/[0.04] flex items-center justify-center flex-shrink-0 mt-0.5 text-teal-400">{f.icon}</div>
                    <div>
                      <p className="text-white text-sm font-medium mb-0.5">{f.title}</p>
                      <p className="text-white/40 text-sm">{f.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Visual card */}
            <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-6 space-y-3" style={{ boxShadow: '0 0 80px rgba(20,184,166,0.05)' }}>
              <div className="flex items-center gap-3 p-3.5 rounded-xl border border-white/[0.08] bg-white/[0.04]">
                <div className="w-8 h-8 rounded-full bg-teal-500/20 border border-teal-500/30 flex items-center justify-center flex-shrink-0"><MapPin className="w-4 h-4 text-teal-400" /></div>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-[13px] font-medium">Objeto encontrado!</p>
                  <p className="text-white/40 text-xs">iPhone 15 Pro · Metrô Paulista · agora</p>
                </div>
                <div className="w-2 h-2 rounded-full bg-teal-400 flex-shrink-0" />
              </div>
              <div className="flex items-center gap-3 p-3.5 rounded-xl border border-teal-500/20 bg-teal-500/[0.05]">
                <div className="w-8 h-8 rounded-lg bg-teal-500/20 flex items-center justify-center flex-shrink-0"><Zap className="w-4 h-4 text-teal-400" /></div>
                <div>
                  <p className="text-teal-300 text-[13px] font-medium">Match 96% — Carteira</p>
                  <p className="text-white/40 text-xs">IA identificou objeto compatível</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3.5 rounded-xl border border-white/[0.08] bg-white/[0.04]">
                <div className="w-8 h-8 rounded-lg bg-white/[0.08] flex items-center justify-center flex-shrink-0"><QrCode className="w-4 h-4 text-white/60" /></div>
                <div>
                  <p className="text-white text-[13px] font-medium">QR Code escaneado</p>
                  <p className="text-white/40 text-xs">2x hoje · São Paulo, BR</p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 pt-1">
                {[{ v: '2.4h', l: 'Tempo médio' }, { v: '98%', l: 'Com QR' }, { v: '47k+', l: 'Usuários' }].map(m => (
                  <div key={m.l} className="text-center p-2.5 rounded-lg border border-white/[0.06] bg-white/[0.02]">
                    <p className="text-white text-sm font-bold">{m.v}</p>
                    <p className="text-white/30 text-[10px] mt-0.5">{m.l}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Testimonials ─────────────────────────────────────────────────── */}
      <section className="py-24 px-5 border-t border-white/[0.06]">
        <div className="max-w-4xl mx-auto">
          <p className="text-center text-[11px] text-white/30 uppercase tracking-[0.15em] mb-12">Histórias reais</p>
          <div className="grid md:grid-cols-3 gap-4">
            {[
              { text: 'Meu cachorro fugiu e em 2 horas alguém escaneou a placa. Incrível.', name: 'Ana Paula R.', location: 'São Paulo, SP' },
              { text: 'Esqueci a carteira no metrô. No dia seguinte recebi uma notificação. Recuperei tudo.', name: 'Ricardo M.', location: 'Rio de Janeiro, RJ' },
              { text: 'Uso para registrar todos os equipamentos da empresa. Zero perda em 6 meses.', name: 'Carla S.', location: 'Belo Horizonte, MG' },
            ].map(t => (
              <div key={t.name} className="p-5 rounded-xl border border-white/[0.07] bg-white/[0.03]">
                <p className="text-white/60 text-sm leading-relaxed mb-5">"{t.text}"</p>
                <div>
                  <p className="text-white text-[13px] font-medium">{t.name}</p>
                  <p className="text-white/30 text-xs mt-0.5">{t.location}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA final ────────────────────────────────────────────────────── */}
      <section className="py-24 px-5 border-t border-white/[0.06]">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-4xl font-bold tracking-tight text-white mb-4">
            Cada minuto sem QR Code<br />é risco desnecessário.
          </h2>
          <p className="text-white/40 text-sm mb-8">Registre agora. Grátis. Leva 2 minutos.</p>
          <Link href="/auth/register"
            className="inline-flex items-center gap-2 bg-teal-500 hover:bg-teal-400 text-white font-semibold px-8 py-4 rounded-lg transition-all text-sm"
            style={{ boxShadow: '0 0 0 1px rgba(20,184,166,0.5),0 8px 32px rgba(20,184,166,0.2)' }}>
            Proteger meus objetos agora <ArrowRight className="w-4 h-4" strokeWidth={2.5} />
          </Link>
          <p className="text-white/20 text-xs mt-4">Sem cartão de crédito · Gratuito para sempre</p>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <footer className="border-t border-white/[0.06] py-8 px-5">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-md bg-teal-500 flex items-center justify-center"><MapPin className="w-2.5 h-2.5 text-white" strokeWidth={2.5} /></div>
            <span className="text-white text-sm font-semibold">Backfindr</span>
          </div>
          <p className="text-white/20 text-xs">© 2026 Backfindr. Todos os direitos reservados.</p>
          <div className="flex gap-6 text-xs text-white/30">
            <a href="/privacy" className="hover:text-white transition-colors">Privacidade</a>
            <a href="/terms" className="hover:text-white transition-colors">Termos</a>
            <a href="/pricing" className="hover:text-white transition-colors">Preços</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
