'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard, Users, Package, Zap, Building2,
  CreditCard, Mail, Shield, Server, LogOut, Menu, X,
  ChevronRight, Bell, Settings, TrendingUp, Activity
} from 'lucide-react';
import { useAuthStore } from '@/hooks/useAuth';

interface AdminStats {
  pending_matches?: number;
  pending_reports?: number;
}

const NAV = [
  { section: 'Visão Geral', items: [
    { href: '/admin/dashboard', icon: LayoutDashboard, label: 'Dashboard',    badge: null },
  ]},
  { section: 'Plataforma', items: [
    { href: '/admin/users',     icon: Users,           label: 'Usuários',     badge: null },
    { href: '/admin/objects',   icon: Package,         label: 'Objetos',      badge: null },
    { href: '/admin/matches',   icon: Zap,             label: 'Matches IA',   badge: 'pending_matches' },
    { href: '/admin/moderacao', icon: Shield,          label: 'Moderação',    badge: 'pending_reports' },
  ]},
  { section: 'Crescimento', items: [
    { href: '/admin/financeiro', icon: CreditCard,     label: 'Financeiro',   badge: null },
    { href: '/admin/planos',     icon: TrendingUp,     label: 'Planos',       badge: null },
    { href: '/admin/b2b',        icon: Building2,      label: 'B2B',          badge: null },
    { href: '/admin/emails',     icon: Mail,           label: 'E-mails',      badge: null },
  ]},
  { section: 'Operações', items: [
    { href: '/admin/sistema',    icon: Server,         label: 'Sistema',      badge: null },
  ]},
];

