'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard, Users, Package, Zap, Shield, BarChart2,
  Building2, Box, QrCode, Truck, Store, MapPin,
  CreditCard, TrendingUp, Mail, Send, Megaphone,
  FileBarChart, Server, Users2, LogOut, Menu, X,
  ChevronRight, Bell, Activity, LayoutGrid, Palette,
} from 'lucide-react';
import { useAuthStore } from '@/hooks/useAuth';

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface AdminStats {
  pending_matches?: number;
  pending_reports?: number;
}

// ─── Navegação por produto ────────────────────────────────────────────────────
//
// Estrutura: produto → seções → itens
// Cada produto tem uma cor de destaque para identificação visual rápida.
//
const NAV = [
  {
    section: 'Visão Geral',
    color: 'teal',
    items: [
      { href: '/admin/dashboard', icon: LayoutDashboard, label: 'Dashboard',   badge: null,              superOnly: false },
      { href: '/admin/analytics', icon: BarChart2,       label: 'Analytics',   badge: null,              superOnly: true  },
    ],
  },
  {
    section: 'P1 — Backfindr Core',
    color: 'teal',
    items: [
      { href: '/admin/objects',     icon: Package,  label: 'Objetos',      badge: null,              superOnly: false },
      { href: '/admin/users',       icon: Users,    label: 'Usuários',     badge: null,              superOnly: false },
      { href: '/admin/matches',     icon: Zap,      label: 'Matches IA',   badge: 'pending_matches', superOnly: false },
      { href: '/admin/publicacoes', icon: Megaphone,label: 'Publicações',  badge: null,              superOnly: false },
      { href: '/admin/moderacao',   icon: Shield,   label: 'Moderação',    badge: 'pending_reports', superOnly: false },
    ],
  },
  {
    section: 'P2 — B2B',
    color: 'blue',
    items: [
      { href: '/admin/b2b',        icon: Building2, label: 'Parceiros B2B', badge: null, superOnly: false },
      { href: '/admin/b2b-portal', icon: LayoutGrid,label: 'Portal B2B',    badge: null, superOnly: true  },
    ],
  },
  {
    section: 'P3 — Condomínios',
    color: 'purple',
    items: [
      { href: '/admin/condominios',   icon: Building2, label: 'Condomínios',  badge: null, superOnly: false },
      { href: '/admin/custody',       icon: Box,       label: 'Custódia',     badge: null, superOnly: false },
      { href: '/admin/custody/scan',  icon: QrCode,    label: 'Scanner QR',   badge: null, superOnly: false },
    ],
  },
  {
    section: 'P4 — Delivery',
    color: 'amber',
    items: [
      { href: '/admin/delivery/parceiros', icon: Store,  label: 'Parceiros',  badge: null, superOnly: false },
      { href: '/admin/delivery/entregas',  icon: Truck,  label: 'Entregas',   badge: null, superOnly: false },
      { href: '/admin/delivery/rastreio',  icon: MapPin, label: 'Rastreio',   badge: null, superOnly: false },
    ],
  },
  {
    section: 'Marketing',
    color: 'teal',
    items: [
      { href: '/admin/marketing/leads',      icon: Users,  label: 'Leads',       badge: null, superOnly: false },
      { href: '/admin/marketing/automacao',  icon: Zap,    label: 'Automação',   badge: null, superOnly: false },
      { href: '/admin/marketing/reativacao', icon: Mail,   label: 'Reativação',  badge: null, superOnly: false },
      { href: '/admin/social-posts',         icon: Send,   label: 'Social Auto', badge: null, superOnly: false },
      { href: '/admin/emails',               icon: Mail,   label: 'E-mails',     badge: null, superOnly: false },
      { href: '/admin/marketing/brand',       icon: Palette, label: 'Brand Book',  badge: null, superOnly: true },
    ],
  },
  {
    section: 'Financeiro',
    color: 'teal',
    items: [
      { href: '/admin/financeiro', icon: CreditCard,  label: 'Financeiro', badge: null, superOnly: false },
      { href: '/admin/planos',     icon: TrendingUp,  label: 'Planos',     badge: null, superOnly: false },
    ],
  },
  {
    section: 'Sistema',
    color: 'teal',
    items: [
      { href: '/admin/relatorios', icon: FileBarChart, label: 'Relatórios', badge: null, superOnly: false },
      { href: '/admin/sistema',    icon: Server,       label: 'Sistema',    badge: null, superOnly: false },
      { href: '/admin/equipe',     icon: Users2,       label: 'Equipe',     badge: null, superOnly: true  },
    ],
  },
];

