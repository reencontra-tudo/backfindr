'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Search, MoreVertical, UserCheck, UserX, Package,
  ChevronLeft, ChevronRight, X, Shield, Eye,
  Crown, Star, Users, RefreshCw, CheckCircle2, Clock, UserCog
} from 'lucide-react';
import { api, parseApiError } from '@/lib/api';
import { toast } from 'sonner';
import { useAuthStore } from '@/hooks/useAuth';

interface User {
  id: string; name: string; email: string; phone?: string;
  plan: string; is_active: boolean; is_legacy: boolean; is_verified: boolean;
  created_at: string; objects_count?: number; avatar_url?: string;
}

const PLAN_STYLE: Record<string, string> = {
  free:     'text-white/35 bg-white/[0.04] border-white/[0.08]',
  pro:      'text-yellow-400 bg-yellow-500/10 border-yellow-500/20',
  business: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
};
const PLAN_ICON: Record<string, React.ElementType> = {
  pro: Crown, business: Star, free: Users,
};

function UserRow({ user, onAction, onView, isSuperAdmin }: {
  user: User;
  onAction: (id: string, action: string) => void;
  onView: (id: string) => void;
  isSuperAdmin: boolean;
}) {
  const [open, setOpen] = useState(false);
  const PlanIcon = PLAN_ICON[user.plan] ?? Users;
  const initials = user.name?.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase() ?? '??';
  const date = new Date(user.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: '2-digit' });

  return (
    <tr className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors group cursor-pointer" onClick={() => onView(user.id)}>
      {/* Avatar + nome */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          {user.avatar_url ? (
            <img src={user.avatar_url} alt={user.name} className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
          ) : (
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-teal-500/25 to-teal-700/25 border border-teal-500/20 flex items-center justify-center text-teal-300 text-xs font-bold flex-shrink-0">
              {initials}
            </div>
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="text-white/80 text-sm font-medium truncate max-w-[130px]">{user.name || '—'}</p>
              {user.is_legacy && (
                <span className="text-[9px] text-yellow-400/60 bg-yellow-500/10 border border-yellow-500/15 px-1.5 py-0.5 rounded-full flex-shrink-0">Webjetos</span>
              )}
            </div>
            <p className="text-white/30 text-xs truncate max-w-[160px]">{user.email}</p>
          </div>
        </div>
      </td>

      {/* Plano */}
      <td className="px-4 py-3 hidden md:table-cell">
        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${PLAN_STYLE[user.plan] ?? PLAN_STYLE.free}`}>
          <PlanIcon className="w-2.5 h-2.5" />
          {(user.plan ?? 'free').toUpperCase()}
        </span>
      </td>

      {/* Objetos */}
      <td className="px-4 py-3 hidden lg:table-cell">
        <span className="text-white/40 text-xs">{user.objects_count ?? 0}</span>
      </td>

      {/* Cadastro */}
      <td className="px-4 py-3 hidden lg:table-cell">
        <span className="text-white/25 text-xs">{date}</span>
      </td>

      {/* Verificado */}
      <td className="px-4 py-3 hidden md:table-cell">
        {user.is_verified
          ? <CheckCircle2 className="w-4 h-4 text-teal-400" />
          : <Clock className="w-4 h-4 text-white/15" />
        }
      </td>

      {/* Status */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-1.5">
          <div className={`w-1.5 h-1.5 rounded-full ${user.is_active !== false ? 'bg-green-400' : 'bg-red-400'}`} />
          <span className={`text-xs hidden sm:block ${user.is_active !== false ? 'text-green-400' : 'text-red-400'}`}>
            {user.is_active !== false ? 'Ativo' : 'Suspenso'}
          </span>
        </div>
      </td>

      {/* Ações */}
      <td className="px-4 py-3">
        <div className="relative flex items-center gap-1 justify-end">
          <button onClick={(e) => { e.stopPropagation(); onView(user.id); }}
            className="w-7 h-7 flex items-center justify-center text-white/15 hover:text-teal-400 hover:bg-teal-500/[0.08] rounded-lg transition-all opacity-0 group-hover:opacity-100"
            title="Ver perfil">
            <Eye className="w-3.5 h-3.5" />
          </button>
          <button onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
            className="w-7 h-7 flex items-center justify-center text-white/15 hover:text-white hover:bg-white/[0.06] rounded-lg transition-all opacity-0 group-hover:opacity-100">
            <MoreVertical className="w-3.5 h-3.5" />
          </button>
          {open && (
            <>
              <div className="fixed inset-0 z-10" onClick={(e) => { e.stopPropagation(); setOpen(false); }} />
              <div className="absolute right-0 top-8 z-20 w-48 bg-[#0d1420] border border-white/[0.1] rounded-2xl shadow-2xl p-1.5">
                <button onClick={() => { onView(user.id); setOpen(false); }}
                  className="flex items-center gap-2.5 w-full px-3 py-2 rounded-xl text-xs text-white/60 hover:text-white hover:bg-white/[0.06] transition-all">
                  <Eye className="w-3.5 h-3.5" /> Ver perfil completo
                </button>
                <button onClick={() => { onAction(user.id, 'objects'); setOpen(false); }}
                  className="flex items-center gap-2.5 w-full px-3 py-2 rounded-xl text-xs text-white/60 hover:text-white hover:bg-white/[0.06] transition-all">
                  <Package className="w-3.5 h-3.5" /> Ver objetos
                </button>
                <button onClick={() => { onAction(user.id, 'promote_pro'); setOpen(false); }}
                  className="flex items-center gap-2.5 w-full px-3 py-2 rounded-xl text-xs text-yellow-400/70 hover:text-yellow-400 hover:bg-yellow-500/[0.08] transition-all">
                  <Crown className="w-3.5 h-3.5" /> Promover a Pro
                </button>
                <button onClick={() => { onAction(user.id, 'promote_business'); setOpen(false); }}
                  className="flex items-center gap-2.5 w-full px-3 py-2 rounded-xl text-xs text-purple-400/70 hover:text-purple-400 hover:bg-purple-500/[0.08] transition-all">
                  <Star className="w-3.5 h-3.5" /> Promover a Business
                </button>
                <button onClick={() => { onAction(user.id, 'downgrade_free'); setOpen(false); }}
                  className="flex items-center gap-2.5 w-full px-3 py-2 rounded-xl text-xs text-white/40 hover:text-white hover:bg-white/[0.06] transition-all">
                  <Users className="w-3.5 h-3.5" /> Rebaixar para Free
                </button>
                {isSuperAdmin && (
                  <>
                    <div className="my-1 border-t border-white/[0.06]" />
                    <button onClick={() => { onAction(user.id, 'impersonate'); setOpen(false); }}
                      className="flex items-center gap-2.5 w-full px-3 py-2 rounded-xl text-xs text-amber-400/70 hover:text-amber-400 hover:bg-amber-500/[0.08] transition-all">
                      <UserCog className="w-3.5 h-3.5" /> Navegar como este usuário
                    </button>
                  </>
                )}
                <div className="my-1 border-t border-white/[0.06]" />
                <button onClick={() => { onAction(user.id, user.is_active !== false ? 'suspend' : 'activate'); setOpen(false); }}
                  className={`flex items-center gap-2.5 w-full px-3 py-2 rounded-xl text-xs transition-all ${
                    user.is_active !== false
                      ? 'text-red-400/70 hover:text-red-400 hover:bg-red-500/[0.08]'
                      : 'text-green-400/70 hover:text-green-400 hover:bg-green-500/[0.08]'
                  }`}>
                  {user.is_active !== false ? <UserX className="w-3.5 h-3.5" /> : <UserCheck className="w-3.5 h-3.5" />}
                  {user.is_active !== false ? 'Suspender conta' : 'Reativar conta'}
                </button>
              </div>
            </>
          )}
        </div>
      </td>
    </tr>
  );
}

export default function AdminUsers() {
  const router = useRouter();
  const { user: adminUser, startImpersonation } = useAuthStore();
  const isSuperAdmin = adminUser?.role === 'super_admin';
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const PER_PAGE = 20;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = { page, size: PER_PAGE };
      if (search) params.search = search;
      if (filter !== 'all') params.filter = filter;
      const { data } = await api.get('/admin/users', { params });
      setUsers(data?.items ?? []);
      setTotal(data?.total ?? 0);
    } catch {
      setUsers([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page, search, filter]);

  useEffect(() => { load(); }, [load]);

  const handleAction = async (userId: string, action: string) => {
    try {
      if (action === 'impersonate') {
        await startImpersonation(userId);
        toast.success('Navegando como o usuário selecionado');
        router.push('/dashboard');
        return;
      }
      if (action === 'suspend')           await api.patch(`/admin/users/${userId}`, { is_active: false });
      else if (action === 'activate')     await api.patch(`/admin/users/${userId}`, { is_active: true });
      else if (action === 'promote_pro')  await api.patch(`/admin/users/${userId}`, { plan: 'pro' });
      else if (action === 'promote_business') await api.patch(`/admin/users/${userId}`, { plan: 'business' });
      else if (action === 'downgrade_free')   await api.patch(`/admin/users/${userId}`, { plan: 'free' });
      else if (action === 'objects')      { router.push(`/admin/users/${userId}`); return; }

      const labels: Record<string, string> = {
        suspend: 'Conta suspensa', activate: 'Conta reativada',
        promote_pro: 'Promovido a Pro', promote_business: 'Promovido a Business',
        downgrade_free: 'Rebaixado para Free',
      };
      toast.success(labels[action] ?? 'Atualizado');
      load();
    } catch (e) {
      toast.error(parseApiError(e));
    }
  };

  const pages = Math.ceil(total / PER_PAGE);

  // Contagens por plano (da página atual)
  const planCounts = users.reduce((acc, u) => {
    const p = u.plan ?? 'free';
    acc[p] = (acc[p] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="p-5 md:p-7 max-w-7xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-white text-xl font-bold tracking-tight">Usuários</h1>
          <p className="text-white/25 text-xs mt-0.5">{total.toLocaleString('pt-BR')} cadastros no total</p>
        </div>
        <button onClick={load} disabled={loading}
          className="flex items-center gap-2 px-3 py-2 bg-white/[0.04] hover:bg-white/[0.07] border border-white/[0.07] rounded-xl text-white/40 hover:text-white text-xs transition-all disabled:opacity-40">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Atualizar
        </button>
      </div>

      {/* Stats rápidas */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Pro',      count: planCounts.pro ?? 0,      icon: Crown, color: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/15' },
          { label: 'Business', count: planCounts.business ?? 0, icon: Star,  color: 'text-purple-400 bg-purple-500/10 border-purple-500/15' },
          { label: 'Free',     count: planCounts.free ?? 0,     icon: Users, color: 'text-white/35 bg-white/[0.04] border-white/[0.07]' },
        ].map(s => (
          <div key={s.label} className={`flex items-center gap-3 p-3 rounded-2xl border ${s.color}`}>
            <s.icon className="w-4 h-4 flex-shrink-0" />
            <div>
              <p className="text-lg font-bold leading-none">{s.count}</p>
              <p className="text-[10px] opacity-60 mt-0.5">{s.label} (pág.)</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/25" />
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="Buscar por nome ou e-mail..."
            className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl pl-9 pr-9 py-2.5 text-white placeholder-white/20 text-sm outline-none focus:border-teal-500/40 transition-all" />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/20 hover:text-white">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {[
            { value: 'all',      label: 'Todos' },
            { value: 'pro',      label: 'Pro' },
            { value: 'business', label: 'Business' },
            { value: 'free',     label: 'Free' },
            { value: 'legacy',   label: 'Webjetos' },
            { value: 'inactive', label: 'Inativos' },
          ].map(f => (
            <button key={f.value} onClick={() => { setFilter(f.value); setPage(1); }}
              className={`px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                filter === f.value
                  ? 'bg-teal-500/15 text-teal-400 border border-teal-500/25'
                  : 'bg-white/[0.03] text-white/35 border border-white/[0.07] hover:text-white hover:bg-white/[0.06]'
              }`}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tabela */}
      <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/[0.06]">
                {[
                  { label: 'Usuário', cls: '' },
                  { label: 'Plano',   cls: 'hidden md:table-cell' },
                  { label: 'Objetos', cls: 'hidden lg:table-cell' },
                  { label: 'Cadastro',cls: 'hidden lg:table-cell' },
                  { label: 'Verif.',  cls: 'hidden md:table-cell' },
                  { label: 'Status',  cls: '' },
                  { label: '',        cls: '' },
                ].map((h, i) => (
                  <th key={i} className={`px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-white/20 ${h.cls}`}>
                    {h.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} className="border-b border-white/[0.04]">
                    <td colSpan={7} className="px-4 py-3">
                      <div className="h-8 bg-white/[0.03] rounded-xl animate-pulse" />
                    </td>
                  </tr>
                ))
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-16 text-center">
                    <Users className="w-8 h-8 text-white/10 mx-auto mb-2" />
                    <p className="text-white/20 text-sm">Nenhum usuário encontrado</p>
                  </td>
                </tr>
              ) : (
                users.map(u => (
                  <UserRow key={u.id} user={u} onAction={handleAction} onView={id => router.push(`/admin/users/${id}`)} isSuperAdmin={isSuperAdmin} />
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Paginação */}
        {pages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-white/[0.06]">
            <p className="text-white/25 text-xs">
              {((page - 1) * PER_PAGE) + 1}–{Math.min(page * PER_PAGE, total)} de {total.toLocaleString('pt-BR')}
            </p>
            <div className="flex gap-1">
              <button disabled={page === 1} onClick={() => setPage(p => p - 1)}
                className="w-8 h-8 flex items-center justify-center rounded-lg border border-white/[0.08] text-white/35 hover:text-white disabled:opacity-30 transition-all">
                <ChevronLeft className="w-4 h-4" />
              </button>
              {Array.from({ length: Math.min(5, pages) }, (_, i) => {
                const p = page <= 3 ? i + 1 : page - 2 + i;
                if (p > pages) return null;
                return (
                  <button key={p} onClick={() => setPage(p)}
                    className={`w-8 h-8 flex items-center justify-center rounded-lg text-xs transition-all ${
                      p === page ? 'bg-teal-500 text-white' : 'border border-white/[0.08] text-white/35 hover:text-white'
                    }`}>
                    {p}
                  </button>
                );
              })}
              <button disabled={page === pages} onClick={() => setPage(p => p + 1)}
                className="w-8 h-8 flex items-center justify-center rounded-lg border border-white/[0.08] text-white/35 hover:text-white disabled:opacity-30 transition-all">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
