'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard, Package, QrCode, Users, BarChart3,
  Settings, LogOut, MapPin, Menu, X, Building2, Bell, ChevronRight
} from 'lucide-react';
import { useAuthStore } from '@/hooks/useAuth';

const NAV = [
  { href: '/parceiro',              icon: LayoutDashboard, label: 'Visão Geral' },
  { href: '/parceiro/objetos',      icon: Package,         label: 'Objetos' },
  { href: '/parceiro/qrcodes',      icon: QrCode,          label: 'QR Codes' },
  { href: '/parceiro/equipe',       icon: Users,           label: 'Equipe' },
  { href: '/parceiro/relatorios',   icon: BarChart3,       label: 'Relatórios' },
  { href: '/parceiro/configuracoes',icon: Settings,        label: 'Configurações' },
];

function Sidebar({ onClose }: { onClose?: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuthStore();

  return (
    <div className="flex flex-col h-full">
      <div className="px-5 py-4 border-b border-white/[0.06] flex items-center justify-between">
        <Link href="/parceiro" className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-teal-500 flex items-center justify-center">
            <Building2 className="w-4 h-4 text-white" strokeWidth={2} />
          </div>
          <div>
            <span className="text-white font-semibold text-[13px] block">Portal Parceiro</span>
            <span className="text-white/30 text-[10px]">Backfindr B2B</span>
          </div>
        </Link>
        {onClose && (
          <button onClick={onClose} className="text-white/40 hover:text-white md:hidden">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {NAV.map(({ href, icon: Icon, label }) => {
          const active = href === '/parceiro' ? pathname === '/parceiro' : pathname.startsWith(href);
          return (
            <Link key={href} href={href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] transition-all ${
                active
                  ? 'bg-teal-500/10 text-teal-400 border border-teal-500/20'
                  : 'text-white/40 hover:text-white hover:bg-white/[0.04]'
              }`}>
              <Icon className="w-4 h-4 flex-shrink-0" />
              <span>{label}</span>
              {active && <ChevronRight className="w-3 h-3 ml-auto opacity-50" />}
            </Link>
          );
        })}
      </nav>

      <div className="px-4 py-4 border-t border-white/[0.06]">
        <div className="flex items-center gap-2.5 mb-3 p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06]">
          <div className="w-8 h-8 rounded-lg bg-teal-500/20 flex items-center justify-center text-teal-400 text-xs font-bold flex-shrink-0">
            {user?.name?.[0]?.toUpperCase() ?? 'P'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white text-xs font-medium truncate">{user?.name}</p>
            <p className="text-white/30 text-[10px] truncate">Parceiro Business</p>
          </div>
        </div>
        <button
          onClick={() => logout().then(() => router.push('/auth/login'))}
          className="flex items-center gap-2 w-full text-white/30 hover:text-red-400 text-xs py-1.5 px-2 rounded-lg hover:bg-white/[0.04] transition-all">
          <LogOut className="w-3.5 h-3.5" /> Sair
        </button>
      </div>
    </div>
  );
}

export default function ParceiroLayout({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  useEffect(() => { setOpen(false); }, [pathname]);

  return (
    <div className="min-h-screen bg-[#080b0f] text-white flex">
      {/* Desktop */}
      <aside className="hidden md:flex w-60 flex-shrink-0 bg-[#080b0f] border-r border-white/[0.06] flex-col">
        <Sidebar />
      </aside>

      {/* Mobile overlay */}
      {open && <div className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm md:hidden" onClick={() => setOpen(false)} />}
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-[#0d1117] border-r border-white/[0.08] flex flex-col transition-transform duration-300 md:hidden ${open ? 'translate-x-0' : '-translate-x-full'}`}>
        <Sidebar onClose={() => setOpen(false)} />
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="flex items-center justify-between px-5 h-14 border-b border-white/[0.06] bg-[#080b0f] flex-shrink-0">
          <button onClick={() => setOpen(true)} className="md:hidden text-white/40 hover:text-white">
            <Menu className="w-5 h-5" />
          </button>
          <div className="hidden md:flex items-center gap-2">
            <MapPin className="w-3.5 h-3.5 text-teal-400" />
            <span className="text-white/30 text-sm">Portal do Parceiro</span>
          </div>
          <div className="flex items-center gap-3 ml-auto">
            <Link href="/" target="_blank" className="text-white/20 hover:text-white text-xs transition-colors">
              Ver plataforma →
            </Link>
            <button className="w-8 h-8 flex items-center justify-center text-white/30 hover:text-white rounded-lg hover:bg-white/[0.04] transition-all">
              <Bell className="w-4 h-4" />
            </button>
          </div>
        </header>
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
