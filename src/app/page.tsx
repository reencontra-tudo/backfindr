'use client';

import Link from 'next/link';
import { useState, useEffect, useRef } from 'react';
import { ArrowRight, MapPin, QrCode, Zap, Shield, Globe, ChevronRight, Bell, Scan, Heart, Briefcase, Smartphone } from 'lucide-react';

// ─── Fallback data ────────────────────────────────────────────────────────────
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
  id: string; type: string; emoji: string; text: string; city: string; time: string;
}

async function fetchRealActivities(): Promise<ActivityItem[]> {
  try {
    const res = await fetch('/api/v1/objects/public?size=20&status=lost', { next: { revalidate: 60 } });
    if (!res.ok) return [];
    const data = await res.json();
    const items = data?.items ?? [];
    return items.map((obj: { id: string; title: string; category: string; status: string; location_addr?: string; created_at: string }) => {
      const mins = Math.floor((Date.now() - new Date(obj.created_at).getTime()) / 60000);
      const time = mins < 1 ? 'agora' : mins < 60 ? `${mins} min` : `${Math.floor(mins / 60)}h`;
      return { id: obj.id, type: obj.status, emoji: CATEGORY_EMOJI[obj.category] ?? '📦', text: obj.title, city: obj.location_addr ?? 'São Paulo, SP', time };
    });
  } catch { return []; }
}

