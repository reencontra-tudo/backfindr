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
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  MapPin, Newspaper, Search, Map as MapIcon, PlusCircle,
  Smartphone, Wallet, Key, Backpack, PawPrint, Bike, Car, FileText, Gem, Laptop, Shirt, Package, LayoutGrid, Rows3, type LucideIcon,
} from 'lucide-react';
import ShareModal from '@/components/ShareModal';
import { APP_URL } from '@/lib/constants';
import { relativeTimeLabel } from '@/lib/feed/time';
import { FEED_CATEGORY_LABELS, type FeedCategoryKey } from '@/lib/feed/category';
import { feedEvents, feedOrigin } from '@/lib/feed/analytics';
import type { FeedItem } from '@/lib/feed/query';
import {
  ESTADO_MAX_CARDS, consumirVoltou, criarEstado, deveRestaurar, descartarEstado, escolherCorte, expandir, instalarRastreadorVoltar,
  lerEstado, obterStorage, registrarMontagem, salvarEstado, tipoNavegacao, type Filtros, type Marco,
} from '@/lib/feed/estado';
import { ConviteFim } from './FeedCta';
import { SITUACAO, T } from './tema';
import {
  PROPORCAO_FOTO_GRADE, classesLargura, classesLista, ehVisualizacao, lerVisualizacao, obterLocalStorage, salvarVisualizacao, type Visualizacao,
} from '@/lib/feed/visualizacao';

interface Props {
  initialItems: FeedItem[];
  initialNextCursor: string | null;
  initialHasMore: boolean;
  page: number;
  regions: string[];
  /** Só para testes: a página nunca passa isto (o servidor sempre desenha «Publicações»). */
  visInicial?: Visualizacao;
}

type Region = 'auto' | 'todas' | 'cidade' | string; // string = UF escolhida
interface Geo { city: string | null; uf: string }

// «Voltar» do navegador: guarda a lista carregada e a rolagem (sessionStorage) e restaura ao voltar. Só no navegador; o HTML do servidor não muda.
if (typeof window !== 'undefined') instalarRastreadorVoltar();
const useIsoLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;
const SALVAR_A_CADA_MS = 400;

const STATUS_OPTIONS = [
  { value: 'all', label: 'Todos' },
  { value: 'lost', label: 'Perdidos' },
  { value: 'found', label: 'Achados' },
  { value: 'stolen', label: 'Roubados' },
];

// Situação: texto + pontinho colorido (a cor é reforço; o texto é sempre escrito). As cores vêm do tema (tema.ts).
const STATUS_TEXT: Record<string, string> = { lost: SITUACAO.lost.texto, found: SITUACAO.found.texto, stolen: SITUACAO.stolen.texto };
const STATUS_DOT: Record<string, string> = { lost: SITUACAO.lost.ponto, found: SITUACAO.found.ponto, stolen: SITUACAO.stolen.ponto };

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

// Faixa de situações (Todos / Perdidos / Achados / Roubados): rola na horizontal quando não cabe. Só classes (sem mudar o HTML).
// Camadas: 2 «tampas» da cor da folha (acompanham a rolagem, attachment local) por cima de 2 sombras fixas nas bordas;
// no começo/fim da rolagem a tampa cobre a sombra daquele lado, então a sombra só aparece do lado em que ainda há mais itens.
const faixaCls = 'flex gap-1.5 overflow-x-auto pb-1 bg-no-repeat '
  + '[background-image:linear-gradient(to_right,var(--f-folha),transparent),linear-gradient(to_left,var(--f-folha),transparent),linear-gradient(to_right,var(--f-faixa-sombra),transparent),linear-gradient(to_left,var(--f-faixa-sombra),transparent)] '
  + '[background-position:left_center,right_center,left_center,right_center] [background-size:28px_100%,28px_100%,20px_100%,20px_100%] '
  + '[background-attachment:local,local,scroll,scroll]';

