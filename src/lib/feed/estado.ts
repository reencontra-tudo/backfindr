// Feed: guardar e restaurar a posição quando a pessoa volta pelo botão «voltar» do navegador.
// Lógica PURA (sem React): testável sem navegador. O estado fica só no sessionStorage da aba (nunca vai a servidor nenhum),
// com chave versionada, validade curta e no máximo 36 cards. Qualquer erro (modo privado, JSON quebrado, versão antiga) = ignora e descarta.
import { FEED_CATEGORY_LABELS, type FeedCategoryKey } from '@/lib/feed/category';
import type { FeedItem, FeedStatus } from '@/lib/feed/query';

export const ESTADO_CHAVE = 'feed-state-v1';
export const ESTADO_VERSAO = 1;
export const ESTADO_IDADE_MAX_MS = 30 * 60 * 1000;   // 30 minutos
export const ESTADO_MAX_CARDS = 36;                   // os 3 lotes do carregamento híbrido
/** Quanto tempo depois de um «voltar» (popstate) o Feed ainda conta como «voltei para cá». */
export const JANELA_VOLTAR_MS = 8000;

export interface Geo { city: string | null; uf: string }
export interface Filtros { status: string; category: string; region: string; geo: Geo | null }

/** Só os campos que a tela usa (o resto de FeedItem é recalculado ao restaurar). */
export interface ItemSalvo {
  code: string; title: string; status: FeedStatus; status_label: string; category: FeedCategoryKey;
  origin: 'usuario' | 'sinal_publico'; location_label: string; photo_url: string | null; created_at: string;
  source_url: string | null; source_name: string | null; can_report_found: boolean;
}

export interface EstadoSalvo {
  v: number; t: number; pagina: number;
  itens: ItemSalvo[]; cursor: string | null; temMais: boolean;
  autoLotes: number; filtros: Filtros; scrollY: number;
}

/** Ponto de corte possível da lista: depois de N cards, qual era o cursor da próxima página. */
export interface Marco { n: number; cursor: string | null; temMais: boolean }

export interface ContextoValidacao { agora: number; pagina: number; regioes: string[] }

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

const STATUS: FeedStatus[] = ['lost', 'found', 'stolen'];
const SITUACOES = ['all', 'lost', 'found', 'stolen'];
const isStr = (v: unknown, max = 600): v is string => typeof v === 'string' && v.length <= max;
const isStrOuNulo = (v: unknown, max = 600): v is string | null => v === null || isStr(v, max);
const isHttp = (v: unknown): v is string => isStr(v, 2000) && /^https?:\/\//i.test(v);
const isCategoria = (v: unknown): v is FeedCategoryKey => typeof v === 'string' && Object.prototype.hasOwnProperty.call(FEED_CATEGORY_LABELS, v);
const isInt = (v: unknown, min: number, max: number): v is number => typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max;

/** sessionStorage da aba, ou null se o navegador bloquear (modo privado do Safari pode lançar erro só de acessar). */
export function obterStorage(): StorageLike | null {
  try { return typeof window !== 'undefined' ? window.sessionStorage : null; } catch { return null; }
}

export function compactar(i: FeedItem): ItemSalvo {
  return {
    code: i.code, title: i.title, status: i.status, status_label: i.status_label, category: i.category, origin: i.origin,
    location_label: i.location_label, photo_url: i.photo_url, created_at: i.created_at, source_url: i.source_url,
    source_name: i.source_name, can_report_found: i.can_report_found,
  };
}

export function expandir(i: ItemSalvo): FeedItem {
  return { ...i, category_label: FEED_CATEGORY_LABELS[i.category], has_photo: Boolean(i.photo_url) };
}

/**
 * Escolhe o que guardar (no máximo `max` cards). Se a lista passou do máximo (a pessoa clicou em «Ver mais»), guarda só até
 * o último ponto de corte que cabe e o cursor desse ponto: ao voltar, o botão «Ver mais» continua do lugar certo.
 */
export function escolherCorte(items: FeedItem[], marcos: Marco[], atual: { cursor: string | null; temMais: boolean }, max = ESTADO_MAX_CARDS):
  { itens: FeedItem[]; cursor: string | null; temMais: boolean } | null {
  if (items.length === 0) return null;
  if (items.length <= max) return { itens: items, cursor: atual.cursor, temMais: atual.temMais };
  let m: Marco | null = null;
  for (const x of marcos) if (x.n > 0 && x.n <= max && x.n <= items.length && (!m || x.n > m.n)) m = x;
  return m ? { itens: items.slice(0, m.n), cursor: m.cursor, temMais: m.temMais } : null;
}

export function criarEstado(a: {
  agora: number; pagina: number; itens: FeedItem[]; cursor: string | null; temMais: boolean; autoLotes: number; filtros: Filtros; scrollY: number;
}): EstadoSalvo {
  return {
    v: ESTADO_VERSAO, t: a.agora, pagina: a.pagina, itens: a.itens.slice(0, ESTADO_MAX_CARDS).map(compactar), cursor: a.cursor, temMais: a.temMais,
    autoLotes: a.autoLotes, filtros: a.filtros, scrollY: Math.max(0, Math.round(a.scrollY)),
  };
}

function itemValido(x: unknown): x is ItemSalvo {
  if (!x || typeof x !== 'object') return false;
  const i = x as Record<string, unknown>;
  return isStr(i.code, 40) && i.code.length > 0 && isStr(i.title) && STATUS.includes(i.status as FeedStatus) && isStr(i.status_label, 40)
    && isCategoria(i.category) && (i.origin === 'usuario' || i.origin === 'sinal_publico') && isStr(i.location_label) && isStr(i.created_at, 40)
    && (i.photo_url === null || isHttp(i.photo_url)) && (i.source_url === null || isHttp(i.source_url)) && isStrOuNulo(i.source_name, 120)
    && typeof i.can_report_found === 'boolean';
}

