'use client';
import Link from 'next/link';
import Image from 'next/image';
import { useState, useEffect, useRef } from 'react';
import { ArrowRight, QrCode, Bell, Scan, Heart } from 'lucide-react';

// ─── Fallback activities ──────────────────────────────────────────────────────
const FALLBACK_ACTIVITIES = [
  { id: 'f1', type: 'lost',  emoji: '📱', text: 'iPhone 15 Pro preto perdido',      city: 'Metrô Paulista, SP',  time: 'agora' },
  { id: 'f2', type: 'found', emoji: '👛', text: 'Carteira encontrada com docs',     city: 'Pinheiros, SP',       time: '1 min' },
  { id: 'f3', type: 'match', emoji: '⚡', text: 'Match 94% confirmado pela IA',     city: 'Brooklin, SP',        time: '2 min' },
  { id: 'f4', type: 'lost',  emoji: '🐾', text: 'Labrador caramelo desaparecido',   city: 'Ibirapuera, SP',      time: '3 min' },
  { id: 'f5', type: 'found', emoji: '🔑', text: 'Chaves encontradas no estac.',     city: 'Vila Mariana, SP',    time: '5 min' },
  { id: 'f6', type: 'match', emoji: '⚡', text: 'Objeto devolvido ao dono',         city: 'Moema, SP',           time: '7 min' },
  { id: 'f7', type: 'lost',  emoji: '💻', text: 'MacBook Air prata desaparecido',   city: 'Faria Lima, SP',      time: '9 min' },
  { id: 'f8', type: 'found', emoji: '📄', text: 'RG e CNH encontrados',             city: 'Centro, RJ',          time: '11 min' },
];

const CATEGORY_EMOJI: Record<string, string> = {
  phone: '📱', wallet: '👛', keys: '🔑', bag: '🎒', pet: '🐾',
  bike: '🚲', document: '📄', jewelry: '💍', electronics: '💻',
  clothing: '👕', other: '📦',
};

interface ActivityItem {
  id: string; type: string; emoji: string; text: string; city: string; time: string;
}

// ─── Counter ─────────────────────────────────────────────────────────────────
function Counter({ target, suffix = '' }: { target: number; suffix?: string }) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      observer.disconnect();
      let start = 0;
      const step = Math.ceil(target / 60);
      const t = setInterval(() => {
        start += step;
        if (start >= target) { setCount(target); clearInterval(t); }
        else setCount(start);
      }, 16);
    });
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [target]);
  return <span ref={ref} className="tabular-nums">{count.toLocaleString('pt-BR')}{suffix}</span>;
}

// ─── FadeIn ───────────────────────────────────────────────────────────────────
function FadeIn({ children, delay = 0, className = '' }: { children: React.ReactNode; delay?: number; className?: string }) {
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setVisible(true); observer.disconnect(); }
    });
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);
  return (
    <div ref={ref} className={className} style={{ opacity: visible ? 1 : 0, transform: visible ? 'translateY(0)' : 'translateY(24px)', transition: `opacity 0.7s ease ${delay}ms, transform 0.7s ease ${delay}ms` }}>
      {children}
    </div>
  );
}

