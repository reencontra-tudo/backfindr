'use client';
// Feed «Ocorrências recentes» — parte interativa. O PRIMEIRO lote de cards chega pronto no HTML do servidor
// (initialItems) e continua na tela enquanto o navegador carrega: nada é apagado nem «pisca».
//
// Região: o Feed SEMPRE abre em «Todas as regiões» e NÃO detecta localização ao carregar. A rota própria
// /api/v1/feed/geo só é chamada quando a pessoa escolhe «Perto de mim» ou «Só a minha cidade» (nada é guardado nem
// mostrado a outras pessoas). Se não localizar (fora do Brasil ou falha), volta para «Todas as regiões» e mostra um
// aviso. Ao trocar de região a lista só esmaece e é trocada de uma vez (sem esqueleto nem tela vazia no meio).
//
// Aparência: cada ocorrência é uma «publicação» (foto, título, meta, local e data, ações), sem caixas pesadas.
//
// Esta tela NÃO usa o cliente axios da aplicação (que redireciona para o login num 401): só fetch simples
// para um endpoint público que nunca devolve 401.
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  MapPin, Newspaper, Search, Map as MapIcon, PlusCircle,
  Smartphone, Wallet, Key, Backpack, PawPrint, Bike, Car, FileText, Gem, Laptop, Shirt, Package, type LucideIcon,
} from 'lucide-react';
import ShareModal from '@/components/ShareModal';
import { APP_URL } from '@/lib/constants';
import { relativeTimeLabel } from '@/lib/feed/time';
import { FEED_CATEGORY_LABELS, type FeedCategoryKey } from '@/lib/feed/category';
import { feedEvents, feedOrigin } from '@/lib/feed/analytics';
import type { FeedItem } from '@/lib/feed/query';
import { ConviteFim } from './FeedCta';

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

// Situação: texto + pontinho colorido (a cor é reforço; o texto é sempre escrito)
const STATUS_TEXT: Record<string, string> = { lost: 'text-amber-200', found: 'text-teal-200', stolen: 'text-red-200' };
const STATUS_DOT: Record<string, string> = { lost: 'bg-amber-300', found: 'bg-teal-300', stolen: 'bg-red-300' };

const CATEGORY_ICON: Record<FeedCategoryKey, LucideIcon> = {
  pet: PawPrint, document: FileText, phone: Smartphone, wallet: Wallet, keys: Key, bag: Backpack,
  bike: Bike, vehicle: Car, jewelry: Gem, electronics: Laptop, clothing: Shirt, other: Package,
};

// Carregamento híbrido: os 12 cards do HTML + até 2 lotes automáticos ao rolar = 3 lotes (36 cards). Depois o automático PARA e
// o botão «Ver mais ocorrências» (link real para /feed/pagina/N) carrega mais 12 por clique.
export const LOTES_AUTOMATICOS = 3;
const CARREGAMENTOS_AUTOMATICOS = LOTES_AUTOMATICOS - 1;
/** Ainda pode carregar sozinho ao rolar? `lotesAutomaticos` = lotes que vieram sozinhos até agora (o do HTML não conta; o clique em «Ver mais» também não). */
export const podeCarregarAutomatico = (lotesAutomaticos: number) => lotesAutomaticos < CARREGAMENTOS_AUTOMATICOS;

const selectCls = 'min-h-[44px] w-full rounded-xl border border-white/25 bg-[#10151c] px-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-teal-400 disabled:opacity-60';
const actionCls = 'inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-white/25 px-4 text-sm font-medium text-white hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-teal-400';
// Ações do card (celular): 2 linhas. 1ª: «Ver detalhes» (principal) + «Compartilhar»; 2ª: «Informar que encontrei» sozinha, sem quebrar o texto.
// Tudo alinhado à esquerda e com largura natural: as ações nunca chegam à área do botão de chat (canto inferior direito).
// O ícone de «Compartilhar» tem tamanho fixo (antes encolhia a um ponto). Só classes: a estrutura do HTML é a mesma.
const primaryActionCls = 'inline-flex min-h-[44px] shrink-0 items-center justify-center whitespace-nowrap rounded-xl bg-teal-500 px-3.5 text-sm font-semibold text-[#04110f] hover:bg-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-200 max-[359px]:px-2.5';
const quietActionCls = 'inline-flex min-h-[44px] items-center justify-center gap-1.5 whitespace-nowrap rounded-xl px-2.5 text-center text-[13px] font-medium leading-tight text-white/85 hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-teal-400 max-[359px]:gap-1 max-[359px]:px-1.5 max-[359px]:text-xs [&>svg]:h-[18px] [&>svg]:w-[18px] [&>svg]:shrink-0';

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

