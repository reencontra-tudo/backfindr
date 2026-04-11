'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  MapPin, LayoutDashboard, Package, Search,
  QrCode, Bell, Settings, LogOut, Plus, ChevronRight
} from 'lucide-react';
import { useAuthStore } from '@/hooks/useAuth';

const NAV = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Visão Geral' },
  { href: '/dashboard/objects', icon: Package, label: 'Meus Objetos' },
  { href: '/dashboard/search', icon: Search, label: 'Buscar Achados' },
  { href: '/dashboard/matches', icon: QrCode, label: 'Matches', badge: 2 },
  { href: '/dashboard/notifications', icon: Bell, label: 'Notificações' },
  { href: '/dashboard/settings', icon: Settings, label: 'Configurações' },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isAuthenticated, logout } = useAuthStore();

  useEffect(() => {
    if (!isAuthenticated) router.replace('/auth/login');
  }, [isAuthenticated, router]);

  if (!isAuthenticated) return null;

  const initials = user?.name
    ?.split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase() ?? '??';

  return (
    <div className="min-h-screen bg-surface flex">
      {/* Sidebar */}
      <aside className="w-64 flex-shrink-0 bg-surface-card border-r border-surface-border flex flex-col">
        {/* Brand */}
        <div className="p-6 border-b border-surface-border">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg gradient-brand flex items-center justify-center glow-teal">
              <MapPin className="w-4 h-4 text-white" />
            </div>
            <span className="font-display font-bold text-white">Backfindr</span>
          </Link>
        </div>

        {/* Register CTA */}
        <div className="p-4">
          <Link
            href="/dashboard/objects/new"
            className="flex items-center justify-center gap-2 w-full bg-brand-500 hover:bg-brand-400 text-white text-sm font-semibold py-2.5 rounded-lg transition-all glow-teal"
          >
            <Plus className="w-4 h-4" />
            Registrar Objeto
          </Link>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-2 space-y-0.5 overflow-y-auto">
          {NAV.map(({ href, icon: Icon, label, badge }) => {
            const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href));
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${
                  active
                    ? 'bg-brand-500/10 text-brand-400 border border-brand-500/20'
                    : 'text-slate-400 hover:text-white hover:bg-surface'
                }`}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                <span className="flex-1">{label}</span>
                {badge != null && (
                  <span className="bg-brand-500 text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center">
                    {badge}
                  </span>
                )}
                {active && <ChevronRight className="w-3 h-3 opacity-50" />}
              </Link>
            );
          })}
        </nav>

        {/* User */}
        <div className="p-4 border-t border-surface-border">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-full gradient-brand flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white text-sm font-medium truncate">{user?.name}</p>
              <p className="text-slate-500 text-xs truncate">{user?.email}</p>
            </div>
          </div>
          <button
            onClick={() => logout().then(() => router.push('/auth/login'))}
            className="flex items-center gap-2 w-full text-slate-500 hover:text-red-400 text-xs transition-colors py-1"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sair
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}
