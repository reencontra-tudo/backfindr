'use client';

import { useState } from 'react';
import { Mail, Send, Users, CheckCircle2, XCircle, Clock, Eye, RefreshCw, Play } from 'lucide-react';

const CAMPAIGNS = [
  { id: '1', name: 'Reativação Webjetos — Lote 1',  status: 'sent',     sent: 1240, opened: 487,  clicked: 203, date: '10/04/2026' },
  { id: '2', name: 'Reativação Webjetos — Lote 2',  status: 'sent',     sent: 1100, opened: 412,  clicked: 178, date: '11/04/2026' },
  { id: '3', name: 'Reativação Webjetos — Lote 3',  status: 'sending',  sent: 643,  opened: 0,    clicked: 0,   date: '14/04/2026' },
  { id: '4', name: 'Welcome — Novos usuários',       status: 'active',   sent: 89,   opened: 71,   clicked: 52,  date: 'automático' },
  { id: '5', name: 'Match encontrado',               status: 'active',   sent: 34,   opened: 32,   clicked: 28,  date: 'automático' },
  { id: '6', name: 'QR Code escaneado',              status: 'active',   sent: 156,  opened: 143,  clicked: 138, date: 'automático' },
  { id: '7', name: 'Reativação Webjetos — Lote 4',  status: 'scheduled',sent: 0,    opened: 0,    clicked: 0,   date: '16/04/2026' },
];

const STATUS_STYLE: Record<string, string> = {
  sent:      'text-green-400 bg-green-500/10 border-green-500/20',
  sending:   'text-teal-400 bg-teal-500/10 border-teal-500/20',
  active:    'text-blue-400 bg-blue-500/10 border-blue-500/20',
  scheduled: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20',
  draft:     'text-white/30 bg-white/[0.04] border-white/[0.08]',
};
const STATUS_LABEL: Record<string, string> = {
  sent: 'Enviado', sending: 'Enviando', active: 'Automático', scheduled: 'Agendado', draft: 'Rascunho',
};

function Rate({ value, total, color }: { value: number; total: number; color: string }) {
  const pct = total > 0 ? ((value / total) * 100).toFixed(0) : '—';
  return (
    <div className="text-center">
      <p className={`text-sm font-bold ${color}`}>{pct}{total > 0 ? '%' : ''}</p>
      <p className="text-white/20 text-[10px]">{value.toLocaleString('pt-BR')}</p>
    </div>
  );
}

