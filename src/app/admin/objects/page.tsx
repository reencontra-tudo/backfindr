'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Search, X, MoreVertical, Eye, Trash2,
  Package, RefreshCw, ChevronLeft, ChevronRight,
  User, Zap
} from 'lucide-react';
import { api, parseApiError } from '@/lib/api';
import { toast } from 'sonner';

interface Obj {
  id: string;
  title: string;
  category: string;
  qr_code?: string;
  unique_code?: string;
  owner_name?: string;
  owner_email?: string;
  owner_id?: string;
  created_at: string;
  is_legacy?: boolean;
  boost_active?: boolean;
  status: string;
}

const CATEGORY_EMOJI: Record<string, string> = {
  phone: '📱', wallet: '👛', keys: '🔑', bag: '🎒', pet: '🐾',
  bike: '🚲', vehicle: '🚗', document: '📄', jewelry: '💍', electronics: '💻',
  clothing: '👕', other: '📦',
};
const CATEGORY_LABEL: Record<string, string> = {
  phone: 'Celular', wallet: 'Carteira', keys: 'Chaves', bag: 'Bolsa', pet: 'Pet',
  bike: 'Bicicleta', vehicle: 'Veículo', document: 'Documento', jewelry: 'Joia', electronics: 'Eletrônico',
  clothing: 'Roupa', other: 'Outro',
};
const CATEGORY_FILTERS = [
  { value: 'all', label: 'Todos' },
  { value: 'phone', label: '📱 Celular' },
  { value: 'pet', label: '🐾 Pet' },
  { value: 'vehicle', label: '🚗 Veículo' },
  { value: 'wallet', label: '👛 Carteira' },
  { value: 'keys', label: '🔑 Chaves' },
  { value: 'bike', label: '🚲 Bicicleta' },
  { value: 'electronics', label: '💻 Eletrônico' },
  { value: 'document', label: '📄 Documento' },
  { value: 'other', label: '📦 Outro' },
];

function ObjectRow({ obj, onAction }: { obj: Obj; onAction: (id: string, action: string) => void }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const router = useRouter();
  const code = obj.qr_code ?? obj.unique_code ?? '—';
  const date = new Date(obj.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: '2-digit' });
  return (
    <tr className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors group cursor-pointer"
      onClick={() => router.push(`/admin/objects/${obj.id}`)}>
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <span className="text-xl flex-shrink-0">{CATEGORY_EMOJI[obj.category] ?? '📦'}</span>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <p className="text-white/85 text-sm font-medium truncate max-w-[140px]">{obj.title}</p>
              {obj.is_legacy && <span className="text-[9px] text-yellow-400/60 bg-yellow-500/10 border border-yellow-500/15 px-1.5 py-0.5 rounded-full">Webjetos</span>}
              {obj.boost_active && (
                <span className="text-[9px] text-teal-400/80 bg-teal-500/10 border border-teal-500/20 px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                  <Zap className="w-2 h-2" /> Boost
                </span>
              )}
            </div>
            <p className="text-white/25 text-[10px] font-mono">{code}</p>
          </div>
        </div>
      </td>
      <td className="px-4 py-3 hidden md:table-cell">
        <span className="text-white/40 text-xs">{CATEGORY_LABEL[obj.category] ?? obj.category}</span>
      </td>
      <td className="px-4 py-3 hidden lg:table-cell">
        <p className="text-white/60 text-xs truncate max-w-[130px]">{obj.owner_name || '—'}</p>
        <p className="text-white/25 text-[10px] truncate max-w-[130px]">{obj.owner_email || ''}</p>
      </td>
      <td className="px-4 py-3 hidden lg:table-cell">
        <span className="text-white/25 text-xs">{date}</span>
      </td>
      <td className="px-4 py-3">
        <div className="relative flex items-center gap-1 justify-end" onClick={e => e.stopPropagation()}>
          <button onClick={() => router.push(`/admin/objects/${obj.id}`)}
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
              <div className="absolute right-0 top-8 z-20 w-48 bg-[#0d1420] border border-white/[0.1] rounded-2xl shadow-2xl p-1.5">
                <button onClick={() => { router.push(`/admin/objects/${obj.id}`); setMenuOpen(false); }}
                  className="flex items-center gap-2.5 w-full px-3 py-2 rounded-xl text-xs text-white/60 hover:text-white hover:bg-white/[0.06] transition-all">
                  <Eye className="w-3.5 h-3.5" /> Ver detalhes
                </button>
                {obj.owner_id && (
                  <button onClick={() => { router.push(`/admin/users/${obj.owner_id}`); setMenuOpen(false); }}
                    className="flex items-center gap-2.5 w-full px-3 py-2 rounded-xl text-xs text-white/60 hover:text-white hover:bg-white/[0.06] transition-all">
                    <User className="w-3.5 h-3.5" /> Ver dono
                  </button>
                )}
                <div className="my-1 border-t border-white/[0.06]" />
                <button onClick={() => { onAction(obj.id, 'delete'); setMenuOpen(false); }}
                  className="flex items-center gap-2.5 w-full px-3 py-2 rounded-xl text-xs text-red-400/70 hover:text-red-400 hover:bg-red-500/[0.08] transition-all">
                  <Trash2 className="w-3.5 h-3.5" /> Excluir objeto
                </button>
              </div>
            </>
          )}
        </div>
      </td>
    </tr>
  );
}

