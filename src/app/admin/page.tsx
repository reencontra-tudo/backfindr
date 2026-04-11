'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Zap, RefreshCw, Package, Users, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';
import { api, parseApiError } from '@/lib/api';
import { useAuthStore } from '@/hooks/useAuth';

interface AdminStats {
  total_users: number;
  total_objects: number;
  lost_objects: number;
  found_objects: number;
  returned_objects: number;
  pending_matches: number;
  confirmed_matches: number;
}

export default function AdminPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [runningMatch, setRunningMatch] = useState(false);

  useEffect(() => {
    // Proteção básica — em produção use middleware com role check
    if (user && user.plan !== 'pro') {
      router.replace('/dashboard');
      return;
    }
    loadStats();
  }, [user]);

  const loadStats = async () => {
    try {
      const { data } = await api.get('/admin/stats');
      setStats(data);
    } catch {
      // Fallback com zeros se endpoint não existir ainda
      setStats({
        total_users: 0, total_objects: 0, lost_objects: 0,
        found_objects: 0, returned_objects: 0,
        pending_matches: 0, confirmed_matches: 0,
      });
    } finally {
      setLoading(false);
    }
  };

  const runFullMatching = async () => {
    setRunningMatch(true);
    try {
      await api.post('/matching/run-all');
      toast.success('Matching completo iniciado em background!');
      setTimeout(loadStats, 3000);
    } catch (e) {
      toast.error(parseApiError(e));
    } finally {
      setRunningMatch(false);
    }
  };

  const statCards = stats ? [
    { icon: <Users className="w-4 h-4 text-white/50" />, label: 'Usuários', value: stats.total_users, color: 'bg-white/[0.06]' },
    { icon: <Package className="w-4 h-4 text-teal-400" />, label: 'Objetos', value: stats.total_objects, color: 'bg-teal-500/10' },
    { icon: <AlertTriangle className="w-4 h-4 text-red-400" />, label: 'Perdidos', value: stats.lost_objects, color: 'bg-red-500/10' },
    { icon: <Package className="w-4 h-4 text-teal-400" />, label: 'Achados', value: stats.found_objects, color: 'bg-teal-500/10' },
    { icon: <CheckCircle2 className="w-4 h-4 text-green-400" />, label: 'Recuperados', value: stats.returned_objects, color: 'bg-green-500/10' },
    { icon: <Zap className="w-4 h-4 text-yellow-400" />, label: 'Matches pendentes', value: stats.pending_matches, color: 'bg-yellow-500/10' },
    { icon: <CheckCircle2 className="w-4 h-4 text-teal-400" />, label: 'Matches confirmados', value: stats.confirmed_matches, color: 'bg-teal-500/10' },
  ] : [];

  return (
    <div className="min-h-screen bg-[#080b0f] text-white p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Admin Panel</h1>
            <p className="text-white/40 text-sm mt-0.5">Backfindr — controle interno</p>
          </div>
          <button
            onClick={runFullMatching}
            disabled={runningMatch}
            className="flex items-center gap-2 bg-teal-500 hover:bg-teal-400 disabled:opacity-60 text-white text-sm font-semibold px-4 py-2.5 rounded-lg transition-all"
            style={{ boxShadow: '0 0 0 1px rgba(20,184,166,0.4)' }}
          >
            {runningMatch
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <Zap className="w-4 h-4" />
            }
            Rodar matching completo
          </button>
        </div>

        {/* Stats grid */}
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[1,2,3,4].map(i => <div key={i} className="h-24 bg-white/[0.03] rounded-xl animate-pulse" />)}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
            {statCards.map(s => (
              <div key={s.label} className="bg-white/[0.03] border border-white/[0.07] rounded-xl p-4">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-3 ${s.color}`}>
                  {s.icon}
                </div>
                <p className="text-2xl font-bold text-white">{s.value}</p>
                <p className="text-white/40 text-xs mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Actions */}
        <div className="grid md:grid-cols-2 gap-4">
          <div className="bg-white/[0.02] border border-white/[0.07] rounded-xl p-5">
            <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
              <RefreshCw className="w-4 h-4 text-teal-400" /> Ações de matching
            </h3>
            <div className="space-y-2">
              <button onClick={runFullMatching} disabled={runningMatch}
                className="w-full text-left text-sm text-white/60 hover:text-white px-3 py-2 rounded-lg hover:bg-white/[0.04] transition-all">
                🔄 Rodar matching em todos os objetos
              </button>
              <button onClick={() => { api.post('/matching/run-all'); toast.success('Iniciado'); }}
                className="w-full text-left text-sm text-white/60 hover:text-white px-3 py-2 rounded-lg hover:bg-white/[0.04] transition-all">
                ⚡ Re-processar matches rejeitados
              </button>
            </div>
          </div>

          <div className="bg-white/[0.02] border border-white/[0.07] rounded-xl p-5">
            <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
              <Package className="w-4 h-4 text-teal-400" /> Links úteis
            </h3>
            <div className="space-y-2">
              {[
                { label: '📊 API Docs', href: `${process.env.NEXT_PUBLIC_API_URL ?? ''}/docs` },
                { label: '🗺️ Mapa público', href: '/map' },
                { label: '🏠 Dashboard', href: '/dashboard' },
              ].map(l => (
                <a key={l.label} href={l.href} target="_blank"
                  className="flex text-sm text-white/60 hover:text-teal-400 px-3 py-2 rounded-lg hover:bg-white/[0.04] transition-all">
                  {l.label}
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
