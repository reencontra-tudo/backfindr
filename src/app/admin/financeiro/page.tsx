'use client';

import { useState } from 'react';
import { CreditCard, TrendingUp, TrendingDown, DollarSign, Users, ArrowUpRight, ArrowDownRight, RefreshCw } from 'lucide-react';

const MRR_DATA = [
  { month: 'Out 25', mrr: 0 },
  { month: 'Nov 25', mrr: 190 },
  { month: 'Dez 25', mrr: 570 },
  { month: 'Jan 26', mrr: 1140 },
  { month: 'Fev 26', mrr: 1900 },
  { month: 'Mar 26', mrr: 2850 },
  { month: 'Abr 26', mrr: 3990 },
];

const TRANSACTIONS = [
  { id: 'sub_001', user: 'Ana Paula R.', email: 'ana@gmail.com',    plan: 'Pro',      amount: 19.90, status: 'paid',   date: '14/04/2026' },
  { id: 'sub_002', user: 'Ricardo M.',   email: 'rm@outlook.com',   plan: 'Pro',      amount: 19.90, status: 'paid',   date: '13/04/2026' },
  { id: 'sub_003', user: 'Tech Corp',    email: 'fin@techcorp.com', plan: 'Business', amount: 149.00, status: 'paid',  date: '12/04/2026' },
  { id: 'sub_004', user: 'Carlos S.',    email: 'cs@icloud.com',    plan: 'Pro',      amount: 19.90, status: 'failed', date: '11/04/2026' },
  { id: 'sub_005', user: 'Marina L.',    email: 'ml@gmail.com',     plan: 'Pro',      amount: 19.90, status: 'paid',   date: '10/04/2026' },
  { id: 'sub_006', user: 'Logística SP', email: 'ti@logsp.com.br',  plan: 'Business', amount: 149.00, status: 'paid',  date: '09/04/2026' },
];

const maxMRR = Math.max(...MRR_DATA.map(d => d.mrr));

