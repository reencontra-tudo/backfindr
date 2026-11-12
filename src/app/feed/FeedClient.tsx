'use client';
// Feed «Ocorrências recentes» — parte interativa. O PRIMEIRO lote de cards chega pronto no HTML do servidor
// (initialItems) e continua na tela enquanto o navegador carrega: nada é apagado nem «pisca».
//
// Como a reordenação por localização evita «piscar»: o conteúdo do servidor fica visível; quando a localização
// do visitante chega (rota própria /api/v1/feed/geo, no mesmo site; nada é guardado nem mostrado a outras pessoas),
// buscamos a lista regional e trocamos tudo de uma vez só, num único setState (a lista só fica levemente
// esmaecida enquanto carrega, sem esqueleto e sem tela vazia no meio do caminho).
//
// Esta tela NÃO usa o cliente axios da aplicação (que redireciona para o login num 401): só fetch simples
// para um endpoint público que nunca devolve 401.
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { MapPin, Clock, Newspaper, Search, Map as MapIcon, PlusCircle } from 'lucide-react';
import ObjectThumb from '@/components/ObjectThumb';
import ShareModal from '@/components/ShareModal';
import { APP_URL } from '@/lib/constants';
import { relativeTimeLabel } from '@/lib/feed/time';
import { FEED_CATEGORY_LABELS } from '@/lib/feed/category';
import { feedEvents, feedOrigin } from '@/lib/feed/analytics';
import type { FeedItem } from '@/lib/feed/query';

interface Props {
  initialItems: FeedItem[];
  initialNextCursor: string | null;
  initialHasMore: boolean;
  page: number;
  regions: string[];
}

type Region = 'auto' | 'todas' | 'cidade' | string; // string = UF escolhida
interface Geo { city: string | null; uf: string }

const STATUS_OPTIONS = [
  { value: 'all', label: 'Todos' },
  { value: 'lost', label: 'Perdidos' },
  { value: 'found', label: 'Achados' },
  { value: 'stolen', label: 'Roubados' },
];

const BADGE: Record<string, string> = {
  lost: 'bg-amber-500/20 text-amber-100 border-amber-400/50',
  found: 'bg-teal-500/20 text-teal-100 border-teal-400/50',
  stolen: 'bg-red-500/20 text-red-100 border-red-400/50',
};

const selectCls = 'min-h-[44px] w-full rounded-xl border border-white/25 bg-[#10151c] px-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-teal-400';
const actionCls = 'inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-white/25 px-4 text-sm font-medium text-white hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-teal-400';

function buildQuery(status: string, category: string, region: Region, geo: Geo | null, cursor?: string | null) {
  const q = new URLSearchParams();
  if (status !== 'all') q.set('status', status);
  if (category !== 'all') q.set('categoria', category);
  if ((region === 'auto' || region === 'cidade') && geo) {
    if (geo.city) q.set('cidade', geo.city);
    q.set('uf', geo.uf);
    if (region === 'cidade' && geo.city) q.set('escopo', 'cidade');
  } else if (region !== 'auto' && region !== 'todas' && region !== 'cidade') {
    q.set('uf', region);
  }
  if (cursor) q.set('cursor', cursor);
  return q.toString();
}

interface ApiResponse { items: FeedItem[]; next_cursor: string | null; has_more: boolean }

async function fetchFeed(qs: string): Promise<ApiResponse> {
  const res = await fetch(`/api/v1/feed${qs ? `?${qs}` : ''}`, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`feed ${res.status}`);
  return res.json();
}

async function detectGeo(signal: AbortSignal): Promise<Geo | null> {
  // Rota própria (mesmo site). Só o Brasil conta; qualquer falha, outro país ou sigla inválida = não localizado.
  try {
    const r = await fetch('/api/v1/feed/geo', { signal, cache: 'no-store', headers: { Accept: 'application/json' } });
    if (!r.ok) return null;
    const d = await r.json();
    if (d?.country !== 'BR' || typeof d?.uf !== 'string' || !/^[A-Z]{2}$/.test(d.uf)) return null;
    return { city: typeof d.city === 'string' && d.city ? d.city.slice(0, 60) : null, uf: d.uf };
  } catch { return null; }
}

