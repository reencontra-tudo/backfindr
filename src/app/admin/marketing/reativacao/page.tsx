'use client';
export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { Mail, Users, Send, CheckCircle2, ArrowRight, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { api } from '@/lib/api';

interface Stats {
  total_users: number;
  resend_connected: boolean;
}

interface Campaign {
  id: string;
  type: string;
  subject: string;
  status: string;
  sent_count: number;
  failed_count: number;
  created_at: string;
  sent_at?: string;
}

export default function MarketingReativacaoPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api('/api/v1/admin/emails/stats').then(r => r.data as Stats).catch(() => null),
      api('/api/v1/admin/emails').then(r => r.data as { campaigns: Campaign[] }).catch(() => ({ campaigns: [] as Campaign[] })),
    ]).then(([s, c]) => {
      if (s) setStats(s);
      if (c?.campaigns) {
        setCampaigns(c.campaigns.filter((camp: Campaign) => camp.type === 'webjetos_reativacao'));
      }
    }).finally(() => setLoading(false));
  }, []);

  const totalEnviados = campaigns.reduce((acc, c) => acc + (c.sent_count || 0), 0);
  const ultimaCampanha = campaigns[0];

  return (
    <div className="p-6 md:p-8 max-w-3xl mx-auto">

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white tracking-tight">Reativação Webjetos</h1>
        <p className="text-white/40 text-sm mt-1">
          Campanha de reativação para a base de usuários legados do Webjetos
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-8">
        {[
          {
            icon: Users,
            label: 'Usuários elegíveis',
            value: loading ? '—' : stats?.total_users?.toLocaleString('pt-BR') ?? '—',
            color: 'text-blue-400',
          },
          {
            icon: Send,
            label: 'E-mails enviados',
            value: loading ? '—' : totalEnviados.toLocaleString('pt-BR'),
            color: 'text-teal-400',
          },
          {
            icon: CheckCircle2,
            label: 'Campanhas realizadas',
            value: loading ? '—' : campaigns.length.toString(),
            color: 'text-green-400',
          },
        ].map(({ icon: Icon, label, value, color }) => (
          <div key={label} className="flex flex-col gap-2 p-4 bg-white/[0.03] border border-white/[0.06] rounded-xl">
            <Icon className={`w-4 h-4 ${color}`} />
            <p className="text-2xl font-bold text-white">{value}</p>
            <p className="text-white/30 text-xs">{label}</p>
          </div>
        ))}
      </div>

      {/* Última campanha */}
      {ultimaCampanha && (
        <div className="mb-6 p-4 bg-white/[0.03] border border-white/[0.06] rounded-xl">
          <p className="text-white/30 text-xs font-mono uppercase tracking-wider mb-3">Última campanha</p>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white/70 text-sm font-medium">{ultimaCampanha.subject}</p>
              <p className="text-white/25 text-xs mt-0.5">
                {ultimaCampanha.sent_count} enviados · {ultimaCampanha.failed_count} falhas
              </p>
            </div>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${
              ultimaCampanha.status === 'sent' ? 'text-green-400 bg-green-500/10 border-green-500/20' :
              ultimaCampanha.status === 'sending' ? 'text-teal-400 bg-teal-500/10 border-teal-500/20' :
              'text-white/30 bg-white/[0.04] border-white/[0.08]'
            }`}>
              {ultimaCampanha.status === 'sent' ? 'Enviado' : ultimaCampanha.status === 'sending' ? 'Enviando' : ultimaCampanha.status}
            </span>
          </div>
        </div>
      )}

      {/* CTA para gerenciar */}
      <Link
        href="/admin/emails"
        className="group flex items-center justify-between w-full p-5 bg-gradient-to-br from-teal-500/10 to-teal-600/5 border border-teal-500/20 rounded-2xl hover:border-teal-500/40 transition-all"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-teal-500/10 flex items-center justify-center">
            <Mail className="w-5 h-5 text-teal-400" />
          </div>
          <div>
            <p className="text-white font-semibold text-sm">Gerenciar campanhas</p>
            <p className="text-white/35 text-xs mt-0.5">Criar e enviar e-mails de reativação</p>
          </div>
        </div>
        <ArrowRight className="w-4 h-4 text-white/20 group-hover:text-teal-400 transition-colors" />
      </Link>

    </div>
  );
}