export default function AdminFinanceiro() {
  const [period, setPeriod] = useState('30d');

  const currentMRR = MRR_DATA[MRR_DATA.length - 1].mrr;
  const prevMRR = MRR_DATA[MRR_DATA.length - 2].mrr;
  const mrrGrowth = prevMRR > 0 ? (((currentMRR - prevMRR) / prevMRR) * 100).toFixed(1) : '∞';
  const arr = currentMRR * 12;
  const proSubs = TRANSACTIONS.filter(t => t.plan === 'Pro' && t.status === 'paid').length;
  const bizSubs = TRANSACTIONS.filter(t => t.plan === 'Business' && t.status === 'paid').length;

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Financeiro</h1>
          <p className="text-white/30 text-sm mt-0.5">Receita, assinaturas e pagamentos</p>
        </div>
        <div className="flex gap-2">
          {['7d','30d','90d','12m'].map(p => (
            <button key={p} onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${period === p ? 'bg-teal-500/15 text-teal-400 border border-teal-500/30' : 'text-white/30 hover:text-white'}`}>
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'MRR',          value: `R$ ${currentMRR.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, growth: mrrGrowth, icon: DollarSign,   color: 'text-green-400 bg-green-500/10' },
          { label: 'ARR (projeção)',value: `R$ ${arr.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,       growth: null,       icon: TrendingUp,   color: 'text-teal-400 bg-teal-500/10' },
          { label: 'Assin. Pro',   value: proSubs,                                                                  growth: null,       icon: Users,        color: 'text-blue-400 bg-blue-500/10' },
          { label: 'Assin. Business', value: bizSubs,                                                               growth: null,       icon: CreditCard,   color: 'text-yellow-400 bg-yellow-500/10' },
        ].map(({ label, value, growth, icon: Icon, color }) => (
          <div key={label} className="bg-white/[0.02] border border-white/[0.07] rounded-2xl p-5">
            <div className="flex items-start justify-between mb-3">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${color}`}>
                <Icon className="w-4 h-4" />
              </div>
              {growth && (
                <div className={`flex items-center gap-0.5 text-xs font-medium ${Number(growth) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {Number(growth) >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                  {growth}%
                </div>
              )}
            </div>
            <p className="text-xl font-bold text-white">{value}</p>
            <p className="text-white/30 text-xs mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* MRR Chart */}
      <div className="bg-white/[0.02] border border-white/[0.07] rounded-2xl p-5">
        <p className="text-white font-semibold text-sm mb-6">Evolução MRR</p>
        <div className="flex items-end gap-3 h-32">
          {MRR_DATA.map(({ month, mrr }) => {
            const h = maxMRR > 0 ? (mrr / maxMRR) * 100 : 0;
            return (
              <div key={month} className="flex-1 flex flex-col items-center gap-2">
                <span className="text-white/30 text-[9px]">
                  {mrr > 0 ? `R$${(mrr/1000).toFixed(1)}k` : ''}
                </span>
                <div className="w-full relative flex items-end" style={{ height: '80px' }}>
                  <div
                    className="w-full rounded-t-lg transition-all duration-700"
                    style={{
                      height: `${Math.max(h, 4)}%`,
                      background: mrr === currentMRR
                        ? 'linear-gradient(to top, #0d9488, #14b8a6)'
                        : 'rgba(20,184,166,0.2)',
                    }}
                  />
                </div>
                <span className="text-white/20 text-[9px] text-center">{month}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Plan breakdown */}
      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-white/[0.02] border border-white/[0.07] rounded-2xl p-5">
          <p className="text-white font-semibold text-sm mb-4">Receita por plano</p>
          <div className="space-y-3">
            {[
              { plan: 'Free',     count: 0,       revenue: 0,       color: 'bg-white/20' },
              { plan: 'Pro',      count: proSubs,  revenue: proSubs * 19.90,  color: 'bg-teal-500' },
              { plan: 'Business', count: bizSubs,  revenue: bizSubs * 149.00, color: 'bg-yellow-500' },
            ].map(({ plan, count, revenue, color }) => (
              <div key={plan} className="flex items-center gap-3">
                <div className={`w-2 h-2 rounded-full ${color} flex-shrink-0`} />
                <span className="text-white/50 text-sm flex-1">{plan}</span>
                <span className="text-white/30 text-xs">{count} ass.</span>
                <span className="text-white text-sm font-medium w-20 text-right">
                  R$ {revenue.toFixed(2).replace('.', ',')}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white/[0.02] border border-white/[0.07] rounded-2xl p-5">
          <p className="text-white font-semibold text-sm mb-4">Churn & Saúde</p>
          <div className="space-y-3">
            {[
              { label: 'Taxa de churn',     value: '2.1%',  good: true },
              { label: 'LTV médio (Pro)',   value: 'R$ 285', good: true },
              { label: 'CAC estimado',      value: 'R$ 0',  good: true },
              { label: 'Payback period',    value: '0 dias', good: true },
              { label: 'Falhas pagamento',  value: '1',     good: false },
            ].map(({ label, value, good }) => (
              <div key={label} className="flex items-center justify-between">
                <span className="text-white/40 text-sm">{label}</span>
                <span className={`text-sm font-medium ${good ? 'text-green-400' : 'text-red-400'}`}>{value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Transactions */}
      <div className="bg-white/[0.02] border border-white/[0.07] rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
          <p className="text-white font-semibold text-sm">Transações recentes</p>
          <button className="text-white/30 hover:text-white transition-colors">
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/[0.04]">
              {['Usuário', 'Plano', 'Valor', 'Status', 'Data'].map(h => (
                <th key={h} className="px-4 py-3 text-left text-[10px] uppercase tracking-wider text-white/20">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {TRANSACTIONS.map(t => (
              <tr key={t.id} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                <td className="px-4 py-3">
                  <p className="text-white text-sm">{t.user}</p>
                  <p className="text-white/30 text-xs">{t.email}</p>
                </td>
                <td className="px-4 py-3">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${t.plan === 'Business' ? 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20' : 'text-teal-400 bg-teal-500/10 border-teal-500/20'}`}>
                    {t.plan}
                  </span>
                </td>
                <td className="px-4 py-3 text-white text-sm font-medium">
                  R$ {t.amount.toFixed(2).replace('.', ',')}
                </td>
                <td className="px-4 py-3">
                  <span className={`text-xs font-medium ${t.status === 'paid' ? 'text-green-400' : 'text-red-400'}`}>
                    {t.status === 'paid' ? '✓ Pago' : '✕ Falhou'}
                  </span>
                </td>
                <td className="px-4 py-3 text-white/30 text-xs">{t.date}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
