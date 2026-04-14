'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState, useEffect, useRef } from 'react';
import {
  ArrowRight,
  Bell,
  ChevronRight,
  Heart,
  MapPin,
  Radar,
  Search,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';

type ActivityType = 'lost' | 'found' | 'match';

interface ActivityItem {
  id: string;
  type: ActivityType;
  emoji: string;
  text: string;
  city: string;
  time: string;
}

const FALLBACK_ACTIVITIES: ActivityItem[] = [
  { id: 'f1', type: 'lost',  emoji: '📱', text: 'iPhone 15 Pro preto perdido',    city: 'Metrô Paulista, SP', time: 'agora' },
  { id: 'f2', type: 'found', emoji: '👛', text: 'Carteira encontrada com docs',   city: 'Pinheiros, SP',      time: '1 min' },
  { id: 'f3', type: 'match', emoji: '⚡', text: 'Match 94% confirmado pela IA',   city: 'Brooklin, SP',       time: '2 min' },
  { id: 'f4', type: 'lost',  emoji: '🐾', text: 'Labrador caramelo desaparecido', city: 'Ibirapuera, SP',     time: '3 min' },
  { id: 'f5', type: 'found', emoji: '🔑', text: 'Chaves encontradas no estac.',   city: 'Vila Mariana, SP',   time: '5 min' },
  { id: 'f6', type: 'match', emoji: '⚡', text: 'Objeto devolvido ao dono',       city: 'Moema, SP',          time: '7 min' },
  { id: 'f7', type: 'lost',  emoji: '💻', text: 'MacBook Air prata desaparecido', city: 'Faria Lima, SP',     time: '9 min' },
  { id: 'f8', type: 'found', emoji: '📄', text: 'RG e CNH encontrados',           city: 'Centro, RJ',         time: '11 min' },
];

const CATEGORY_EMOJI: Record<string, string> = {
  phone: '📱',
  wallet: '👛',
  keys: '🔑',
  bag: '🎒',
  pet: '🐾',
  bike: '🚲',
  document: '📄',
  jewelry: '💍',
  electronics: '💻',
  clothing: '👕',
  other: '📦',
};

function Counter({ target, suffix = '' }: { target: number; suffix?: string }) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      observer.disconnect();

      let current = 0;
      const step = Math.max(1, Math.ceil(target / 60));
      const timer = window.setInterval(() => {
        current += step;
        if (current >= target) {
          setCount(target);
          window.clearInterval(timer);
          return;
        }
        setCount(current);
      }, 18);
    });

    observer.observe(node);
    return () => observer.disconnect();
  }, [target]);

  return (
    <span ref={ref} className="tabular-nums">
      {count.toLocaleString('pt-BR')}
      {suffix}
    </span>
  );
}

function FadeIn({
  children,
  delay = 0,
  className = '',
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setVisible(true);
        observer.disconnect();
      }
    });

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(22px)',
        transition: `opacity 0.7s ease ${delay}ms, transform 0.7s ease ${delay}ms`,
      }}
    >
      {children}
    </div>
  );
}

