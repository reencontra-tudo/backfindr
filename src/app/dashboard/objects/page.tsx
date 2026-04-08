'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  Plus, Search, Filter, Package, AlertTriangle,
  CheckCircle2, Clock, ChevronRight, QrCode, LayoutGrid, List
} from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { objectsApi, parseApiError } from '@/lib/api';
import { RegisteredObject, ObjectStatus, ObjectCategory } from '@/types';

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORY_EMOJI: Record<string, string> = {
  phone: '📱', wallet: '👛', keys: '🔑', bag: '🎒', pet: '🐾',
  bike: '🚲', document: '📄', jewelry: '💍', electronics: '💻',
  clothing: '👕', other: '📦',
};

const STATUS_FILTERS: { value: string; label: string; color: string }[] = [
  { value: '',         label: 'Todos',       color: 'text-slate-300' },
  { value: 'lost',     label: 'Perdidos',    color: 'text-red-400' },
  { value: 'found',    label: 'Achados',     color: 'text-brand-400' },
  { value: 'returned', label: 'Recuperados', color: 'text-green-400' },
  { value: 'stolen',   label: 'Roubados',    color: 'text-orange-400' },
];

const STATUS_ICON: Record<string, React.ReactNode> = {
  lost:     <AlertTriangle className="w-3.5 h-3.5" />,
  found:    <Package className="w-3.5 h-3.5" />,
  returned: <CheckCircle2 className="w-3.5 h-3.5" />,
  stolen:   <Clock className="w-3.5 h-3.5" />,
};

const STATUS_COLOR: Record<string, string> = {
  lost:     'text-red-400 bg-red-500/10 border-red-500/20',
  found:    'text-brand-400 bg-brand-500/10 border-brand-500/20',
  returned: 'text-green-400 bg-green-500/10 border-green-500/20',
  stolen:   'text-orange-400 bg-orange-500/10 border-orange-500/20',
};

const STATUS_LABEL: Record<string, string> = {
  lost: 'Perdido', found: 'Achado', returned: 'Recuperado', stolen: 'Roubado',
};

// ─── Object Card ─────────────────────────────────────────────────────────────