// Cor de destaque por seção de produto
const PRODUCT_ACCENT: Record<string, string> = {
  'P1 — Backfindr Core': 'text-teal-400/60',
  'P2 — B2B':            'text-blue-400/60',
  'P3 — Condomínios':    'text-purple-400/60',
  'P4 — Delivery':       'text-amber-400/60',
};

const PRODUCT_BAR: Record<string, string> = {
  'P1 — Backfindr Core': 'bg-teal-500/30',
  'P2 — B2B':            'bg-blue-500/30',
  'P3 — Condomínios':    'bg-purple-500/30',
  'P4 — Delivery':       'bg-amber-500/30',
};

// ─── Sidebar ──────────────────────────────────────────────────────────────────

function Sidebar({ onClose, stats }: { onClose?: () => void; stats: AdminStats }) {
  const pathname = usePathname();
  const router   = useRouter();
  const { user, logout } = useAuthStore();

  const isSuperAdmin = user?.role === 'super_admin';

  const getBadge = (key: string | null) => {
    if (!key) return 0;
    return (stats as Record<string, number>)[key] ?? 0;
  };

  return (
    <div className="flex flex-col h-full">

      {/* Brand */}
      <div className="px-4 py-3.5 border-b border-white/[0.06] flex items-center justify-between flex-shrink-0">
        <Link href="/admin/dashboard" className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-teal-500 flex items-center justify-center">
            <Activity className="w-3.5 h-3.5 text-white" strokeWidth={2.5} />
          </div>
          <div>
            <span className="text-white font-bold text-[13px] block leading-none tracking-tight">Backfindr</span>
            <span className="text-teal-400/60 text-[9px] font-mono uppercase tracking-widest">Superadmin</span>
          </div>
        </Link>
        {onClose && (
          <button onClick={onClose} className="md:hidden text-white/30 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2.5 py-3 overflow-y-auto space-y-5">
        {NAV.map(({ section, items }) => {
          const visibleItems = items.filter(item => !item.superOnly || isSuperAdmin);
          if (visibleItems.length === 0) return null;

          const isProduct = section.startsWith('P');
          const accent    = PRODUCT_ACCENT[section];
          const bar       = PRODUCT_BAR[section];

          return (
            <div key={section}>
              <div className="flex items-center gap-1.5 px-2.5 mb-1.5">
                {isProduct && <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${bar ?? 'bg-white/10'}`} />}
                <p className={`text-[9px] font-bold uppercase tracking-[0.18em] ${isProduct ? (accent ?? 'text-white/30') : 'text-white/15'}`}>
                  {section}
                </p>
              </div>
              <div className="space-y-0.5">
                {visibleItems.map(({ href, icon: Icon, label, badge }) => {
                  const active     = href === '/admin' ? pathname === '/admin' : pathname.startsWith(href);
                  const badgeCount = getBadge(badge);
                  return (
                    <Link
                      key={href}
                      href={href}
                      className={`flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-[13px] transition-all group ${
                        active
                          ? 'bg-teal-500/12 text-teal-300 border border-teal-500/20'
                          : 'text-white/35 hover:text-white/80 hover:bg-white/[0.04]'
                      }`}
                    >
                      <Icon className={`w-4 h-4 flex-shrink-0 transition-colors ${active ? 'text-teal-400' : 'text-white/25 group-hover:text-white/50'}`} />
                      <span className="flex-1 font-medium">{label}</span>
                      {badgeCount > 0 && (
                        <span className="min-w-[18px] h-[18px] flex items-center justify-center bg-red-500/90 text-white text-[9px] font-bold rounded-full px-1">
                          {badgeCount > 99 ? '99+' : badgeCount}
                        </span>
                      )}
                      {active && !badgeCount && <ChevronRight className="w-3 h-3 text-teal-500/40" />}
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      {/* User footer */}
      <div className="px-2.5 py-3 border-t border-white/[0.06] space-y-1 flex-shrink-0">
        <div className="flex items-center gap-2.5 px-2.5 py-2 mb-1">
          <div className="w-7 h-7 rounded-full bg-teal-500/20 border border-teal-500/30 flex items-center justify-center text-teal-300 text-xs font-bold flex-shrink-0">
            {user?.name?.[0]?.toUpperCase() ?? 'A'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white/70 text-xs font-semibold truncate leading-none">{user?.name ?? 'Admin'}</p>
            <p className="text-teal-400/50 text-[9px] font-mono mt-0.5">
              {isSuperAdmin ? 'Superadmin' : user?.role === 'admin' ? 'Colaborador' : 'Admin B2B'}
            </p>
          </div>
          <div className="w-1.5 h-1.5 bg-green-400 rounded-full flex-shrink-0" />
        </div>

        <Link
          href="/dashboard"
          className="flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-white/25 hover:text-teal-400 hover:bg-teal-500/[0.06] text-xs transition-all"
        >
          <LayoutGrid className="w-3.5 h-3.5" />
          <span>Ver como usuário</span>
        </Link>

        <button
          onClick={() => logout().then(() => router.push('/auth/login'))}
          className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-white/25 hover:text-red-400 hover:bg-red-500/[0.06] text-xs transition-all"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Sair</span>
        </button>
      </div>
    </div>
  );
}

// ─── Layout ───────────────────────────────────────────────────────────────────

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router   = useRouter();
  const { user, isAuthenticated, fetchMe } = useAuthStore();

  const [open,        setOpen]        = useState(false);
  const [stats,       setStats]       = useState<AdminStats>({});
  const [totalAlerts, setTotalAlerts] = useState(0);
  const [checking,    setChecking]    = useState(true);

  // 1. Verificar auth
  useEffect(() => {
    const check = async () => {
      if (!isAuthenticated) await fetchMe().catch(() => {});
      setChecking(false);
    };
    check();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 2. Redirect por role
  useEffect(() => {
    if (checking) return;
    if (!user) {
      router.replace('/auth/login?redirect=/admin/dashboard');
      return;
    }
    const role = user.role ?? 'user';
    if (role === 'b2b_admin') {
      if (!pathname.startsWith('/admin/b2b-portal')) router.replace('/admin/b2b-portal');
      return;
    }
    if (role !== 'super_admin' && role !== 'admin') {
      router.replace('/dashboard');
    }
  }, [checking, user, pathname, router]);

  // 3. Fechar drawer mobile ao navegar
  useEffect(() => { setOpen(false); }, [pathname]);

  // 4. Buscar stats para badges
  useEffect(() => {
    if (!user || (user.role !== 'super_admin' && user.role !== 'admin')) return;
    fetch('/api/v1/admin/stats')
      .then(r => r.json())
      .then(d => {
        setStats(d);
        setTotalAlerts((d.pending_matches ?? 0) + (d.pending_reports ?? 0));
      })
      .catch(() => {});
  }, [pathname, user]);

  // Label do breadcrumb
  const pageLabel = pathname
    .replace('/admin', '')
    .replace(/^\//, '')
    .replace(/\/.*/, '')
    || 'dashboard';

  // ── Loading ────────────────────────────────────────────────────────────────
  if (checking) {
    return (
      <div className="min-h-screen bg-[#050810] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-teal-500/30 border-t-teal-400 rounded-full animate-spin" />
          <p className="text-white/30 text-sm">Verificando acesso…</p>
        </div>
      </div>
    );
  }

  if (!user || (user.role !== 'super_admin' && user.role !== 'admin' && user.role !== 'b2b_admin')) {
    return null;
  }

  return (
    <div className="min-h-screen bg-[#050810] text-white flex">

      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-52 flex-shrink-0 bg-[#080c14] border-r border-white/[0.05] flex-col">
        <Sidebar stats={stats} />
      </aside>

      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/80 backdrop-blur-sm md:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Mobile drawer */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-52 bg-[#080c14] border-r border-white/[0.05] flex flex-col transition-transform duration-300 md:hidden ${open ? 'translate-x-0' : '-translate-x-full'}`}>
        <Sidebar stats={stats} onClose={() => setOpen(false)} />
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Topbar */}
        <header className="flex items-center gap-3 px-4 md:px-6 border-b border-white/[0.05] bg-[#060a12] flex-shrink-0" style={{ height: '52px' }}>
          <button onClick={() => setOpen(true)} className="md:hidden text-white/30 hover:text-white transition-colors">
            <Menu className="w-5 h-5" />
          </button>

          <div className="hidden md:flex items-center gap-1.5 text-xs text-white/20">
            <span className="font-mono">admin</span>
            <ChevronRight className="w-3 h-3 text-white/10" />
            <span className="text-white/40 capitalize font-medium">{pageLabel}</span>
          </div>

          <div className="flex items-center gap-2 ml-auto">
            <button className="relative w-8 h-8 flex items-center justify-center text-white/25 hover:text-white transition-colors">
              <Bell className="w-4 h-4" />
              {totalAlerts > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[14px] h-[14px] flex items-center justify-center bg-red-500 text-white text-[8px] font-bold rounded-full px-0.5 ring-2 ring-[#060a12]">
                  {totalAlerts > 9 ? '9+' : totalAlerts}
                </span>
              )}
            </button>

            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 bg-green-500/8 border border-green-500/15 rounded-full">
              <div className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
              <span className="text-green-400/80 text-[10px] font-medium">Online</span>
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