function FeedCard({ item, index }: { item: FeedItem; index: number }) {
  const href = `/objeto/${encodeURIComponent(item.code)}`;
  const isSignal = item.origin === 'sinal_publico';
  const [photoFailed, setPhotoFailed] = useState(false);
  const imgRef = useRef<HTMLImageElement | null>(null);
  // Foto que falhou ANTES de a página «acordar» (o erro não chega ao React): confere depois de montar
  useEffect(() => { const el = imgRef.current; if (el && el.complete && el.naturalWidth === 0) setPhotoFailed(true); }, []);
  const withPhoto = Boolean(item.photo_url) && !photoFailed;
  const Icon = CATEGORY_ICON[item.category];

  const body = (
    <div className="min-w-0 flex-1">
      <h2 className="text-lg font-semibold leading-snug text-white">
        <Link href={href} prefetch={false} className="block py-2.5 hover:underline focus:outline-none focus:ring-2 focus:ring-teal-400"
          onClick={() => feedEvents.cardAberto(item.origin)}>{item.title}</Link>
      </h2>
      <p className="flex items-center gap-1.5 text-xs text-white/70">
        <span className={`h-2 w-2 shrink-0 rounded-full ${STATUS_DOT[item.status] ?? 'bg-white/50'}`} aria-hidden />
        <span className={`font-semibold ${STATUS_TEXT[item.status] ?? ''}`}>{item.status_label}</span>
        <span aria-hidden>·</span>
        <span>{FEED_CATEGORY_LABELS[item.category]}</span>
      </p>
      <p className="mt-1 flex items-center gap-1 text-sm text-white/70">
        <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden />
        <span className="min-w-0 truncate" title={item.location_label}>{item.location_label}</span>
        <span aria-hidden className="shrink-0">·</span>
        <time className="shrink-0 whitespace-nowrap" dateTime={item.created_at} suppressHydrationWarning>Registrado {relativeTimeLabel(item.created_at)}</time>
      </p>
      {isSignal && (
        <p className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-white/70">
          <Newspaper className="h-3.5 w-3.5 shrink-0" aria-hidden />
          <span>Origem: notícia pública</span>
          {item.source_url && (
            <a href={item.source_url} target="_blank" rel="nofollow noopener noreferrer" className="inline-flex min-h-[44px] items-center underline decoration-white/40 underline-offset-2 hover:text-white">
              Fonte{item.source_name ? `: ${item.source_name}` : ''}
            </a>
          )}
        </p>
      )}
      <div className={`mt-3 grid grid-cols-[auto_auto] items-center justify-start gap-x-1 gap-y-0.5 sm:flex sm:flex-wrap sm:gap-1.5 ${withPhoto ? '' : '-ml-12 sm:ml-0'}`}>
        <Link href={href} prefetch={false} aria-label={`Ver detalhes: ${item.title}`} className={primaryActionCls}
          onClick={() => feedEvents.cardAberto(item.origin)}>Ver detalhes</Link>
        <span className="flex min-w-0" onClickCapture={() => feedEvents.compartilhar(item.origin)}>
          <ShareModal url={`${APP_URL}${href}`} title={item.title} description={`${item.status_label} · ${item.location_label}`}
            buttonLabel="Compartilhar" buttonClassName={quietActionCls} />
        </span>
        {item.can_report_found && item.status === 'lost' && (
          <Link href="/achei?ref=feed" prefetch={false} className={`${quietActionCls} col-span-2 justify-self-start text-teal-100 sm:col-auto`}
            onClick={() => feedEvents.informarEncontreiClique()}>Informar que encontrei</Link>
        )}
      </div>
    </div>
  );

  return (
    <article className="py-5" data-origin={item.origin} data-photo={withPhoto ? 'sim' : 'nao'}>
      {withPhoto ? (
        <>
          {/* Foto em destaque, largura total, proporção fixa (sem pulo de layout) */}
          <div className="mb-0.5 aspect-[4/3] w-full overflow-hidden rounded-xl bg-white/[0.06] sm:aspect-[16/10]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img ref={imgRef} src={item.photo_url as string} alt={`Foto: ${item.title}`} loading={index < 2 ? 'eager' : 'lazy'} decoding="async"
              onError={() => setPhotoFailed(true)} className="h-full w-full object-cover" />
          </div>
          {body}
        </>
      ) : (
        /* Sem foto: versão compacta, só um ícone pequeno ao lado do título */
        <div className="flex items-start gap-3">
          <span className="mt-2.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/[0.08] text-white/80" aria-hidden>
            <Icon className="h-5 w-5" />
          </span>
          {body}
        </div>
      )}
    </article>
  );
}

