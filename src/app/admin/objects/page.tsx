'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Search, X, MoreVertical, MapPin, QrCode, Eye, Trash2,
  CheckCircle2, Package, RefreshCw, ChevronLeft, ChevronRight,
  AlertTriangle, Tag, User
} from 'lucide-react';
import { api, parseApiError } from '@/lib/api';
import { toast } from 'sonner';

interface Obj {
  id: string; title: string; category: string; status: string;
  location?: string; qr_code?: string; unique_code?: string;
  owner_name?: string; owner_email?: string;
  created_at: string; is_legacy?: boolean; description?: string;
}

const STATUS_STYLE: Record<string, string> = {
  lost:     'text-red-400 bg-red-500/10 border-red-500/20',
  found:    'text-teal-400 bg-teal-500/10 border-teal-500/20',
  returned: 'text-green-400 bg-green-500/10 border-green-500/20',
  stolen:   'text-orange-400 bg-orange-500/10 border-orange-500/20',
  protect:  'text-blue-400 bg-blue-500/10 border-blue-500/20',
};
const STATUS_LABEL: Record<string, string> = {
  lost: 'Perdido', found: 'Achado', returned: 'Recuperado',
  stolen: 'Roubado', protect: 'Protegido',
};
const STATUS_DOT: Record<string, string> = {
  lost: 'bg-red-400', found: 'bg-teal-400', returned: 'bg-green-400',
  stolen: 'bg-orange-400', protect: 'bg-blue-400',
};
const CATEGORY_EMOJI: Record<string, string> = {
  phone:'📱', wallet:'👛', keys:'🔑', bag:'🎒', pet:'🐾',
  bike:'🚲', document:'📄', jewelry:'💍', electronics:'💻', clothing:'👕', other:'📦',
};

const STATUS_FILTERS = [
  { value: 'all',      label: 'Todos' },
  { value: 'lost',     label: 'Perdidos' },
  { value: 'found',    label: 'Achados' },
  { value: 'returned', label: 'Recuperados' },
  { value: 'stolen',   label: 'Roubados' },
];