function FeedCard({ item }: { item: FeedItem }) {
  const href = `/objeto/${encodeURIComponent(item.code)}`;
  const isSignal = item.origin === 'sinal_publico';
  return (
    <article className="overflow-hidden rounded-2xl border border-white/15 bg-white/[0.04]" data-origin={item.origin}>
      <div className="relative">
        <ObjectThumb photoUrl={item.photo_url} category={item.category} size="hero" className="h-44 w-full" alt={item.has_photo ? `Foto: ${item.title}` : ''} />
        {!item.has_photo && (
          <span className="absolute bottom-2 left-2 rounded-md bg-black/60 px-2 py-0.5 text-xs text-white/85">Sem foto</span>
        )}
      </div>
      <div className="space-y-3 p-4">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className={`rounded-full border px-2.5 py-1 font-semibold ${BADGE[item.status] ?? ''}`}>{item.status_label}</span>
          <span className="rounded-full border border-white/20 px-2.5 py-1 text-white/80">{FEED_CATEGORY_LABELS[item.category]}</span>
        </div>
        <h2 className="-my-2 text-base font-semibold leading-snug text-white">
          <Link href={href} prefetch={false} className="block py-3 hover:underline focus:outline-none focus:ring-2 focus:ring-teal-400"
            onClick={() => feedEvents.cardAberto(item.origin)}>{item.title}</Link>
        </h2>
        <p className="flex items-start gap-1.5 text-sm text-white/75"><MapPin className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />{item.location_label}</p>
        <p className="flex items-center gap-1.5 text-sm text-white/75">
          <Clock className="h-4 w-4 shrink-0" aria-hidden />
          <time dateTime={item.created_at} suppressHydrationWarning>Registrado {relativeTimeLabel(item.created_at)}</time>
        </p>
        {isSignal && (
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg bg-white/[0.06] px-3 py-2 text-sm text-white/85">
            <Newspaper className="h-4 w-4 shrink-0" aria-hidden />
            <span>Origem: notícia pública</span>
            {item.source_url && (
              <a href={item.source_url} target="_blank" rel="nofollow noopener noreferrer" className="inline-flex min-h-[44px] items-center underline decoration-white/40 underline-offset-2 hover:text-white">
                Fonte{item.source_name ? `: ${item.source_name}` : ''}
              </a>
            )}
          </p>
        )}
        <div className="flex flex-wrap gap-2 pt-1">
          <Link href={href} prefetch={false} aria-label={`Ver detalhes: ${item.title}`} className={actionCls}
            onClick={() => feedEvents.cardAberto(item.origin)}>Ver detalhes</Link>
          <span onClickCapture={() => feedEvents.compartilhar(item.origin)}>
            <ShareModal url={`${APP_URL}${href}`} title={item.title} description={`${item.status_label} · ${item.location_label}`}
              buttonLabel="Compartilhar" buttonClassName={actionCls} />
          </span>
          {item.can_report_found && (
            <Link href="/achei?ref=feed" prefetch={false} className={`${actionCls} border-teal-400/60 text-teal-100`}
              onClick={() => feedEvents.informarEncontreiClique()}>Informar que encontrei</Link>
          )}
        </div>
      </div>
    </article>
  );
}

function EmptyState() {
  return (
    <section className="rounded-2xl border border-white/15 bg-white/[0.04] p-6 text-center" aria-live="polite">
      <h2 className="text-lg font-semibold">Nenhuma ocorrência recente nesta seleção</h2>
      <p className="mt-2 text-sm text-white/75">Não há registros recentes para essa região e esses filtros. Você pode procurar de outras formas:</p>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-center">
        <Link href="/map" className={actionCls}><MapIcon className="h-4 w-4" aria-hidden />Ver o mapa</Link>
        <Link href="/buscar" className={actionCls}><Search className="h-4 w-4" aria-hidden />Buscar objeto</Link>
        <Link href="/auth/register?ref=feed" className={`${actionCls} border-teal-400/60 text-teal-100`}><PlusCircle className="h-4 w-4" aria-hidden />Cadastrar uma ocorrência</Link>
      </div>
    </section>
  );
}

