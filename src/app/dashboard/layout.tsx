'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard, Package, Search,
  QrCode, Bell, Settings, LogOut, Plus, Menu, X, CreditCard, Building2, Truck
} from 'lucide-react';
import Cookies from 'js-cookie';
import { useAuthStore } from '@/hooks/useAuth';
import ImpersonationBanner from '@/components/ui/ImpersonationBanner';

const NAV = [
  { href: '/dashboard',                  icon: LayoutDashboard, label: 'Visão Geral' },
  { href: '/dashboard/objects',          icon: Package,         label: 'Meus Objetos' },
  { href: '/dashboard/search',           icon: Search,          label: 'Buscar Achados' },
  { href: '/dashboard/matches',          icon: QrCode,          label: 'Matches' },
  { href: '/dashboard/notifications',    icon: Bell,            label: 'Notificações' },
  { href: '/dashboard/encomendas',       icon: Package,         label: 'Encomendas' },
  { href: '/dashboard/delivery',         icon: Truck,           label: 'Delivery' },
  { href: '/dashboard/billing',          icon: CreditCard,      label: 'Plano' },
  { href: '/dashboard/settings',         icon: Settings,        label: 'Configurações' },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isAuthenticated, logout, fetchMe } = useAuthStore();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [pendingMatches, setPendingMatches] = useState(0);
  const [hydrated, setHydrated] = useState(false);
  const initDone = useRef(false);

  // Aguarda a reidratação do Zustand persist antes de redirecionar
  useEffect(() => {
    const unsub = useAuthStore.persist.onFinishHydration(() => setHydrated(true));
    // Se já hidratou (chamada síncrona no SSR/cliente rápido)
    if (useAuthStore.persist.hasHydrated()) setHydrated(true);
    return () => unsub();
  }, []);

  // Após hidratação: se não autenticado mas tem cookie, tenta renovar silenciosamente
  useEffect(() => {
    if (!hydrated || initDone.current) return;
    initDone.current = true;
    if (!isAuthenticated) {
      const token = Cookies.get('access_token') || Cookies.get('refresh_token');
      if (token) {
        // Cookie existe — tenta restaurar sessão via fetchMe (o interceptor renova o JWT se necessário)
        fetchMe().catch(() => router.replace('/auth/login'));
      } else {
        router.replace('/auth/login');
      }
    }
  }, [hydrated, isAuthenticated, fetchMe, router]);

  // Redireciona se perder autenticação após já estar hidratado
  useEffect(() => {
    if (hydrated && !isAuthenticated && initDone.current) router.replace('/auth/login');
  }, [hydrated, isAuthenticated, router]);

  // Buscar contagem real de matches pendentes
  useEffect(() => {
    if (!isAuthenticated) return;
    const token = Cookies.get('access_token');
    if (!token) return;
    fetch('/api/v1/matches', {
      headers: { 'Authorization': `Bearer ${token}` },
    })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data) return;
        const matches = data.data?.matches ?? data.matches ?? [];
        const pending = matches.filter((m: { status: string }) => m.status === 'pending').length;
        setPendingMatches(pending);
      })
      .catch(() => {});
  }, [isAuthenticated]);

  // Close sidebar on route change
  useEffect(() => { setSidebarOpen(false); }, [pathname]);

  // Enquanto aguarda hidratação, não renderiza nada (evita flash de redirect)
  if (!hydrated) return null;
  if (!isAuthenticated) return null;

  const initials = user?.name
    ?.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase() ?? '??';

  const SidebarContent = () => (
    <>
      {/* Brand */}
      <div className="px-5 py-4 border-b border-white/[0.06] flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5">
          <img src="/icons/logo-backfindr.png" alt="Backfindr" width={28} height={28} style={{ borderRadius: 8, flexShrink: 0 }} />
          <span className="font-semibold text-white text-[15px]">Backfindr</span>
        </Link>
        {/* Close button — mobile only */}
        <button onClick={() => setSidebarOpen(false)} className="md:hidden text-white/40 hover:text-white transition-colors">
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Register CTA */}
      <div className="px-4 py-3">
        <Link
          href="/dashboard/objects/new"
          data-tour-id="register-btn"
          className="flex items-center justify-center gap-2 w-full bg-teal-500 hover:bg-teal-400 text-white text-sm font-semibold py-2.5 rounded-lg transition-all"
          style={{ boxShadow: '0 0 0 1px rgba(20,184,166,0.4)' }}
        >
          <Plus className="w-4 h-4" strokeWidth={2.5} />
          Registrar Objeto
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-2 space-y-0.5 overflow-y-auto" data-tour-id="sidebar-nav">
        {NAV.map(({ href, icon: Icon, label }) => {
          const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href));
          const isMatches = href === '/dashboard/matches';
          const badge = isMatches && pendingMatches > 0 ? pendingMatches : null;
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${
                active
                  ? 'bg-teal-500/10 text-teal-400 border border-teal-500/20'
                  : 'text-white/40 hover:text-white hover:bg-white/[0.05]'
              }`}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              <span className="flex-1">{label}</span>
              {badge != null && (
                <span className="bg-teal-500 text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center">
                  {badge}
                </span>
              )}
            </Link>
          );
        })}

        {/* Business nav — only for business plan */}
        {user?.plan === 'business' && (
          <>
            <div className="px-3 pt-3 pb-1">
              <p className="text-white/20 text-[10px] font-semibold uppercase tracking-wider">Business</p>
            </div>
            {[{ href: '/dashboard/business', icon: Building2, label: 'Painel Business' }].map(({ href, icon: Icon, label }) => {
              const active = pathname === href || pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${
                    active
                      ? 'bg-teal-500/10 text-teal-400 border border-teal-500/20'
                      : 'text-white/40 hover:text-white hover:bg-white/[0.05]'
                  }`}
                >
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  <span className="flex-1">{label}</span>
                </Link>
              );
            })}
          </>
        )}
      </nav>

      {/* User */}
      <div className="px-4 py-4 border-t border-white/[0.06]">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-8 rounded-full bg-teal-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white text-sm font-medium truncate">{user?.name}</p>
            <p className="text-white/30 text-xs truncate">{user?.email}</p>
          </div>
        </div>
        <button
          onClick={() => logout().then(() => router.push('/auth/login'))}
          className="flex items-center gap-2 text-white/30 hover:text-red-400 text-xs transition-colors py-1"
        >
          <LogOut className="w-3.5 h-3.5" /> Sair
        </button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-[#080b0f] flex">
      <ImpersonationBanner />

      {/* ── Desktop sidebar ───────────────────────────────────────────── */}
      <aside className="hidden md:flex w-60 flex-shrink-0 bg-[#080b0f] border-r border-white/[0.06] flex-col">
        <SidebarContent />
      </aside>

      {/* ── Mobile overlay ────────────────────────────────────────────── */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── Mobile sidebar (drawer) ───────────────────────────────────── */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-72 bg-[#0d1117] border-r border-white/[0.08] flex flex-col transform transition-transform duration-300 md:hidden ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        <SidebarContent />
      </aside>

      {/* ── Main content ──────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Mobile topbar */}
        <header className="md:hidden flex items-center justify-between px-4 h-14 border-b border-white/[0.06] bg-[#080b0f] flex-shrink-0">
          <button
            onClick={() => setSidebarOpen(true)}
            className="w-9 h-9 flex items-center justify-center text-white/60 hover:text-white transition-colors"
          >
            <Menu className="w-5 h-5" />
          </button>
          <Link href="/" className="flex items-center gap-2">
            <img src="/icons/logo-backfindr.png" alt="Backfindr" width={24} height={24} style={{ borderRadius: 6, flexShrink: 0 }} />
            <span className="text-white font-semibold text-sm">Backfindr</span>
          </Link>
          <Link
            href="/dashboard/objects/new"
            className="w-9 h-9 flex items-center justify-center bg-teal-500 hover:bg-teal-400 rounded-lg transition-all"
          >
            <Plus className="w-4 h-4 text-white" strokeWidth={2.5} />
          </Link>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