function Navbar() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <nav
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
        scrolled ? 'border-b border-white/[0.08] bg-[#07090e]/88 backdrop-blur-xl' : ''
      }`}
    >
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-4">
        <Link href="/" className="flex items-center gap-3">
          <Image
            src="/branding/logo-backfindr.jpeg"
            alt="Logo Backfindr"
            width={40}
            height={40}
            className="h-10 w-10 rounded-xl object-cover shadow-lg"
            priority
          />
          <p className="text-sm font-bold tracking-tight text-white">Backfindr</p>
        </Link>

        <div className="hidden items-center gap-7 md:flex">
          <Link href="#ao-vivo" className="text-sm text-white/45 transition-colors hover:text-white">Ao vivo</Link>
          <Link href="#como-funciona" className="text-sm text-white/45 transition-colors hover:text-white">Como funciona</Link>
          <Link href="#pets" className="text-sm text-white/45 transition-colors hover:text-white">Pets</Link>
          <Link href="/map" className="text-sm text-white/45 transition-colors hover:text-white">Mapa</Link>
        </div>

        <div className="flex items-center gap-3">
          <Link href="/auth/login" className="hidden text-sm text-white/50 transition-colors hover:text-white sm:block">
            Entrar
          </Link>
          <Link
            href="/auth/register"
            className="rounded-xl bg-teal-500 px-4 py-2 text-sm font-semibold text-white transition-all hover:bg-teal-400"
            style={{ boxShadow: '0 8px 24px rgba(20,184,166,0.22)' }}
          >
            Criar QR grátis
          </Link>
        </div>
      </div>
    </nav>
  );
}

function LiveTicker({ items }: { items: ActivityItem[] }) {
  const typeColor: Record<ActivityType, string> = {
    lost: 'text-red-400',
    found: 'text-teal-400',
    match: 'text-amber-400',
  };

  const typeLabel: Record<ActivityType, string> = {
    lost: 'Perdido',
    found: 'Achado',
    match: 'Match IA',
  };

  const doubled = [...items, ...items];

  return (
    <div className="overflow-hidden border-y border-white/[0.06] bg-white/[0.02] py-3">
      <div className="flex w-max gap-6" style={{ animation: 'ticker 30s linear infinite' }}>
        {doubled.map((item, index) => (
          <div
            key={`${item.id}-${index}`}
            className="flex flex-shrink-0 items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1"
          >
            <span className="text-sm">{item.emoji}</span>
            <span className={`text-xs font-semibold ${typeColor[item.type]}`}>{typeLabel[item.type]}</span>
            <span className="max-w-[170px] truncate text-xs text-white/55">{item.text}</span>
            <span className="text-[10px] text-white/28">{item.city}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function HeroActivityCard({ item }: { item: ActivityItem }) {
  const badgeClass =
    item.type === 'lost'
      ? 'bg-red-500/12 text-red-300 border-red-500/25'
      : item.type === 'found'
      ? 'bg-teal-500/12 text-teal-300 border-teal-500/25'
      : 'bg-amber-500/12 text-amber-300 border-amber-500/25';

  const badgeLabel = item.type === 'lost' ? 'Perdido' : item.type === 'found' ? 'Achado' : 'Match IA';

  return (
    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.04] p-4 backdrop-blur-sm">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xl">{item.emoji}</span>
          <div>
            <p className="text-sm font-semibold text-white">{item.text}</p>
            <p className="text-xs text-white/38">{item.city}</p>
          </div>
        </div>
        <span className={`rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-wide ${badgeClass}`}>
          {badgeLabel}
        </span>
      </div>
      <div className="flex items-center justify-between text-xs text-white/35">
        <span>{item.time}</span>
        <span className="inline-flex items-center gap-1">
          <Radar className="h-3.5 w-3.5" />
          atividade ao vivo
        </span>
      </div>
    </div>
  );
}

export default function HomePage() {
  const [activities, setActivities] = useState<ActivityItem[]>(FALLBACK_ACTIVITIES);

  useEffect(() => {
    fetch('/api/v1/objects/public?size=20&status=lost')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        const items = data?.items ?? [];
        if (!Array.isArray(items) || items.length === 0) return;

        const formatTime = (created_at: string): string => {
          const mins = Math.floor((Date.now() - new Date(created_at).getTime()) / 60000);
          if (mins < 1) return 'agora';
          if (mins < 60) return `${mins} min`;
          const hours = Math.floor(mins / 60);
          if (hours < 24) return `${hours}h`;
          const days = Math.floor(hours / 24);
          if (days < 7) return `${days} dia${days > 1 ? 's' : ''}`;
          const weeks = Math.floor(days / 7);
          if (weeks < 5) return `${weeks} sem`;
          const months = Math.floor(days / 30);
          if (months < 12) return `há ${months} ${months === 1 ? 'mês' : 'meses'}`;
          const years = Math.floor(days / 365);
          return `há ${years} ${years === 1 ? 'ano' : 'anos'}`;
        };

        const seen = new Set<string>();
        const mapped = items
          .filter((obj: { id: string }) => {
            if (seen.has(obj.id)) return false;
            seen.add(obj.id);
            return true;
          })
          .slice(0, 8)
          .map((obj: {
            id: string;
            title: string;
            category: string;
            status: string;
            location_addr?: string;
            created_at: string;
          }) => {
            const type = (obj.status === 'found' || obj.status === 'match' ? obj.status : 'lost') as ActivityType;
            return {
              id: obj.id,
              type,
              emoji: CATEGORY_EMOJI[obj.category] ?? '📦',
              text: obj.title,
              city: obj.location_addr ?? 'São Paulo, SP',
              time: formatTime(obj.created_at),
            };
          });

        setActivities(mapped);
      })
      .catch(() => {});
  }, []);

  // Deduplicação já feita na origem (setActivities); fatias diretas
  const heroCards = activities.slice(0, 3);
  const liveCards = activities.slice(0, 6);

  return (
    <div className="min-h-screen bg-[#07090e] text-white selection:bg-teal-500/30">
      <style>{`
        @keyframes ticker { from { transform: translateX(0) } to { transform: translateX(-50%) } }
        @keyframes floatY { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-8px) } }
        @keyframes pulseDot { 0%,100% { opacity: 1 } 50% { opacity: .45 } }
      `}</style>

      <Navbar />

      <section className="relative overflow-hidden px-5 pb-12 pt-28">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(ellipse 85% 65% at 50% -10%, rgba(19,85,190,.45) 0%, rgba(8,12,20,0) 60%), radial-gradient(ellipse 80% 60% at 70% 25%, rgba(20,184,166,.12) 0%, rgba(7,9,14,0) 55%)',
          }}
        />
        <div className="pointer-events-none absolute inset-0 opacity-[0.035]" style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)',
          backgroundSize: '56px 56px',
        }} />

        <div className="relative mx-auto grid max-w-6xl items-center gap-14 lg:grid-cols-[1.02fr_.98fr]">
          <FadeIn>
            <div className="max-w-xl">
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-teal-500/25 bg-teal-500/10 px-3 py-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-teal-400" style={{ animation: 'pulseDot 1.2s ease infinite' }} />
                <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-teal-300">
                  rede ativa de perdidos e achados
                </span>
              </div>

              <h1
                className="mb-5 font-extrabold leading-[0.94] tracking-[-0.045em] text-white"
                style={{ fontSize: 'clamp(42px, 6.4vw, 74px)' }}
              >
                Proteja o que importa
                <br />
                <span
                  style={{
                    background: 'linear-gradient(135deg, #60a5fa 0%, #2dd4bf 52%, #14b8a6 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                  }}
                >
                  antes que desapareça.
                </span>
              </h1>

              <p className="mb-8 max-w-lg text-base leading-relaxed text-white/55 md:text-lg">
                Veja em tempo real itens perdidos, objetos encontrados e conexões acontecendo na plataforma.
                Explore primeiro. Cadastre quando fizer sentido para você.
              </p>

              <div className="flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/auth/register"
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-teal-500 px-7 py-4 text-base font-bold text-white transition-all hover:bg-teal-400"
                  style={{ boxShadow: '0 0 0 1px rgba(20,184,166,.35), 0 16px 42px rgba(20,184,166,.22)' }}
                >
                  Criar meu QR grátis
                  <ArrowRight className="h-5 w-5" strokeWidth={2.5} />
                </Link>
                <Link
                  href="/map"
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/[0.12] bg-white/[0.03] px-7 py-4 text-base font-semibold text-white/85 transition-colors hover:border-white/[0.2] hover:bg-white/[0.06]"
                >
                  <MapPin className="h-5 w-5" />
                  Ver mapa ao vivo
                </Link>
              </div>

              <div className="mt-7 flex flex-wrap items-center gap-4 text-sm text-white/40">
                <span className="inline-flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-teal-400" />
                  contato protegido
                </span>
                <span className="inline-flex items-center gap-2">
                  <Bell className="h-4 w-4 text-blue-400" />
                  alerta imediato
                </span>
                <span className="inline-flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-amber-400" />
                  mapa público
                </span>
              </div>

              <div className="mt-8 flex items-center gap-4">
                <div className="flex -space-x-2">
                  {['M', 'A', 'R', 'C'].map((letter, index) => (
                    <div
                      key={letter}
                      className={`flex h-8 w-8 items-center justify-center rounded-full border-2 border-[#07090e] text-[10px] font-bold text-white ${
                        ['bg-teal-500', 'bg-blue-500', 'bg-violet-500', 'bg-amber-500'][index]
                      }`}
                    >
                      {letter}
                    </div>
                  ))}
                </div>
                <p className="text-xs text-white/38">
                  <span className="font-semibold text-white">12.847</span> objetos protegidos ·{' '}
                  <span className="font-semibold text-teal-400">3.291</span> recuperações registradas
                </p>
              </div>
            </div>
          </FadeIn>

          <FadeIn delay={80}>
            <div className="relative">
              <div className="absolute -left-8 top-12 hidden h-24 w-24 rounded-full bg-teal-500/20 blur-3xl md:block" />
              <div className="absolute -right-8 bottom-10 hidden h-24 w-24 rounded-full bg-blue-500/20 blur-3xl md:block" />

              <div className="rounded-[30px] border border-white/[0.08] bg-white/[0.03] p-4 shadow-2xl backdrop-blur-sm">
                <div className="mb-4 rounded-[24px] border border-white/[0.08] bg-[#09111f] p-3">
                  <div className="mb-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-white">Experiência em tempo real</p>
                      <p className="text-xs text-white/40">Veja primeiro. Cadastre depois.</p>
                    </div>
                    <span className="inline-flex items-center gap-1 rounded-full border border-teal-500/20 bg-teal-500/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-teal-300">
                      <Sparkles className="h-3 w-3" />
                      ao vivo
                    </span>
                  </div>

                  <div className="grid gap-3 md:grid-cols-[1.08fr_.92fr]">
                    <div className="relative overflow-hidden rounded-[22px] border border-white/[0.06] bg-[#0b1425]">
                      <Image
                        src="/branding/app-preview.jpeg"
                        alt="Preview do aplicativo Backfindr"
                        width={857}
                        height={1536}
                        className="h-full w-full object-cover"
                        priority
                      />
                      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-[#0b1425] via-[#0b1425]/55 to-transparent" />
                    </div>

                    <div className="space-y-3">
                      <div className="rounded-[22px] border border-white/[0.06] bg-[#0b1425] p-3">
                        <div className="mb-3 flex items-center justify-between">
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/32">notícias da rede</p>
                            <p className="text-sm text-white/72">movimento recente</p>
                          </div>
                          <Search className="h-4 w-4 text-white/35" />
                        </div>
                        <div className="space-y-3">
                          {heroCards.map((item) => (
                            <HeroActivityCard key={item.id} item={item} />
                          ))}
                        </div>
                      </div>

                      <div className="overflow-hidden rounded-[22px] border border-white/[0.06] bg-[#0b1425]">
                        <Image
                          src="/branding/banner-brand.jpeg"
                          alt="Banner institucional Backfindr"
                          width={1536}
                          height={864}
                          className="h-full w-full object-cover"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  {[
                    { value: 12847, suffix: '+', label: 'objetos na rede' },
                    { value: 3291, suffix: '+', label: 'recuperações' },
                    { value: 94, suffix: '%', label: 'matches úteis' },
                  ].map((item, index) => (
                    <div key={item.label} className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-4">
                      <p className={`text-2xl font-extrabold tracking-tight ${index === 1 ? 'text-teal-400' : 'text-white'}`}>
                        <Counter target={item.value} suffix={item.suffix} />
                      </p>
                      <p className="mt-1 text-xs text-white/35">{item.label}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </FadeIn>
        </div>
      </section>

      <LiveTicker items={activities} />

      <section id="ao-vivo" className="px-5 py-24">
        <div className="mx-auto max-w-6xl">
          <FadeIn>
            <p className="mb-3 text-center text-xs font-semibold uppercase tracking-[0.22em] text-white/28">experiência first</p>
            <h2 className="mb-4 text-center text-3xl font-extrabold text-white md:text-4xl">
              Veja o que está acontecendo agora
            </h2>
            <p className="mx-auto mb-12 max-w-2xl text-center text-sm leading-relaxed text-white/42 md:text-base">
              Antes de pedir cadastro, a Backfindr mostra o movimento da rede: perdas, achados e conexões que já estão acontecendo.
            </p>
          </FadeIn>

          <div className="grid gap-5 lg:grid-cols-[1.05fr_.95fr]">
            <FadeIn delay={40}>
              <div className="overflow-hidden rounded-3xl border border-white/[0.08] bg-white/[0.03]">
                <div className="relative">
                  <div className="absolute left-4 top-4 z-10 rounded-full border border-teal-500/20 bg-[#08111f]/88 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-teal-300 backdrop-blur-sm">
                    mapa público
                  </div>
                  <Image
                    src="/branding/banner-brand.jpeg"
                    alt="Visual institucional Backfindr com mapa"
                    width={1536}
                    height={864}
                    className="h-[340px] w-full object-cover md:h-[420px]"
                  />
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#07090e] via-[#07090e]/15 to-transparent" />
                </div>
              </div>
            </FadeIn>

            <div className="grid gap-4">
              <FadeIn>
                <Link
                  href="/map"
                  className="flex items-center justify-between gap-3 rounded-2xl border border-teal-500/25 bg-teal-500/[0.06] p-4 transition-colors hover:border-teal-500/50 hover:bg-teal-500/[0.1]"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-teal-500/15">
                      <MapPin className="h-5 w-5 text-teal-400" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white">Mapa interativo ao vivo</p>
                      <p className="text-xs text-white/40">Veja todas as ocorrências no mapa público</p>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 flex-shrink-0 text-teal-400" />
                </Link>
              </FadeIn>

              {liveCards.map((item, index) => (
                <FadeIn key={item.id} delay={index * 70}>
                  <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4 transition-colors hover:border-teal-500/25">
                    <div className="mb-3 flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/[0.05] text-xl">
                          {item.emoji}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-white">{item.text}</p>
                          <p className="text-xs text-white/38">{item.city}</p>
                        </div>
                      </div>
                      <span className="text-[11px] text-white/32">{item.time}</span>
                    </div>
                    <p className="text-sm text-white/55">
                      {item.type === 'lost' && 'Registro publicado na rede e visível para quem pode ajudar.'}
                      {item.type === 'found' && 'Objeto localizado e pronto para gerar contato com segurança.'}
                      {item.type === 'match' && 'A plataforma detectou uma conexão forte entre registros.'}
                    </p>
                  </div>
                </FadeIn>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="como-funciona" className="px-5 py-24 border-t border-white/[0.06]">
        <div className="mx-auto max-w-5xl">
          <FadeIn>
            <p className="mb-3 text-center text-xs font-semibold uppercase tracking-[0.22em] text-white/28">como funciona</p>
            <h2 className="mb-4 text-center text-3xl font-extrabold text-white md:text-4xl">
              Crie, cole e seja avisado
            </h2>
            <p className="mx-auto mb-14 max-w-2xl text-center text-sm text-white/42 md:text-base">
              Quando algo se perde, o tempo pesa. O QR transforma um objeto comum em um ponto de retorno.
            </p>
          </FadeIn>

          <div className="grid gap-6 md:grid-cols-3">
            {[
              {
                img: '/img_step1.png',
                number: '1',
                title: 'Crie seu QR',
                desc: 'Cadastre item ou pet em segundos e gere um identificador único.',
              },
              {
                img: '/img_step2.png',
                number: '2',
                title: 'Cole e proteja',
                desc: 'Use na mochila, carteira, documento, chaveiro ou coleira.',
              },
              {
                img: '/img_step3.png',
                number: '3',
                title: 'Receba o alerta',
                desc: 'Quem encontrar escaneia e a conexão começa com privacidade.',
              },
            ].map((step, index) => (
              <FadeIn key={step.number} delay={index * 100}>
                <div className="overflow-hidden rounded-3xl border border-white/[0.08] bg-white/[0.03] transition-colors hover:border-teal-500/25">
                  <div className="relative h-48">
                    <Image src={step.img} alt={step.title} fill className="object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#07090e] via-transparent to-transparent" />
                    <div className="absolute left-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-teal-500 text-xs font-bold text-white">
                      {step.number}
                    </div>
                  </div>
                  <div className="p-6">
                    <h3 className="mb-2 text-lg font-bold text-white">{step.title}</h3>
                    <p className="text-sm leading-relaxed text-white/45">{step.desc}</p>
                  </div>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      <section className="border-y border-white/[0.06] bg-white/[0.015] px-5 py-18 md:py-20">
        <div className="mx-auto max-w-5xl">
          <FadeIn>
            <p className="mb-10 text-center text-xs font-semibold uppercase tracking-[0.22em] text-white/28">prova de tração</p>
          </FadeIn>

          <div className="mb-10 grid gap-6 text-center md:grid-cols-3">
            {[
              { value: 12847, suffix: '+', label: 'objetos registrados' },
              { value: 3291, suffix: '+', label: 'recuperações confirmadas' },
              { value: 98, suffix: '%', label: 'mais chance com QR' },
            ].map((stat, index) => (
              <FadeIn key={stat.label} delay={index * 100}>
                <div className="rounded-3xl border border-white/[0.08] bg-white/[0.03] px-5 py-7">
                  <p className="text-3xl font-extrabold tracking-tight text-teal-400">
                    <Counter target={stat.value} suffix={stat.suffix} />
                  </p>
                  <p className="mt-2 text-xs text-white/35">{stat.label}</p>
                </div>
              </FadeIn>
            ))}
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {[
              { emoji: '🐕', title: 'Cachorro recuperado em 2 horas', sub: 'QR na coleira facilitou o retorno' },
              { emoji: '👛', title: 'Carteira localizada após scan', sub: 'contato protegido e rápido' },
              { emoji: '⚡', title: 'Match gerado pela IA', sub: 'mais velocidade na conexão' },
            ].map((item, index) => (
              <FadeIn key={item.title} delay={index * 80}>
                <div className="flex gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4">
                  <span className="text-2xl">{item.emoji}</span>
                  <div>
                    <p className="text-sm font-semibold text-white">{item.title}</p>
                    <p className="text-xs text-white/40">{item.sub}</p>
                  </div>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      <section id="pets" className="px-5 py-24">
        <div className="mx-auto max-w-5xl overflow-hidden rounded-[32px] border border-white/[0.08] bg-gradient-to-br from-[#0a1628] to-[#07090e]">
          <div className="grid items-center gap-0 md:grid-cols-2">
            <div className="p-10 md:p-14">
              <FadeIn>
                <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-amber-500/25 bg-amber-500/10 px-3 py-1.5">
                  <Heart className="h-3.5 w-3.5 text-amber-400" />
                  <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-300">
                    proteção para pets
                  </span>
                </div>
                <h2 className="mb-4 text-3xl font-extrabold leading-tight text-white md:text-4xl">
                  Seu pet pode
                  <br />
                  sumir hoje.
                </h2>
                <p className="mb-7 max-w-md text-sm leading-relaxed text-white/45 md:text-base">
                  Cole um QR na coleira e aumente a chance de retorno com um gesto simples e imediato.
                </p>

                <div className="mb-8 grid grid-cols-2 gap-3">
                  {[
                    { value: '94%', label: 'mais chance com QR' },
                    { value: '<2h', label: 'tempo médio de retorno' },
                    { value: '0 custo', label: 'para começar' },
                    { value: '1 clique', label: 'para gerar o código' },
                  ].map((item) => (
                    <div key={item.label} className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4">
                      <p className="text-xl font-extrabold text-amber-400">{item.value}</p>
                      <p className="mt-1 text-[11px] text-white/40">{item.label}</p>
                    </div>
                  ))}
                </div>

                <Link
                  href="/auth/register"
                  className="inline-flex items-center gap-2 rounded-2xl bg-amber-500 px-7 py-4 text-sm font-bold text-white transition-colors hover:bg-amber-400"
                  style={{ boxShadow: '0 12px 34px rgba(245,158,11,.24)' }}
                >
                  Criar QR para meu pet
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <p className="mt-2 text-xs text-white/25">Leva menos de 30 segundos</p>
              </FadeIn>
            </div>

            <div className="relative h-80 min-h-[320px] md:h-full">
              <Image
                src="/img_pet.png"
                alt="Pet protegido com QR"
                fill
                className="object-cover object-center"
              />
              <div className="absolute inset-0 hidden bg-gradient-to-r from-[#0a1628] via-transparent to-transparent md:block" />
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-white/[0.06] px-5 py-24">
        <div className="mx-auto max-w-2xl text-center">
          <FadeIn>
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.22em] text-white/28">chamada final</p>
            <h2 className="mb-4 text-3xl font-extrabold leading-tight text-white md:text-4xl">
              Proteja antes.
              <br />
              <span className="text-teal-400">Recupere depois.</span>
            </h2>
            <p className="mb-8 text-sm text-white/45 md:text-base">
              Faça parte da rede antes de precisar dela. É gratuito para começar.
            </p>
            <Link
              href="/auth/register"
              className="inline-flex items-center gap-2 rounded-2xl bg-teal-500 px-10 py-4 text-base font-bold text-white transition-all hover:bg-teal-400"
              style={{ boxShadow: '0 0 0 1px rgba(20,184,166,.34), 0 14px 40px rgba(20,184,166,.22)' }}
            >
              Criar meu QR agora
              <ArrowRight className="h-5 w-5" strokeWidth={2.5} />
            </Link>
            <p className="mt-3 text-xs text-white/25">Leva menos de 30 segundos</p>
          </FadeIn>
        </div>
      </section>

      <footer className="border-t border-white/[0.06] px-5 py-10">
        <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-6 md:flex-row">
          <div className="flex items-center gap-3">
            <Image
              src="/branding/logo-backfindr.jpeg"
              alt="Backfindr"
              width={32}
              height={32}
              className="h-8 w-8 rounded-xl object-cover"
            />
            <div className="leading-tight">
              <p className="text-sm font-bold text-white">Backfindr</p>
              <p className="text-[11px] text-white/35">Encontre. Conecte. Recupere.</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-5 text-xs text-white/32">
            <Link href="#ao-vivo" className="transition-colors hover:text-white/65">Ao vivo</Link>
            <Link href="#como-funciona" className="transition-colors hover:text-white/65">Como funciona</Link>
            <Link href="#pets" className="transition-colors hover:text-white/65">Pets</Link>
            <Link href="/map" className="transition-colors hover:text-white/65">Mapa</Link>
            <Link href="/privacy" className="transition-colors hover:text-white/65">Privacidade</Link>
            <Link href="/terms" className="transition-colors hover:text-white/65">Termos</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
