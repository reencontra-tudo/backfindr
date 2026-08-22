'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  Package, CheckCircle2, AlertTriangle,
  Plus, ArrowRight, Zap, QrCode, Star, CreditCard,
  Search, Map
} from 'lucide-react';
import Cookies from 'js-cookie';
import { useAuthStore } from '@/hooks/useAuth';
import { objectsApi, matchesApi, parseApiError } from '@/lib/api';
import { RegisteredObject, Match } from '@/types';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import OnboardingChecklist from '@/components/ui/OnboardingChecklist';
import WelcomeModal from '@/components/ui/WelcomeModal';
import OnboardingTour, { TourStep } from '@/components/ui/OnboardingTour';
import CondominioContextBanner from '@/components/CondominioContextBanner';
import ActivitySummary from '@/components/activity/ActivitySummary';
import PushPromptCard from '@/components/PushPromptCard';

const EMOJI: Record<string, string> = {
  phone:'📱',wallet:'👛',keys:'🔑',bag:'🎒',pet:'🐾',
  bike:'🚲',document:'📄',jewelry:'💍',electronics:'💻',clothing:'👕',other:'📦',
};

const STATUS_COLOR: Record<string, string> = {
  lost:'text-red-400 bg-red-500/10 border-red-500/20',
  found:'text-teal-400 bg-teal-500/10 border-teal-500/20',
  returned:'text-green-400 bg-green-500/10 border-green-500/20',
  stolen:'text-orange-400 bg-orange-500/10 border-orange-500/20',
};

const STATUS_LABEL: Record<string, string> = {
  lost:'Perdido',found:'Achado',returned:'Recuperado',stolen:'Roubado',
};

const PLAN_LABEL: Record<string, string> = {
  free: 'Grátis',
  pro: 'Pro',
  business: 'Business',
};

const PLAN_COLOR: Record<string, { bg: string; border: string; text: string; icon: string }> = {
  free:     { bg: 'bg-white/[0.03]',      border: 'border-white/[0.07]',    text: 'text-white/50',  icon: 'text-white/30' },
  pro:      { bg: 'bg-teal-500/[0.06]',   border: 'border-teal-500/20',     text: 'text-teal-300',  icon: 'text-teal-400' },
  business: { bg: 'bg-yellow-500/[0.06]', border: 'border-yellow-500/20',   text: 'text-yellow-300',icon: 'text-yellow-400' },
};

// ─── Steps do tour guiado ─────────────────────────────────────────────────────
const TOUR_STEPS: TourStep[] = [
  {
    target: null,
    placement: 'center',
    title: 'Bem-vindo ao seu painel!',
    description: 'Este é o seu painel de controle. Aqui você acompanha todos os seus objetos registrados, matches de IA e notificações em tempo real.',
  },
  {
    target: '[data-tour-id="register-btn"]',
    placement: 'right',
    title: 'Registrar Objeto',
    description: 'Clique aqui para registrar um novo objeto. Você receberá um QR Code exclusivo para colar no objeto físico.',
  },
  {
    target: '[data-tour-id="sidebar-nav"]',
    placement: 'right',
    title: 'Menu de navegação',
    description: 'Use o menu lateral para acessar seus objetos, buscar achados, ver matches de IA, notificações e configurações de plano.',
  },
  {
    target: '[data-tour-id="stats-grid"]',
    placement: 'bottom',
    title: 'Resumo dos seus objetos',
    description: 'Aqui você vê rapidamente quantos objetos estão registrados, perdidos, recuperados e quantos matches estão aguardando avaliação.',
  },
  {
    target: '[data-tour-id="recent-objects"]',
    placement: 'top',
    title: 'Objetos recentes',
    description: 'Seus objetos mais recentes aparecem aqui. Clique em qualquer um para ver os detalhes, o QR Code e o histórico de scans.',
  },
  {
    target: '[data-tour-id="onboarding-checklist"]',
    placement: 'top',
    title: 'Checklist de primeiros passos',
    description: 'Complete esses passos para aproveitar ao máximo o Backfindr: registre um objeto, ative notificações e cole o QR Code.',
  },
];

interface PlanInfo {
  plan: string;
  is_paid: boolean;
  plan_expires_at: string | null;
  features?: { max_objects: number };
}

// ─── Chaves de localStorage ───────────────────────────────────────────────────
const LS_WELCOME_SHOWN = 'backfindr_welcome_shown';
const LS_TOUR_DONE     = 'backfindr_tour_done';

