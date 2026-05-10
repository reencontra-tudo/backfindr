'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/hooks/useAuth';
import {
  Building2, Package, Users, TrendingUp, LogOut,
  MapPin, Phone, Mail, ExternalLink, Activity
} from 'lucide-react';

interface B2BStats {
  partner_name: string;
  partner_type: string;
  partner_city: string;
  partner_status: string;
  total_objects: number;
  lost_objects: number;
  found_objects: number;
  returned_objects: number;
  total_users: number;
  recovery_rate: number;
}

interface B2BObject {
  id: string;
  title: string;
  status: string;
  category: string;
  created_at: string;
  owner_name: string;
}

const STATUS_COLORS: Record<string, string> = {
  lost: 'text-red-400 bg-red-500/10 border-red-500/20',
  found: 'text-teal-400 bg-teal-500/10 border-teal-500/20',
  returned: 'text-green-400 bg-green-500/10 border-green-500/20',
  stolen: 'text-orange-400 bg-orange-500/10 border-orange-500/20',
};

const STATUS_LABELS: Record<string, string> = {
  lost: 'Perdido', found: 'Achado', returned: 'Recuperado', stolen: 'Roubado',
};

export default function B2BPortalPage() {
  const router = useRouter();
  const { user, logout, fetchMe } = useAuthStore();
  const [stats, setStats] = useState<B2BStats | null>(null);
  const [objects, setObjects] = useState<B2BObject[]>([]);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(true);

  // Verificação de autenticação e role
  useEffect(() => {
    const check = async () => {
      if (!user) {
        await fetchMe().catch(() => {});
      }
      setChecking(false);
    };
    check();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (checking) return;
    if (!user) {
      router.replace('/auth/login?redirect=/admin/b2b-portal');
      return;
    }
    if (user.role !== 'b2b_admin') {
      if (user.role === 'super_admin') {
        router.replace('/admin/dashboard');
      } else {
        router.replace('/dashboard');
      }
    }
  }, [checking, user, router]);

  // Buscar dados do parceiro
  useEffect(() => {
    if (!user?.b2b_partner_id) return;
    setLoading(true);
    Promise.all([
      fetch(`/api/v1/admin/b2b/${user.b2b_partner_id}/stats`).then(r => r.json()),
      fetch(`/api/v1/admin/b2b/${user.b2b_partner_id}/objects`).then(r => r.json()),
    ])
      .then(([s, o]) => {
        setStats(s);
        setObjects(o.items ?? []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user]);

  if (checking || loading) {
    return (
      <div className="min-h-screen bg-[#050810] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-teal-500/30 border-t-teal-400 rounded-full animate-spin" />
          <p className="text-white/30 text-sm">Carregando portal...</p>
        </div>
      </div>
    );
  }

  if (!user || user.role !== 'b2b_admin') return null;

  return (
    <div className="min-h-screen bg-[#050810] text-white">
      {/* Header */}
      <header className="border-b border-white/[0.05] bg-[#060a12] px-4 md:px-8 flex items-center justify-between" style={{ height: '56px' }}>
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-teal-400 to-teal-600 flex items-center justify-center">
            <Activity className="w-3.5 h-3.5 text-white" strokeWidth={2.5} />
          </div>
          <div>
            <span className="text-white font-bold text-sm">Backfindr</span>
            <span className="text-teal-400/60 text-[9px] font-mono uppercase tracking-widest ml-2">Portal B2B</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-white/40 text-xs hidden sm:block">{user.name}</span>
          <button
            onClick={() => logout().then(() => router.push('/auth/login'))}
            className="flex items-center gap-1.5 text-white/30 hover:text-red-400 text-xs transition-colors">
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:block">Sair</span>
          </button>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 md:px-8 py-8 space-y-8">
        {/* Parceiro info */}
        {stats && (
          <div className="bg-[#0a0f1a] border border-white/[0.06] rounded-2xl p-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center flex-shrink-0">
                <Building2 className="w-6 h-6 text-teal-400" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-white font-bold text-xl">{stats.partner_name}</h1>
                  <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${
                    stats.partner_status === 'ativo'
                      ? 'text-green-400 bg-green-500/10 border-green-500/20'
                      : 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20'
                  }`}>{stats.partner_status}</span>
                </div>
                <div className="flex items-center gap-4 mt-1 text-white/40 text-sm flex-wrap">
                  <span className="flex items-center gap-1"><Building2 className="w-3.5 h-3.5" />{stats.partner_type}</span>
                  {stats.partner_city && <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{stats.partner_city}</span>}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* KPIs */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Total de Objetos', value: stats.total_objects, icon: Package, color: 'teal' },
              { label: 'Perdidos', value: stats.lost_objects, icon: Package, color: 'red' },
              { label: 'Achados', value: stats.found_objects, icon: Package, color: 'yellow' },
              { label: 'Recuperados', value: stats.returned_objects, icon: TrendingUp, color: 'green' },
            ].map(({ label, value, icon: Icon, color }) => (
              <div key={label} className="bg-[#0a0f1a] border border-white/[0.06] rounded-xl p-4">
                <div className={`w-8 h-8 rounded-lg bg-${color}-500/10 border border-${color}-500/20 flex items-center justify-center mb-3`}>
                  <Icon className={`w-4 h-4 text-${color}-400`} />
                </div>
                <p className="text-white font-bold text-2xl">{value}</p>
                <p className="text-white/40 text-xs mt-0.5">{label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Taxa de recuperação */}
        {stats && (
          <div className="bg-[#0a0f1a] border border-white/[0.06] rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-white/60 text-sm font-medium">Taxa de Recuperação</p>
              <span className="text-green-400 font-bold text-lg">{stats.recovery_rate}%</span>
            </div>
            <div className="h-2 bg-white/[0.05] rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-teal-500 to-green-500 rounded-full transition-all duration-700"
                style={{ width: `${Math.min(stats.recovery_rate, 100)}%` }}
              />
            </div>
          </div>
        )}

        {/* Objetos recentes */}
        <div>
          <h2 className="text-white font-semibold text-base mb-4 flex items-center gap-2">
            <Package className="w-4 h-4 text-teal-400" />
            Objetos do Parceiro
          </h2>
          {objects.length === 0 ? (
            <div className="bg-[#0a0f1a] border border-white/[0.06] rounded-xl p-8 text-center">
              <Package className="w-8 h-8 text-white/10 mx-auto mb-2" />
              <p className="text-white/30 text-sm">Nenhum objeto registrado ainda</p>
            </div>
          ) : (
            <div className="space-y-2">
              {objects.map(obj => (
                <div key={obj.id} className="bg-[#0a0f1a] border border-white/[0.06] rounded-xl px-4 py-3 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-white/80 text-sm font-medium truncate">{obj.title}</p>
                    <p className="text-white/30 text-xs mt-0.5">{obj.owner_name} · {new Date(obj.created_at).toLocaleDateString('pt-BR')}</p>
                  </div>
                  <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border flex-shrink-0 ${STATUS_COLORS[obj.status] ?? 'text-white/40 bg-white/5 border-white/10'}`}>
                    {STATUS_LABELS[obj.status] ?? obj.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Contato suporte */}
        <div className="bg-teal-500/5 border border-teal-500/15 rounded-xl p-5">
          <p className="text-teal-300/80 text-sm font-medium mb-1">Precisa de ajuda?</p>
          <p className="text-white/40 text-xs mb-3">Entre em contato com o suporte Backfindr para dúvidas sobre o portal ou seus dados.</p>
          <a href="mailto:suporte@backfindr.com" className="inline-flex items-center gap-1.5 text-teal-400 text-xs hover:text-teal-300 transition-colors">
            <Mail className="w-3.5 h-3.5" />
            suporte@backfindr.com
          </a>
        </div>
      </div>
    </div>
  );
}
