'use client';

import { useState, useEffect, useCallback } from 'react';
import { CreditCard, TrendingUp, DollarSign, Users, ArrowUpRight, ArrowDownRight, RefreshCw, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';

interface Transaction {
  id: string;
  user: string;
  email: string;
  plan: string;
  amount: number;
  status: string;
  provider: string;
  date: string;
}

interface MrrPoint {
  month: string;
  value: number;
}

interface FinanceiroData {
  mrr: number;
  arr: number;
  pro_subscribers: number;
  business_subscribers: number;
  total_subscribers: number;
  boost_revenue_30d: number;
  total_boosts_30d: number;
  churn_rate: number;
  ltv_pro: number;
  ltv_business: number;
  total_users: number;
  total_objects: number;
  mrr_history: MrrPoint[];
  transactions: Transaction[];
}

export default function AdminFinanceiro() {
  const [data, setData] = useState<FinanceiroData | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('30d');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: res } = await api.get('/admin/financeiro');
      setData(res);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return (
    <div className="p-6 flex items-center justify-center min-h-[60vh]">
      <Loader2 className="w-8 h-8 text-teal-500 animate-spin" />
    </div>
  );

  const mrr        = data?.mrr ?? 0;
  const arr        = data?.arr ?? 0;
  const proSubs    = data?.pro_subscribers ?? 0;
  const bizSubs    = data?.business_subscribers ?? 0;
  const mrrHistory = data?.mrr_history ?? [];
  const transactions = data?.transactions ?? [];
  const maxMRR     = mrrHistory.length > 0 ? Math.max(...mrrHistory.map(d => d.value), 1) : 1;

  // Crescimento MRR: compara último vs penúltimo mês
  const lastMrr = mrrHistory[mrrHistory.length - 1]?.value ?? 0;
  const prevMrr = mrrHistory[mrrHistory.length - 2]?.value ?? 0;
  const mrrGrowth = prevMrr > 0 ? (((lastMrr - prevMrr) / prevMrr) * 100).toFixed(1) : null;

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Financeiro</h1>
          <p className="text-white/30 text-sm mt-0.5">Receita, assinaturas e pagamentos</p>
        </div>
        <div className="flex items-center gap-2">
          {['7d','30d','90d','12m'].map(p => (
            <button key={p} onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${period === p ? 'bg-teal-500/15 text-teal-400 border border-teal-500/30' : 'text-white/30 hover:text-white'}`}>
              {p}
            </button>
          ))}
          <button onClick={load} className="w-9 h-9 flex items-center justify-center text-white/30 hover:text-white rounded-xl border border-white/[0.07] hover:bg-white/[0.04] transition-all">
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          {
            label: 'MRR',
            value: `R$ ${mrr.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
            growth: mrrGrowth,
            icon: DollarSign,
            color: 'text-green-400 bg-green-500/10',
          },
          {
            label: 'ARR (projeção)',
            value: `R$ ${arr.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
            growth: null,
            icon: TrendingUp,
            color: 'text-teal-400 bg-teal-500/10',
          },
          {
            label: 'Assin. Pro',
            value: proSubs,
            growth: null,
            icon: Users,
            color: 'text-blue-400 bg-blue-500/10',
          },
          {
            label: 'Assin. Business',
            value: bizSubs,
            growth: null,
            icon: CreditCard,
            color: 'text-yellow-400 bg-yellow-500/10',
          },
        ].map(({ label, value, growth, icon: Icon, color }) => (
          <div key={label} className="bg-white/[0.02] border border-white/[0.07] rounded-2xl p-5">
            <div className="flex items-start justify-between mb-3">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${color}`}>
                <Icon className="w-4 h-4" />
              </div>
              {growth !== null && (
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
        {mrrHistory.length === 0 ? (
          <div className="h-32 flex items-center justify-center text-white/20 text-sm">
            Sem histórico de receita ainda
          </div>
        ) : (
          <div className="flex items-end gap-3 h-32">
            {mrrHistory.map(({ month, value }) => {
              const h = maxMRR > 0 ? (value / maxMRR) * 100 : 0;
              return (
                <div key={month} className="flex-1 flex flex-col items-center gap-2">
                  <span className="text-white/30 text-[9px]">
                    {value > 0 ? `R$${(value / 1000).toFixed(1)}k` : ''}
                  </span>
                  <div className="w-full relative flex items-end" style={{ height: '80px' }}>
                    <div
                      className="w-full rounded-t-lg transition-all duration-700"
                      style={{
                        height: `${Math.max(h, 4)}%`,
                        background: value === lastMrr
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
        )}
      </div>

      {/* Plan breakdown + Churn */}
      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-white/[0.02] border border-white/[0.07] rounded-2xl p-5">
          <p className="text-white font-semibold text-sm mb-4">Receita por plano</p>
          <div className="space-y-3">
            {[
              { plan: 'Free',     count: (data?.total_users ?? 0) - proSubs - bizSubs, revenue: 0,                color: 'bg-white/20' },
              { plan: 'Pro',      count: proSubs,                                       revenue: proSubs * 29.00,  color: 'bg-teal-500' },
              { plan: 'Business', count: bizSubs,                                       revenue: bizSubs * 149.00, color: 'bg-yellow-500' },
            ].map(({ plan, count, revenue, color }) => (
              <div key={plan} className="flex items-center gap-3">
                <div className={`w-2 h-2 rounded-full ${color} flex-shrink-0`} />
                <span className="text-white/50 text-sm flex-1">{plan}</span>
                <span className="text-white/30 text-xs">{Math.max(0, count)} usu.</span>
                <span className="text-white text-sm font-medium w-24 text-right">
                  {revenue > 0 ? `R$ ${revenue.toFixed(2).replace('.', ',')}` : '—'}
                </span>
              </div>
            ))}
            {(data?.boost_revenue_30d ?? 0) > 0 && (
              <div className="flex items-center gap-3 pt-2 border-t border-white/[0.06]">
                <div className="w-2 h-2 rounded-full bg-orange-400 flex-shrink-0" />
                <span className="text-white/50 text-sm flex-1">Boosts (30d)</span>
                <span className="text-white/30 text-xs">{data?.total_boosts_30d ?? 0} ativ.</span>
                <span className="text-white text-sm font-medium w-24 text-right">
                  R$ {(data?.boost_revenue_30d ?? 0).toFixed(2).replace('.', ',')}
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white/[0.02] border border-white/[0.07] rounded-2xl p-5">
          <p className="text-white font-semibold text-sm mb-4">Churn &amp; Saúde</p>
          <div className="space-y-3">
            {[
              { label: 'Taxa de churn',    value: `${data?.churn_rate ?? 0}%`,                                                              good: (data?.churn_rate ?? 0) < 5 },
              { label: 'LTV médio (Pro)',  value: data?.ltv_pro ? `R$ ${data.ltv_pro.toFixed(0)}` : '—',                                    good: true },
              { label: 'LTV (Business)',   value: data?.ltv_business ? `R$ ${data.ltv_business.toFixed(0)}` : '—',                          good: true },
              { label: 'Total usuários',   value: (data?.total_users ?? 0).toLocaleString('pt-BR'),                                          good: true },
              { label: 'Total objetos',    value: (data?.total_objects ?? 0).toLocaleString('pt-BR'),                                        good: true },
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
          <button onClick={load} className="text-white/30 hover:text-white transition-colors">
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
        {transactions.length === 0 ? (
          <div className="py-12 text-center text-white/20 text-sm">
            Nenhuma transação registrada ainda
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/[0.04]">
                  {['Usuário', 'Plano', 'Valor', 'Status', 'Via', 'Data'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-[10px] uppercase tracking-wider text-white/20">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {transactions.map(t => (
                  <tr key={t.id} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                    <td className="px-4 py-3">
                      <p className="text-white text-sm">{t.user}</p>
                      <p className="text-white/30 text-xs">{t.email}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${
                        t.plan === 'Business' || t.plan === 'business'
                          ? 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20'
                          : 'text-teal-400 bg-teal-500/10 border-teal-500/20'
                      }`}>
                        {t.plan}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-white text-sm font-medium">
                      R$ {Number(t.amount).toFixed(2).replace('.', ',')}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-medium ${t.status === 'paid' || t.status === 'active' ? 'text-green-400' : 'text-red-400'}`}>
                        {t.status === 'paid' || t.status === 'active' ? '✓ Pago' : '✕ Falhou'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-white/30 text-xs capitalize">{t.provider ?? '—'}</td>
                    <td className="px-4 py-3 text-white/30 text-xs">{t.date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
