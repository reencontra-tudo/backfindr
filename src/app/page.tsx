'use client';

import Link from 'next/link';
import Image from 'next/image';
import dynamic from 'next/dynamic';
const HomeLiveMap = dynamic(() => import('@/components/HomeLiveMap'), { ssr: false });
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
  AlertTriangle,
} from 'lucide-react';

type ActivityType = 'lost' | 'found' | 'match';

interface ActivityItem {
  id: string;
  type: ActivityType;
  emoji: string;
  text: string;
  city: string;
  time: string;
  unique_code?: string | null;
  isRecent?: boolean;
  is_boosted?: boolean;
}

/**
 * Sorteio ponderado sem reposição.
 * Itens boosted têm peso BOOST_WEIGHT; demais têm peso 1.
 * Após o sorteio, boosted são empurrados para o topo.
 */
const BOOST_WEIGHT = 4;
function weightedSample(pool: ActivityItem[], n: number): ActivityItem[] {
  if (pool.length <= n) return [...pool];
  const remaining = [...pool];
  const selected: ActivityItem[] = [];
  while (selected.length < n && remaining.length > 0) {
    const totalWeight = remaining.reduce(
      (sum, item) => sum + (item.is_boosted ? BOOST_WEIGHT : 1),
      0
    );
    let rand = Math.random() * totalWeight;
    let idx = 0;
    for (let i = 0; i < remaining.length; i++) {
      rand -= remaining[i].is_boosted ? BOOST_WEIGHT : 1;
      if (rand <= 0) { idx = i; break; }
    }
    selected.push(remaining[idx]);
    remaining.splice(idx, 1);
  }
  // Boosted sobem para o topo, mantendo ordem relativa entre eles
  return [
    ...selected.filter((i) => i.is_boosted),
    ...selected.filter((i) => !i.is_boosted),
  ];
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
          .filter((obj: { id: string; title: string; status: string; created_at: string }) => {
            const day = obj.created_at ? obj.created_at.slice(0, 10) : '';
            const fingerprint = `${obj.title.toLowerCase().trim()}|${obj.status}|${day}`;
            if (seen.has(obj.id) || seen.has(fingerprint)) return false;
            seen.add(obj.id);
            seen.add(fingerprint);
            return true;
          })
          .slice(0, 20)
          .map((obj: {
            id: string;
            title: string;
            category: string;
            status: string;
            unique_code?: string | null;
            location_addr?: string;
            location?: { address?: string } | null;
            created_at: string;
            is_boosted?: boolean;
          }) => {
            const type = (obj.status === 'found' || obj.status === 'match' ? obj.status : 'lost') as ActivityType;
            const cityRaw = obj.location_addr ?? (typeof obj.location === 'object' && obj.location?.address) ?? '';
            const city = cityRaw ? String(cityRaw).split(',').slice(0, 2).join(',').trim() : 'São Paulo, SP';
            const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
            const isRecent = new Date(obj.created_at).getTime() > thirtyDaysAgo;
            return {
              id: obj.id,
              type,
              emoji: CATEGORY_EMOJI[obj.category] ?? '📦',
              text: obj.title,
              city,
              time: formatTime(obj.created_at),
              unique_code: obj.unique_code ?? null,
              isRecent,
              is_boosted: obj.is_boosted ?? false,
            };
          });

        const ninetyDaysAgo = Date.now() - 90 * 24 * 60 * 60 * 1000;
        const hasRecentItems = mapped.some(
          (item) => new Date(items.find((o: { id: string }) => o.id === item.id)?.created_at ?? 0).getTime() > ninetyDaysAgo
        );
        if (hasRecentItems) {
          setActivities(mapped);
        }
      })
      .catch(() => {});
  }, []);

  // Sorteio ponderado: boosted têm 4× mais chance de aparecer e sobem ao topo
  const liveCards = weightedSample(activities, 6);

  return (
    <div className="min-h-screen bg-[#07090e] text-white selection:bg-teal-500/30">
      <style>{`
        @keyframes ticker { from { transform: translateX(0) } to { transform: translateX(-50%) } }
        @keyframes pulseDot { 0%,100% { opacity: 1 } 50% { opacity: .45 } }
        @keyframes pulseRing { 0% { transform: scale(1); opacity: .7 } 100% { transform: scale(2.2); opacity: 0 } }
      `}</style>

      <Navbar />

      {/* ─── DOBRA 1: DECISÃO OU SAÍDA ─── */}
      <section className="relative overflow-hidden px-5 pb-16 pt-28">
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

        <div className="relative mx-auto max-w-3xl text-center">
          <FadeIn>
            {/* Headline de intenção — sem narrativa institucional */}
            <h1
              className="mb-4 font-extrabold leading-[0.96] tracking-[-0.04em] text-white"
              style={{ fontSize: 'clamp(36px, 5.5vw, 64px)' }}
            >
              Perdeu algo? Encontrou?
              <br />
              <span
                style={{
                  background: 'linear-gradient(135deg, #f87171 0%, #fb923c 40%, #fbbf24 70%, #2dd4bf 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                }}
              >
                Foi roubado? Quer se prevenir?
              </span>
            </h1>

            <p className="mx-auto mb-10 max-w-xl text-base leading-relaxed text-white/50 md:text-lg">
              A Backfindr conecta perdas, achados e proteção preventiva em tempo real — com mapa público, QR e matching por IA.
            </p>

            {/* Grid 2×2 — botões dominantes */}
            <div className="grid grid-cols-2 gap-3 sm:gap-4 mb-6">
              {/* PERDI ALGO — vermelho */}
              <Link
                href="/flow/lost"
                className="group flex flex-col items-center gap-3 rounded-2xl border border-red-500/40 bg-red-500/[0.1] px-4 py-6 text-center transition-all hover:border-red-500/70 hover:bg-red-500/[0.18] hover:scale-[1.02]"
                style={{ boxShadow: '0 0 0 1px rgba(239,68,68,0.15), 0 8px 32px rgba(239,68,68,0.08)' }}
              >
                <span className="text-3xl">😟</span>
                <div>
                  <p className="text-base font-bold text-white leading-tight">Perdi algo</p>
                  <p className="text-xs text-white/45 mt-1 leading-tight">Publicar agora (leva 30s)</p>
                </div>
                <ArrowRight className="h-4 w-4 text-red-400 opacity-0 group-hover:opacity-100 transition-opacity" />
              </Link>

              {/* ENCONTREI ALGO — verde/teal */}
              <Link
                href="/flow/found"
                className="group flex flex-col items-center gap-3 rounded-2xl border border-teal-500/40 bg-teal-500/[0.1] px-4 py-6 text-center transition-all hover:border-teal-500/70 hover:bg-teal-500/[0.18] hover:scale-[1.02]"
                style={{ boxShadow: '0 0 0 1px rgba(20,184,166,0.15), 0 8px 32px rgba(20,184,166,0.08)' }}
              >
                <span className="text-3xl">🙌</span>
                <div>
                  <p className="text-base font-bold text-white leading-tight">Encontrei algo</p>
                  <p className="text-xs text-white/45 mt-1 leading-tight">Devolver com segurança</p>
                </div>
                <ArrowRight className="h-4 w-4 text-teal-400 opacity-0 group-hover:opacity-100 transition-opacity" />
              </Link>

              {/* FOI ROUBADO — laranja/âmbar */}
              <Link
                href="/auth/register?intent=stolen"
                className="group flex flex-col items-center gap-3 rounded-2xl border border-orange-500/40 bg-orange-500/[0.1] px-4 py-6 text-center transition-all hover:border-orange-500/70 hover:bg-orange-500/[0.18] hover:scale-[1.02]"
                style={{ boxShadow: '0 0 0 1px rgba(249,115,22,0.15), 0 8px 32px rgba(249,115,22,0.08)' }}
              >
                <span className="text-3xl">🚨</span>
                <div>
                  <p className="text-base font-bold text-white leading-tight">Foi roubado</p>
                  <p className="text-xs text-white/45 mt-1 leading-tight">Registrar e alertar agora</p>
                </div>
                <ArrowRight className="h-4 w-4 text-orange-400 opacity-0 group-hover:opacity-100 transition-opacity" />
              </Link>

              {/* QUERO ME PREVENIR — azul */}
              <Link
                href="/auth/register?intent=protect"
                className="group flex flex-col items-center gap-3 rounded-2xl border border-blue-500/40 bg-blue-500/[0.1] px-4 py-6 text-center transition-all hover:border-blue-500/70 hover:bg-blue-500/[0.18] hover:scale-[1.02]"
                style={{ boxShadow: '0 0 0 1px rgba(59,130,246,0.15), 0 8px 32px rgba(59,130,246,0.08)' }}
              >
                <span className="text-3xl">🔒</span>
                <div>
                  <p className="text-base font-bold text-white leading-tight">Quero me prevenir</p>
                  <p className="text-xs text-white/45 mt-1 leading-tight">Criar QR grátis</p>
                </div>
                <ArrowRight className="h-4 w-4 text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity" />
              </Link>
            </div>

            {/* CTA secundário + microcopy */}
            <div className="flex flex-col items-center gap-3">
              <Link
                href="/map"
                className="inline-flex items-center gap-2 rounded-xl border border-white/[0.1] bg-white/[0.04] px-5 py-2.5 text-sm text-white/60 transition-all hover:border-white/[0.2] hover:text-white/90"
              >
                <MapPin className="h-4 w-4 text-teal-400" />
                Ver mapa ao vivo
              </Link>
              <p className="text-xs text-white/28">Leva menos de 30 segundos para agir.</p>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ─── TICKER AO VIVO ─── */}
      <LiveTicker items={activities} />

      {/* ─── DOBRA 2: PROVA VIVA COM TENSÃO ─── */}
      <section id="ao-vivo" className="px-5 py-20">
        <div className="mx-auto max-w-6xl">
          <FadeIn>
            {/* Linha de tensão */}
            <p className="mb-2 text-center text-xs font-semibold uppercase tracking-[0.22em] text-white/28">acontecendo agora perto de você</p>
            <h2 className="mb-3 text-center text-3xl font-extrabold text-white md:text-4xl">
              Isso acontece todos os dias.
            </h2>
            <p className="mx-auto mb-12 max-w-xl text-center text-sm leading-relaxed text-white/42 md:text-base">
              A diferença é quem já está preparado.
            </p>
          </FadeIn>

          <div className="grid gap-5 lg:grid-cols-[1.05fr_.95fr]">
            {/* Mini mapa com CTA flutuante */}
            <FadeIn delay={40}>
              <HomeLiveMap />
            </FadeIn>

            {/* Feed ao vivo */}
            <div className="grid gap-4">
              <FadeIn>
                <Link
                  href="/map"
                  className="flex items-center justify-between gap-3 rounded-2xl border border-teal-500/25 bg-teal-500/[0.06] p-4 transition-colors hover:border-teal-500/50 hover:bg-teal-500/[0.1]"
                >
                  <div className="flex items-center gap-3">
                    <div className="relative flex h-10 w-10 items-center justify-center rounded-2xl bg-teal-500/15">
                      <MapPin className="h-5 w-5 text-teal-400" />
                      <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full bg-teal-400" style={{ animation: 'pulseDot 1.2s ease infinite' }} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white">Mapa interativo ao vivo</p>
                      <p className="text-xs text-white/40">Veja todas as ocorrências no mapa público</p>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 flex-shrink-0 text-teal-400" />
                </Link>
              </FadeIn>

              {liveCards.map((item, index) => {
                const isClickable = item.isRecent && item.unique_code;
                const cardContent = (
                  <div className={`rounded-2xl border bg-white/[0.03] p-4 transition-all ${
                    isClickable
                      ? 'border-white/[0.08] hover:border-teal-500/40 hover:bg-teal-500/[0.04] cursor-pointer'
                      : 'border-white/[0.08]'
                  }`}>
                    <div className="mb-2 flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/[0.05] text-lg flex-shrink-0">
                          {item.emoji}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-white">{item.text}</p>
                          <p className="text-xs text-white/38">{item.city}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <span className="h-1.5 w-1.5 rounded-full bg-teal-400" style={{ animation: 'pulseDot 1.2s ease infinite' }} />
                        <span className="text-[11px] text-white/32">{item.time}</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs text-white/45">
                        {item.type === 'lost' && 'Registro publicado na rede e visível para quem pode ajudar.'}
                        {item.type === 'found' && 'Objeto localizado e pronto para gerar contato com segurança.'}
                        {item.type === 'match' && 'A plataforma detectou uma conexão forte entre registros.'}
                      </p>
                      {isClickable && (
                        <span className="flex-shrink-0 text-[10px] font-semibold text-teal-400 flex items-center gap-1">
                          Ver <ChevronRight className="h-3 w-3" />
                        </span>
                      )}
                    </div>
                  </div>
                );
                return (
                  <FadeIn key={item.id} delay={index * 70}>
                    {isClickable ? (
                      <Link href={`/objeto/${item.unique_code}`}>
                        {cardContent}
                      </Link>
                    ) : (
                      cardContent
                    )}
                  </FadeIn>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* ─── DOBRA 3: BLOCO EMOCIONAL (antecipado) ─── */}
      <section className="px-5 py-20 border-y border-white/[0.06]">
        <div className="mx-auto max-w-4xl">
          <FadeIn>
            <div className="rounded-[32px] border border-white/[0.08] bg-gradient-to-br from-[#0f1a2e] to-[#07090e] p-10 md:p-16 text-center relative overflow-hidden">
              <div className="pointer-events-none absolute inset-0 opacity-[0.04]" style={{
                backgroundImage: 'radial-gradient(circle at 30% 50%, rgba(239,68,68,1) 0%, transparent 60%), radial-gradient(circle at 70% 50%, rgba(20,184,166,1) 0%, transparent 60%)',
              }} />
              <div className="relative">
                <p className="mb-4 text-xs font-semibold uppercase tracking-[0.22em] text-white/28">você só lembra disso depois que perde</p>
                <h2 className="mb-5 text-3xl font-extrabold leading-tight text-white md:text-4xl lg:text-5xl">
                  Celular. Carteira. Documentos.
                  <br />
                  <span className="text-white/50">Chaves. Mochila. Pet.</span>
                </h2>
                <p className="mx-auto mb-10 max-w-lg text-base leading-relaxed text-white/45">
                  Quando acontece, cada minuto pesa. A maioria das pessoas não tem plano — e perde o objeto para sempre.
                </p>
                <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
                  <Link
                    href="/auth/register?intent=protect"
                    className="inline-flex items-center gap-2 rounded-2xl bg-teal-500 px-8 py-4 text-sm font-bold text-white transition-all hover:bg-teal-400"
                    style={{ boxShadow: '0 0 0 1px rgba(20,184,166,.34), 0 14px 40px rgba(20,184,166,.22)' }}
                  >
                    Quero me proteger agora
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                  <Link
                    href="#ao-vivo"
                    className="inline-flex items-center gap-2 rounded-2xl border border-white/[0.1] bg-white/[0.04] px-8 py-4 text-sm font-semibold text-white/70 transition-all hover:border-white/[0.2] hover:text-white"
                  >
                    Ver itens acontecendo ao vivo
                  </Link>
                </div>
              </div>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ─── DOBRA 4: ESCOLHA SEU CAMINHO (5 cards de jornada) ─── */}
      <section className="px-5 py-20">
        <div className="mx-auto max-w-5xl">
          <FadeIn>
            <p className="mb-3 text-center text-xs font-semibold uppercase tracking-[0.22em] text-white/28">escolha seu caminho</p>
            <h2 className="mb-4 text-center text-3xl font-extrabold text-white md:text-4xl">
              Qual é o seu caso?
            </h2>
            <p className="mx-auto mb-12 max-w-xl text-center text-sm text-white/42">
              Cada situação tem um fluxo próprio. Escolha e a plataforma guia você.
            </p>
          </FadeIn>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {/* Card 1 — Perdi algo */}
            <FadeIn delay={0}>
              <div className="flex flex-col h-full rounded-2xl border border-red-500/20 bg-red-500/[0.05] p-6 transition-all hover:border-red-500/40 hover:bg-red-500/[0.09]">
                <span className="text-3xl mb-4">😟</span>
                <h3 className="text-base font-bold text-white mb-2">Perdi algo</h3>
                <p className="text-sm text-white/45 leading-relaxed flex-1 mb-5">
                  Publique em segundos e a rede começa a procurar com você.
                </p>
                <Link
                  href="/flow/lost"
                  className="inline-flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/[0.1] px-4 py-2.5 text-sm font-semibold text-red-300 transition-all hover:bg-red-500/[0.18]"
                >
                  Publicar item perdido <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </FadeIn>

            {/* Card 2 — Encontrei algo */}
            <FadeIn delay={60}>
              <div className="flex flex-col h-full rounded-2xl border border-teal-500/20 bg-teal-500/[0.05] p-6 transition-all hover:border-teal-500/40 hover:bg-teal-500/[0.09]">
                <span className="text-3xl mb-4">🙌</span>
                <h3 className="text-base font-bold text-white mb-2">Encontrei algo</h3>
                <p className="text-sm text-white/45 leading-relaxed flex-1 mb-5">
                  Devolva com segurança, sem expor seu contato.
                </p>
                <Link
                  href="/flow/found"
                  className="inline-flex items-center gap-2 rounded-xl border border-teal-500/30 bg-teal-500/[0.1] px-4 py-2.5 text-sm font-semibold text-teal-300 transition-all hover:bg-teal-500/[0.18]"
                >
                  Publicar item encontrado <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </FadeIn>

            {/* Card 3 — Foi roubado */}
            <FadeIn delay={120}>
              <div className="flex flex-col h-full rounded-2xl border border-orange-500/20 bg-orange-500/[0.05] p-6 transition-all hover:border-orange-500/40 hover:bg-orange-500/[0.09]">
                <span className="text-3xl mb-4">🚨</span>
                <h3 className="text-base font-bold text-white mb-2">Foi roubado</h3>
                <p className="text-sm text-white/45 leading-relaxed flex-1 mb-5">
                  Registre agora para gerar alerta, contexto e visibilidade.
                </p>
                <Link
                  href="/auth/register?intent=stolen"
                  className="inline-flex items-center gap-2 rounded-xl border border-orange-500/30 bg-orange-500/[0.1] px-4 py-2.5 text-sm font-semibold text-orange-300 transition-all hover:bg-orange-500/[0.18]"
                >
                  Registrar item roubado <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </FadeIn>

            {/* Card 4 — Quero me prevenir */}
            <FadeIn delay={180}>
              <div className="flex flex-col h-full rounded-2xl border border-blue-500/20 bg-blue-500/[0.05] p-6 transition-all hover:border-blue-500/40 hover:bg-blue-500/[0.09]">
                <span className="text-3xl mb-4">🔒</span>
                <h3 className="text-base font-bold text-white mb-2">Quero me prevenir</h3>
                <p className="text-sm text-white/45 leading-relaxed flex-1 mb-5">
                  Crie um QR antes da perda e aumente sua chance de retorno.
                </p>
                <Link
                  href="/auth/register?intent=protect"
                  className="inline-flex items-center gap-2 rounded-xl border border-blue-500/30 bg-blue-500/[0.1] px-4 py-2.5 text-sm font-semibold text-blue-300 transition-all hover:bg-blue-500/[0.18]"
                >
                  Criar meu QR grátis <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </FadeIn>

            {/* Card 5 — Meu pet sumiu */}
            <FadeIn delay={240}>
              <div className="flex flex-col h-full rounded-2xl border border-amber-500/20 bg-amber-500/[0.05] p-6 transition-all hover:border-amber-500/40 hover:bg-amber-500/[0.09] sm:col-span-2 lg:col-span-1">
                <span className="text-3xl mb-4">🐾</span>
                <h3 className="text-base font-bold text-white mb-2">Meu pet sumiu</h3>
                <p className="text-sm text-white/45 leading-relaxed flex-1 mb-5">
                  Ative a busca e amplie a chance de reencontro rapidamente.
                </p>
                <Link
                  href="/buscar?category=pet"
                  className="inline-flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/[0.1] px-4 py-2.5 text-sm font-semibold text-amber-300 transition-all hover:bg-amber-500/[0.18]"
                >
                  Buscar pet agora <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </FadeIn>
          </div>
        </div>
      </section>

      {/* ─── DOBRA 5: COMO FUNCIONA (depois da escolha) ─── */}
      <section id="como-funciona" className="px-5 py-20 border-t border-white/[0.06]">
        <div className="mx-auto max-w-5xl">
          <FadeIn>
            <p className="mb-3 text-center text-xs font-semibold uppercase tracking-[0.22em] text-white/28">como a backfindr funciona</p>
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

          <FadeIn delay={300}>
            <div className="mt-10 text-center">
              <Link
                href="/auth/register"
                className="inline-flex items-center gap-2 rounded-2xl bg-teal-500 px-8 py-4 text-sm font-bold text-white transition-all hover:bg-teal-400"
                style={{ boxShadow: '0 0 0 1px rgba(20,184,166,.34), 0 14px 40px rgba(20,184,166,.18)' }}
              >
                Criar meu QR grátis
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ─── DOBRA 6: PROVA DE TRAÇÃO ─── */}
      <section className="border-y border-white/[0.06] bg-white/[0.015] px-5 py-20">
        <div className="mx-auto max-w-5xl">
          <FadeIn>
            <p className="mb-4 text-center text-xs font-semibold uppercase tracking-[0.22em] text-white/28">pessoas já estão recuperando o que parecia perdido</p>
          </FadeIn>

          <div className="mb-10 grid gap-6 text-center md:grid-cols-3">
            {[
              { value: 12847, suffix: '+', label: 'objetos registrados' },
              { value: 3291, suffix: '+', label: 'recuperações confirmadas' },
              { value: 94, suffix: '%', label: 'mais chance com QR' },
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

          <div className="grid gap-4 md:grid-cols-4">
            {[
              { emoji: '🐕', title: 'Cachorro recuperado em 2 horas', sub: 'QR na coleira facilitou o retorno' },
              { emoji: '👛', title: 'Carteira localizada após scan', sub: 'contato protegido e rápido' },
              { emoji: '🔒', title: 'Contato protegido, devolução segura', sub: 'sem expor número pessoal' },
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

      {/* ─── DOBRA 7: PETS (vertical premium) ─── */}
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
                <h2 className="mb-3 text-3xl font-extrabold leading-tight text-white md:text-4xl">
                  Seu pet pode
                  <br />
                  sumir hoje.
                </h2>
                <p className="mb-2 text-sm text-white/45">
                  Um QR na coleira pode mudar o desfecho.
                </p>
                <p className="mb-7 max-w-md text-sm leading-relaxed text-white/40 md:text-base">
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

      {/* ─── DOBRA 8: ENCONTROU ALGO? (persona found) ─── */}
      <section className="border-t border-white/[0.06] px-5 py-20">
        <div className="mx-auto max-w-4xl">
          <FadeIn>
            <div className="rounded-[32px] border border-teal-500/15 bg-teal-500/[0.04] p-10 md:p-14 text-center">
              <div className="mb-5 inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-teal-500/10 border border-teal-500/20 text-3xl">
                🙌
              </div>
              <h2 className="mb-4 text-3xl font-extrabold text-white md:text-4xl">
                Encontrou algo e não sabe o que fazer?
              </h2>
              <p className="mx-auto mb-8 max-w-lg text-base leading-relaxed text-white/45">
                A Backfindr ajuda você a devolver com segurança, sem expor seu número e sem improviso. O dono pode já estar procurando agora.
              </p>
              <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
                <Link
                  href="/flow/found"
                  className="inline-flex items-center gap-2 rounded-2xl bg-teal-500 px-7 py-4 text-sm font-bold text-white transition-all hover:bg-teal-400"
                  style={{ boxShadow: '0 0 0 1px rgba(20,184,166,.34), 0 14px 40px rgba(20,184,166,.18)' }}
                >
                  Publicar item encontrado
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/flow/lost"
                  className="inline-flex items-center gap-2 rounded-2xl border border-white/[0.1] bg-white/[0.04] px-7 py-4 text-sm font-semibold text-white/70 transition-all hover:border-white/[0.2] hover:text-white"
                >
                  <Search className="h-4 w-4" />
                  Ver se já existe dono na rede
                </Link>
              </div>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ─── DOBRA 9: CTA FINAL — PANCADA ─── */}
      <section className="border-t border-white/[0.06] px-5 py-24">
        <div className="mx-auto max-w-2xl text-center">
          <FadeIn>
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.22em] text-white/28">chamada final</p>
            <h2 className="mb-4 text-3xl font-extrabold leading-tight text-white md:text-4xl lg:text-5xl">
              Se você perder algo hoje,
              <br />
              <span className="text-teal-400">qual é o seu plano?</span>
            </h2>
            <p className="mb-10 text-sm text-white/45 md:text-base">
              Entre na rede antes de precisar dela.
            </p>
            <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
              <Link
                href="/auth/register"
                className="inline-flex items-center gap-2 rounded-2xl bg-teal-500 px-8 py-4 text-base font-bold text-white transition-all hover:bg-teal-400"
                style={{ boxShadow: '0 0 0 1px rgba(20,184,166,.34), 0 14px 40px rgba(20,184,166,.22)' }}
              >
                Criar meu QR agora
                <ArrowRight className="h-5 w-5" strokeWidth={2.5} />
              </Link>
              <Link
                href="/flow/lost"
                className="inline-flex items-center gap-2 rounded-2xl border border-white/[0.1] bg-white/[0.04] px-8 py-4 text-base font-semibold text-white/70 transition-all hover:border-white/[0.2] hover:text-white"
              >
                Publicar item perdido
              </Link>
              <Link
                href="/map"
                className="inline-flex items-center gap-2 rounded-2xl border border-white/[0.1] bg-white/[0.04] px-8 py-4 text-base font-semibold text-white/70 transition-all hover:border-white/[0.2] hover:text-white"
              >
                <MapPin className="h-4 w-4 text-teal-400" />
                Ver mapa ao vivo
              </Link>
            </div>
            <p className="mt-5 text-xs text-white/25">Grátis para começar. Leva menos de 30 segundos.</p>
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
            <Link href="/faq" className="transition-colors hover:text-white/65">Ajuda</Link>
            <Link href="/privacy" className="transition-colors hover:text-white/65">Privacidade</Link>
            <Link href="/terms" className="transition-colors hover:text-white/65">Termos</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