function ObjectCard({ obj, onAction }: {
  obj: Obj;
  onAction: (id: string, action: string) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const code = obj.qr_code ?? obj.unique_code ?? '';
  const date = new Date(obj.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: '2-digit' });

  return (
    <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-4 hover:border-white/[0.10] transition-all group">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="text-xl flex-shrink-0">{CATEGORY_EMOJI[obj.category] ?? '📦'}</span>
          <div className="min-w-0">
            <p className="text-white/85 text-sm font-semibold leading-tight truncate">{obj.title}</p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${STATUS_DOT[obj.status] ?? 'bg-white/20'}`} />
              <span className={`text-[10px] font-semibold ${STATUS_STYLE[obj.status]?.split(' ')[0] ?? 'text-white/40'}`}>
                {STATUS_LABEL[obj.status] ?? obj.status}
              </span>
              {obj.is_legacy && (
                <span className="text-[9px] text-yellow-400/60 bg-yellow-500/10 border border-yellow-500/15 px-1.5 py-0.5 rounded-full">Webjetos</span>
              )}
            </div>
          </div>
        </div>
        <div className="relative flex-shrink-0">
          <button onClick={() => setMenuOpen(!menuOpen)}
            className="w-7 h-7 flex items-center justify-center text-white/15 hover:text-white hover:bg-white/[0.06] rounded-lg opacity-0 group-hover:opacity-100 transition-all">
            <MoreVertical className="w-3.5 h-3.5" />
          </button>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 top-8 z-20 w-48 bg-[#0d1420] border border-white/[0.1] rounded-2xl shadow-2xl p-1.5">
                <button onClick={() => { onAction(obj.id, 'view'); setMenuOpen(false); }}
                  className="flex items-center gap-2.5 w-full px-3 py-2 rounded-xl text-xs text-white/60 hover:text-white hover:bg-white/[0.06] transition-all">
                  <Eye className="w-3.5 h-3.5" /> Ver detalhes
                </button>
                <button onClick={() => { onAction(obj.id, 'qr'); setMenuOpen(false); }}
                  className="flex items-center gap-2.5 w-full px-3 py-2 rounded-xl text-xs text-white/60 hover:text-white hover:bg-white/[0.06] transition-all">
                  <QrCode className="w-3.5 h-3.5" /> Abrir QR Code
                </button>
                {obj.status !== 'returned' && (
                  <button onClick={() => { onAction(obj.id, 'returned'); setMenuOpen(false); }}
                    className="flex items-center gap-2.5 w-full px-3 py-2 rounded-xl text-xs text-green-400/70 hover:text-green-400 hover:bg-green-500/[0.08] transition-all">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Marcar recuperado
                  </button>
                )}
                <div className="my-1 border-t border-white/[0.06]" />
                <button onClick={() => { onAction(obj.id, 'delete'); setMenuOpen(false); }}
                  className="flex items-center gap-2.5 w-full px-3 py-2 rounded-xl text-xs text-red-400/70 hover:text-red-400 hover:bg-red-500/[0.08] transition-all">
                  <Trash2 className="w-3.5 h-3.5" /> Remover objeto
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Info */}
      <div className="space-y-1 mb-3">
        {obj.owner_name && (
          <p className="text-white/30 text-xs flex items-center gap-1.5 truncate">
            <User className="w-3 h-3 flex-shrink-0 text-white/20" />
            {obj.owner_name}
          </p>
        )}
        {obj.location && (
          <p className="text-white/25 text-xs flex items-center gap-1.5 truncate">
            <MapPin className="w-3 h-3 flex-shrink-0 text-white/20" />
            {typeof obj.location === 'string' ? obj.location : JSON.stringify(obj.location)}
          </p>
        )}
        <div className="flex items-center justify-between">
          {code && <p className="text-white/15 text-[10px] font-mono truncate">{code}</p>}
          <p className="text-white/15 text-[10px] ml-auto">{date}</p>
        </div>
      </div>

      {/* Ações rápidas */}
      <div className="flex gap-1.5 pt-2 border-t border-white/[0.05]">
        <button onClick={() => onAction(obj.id, 'view')}
          className="flex-1 flex items-center justify-center gap-1 text-white/25 hover:text-white text-xs py-1.5 rounded-lg hover:bg-white/[0.05] transition-all">
          <Eye className="w-3 h-3" /> Ver
        </button>
        <button onClick={() => onAction(obj.id, 'qr')}
          className="flex-1 flex items-center justify-center gap-1 text-white/25 hover:text-teal-400 text-xs py-1.5 rounded-lg hover:bg-teal-500/[0.06] transition-all">
          <QrCode className="w-3 h-3" /> QR
        </button>
        {obj.status !== 'returned' && (
          <button onClick={() => onAction(obj.id, 'returned')}
            className="flex-1 flex items-center justify-center gap-1 text-white/25 hover:text-green-400 text-xs py-1.5 rounded-lg hover:bg-green-500/[0.06] transition-all">
            <CheckCircle2 className="w-3 h-3" /> OK
          </button>
        )}
        <button onClick={() => onAction(obj.id, 'delete')}
          className="w-8 flex items-center justify-center text-white/15 hover:text-red-400 text-xs py-1.5 rounded-lg hover:bg-red-500/[0.06] transition-all">
          <Trash2 className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}

export default function AdminObjects() {
  const router = useRouter();
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
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page, search, status]);

  useEffect(() => { load(); }, [load]);

  const handleAction = async (id: string, action: string) => {
    try {
      if (action === 'delete') {
        if (!confirm('Remover este objeto permanentemente?')) return;
        await api.delete(`/admin/objects/${id}`);
        toast.success('Objeto removido');
      } else if (action === 'returned') {
        await api.patch(`/admin/objects/${id}`, { status: 'returned' });
        toast.success('Marcado como recuperado');
      } else if (action === 'view') {
        router.push(`/admin/objects/${id}`);
        return;
      } else if (action === 'qr') {
        const obj = objects.find(o => o.id === id);
        const code = obj?.qr_code ?? obj?.unique_code;
        if (code) window.open(`/scan/${code}`, '_blank');
        return;
      }
      load();
    } catch (e) {
      toast.error(parseApiError(e));
    }
  };

  const totalPages = Math.ceil(total / PER_PAGE);

  // Contagens por status (da página atual)
  const statusCounts = objects.reduce((acc, o) => {
    acc[o.status] = (acc[o.status] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="p-5 md:p-7 max-w-7xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-white text-xl font-bold tracking-tight">Objetos</h1>
          <p className="text-white/25 text-xs mt-0.5">{total.toLocaleString('pt-BR')} registrados</p>
        </div>
        <button onClick={load} disabled={loading}
          className="flex items-center gap-2 px-3 py-2 bg-white/[0.04] hover:bg-white/[0.07] border border-white/[0.07] rounded-xl text-white/40 hover:text-white text-xs transition-all disabled:opacity-40">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Atualizar
        </button>
      </div>

      {/* Stats rápidas */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { key: 'lost',     label: 'Perdidos',    color: 'text-red-400 bg-red-500/10 border-red-500/15' },
          { key: 'found',    label: 'Achados',     color: 'text-teal-400 bg-teal-500/10 border-teal-500/15' },
          { key: 'returned', label: 'Recuperados', color: 'text-green-400 bg-green-500/10 border-green-500/15' },
          { key: 'stolen',   label: 'Roubados',    color: 'text-orange-400 bg-orange-500/10 border-orange-500/15' },
        ].map(s => (
          <button key={s.key} onClick={() => { setStatus(s.key); setPage(1); }}
            className={`p-3 rounded-2xl border text-left transition-all hover:opacity-80 ${s.color} ${status === s.key ? 'ring-1 ring-current ring-opacity-30' : ''}`}>
            <p className="text-lg font-bold leading-none">{statusCounts[s.key] ?? 0}</p>
            <p className="text-[10px] opacity-60 mt-0.5">{s.label}</p>
          </button>
        ))}
      </div>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/25" />
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="Buscar título, código QR, dono..."
            className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl pl-9 pr-9 py-2.5 text-white placeholder-white/20 text-sm outline-none focus:border-teal-500/40 transition-all" />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/20 hover:text-white">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {STATUS_FILTERS.map(f => (
            <button key={f.value} onClick={() => { setStatus(f.value); setPage(1); }}
              className={`px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                status === f.value
                  ? 'bg-teal-500/15 text-teal-400 border border-teal-500/25'
                  : 'bg-white/[0.03] text-white/35 border border-white/[0.07] hover:text-white hover:bg-white/[0.06]'
              }`}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-36 bg-white/[0.02] rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : objects.length === 0 ? (
        <div className="text-center py-16 text-white/20">
          <Package className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Nenhum objeto encontrado</p>
          {search && <p className="text-xs mt-1 opacity-60">Tente buscar por outro termo</p>}
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {objects.map(obj => (
            <ObjectCard key={obj.id} obj={obj} onAction={handleAction} />
          ))}
        </div>
      )}

      {/* Paginação */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-white/25 text-xs">
            {((page - 1) * PER_PAGE) + 1}–{Math.min(page * PER_PAGE, total)} de {total.toLocaleString('pt-BR')}
          </p>
          <div className="flex gap-1">
            <button disabled={page === 1} onClick={() => setPage(p => p - 1)}
              className="w-8 h-8 flex items-center justify-center rounded-lg border border-white/[0.08] text-white/35 hover:text-white disabled:opacity-30 transition-all">
              <ChevronLeft className="w-4 h-4" />
            </button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const p = page <= 3 ? i + 1 : page - 2 + i;
              if (p > totalPages) return null;
              return (
                <button key={p} onClick={() => setPage(p)}
                  className={`w-8 h-8 flex items-center justify-center rounded-lg text-xs transition-all ${
                    p === page ? 'bg-teal-500 text-white' : 'border border-white/[0.08] text-white/35 hover:text-white'
                  }`}>
                  {p}
                </button>
              );
            })}
            <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}
              className="w-8 h-8 flex items-center justify-center rounded-lg border border-white/[0.08] text-white/35 hover:text-white disabled:opacity-30 transition-all">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