export default function AdminEmails() {
  const [tab, setTab] = useState('campaigns');

  const totalSent    = CAMPAIGNS.reduce((a, c) => a + c.sent, 0);
  const totalOpened  = CAMPAIGNS.reduce((a, c) => a + c.opened, 0);
  const totalClicked = CAMPAIGNS.reduce((a, c) => a + c.clicked, 0);
  const avgOpen  = totalSent > 0 ? ((totalOpened / totalSent) * 100).toFixed(1) : '0';
  const avgClick = totalSent > 0 ? ((totalClicked / totalSent) * 100).toFixed(1) : '0';

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">E-mails</h1>
          <p className="text-white/30 text-sm mt-0.5">Campanhas, automações e transacionais</p>
        </div>
        <button className="flex items-center gap-2 bg-teal-500 hover:bg-teal-400 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-all"
          style={{ boxShadow: '0 0 0 1px rgba(20,184,166,0.4)' }}>
          <Send className="w-4 h-4" /> Nova campanha
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Total enviados', value: totalSent.toLocaleString('pt-BR'),  icon: Send,         color: 'text-white/60 bg-white/[0.06]' },
          { label: 'Taxa de abertura', value: `${avgOpen}%`,                    icon: Eye,          color: 'text-teal-400 bg-teal-500/10' },
          { label: 'Taxa de clique',  value: `${avgClick}%`,                    icon: CheckCircle2, color: 'text-green-400 bg-green-500/10' },
          { label: 'Automações ativas', value: CAMPAIGNS.filter(c => c.status === 'active').length, icon: RefreshCw, color: 'text-blue-400 bg-blue-500/10' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-white/[0.02] border border-white/[0.07] rounded-2xl p-4">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-3 ${color}`}>
              <Icon className="w-4 h-4" />
            </div>
            <p className="text-xl font-bold text-white">{value}</p>
            <p className="text-white/30 text-xs mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {[
          { value: 'campaigns', label: 'Campanhas' },
          { value: 'webjetos',  label: 'Webjetos' },
          { value: 'auto',      label: 'Automações' },
        ].map(t => (
          <button key={t.value} onClick={() => setTab(t.value)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${tab === t.value ? 'bg-teal-500/15 text-teal-400 border border-teal-500/30' : 'text-white/40 hover:text-white'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Campaigns table */}
      <div className="bg-white/[0.02] border border-white/[0.07] rounded-2xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/[0.06]">
              <th className="px-4 py-3 text-left text-[10px] uppercase tracking-wider text-white/20">Campanha</th>
              <th className="px-4 py-3 text-left text-[10px] uppercase tracking-wider text-white/20">Status</th>
              <th className="px-4 py-3 text-center text-[10px] uppercase tracking-wider text-white/20 hidden md:table-cell">Enviados</th>
              <th className="px-4 py-3 text-center text-[10px] uppercase tracking-wider text-white/20 hidden md:table-cell">Abertos</th>
              <th className="px-4 py-3 text-center text-[10px] uppercase tracking-wider text-white/20 hidden md:table-cell">Cliques</th>
              <th className="px-4 py-3 text-left text-[10px] uppercase tracking-wider text-white/20 hidden lg:table-cell">Data</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {CAMPAIGNS.map(c => (
              <tr key={c.id} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                <td className="px-4 py-3">
                  <p className="text-white text-sm">{c.name}</p>
                </td>
                <td className="px-4 py-3">
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${STATUS_STYLE[c.status]}`}>
                    {STATUS_LABEL[c.status]}
                  </span>
                </td>
                <td className="px-4 py-3 hidden md:table-cell text-center text-white/50 text-sm">{c.sent.toLocaleString('pt-BR')}</td>
                <td className="px-4 py-3 hidden md:table-cell">
                  <Rate value={c.opened} total={c.sent} color="text-teal-400" />
                </td>
                <td className="px-4 py-3 hidden md:table-cell">
                  <Rate value={c.clicked} total={c.sent} color="text-green-400" />
                </td>
                <td className="px-4 py-3 hidden lg:table-cell text-white/30 text-xs">{c.date}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1">
                    {c.status === 'scheduled' && (
                      <button className="w-7 h-7 flex items-center justify-center text-teal-400 hover:bg-teal-500/10 rounded-lg transition-all">
                        <Play className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button className="w-7 h-7 flex items-center justify-center text-white/20 hover:text-white hover:bg-white/[0.06] rounded-lg transition-all">
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Webjetos status */}
      {tab === 'webjetos' && (
        <div className="bg-teal-500/[0.04] border border-teal-500/20 rounded-2xl p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 rounded-xl bg-teal-500/20 flex items-center justify-center">
              <Mail className="w-4 h-4 text-teal-400" />
            </div>
            <div>
              <p className="text-white font-semibold text-sm">Campanha de Reativação Webjetos</p>
              <p className="text-white/40 text-xs">3 lotes enviados · 1 agendado</p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3 mb-4">
            {[
              { label: 'Base total',    value: '3.983', color: 'text-white' },
              { label: 'Enviados',      value: '2.983', color: 'text-teal-400' },
              { label: 'Pendentes',     value: '1.000', color: 'text-yellow-400' },
            ].map(s => (
              <div key={s.label} className="text-center">
                <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
                <p className="text-white/30 text-xs">{s.label}</p>
              </div>
            ))}
          </div>
          <div className="w-full h-2 bg-white/[0.06] rounded-full overflow-hidden">
            <div className="h-full bg-teal-500 rounded-full" style={{ width: '74.9%' }} />
          </div>
          <p className="text-white/20 text-xs mt-2 text-right">74.9% concluído</p>
          <button className="mt-4 w-full flex items-center justify-center gap-2 bg-teal-500 hover:bg-teal-400 text-white text-sm font-semibold py-2.5 rounded-xl transition-all">
            <Send className="w-4 h-4" /> Disparar lote 4 (1.000 e-mails)
          </button>
        </div>
      )}
    </div>
  );
}
