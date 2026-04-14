'use client';

import { useEffect, useState, useCallback } from 'react';
import { Search, Filter, MoreVertical, UserCheck, UserX, Mail, Package, ChevronLeft, ChevronRight, X, Shield, Loader2 } from 'lucide-react';
import { api, parseApiError } from '@/lib/api';
import { toast } from 'sonner';

interface User {
  id: string; name: string; email: string; phone?: string;
  plan: string; is_active: boolean; is_legacy: boolean;
  created_at: string; objects_count?: number;
}

const PLAN_STYLE: Record<string, string> = {
  free:     'text-white/40 bg-white/[0.04] border-white/[0.08]',
  pro:      'text-teal-400 bg-teal-500/10 border-teal-500/20',
  business: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20',
};

function UserRow({ user, onAction }: { user: User; onAction: (id: string, action: string) => void }) {
  const [open, setOpen] = useState(false);
  const initials = user.name?.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase() ?? '??';
  const date = new Date(user.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: '2-digit' });

  return (
    <tr className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors group">
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-teal-500/20 border border-teal-500/30 flex items-center justify-center text-teal-400 text-xs font-bold flex-shrink-0">
            {initials}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-white text-sm font-medium truncate">{user.name}</p>
              {user.is_legacy && <span className="text-[9px] text-yellow-400/60 bg-yellow-500/10 border border-yellow-500/20 px-1.5 py-0.5 rounded-full">Webjetos</span>}
            </div>
            <p className="text-white/30 text-xs truncate">{user.email}</p>
          </div>
        </div>
      </td>
      <td className="px-4 py-3 hidden md:table-cell">
        <span className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-1 rounded-full border ${PLAN_STYLE[user.plan] ?? PLAN_STYLE.free}`}>
          {user.plan}
        </span>
      </td>
      <td className="px-4 py-3 hidden lg:table-cell text-white/40 text-xs">{user.objects_count ?? 0}</td>
      <td className="px-4 py-3 hidden lg:table-cell text-white/30 text-xs">{date}</td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <div className={`w-1.5 h-1.5 rounded-full ${user.is_active ? 'bg-green-400' : 'bg-red-400'}`} />
          <span className={`text-xs hidden sm:block ${user.is_active ? 'text-green-400' : 'text-red-400'}`}>
            {user.is_active ? 'Ativo' : 'Suspenso'}
          </span>
        </div>
      </td>
      <td className="px-4 py-3">
        <div className="relative">
          <button onClick={() => setOpen(!open)}
            className="w-7 h-7 flex items-center justify-center text-white/20 hover:text-white hover:bg-white/[0.06] rounded-lg transition-all opacity-0 group-hover:opacity-100">
            <MoreVertical className="w-3.5 h-3.5" />
          </button>
          {open && (
            <div className="absolute right-0 top-8 z-10 w-44 bg-[#0d1117] border border-white/[0.1] rounded-xl shadow-2xl p-1">
              {[
                { icon: Package, label: 'Ver objetos', action: 'objects' },
                { icon: Mail,    label: 'Enviar e-mail', action: 'email' },
                { icon: Shield,  label: 'Promover a Pro', action: 'promote' },
                { icon: user.is_active ? UserX : UserCheck,
                  label: user.is_active ? 'Suspender' : 'Reativar',
                  action: user.is_active ? 'suspend' : 'activate' },
              ].map(({ icon: Icon, label, action }) => (
                <button key={action} onClick={() => { onAction(user.id, action); setOpen(false); }}
                  className={`flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-xs transition-all ${
                    action === 'suspend' ? 'text-red-400 hover:bg-red-500/10' : 'text-white/60 hover:text-white hover:bg-white/[0.06]'
                  }`}>
                  <Icon className="w-3.5 h-3.5" /> {label}
                </button>
              ))}
            </div>
          )}
        </div>
      </td>
    </tr>
  );
}

export default function AdminUsers() {
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
      // Fallback demo
      setUsers([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page, search, filter]);

  useEffect(() => { load(); }, [load]);

  const handleAction = async (userId: string, action: string) => {
    try {
      if (action === 'suspend')   await api.patch(`/admin/users/${userId}`, { is_active: false });
      if (action === 'activate')  await api.patch(`/admin/users/${userId}`, { is_active: true });
      if (action === 'promote')   await api.patch(`/admin/users/${userId}`, { plan: 'pro' });
      if (action === 'email')     { toast.info('Funcionalidade de e-mail direto em breve'); return; }
      if (action === 'objects')   { window.location.href = `/admin/objects?user=${userId}`; return; }
      toast.success('Atualizado com sucesso');
      load();
    } catch (e) {
      toast.error(parseApiError(e));
    }
  };

  const pages = Math.ceil(total / PER_PAGE);

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Usuários</h1>
          <p className="text-white/30 text-sm mt-0.5">{total.toLocaleString('pt-BR')} cadastrados</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" />
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="Buscar por nome ou e-mail..."
            className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl pl-9 pr-4 py-2.5 text-white placeholder-white/20 text-sm outline-none focus:border-teal-500/50 transition-all" />
          {search && <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/20 hover:text-white"><X className="w-3.5 h-3.5" /></button>}
        </div>
        <div className="flex gap-2">
          {[
            { value: 'all',     label: 'Todos' },
            { value: 'pro',     label: 'Pro' },
            { value: 'legacy',  label: 'Webjetos' },
            { value: 'inactive',label: 'Inativos' },
          ].map(f => (
            <button key={f.value} onClick={() => { setFilter(f.value); setPage(1); }}
              className={`px-3 py-2 rounded-xl text-xs font-medium transition-all ${filter === f.value ? 'bg-teal-500/15 text-teal-400 border border-teal-500/30' : 'bg-white/[0.03] text-white/40 border border-white/[0.07] hover:text-white'}`}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white/[0.02] border border-white/[0.07] rounded-2xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/[0.06]">
              {['Usuário', 'Plano', 'Objetos', 'Cadastro', 'Status', ''].map(h => (
                <th key={h} className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-white/20">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <tr key={i} className="border-b border-white/[0.04]">
                  {[1,2,3,4,5,6].map(j => (
                    <td key={j} className="px-4 py-3">
                      <div className="h-4 bg-white/[0.04] rounded animate-pulse" />
                    </td>
                  ))}
                </tr>
              ))
            ) : users.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-12 text-center text-white/20 text-sm">Nenhum usuário encontrado</td></tr>
            ) : (
              users.map(u => <UserRow key={u.id} user={u} onAction={handleAction} />)
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-white/30 text-xs">
            {((page - 1) * PER_PAGE) + 1}–{Math.min(page * PER_PAGE, total)} de {total}
          </p>
          <div className="flex gap-1">
            <button disabled={page === 1} onClick={() => setPage(p => p - 1)}
              className="w-8 h-8 flex items-center justify-center rounded-lg border border-white/[0.08] text-white/40 hover:text-white disabled:opacity-30 transition-all">
              <ChevronLeft className="w-4 h-4" />
            </button>
            {Array.from({ length: Math.min(5, pages) }, (_, i) => {
              const p = page <= 3 ? i + 1 : page - 2 + i;
              if (p > pages) return null;
              return (
                <button key={p} onClick={() => setPage(p)}
                  className={`w-8 h-8 flex items-center justify-center rounded-lg text-xs transition-all ${p === page ? 'bg-teal-500 text-white' : 'border border-white/[0.08] text-white/40 hover:text-white'}`}>
                  {p}
                </button>
              );
            })}
            <button disabled={page === pages} onClick={() => setPage(p => p + 1)}
              className="w-8 h-8 flex items-center justify-center rounded-lg border border-white/[0.08] text-white/40 hover:text-white disabled:opacity-30 transition-all">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