function filtrosValidos(f: unknown, regioes: string[]): f is Filtros {
  if (!f || typeof f !== 'object') return false;
  const x = f as Record<string, unknown>;
  if (typeof x.status !== 'string' || !SITUACOES.includes(x.status)) return false;
  if (typeof x.category !== 'string' || !(x.category === 'all' || isCategoria(x.category))) return false;
  if (typeof x.region !== 'string') return false;
  const geo = x.geo;
  const geoOk = geo === null || (typeof geo === 'object' && geo !== null && /^[A-Z]{2}$/.test(String((geo as Geo).uf)) && ((geo as Geo).city === null || isStr((geo as Geo).city, 60)));
  if (!geoOk) return false;
  if (x.region === 'todas') return true;
  if (x.region === 'auto' || x.region === 'cidade') return geo !== null && (x.region !== 'cidade' || (geo as Geo).city !== null); // «Perto de mim»/«Só a minha cidade» precisam da região já guardada
  return regioes.includes(x.region);                                                                                                     // estado (UF) escolhido
}

/** Confere tudo (versão, idade, página, formato, filtros). Devolve o estado ou null. Nunca lança. */
export function validarEstado(valor: unknown, ctx: ContextoValidacao): EstadoSalvo | null {
  try {
    if (!valor || typeof valor !== 'object') return null;
    const e = valor as Record<string, unknown>;
    if (e.v !== ESTADO_VERSAO) return null;
    if (typeof e.t !== 'number' || !Number.isFinite(e.t)) return null;
    const idade = ctx.agora - e.t;
    if (idade > ESTADO_IDADE_MAX_MS || idade < -60_000) return null;           // expirado (ou relógio maluco)
    if (e.pagina !== ctx.pagina) return null;                                   // /feed e /feed/pagina/N têm listas diferentes
    if (!Array.isArray(e.itens) || e.itens.length < 1 || e.itens.length > ESTADO_MAX_CARDS || !e.itens.every(itemValido)) return null;
    if (new Set((e.itens as ItemSalvo[]).map((i) => i.code)).size !== e.itens.length) return null; // sem duplicados
    if (!isStrOuNulo(e.cursor, 400) || typeof e.temMais !== 'boolean' || (e.temMais && !e.cursor)) return null;
    if (!isInt(e.autoLotes, 0, 50)) return null;
    if (typeof e.scrollY !== 'number' || !Number.isFinite(e.scrollY) || e.scrollY < 0 || e.scrollY > 10_000_000) return null;
    if (!filtrosValidos(e.filtros, ctx.regioes)) return null;
    return e as unknown as EstadoSalvo;
  } catch { return null; }
}

export function salvarEstado(storage: StorageLike | null, estado: EstadoSalvo): boolean {
  if (!storage) return false;
  try { storage.setItem(ESTADO_CHAVE, JSON.stringify(estado)); return true; } catch { descartarEstado(storage); return false; } // cota cheia / modo privado
}

export function descartarEstado(storage: StorageLike | null): void {
  if (!storage) return;
  try { storage.removeItem(ESTADO_CHAVE); } catch { /* sem problema */ }
}

/** Lê o estado guardado; se estiver inválido (versão, idade, filtros, JSON quebrado) apaga e devolve null. */
export function lerEstado(storage: StorageLike | null, ctx: ContextoValidacao): EstadoSalvo | null {
  if (!storage) return null;
  try {
    const bruto = storage.getItem(ESTADO_CHAVE);
    if (bruto === null) return null;
    const est = validarEstado(JSON.parse(bruto), ctx);
    if (!est) descartarEstado(storage);
    return est;
  } catch { descartarEstado(storage); return null; }
}

/**
 * Quando restaurar? Só em «voltar/avançar»:
 *  - carga nova do documento por voltar do navegador (navigation.type === 'back_forward'), e só na PRIMEIRA montagem do documento;
 *  - ou navegação interna (o Next não recarrega a página): houve um popstate logo antes de o Feed montar.
 * Abertura normal, link novo, F5 ('reload') e nova aba nunca restauram.
 */
export function deveRestaurar(a: { tipoNavegacao: string | null; primeiraMontagem: boolean; voltouAgora: boolean }): boolean {
  return a.voltouAgora || (a.primeiraMontagem && a.tipoNavegacao === 'back_forward');
}

export function tipoNavegacao(): string | null {
  try { return (performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined)?.type ?? null; } catch { return null; }
}

// --- Rastreador de «voltar» para navegação interna ---
let ultimoPopstate = 0;
let instalado = false;
let montagens = 0;

/** Chamado uma vez por documento. Um clique em qualquer link = navegação nova (anula um «voltar» antigo que sobrou). */
export function instalarRastreadorVoltar(): void {
  if (instalado || typeof window === 'undefined') return;
  instalado = true;
  window.addEventListener('popstate', () => { ultimoPopstate = Date.now(); });
  document.addEventListener('click', (e) => { if ((e.target as Element | null)?.closest?.('a[href]')) ultimoPopstate = 0; }, true);
}

/** Usa e apaga a marca de «voltar». */
export function consumirVoltou(agora: number): boolean {
  const ok = ultimoPopstate > 0 && agora - ultimoPopstate <= JANELA_VOLTAR_MS;
  ultimoPopstate = 0;
  return ok;
}

/** Conta a montagem do Feed neste documento; true só na primeira. */
export function registrarMontagem(): boolean { return montagens++ === 0; }
