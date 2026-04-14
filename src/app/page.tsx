'use client';
import Link from 'next/link';
import Image from 'next/image';
import { useState, useEffect, useRef } from 'react';
import { ArrowRight, QrCode, Bell, Scan, Heart, ShieldCheck, MapPin, CheckCircle2 } from 'lucide-react';

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
        if (start >= target) {
          setCount(target);
          clearInterval(t);
        } else {
          setCount(start);
        }
      }, 16);
    });

    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [target]);

  return <span ref={ref} className="tabular-nums">{count.toLocaleString('pt-BR')}{suffix}</span>;
}

function FadeIn({ children, delay = 0, className = '' }: { children: React.ReactNode; delay?: number; className?: string }) {
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setVisible(true);
        observer.disconnect();
      }
    });

    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(24px)',
        transition: `opacity 0.7s ease ${delay}ms, transform 0.7s ease ${delay}ms`,
      }}
    >
      {children}
    </div>
  );
}

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
            <span className="text-[10px] text-white/25">· {item.time}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

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
        {([
          ['Como funciona', '#how'],
          ['Resultados', '#results'],
          ['Pets', '#pets'],
          ['Preços', '/pricing'],
          ['Blog', '/blog'],
        ] as [string, string][]).map(([label, href]) => (
          <Link key={label} href={href} className="text-white/40 hover:text-white text-sm transition-colors">
            {label}
          </Link>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <Link href="/auth/login" className="text-white/50 hover:text-white text-sm transition-colors hidden sm:block">
          Entrar
        </Link>
        <Link href="/auth/register" className="bg-teal-500 hover:bg-teal-400 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors">
          Criar QR grátis
        </Link>
      </div>
    </nav>
  );
}

export default function HomePage() {
  const [activities, setActivities] = useState<ActivityItem[]>(FALLBACK_ACTIVITIES);

  useEffect(() => {
    fetch('/api/v1/objects/public?size=20&status=lost')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        const items = data?.items ?? [];
        if (items.length > 0) {
          setActivities(
            items.slice(0, 8).map((obj: { id: string; title: string; category: string; status: string; location_addr?: string; created_at: string }) => {
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
            })
          );
        }
      })
      .catch(() => {});
  }, []);

  return (
    <div className="min-h-screen bg-[#07090e] text-white selection:bg-teal-500/30">
      <style>{`
        html { scroll-behavior: smooth; }
        @keyframes ticker { from { transform: translateX(0) } to { transform: translateX(-50%) } }
        @keyframes floatup { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-8px) } }
        @keyframes notif-in { from { opacity: 0; transform: translateY(12px) } to { opacity: 1; transform: translateY(0) } }
        @keyframes pulse-ring { 0% { transform: scale(0.92); opacity: 0.55 } 70%,100% { transform: scale(1.08); opacity: 0 } }
      `}</style>

      <Navbar />

      <section className="relative min-h-screen flex flex-col justify-center px-5 pt-24 pb-12 overflow-hidden">
        <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse 90% 60% at 50% -5%, rgba(15,40,80,0.9) 0%, rgba(7,9,14,1) 65%)' }} />
        <div className="absolute inset-0 pointer-events-none opacity-[0.03]" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,1) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,1) 1px,transparent 1px)', backgroundSize: '60px 60px' }} />
        <div className="absolute top-24 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-teal-500/10 blur-3xl pointer-events-none" />

        <div className="relative z-10 w-full max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-2 mb-6 px-3 py-1.5 rounded-full border border-red-500/30 bg-red-500/10">
                <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
                <span className="text-[11px] text-red-300 tracking-wide uppercase font-semibold">
                  Depois que perde, já pode ser tarde
                </span>
              </div>

              <h1 className="font-extrabold tracking-[-0.04em] leading-[0.92] mb-5" style={{ fontSize: 'clamp(40px, 6.5vw, 76px)' }}>
                <span className="text-white">Proteja o que importa</span><br />
                <span style={{ background: 'linear-gradient(135deg, #38bdf8 0%, #2dd4bf 50%, #14b8a6 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
                  antes que desapareça.
                </span>
              </h1>

              <p className="text-white/70 text-base md:text-lg max-w-xl leading-relaxed mb-8 font-light">
                Crie um QR Code para itens, documentos e pets. Se alguém encontrar, escaneia e você recebe o aviso na hora.
              </p>

              <div className="flex flex-col sm:flex-row gap-3 mb-4">
                <Link
                  href="/auth/register"
                  className="inline-flex items-center justify-center gap-2 bg-teal-500 hover:bg-teal-400 text-white font-bold px-8 py-4 rounded-xl text-base transition-all duration-200"
                  style={{ boxShadow: '0 0 0 1px rgba(20,184,166,0.5),0 12px 40px rgba(20,184,166,0.25)' }}
                >
                  Criar meu QR grátis <ArrowRight className="w-5 h-5" strokeWidth={2.5} />
                </Link>
                <Link
                  href="#how"
                  className="inline-flex items-center justify-center gap-2 border border-white/10 bg-white/[0.03] hover:bg-white/[0.05] text-white font-semibold px-8 py-4 rounded-xl text-base transition-colors"
                >
                  Ver como funciona
                </Link>
              </div>

              <p className="text-white/25 text-xs mb-8">Leva menos de 30 segundos · Gratuito para sempre</p>

              <div className="grid sm:grid-cols-3 gap-3 max-w-2xl">
                {[
                  { icon: ShieldCheck, title: 'Privacidade protegida', desc: 'Contato sem expor dados publicamente' },
                  { icon: Bell, title: 'Alerta imediato', desc: 'Você é notificado assim que escanearem' },
                  { icon: MapPin, title: 'Funciona no mundo real', desc: 'Cole em mochila, carteira, pet ou documento' },
                ].map((item) => {
                  const Icon = item.icon;
                  return (
                    <div key={item.title} className="rounded-2xl border border-white/[0.08] bg-white/[0.03] px-4 py-4 backdrop-blur-sm">
                      <div className="w-9 h-9 rounded-xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center mb-3">
                        <Icon className="w-4 h-4 text-teal-400" />
                      </div>
                      <p className="text-sm font-semibold text-white">{item.title}</p>
                      <p className="text-xs text-white/40 mt-1 leading-relaxed">{item.desc}</p>
                    </div>
                  );
                })}
              </div>

              <div className="flex items-center gap-3 mt-8">
                <div className="flex -space-x-2">
                  {(['bg-teal-500', 'bg-blue-500', 'bg-purple-500', 'bg-amber-500'] as string[]).map((c, i) => (
                    <div key={i} className={`w-7 h-7 rounded-full border-2 border-[#07090e] ${c} flex items-center justify-center text-[10px] font-bold text-white`}>
                      {['M', 'A', 'R', 'C'][i]}
                    </div>
                  ))}
                </div>
                <p className="text-white/40 text-xs">
                  <span className="text-white font-semibold">12.847</span> objetos protegidos · <span className="text-teal-400 font-semibold">3.291</span> recuperados
                </p>
              </div>
            </div>

            <div className="relative flex items-center justify-center" style={{ animation: 'floatup 4s ease-in-out infinite' }}>
              <div className="relative w-full max-w-md">
                <div className="absolute -inset-6 rounded-[32px] bg-gradient-to-br from-teal-500/20 via-sky-500/10 to-transparent blur-2xl" />
                <Image
                  src="/img_hero.png"
                  alt="Dispositivo escaneando QR Code"
                  width={520}
                  height={420}
                  className="relative z-10 w-full rounded-2xl border border-white/10 shadow-2xl"
                  priority
                />

                <div className="absolute z-20 top-[36%] left-[48%] -translate-x-1/2 -translate-y-1/2 w-16 h-16 rounded-2xl border border-teal-400/60 bg-teal-400/10 backdrop-blur-sm flex items-center justify-center">
                  <div className="absolute inset-0 rounded-2xl border border-teal-400/50" style={{ animation: 'pulse-ring 2s ease-out infinite' }} />
                  <Scan className="w-6 h-6 text-teal-300" />
                </div>

                <div
                  className="absolute top-4 right-4 z-20 bg-[#0a1628]/95 border border-teal-500/40 rounded-xl px-3 py-2.5 flex items-center gap-2.5 shadow-xl"
                  style={{ animation: 'notif-in 0.6s ease 0.8s both' }}
                >
                  <div className="w-7 h-7 rounded-lg bg-teal-500/20 flex items-center justify-center flex-shrink-0">
                    <Bell className="w-3.5 h-3.5 text-teal-400" />
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold text-white">Item encontrado</p>
                    <p className="text-[10px] text-white/50">O dono foi avisado agora</p>
                  </div>
                </div>

                <div
                  className="absolute bottom-4 left-4 z-20 bg-[#0a1628]/95 border border-white/20 rounded-xl px-3 py-2.5 flex items-center gap-2.5 shadow-xl"
                  style={{ animation: 'notif-in 0.6s ease 1.2s both' }}
                >
                  <div className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0">
                    <CheckCircle2 className="w-3.5 h-3.5 text-white/70" />
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold text-white">Escaneou, resolveu</p>
                    <p className="text-[10px] text-white/50">Sem cadastro para quem encontrou</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <LiveTicker items={activities} />

      <section id="how" className="py-24 px-5">
        <div className="max-w-5xl mx-auto">
          <FadeIn>
            <p className="text-center text-white/30 text-xs uppercase tracking-widest font-semibold mb-3">Como funciona na prática</p>
            <h2 className="text-center text-3xl font-bold text-white mb-4">Crie → Cole → Receba alerta</h2>
            <p className="text-center text-white/40 text-sm mb-14">Sem complicação. Sem expor seus dados. Sem depender de sorte.</p>
          </FadeIn>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { img: '/img_step1.png', num: '1', title: 'Crie seu QR', desc: 'Cadastre seu item ou pet em segundos e gere sua etiqueta única.' },
              { img: '/img_step2.png', num: '2', title: 'Cole e Proteja', desc: 'Use na mochila, carteira, documento, chaveiro ou coleira.' },
              { img: '/img_step3.png', num: '3', title: 'Receba o Alerta', desc: 'Quem encontrar escaneia e você recebe o aviso imediatamente.' },
            ].map((step, i) => (
              <FadeIn key={step.num} delay={i * 120}>
                <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] overflow-hidden hover:border-teal-500/30 transition-colors h-full">
                  <div className="relative h-44 overflow-hidden">
                    <Image src={step.img} alt={step.title} fill className="object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#07090e] via-transparent to-transparent" />
                    <div className="absolute top-3 left-3 w-7 h-7 rounded-full bg-teal-500 flex items-center justify-center text-xs font-bold text-white">
                      {step.num}
                    </div>
                  </div>
                  <div className="p-5">
                    <h3 className="font-bold text-white mb-1">{step.title}</h3>
                    <p className="text-white/40 text-sm leading-relaxed">{step.desc}</p>
                  </div>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      <section id="results" className="py-16 px-5 border-y border-white/[0.06] bg-white/[0.015]">
        <div className="max-w-4xl mx-auto">
          <FadeIn>
            <p className="text-center text-white/30 text-xs uppercase tracking-widest font-semibold mb-4">Prova de funcionamento</p>
            <h2 className="text-center text-2xl md:text-3xl font-bold text-white mb-8">Já ajudando a recuperar itens e pets</h2>
          </FadeIn>

          <div className="grid sm:grid-cols-3 gap-4 mb-10 text-center">
            {[
              { value: 12847, suffix: '+', label: 'Objetos registrados' },
              { value: 3291, suffix: '+', label: 'Recuperações confirmadas' },
              { value: 98, suffix: '%', label: 'Taxa com QR Code' },
            ].map((s, i) => (
              <FadeIn key={s.label} delay={i * 100}>
                <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] px-4 py-6">
                  <p className="text-3xl font-extrabold text-teal-400 tracking-tight">
                    <Counter target={s.value} suffix={s.suffix} />
                  </p>
                  <p className="text-xs text-white/30 mt-1">{s.label}</p>
                </div>
              </FadeIn>
            ))}
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            {[
              { emoji: '🐕', text: 'Cachorro recuperado em 2 horas', sub: 'via QR na coleira' },
              { emoji: '👛', text: 'Carteira encontrada após scan', sub: 'contato imediato' },
              { emoji: '⚡', text: 'Contato feito imediatamente', sub: 'match IA 94%' },
            ].map((c, i) => (
              <FadeIn key={i} delay={i * 80}>
                <div className="flex items-center gap-3 p-4 rounded-xl border border-white/[0.08] bg-white/[0.03] h-full">
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
                  <p className="text-white/70 text-sm mb-6 max-w-md">
                    Coloque um QR na coleira e aumente drasticamente a chance de retorno quando cada minuto conta.
                  </p>
                  <div className="grid grid-cols-2 gap-3 mb-8">
                    {[
                      { v: '94%', l: 'recuperados com QR' },
                      { v: '<2h', l: 'tempo médio de retorno' },
                      { v: '1 em 3', l: 'pets some ao menos 1x' },
                      { v: '0 custo', l: 'para criar a etiqueta' },
                    ].map((s) => (
                      <div key={s.l} className="p-3 rounded-xl border border-white/[0.08] bg-white/[0.03]">
                        <p className="text-lg font-extrabold text-amber-400">{s.v}</p>
                        <p className="text-[11px] text-white/40 mt-0.5">{s.l}</p>
                      </div>
                    ))}
                  </div>
                  <Link
                    href="/auth/register"
                    className="inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-white font-bold px-7 py-3.5 rounded-xl text-sm transition-colors"
                    style={{ boxShadow: '0 8px 30px rgba(245,158,11,0.25)' }}
                  >
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

      <section className="py-16 px-5 border-t border-white/[0.06]">
        <div className="max-w-4xl mx-auto">
          <FadeIn>
            <p className="text-center text-white/30 text-xs uppercase tracking-widest font-semibold mb-10">O que dizem nossos usuários</p>
          </FadeIn>
          <div className="grid md:grid-cols-2 gap-5">
            {[
              { name: 'Mariana S.', city: 'São Paulo, SP', text: 'Meu cachorro sumiu de manhã. Às 14h já estava de volta. O QR na coleira salvou tudo.', stars: 5 },
              { name: 'Rafael T.', city: 'Rio de Janeiro, RJ', text: 'Perdi a carteira no metrô. Alguém escaneou o QR e me ligou em 20 minutos. Inacreditável.', stars: 5 },
            ].map((t, i) => (
              <FadeIn key={i} delay={i * 100}>
                <div className="p-6 rounded-2xl border border-white/[0.08] bg-white/[0.03] h-full">
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

      <section className="py-24 px-5">
        <div className="max-w-2xl mx-auto text-center">
          <FadeIn>
            <h2 className="text-3xl md:text-4xl font-extrabold text-white mb-4 leading-tight">
              Depois que perde,<br />não adianta cadastrar.
            </h2>
            <p className="text-white/50 text-sm md:text-base mb-8">Proteja agora. É gratuito. Leva menos de 30 segundos.</p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link
                href="/auth/register"
                className="inline-flex items-center gap-2 bg-teal-500 hover:bg-teal-400 text-white font-bold px-10 py-4 rounded-xl text-base transition-all"
                style={{ boxShadow: '0 0 0 1px rgba(20,184,166,0.4),0 12px 40px rgba(20,184,166,0.2)' }}
              >
                Criar meu QR agora <ArrowRight className="w-5 h-5" strokeWidth={2.5} />
              </Link>
              <Link href="#pets" className="inline-flex items-center gap-2 text-amber-300 hover:text-amber-200 font-semibold px-4 py-3 text-sm transition-colors">
                Quero proteger meu pet
              </Link>
            </div>
          </FadeIn>
        </div>
      </section>

      <footer className="border-t border-white/[0.06] py-10 px-5">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-teal-500 flex items-center justify-center">
              <QrCode className="w-3.5 h-3.5 text-white" strokeWidth={2.5} />
            </div>
            <span className="font-bold text-white text-sm">Backfindr</span>
          </div>
          <div className="flex flex-wrap items-center gap-6 text-xs text-white/30">
            {[
              ['Como funciona', '#how'],
              ['Resultados', '#results'],
              ['Pets', '#pets'],
              ['Preços', '/pricing'],
              ['Blog', '/blog'],
              ['Mapa', '/map'],
              ['Privacidade', '/privacy'],
              ['Termos', '/terms'],
            ].map(([l, h]) => (
              <Link key={l} href={h} className="hover:text-white/60 transition-colors">
                {l}
              </Link>
            ))}
          </div>
          <p className="text-xs text-white/20">© 2026 Backfindr</p>
        </div>
      </footer>
    </div>
  );
}