export default function FeedClient({ initialItems, initialNextCursor, initialHasMore, page, regions }: Props) {
  const [items, setItems] = useState<FeedItem[]>(initialItems);
  const [nextCursor, setNextCursor] = useState<string | null>(initialNextCursor);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [status, setStatus] = useState('all');
  const [category, setCategory] = useState('all');
  const [region, setRegion] = useState<Region>('todas');
  const [geo, setGeo] = useState<Geo | null>(null);
  const [geoUnknown, setGeoUnknown] = useState(false); // detecção terminou sem localizar (aviso)
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const reqId = useRef(0);
  const sentinel = useRef<HTMLDivElement | null>(null);

  const reload = useCallback(async (s: string, c: string, r: Region, g: Geo | null) => {
    const id = ++reqId.current;
    setLoading(true); setFailed(false);
    try {
      const data = await fetchFeed(buildQuery(s, c, r, g));
      if (id !== reqId.current) return;
      setItems(data.items); setNextCursor(data.next_cursor); setHasMore(data.has_more); // troca única
    } catch {
      if (id === reqId.current) setFailed(true); // mantém o que já está na tela
    } finally {
      if (id === reqId.current) setLoading(false);
    }
  }, []);

  // Abertura + localização (só na primeira página; as demais mantêm a lista que o servidor entregou)
  useEffect(() => {
    feedEvents.aberto(feedOrigin());
    if (page !== 1) return;
    let cancelled = false;
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 4000);
    detectGeo(ctl.signal).then((g) => {
      clearTimeout(timer);
      if (cancelled) return;
      if (!g) { setGeoUnknown(true); return; } // mantém «Todas as regiões» e mostra o aviso
      setGeo(g); setRegion('auto');
      void reload('all', 'all', 'auto', g);
    });
    return () => { cancelled = true; clearTimeout(timer); ctl.abort(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const apply = (s: string, c: string, r: Region) => {
    setStatus(s); setCategory(c); setRegion(r);
    void reload(s, c, r, geo);
  };

  const loadMore = useCallback(async () => {
    if (loading || !hasMore || !nextCursor) return;
    const id = ++reqId.current;
    setLoading(true);
    try {
      const data = await fetchFeed(buildQuery(status, category, region, geo, nextCursor));
      if (id !== reqId.current) return;
      setItems((prev) => { const seen = new Set(prev.map((i) => i.code)); return [...prev, ...data.items.filter((i) => !seen.has(i.code))]; });
      setNextCursor(data.next_cursor); setHasMore(data.has_more);
    } catch { if (id === reqId.current) setFailed(true); }
    finally { if (id === reqId.current) setLoading(false); }
  }, [loading, hasMore, nextCursor, status, category, region, geo]);

  // Carregamento contínuo ao rolar (o link «Ver mais» abaixo continua existindo e funcionando sem JavaScript)
  useEffect(() => {
    const el = sentinel.current;
    if (!el || !hasMore || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver((e) => { if (e[0].isIntersecting) void loadMore(); }, { rootMargin: '400px' });
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, loadMore]);

  return (
    <div>
      <div className="grid gap-3" role="group" aria-label="Filtros do Feed">
        <div className="flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Situação">
          {STATUS_OPTIONS.map((o) => (
            <button key={o.value} type="button" aria-pressed={status === o.value}
              onClick={() => { if (status !== o.value) { feedEvents.filtroAplicado('situacao', o.value); apply(o.value, category, region); } }}
              className={`min-h-[44px] shrink-0 rounded-full border px-4 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-teal-400 ${status === o.value ? 'border-teal-400 bg-teal-500/25 text-white' : 'border-white/25 text-white/85 hover:bg-white/10'}`}>
              {o.label}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2">
          <label className="block text-xs text-white/75">Categoria
            <select className={`${selectCls} mt-1`} value={category}
              onChange={(e) => { feedEvents.filtroAplicado('categoria', e.target.value); apply(status, e.target.value, region); }}>
              <option value="all">Todas as categorias</option>
              {(Object.keys(FEED_CATEGORY_LABELS) as Array<keyof typeof FEED_CATEGORY_LABELS>).map((k) => (
                <option key={k} value={k}>{FEED_CATEGORY_LABELS[k]}</option>
              ))}
            </select>
          </label>
          <label className="block text-xs text-white/75">Cidade ou região
            <select className={`${selectCls} mt-1`} value={region}
              onChange={(e) => { feedEvents.filtroAplicado('regiao', /^[A-Z]{2}$/.test(e.target.value) ? e.target.value : e.target.value); apply(status, category, e.target.value); }}>
              {geo && <option value="auto">Perto de mim</option>}
              {geo?.city && <option value="cidade">Só a minha cidade</option>}
              <option value="todas">Todas as regiões</option>
              {regions.map((u) => <option key={u} value={u}>Estado: {u}</option>)}
            </select>
          </label>
        </div>
      </div>

      {geoUnknown && !geo && (
        <p role="status" className="mt-4 rounded-lg bg-white/[0.06] px-3 py-2 text-sm text-white/85">
          Não conseguimos identificar sua região. Escolha seu estado para ver ocorrências perto de você.
        </p>
      )}

      <div className={`mt-5 grid gap-4 transition-opacity ${loading ? 'opacity-60' : ''}`} aria-busy={loading}>
        {items.length === 0 && !loading ? <EmptyState /> : items.map((it) => <FeedCard key={it.code} item={it} />)}
      </div>
      {failed && <p role="status" className="mt-4 text-sm text-amber-200">Não foi possível atualizar agora. As ocorrências acima continuam válidas; tente de novo em instantes.</p>}

      <nav aria-label="Paginação do Feed" className="mt-6 flex flex-wrap items-center justify-center gap-3">
        {page > 1 && (
          <Link href={page === 2 ? '/feed' : `/feed/pagina/${page - 1}`} prefetch={false} className={actionCls}>Ver ocorrências anteriores</Link>
        )}
        {hasMore && (
          <Link href={`/feed/pagina/${page + 1}`} prefetch={false} className={actionCls}
            onClick={(e) => { e.preventDefault(); void loadMore(); }}>Ver mais ocorrências</Link>
        )}
      </nav>
      <div ref={sentinel} aria-hidden className="h-1" />
    </div>
  );
}
