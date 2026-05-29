'use client';
export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Users, Zap, Mail, TrendingUp, ArrowRight,
  Activity, Target, CheckCircle2, Clock
} from 'lucide-react';

interface MarketingStats {
  total_leads: number;
  leads_quentes: number;
  convertidos: number;
  taxa_conversao: number;
  emails_enviados: number;
  workflows_ativos: number;
}

export default function MarketingPage() {
  const [stats, setStats] = useState<MarketingStats | null>(null);
  const [rastrearOnline, setRastrearOnline] = useState<boolean | null>(null);
  const [n8nOnline, setN8nOnline] = useState<boolean | null>(null);

  useEffect(() => {
    // Verifica se rastrear está online
    fetch('http://localhost:3002/api/health')
      .then(() => setRastrearOnline(true))
      .catch(() => setRastrearOnline(false));

    // Verifica se n8n está online
    fetch('http://localhost:5678/healthz')
      .then(() => setN8nOnline(true))
      .catch(() => setN8nOnline(false));
  }, []);

  const cards = [
    {
      href: '/admin/marketing/leads',
      icon: Users,
      label: 'Leads',
      desc: 'Fila de captura multi-redes',
      color: 'from-blue-500/20 to-blue-600/10 border-blue-500/20',
      iconColor: 'text-blue-400',
      stat: stats ? `${stats.total_leads} leads` : '—',
    },
    {
      href: '/admin/marketing/automacao',
      icon: Zap,
      label: 'Automação',
      desc: 'Workflows n8n e Apify',
      color: 'from-purple-500/20 to-purple-600/10 border-purple-500/20',
      iconColor: 'text-purple-400',
      stat: stats ? `${stats.workflows_ativos} workflows` : '—',
    },
    {
      href: '/admin/marketing/reativacao',
      icon: Mail,
      label: 'Reativação Webjetos',
      desc: 'Campanha base de usuários legados',
      color: 'from-teal-500/20 to-teal-600/10 border-teal-500/20',
      iconColor: 'text-teal-400',
      stat: stats ? `${stats.emails_enviados} enviados` : '—',
    },
    {
      href: '/admin/social-posts',
      icon: Activity,
      label: 'Social Auto',
      desc: 'Publicações automáticas',
      color: 'from-orange-500/20 to-orange-600/10 border-orange-500/20',
      iconColor: 'text-orange-400',
      stat: '→ Social Posts',
    },
  ];

  const StatusDot = ({ online }: { online: boolean | null }) => (
    <span className={`inline-block w-2 h-2 rounded-full ${
      online === null ? 'bg-white/20 animate-pulse' :
      online ? 'bg-green-400' : 'bg-red-400'
    }`} />
  );

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto">

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white tracking-tight">Marketing</h1>
        <p className="text-white/40 text-sm mt-1">Captura, automação e reativação de usuários</p>
      </div>

      {/* Status dos serviços */}
      <div className="flex items-center gap-6 mb-8 px-4 py-3 bg-white/[0.03] border border-white/[0.06] rounded-xl">
        <span className="text-white/30 text-xs font-mono uppercase tracking-wider">Serviços</span>
        <div className="flex items-center gap-2">
          <StatusDot online={rastrearOnline} />
          <span className="text-white/50 text-xs">Rastrear <span className="text-white/20">:3002</span></span>
        </div>
        <div className="flex items-center gap-2">
          <StatusDot online={n8nOnline} />
          <span className="text-white/50 text-xs">n8n <span className="text-white/20">:5678</span></span>
        </div>
      </div>

      {/* Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {cards.map(({ href, icon: Icon, label, desc, color, iconColor, stat }) => (
          <Link
            key={href}
            href={href}
            className={`group flex flex-col gap-4 p-5 rounded-2xl bg-gradient-to-br border transition-all hover:scale-[1.01] hover:border-white/20 ${color}`}
          >
            <div className="flex items-start justify-between">
              <div className={`w-10 h-10 rounded-xl bg-white/[0.06] flex items-center justify-center ${iconColor}`}>
                <Icon className="w-5 h-5" />
              </div>
              <ArrowRight className="w-4 h-4 text-white/15 group-hover:text-white/40 transition-colors" />
            </div>
            <div>
              <p className="text-white font-semibold text-sm">{label}</p>
              <p className="text-white/35 text-xs mt-0.5">{desc}</p>
            </div>
            <div className="text-white/25 text-xs font-mono">{stat}</div>
          </Link>
        ))}
      </div>

    </div>
  );
}