function ObjectCard({ obj, view }: { obj: RegisteredObject; view: 'grid' | 'list' }) {
  if (view === 'list') {
    return (
      <Link
        href={`/dashboard/objects/${obj.id}`}
        className="flex items-center gap-4 p-4 glass rounded-xl hover:border-brand-500/30 transition-all group"
      >
        <div className="w-11 h-11 rounded-xl bg-surface-border flex items-center justify-center text-2xl flex-shrink-0">
          {CATEGORY_EMOJI[obj.category] ?? '📦'}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white font-medium text-sm truncate group-hover:text-brand-300 transition-colors">
            {obj.title}
          </p>
          <p className="text-slate-500 text-xs mt-0.5 truncate">{obj.description}</p>
        </div>
        <span className={`hidden sm:inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border flex-shrink-0 ${STATUS_COLOR[obj.status]}`}>
          {STATUS_ICON[obj.status]}
          {STATUS_LABEL[obj.status]}
        </span>
        <p className="text-slate-600 text-xs flex-shrink-0 hidden md:block">
          {formatDistanceToNow(new Date(obj.created_at), { addSuffix: true, locale: ptBR })}
        </p>
        <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-brand-400 transition-colors flex-shrink-0" />
      </Link>
    );
  }

  return (
    <Link
      href={`/dashboard/objects/${obj.id}`}
      className="glass rounded-2xl p-5 hover:border-brand-500/30 transition-all group flex flex-col"
    >
      {obj.photos?.[0] ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={obj.photos[0]}
          alt={obj.title}
          className="w-full h-32 object-cover rounded-xl mb-4 border border-surface-border"
        />
      ) : (
        <div className="w-full h-32 bg-surface-border rounded-xl mb-4 flex items-center justify-center text-4xl">
          {CATEGORY_EMOJI[obj.category] ?? '📦'}
        </div>
      )}

      <div className="flex items-start justify-between gap-2 mb-2">
        <p className="text-white font-display font-semibold text-sm leading-tight group-hover:text-brand-300 transition-colors line-clamp-2">
          {obj.title}
        </p>
        <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border flex-shrink-0 ${STATUS_COLOR[obj.status]}`}>
          {STATUS_LABEL[obj.status]}
        </span>
      </div>

      <p className="text-slate-500 text-xs line-clamp-2 mb-3 flex-1">{obj.description}</p>

      <div className="flex items-center justify-between mt-auto">
        <div className="flex items-center gap-1 text-slate-600">
          <QrCode className="w-3 h-3" />
          <span className="text-xs font-mono">{obj.unique_code.slice(0, 8)}</span>
        </div>
        <p className="text-slate-600 text-xs">
          {formatDistanceToNow(new Date(obj.created_at), { addSuffix: true, locale: ptBR })}
        </p>
      </div>
    </Link>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ObjectsPage() {
  const [objects, setObjects] = useState<RegisteredObject[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [view, setView] = useState<'grid' | 'list'>('list');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const PAGE_SIZE = 20;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await objectsApi.list({
        status: statusFilter || undefined,
        page,
        size: PAGE_SIZE,
      });
      setObjects(data?.items ?? []);
      setTotal(data?.total ?? 0);
    } catch (err) {
      toast.error(parseApiError(err));
    } finally {
      setLoading(false);
    }
  }, [statusFilter, page]);

  useEffect(() => { load(); }, [load]);

  // Client-side search filter
  const filtered = objects.filter((o) =>
    search
      ? o.title.toLowerCase().includes(search.toLowerCase()) ||
        o.description.toLowerCase().includes(search.toLowerCase())
      : true
  );

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-start justify-between mb-6 gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-white">Meus Objetos</h1>
          <p className="text-slate-400 text-sm mt-0.5">
            {total > 0 ? `${total} objeto${total > 1 ? 's' : ''} registrado${total > 1 ? 's' : ''}` : 'Nenhum objeto ainda'}
          </p>
        </div>
        <Link
          href="/dashboard/objects/new"
          className="flex items-center gap-2 bg-brand-500 hover:bg-brand-400 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-all glow-teal flex-shrink-0"
        >
          <Plus className="w-4 h-4" />
          Registrar
        </Link>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por título ou descrição..."
            className="w-full bg-surface-card border border-surface-border rounded-xl pl-9 pr-4 py-2.5 text-slate-100 placeholder-slate-500 text-sm outline-none focus:border-brand-500 transition-colors"
          />
        </div>

        {/* Status filter */}
        <div className="flex items-center gap-1 glass rounded-xl p-1">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => { setStatusFilter(f.value); setPage(1); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                statusFilter === f.value
                  ? `bg-surface ${f.color}`
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* View toggle */}
        <div className="flex items-center gap-1 glass rounded-xl p-1">
          <button
            onClick={() => setView('list')}
            className={`p-1.5 rounded-lg transition-colors ${view === 'list' ? 'bg-surface text-white' : 'text-slate-500 hover:text-white'}`}
          >
            <List className="w-4 h-4" />
          </button>
          <button
            onClick={() => setView('grid')}
            className={`p-1.5 rounded-lg transition-colors ${view === 'grid' ? 'bg-surface text-white' : 'text-slate-500 hover:text-white'}`}
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className={view === 'grid' ? 'grid sm:grid-cols-2 lg:grid-cols-3 gap-4' : 'space-y-2'}>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className={`bg-surface-card rounded-2xl animate-pulse ${view === 'grid' ? 'h-52' : 'h-16'}`} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20">
          <div className="text-5xl mb-4">📦</div>
          <p className="text-slate-400 font-display font-semibold text-lg mb-2">
            {search || statusFilter ? 'Nenhum resultado encontrado' : 'Nenhum objeto registrado'}
          </p>
          <p className="text-slate-500 text-sm mb-6">
            {search || statusFilter
              ? 'Tente outros filtros ou termos de busca.'
              : 'Registre seu primeiro objeto e receba um QR Code exclusivo.'}
          </p>
          {!search && !statusFilter && (
            <Link
              href="/dashboard/objects/new"
              className="inline-flex items-center gap-2 bg-brand-500 hover:bg-brand-400 text-white text-sm font-semibold px-6 py-3 rounded-xl transition-all glow-teal"
            >
              <Plus className="w-4 h-4" />
              Registrar primeiro objeto
            </Link>
          )}
        </div>
      ) : (
        <>
          <div className={view === 'grid' ? 'grid sm:grid-cols-2 lg:grid-cols-3 gap-4' : 'space-y-2'}>
            {filtered.map((obj) => (
              <ObjectCard key={obj.id} obj={obj} view={view} />
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-8">
              <button
                onClick={() => setPage((p) => Math.max(p - 1, 1))}
                disabled={page === 1}
                className="px-4 py-2 glass rounded-lg text-sm text-slate-300 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              >
                Anterior
              </button>
              <span className="text-slate-500 text-sm px-2">
                {page} / {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
                disabled={page === totalPages}
                className="px-4 py-2 glass rounded-lg text-sm text-slate-300 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              >
                Próxima
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
