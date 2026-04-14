'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard, Users, Package, Zap, Building2,
  CreditCard, Mail, Shield, Server, LogOut, Menu, X,
  MapPin, ChevronRight, Bell, Settings
} from 'lucide-react';
import { useAuthStore } from '@/hooks/useAuth';

const NAV = [
  { section: 'Core', items: [
    { href: '/admin',             icon: LayoutDashboard, label: 'Dashboard',   badge: null },
    { href: '/admin/users',       icon: Users,           label: 'Usuários',    badge: null },
    { href: '/admin/objects',     icon: Package,         label: 'Objetos',     badge: null },
    { href: '/admin/matches',     icon: Zap,             label: 'Matches',     badge: 'pending' },
  ]},
  { section: 'Negócio', items: [
    { href: '/admin/b2b',         icon: Building2,       label: 'B2B',         badge: null },
    { href: '/admin/financeiro',  icon: CreditCard,      label: 'Financeiro',  badge: null },
    { href: '/admin/emails',      icon: Mail,            label: 'E-mails',     badge: null },
  ]},
  { section: 'Operações', items: [
    { href: '/admin/moderacao',   icon: Shield,          label: 'Moderação',   badge: 'reports' },
    { href: '/admin/sistema',     icon: Server,          label: 'Sistema',     badge: null },
  ]},
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const [open, setOpen] = useState(false);

  useEffect(() => { setOpen(false); }, [pathname]);

  const Sidebar = () => (
    <div className="flex flex-col h-full">
      {/* Brand */}
      <div className="px-5 py-4 border-b border-white/[0.06] flex items-center justify-between">
        <Link href="/admin" className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-teal-500 flex items-center justify-center">
            <MapPin className="w-3.5 h-3.5 text-white" strokeWidth={2.5} />
          </div>
          <div>
            <span className="text-white font-semibold text-[13px] block leading-none">Backfindr</span>
            <span className="text-white/30 text-[10px] font-mono uppercase tracking-wider">Admin</span>
          </div>
        </Link>
        <button onClick={() => setOpen(false)} className="md:hidden text-white/40 hover:text-white">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto space-y-5">
        {NAV.map(({ section, items }) => (
          <div key={section}>
            <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-white/20 px-3 mb-2">{section}</p>
            <div className="space-y-0.5">
              {items.map(({ href, icon: Icon, label }) => {
                const active = href === '/admin' ? pathname === '/admin' : pathname.startsWith(href);
                return (
                  <Link key={href} href={href}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] transition-all ${
                      active
                        ? 'bg-teal-500/10 text-teal-400 border border-teal-500/20'
                        : 'text-white/40 hover:text-white hover:bg-white/[0.04]'
                    }`}>
                    <Icon className="w-4 h-4 flex-shrink-0" />
                    <span className="flex-1">{label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* User */}
      <div className="px-4 py-4 border-t border-white/[0.06]">
        <div className="flex items-center gap-2.5 mb-3">
          <div className="w-7 h-7 rounded-full bg-teal-500/20 border border-teal-500/30 flex items-center justify-center text-teal-400 text-xs font-bold flex-shrink-0">
            {user?.name?.[0]?.toUpperCase() ?? 'A'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white text-xs font-medium truncate">{user?.name}</p>
            <p className="text-white/30 text-[10px] truncate">Admin</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Link href="/dashboard" className="flex-1 flex items-center justify-center gap-1 text-white/30 hover:text-white text-xs py-1.5 rounded-md hover:bg-white/[0.04] transition-all">
            <Settings className="w-3 h-3" /> App
          </Link>
          <button onClick={() => logout().then(() => router.push('/auth/login'))}
            className="flex-1 flex items-center justify-center gap-1 text-white/30 hover:text-red-400 text-xs py-1.5 rounded-md hover:bg-white/[0.04] transition-all">
            <LogOut className="w-3 h-3" /> Sair
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#060809] text-white flex">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-56 flex-shrink-0 bg-[#080b0f] border-r border-white/[0.06] flex-col">
        <Sidebar />
      </aside>

      {/* Mobile overlay */}
      {open && <div className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm md:hidden" onClick={() => setOpen(false)} />}

      {/* Mobile drawer */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-[#0d1117] border-r border-white/[0.08] flex flex-col transition-transform duration-300 md:hidden ${open ? 'translate-x-0' : '-translate-x-full'}`}>
        <Sidebar />
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Topbar */}
        <header className="flex items-center justify-between px-6 h-14 border-b border-white/[0.06] bg-[#080b0f] flex-shrink-0">
          <button onClick={() => setOpen(true)} className="md:hidden text-white/40 hover:text-white">
            <Menu className="w-5 h-5" />
          </button>
          <div className="hidden md:block">
            <p className="text-white/20 text-xs font-mono">
              {pathname.replace('/admin', '').replace('/', '') || 'dashboard'}
            </p>
          </div>
          <div className="flex items-center gap-3 ml-auto">
            <Link href="/" target="_blank" className="text-white/30 hover:text-white text-xs transition-colors">
              Ver site →
            </Link>
            <button className="relative w-8 h-8 flex items-center justify-center text-white/40 hover:text-white">
              <Bell className="w-4 h-4" />
            </button>
          </div>
        </header>
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