// ─── Ticker ───────────────────────────────────────────────────────────────────
function LiveTicker({ items }: { items: ActivityItem[] }) {
  const TYPE_COLOR: Record<string, string> = { lost: 'text-red-400', found: 'text-teal-400', match: 'text-yellow-400' };
  const TYPE_LABEL: Record<string, string> = { lost: 'Perdido', found: 'Achado', match: 'Match IA' };
  const doubled = [...items, ...items];
  return (
    <div className="overflow-hidden py-3 border-y border-white/[0.06] bg-white/[0.02]">
      <div className="flex gap-6 w-max" style={{ animation: 'ticker 30s linear infinite' }}>
        {doubled.map((item, i) => (
          <div key={i} className="flex items-center gap-2 px-3 py-1 rounded-full border border-white/[0.08] bg-white/[0.03] flex-shrink-0">
            <span className="text-sm">{item.emoji}</span>
            <span className={`text-xs font-semibold ${TYPE_COLOR[item.type] ?? 'text-white/60'}`}>{TYPE_LABEL[item.type] ?? item.type}</span>
            <span className="text-xs text-white/50 max-w-[160px] truncate">{item.text}</span>
            <span className="text-[10px] text-white/30">{item.city}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Navbar ───────────────────────────────────────────────────────────────────
function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', h);
    return () => window.removeEventListener('scroll', h);
  }, []);
  return (
    <nav className={`fixed top-0 inset-x-0 z-50 flex items-center justify-between px-5 py-4 transition-all duration-300 ${scrolled ? 'bg-[#07090e]/90 backdrop-blur-md border-b border-white/[0.06]' : ''}`}>
      <Link href="/" className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-lg bg-teal-500 flex items-center justify-center">
          <QrCode className="w-4 h-4 text-white" strokeWidth={2.5} />
        </div>
        <span className="font-bold text-white text-sm tracking-tight">Backfindr</span>
      </Link>
      <div className="hidden md:flex items-center gap-7">
        {([['Como funciona', '#how'], ['Pets', '#pets'], ['Preços', '/pricing'], ['Blog', '/blog']] as [string, string][]).map(([label, href]) => (
          <Link key={label} href={href} className="text-white/40 hover:text-white text-sm transition-colors">{label}</Link>
        ))}
      </div>
      <div className="flex items-center gap-3">
        <Link href="/auth/login" className="text-white/50 hover:text-white text-sm transition-colors hidden sm:block">Entrar</Link>
        <Link href="/auth/register" className="bg-teal-500 hover:bg-teal-400 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors">
          Criar QR grátis
        </Link>
      </div>
    </nav>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function HomePage() {
  const [activities, setActivities] = useState<ActivityItem[]>(FALLBACK_ACTIVITIES);

  useEffect(() => {
    fetch('/api/v1/objects/public?size=20&status=lost')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        const items = data?.items ?? [];
        if (items.length > 0) {
          setActivities(items.slice(0, 8).map((obj: { id: string; title: string; category: string; status: string; location_addr?: string; created_at: string }) => {
            const mins = Math.floor((Date.now() - new Date(obj.created_at).getTime()) / 60000);
            const time = mins < 1 ? 'agora' : mins < 60 ? `${mins} min` : `${Math.floor(mins / 60)}h`;
            return { id: obj.id, type: obj.status, emoji: CATEGORY_EMOJI[obj.category] ?? '📦', text: obj.title, city: obj.location_addr ?? 'São Paulo, SP', time };
          }));
        }
      })
      .catch(() => {});
  }, []);

  return (
    <div className="min-h-screen bg-[#07090e] text-white selection:bg-teal-500/30">
      <style>{`
        @keyframes ticker { from { transform: translateX(0) } to { transform: translateX(-50%) } }
        @keyframes floatup { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-8px) } }
        @keyframes notif-in { from { opacity: 0; transform: translateY(12px) } to { opacity: 1; transform: translateY(0) } }
      `}</style>

      <Navbar />

      {/* ── HERO ─────────────────────────────────────────────────────────── */}
      <section className="relative min-h-screen flex flex-col justify-center px-5 pt-20 pb-10 overflow-hidden">
        <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse 90% 60% at 50% -5%, rgba(15,40,80,0.9) 0%, rgba(7,9,14,1) 65%)' }} />
        <div className="absolute inset-0 pointer-events-none opacity-[0.03]" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,1) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,1) 1px,transparent 1px)', backgroundSize: '60px 60px' }} />

        <div className="relative z-10 w-full max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">

            {/* LEFT — copy */}
            <div>
              <div className="inline-flex items-center gap-2 mb-6 px-3 py-1.5 rounded-full border border-red-500/30 bg-red-500/10">
                <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
                <span className="text-[11px] text-red-300 tracking-wide uppercase font-semibold">
                  Seu pet pode sumir hoje
                </span>
              </div>

              <h1 className="font-extrabold tracking-[-0.04em] leading-[0.9] mb-5" style={{ fontSize: 'clamp(40px, 6.5vw, 76px)' }}>
                <span className="text-white">Se você perder,</span><br />
                <span style={{ background: 'linear-gradient(135deg, #38bdf8 0%, #2dd4bf 50%, #14b8a6 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
                  já pode ser tarde.
                </span>
              </h1>

              <p className="text-white/50 text-base max-w-sm leading-relaxed mb-8 font-light">
                Você só precisa de um QR.
              </p>

              <Link href="/auth/register"
                className="inline-flex items-center gap-2 bg-teal-500 hover:bg-teal-400 text-white font-bold px-8 py-4 rounded-xl text-base transition-all duration-200"
                style={{ boxShadow: '0 0 0 1px rgba(20,184,166,0.5),0 12px 40px rgba(20,184,166,0.25)' }}>
                Criar meu QR grátis <ArrowRight className="w-5 h-5" strokeWidth={2.5} />
              </Link>
              <p className="text-white/25 text-xs mt-3">Leva menos de 30 segundos · Gratuito para sempre</p>

              <div className="flex items-center gap-3 mt-8">
                <div className="flex -space-x-2">
                  {(['bg-teal-500','bg-blue-500','bg-purple-500','bg-amber-500'] as string[]).map((c,i) => (
                    <div key={i} className={`w-7 h-7 rounded-full border-2 border-[#07090e] ${c} flex items-center justify-center text-[10px] font-bold text-white`}>
                      {['M','A','R','C'][i]}
                    </div>
                  ))}
                </div>
                <p className="text-white/40 text-xs">
                  <span className="text-white font-semibold">12.847</span> objetos protegidos ·{' '}
                  <span className="text-teal-400 font-semibold">3.291</span> recuperados
                </p>
              </div>
            </div>

            {/* RIGHT — hero image */}
            <div className="relative flex items-center justify-center" style={{ animation: 'floatup 4s ease-in-out infinite' }}>
              <div className="relative w-full max-w-md">
                <Image
                  src="/img_hero.png"
                  alt="Dispositivo escaneando QR Code"
                  width={520}
                  height={420}
                  className="w-full rounded-2xl"
                  priority
                />
                <div className="absolute top-4 right-4 bg-[#0a1628]/95 border border-teal-500/40 rounded-xl px-3 py-2.5 flex items-center gap-2.5 shadow-xl"
                  style={{ animation: 'notif-in 0.6s ease 0.8s both' }}>
                  <div className="w-7 h-7 rounded-lg bg-teal-500/20 flex items-center justify-center flex-shrink-0">
                    <Bell className="w-3.5 h-3.5 text-teal-400" />
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold text-white">Item Encontrado!</p>
                    <p className="text-[10px] text-white/50">Clique para falar agora</p>
                  </div>
                </div>
                <div className="absolute bottom-4 left-4 bg-[#0a1628]/95 border border-white/20 rounded-xl px-3 py-2.5 flex items-center gap-2.5 shadow-xl"
                  style={{ animation: 'notif-in 0.6s ease 1.2s both' }}>
                  <div className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0">
                    <Scan className="w-3.5 h-3.5 text-white/70" />
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold text-white">Achou? Escaneie!</p>
                    <p className="text-[10px] text-white/50">QR Code identificado</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── TICKER ───────────────────────────────────────────────────────── */}
      <LiveTicker items={activities} />

      {/* ── 3 PASSOS ─────────────────────────────────────────────────────── */}
      <section id="how" className="py-24 px-5">
        <div className="max-w-5xl mx-auto">
          <FadeIn>
            <p className="text-center text-white/30 text-xs uppercase tracking-widest font-semibold mb-3">Simples assim</p>
            <h2 className="text-center text-3xl font-bold text-white mb-4">Crie → Cole → Receba alerta</h2>
            <p className="text-center text-white/40 text-sm mb-14">Quando acontece, cada minuto importa.</p>
          </FadeIn>
          <div className="grid md:grid-cols-3 gap-6">
            {([
              { img: '/img_step1.png', num: '1', title: 'Crie seu QR', desc: 'Cadastre seu item ou pet em 30 segundos. Gratuito.' },
              { img: '/img_step2.png', num: '2', title: 'Cole e Proteja', desc: 'Imprima a etiqueta e cole no item. Resistente e discreto.' },
              { img: '/img_step3.png', num: '3', title: 'Receba o Alerta', desc: 'Quem achar escaneia e você é notificado na hora.' },
            ] as { img: string; num: string; title: string; desc: string }[]).map((step, i) => (
              <FadeIn key={step.num} delay={i * 120}>
                <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] overflow-hidden hover:border-teal-500/30 transition-colors">
                  <div className="relative h-44 overflow-hidden">
                    <Image src={step.img} alt={step.title} fill className="object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#07090e] via-transparent to-transparent" />
                    <div className="absolute top-3 left-3 w-7 h-7 rounded-full bg-teal-500 flex items-center justify-center text-xs font-bold text-white">
                      {step.num}
                    </div>
                  </div>
                  <div className="p-5">
                    <h3 className="font-bold text-white mb-1">{step.title}</h3>
                    <p className="text-white/40 text-sm">{step.desc}</p>
                  </div>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ── JÁ AJUDANDO ──────────────────────────────────────────────────── */}
      <section className="py-16 px-5 border-y border-white/[0.06] bg-white/[0.015]">
        <div className="max-w-4xl mx-auto">
          <FadeIn>
            <p className="text-center text-white/30 text-xs uppercase tracking-widest font-semibold mb-8">Já ajudando a recuperar itens</p>
          </FadeIn>
          <div className="grid grid-cols-3 gap-6 mb-10 text-center">
            {([
              { value: 12847, suffix: '+', label: 'Objetos registrados' },
              { value: 3291,  suffix: '+', label: 'Recuperações confirmadas' },
              { value: 98,    suffix: '%', label: 'Taxa com QR Code' },
            ] as { value: number; suffix: string; label: string }[]).map((s, i) => (
              <FadeIn key={s.label} delay={i * 100}>
                <p className="text-3xl font-extrabold text-teal-400 tracking-tight"><Counter target={s.value} suffix={s.suffix} /></p>
                <p className="text-xs text-white/30 mt-1">{s.label}</p>
              </FadeIn>
            ))}
          </div>
          <div className="grid md:grid-cols-3 gap-4">
            {([
              { emoji: '🐕', text: 'Cachorro recuperado em 2 horas', sub: 'via QR na coleira' },
              { emoji: '👛', text: 'Carteira encontrada após scan', sub: 'contato imediato' },
              { emoji: '⚡', text: 'Contato feito imediatamente', sub: 'match IA 94%' },
            ] as { emoji: string; text: string; sub: string }[]).map((c, i) => (
              <FadeIn key={i} delay={i * 80}>
                <div className="flex items-center gap-3 p-4 rounded-xl border border-white/[0.08] bg-white/[0.03]">
                  <span className="text-2xl">{c.emoji}</span>
                  <div>
                    <p className="text-sm font-semibold text-white">{c.text}</p>
                    <p className="text-xs text-white/40">{c.sub}</p>
                  </div>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ── PETS ─────────────────────────────────────────────────────────── */}
      <section id="pets" className="py-24 px-5 overflow-hidden">
        <div className="max-w-5xl mx-auto">
          <div className="relative rounded-3xl border border-white/[0.08] bg-gradient-to-br from-[#0a1628] to-[#07090e] overflow-hidden">
            <div className="grid md:grid-cols-2 gap-0 items-center">
              <div className="p-10 md:p-14">
                <FadeIn>
                  <div className="inline-flex items-center gap-2 mb-5 px-3 py-1.5 rounded-full border border-amber-500/30 bg-amber-500/10">
                    <Heart className="w-3 h-3 text-amber-400" />
                    <span className="text-[11px] text-amber-300 font-semibold uppercase tracking-wide">Proteção para pets</span>
                  </div>
                  <h2 className="text-3xl md:text-4xl font-extrabold text-white leading-tight mb-4">
                    Seu pet pode<br />sumir hoje.
                  </h2>
                  <p className="text-white/40 text-sm mb-6">Proteja agora.</p>
                  <div className="grid grid-cols-2 gap-3 mb-8">
                    {([
                      { v: '94%', l: 'recuperados com QR' },
                      { v: '<2h', l: 'tempo médio de retorno' },
                      { v: '1 em 3', l: 'pets some ao menos 1x' },
                      { v: '0 custo', l: 'para criar a etiqueta' },
                    ] as { v: string; l: string }[]).map(s => (
                      <div key={s.l} className="p-3 rounded-xl border border-white/[0.08] bg-white/[0.03]">
                        <p className="text-lg font-extrabold text-amber-400">{s.v}</p>
                        <p className="text-[11px] text-white/40 mt-0.5">{s.l}</p>
                      </div>
                    ))}
                  </div>
                  <Link href="/auth/register"
                    className="inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-white font-bold px-7 py-3.5 rounded-xl text-sm transition-colors"
                    style={{ boxShadow: '0 8px 30px rgba(245,158,11,0.25)' }}>
                    Criar QR para meu pet <ArrowRight className="w-4 h-4" />
                  </Link>
                  <p className="text-white/25 text-xs mt-2">Leva menos de 30 segundos</p>
                </FadeIn>
              </div>
              <div className="relative h-72 md:h-full min-h-[320px]">
                <Image src="/img_pet.png" alt="Pet protegido com QR Code" fill className="object-cover object-center" />
                <div className="absolute inset-0 bg-gradient-to-r from-[#0a1628] via-transparent to-transparent hidden md:block" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── DEPOIMENTOS ──────────────────────────────────────────────────── */}
      <section className="py-16 px-5 border-t border-white/[0.06]">
        <div className="max-w-4xl mx-auto">
          <FadeIn>
            <p className="text-center text-white/30 text-xs uppercase tracking-widest font-semibold mb-10">O que dizem nossos usuários</p>
          </FadeIn>
          <div className="grid md:grid-cols-2 gap-5">
            {([
              { name: 'Mariana S.', city: 'São Paulo, SP', text: 'Meu cachorro sumiu de manhã. Às 14h já estava de volta. O QR na coleira salvou tudo.', stars: 5 },
              { name: 'Rafael T.', city: 'Rio de Janeiro, RJ', text: 'Perdi a carteira no metrô. Alguém escaneou o QR e me ligou em 20 minutos. Inacreditável.', stars: 5 },
            ] as { name: string; city: string; text: string; stars: number }[]).map((t, i) => (
              <FadeIn key={i} delay={i * 100}>
                <div className="p-6 rounded-2xl border border-white/[0.08] bg-white/[0.03]">
                  <div className="flex gap-0.5 mb-3">
                    {Array.from({ length: t.stars }).map((_, j) => (
                      <span key={j} className="text-amber-400 text-sm">★</span>
                    ))}
                  </div>
                  <p className="text-white/70 text-sm leading-relaxed mb-4">&ldquo;{t.text}&rdquo;</p>
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-teal-500/20 flex items-center justify-center text-xs font-bold text-teal-400">
                      {t.name[0]}
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-white">{t.name}</p>
                      <p className="text-[10px] text-white/30">{t.city}</p>
                    </div>
                  </div>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA FINAL ────────────────────────────────────────────────────── */}
      <section className="py-24 px-5">
        <div className="max-w-2xl mx-auto text-center">
          <FadeIn>
            <h2 className="text-3xl md:text-4xl font-extrabold text-white mb-4 leading-tight">
              Depois que perde,<br />não adianta cadastrar.
            </h2>
            <p className="text-white/40 text-sm mb-8">Proteja agora. É gratuito.</p>
            <Link href="/auth/register"
              className="inline-flex items-center gap-2 bg-teal-500 hover:bg-teal-400 text-white font-bold px-10 py-4 rounded-xl text-base transition-all"
              style={{ boxShadow: '0 0 0 1px rgba(20,184,166,0.4),0 12px 40px rgba(20,184,166,0.2)' }}>
              Criar meu QR agora <ArrowRight className="w-5 h-5" strokeWidth={2.5} />
            </Link>
            <p className="text-white/25 text-xs mt-3">Leva menos de 30 segundos</p>
          </FadeIn>
        </div>
      </section>

      {/* ── FOOTER ───────────────────────────────────────────────────────── */}
      <footer className="border-t border-white/[0.06] py-10 px-5">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-teal-500 flex items-center justify-center">
              <QrCode className="w-3.5 h-3.5 text-white" strokeWidth={2.5} />
            </div>
            <span className="font-bold text-white text-sm">Backfindr</span>
          </div>
          <div className="flex flex-wrap items-center gap-6 text-xs text-white/30">
            {([['Como funciona', '#how'], ['Pets', '#pets'], ['Preços', '/pricing'], ['Blog', '/blog'], ['Mapa', '/map'], ['Privacidade', '/privacy'], ['Termos', '/terms']] as [string, string][]).map(([l, h]) => (
              <Link key={l} href={h} className="hover:text-white/60 transition-colors">{l}</Link>
            ))}
          </div>
          <p className="text-xs text-white/20">© 2026 Backfindr</p>
        </div>
      </footer>
    </div>
  );
}