// ─── Live Feed ────────────────────────────────────────────────────────────────
function LiveFeed() {
  const [items, setItems] = useState(FALLBACK_ACTIVITIES.slice(0, 4));
  const [entering, setEntering] = useState<string | null>(null);
  const counterRef = useRef(4);
  useEffect(() => {
    const interval = setInterval(() => {
      const next = FALLBACK_ACTIVITIES[counterRef.current % FALLBACK_ACTIVITIES.length];
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
        <div key={`${item.id}-${i}`}
          className={`flex items-center gap-3 p-3 rounded-xl border transition-all duration-500 ${entering === item.id ? 'opacity-0 -translate-y-2' : 'opacity-100 translate-y-0'} ${TYPE_BG[item.type as keyof typeof TYPE_BG]} bg-white/[0.02]`}>
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

// ─── FadeIn wrapper ───────────────────────────────────────────────────────────
function FadeIn({ children, delay = 0, className = '' }: { children: React.ReactNode; delay?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setVisible(true); observer.disconnect(); }
    }, { threshold: 0.1 });
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);
  return (
    <div ref={ref} className={className} style={{ opacity: visible ? 1 : 0, transform: visible ? 'translateY(0)' : 'translateY(24px)', transition: `opacity 0.7s ease ${delay}ms, transform 0.7s ease ${delay}ms` }}>
      {children}
    </div>
  );
}

// ─── Hero Mockup ──────────────────────────────────────────────────────────────
function HeroMockup() {
  const [notifVisible, setNotifVisible] = useState(false);
  const [scanVisible, setScanVisible] = useState(false);
  useEffect(() => {
    const t1 = setTimeout(() => setNotifVisible(true), 800);
    const t2 = setTimeout(() => setScanVisible(true), 1600);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);
  return (
    <div className="relative w-full max-w-sm mx-auto">
      {/* Main card — produto */}
      <div className="rounded-2xl border border-white/[0.1] bg-white/[0.03] backdrop-blur-sm p-5 space-y-3"
        style={{ boxShadow: '0 0 80px rgba(20,184,166,0.08), 0 0 0 1px rgba(20,184,166,0.06)' }}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-teal-400 animate-pulse" />
            <span className="text-white text-sm font-semibold">Atividade ao vivo</span>
          </div>
          <span className="text-white/20 text-xs">em tempo real</span>
        </div>
        <LiveFeed />
        <div className="mt-4 pt-4 border-t border-white/[0.06] grid grid-cols-3 gap-3">
          {[{ v: '12.8k+', l: 'Objetos' }, { v: '3.2k+', l: 'Recuperados' }, { v: '98%', l: 'Com QR Code' }].map(m => (
            <div key={m.l} className="text-center p-2 rounded-lg border border-white/[0.06] bg-white/[0.02]">
              <p className="text-white text-sm font-bold">{m.v}</p>
              <p className="text-white/30 text-[10px] mt-0.5">{m.l}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Floating notification */}
      <div className={`absolute -top-4 -right-4 bg-[#0f1a1a] border border-teal-500/30 rounded-xl px-3 py-2.5 flex items-center gap-2.5 transition-all duration-700 ${notifVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
        style={{ boxShadow: '0 4px 24px rgba(20,184,166,0.2)', minWidth: '180px' }}>
        <div className="w-7 h-7 rounded-lg bg-teal-500/20 flex items-center justify-center flex-shrink-0">
          <Bell className="w-3.5 h-3.5 text-teal-400" />
        </div>
        <div>
          <p className="text-teal-300 text-[11px] font-bold">Objeto encontrado!</p>
          <p className="text-white/40 text-[10px]">iPhone 15 Pro · agora</p>
        </div>
      </div>

      {/* Floating scan badge */}
      <div className={`absolute -bottom-4 -left-4 bg-[#0f1a1a] border border-white/[0.12] rounded-xl px-3 py-2.5 flex items-center gap-2.5 transition-all duration-700 ${scanVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
        style={{ boxShadow: '0 4px 24px rgba(0,0,0,0.4)', minWidth: '160px' }}>
        <div className="w-7 h-7 rounded-lg bg-white/[0.08] flex items-center justify-center flex-shrink-0">
          <Scan className="w-3.5 h-3.5 text-white/60" />
        </div>
        <div>
          <p className="text-white text-[11px] font-bold">QR escaneado</p>
          <p className="text-white/40 text-[10px]">Match 96% · IA ativa</p>
        </div>
      </div>
    </div>
  );
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
          {[['Como funciona', '#how'], ['Para pets', '#pets'], ['Empresas', '#business'], ['Preços', '/pricing']].map(([label, href]) => (
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
        {/* Background glow */}
        <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse 80% 50% at 50% -10%, rgba(20,184,166,0.14) 0%, transparent 70%)' }} />
        {/* Grid */}
        <div className="absolute inset-0 pointer-events-none opacity-[0.025]" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,1) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,1) 1px,transparent 1px)', backgroundSize: '72px 72px' }} />

        <div className="relative z-10 w-full max-w-6xl mx-auto">
          <div className="grid md:grid-cols-2 gap-16 items-center">

            {/* Left — copy */}
            <div>
              <div className="inline-flex items-center gap-2 mb-8 px-3 py-1.5 rounded-full border border-white/10 bg-white/[0.04]">
                <span className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-pulse" />
                <span className="text-[11px] text-white/50 tracking-wide uppercase font-medium">
                  Ativo agora em São Paulo
                </span>
              </div>

              <h1 className="font-bold tracking-[-0.04em] leading-[0.92] mb-6" style={{ fontSize: 'clamp(42px, 7vw, 80px)' }}>
                <span className="text-white">Proteja o que</span><br />
                <span className="text-white">importa antes</span><br />
                <span style={{ background: 'linear-gradient(135deg, #2dd4bf 0%, #14b8a6 40%, #0d9488 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
                  que desapareça.
                </span>
              </h1>

              <p className="text-white/40 text-lg max-w-md leading-relaxed mb-4 font-light">
                Crie um QR Code para seus itens e pets. Se alguém encontrar, você é avisado na hora.
              </p>

              <p className="text-white/25 text-sm mb-10">
                Mais de <span className="text-teal-400 font-semibold">12.847 objetos</span> registrados · <span className="text-teal-400 font-semibold">3.291 recuperados</span>
              </p>

              <div className="flex flex-col sm:flex-row gap-3">
                <Link href="/auth/register"
                  className="flex items-center gap-2 bg-teal-500 hover:bg-teal-400 text-white text-sm font-semibold px-6 py-3.5 rounded-lg transition-all duration-200 justify-center"
                  style={{ boxShadow: '0 0 0 1px rgba(20,184,166,0.5),0 8px 32px rgba(20,184,166,0.2)' }}>
                  Criar meu QR grátis <ArrowRight className="w-4 h-4" strokeWidth={2.5} />
                </Link>
                <Link href="/map"
                  className="flex items-center gap-2 text-white/50 hover:text-white text-sm font-medium px-6 py-3.5 rounded-lg border border-white/[0.08] hover:border-white/20 transition-all justify-center">
                  <MapPin className="w-4 h-4" /> Ver mapa ao vivo
                </Link>
              </div>
            </div>

            {/* Right — hero mockup */}
            <div className="hidden md:block">
              <HeroMockup />
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
            <span className="font-semibold">Você só lembra disso depois que perde.</span>
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
          <FadeIn>
            <div className="mb-16">
              <p className="text-[11px] text-teal-500 uppercase tracking-[0.15em] font-semibold mb-4">Como funciona</p>
              <h2 className="text-4xl font-bold tracking-tight text-white max-w-sm leading-tight">Simples assim.<br />Um objeto recuperado.</h2>
            </div>
          </FadeIn>
          <div className="grid md:grid-cols-3 gap-px bg-white/[0.06] rounded-2xl overflow-hidden">
            {[
              { step: '01', icon: <QrCode className="w-5 h-5 text-teal-400" />, title: 'Crie seu QR Code', desc: 'Cadastre o item ou pet em segundos. QR Code único e permanente gerado na hora.' },
              { step: '02', icon: <Zap className="w-5 h-5 text-teal-400" />, title: 'Cole e proteja', desc: 'Use na mochila, coleira, carteira ou documento. Funciona sem app, em qualquer lugar.' },
              { step: '03', icon: <Shield className="w-5 h-5 text-teal-400" />, title: 'Receba o alerta', desc: 'Quem encontrar escaneia. Você recebe o aviso imediatamente. Chat mediado para devolução segura.' },
            ].map((item, idx) => (
              <FadeIn key={item.step} delay={idx * 120}>
                <div className="h-full bg-[#080b0f] p-8 hover:bg-white/[0.025] transition-all duration-300 group cursor-default"
                  style={{ boxShadow: 'inset 0 0 0 0 rgba(20,184,166,0)' }}>
                  <div className="flex items-start justify-between mb-8">
                    <div className="w-9 h-9 rounded-lg border border-white/10 flex items-center justify-center bg-white/[0.04] group-hover:border-teal-500/30 group-hover:bg-teal-500/[0.08] transition-all duration-300">{item.icon}</div>
                    <span className="text-[11px] font-mono text-white/20">{item.step}</span>
                  </div>
                  <h3 className="text-white font-semibold mb-2 text-[15px]">{item.title}</h3>
                  <p className="text-white/40 text-sm leading-relaxed">{item.desc}</p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ── Emotional section ─────────────────────────────────────────────── */}
      <section className="py-24 px-5 border-t border-white/[0.06]" style={{ background: 'linear-gradient(180deg, transparent 0%, rgba(20,184,166,0.03) 50%, transparent 100%)' }}>
        <div className="max-w-4xl mx-auto text-center">
          <FadeIn>
            <h2 className="text-4xl md:text-5xl font-bold tracking-tight text-white mb-4 leading-tight">
              Você só pensa nisso<br />
              <span style={{ background: 'linear-gradient(135deg, #2dd4bf, #0d9488)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
                depois que perde.
              </span>
            </h2>
            <p className="text-white/30 text-lg mb-16">Quando acontece, cada minuto importa.</p>
          </FadeIn>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              { icon: <Smartphone className="w-8 h-8 text-white/60" />, label: 'Celular', sub: 'Perdido no transporte público', color: 'border-red-500/20 bg-red-500/[0.04]' },
              { icon: <span className="text-3xl">🎒</span>, label: 'Mochila', sub: 'Esquecida no restaurante', color: 'border-yellow-500/20 bg-yellow-500/[0.04]' },
              { icon: <span className="text-3xl">🐕</span>, label: 'Pet', sub: 'Fugiu pelo portão aberto', color: 'border-teal-500/20 bg-teal-500/[0.04]' },
            ].map((item, idx) => (
              <FadeIn key={item.label} delay={idx * 150}>
                <div className={`rounded-2xl border p-8 flex flex-col items-center gap-4 ${item.color}`}>
                  <div className="w-16 h-16 rounded-2xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center">
                    {item.icon}
                  </div>
                  <div>
                    <p className="text-white font-semibold text-lg">{item.label}</p>
                    <p className="text-white/30 text-sm mt-1">{item.sub}</p>
                  </div>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features / Proof ─────────────────────────────────────────────── */}
      <section className="py-24 px-5 border-t border-white/[0.06]">
        <div className="max-w-5xl mx-auto">
          <div className="grid md:grid-cols-2 gap-16 items-center">
            <FadeIn>
              <div>
                <p className="text-[11px] text-teal-500 uppercase tracking-[0.15em] font-semibold mb-4">Feito para funcionar no mundo real</p>
                <h2 className="text-3xl font-bold tracking-tight text-white leading-tight mb-6">Celular, mochila, cachorro…<br />E não tinha nada pra te ajudar.</h2>
                <p className="text-white/40 text-sm leading-relaxed mb-10">A maioria das plataformas é passiva — você cadastra e espera. O Backfindr age: a IA roda matching contínuo, o QR Code notifica em tempo real, e o chat fecha o loop até a devolução. <strong className="text-white/70">Agora tem.</strong></p>
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
            </FadeIn>

            {/* Visual proof card */}
            <FadeIn delay={200}>
              <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6 space-y-3"
                style={{ boxShadow: '0 0 80px rgba(20,184,166,0.06), 0 0 0 1px rgba(20,184,166,0.04)' }}>
                {/* Notification row */}
                <div className="flex items-center gap-3 p-3.5 rounded-xl border border-teal-500/20 bg-teal-500/[0.06]">
                  <div className="w-8 h-8 rounded-full bg-teal-500/20 border border-teal-500/30 flex items-center justify-center flex-shrink-0">
                    <Bell className="w-4 h-4 text-teal-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-teal-300 text-[13px] font-medium">Objeto encontrado!</p>
                    <p className="text-white/40 text-xs">iPhone 15 Pro · Metrô Paulista · agora</p>
                  </div>
                  <div className="w-2 h-2 rounded-full bg-teal-400 flex-shrink-0 animate-pulse" />
                </div>
                {/* Match row */}
                <div className="flex items-center gap-3 p-3.5 rounded-xl border border-yellow-500/20 bg-yellow-500/[0.04]">
                  <div className="w-8 h-8 rounded-lg bg-yellow-500/20 flex items-center justify-center flex-shrink-0">
                    <Zap className="w-4 h-4 text-yellow-400" />
                  </div>
                  <div>
                    <p className="text-yellow-300 text-[13px] font-medium">Match 96% — Carteira</p>
                    <p className="text-white/40 text-xs">IA identificou objeto compatível</p>
                  </div>
                </div>
                {/* Scan row */}
                <div className="flex items-center gap-3 p-3.5 rounded-xl border border-white/[0.08] bg-white/[0.04]">
                  <div className="w-8 h-8 rounded-lg bg-white/[0.08] flex items-center justify-center flex-shrink-0">
                    <QrCode className="w-4 h-4 text-white/60" />
                  </div>
                  <div>
                    <p className="text-white text-[13px] font-medium">QR Code escaneado</p>
                    <p className="text-white/40 text-xs">2x hoje · São Paulo, BR</p>
                  </div>
                </div>
                {/* Chat row */}
                <div className="flex items-center gap-3 p-3.5 rounded-xl border border-white/[0.08] bg-white/[0.04]">
                  <div className="w-8 h-8 rounded-lg bg-white/[0.08] flex items-center justify-center flex-shrink-0">
                    <Shield className="w-4 h-4 text-white/60" />
                  </div>
                  <div>
                    <p className="text-white text-[13px] font-medium">Chat mediado iniciado</p>
                    <p className="text-white/40 text-xs">Devolução combinada · privacidade garantida</p>
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
            </FadeIn>
          </div>
        </div>
      </section>

      {/* ── Pets section ─────────────────────────────────────────────────── */}
      <section id="pets" className="py-24 px-5 border-t border-white/[0.06]" style={{ background: 'linear-gradient(135deg, rgba(20,184,166,0.04) 0%, transparent 60%)' }}>
        <div className="max-w-5xl mx-auto">
          <div className="grid md:grid-cols-2 gap-16 items-center">
            <FadeIn>
              <div>
                <div className="inline-flex items-center gap-2 mb-6 px-3 py-1.5 rounded-full border border-teal-500/20 bg-teal-500/[0.06]">
                  <Heart className="w-3.5 h-3.5 text-teal-400" />
                  <span className="text-[11px] text-teal-400 tracking-wide uppercase font-medium">Para pets</span>
                </div>
                <h2 className="text-4xl font-bold tracking-tight text-white leading-tight mb-4">
                  Seu pet pode<br />sumir hoje.
                </h2>
                <p className="text-white/40 text-sm leading-relaxed mb-8">
                  Coloque um QR Code na coleira. Se alguém encontrar seu pet, escaneia e você recebe o alerta imediatamente — com localização e contato mediado. Sem expor seu número.
                </p>
                <div className="space-y-3 mb-10">
                  {[
                    'QR Code resistente à água na coleira',
                    'Alerta imediato quando escaneado',
                    'Chat seguro com quem encontrou',
                    'Funciona sem app para quem achar',
                  ].map(item => (
                    <div key={item} className="flex items-center gap-3">
                      <div className="w-4 h-4 rounded-full bg-teal-500/20 border border-teal-500/30 flex items-center justify-center flex-shrink-0">
                        <div className="w-1.5 h-1.5 rounded-full bg-teal-400" />
                      </div>
                      <span className="text-white/60 text-sm">{item}</span>
                    </div>
                  ))}
                </div>
                <Link href="/auth/register?type=pet"
                  className="inline-flex items-center gap-2 bg-teal-500 hover:bg-teal-400 text-white text-sm font-semibold px-6 py-3.5 rounded-lg transition-all duration-200"
                  style={{ boxShadow: '0 0 0 1px rgba(20,184,166,0.5),0 8px 32px rgba(20,184,166,0.2)' }}>
                  <Heart className="w-4 h-4" /> Criar QR para meu pet
                </Link>
              </div>
            </FadeIn>

            <FadeIn delay={200}>
              <div className="rounded-2xl border border-teal-500/10 bg-teal-500/[0.03] p-8 text-center"
                style={{ boxShadow: '0 0 60px rgba(20,184,166,0.06)' }}>
                <div className="text-8xl mb-6">🐕</div>
                <div className="space-y-3">
                  <div className="p-3.5 rounded-xl border border-teal-500/20 bg-teal-500/[0.06] text-left">
                    <p className="text-teal-300 text-sm font-medium">QR escaneado — Labrador caramelo</p>
                    <p className="text-white/40 text-xs mt-0.5">Ibirapuera, SP · há 3 minutos</p>
                  </div>
                  <div className="p-3.5 rounded-xl border border-white/[0.08] bg-white/[0.04] text-left">
                    <p className="text-white text-sm font-medium">Notificação enviada ao dono</p>
                    <p className="text-white/40 text-xs mt-0.5">Chat mediado disponível · privacidade garantida</p>
                  </div>
                </div>
              </div>
            </FadeIn>
          </div>
        </div>
      </section>

      {/* ── Business section ─────────────────────────────────────────────── */}
      <section id="business" className="py-24 px-5 border-t border-white/[0.06]">
        <div className="max-w-5xl mx-auto">
          <FadeIn>
            <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-10 md:p-14"
              style={{ boxShadow: '0 0 80px rgba(20,184,166,0.04)' }}>
              <div className="grid md:grid-cols-2 gap-12 items-center">
                <div>
                  <div className="inline-flex items-center gap-2 mb-6 px-3 py-1.5 rounded-full border border-white/10 bg-white/[0.04]">
                    <Briefcase className="w-3.5 h-3.5 text-white/50" />
                    <span className="text-[11px] text-white/50 tracking-wide uppercase font-medium">Para empresas</span>
                  </div>
                  <h2 className="text-3xl font-bold tracking-tight text-white leading-tight mb-4">
                    Gerencie equipamentos,<br />frotas e patrimônio.
                  </h2>
                  <p className="text-white/40 text-sm leading-relaxed mb-8">
                    Registre notebooks, câmeras, ferramentas e qualquer ativo da empresa. Relatórios, rastreamento e painel B2B para equipes de qualquer tamanho.
                  </p>
                  <a href="mailto:business@backfindr.com"
                    className="inline-flex items-center gap-2 border border-white/[0.12] hover:border-white/30 text-white text-sm font-medium px-6 py-3 rounded-lg transition-all duration-200">
                    Falar com vendas <ArrowRight className="w-4 h-4" />
                  </a>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { v: 'Até 10', l: 'usuários por conta' },
                    { v: 'API', l: 'integração própria' },
                    { v: 'SLA', l: 'garantido em contrato' },
                    { v: 'R$ 149', l: 'por mês, tudo incluído' },
                  ].map(m => (
                    <div key={m.l} className="p-4 rounded-xl border border-white/[0.07] bg-white/[0.03] text-center">
                      <p className="text-white font-bold text-lg">{m.v}</p>
                      <p className="text-white/30 text-xs mt-1 leading-tight">{m.l}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ── Testimonials ─────────────────────────────────────────────────── */}
      <section className="py-24 px-5 border-t border-white/[0.06]">
        <div className="max-w-4xl mx-auto">
          <FadeIn>
            <p className="text-center text-[11px] text-white/30 uppercase tracking-[0.15em] mb-12">Histórias reais</p>
          </FadeIn>
          <div className="grid md:grid-cols-3 gap-4">
            {[
              { text: 'Meu cachorro fugiu e em 2 horas alguém escaneou a placa. Incrível.', name: 'Ana Paula R.', location: 'São Paulo, SP' },
              { text: 'Esqueci a carteira no metrô. No dia seguinte recebi uma notificação. Recuperei tudo.', name: 'Ricardo M.', location: 'Rio de Janeiro, RJ' },
              { text: 'Uso para registrar todos os equipamentos da empresa. Zero perda em 6 meses.', name: 'Carla S.', location: 'Belo Horizonte, MG' },
            ].map((t, idx) => (
              <FadeIn key={t.name} delay={idx * 100}>
                <div className="h-full p-5 rounded-xl border border-white/[0.07] bg-white/[0.03] hover:bg-white/[0.05] transition-colors">
                  <p className="text-white/60 text-sm leading-relaxed mb-5">"{t.text}"</p>
                  <div>
                    <p className="text-white text-[13px] font-medium">{t.name}</p>
                    <p className="text-white/30 text-xs mt-0.5">{t.location}</p>
                  </div>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA final ────────────────────────────────────────────────────── */}
      <section className="py-32 px-5 border-t border-white/[0.06]" style={{ background: 'radial-gradient(ellipse 60% 40% at 50% 100%, rgba(20,184,166,0.08) 0%, transparent 70%)' }}>
        <div className="max-w-2xl mx-auto text-center">
          <FadeIn>
            <h2 className="text-4xl md:text-5xl font-bold tracking-tight text-white mb-4 leading-tight">
              Depois que perde,<br />não adianta cadastrar.
            </h2>
            <p className="text-white/40 text-sm mb-10">Registre agora. Grátis. Leva menos de 30 segundos.</p>
            <Link href="/auth/register"
              className="inline-flex items-center gap-2 bg-teal-500 hover:bg-teal-400 text-white font-semibold px-10 py-4 rounded-lg transition-all text-sm"
              style={{ boxShadow: '0 0 0 1px rgba(20,184,166,0.5),0 8px 40px rgba(20,184,166,0.25)' }}>
              Criar meu QR agora <ArrowRight className="w-4 h-4" strokeWidth={2.5} />
            </Link>
            <p className="text-white/20 text-xs mt-4">Sem cartão de crédito · Gratuito para sempre</p>
          </FadeIn>
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
            <a href="/map" className="hover:text-white transition-colors">Mapa</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