export default function AdminObjects() {
  const [objects, setObjects] = useState<Obj[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const PER_PAGE = 20;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = { page, size: PER_PAGE };
      if (search) params.search = search;
      if (category !== 'all') params.category = category;
      const { data } = await api.get('/admin/objects', { params });
      setObjects(data?.items ?? []);
      setTotal(data?.total ?? 0);
    } catch { setObjects([]); setTotal(0); }
    finally { setLoading(false); }
  }, [page, search, category]);

  useEffect(() => { load(); }, [load]);

  const handleAction = async (objId: string, action: string) => {
    if (action === 'delete') {
      if (!confirm('Excluir este objeto permanentemente?')) return;
      try { await api.delete(`/admin/objects/${objId}`); toast.success('Objeto excluído'); load(); }
      catch (e) { toast.error(parseApiError(e)); }
    }
  };

  const pages = Math.ceil(total / PER_PAGE);

  return (
    <div className="p-5 md:p-7 max-w-7xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-white text-xl font-bold tracking-tight">Objetos</h1>
          <p className="text-white/25 text-xs mt-0.5">{total.toLocaleString('pt-BR')} objetos cadastrados</p>
        </div>
        <button onClick={load} disabled={loading}
          className="flex items-center gap-2 px-3 py-2 bg-white/[0.04] hover:bg-white/[0.07] border border-white/[0.07] rounded-xl text-white/40 hover:text-white text-xs transition-all disabled:opacity-40">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Atualizar
        </button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/20" />
        <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
          placeholder="Buscar por título ou QR code..."
          className="w-full bg-white/[0.04] border border-white/[0.07] rounded-xl pl-9 pr-8 py-2.5 text-white/80 text-sm placeholder:text-white/20 focus:outline-none focus:border-teal-500/40" />
        {search && (
          <button onClick={() => { setSearch(''); setPage(1); }} className="absolute right-3 top-1/2 -translate-y-1/2">
            <X className="w-3.5 h-3.5 text-white/30 hover:text-white" />
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {CATEGORY_FILTERS.map(f => (
          <button key={f.value} onClick={() => { setCategory(f.value); setPage(1); }}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all border ${
              category === f.value
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
        ) : objects.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Package className="w-8 h-8 text-white/10" />
            <p className="text-white/25 text-sm">Nenhum objeto encontrado</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/[0.06]">
                <th className="px-4 py-3 text-left text-[10px] font-semibold text-white/25 uppercase tracking-wider">Objeto</th>
                <th className="px-4 py-3 text-left text-[10px] font-semibold text-white/25 uppercase tracking-wider hidden md:table-cell">Categoria</th>
                <th className="px-4 py-3 text-left text-[10px] font-semibold text-white/25 uppercase tracking-wider hidden lg:table-cell">Dono</th>
                <th className="px-4 py-3 text-left text-[10px] font-semibold text-white/25 uppercase tracking-wider hidden lg:table-cell">Cadastro</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {objects.map(obj => <ObjectRow key={obj.id} obj={obj} onAction={handleAction} />)}
            </tbody>
          </table>
        )}
      </div>

      {pages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-white/25 text-xs">Página {page} de {pages} · {total.toLocaleString('pt-BR')} objetos</p>
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
