'use client';

import { useEffect, useState, useCallback } from 'react';
import { Search, X, MoreVertical, MapPin, QrCode, Eye, Trash2, CheckCircle2, Package } from 'lucide-react';
import { api, parseApiError } from '@/lib/api';
import { toast } from 'sonner';

interface Obj {
  id: string; title: string; category: string; status: string;
  location_addr?: string; unique_code: string; owner_name?: string;
  owner_email?: string; created_at: string; is_legacy?: boolean;
}

const STATUS_STYLE: Record<string, string> = {
  lost:     'text-red-400 bg-red-500/10 border-red-500/20',
  found:    'text-teal-400 bg-teal-500/10 border-teal-500/20',
  returned: 'text-green-400 bg-green-500/10 border-green-500/20',
  stolen:   'text-orange-400 bg-orange-500/10 border-orange-500/20',
};
const STATUS_LABEL: Record<string, string> = {
  lost: 'Perdido', found: 'Achado', returned: 'Recuperado', stolen: 'Roubado',
};
const CATEGORY_EMOJI: Record<string, string> = {
  phone:'📱', wallet:'👛', keys:'🔑', bag:'🎒', pet:'🐾',
  bike:'🚲', document:'📄', jewelry:'💍', electronics:'💻', clothing:'👕', other:'📦',
};

export default function AdminObjects() {
  const [objects, setObjects] = useState<Obj[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const PER_PAGE = 20;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = { page, size: PER_PAGE };
      if (search) params.search = search;
      if (status !== 'all') params.status = status;
      const { data } = await api.get('/admin/objects', { params });
      setObjects(data?.items ?? []);
      setTotal(data?.total ?? 0);
    } catch {
      setObjects([]);
    } finally {
      setLoading(false);
    }
  }, [page, search, status]);

  useEffect(() => { load(); }, [load]);

  const handleAction = async (id: string, action: string) => {
    try {
      if (action === 'delete')   { await api.delete(`/admin/objects/${id}`); toast.success('Objeto removido'); }
      if (action === 'returned') { await api.patch(`/admin/objects/${id}`, { status: 'returned' }); toast.success('Marcado como recuperado'); }
      if (action === 'view')     { window.open(`/objeto/${objects.find(o => o.id === id)?.unique_code}`, '_blank'); return; }
      if (action === 'qr')       { window.open(`/scan/${objects.find(o => o.id === id)?.unique_code}`, '_blank'); return; }
      load();
    } catch (e) { toast.error(parseApiError(e)); }
  };

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Objetos</h1>
          <p className="text-white/30 text-sm mt-0.5">{total.toLocaleString('pt-BR')} registrados</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" />
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="Buscar título, código QR, dono..."
            className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl pl-9 pr-4 py-2.5 text-white placeholder-white/20 text-sm outline-none focus:border-teal-500/50 transition-all" />
          {search && <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/20 hover:text-white"><X className="w-3.5 h-3.5" /></button>}
        </div>
        <div className="flex gap-2 flex-wrap">
          {['all','lost','found','returned','stolen'].map(s => (
            <button key={s} onClick={() => { setStatus(s); setPage(1); }}
              className={`px-3 py-2 rounded-xl text-xs font-medium transition-all ${status === s ? 'bg-teal-500/15 text-teal-400 border border-teal-500/30' : 'bg-white/[0.03] text-white/40 border border-white/[0.07] hover:text-white'}`}>
              {s === 'all' ? 'Todos' : STATUS_LABEL[s]}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-32 bg-white/[0.02] rounded-2xl animate-pulse" />)}
        </div>
      ) : objects.length === 0 ? (
        <div className="text-center py-16 text-white/20">
          <Package className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>Nenhum objeto encontrado</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {objects.map(obj => (
            <div key={obj.id} className="bg-white/[0.02] border border-white/[0.07] rounded-2xl p-4 hover:border-white/[0.12] transition-all group">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{CATEGORY_EMOJI[obj.category] ?? '📦'}</span>
                  <div>
                    <p className="text-white text-sm font-medium leading-tight">{obj.title}</p>
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${STATUS_STYLE[obj.status] ?? STATUS_STYLE.lost}`}>
                      {STATUS_LABEL[obj.status] ?? obj.status}
                    </span>
                  </div>
                </div>
                <div className="relative">
                  <button className="w-7 h-7 flex items-center justify-center text-white/20 hover:text-white hover:bg-white/[0.06] rounded-lg opacity-0 group-hover:opacity-100 transition-all">
                    <MoreVertical className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="space-y-1.5 mb-3">
                {obj.owner_name && (
                  <p className="text-white/30 text-xs flex items-center gap-1.5">
                    <span className="w-1 h-1 rounded-full bg-white/20 flex-shrink-0" />
                    {obj.owner_name}
                  </p>
                )}
                {obj.location_addr && (
                  <p className="text-white/30 text-xs flex items-center gap-1.5 truncate">
                    <MapPin className="w-3 h-3 flex-shrink-0" />
                    {obj.location_addr}
                  </p>
                )}
                <p className="text-white/20 text-[10px] font-mono">{obj.unique_code}</p>
              </div>

              <div className="flex gap-2">
                <button onClick={() => handleAction(obj.id, 'view')}
                  className="flex-1 flex items-center justify-center gap-1 text-white/30 hover:text-white text-xs py-1.5 rounded-lg hover:bg-white/[0.06] transition-all">
                  <Eye className="w-3 h-3" /> Ver
                </button>
                <button onClick={() => handleAction(obj.id, 'qr')}
                  className="flex-1 flex items-center justify-center gap-1 text-white/30 hover:text-teal-400 text-xs py-1.5 rounded-lg hover:bg-teal-500/[0.06] transition-all">
                  <QrCode className="w-3 h-3" /> QR
                </button>
                {obj.status !== 'returned' && (
                  <button onClick={() => handleAction(obj.id, 'returned')}
                    className="flex-1 flex items-center justify-center gap-1 text-white/30 hover:text-green-400 text-xs py-1.5 rounded-lg hover:bg-green-500/[0.06] transition-all">
                    <CheckCircle2 className="w-3 h-3" /> OK
                  </button>
                )}
                <button onClick={() => handleAction(obj.id, 'delete')}
                  className="w-8 flex items-center justify-center text-white/20 hover:text-red-400 text-xs py-1.5 rounded-lg hover:bg-red-500/[0.06] transition-all">
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {total > PER_PAGE && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <button disabled={page === 1} onClick={() => setPage(p => p - 1)}
            className="px-4 py-2 rounded-xl border border-white/[0.08] text-white/40 hover:text-white disabled:opacity-30 text-sm transition-all">
            Anterior
          </button>
          <span className="text-white/30 text-sm">{page} / {Math.ceil(total / PER_PAGE)}</span>
          <button disabled={page >= Math.ceil(total / PER_PAGE)} onClick={() => setPage(p => p + 1)}
            className="px-4 py-2 rounded-xl border border-white/[0.08] text-white/40 hover:text-white disabled:opacity-30 text-sm transition-all">
            Próxima
          </button>
        </div>
      )}
    </div>
  );
}
