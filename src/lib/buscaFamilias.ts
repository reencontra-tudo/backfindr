// Busca por FAMÍLIA (etapa 1): lógica sobre o vocabulário de src/lib/buscaVocabulario.ts. Pura (sem banco), usada pelo Feed e pelo /achei (`amplo=1`).
// Matching e fluxos /flow/* NÃO usam este módulo.
//
// Níveis (a nota antiga só desempata dentro do nível):
//   0 = palavra EXATA: uma palavra que identifica o objeto (sem cor, palavra vazia nem descrição genérica) aparece INTEIRA no título/descrição (regra do PR #154);
//   1 = FAMÍLIA ou CATEGORIA: o texto tem outra palavra da mesma família (e a categoria é compatível), ou a categoria é a da família (nunca legado);
//   2 = nota >= SCORE_MIN_BUSCA da busca pública (sinônimos antigos, com radical corrigido).
import { palavrasDeIdentificacao } from '@/lib/flowMatch/relevance';
import { normalizarPalavra as radical, removerAcentos } from '@/lib/publicSignals/textNormalization';
import { FAMILIAS, type Familia } from './buscaVocabulario';

export type NivelBusca = 0 | 1 | 2;

const palavrasBrutas = (t: unknown): string[] => removerAcentos(String(t ?? '')).toLowerCase().split(/[^a-z0-9]+/).filter(Boolean).map(radical);
/** Texto como « w1 w2 w3 » (palavras no singular simples): serve para achar palavras e frases inteiras. */
const textoNorm = (t: unknown): string => ` ${palavrasBrutas(t).join(' ')} `;
const termoNorm = (t: string): string => palavrasBrutas(t).join(' ');
const contem = (texto: string, termo: string): boolean => texto.includes(` ${termo} `);

// Categorias conhecidas do banco: categoria «suja» (found, lost, vazio, other) é NEUTRA (não impede a família).
const CATEGORIAS_CONHECIDAS = new Set(FAMILIAS.flatMap((f) => f.categorias).filter((c) => c !== 'other'));
const categoriaCompativel = (cat: unknown, f: Familia): boolean => {
  const c = String(cat ?? '').toLowerCase();
  return !CATEGORIAS_CONHECIDAS.has(c) || f.categorias.includes(c);
};

interface ClasseAtiva { familia: Familia; termos: Set<string>; ambiguos: Map<string, Set<string>> }
export interface BuscaPorFamilia {
  /** Termos (palavras ou frases, normalizados) para procurar no título/descrição: entram como candidatos no SQL. */
  termos: string[];
  /** Categorias do banco pedidas pela busca (ex.: ['vehicle']). */
  categorias: string[];
  classes: ClasseAtiva[];
}

export function compilarFamilias(consulta: string): BuscaPorFamilia {
  const q = textoNorm(consulta);
  const classes: ClasseAtiva[] = [];
  const termos = new Set<string>();
  const categorias = new Set<string>();
  for (const f of FAMILIAS) {
    const guarda = (f.guardaChuva ?? []).map(termoNorm);
    const todas: string[][] = [...(f.termos ? [f.termos] : []), ...(f.grupos ?? [])].map((c) => c.map(termoNorm));
    const ambig = new Map<string, Set<string>>((f.ambiguos ?? []).map((a) => [termoNorm(a.termo), new Set(a.comContexto.map(termoNorm))]));
    const guardaAtiva = guarda.some((g) => contem(q, g));
    const ativas = todas.filter((c) => guardaAtiva || c.some((t) => contem(q, t)));
    // palavra ambígua na BUSCA: só vale se a própria busca tiver uma palavra de contexto (ex.: «gol vw»)
    if (f.termos) {
      for (const [t, ctx] of ambig) if (contem(q, t) && [...ctx].some((c) => contem(q, c)) && !ativas.includes(todas[0])) ativas.push(todas[0]);
    }
    if (ativas.length === 0) continue;
    const set = new Set<string>([...ativas.flat(), ...guarda]);
    if (f.termos && ativas.includes(todas[0])) for (const t of ambig.keys()) set.add(t);
    set.forEach((t) => termos.add(t)); // candidatas do SQL; a conferência (categoria, contexto de ambígua) é feita depois, em casaFamilia
    if (!f.grupos || guardaAtiva) f.categorias.forEach((c) => categorias.add(c)); // família com grupos: só o guarda-chuva pede a categoria inteira
    classes.push({ familia: f, termos: set, ambiguos: ambig });
  }
  return { termos: [...termos], categorias: [...categorias], classes };
}

/** O texto do item tem outra palavra da mesma família (com a categoria compatível e, para ambígua, a palavra de contexto)? */
export function casaFamilia(b: BuscaPorFamilia, item: { title?: unknown; description?: unknown; category?: unknown }): boolean {
  if (b.classes.length === 0) return false;
  const texto = textoNorm(`${item.title ?? ''} ${item.description ?? ''}`);
  for (const c of b.classes) {
    if (!categoriaCompativel(item.category, c.familia)) continue;
    for (const t of c.termos) {
      if (!contem(texto, t)) continue;
      const ctx = c.ambiguos.get(t);
      if (ctx && ![...ctx].some((x) => contem(texto, x))) continue; // ambígua sem contexto no texto
      return true;
    }
  }
  return false;
}

/** A categoria do item é a pedida pela busca? Nunca para legado. */
export function casaCategoria(b: BuscaPorFamilia, item: { category?: unknown; type?: unknown; is_legacy?: unknown }): boolean {
  if (item.is_legacy || b.categorias.length === 0) return false;
  const cat = String(item.category ?? item.type ?? '').toLowerCase();
  return !!cat && b.categorias.includes(cat);
}

/** Nível do item para a busca (ver topo do arquivo), ou null se não entra. `nota` = calcularScoreBusca (busca pública). */
export function nivelDoItem(
  consulta: string, b: BuscaPorFamilia, item: { title?: unknown; description?: unknown; category?: unknown; type?: unknown; is_legacy?: unknown }, nota: number, notaMinima: number,
): NivelBusca | null {
  const texto = textoNorm(`${item.title ?? ''} ${item.description ?? ''}`);
  if (palavrasDeIdentificacao(consulta).some((w) => contem(texto, w))) return 0;
  if (casaFamilia(b, item) || casaCategoria(b, item)) return 1;
  return nota >= notaMinima ? 2 : null;
}

/** Quantas palavras exatas da busca o texto tem (desempate dentro do nível 0). */
export function palavrasExatas(consulta: string, item: { title?: unknown; description?: unknown }): number {
  const texto = textoNorm(`${item.title ?? ''} ${item.description ?? ''}`);
  return palavrasDeIdentificacao(consulta).filter((w) => contem(texto, w)).length;
}
