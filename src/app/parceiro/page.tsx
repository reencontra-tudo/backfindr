'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Package, QrCode, CheckCircle2, TrendingUp, ArrowRight, Plus, Bell, Clock, Users } from 'lucide-react';

const RECENT_OBJECTS = [
  { id: '1', title: 'Guarda-chuva preto',    status: 'found',    location: 'Recepção Principal',  time: '10 min' },
  { id: '2', title: 'Óculos de grau',        status: 'found',    location: 'Salão de Festas',     time: '1h' },
  { id: '3', title: 'Chaves (4 cópias)',      status: 'returned', location: 'Portaria 2',          time: '3h' },
  { id: '4', title: 'Carteira marrom',        status: 'found',    location: 'Academia',            time: '5h' },
  { id: '5', title: 'iPhone com capa azul',  status: 'found',    location: 'Piscina',             time: '1d' },
];

const STATUS_STYLE: Record<string, string> = {
  found:    'text-teal-400 bg-teal-500/10 border-teal-500/20',
  returned: 'text-green-400 bg-green-500/10 border-green-500/20',
  lost:     'text-red-400 bg-red-500/10 border-red-500/20',
};
const STATUS_LABEL: Record<string, string> = {
  found: 'Achado', returned: 'Devolvido', lost: 'Perdido',
};

export default function ParceiroDashboard() {
  const [month] = useState('Abril 2026');

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-white">Bom dia, Condomínio Villa Verde 👋</h1>
        <p className="text-white/30 text-sm mt-0.5">{month} · São Paulo, SP</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { icon: Package,     label: 'Objetos este mês', value: 23,  sub: '+5 esta semana',     color: 'text-teal-400 bg-teal-500/10' },
          { icon: CheckCircle2,label: 'Devolvidos',        value: 18,  sub: '78% taxa devolução', color: 'text-green-400 bg-green-500/10' },
          { icon: QrCode,      label: 'QR Codes ativos',  value: 142, sub: '12 novos este mês',  color: 'text-blue-400 bg-blue-500/10' },
          { icon: Users,       label: 'Moradores ativos', value: 89,  sub: 'de 200 unidades',    color: 'text-purple-400 bg-purple-500/10' },
        ].map(({ icon: Icon, label, value, sub, color }) => (
          <div key={label} className="bg-white/[0.02] border border-white/[0.07] rounded-2xl p-5">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 ${color}`}>
              <Icon className="w-4 h-4" />
            </div>
            <p className="text-2xl font-bold text-white">{value}</p>
            <p className="text-white/40 text-xs mt-0.5">{label}</p>
            <p className="text-white/20 text-[10px] mt-1">{sub}</p>
          </div>
        ))}
      </div>

      {/* Quick actions */}
      <div className="grid sm:grid-cols-3 gap-3">
        {[
          { icon: Plus,   label: 'Registrar objeto achado', href: '/parceiro/objetos/novo',  primary: true },
          { icon: QrCode, label: 'Gerar QR Codes em lote',  href: '/parceiro/qrcodes/lote',  primary: false },
          { icon: Bell,   label: 'Notificar moradores',     href: '/parceiro/equipe/avisos',  primary: false },
        ].map(({ icon: Icon, label, href, primary }) => (
          <Link key={label} href={href}
            className={`flex items-center gap-3 px-4 py-3.5 rounded-2xl text-sm font-medium transition-all ${
              primary
                ? 'bg-teal-500 hover:bg-teal-400 text-white'
                : 'bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.08] text-white/60 hover:text-white'
            }`}
            style={primary ? { boxShadow: '0 0 0 1px rgba(20,184,166,0.4),0 4px 20px rgba(20,184,166,0.15)' } : {}}>
            <Icon className="w-4 h-4 flex-shrink-0" />
            {label}
            <ArrowRight className="w-3.5 h-3.5 ml-auto opacity-50" />
          </Link>
        ))}
      </div>

      {/* Recent activity */}
      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-white/[0.02] border border-white/[0.07] rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
            <p className="text-white font-semibold text-sm">Objetos recentes</p>
            <Link href="/parceiro/objetos" className="text-teal-400 text-xs hover:text-teal-300 transition-colors">
              Ver todos →
            </Link>
          </div>
          <div className="divide-y divide-white/[0.04]">
            {RECENT_OBJECTS.map(obj => (
              <div key={obj.id} className="flex items-center gap-3 px-5 py-3 hover:bg-white/[0.02] transition-colors">
                <div className="w-8 h-8 rounded-lg bg-white/[0.06] flex items-center justify-center flex-shrink-0 text-sm">📦</div>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm truncate">{obj.title}</p>
                  <p className="text-white/30 text-xs">{obj.location}</p>
                </div>
                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${STATUS_STYLE[obj.status]}`}>
                    {STATUS_LABEL[obj.status]}
                  </span>
                  <span className="text-white/20 text-[10px] flex items-center gap-1">
                    <Clock className="w-2.5 h-2.5" />{obj.time}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Performance */}
        <div className="bg-white/[0.02] border border-white/[0.07] rounded-2xl p-5">
          <p className="text-white font-semibold text-sm mb-5">Performance do mês</p>
          <div className="space-y-4">
            {[
              { label: 'Taxa de devolução',  value: 78, color: 'bg-green-500',  target: 80 },
              { label: 'Engajamento QR',     value: 64, color: 'bg-teal-500',   target: 70 },
              { label: 'Moradores ativos',   value: 44, color: 'bg-blue-500',   target: 50 },
              { label: 'Satisfação (NPS)',   value: 91, color: 'bg-purple-500', target: 85 },
            ].map(({ label, value, color, target }) => (
              <div key={label}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-white/50 text-xs">{label}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-white text-xs font-semibold">{value}%</span>
                    <span className={`text-[10px] ${value >= target ? 'text-green-400' : 'text-yellow-400'}`}>
                      {value >= target ? '✓ meta' : `meta ${target}%`}
                    </span>
                  </div>
                </div>
                <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                  <div className={`h-full ${color} rounded-full transition-all duration-700`} style={{ width: `${value}%` }} />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-5 pt-4 border-t border-white/[0.06] flex items-center gap-2">
            <TrendingUp className="w-3.5 h-3.5 text-teal-400" />
            <p className="text-white/40 text-xs">+12% vs mês anterior · Plano Business ativo</p>
          </div>
        </div>
      </div>
    </div>
  );
}