function Sidebar({ onClose, stats }: { onClose?: () => void; stats: AdminStats }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuthStore();

  const getBadge = (key: string | null) => {
    if (!key) return 0;
    return (stats as Record<string, number>)[key] ?? 0;
  };

  return (
    <div className="flex flex-col h-full">
      {/* Brand */}
      <div className="px-4 py-3.5 border-b border-white/[0.06] flex items-center justify-between flex-shrink-0">
        <Link href="/admin/dashboard" className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-teal-400 to-teal-600 flex items-center justify-center shadow-lg shadow-teal-500/20">
            <Activity className="w-3.5 h-3.5 text-white" strokeWidth={2.5} />
          </div>
          <div>
            <span className="text-white font-bold text-[13px] block leading-none tracking-tight">Backfindr</span>
            <span className="text-teal-400/60 text-[9px] font-mono uppercase tracking-widest">Admin Panel</span>
          </div>
        </Link>
        {onClose && (
          <button onClick={onClose} className="md:hidden text-white/30 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2.5 py-3 overflow-y-auto space-y-4">
        {NAV.map(({ section, items }) => (
          <div key={section}>
            <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-white/15 px-2.5 mb-1.5">{section}</p>
            <div className="space-y-0.5">
              {items.map(({ href, icon: Icon, label, badge }) => {
                const active = href === '/admin' ? pathname === '/admin' : pathname.startsWith(href);
                const badgeCount = getBadge(badge);
                return (
                  <Link key={href} href={href}
                    className={`flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-[13px] transition-all group ${
                      active
                        ? 'bg-teal-500/12 text-teal-300 border border-teal-500/20'
                        : 'text-white/35 hover:text-white/80 hover:bg-white/[0.04]'
                    }`}>
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
        ))}
      </nav>

      {/* User footer */}
      <div className="px-2.5 py-3 border-t border-white/[0.06] space-y-1 flex-shrink-0">
        <div className="flex items-center gap-2.5 px-2.5 py-2 mb-1">
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-teal-500/30 to-teal-700/30 border border-teal-500/30 flex items-center justify-center text-teal-300 text-xs font-bold flex-shrink-0">
            {user?.name?.[0]?.toUpperCase() ?? 'A'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white/70 text-xs font-semibold truncate leading-none">{user?.name ?? 'Admin'}</p>
            <p className="text-teal-400/50 text-[9px] font-mono mt-0.5">Super Admin</p>
          </div>
          <div className="w-1.5 h-1.5 bg-green-400 rounded-full flex-shrink-0" />
        </div>

        <Link href="/dashboard"
          className="flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-white/25 hover:text-white/60 hover:bg-white/[0.04] text-xs transition-all">
          <Settings className="w-3.5 h-3.5" />
          <span>Ver como usuário</span>
        </Link>
        <button
          onClick={() => logout().then(() => router.push('/auth/login'))}
          className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-white/25 hover:text-red-400 hover:bg-red-500/[0.06] text-xs transition-all">
          <LogOut className="w-3.5 h-3.5" />
          <span>Sair</span>
        </button>
      </div>
    </div>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isAuthenticated, fetchMe } = useAuthStore();
  const [open, setOpen] = useState(false);
  const [stats, setStats] = useState<AdminStats>({});
  const [totalAlerts, setTotalAlerts] = useState(0);
  const [checking, setChecking] = useState(true);

  // ── 1. Verificação de autenticação e role ─────────────────────────────────
  useEffect(() => {
    const check = async () => {
      if (!isAuthenticated) {
        await fetchMe().catch(() => {});
      }
      setChecking(false);
    };
    check();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── 2. Redirect baseado em role ───────────────────────────────────────────
  useEffect(() => {
    if (checking) return;
    const role = user?.role ?? 'user';
    if (!user) {
      router.replace('/auth/login?redirect=/admin/dashboard');
      return;
    }
    if (role === 'b2b_admin') {
      if (!pathname.startsWith('/admin/b2b-portal')) {
        router.replace('/admin/b2b-portal');
      }
      return;
    }
    if (role !== 'super_admin') {
      router.replace('/dashboard');
    }
  }, [checking, user, pathname, router]);

  // ── 3. Fechar drawer mobile ao navegar ────────────────────────────────────
  useEffect(() => { setOpen(false); }, [pathname]);

  // ── 4. Buscar stats para badges (só super_admin) ──────────────────────────
  useEffect(() => {
    if (!user || user.role !== 'super_admin') return;
    fetch('/api/v1/admin/stats')
      .then(r => r.json())
      .then(d => {
        setStats(d);
        setTotalAlerts((d.pending_matches ?? 0) + (d.pending_reports ?? 0));
      })
      .catch(() => {});
  }, [pathname, user]);

  const pageLabel = pathname
    .replace('/admin', '')
    .replace(/^\//, '')
    .replace(/\/.*/, '')
    || 'dashboard';

  // ── Loading ───────────────────────────────────────────────────────────────
  if (checking) {
    return (
      <div className="min-h-screen bg-[#050810] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-teal-500/30 border-t-teal-400 rounded-full animate-spin" />
          <p className="text-white/30 text-sm">Verificando acesso...</p>
        </div>
      </div>
    );
  }

  // ── Sem permissão — aguarda redirect ─────────────────────────────────────
  if (!user || (user.role !== 'super_admin' && user.role !== 'b2b_admin')) {
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
        <div className="fixed inset-0 z-40 bg-black/80 backdrop-blur-sm md:hidden" onClick={() => setOpen(false)} />
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

          {/* Breadcrumb */}
          <div className="hidden md:flex items-center gap-1.5 text-xs text-white/20">
            <span className="font-mono">admin</span>
            <ChevronRight className="w-3 h-3 text-white/10" />
            <span className="text-white/40 capitalize font-medium">{pageLabel}</span>
          </div>

          <div className="flex items-center gap-2 ml-auto">
            {/* Alerts */}
            <button className="relative w-8 h-8 flex items-center justify-center text-white/25 hover:text-white transition-colors">
              <Bell className="w-4 h-4" />
              {totalAlerts > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[14px] h-[14px] flex items-center justify-center bg-red-500 text-white text-[8px] font-bold rounded-full px-0.5 ring-2 ring-[#060a12]">
                  {totalAlerts > 9 ? '9+' : totalAlerts}
                </span>
              )}
            </button>

            {/* Status */}
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