const selectCls = `min-h-[44px] w-full rounded-xl border bg-[color:var(--f-campo)] px-3 text-sm focus:outline-none focus:ring-2 disabled:opacity-60 ${T.borda} ${T.t1} ${T.foco}`;
const actionCls = `inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border px-4 text-sm font-medium focus:outline-none focus:ring-2 ${T.borda} ${T.t1} ${T.hover} ${T.foco}`;
// Ações do card (celular): 2 linhas. 1ª: «Ver detalhes» (principal) + «Compartilhar»; 2ª: «Informar que encontrei» sozinha, sem quebrar o texto.
// Tudo alinhado à esquerda e com largura natural: as ações nunca chegam à área do botão de chat (canto inferior direito).
// O ícone de «Compartilhar» tem tamanho fixo (antes encolhia a um ponto). Só classes: a estrutura do HTML é a mesma.
const primaryActionCls = `inline-flex min-h-[44px] shrink-0 items-center justify-center whitespace-nowrap rounded-xl px-3.5 text-sm font-semibold focus:outline-none focus:ring-2 max-[359px]:px-2.5 ${T.prim} ${T.foco}`;
const quietBaseCls = `inline-flex min-h-[44px] items-center justify-center gap-1.5 whitespace-nowrap rounded-xl px-2.5 text-center text-[13px] font-medium leading-tight focus:outline-none focus:ring-2 max-[359px]:gap-1 max-[359px]:px-1.5 max-[359px]:text-xs ${T.hover} ${T.foco} [&>svg]:h-[18px] [&>svg]:w-[18px] [&>svg]:shrink-0`;
const quietActionCls = `${quietBaseCls} ${T.t2}`;

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