export default function DashboardPage() {
  const { user } = useAuthStore();
  const [objects, setObjects] = useState<RegisteredObject[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(true);
  const [planInfo, setPlanInfo] = useState<PlanInfo | null>(null);

  // Onboarding states — inicializa como true se nunca foi exibido (evita flash do dashboard)
  const [showWelcome, setShowWelcome] = useState(() => {
    if (typeof window === 'undefined') return false;
    return !localStorage.getItem(LS_WELCOME_SHOWN);
  });
  const [showTour, setShowTour] = useState(false);

  // Buscar status do plano
  useEffect(() => {
    const token = Cookies.get('access_token');
    if (!token) return;
    fetch('/api/v1/billing/status', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data?.plan) setPlanInfo(data); })
      .catch(() => {});
  }, []);

  const load = useCallback(async () => {
    try {
      const [objRes, matchRes] = await Promise.all([
        objectsApi.list({ size: 5 }),
        matchesApi.list(),
      ]);
      setObjects(objRes.data?.items ?? []);
      setMatches(matchRes.data?.matches ?? []);
    } catch (e) { console.error(parseApiError(e)); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  function handleCloseWelcome() {
    localStorage.setItem(LS_WELCOME_SHOWN, '1');
    setShowWelcome(false);
  }

  function handleStartTour() {
    localStorage.setItem(LS_WELCOME_SHOWN, '1');
    setShowWelcome(false);
    setTimeout(() => setShowTour(true), 400);
  }

  function handleTourDone() {
    localStorage.setItem(LS_TOUR_DONE, '1');
    setShowTour(false);
  }

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite';
  const firstName = user?.name?.split(' ')[0] ?? '';

  const lost = objects.filter(o => o.status === 'lost').length;
  const returned = objects.filter(o => o.status === 'returned').length;
  const pending = matches.filter(m => m.status === 'pending').length;

  const currentPlan = planInfo?.plan ?? user?.plan ?? 'free';
  const planColors = PLAN_COLOR[currentPlan] ?? PLAN_COLOR['free'];
  const isPaid = planInfo?.is_paid ?? false;

  return (
    <>
      {/* ── Modais de onboarding ─────────────────────────────────────────── */}
      {showWelcome && (
        <WelcomeModal
          userName={user?.name}
          onClose={handleCloseWelcome}
          onStartTour={handleStartTour}
        />
      )}

      {showTour && (
        <OnboardingTour
          steps={TOUR_STEPS}
          onComplete={handleTourDone}
          onSkip={handleTourDone}
        />
      )}

      {/* ── Conteúdo do dashboard ─────────────────────────────────────────── */}
      <div className="p-5 md:p-8 max-w-4xl space-y-6">

        {/* ── Header: saudação + botão registrar ── */}
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-xl font-bold text-white leading-tight">
              {greeting}{firstName ? `, ${firstName}` : ''} 👋
            </h1>
            <p className="text-white/35 text-xs mt-0.5">Seus objetos e status pessoal.</p>
          </div>
          <Link
            href="/dashboard/objects/new"
            data-tour-id="register-btn-header"
            className="flex items-center gap-1.5 bg-teal-500 hover:bg-teal-400 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-all flex-shrink-0"
            style={{ boxShadow: '0 0 16px rgba(20,184,166,0.25)' }}
          >
            <Plus className="w-4 h-4" strokeWidth={2.5} /> Registrar
          </Link>
        </div>

        {/* ── Métricas compactas em linha ── */}
        <div
          className="grid grid-cols-4 gap-2 rounded-2xl bg-white/[0.025] border border-white/[0.06] p-3"
          data-tour-id="stats-grid"
        >
          {/* Meus objetos */}
          <div className="flex flex-col items-center gap-0.5 py-1">
            <span className="text-xl font-bold text-white leading-none">
              {loading ? '—' : objects.length}
            </span>
            <span className="text-[10px] text-white/40 text-center leading-tight">Objetos</span>
          </div>
          {/* Buscando */}
          <div className="flex flex-col items-center gap-0.5 py-1 border-l border-white/[0.06]">
            <span className={`text-xl font-bold leading-none ${lost > 0 ? 'text-red-400' : 'text-white/40'}`}>
              {loading ? '—' : lost}
            </span>
            <span className="text-[10px] text-white/40 text-center leading-tight">Buscando</span>
          </div>
          {/* Recuperados */}
          <div className="flex flex-col items-center gap-0.5 py-1 border-l border-white/[0.06]">
            <span className={`text-xl font-bold leading-none ${returned > 0 ? 'text-green-400' : 'text-white/40'}`}>
              {loading ? '—' : returned}
            </span>
            <span className="text-[10px] text-white/40 text-center leading-tight">Recuperados</span>
          </div>
          {/* Matches IA */}
          <Link
            href="/dashboard/matches"
            className="flex flex-col items-center gap-0.5 py-1 border-l border-white/[0.06] group"
          >
            <span className={`text-xl font-bold leading-none transition-colors ${pending > 0 ? 'text-yellow-400 group-hover:text-yellow-300' : 'text-white/40'}`}>
              {loading ? '—' : pending}
            </span>
            <span className="text-[10px] text-white/40 text-center leading-tight">Matches IA</span>
          </Link>
        </div>

        {/* ── Alerta de matches pendentes ── */}
        {pending > 0 && (
          <Link href="/dashboard/matches"
            className="flex items-center justify-between gap-3 bg-teal-500/[0.06] border border-teal-500/20 rounded-xl px-4 py-3 hover:border-teal-500/40 transition-all">
            <div className="flex items-center gap-2.5">
              <Zap className="w-4 h-4 text-teal-400 flex-shrink-0" />
              <span className="text-teal-300 text-sm font-medium">
                {pending} match{pending > 1 ? 'es' : ''} pendente{pending > 1 ? 's' : ''} — confirme para iniciar o chat
              </span>
            </div>
            <ArrowRight className="w-4 h-4 text-teal-400 flex-shrink-0" />
          </Link>
        )}

        {/* ── Activity Summary — Sistema Vivo no dashboard ──
            'found' entra no activeCount (achado de auditoria 22/08/2026):
            antes ficava fora do filtro, e o widget dizia "nenhuma ocorrência
            ativa" bem no momento em que alguém alegou ter encontrado o
            objeto — o oposto do que deveria comunicar. foundCount separado
            pra dar destaque específico (não é só "monitorando", é "alguém
            encontrou, aja"). */}
        {!loading && objects.length > 0 && (
          <ActivitySummary
            objectsCount={objects.length}
            activeCount={objects.filter(o => o.status === 'lost' || o.status === 'stolen' || o.status === 'found').length}
            foundCount={objects.filter(o => o.status === 'found').length}
            pendingMatches={pending}
            loading={loading}
          />
        )}

        {/* ── Convite pra ativar push (item 5, 22/08/2026) — reaparece aqui
            na volta ao dashboard só se a pessoa ainda não decidiu (ver
            PushPromptCard: localStorage, não persiste "fechei sem decidir"). ── */}
        {!loading && objects.length > 0 && <PushPromptCard className="mt-3" />}

        {/* ── Onboarding checklist (colapsável) ── */}
        {showOnboarding && (
          <div data-tour-id="onboarding-checklist">
            <OnboardingChecklist
              objectsCount={objects.length}
              objectStatuses={objects.map(o => o.status)}
              onDismiss={() => setShowOnboarding(false)}
            />
          </div>
        )}

        {/* ── Card de plano ── */}
        <Link href="/dashboard/billing"
          className={`flex items-center justify-between gap-3 ${planColors.bg} border ${planColors.border} rounded-xl px-4 py-3 hover:opacity-90 transition-all`}>
          <div className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${planColors.bg} border ${planColors.border}`}>
              {currentPlan === 'free'
                ? <CreditCard className={`w-4 h-4 ${planColors.icon}`} />
                : <Star className={`w-4 h-4 ${planColors.icon}`} />
              }
            </div>
            <div>
              <p className={`text-sm font-semibold ${planColors.text}`}>
                Plano {PLAN_LABEL[currentPlan] ?? currentPlan}
                {isPaid && <span className="ml-2 text-xs font-normal opacity-70">ativo</span>}
              </p>
              {currentPlan === 'free' ? (
                <p className="text-white/30 text-xs">Faça upgrade para mais recursos</p>
              ) : planInfo?.plan_expires_at ? (
                <p className="text-white/30 text-xs">
                  Renova em {new Date(planInfo.plan_expires_at).toLocaleDateString('pt-BR')} · até {planInfo?.features?.max_objects ?? '—'} objetos
                </p>
              ) : (
                <p className="text-white/30 text-xs">
                  Até {planInfo?.features?.max_objects ?? '—'} objetos registrados
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {currentPlan === 'free' && (
              <span className="text-xs font-semibold text-teal-400 bg-teal-500/10 border border-teal-500/20 px-2.5 py-1 rounded-full">
                Upgrade
              </span>
            )}
            <ArrowRight className={`w-4 h-4 ${planColors.icon}`} />
          </div>
        </Link>

        {/* ── Ações rápidas ── */}
        <div className="grid grid-cols-2 gap-3">
          <Link href="/dashboard/search"
            className="flex items-center gap-3 p-4 bg-white/[0.02] border border-white/[0.06] hover:border-white/[0.12] rounded-xl transition-all group">
            <div className="w-8 h-8 rounded-lg bg-white/[0.06] flex items-center justify-center flex-shrink-0">
              <Search className="w-4 h-4 text-white/40" />
            </div>
            <div>
              <p className="text-white text-sm font-medium">Buscar achados</p>
              <p className="text-white/30 text-xs">Pesquisar objetos encontrados</p>
            </div>
          </Link>
          <Link href="/map"
            className="flex items-center gap-3 p-4 bg-white/[0.02] border border-white/[0.06] hover:border-white/[0.12] rounded-xl transition-all group">
            <div className="w-8 h-8 rounded-lg bg-white/[0.06] flex items-center justify-center flex-shrink-0">
              <Map className="w-4 h-4 text-white/40" />
            </div>
            <div>
              <p className="text-white text-sm font-medium">Mapa público</p>
              <p className="text-white/30 text-xs">Ver objetos na região</p>
            </div>
          </Link>
        </div>

        {/* ── Objetos recentes ── */}
        <div data-tour-id="recent-objects">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-white font-semibold text-sm">Objetos recentes</h2>
            <Link href="/dashboard/objects" className="text-teal-400 hover:text-teal-300 text-xs transition-colors flex items-center gap-1">
              Ver todos <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          {loading ? (
            <div className="space-y-2">
              {[1,2,3].map(i => <div key={i} className="h-16 bg-white/[0.03] rounded-xl animate-pulse" />)}
            </div>
          ) : objects.length === 0 ? (
            <div className="text-center py-12 bg-white/[0.02] border border-white/[0.06] rounded-2xl">
              <p className="text-3xl mb-3">🛡️</p>
              <p className="text-white font-semibold mb-1">Nenhum objeto ainda</p>
              <p className="text-white/40 text-sm mb-4">Proteja seus pertences com QR Code ou registre uma ocorrência.</p>
              <Link href="/dashboard/objects/new"
                className="inline-flex items-center gap-1.5 bg-teal-500 hover:bg-teal-400 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-all">
                <Plus className="w-4 h-4" /> Começar agora
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              {objects.map(obj => {
                const thumb = obj.photos?.[0];
                return (
                  <Link key={obj.id} href={`/dashboard/objects/${obj.id}`}
                    className="flex items-center gap-3 p-3 bg-white/[0.03] border border-white/[0.06] hover:border-white/[0.12] rounded-xl transition-all group">
                    {/* Thumbnail: foto real ou emoji fallback */}
                    <div className="w-12 h-12 rounded-xl overflow-hidden bg-white/[0.06] flex items-center justify-center flex-shrink-0">
                      {thumb ? (
                        <Image
                          src={thumb}
                          alt={obj.title}
                          width={48}
                          height={48}
                          className="w-full h-full object-cover"
                          unoptimized
                        />
                      ) : (
                        <span className="text-xl">{EMOJI[obj.category] ?? '📦'}</span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm font-medium truncate group-hover:text-teal-300 transition-colors">
                        {obj.title}
                      </p>
                      <p className="text-white/30 text-xs mt-0.5">
                        {formatDistanceToNow(new Date(obj.created_at), { addSuffix: true, locale: ptBR })}
                      </p>
                    </div>
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full border flex-shrink-0 ${STATUS_COLOR[obj.status]}`}>
                      {STATUS_LABEL[obj.status]}
                    </span>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Rodapé: rever tour ── */}
        <div className="text-center pb-4">
          <button
            onClick={() => setShowTour(true)}
            className="text-white/20 hover:text-white/40 text-xs transition-colors"
          >
            Ver tour guiado novamente
          </button>
        </div>

      </div>
    </>
  );
}