/** Bloco explicativo entre os primeiros cards (só na página 1; um único bloco). Texto fixo, igual para todos. */
function FeedAbout() {
  const linkCls = 'inline-flex min-h-[44px] items-center rounded-lg px-3 text-sm font-medium text-teal-100 underline decoration-white/30 underline-offset-2 hover:bg-white/10 hover:text-white focus:outline-none focus:ring-2 focus:ring-teal-400';
  return (
    <aside aria-label="Sobre o Backfindr" className="py-5" data-feed-about>
      <div className="rounded-xl bg-white/[0.05] p-4">
        <h2 className="text-base font-semibold text-white">O Backfindr vai além das publicações</h2>
        <p className="mt-1 text-sm leading-relaxed text-white/80">
          Pesquise por localização e características e descubra possíveis correspondências entre o que foi perdido e o que foi encontrado.
        </p>
        <div className="-ml-3 mt-1 flex flex-wrap items-center">
          <Link href="/buscar" prefetch={false} className={linkCls}>Buscar ocorrências</Link>
          <Link href="/map" prefetch={false} className={linkCls}>Ver no mapa</Link>
        </div>
      </div>
    </aside>
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
  const [geoNotice, setGeoNotice] = useState(false);   // escolheu «Perto de mim»/«Só a minha cidade» e não foi localizado
  const [locating, setLocating] = useState(false);       // procurando a região (só depois de a pessoa escolher)
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [autoLoads, setAutoLoads] = useState(0); // lotes trazidos AUTOMATICAMENTE ao rolar (o clique em «Ver mais» não conta)
  const reqId = useRef(0);
  const sentinel = useRef<HTMLDivElement | null>(null);

  const reload = useCallback(async (s: string, c: string, r: Region, g: Geo | null) => {
    const id = ++reqId.current;
    setLoading(true); setFailed(false);
    try {
      const data = await fetchFeed(buildQuery(s, c, r, g));
      if (id !== reqId.current) return;
      setItems(data.items); setNextCursor(data.next_cursor); setHasMore(data.has_more); setAutoLoads(0); // troca única: a lista recomeça
    } catch {
      if (id === reqId.current) setFailed(true); // mantém o que já está na tela
    } finally {
      if (id === reqId.current) setLoading(false);
    }
  }, []);

  // Abertura. NÃO há detecção de localização ao carregar: ela só roda quando a pessoa escolhe «Perto de mim» ou «Só a minha cidade».
  useEffect(() => { feedEvents.aberto(feedOrigin()); }, []);

  const apply = (s: string, c: string, r: Region, g: Geo | null = geo) => {
    setStatus(s); setCategory(c); setRegion(r);
    void reload(s, c, r, g);
  };

  const chooseRegion = async (value: Region) => {
    feedEvents.filtroAplicado('regiao', value);
    setGeoNotice(false);
    if (value !== 'auto' && value !== 'cidade') { apply(status, category, value); return; }
    const previous = region;
    let g = geo;
    if (!g) {
      setRegion(value); setLocating(true);
      const ctl = new AbortController();
      const timer = setTimeout(() => ctl.abort(), 4000);
      g = await detectGeo(ctl.signal);
      clearTimeout(timer);
      setLocating(false);
      if (g) setGeo(g);
    }
    if (!g || (value === 'cidade' && !g.city)) { // fora do Brasil, falha ou sem cidade: volta para «Todas as regiões»
      setGeoNotice(true);
      if (previous !== 'todas') apply(status, category, 'todas', g); else setRegion('todas');
      return;
    }
    apply(status, category, value, g);
  };

  const loadMore = useCallback(async (origem: 'auto' | 'manual' = 'manual') => {
    if (loading || !hasMore || !nextCursor) return;
    const id = ++reqId.current;
    setLoading(true);
    try {
      const data = await fetchFeed(buildQuery(status, category, region, geo, nextCursor));
      if (id !== reqId.current) return;
      setItems((prev) => { const seen = new Set(prev.map((i) => i.code)); return [...prev, ...data.items.filter((i) => !seen.has(i.code))]; });
      setNextCursor(data.next_cursor); setHasMore(data.has_more);
      if (origem === 'auto') setAutoLoads((n) => n + 1);
    } catch { if (id === reqId.current) setFailed(true); }
    finally { if (id === reqId.current) setLoading(false); }
  }, [loading, hasMore, nextCursor, status, category, region, geo]);

  // Carregamento ao rolar, só até 3 lotes no total (12 do HTML + 2 automáticos). Depois PARA: quem quer mais usa o «Ver mais»
  // (link real para /feed/pagina/N; sem JavaScript funciona do mesmo jeito).
  const autoParou = !podeCarregarAutomatico(autoLoads);
  useEffect(() => {
    const el = sentinel.current;
    if (!el || !hasMore || autoParou || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver((e) => { if (e[0].isIntersecting) void loadMore('auto'); }, { rootMargin: '400px' });
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, autoParou, loadMore]);

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
            <select className={`${selectCls} mt-1`} value={region} disabled={locating} onChange={(e) => { void chooseRegion(e.target.value); }}>
              <option value="todas">Todas as regiões</option>
              <option value="auto">Perto de mim</option>
              <option value="cidade">Só a minha cidade</option>
              {regions.map((u) => <option key={u} value={u}>Estado: {u}</option>)}
            </select>
          </label>
        </div>
      </div>

      {geoNotice && (
        <p role="status" className="mt-4 rounded-lg bg-white/[0.06] px-3 py-2 text-sm text-white/85">
          Não conseguimos identificar sua região. Escolha seu estado para ver ocorrências perto de você.
        </p>
      )}

      <div className={`mt-3 divide-y divide-white/10 transition-opacity ${loading || locating ? 'opacity-60' : ''}`} aria-busy={loading || locating}>
        {items.length === 0 && !loading && !locating ? <EmptyState /> : items.flatMap((it, i) => {
          const card = <FeedCard key={it.code} item={it} index={i} />;
          return page === 1 && i === 2 ? [card, <FeedAbout key="sobre-o-backfindr" />] : [card];
        })}
      </div>
      {failed && <p role="status" className="mt-4 text-sm text-amber-200">Não foi possível atualizar agora. As ocorrências acima continuam válidas; tente de novo em instantes.</p>}

      <nav aria-label="Paginação do Feed" className="mt-6 flex flex-wrap items-center justify-center gap-3 max-[359px]:justify-start">
        {page > 1 && (
          <Link href={page === 2 ? '/feed' : `/feed/pagina/${page - 1}`} prefetch={false} className={actionCls}>Ver ocorrências anteriores</Link>
        )}
        {hasMore && (
          <Link href={`/feed/pagina/${page + 1}`} prefetch={false} className={actionCls}
            onClick={(e) => { e.preventDefault(); void loadMore('manual'); }}>Ver mais ocorrências</Link>
        )}
      </nav>
      {items.length > 0 && (autoParou || !hasMore) && <ConviteFim pagina={page} />}
      <div ref={sentinel} aria-hidden className="h-1" />
    </div>
  );
}
