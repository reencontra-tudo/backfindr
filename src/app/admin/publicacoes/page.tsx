'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Search, X, MoreVertical, Eye, Trash2, CheckCircle2,
  Megaphone, RefreshCw, ChevronLeft, ChevronRight,
  MapPin, User
} from 'lucide-react';
import { api, parseApiError } from '@/lib/api';
import { toast } from 'sonner';

interface Pub {
  id: string;
  title: string;
  category: string;
  status: string;
  location?: string;
  qr_code?: string;
  unique_code?: string;
  owner_name?: string;
  owner_email?: string;
  owner_id?: string;
  created_at: string;
  updated_at: string;
  is_legacy?: boolean;
  description?: string;
}

const STATUS_STYLE: Record<string, { text: string; bg: string; border: string; dot: string }> = {
  lost:     { text: 'text-red-400',    bg: 'bg-red-500/10',    border: 'border-red-500/20',    dot: 'bg-red-400' },
  found:    { text: 'text-teal-400',   bg: 'bg-teal-500/10',   border: 'border-teal-500/20',   dot: 'bg-teal-400' },
  returned: { text: 'text-green-400',  bg: 'bg-green-500/10',  border: 'border-green-500/20',  dot: 'bg-green-400' },
  stolen:   { text: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/20', dot: 'bg-orange-400' },
  protect:  { text: 'text-blue-400',   bg: 'bg-blue-500/10',   border: 'border-blue-500/20',   dot: 'bg-blue-400' },
};
const STATUS_LABEL: Record<string, string> = {
  lost: 'Perdido', found: 'Achado', returned: 'Recuperado', stolen: 'Roubado', protect: 'Protegido',
};
const CATEGORY_EMOJI: Record<string, string> = {
  phone: '📱', wallet: '👛', keys: '🔑', bag: '🎒', pet: '🐾',
  bike: '🚲', document: '📄', jewelry: '💍', electronics: '💻', clothing: '👕', other: '📦',
};

const STATUS_FILTERS = [
  { value: 'all',      label: 'Todos' },
  { value: 'lost',     label: 'Perdidos' },
  { value: 'found',    label: 'Achados' },
  { value: 'stolen',   label: 'Roubados' },
  { value: 'returned', label: 'Recuperados' },
  { value: 'protect',  label: 'Protegidos' },
];

function PubRow({ pub, onAction }: { pub: Pub; onAction: (id: string, action: string) => void }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const router = useRouter();
  const s = STATUS_STYLE[pub.status] ?? { text: 'text-white/40', bg: '', border: '', dot: 'bg-white/20' };
  const date = new Date(pub.updated_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: '2-digit' });

  return (
    <tr className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors group cursor-pointer"
      onClick={() => router.push(`/admin/objects/${pub.id}`)}>
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <span className="text-xl flex-shrink-0">{CATEGORY_EMOJI[pub.category] ?? '📦'}</span>
          <div className="min-w-0">
            <p className="text-white/85 text-sm font-medium truncate max-w-[150px]">{pub.title}</p>
            {pub.location && (
              <p className="text-white/25 text-[10px] flex items-center gap-1 truncate max-w-[150px]">
                <MapPin className="w-2.5 h-2.5 flex-shrink-0" />
                {typeof pub.location === 'string' ? pub.location : ''}
              </p>
            )}
          </div>
        </div>
      </td>
      <td className="px-4 py-3">
        <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] font-semibold border ${s.text} ${s.bg} ${s.border}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
          {STATUS_LABEL[pub.status] ?? pub.status}
        </span>
      </td>
      <td className="px-4 py-3 hidden lg:table-cell">
        <p className="text-white/60 text-xs truncate max-w-[130px]">{pub.owner_name || '—'}</p>
        <p className="text-white/25 text-[10px] truncate max-w-[130px]">{pub.owner_email || ''}</p>
      </td>
      <td className="px-4 py-3 hidden md:table-cell">
        <span className="text-white/25 text-xs">{date}</span>
      </td>
      <td className="px-4 py-3">
        <div className="relative flex items-center gap-1 justify-end" onClick={e => e.stopPropagation()}>
          <button onClick={() => router.push(`/admin/objects/${pub.id}`)}
            className="w-7 h-7 flex items-center justify-center text-white/15 hover:text-teal-400 hover:bg-teal-500/[0.08] rounded-lg transition-all opacity-0 group-hover:opacity-100">
            <Eye className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => setMenuOpen(!menuOpen)}
            className="w-7 h-7 flex items-center justify-center text-white/15 hover:text-white hover:bg-white/[0.06] rounded-lg transition-all opacity-0 group-hover:opacity-100">
            <MoreVertical className="w-3.5 h-3.5" />
          </button>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 top-8 z-20 w-52 bg-[#0d1420] border border-white/[0.1] rounded-2xl shadow-2xl p-1.5">
                <button onClick={() => { router.push(`/admin/objects/${pub.id}`); setMenuOpen(false); }}
                  className="flex items-center gap-2.5 w-full px-3 py-2 rounded-xl text-xs text-white/60 hover:text-white hover:bg-white/[0.06] transition-all">
                  <Eye className="w-3.5 h-3.5" /> Ver detalhes
                </button>
                {pub.owner_id && (
                  <button onClick={() => { router.push(`/admin/users/${pub.owner_id}`); setMenuOpen(false); }}
                    className="flex items-center gap-2.5 w-full px-3 py-2 rounded-xl text-xs text-white/60 hover:text-white hover:bg-white/[0.06] transition-all">
                    <User className="w-3.5 h-3.5" /> Ver dono
                  </button>
                )}
                {pub.status !== 'returned' && (
                  <button onClick={() => { onAction(pub.id, 'returned'); setMenuOpen(false); }}
                    className="flex items-center gap-2.5 w-full px-3 py-2 rounded-xl text-xs text-green-400/70 hover:text-green-400 hover:bg-green-500/[0.08] transition-all">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Marcar recuperado
                  </button>
                )}
                <div className="my-1 border-t border-white/[0.06]" />
                <button onClick={() => { onAction(pub.id, 'delete'); setMenuOpen(false); }}
                  className="flex items-center gap-2.5 w-full px-3 py-2 rounded-xl text-xs text-red-400/70 hover:text-red-400 hover:bg-red-500/[0.08] transition-all">
                  <Trash2 className="w-3.5 h-3.5" /> Excluir publicação
                </button>
              </div>
            </>
          )}
        </div>
      </td>
    </tr>
  );
}

