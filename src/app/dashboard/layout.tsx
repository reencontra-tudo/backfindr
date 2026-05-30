'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard, Package, Map,
  QrCode, Bell, Settings, LogOut, Plus, Menu, X, CreditCard, Building2, Truck,
  Lock,
} from 'lucide-react';
import Cookies from 'js-cookie';
import { useAuthStore } from '@/hooks/useAuth';
import ImpersonationBanner from '@/components/ui/ImpersonationBanner';

// ─── Definição do menu ────────────────────────────────────────────────────────
//
// requiresObjects: true → item fica desabilitado (visual + tooltip) enquanto o
//                         usuário não tiver nenhum objeto cadastrado.
// superOnly: true       → visível apenas para superadmin.
//
const NAV = [
  { href: '/dashboard',               icon: LayoutDashboard, label: 'Visão Geral',   superOnly: false, requiresObjects: false },
  { href: '/dashboard/objects',       icon: Package,         label: 'Meus Objetos',  superOnly: false, requiresObjects: true  },
  { href: '/dashboard/mapa',          icon: Map,             label: 'Mapa',          superOnly: false, requiresObjects: false },
  { href: '/dashboard/matches',       icon: QrCode,          label: 'Matches',       superOnly: false, requiresObjects: true  },
  { href: '/dashboard/notifications', icon: Bell,            label: 'Notificações',  superOnly: false, requiresObjects: false },
  { href: '/dashboard/encomendas',    icon: Package,         label: 'Encomendas',    superOnly: true,  requiresObjects: false }, // em implantação
  { href: '/dashboard/delivery',      icon: Truck,           label: 'Delivery',      superOnly: true,  requiresObjects: false }, // em implantação
  { href: '/dashboard/billing',       icon: CreditCard,      label: 'Plano',         superOnly: false, requiresObjects: false },
  { href: '/dashboard/settings',      icon: Settings,        label: 'Configurações', superOnly: false, requiresObjects: false },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isAuthenticated, logout, fetchMe } = useAuthStore();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [pendingMatches, setPendingMatches] = useState(0);
  const [objectCount, setObjectCount] = useState<number | null>(null); // null = ainda carregando
  const [hydrated, setHydrated] = useState(false);
  const initDone = useRef(false);

  // Aguarda a reidratação do Zustand persist antes de redirecionar
  useEffect(() => {
    const unsub = useAuthStore.persist.onFinishHydration(() => setHydrated(true));
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

  // Buscar contagem de objetos do usuário
  useEffect(() => {
    if (!isAuthenticated) return;
    const token = Cookies.get('access_token');
    if (!token) return;
    fetch('/api/v1/objects?size=1', {
      headers: { 'Authorization': `Bearer ${token}` },
    })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data) { setObjectCount(0); return; }
        // Suporta diferentes formatos de resposta
        const total =
          data.data?.total ??
          data.total ??
          (Array.isArray(data.data?.objects) ? data.data.objects.length : null) ??
          (Array.isArray(data.objects) ? data.objects.length : null) ??
          0;
        setObjectCount(total);
      })
      .catch(() => setObjectCount(0));
  }, [isAuthenticated]);

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

  if (!hydrated) return null;
  if (!isAuthenticated) return null;

  const initials = user?.name
    ?.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase() ?? '??';

  // true quando já sabemos que o usuário tem pelo menos 1 objeto
  const hasObjects = objectCount !== null && objectCount > 0;
  // superadmin nunca é bloqueado
  const isSuperAdmin = user?.role === 'superadmin';

  const SidebarContent = () => (
    <>
      {/* Brand */}
      <div className="px-5 py-4 border-b border-white/[0.06] flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5">
          <img src="/icons/logo-backfindr.png" alt="Backfindr" width={28} height={28} style={{ borderRadius: 8, flexShrink: 0 }} />
          <span className="font-semibold text-white text-[15px]">Backfindr</span>
        </Link>
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
        {NAV
          .filter(item => !item.superOnly || isSuperAdmin)
          .map(({ href, icon: Icon, label, requiresObjects }) => {
            const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href));
            const isMatches = href === '/dashboard/matches';
            const badge = isMatches && pendingMatches > 0 ? pendingMatches : null;

            // Item bloqueado: requer objetos mas o usuário ainda não tem nenhum
            const locked = requiresObjects && !hasObjects && !isSuperAdmin;

            if (locked) {
              return (
                <div
                  key={href}
                  title="Cadastre um objeto primeiro para acessar esta área"
                  className="group relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm cursor-not-allowed opacity-35 select-none"
                >
                  <Icon className="w-4 h-4 flex-shrink-0 text-white/40" />
                  <span className="flex-1 text-white/40">{label}</span>
                  <Lock className="w-3 h-3 text-white/25 flex-shrink-0" />
                  {/* Tooltip */}
                  <span className="pointer-events-none absolute left-full ml-2 top-1/2 -translate-y-1/2 whitespace-nowrap rounded-md bg-gray-800 border border-white/10 px-2.5 py-1.5 text-xs text-white/70 opacity-0 group-hover:opacity-100 transition-opacity z-50 shadow-lg">
                    Cadastre um objeto primeiro
                  </span>
                </div>
              );
            }

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