function FeedCard({ item, index, vis }: { item: FeedItem; index: number; vis: Visualizacao }) {
  const href = `/objeto/${encodeURIComponent(item.code)}`;
  const isSignal = item.origin === 'sinal_publico';
  const [photoFailed, setPhotoFailed] = useState(false);
  const imgRef = useRef<HTMLImageElement | null>(null);
  // Foto que falhou ANTES de a página «acordar» (o erro não chega ao React): confere depois de montar
  useEffect(() => { const el = imgRef.current; if (el && el.complete && el.naturalWidth === 0) setPhotoFailed(true); }, []);
  const withPhoto = Boolean(item.photo_url) && !photoFailed;
  const Icon = CATEGORY_ICON[item.category];
  const sit = SITUACAO[item.status as keyof typeof SITUACAO] ?? SITUACAO.lost;
  const informar = item.can_report_found && item.status === 'lost';

  if (vis === 'grade') {
    // Grade: foto 4:3 (ou bloco da MESMA proporção sem foto), selo da situação sobre a foto, título, cidade–UF e tempo.
    const lugar = (
      <p className={`flex items-center gap-1 text-xs ${T.t3}`}>
        <MapPin className="h-3 w-3 shrink-0" aria-hidden />
        <span className="min-w-0 truncate" title={item.location_label}>{item.location_label}</span>
      </p>
    );
    return (
      <article className={`relative flex min-w-0 flex-col overflow-hidden rounded-xl border bg-[color:var(--f-folha)] shadow-[var(--f-sombra)] ${T.linha}`}
        data-code={item.code} data-origin={item.origin} data-photo={withPhoto ? 'sim' : 'nao'} data-vis="grade">
        <div className={`relative w-full overflow-hidden ${PROPORCAO_FOTO_GRADE} ${withPhoto ? 'bg-[color:var(--f-hover)]' : sit.suave}`}>
          {withPhoto ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img ref={imgRef} src={item.photo_url as string} alt={`Foto: ${item.title}`} loading={index < 4 ? 'eager' : 'lazy'} decoding="async"
              onError={() => setPhotoFailed(true)} className="h-full w-full object-cover" />
          ) : (
            <span className={`flex h-full w-full items-center justify-center ${sit.texto}`} aria-hidden>
              <Icon className="h-10 w-10 opacity-70" />
            </span>
          )}
          {/* Compartilhar: só o ícone (nome acessível mantido), 44 px, no canto superior esquerdo da foto (longe do balão do chat, à direita) */}
          <span className="absolute left-1 top-1 z-10 flex" onClickCapture={() => feedEvents.compartilhar(item.origin)}>
            <ShareModal url={`${APP_URL}${href}`} title={item.title} description={`${item.status_label} · ${item.location_label}`}
              buttonLabel="Compartilhar"
              buttonClassName={`inline-flex h-11 w-11 items-center justify-center rounded-full bg-white/90 text-[0px] shadow focus:outline-none focus:ring-2 ${T.t1} ${T.foco} [&>svg]:h-5 [&>svg]:w-5`} />
          </span>
          <span className={`pointer-events-none absolute bottom-2 left-2 rounded-full px-2.5 py-0.5 text-xs font-semibold text-[color:var(--f-selo-t)] ${sit.selo}`}>{item.status_label}</span>
        </div>
        <div className="flex min-w-0 flex-1 flex-col px-2.5 pb-2.5 pt-1.5">
          <h2 className={`text-sm font-semibold leading-snug ${T.t1}`}>
            <Link href={href} prefetch={false} aria-label={`Ver detalhes: ${item.title}`} className={`line-clamp-2 min-h-[44px] py-1.5 hover:underline focus:outline-none focus:ring-2 ${T.foco}`}
              onClick={() => feedEvents.cardAberto(item.origin)}>{item.title}</Link>
          </h2>
          {lugar}
          <p className={`mt-0.5 text-xs ${T.t3}`}>
            <time dateTime={item.created_at} suppressHydrationWarning>{relativeTimeLabel(item.created_at)}</time>
          </p>
          {isSignal && item.source_name && <p className={`mt-0.5 truncate text-[11px] ${T.t3}`}>Fonte: {item.source_name}</p>}
          {informar && (
            <div className="mt-auto pt-1.5">
              <Link href="/achei?ref=feed" prefetch={false} className={`${quietBaseCls} w-fit max-w-[4.75rem] !whitespace-normal -ml-2 px-2 !text-left !text-[11px] max-[340px]:max-w-[3.9rem] max-[340px]:!px-1 min-[430px]:max-w-[6.5rem] min-[430px]:!text-xs min-[560px]:max-w-none ${T.acao}`}
                onClick={() => feedEvents.informarEncontreiClique()}>Informar que encontrei</Link>
            </div>
          )}
        </div>
      </article>
    );
  }

  const body = (
    <div className="min-w-0 flex-1">
      <h2 className={`text-lg font-semibold leading-snug ${T.t1}`}>
        <Link href={href} prefetch={false} className={`block py-2.5 hover:underline focus:outline-none focus:ring-2 ${T.foco}`}
          onClick={() => feedEvents.cardAberto(item.origin)}>{item.title}</Link>
      </h2>
      <p className={`flex items-center gap-1.5 text-xs ${T.t3}`}>
        <span className={`h-2 w-2 shrink-0 rounded-full ${STATUS_DOT[item.status] ?? 'bg-slate-400'}`} aria-hidden />
        <span className={`font-semibold ${STATUS_TEXT[item.status] ?? ''}`}>{item.status_label}</span>
        <span aria-hidden>·</span>
        <span>{FEED_CATEGORY_LABELS[item.category]}</span>
      </p>
      <p className={`mt-1 flex items-center gap-1 text-sm ${T.t3}`}>
        <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden />
        <span className="min-w-0 truncate" title={item.location_label}>{item.location_label}</span>
        <span aria-hidden className="shrink-0">·</span>
        <time className="shrink-0 whitespace-nowrap" dateTime={item.created_at} suppressHydrationWarning>Registrado {relativeTimeLabel(item.created_at)}</time>
      </p>
      {isSignal && (
        <p className={`mt-1 flex flex-wrap items-center gap-x-2 text-xs ${T.t3}`}>
          <Newspaper className="h-3.5 w-3.5 shrink-0" aria-hidden />
          <span>Origem: notícia pública</span>
          {item.source_url && (
            <a href={item.source_url} target="_blank" rel="nofollow noopener noreferrer" className={`inline-flex min-h-[44px] items-center underline underline-offset-2 hover:text-[color:var(--f-t1)]`}>
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
        {informar && (
          <Link href="/achei?ref=feed" prefetch={false} className={`${quietBaseCls} col-span-2 justify-self-start sm:col-auto ${T.acao}`}
            onClick={() => feedEvents.informarEncontreiClique()}>Informar que encontrei</Link>
        )}
      </div>
    </div>
  );

  return (
    <article className="py-5" data-code={item.code} data-origin={item.origin} data-photo={withPhoto ? 'sim' : 'nao'} data-vis="publicacoes">
      {withPhoto ? (
        <>
          {/* Foto em destaque, largura total, proporção fixa (sem pulo de layout) */}
          <div className="mb-0.5 aspect-[4/3] w-full overflow-hidden rounded-xl bg-[color:var(--f-hover)] sm:aspect-[16/10]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img ref={imgRef} src={item.photo_url as string} alt={`Foto: ${item.title}`} loading={index < 2 ? 'eager' : 'lazy'} decoding="async"
              onError={() => setPhotoFailed(true)} className="h-full w-full object-cover" />
          </div>
          {body}
        </>
      ) : (
        /* Sem foto: versão compacta, só um ícone pequeno ao lado do título */
        <div className="flex items-start gap-3">
          <span className={`mt-2.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${T.aviso} ${T.t2}`} aria-hidden>
            <Icon className="h-5 w-5" />
          </span>
          {body}
        </div>
      )}
    </article>
  );
}

/** Bloco explicativo entre os primeiros cards (só na página 1; um único bloco). Texto fixo, igual para todos. Na Grade ocupa a linha inteira. */
function FeedAbout({ vis }: { vis: Visualizacao }) {
  const linkCls = `inline-flex min-h-[44px] items-center rounded-lg px-3 text-sm font-medium underline underline-offset-2 focus:outline-none focus:ring-2 ${T.acao} ${T.hover} ${T.foco}`;
  return (
    <aside aria-label="Sobre o Backfindr" className={vis === 'grade' ? 'col-span-full py-2' : 'py-5'} data-feed-about>
      <div className={`rounded-xl p-4 ${T.aviso}`}>
        <h2 className={`text-base font-semibold ${T.t1}`}>O Backfindr vai além das publicações</h2>
        <p className={`mt-1 text-sm leading-relaxed ${T.t2}`}>
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
    <section className={`rounded-2xl border p-6 text-center ${T.linha} ${T.aviso} ${T.t1}`} aria-live="polite">
      <h2 className="text-lg font-semibold">Nenhuma ocorrência recente nesta seleção</h2>
      <p className={`mt-2 text-sm ${T.t2}`}>Não há registros recentes para essa região e esses filtros. Você pode procurar de outras formas:</p>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-center">
        <Link href="/map" className={actionCls}><MapIcon className="h-4 w-4" aria-hidden />Ver o mapa</Link>
        <Link href="/buscar" className={actionCls}><Search className="h-4 w-4" aria-hidden />Buscar objeto</Link>
        <Link href="/auth/register?ref=feed" className={`${actionCls} ${T.acao}`}><PlusCircle className="h-4 w-4" aria-hidden />Cadastrar uma ocorrência</Link>
      </div>
    </section>
  );
}

export default function FeedClient({ initialItems, initialNextCursor, initialHasMore, page, regions, visInicial }: Props) {
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
  // Visualização: o servidor sempre desenha «Publicações»; a preferência (Grade) é aplicada no navegador, antes do primeiro desenho pós-hidratação.
  const [vis, setVis] = useState<Visualizacao>(visInicial ?? 'publicacoes');
  const ancora = useRef<{ code: string; top: number } | null>(null);
  const [autoLoads, setAutoLoads] = useState(0); // lotes trazidos AUTOMATICAMENTE ao rolar (o clique em «Ver mais» não conta)
  const reqId = useRef(0);
  const sentinel = useRef<HTMLDivElement | null>(null);
  const [restaurando, setRestaurando] = useState(false); // enquanto a lista e a rolagem voltam: o carregamento automático espera
  const restaurandoRef = useRef(false);
  const congelado = useRef(false);                        // depois do clique que sai da página, não grava mais (o Next zera a rolagem)
  const timerSalvar = useRef<ReturnType<typeof setTimeout> | null>(null);
  const filtrosDaLista = useRef<Filtros>({ status: 'all', category: 'all', region: 'todas', geo: null }); // filtros que geraram a lista na tela
  const marcos = useRef<Marco[]>([{ n: initialItems.length, cursor: initialNextCursor, temMais: initialHasMore }]);
  const foto = useRef({ items, nextCursor, hasMore, autoLoads, vis });
  foto.current = { items, nextCursor, hasMore, autoLoads, vis };

  const reload = useCallback(async (s: string, c: string, r: Region, g: Geo | null) => {
    const id = ++reqId.current;
    setLoading(true); setFailed(false);
    try {
      const data = await fetchFeed(buildQuery(s, c, r, g));
      if (id !== reqId.current) return;
      setItems(data.items); setNextCursor(data.next_cursor); setHasMore(data.has_more); setAutoLoads(0); // troca única: a lista recomeça
      filtrosDaLista.current = { status: s, category: c, region: r, geo: g };
      marcos.current = [{ n: data.items.length, cursor: data.next_cursor, temMais: data.has_more }];
    } catch {
      if (id === reqId.current) setFailed(true); // mantém o que já está na tela
    } finally {
      if (id === reqId.current) setLoading(false);
    }
  }, []);

  // Abertura. NÃO há detecção de localização ao carregar: ela só roda quando a pessoa escolhe «Perto de mim» ou «Só a minha cidade».
  useEffect(() => { feedEvents.aberto(feedOrigin()); }, []);

  // ---- Voltar do navegador: restaurar a lista e a rolagem ----
  // Restaura só em «voltar/avançar» e só com estado guardado válido (versão, idade, página, filtros). Abertura normal, link novo, F5 e nova aba
  // começam do zero (e descartam o estado antigo). Nenhuma API é chamada: os cards e o cursor vêm do sessionStorage.
  const scrollAlvo = useRef(0);
  const scrollAntes = useRef<ScrollRestoration | null>(null);
  const restauradoUmaVez = useRef(false);
  useIsoLayoutEffect(() => {
    if (restauradoUmaVez.current) return;
    restauradoUmaVez.current = true;
    const preferida = lerVisualizacao(obterLocalStorage());
    if (preferida && preferida !== 'publicacoes') setVis(preferida);
    const primeira = registrarMontagem();
    const voltou = deveRestaurar({ tipoNavegacao: tipoNavegacao(), primeiraMontagem: primeira, voltouAgora: consumirVoltou(Date.now()) });
    const storage = obterStorage();
    if (!voltou) { descartarEstado(storage); return; }
    const est = lerEstado(storage, { agora: Date.now(), pagina: page, regioes: regions });
    if (!est) return;
    const itens = est.itens.map(expandir);
    restaurandoRef.current = true; scrollAlvo.current = est.scrollY;
    try { scrollAntes.current = window.history.scrollRestoration; window.history.scrollRestoration = 'manual'; } catch { /* sem problema */ }
    filtrosDaLista.current = est.filtros;
    marcos.current = [{ n: itens.length, cursor: est.cursor, temMais: est.temMais }];
    if (est.vis && ehVisualizacao(est.vis)) setVis(est.vis);   // a lista volta na visualização em que a pessoa estava
    setItems(itens); setNextCursor(est.cursor); setHasMore(est.temMais); setAutoLoads(est.autoLotes);
    setStatus(est.filtros.status); setCategory(est.filtros.category); setRegion(est.filtros.region); setGeo(est.filtros.geo);
    setRestaurando(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // devolve o valor original de history.scrollRestoration ao sair da página
  useEffect(() => () => { try { if (scrollAntes.current) window.history.scrollRestoration = scrollAntes.current; } catch { /* sem problema */ } }, []);

  // Rolagem: espera a lista voltar a ser desenhada (requestAnimationFrame) e confere; qualquer toque/roda/tecla da pessoa cancela.
  useEffect(() => {
    if (!restaurando) return;
    let cancelado = false, frames = 0, raf = 0;
    const fim = () => {
      if (cancelado) return; cancelado = true; cancelAnimationFrame(raf);
      window.removeEventListener('touchstart', fim); window.removeEventListener('wheel', fim); window.removeEventListener('keydown', fim);
      restaurandoRef.current = false; setRestaurando(false);
      feedEvents.estadoRestaurado(foto.current.items.length);
    };
    const tentar = () => {
      if (cancelado) return;
      const alvo = scrollAlvo.current;
      window.scrollTo({ top: alvo, left: 0, behavior: 'instant' as ScrollBehavior });
      frames++;
      const maximo = document.documentElement.scrollHeight - window.innerHeight;
      if (Math.abs(window.scrollY - alvo) <= 2 || (alvo > maximo && window.scrollY >= maximo - 2) || frames >= 20) { fim(); return; }
      raf = requestAnimationFrame(tentar);
    };
    window.addEventListener('touchstart', fim, { passive: true }); window.addEventListener('wheel', fim, { passive: true }); window.addEventListener('keydown', fim);
    raf = requestAnimationFrame(tentar);
    return () => { cancelado = true; cancelAnimationFrame(raf); window.removeEventListener('touchstart', fim); window.removeEventListener('wheel', fim); window.removeEventListener('keydown', fim); };
  }, [restaurando]);

  // ---- Guardar a posição: durante a rolagem (a cada 400 ms), ao carregar mais, ao esconder/sair da página e no clique que sai do Feed ----
  const salvar = useCallback(() => {
    if (restaurandoRef.current || congelado.current) return;
    const f = foto.current;
    const corte = escolherCorte(f.items, marcos.current, { cursor: f.nextCursor, temMais: f.hasMore }, ESTADO_MAX_CARDS);
    if (!corte) return;
    salvarEstado(obterStorage(), criarEstado({
      agora: Date.now(), pagina: page, itens: corte.itens, cursor: corte.cursor, temMais: corte.temMais,
      autoLotes: f.autoLoads, filtros: filtrosDaLista.current, scrollY: window.scrollY, vis: f.vis,
    }));
  }, [page]);
  const agendarSalvar = useCallback(() => {
    if (timerSalvar.current) return;
    timerSalvar.current = setTimeout(() => { timerSalvar.current = null; salvar(); }, SALVAR_A_CADA_MS);
  }, [salvar]);
  useEffect(() => {
    let liberar: ReturnType<typeof setTimeout> | null = null;
    const aoClicar = (e: MouseEvent) => {
      const a = (e.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
      if (!a) return;
      salvar(); // guarda ANTES de o Next trocar de página (e zerar a rolagem)
      const href = a.getAttribute('href') ?? '';
      const sai = href.startsWith('/') && !href.startsWith('/feed') && a.target !== '_blank' && !a.hasAttribute('download') && !e.metaKey && !e.ctrlKey && !e.shiftKey;
      if (sai) { congelado.current = true; if (liberar) clearTimeout(liberar); liberar = setTimeout(() => { congelado.current = false; }, 2500); }
    };
    const aoEsconder = () => { if (document.visibilityState === 'hidden') salvar(); };
    document.addEventListener('click', aoClicar);
    document.addEventListener('visibilitychange', aoEsconder);
    window.addEventListener('pagehide', salvar);
    window.addEventListener('scroll', agendarSalvar, { passive: true });
    return () => {
      document.removeEventListener('click', aoClicar); document.removeEventListener('visibilitychange', aoEsconder);
      window.removeEventListener('pagehide', salvar); window.removeEventListener('scroll', agendarSalvar);
      if (timerSalvar.current) { clearTimeout(timerSalvar.current); timerSalvar.current = null; }
      if (liberar) clearTimeout(liberar);
    };
  }, [salvar, agendarSalvar]);
  useEffect(() => { agendarSalvar(); }, [items, autoLoads, vis, agendarSalvar]); // lista nova ou outro lote: grava (com atraso curto)

  // Trocar a visualização NÃO recarrega nada: a mesma lista (já carregada) é só redesenhada. A rolagem acompanha o card que estava em vista.
  const escolherVis = (v: Visualizacao) => {
    if (v === vis) return;
    const cards = Array.from(document.querySelectorAll<HTMLElement>('article[data-code]'));
    const vista = cards.find((el) => el.getBoundingClientRect().bottom > 8);
    ancora.current = vista ? { code: vista.dataset.code ?? '', top: vista.getBoundingClientRect().top } : null;
    setVis(v);
    salvarVisualizacao(obterLocalStorage(), v);
    feedEvents.visualizacaoAlterada(v);
  };
  useIsoLayoutEffect(() => {
    const a = ancora.current;
    if (!a) return;
    ancora.current = null;
    const alvoTop = Math.max(a.top, 0);   // se o card estava cortado em cima, ele passa a começar no topo da tela
    // Idempotente: confere de novo no quadro seguinte (o navegador pode ajustar a rolagem sozinho quando a altura da lista muda).
    const ajustar = () => {
      const el = Array.from(document.querySelectorAll<HTMLElement>('article[data-code]')).find((x) => x.dataset.code === a.code);
      if (el) window.scrollBy({ top: el.getBoundingClientRect().top - alvoTop, left: 0, behavior: 'instant' as ScrollBehavior });
    };
    ajustar();
    const raf = requestAnimationFrame(() => { ajustar(); });
    return () => cancelAnimationFrame(raf);
  }, [vis]);

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
      const base = foto.current.items;
      const seen = new Set(base.map((i) => i.code));
      const novos = data.items.filter((i) => !seen.has(i.code));
      setItems([...base, ...novos]);
      setNextCursor(data.next_cursor); setHasMore(data.has_more);
      marcos.current = [...marcos.current, { n: base.length + novos.length, cursor: data.next_cursor, temMais: data.has_more }];
      if (origem === 'auto') setAutoLoads((n) => n + 1);
    } catch { if (id === reqId.current) setFailed(true); }
    finally { if (id === reqId.current) setLoading(false); }
  }, [loading, hasMore, nextCursor, status, category, region, geo]);

  // Carregamento ao rolar, só até 3 lotes no total (12 do HTML + 2 automáticos). Depois PARA: quem quer mais usa o «Ver mais»
  // (link real para /feed/pagina/N; sem JavaScript funciona do mesmo jeito).
  const autoParou = !podeCarregarAutomatico(autoLoads);
  useEffect(() => {
    const el = sentinel.current;
    if (!el || !hasMore || autoParou || restaurando || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver((e) => { if (e[0].isIntersecting) void loadMore('auto'); }, { rootMargin: '400px' });
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, autoParou, restaurando, loadMore]);

  return (
    <div className={classesLargura(vis)} data-vis={vis}>
      <div className="grid grid-cols-1 gap-3" role="group" aria-label="Filtros do Feed">
        <div className="flex min-w-0 items-start gap-2">
        <div className={`${faixaCls} min-w-0 flex-1`} role="group" aria-label="Situação">
          {STATUS_OPTIONS.map((o) => (
            <button key={o.value} type="button" aria-pressed={status === o.value}
              onClick={() => { if (status !== o.value) { feedEvents.filtroAplicado('situacao', o.value); apply(o.value, category, region); } }}
              className={`min-h-[44px] shrink-0 rounded-full border px-3 text-sm font-medium focus:outline-none focus:ring-2 ${T.foco} ${status === o.value ? 'border-[color:var(--f-chip-ativo)] bg-[color:var(--f-chip-ativo)] text-[color:var(--f-chip-ativo-t)]' : `${T.borda} ${T.t1} ${T.hover}`}`}>
              {o.label}
            </button>
          ))}
        </div>
        <div role="group" aria-label="Visualização" className="flex shrink-0 gap-1">
          {([['publicacoes', 'Publicações', Rows3], ['grade', 'Grade', LayoutGrid]] as const).map(([valor, nome, Ic]) => (
            <button key={valor} type="button" aria-pressed={vis === valor} aria-label={nome} title={nome} onClick={() => escolherVis(valor)} data-vis-botao={valor}
              className={`inline-flex h-11 w-11 items-center justify-center rounded-xl border focus:outline-none focus:ring-2 ${T.foco} ${vis === valor ? 'border-[color:var(--f-chip-ativo)] bg-[color:var(--f-chip-ativo)] text-[color:var(--f-chip-ativo-t)]' : `${T.borda} ${T.t1} ${T.hover}`}`}>
              <Ic className="h-5 w-5" aria-hidden />
            </button>
          ))}
        </div>
        </div>
        <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2">
          <label className={`block text-xs ${T.t2}`}>Categoria
            <select className={`${selectCls} mt-1`} value={category}
              onChange={(e) => { feedEvents.filtroAplicado('categoria', e.target.value); apply(status, e.target.value, region); }}>
              <option value="all">Todas as categorias</option>
              {(Object.keys(FEED_CATEGORY_LABELS) as Array<keyof typeof FEED_CATEGORY_LABELS>).map((k) => (
                <option key={k} value={k}>{FEED_CATEGORY_LABELS[k]}</option>
              ))}
            </select>
          </label>
          <label className={`block text-xs ${T.t2}`}>Cidade ou região
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
        <p role="status" className={`mt-4 rounded-lg px-3 py-2 text-sm ${T.aviso} ${T.t2}`}>
          Não conseguimos identificar sua região. Escolha seu estado para ver ocorrências perto de você.
        </p>
      )}

      <div className={classesLista(vis, loading || locating)} aria-busy={loading || locating}>
        {items.length === 0 && !loading && !locating ? <EmptyState /> : items.flatMap((it, i) => {
          const card = <FeedCard key={it.code} item={it} index={i} vis={vis} />;
          return page === 1 && i === 2 ? [card, <FeedAbout key="sobre-o-backfindr" vis={vis} />] : [card];
        })}
      </div>
      {failed && <p role="status" className={`mt-4 text-sm font-medium ${T.t1}`}>Não foi possível atualizar agora. As ocorrências acima continuam válidas; tente de novo em instantes.</p>}

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