export default function AdminPublicacoes() {
  const [pubs, setPubs] = useState<Pub[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const PER_PAGE = 20;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = { page, size: PER_PAGE };
      if (search) params.search = search;
      if (status !== 'all') params.status = status;
      const { data } = await api.get('/admin/objects', { params });
      setPubs(data?.items ?? []);
      setTotal(data?.total ?? 0);
      if (data?.counts) setCounts(data.counts);
    } catch { setPubs([]); setTotal(0); }
    finally { setLoading(false); }
  }, [page, search, status]);

  useEffect(() => { load(); }, [load]);

  const handleAction = async (id: string, action: string) => {
    try {
      if (action === 'delete') {
        if (!confirm('Excluir esta publicação permanentemente?')) return;
        await api.delete(`/admin/objects/${id}`);
        toast.success('Publicação excluída');
      } else if (action === 'returned') {
        await api.patch(`/admin/objects/${id}`, { status: 'returned' });
        toast.success('Marcado como recuperado');
      }
      load();
    } catch (e) { toast.error(parseApiError(e)); }
  };

  const pages = Math.ceil(total / PER_PAGE);

  return (
    <div className="p-5 md:p-7 max-w-7xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-white text-xl font-bold tracking-tight">Publicações</h1>
          <p className="text-white/25 text-xs mt-0.5">{total.toLocaleString('pt-BR')} publicações ativas</p>
        </div>
        <button onClick={load} disabled={loading}
          className="flex items-center gap-2 px-3 py-2 bg-white/[0.04] hover:bg-white/[0.07] border border-white/[0.07] rounded-xl text-white/40 hover:text-white text-xs transition-all disabled:opacity-40">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Atualizar
        </button>
      </div>

      {/* Cards de status */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {[
          { key: 'lost',     label: 'Perdidos',    cls: 'text-red-400 bg-red-500/10 border-red-500/15' },
          { key: 'found',    label: 'Achados',     cls: 'text-teal-400 bg-teal-500/10 border-teal-500/15' },
          { key: 'returned', label: 'Recuperados', cls: 'text-green-400 bg-green-500/10 border-green-500/15' },
          { key: 'stolen',   label: 'Roubados',    cls: 'text-orange-400 bg-orange-500/10 border-orange-500/15' },
        ].map(s => (
          <button key={s.key} onClick={() => { setStatus(s.key); setPage(1); }}
            className={`p-3 rounded-2xl border text-left transition-all hover:opacity-80 ${s.cls} ${status === s.key ? 'ring-1 ring-current ring-opacity-30' : ''}`}>
            <p className="text-lg font-bold leading-none">{counts[s.key] ?? 0}</p>
            <p className="text-[10px] opacity-60 mt-0.5">{s.label}</p>
          </button>
        ))}
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/20" />
        <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
          placeholder="Buscar por título, localização ou dono..."
          className="w-full bg-white/[0.04] border border-white/[0.07] rounded-xl pl-9 pr-8 py-2.5 text-white/80 text-sm placeholder:text-white/20 focus:outline-none focus:border-teal-500/40" />
        {search && (
          <button onClick={() => { setSearch(''); setPage(1); }} className="absolute right-3 top-1/2 -translate-y-1/2">
            <X className="w-3.5 h-3.5 text-white/30 hover:text-white" />
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {STATUS_FILTERS.map(f => (
          <button key={f.value} onClick={() => { setStatus(f.value); setPage(1); }}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all border ${
              status === f.value
                ? 'bg-teal-500/15 border-teal-500/30 text-teal-400'
                : 'bg-white/[0.03] border-white/[0.07] text-white/40 hover:text-white hover:border-white/20'
            }`}>
            {f.label}
          </button>
        ))}
      </div>

      <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-6 h-6 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : pubs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Megaphone className="w-8 h-8 text-white/10" />
            <p className="text-white/25 text-sm">Nenhuma publicação encontrada</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/[0.06]">
                <th className="px-4 py-3 text-left text-[10px] font-semibold text-white/25 uppercase tracking-wider">Objeto</th>
                <th className="px-4 py-3 text-left text-[10px] font-semibold text-white/25 uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-left text-[10px] font-semibold text-white/25 uppercase tracking-wider hidden lg:table-cell">Dono</th>
                <th className="px-4 py-3 text-left text-[10px] font-semibold text-white/25 uppercase tracking-wider hidden md:table-cell">Atualizado</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {pubs.map(pub => <PubRow key={pub.id} pub={pub} onAction={handleAction} />)}
            </tbody>
          </table>
        )}
      </div>

      {pages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-white/25 text-xs">Página {page} de {pages} · {total.toLocaleString('pt-BR')} publicações</p>
          <div className="flex gap-2">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
              className="p-2 rounded-xl bg-white/[0.04] border border-white/[0.07] text-white/40 hover:text-white disabled:opacity-30 transition-all">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={page === pages}
              className="p-2 rounded-xl bg-white/[0.04] border border-white/[0.07] text-white/40 hover:text-white disabled:opacity-30 transition-all">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
