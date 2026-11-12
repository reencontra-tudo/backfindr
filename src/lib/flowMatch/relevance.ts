// Relevância dos alertas do PASSO 2 dos fluxos /flow/found e /flow/lost (opção `strict=1` de /api/v1/objects/public).
// Só decide QUEM APARECE como «Pode ser o dono» neste passo. Não muda a pontuação, a ordem, o limite de 5 itens nem o
// corte de 50 candidatos, e não esconde nada no mapa, na busca, nas contagens, no sitemap, na home nem no /achei.
//
// Regras (listas FECHADAS, em português, sem acento e no singular simples como o resto do projeto normaliza):
//  1. Cor sozinha não conta: o item só aparece se tiver ao menos uma palavra em comum com a busca que NÃO seja cor
//     nem palavra vazia (no título ou na descrição, com os mesmos sinônimos da pontuação).
//  2. «Busca ampla»: depois de tirar cores, palavras vazias e descrições genéricas (material, tamanho, estado), restam
//     MENOS DE 2 palavras que identifiquem o objeto (tipo, marca, modelo, lugar). Nesse caso nenhum item é listado.
//  3. Títulos com a palavra inteira «recuperado»/«recuperada» (sem diferenciar maiúsculas nem acentos) não aparecem
//     (não existe campo estruturado de «recuperado» no legado; só o texto do título).
import { normalizarPalavra, removerAcentos } from '@/lib/publicSignals/textNormalization';

const norm = (list: string[]) => new Set(list.map(normalizarPalavra));

export const CORES = norm([
  'preto', 'preta', 'pretos', 'pretas', 'branco', 'branca', 'brancos', 'brancas', 'azul', 'azuis', 'vermelho', 'vermelha',
  'verde', 'verdes', 'amarelo', 'amarela', 'laranja', 'roxo', 'roxa', 'rosa', 'marrom', 'marrons', 'cinza', 'cinzento',
  'bege', 'dourado', 'dourada', 'prata', 'prateado', 'prateada', 'vinho', 'violeta', 'lilas', 'turquesa', 'grafite',
  'creme', 'caramelo', 'nude', 'colorido', 'colorida', 'claro', 'clara', 'escuro', 'escura',
]);

export const PALAVRAS_VAZIAS = norm([
  'a', 'o', 'as', 'os', 'um', 'uma', 'uns', 'umas', 'de', 'da', 'do', 'das', 'dos', 'em', 'na', 'no', 'nas', 'nos', 'com',
  'sem', 'para', 'pra', 'por', 'pelo', 'pela', 'e', 'ou', 'que', 'meu', 'minha', 'meus', 'minhas', 'seu', 'sua', 'ele',
  'ela', 'este', 'esta', 'esse', 'essa', 'isso', 'aquele', 'aquela', 'ao', 'aos', 'num', 'numa', 'mais', 'muito', 'bem',
  'perdido', 'perdida', 'achado', 'achada', 'encontrado', 'encontrada', 'perdi', 'achei', 'encontrei', 'objeto', 'coisa',
  'item', 'algo', 'alguma', 'algum',
]);

// Descrições que não identificam o objeto: material, tamanho, estado.
export const DESCRICOES_GENERICAS = norm([
  'couro', 'tecido', 'plastico', 'metal', 'madeira', 'vidro', 'borracha', 'papel', 'ouro', 'grande', 'pequeno', 'pequena',
  'medio', 'media', 'novo', 'nova', 'velho', 'velha', 'antigo', 'antiga', 'simples', 'comum', 'normal', 'liso', 'lisa',
  'bonito', 'bonita', 'fino', 'fina', 'grosso', 'grossa', 'pesado', 'leve', 'usado', 'usada', 'quebrado', 'quebrada',
  'estampado', 'estampada', 'listrado', 'listrada', 'brilhante', 'original',
]);

const ehCor = (w: string) => CORES.has(w);
const ehVazia = (w: string) => PALAVRAS_VAZIAS.has(w);

/** Palavras da busca que identificam o objeto: sem cor, sem palavra vazia, sem descrição genérica. Números e modelos contam. */
export function palavrasDeIdentificacao(keyword: string): string[] {
  const palavras = removerAcentos(keyword).toLowerCase().split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 3 || /\d/.test(w))
    .map(normalizarPalavra);
  return [...new Set(palavras)].filter((w) => !ehCor(w) && !ehVazia(w) && !DESCRICOES_GENERICAS.has(w));
}

export const MIN_PALAVRAS_DE_IDENTIFICACAO = 2;

/** «Busca ampla»: não há palavras suficientes para identificar o objeto (ou a busca está vazia). */
export function isBuscaAmpla(keyword: string): boolean {
  return palavrasDeIdentificacao(keyword).length < MIN_PALAVRAS_DE_IDENTIFICACAO;
}

/** Há ao menos uma palavra em comum que não é cor nem palavra vazia? (conjuntos já expandidos com sinônimos, como na pontuação) */
export function temPalavraEmComum(kwExpandido: Set<string>, tituloExpandido: Set<string>, descricaoExpandida: Set<string>): boolean {
  for (const w of kwExpandido) {
    if (ehCor(w) || ehVazia(w)) continue;
    if (tituloExpandido.has(w) || descricaoExpandida.has(w)) return true;
  }
  return false;
}

/** Título com a palavra inteira «recuperado»/«recuperada». */
export function tituloRecuperado(title: unknown): boolean {
  return typeof title === 'string' && /\brecuperad[oa]\b/.test(removerAcentos(title).toLowerCase());
}

// ── Estado «busca ampla»: registros recentes parecidos (nunca legado) ───────────────────────────────────────────
export const MAX_REGISTROS_RECENTES = 3;
export const DIAS_REGISTROS_RECENTES = 90;

/** Palavras inteiras do texto (sem acento, no singular simples, como o resto do projeto normaliza). */
export function palavrasDoTexto(text: string | null | undefined): Set<string> {
  if (!text) return new Set();
  return new Set(removerAcentos(text).toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length >= 3 || /\d/.test(w)).map(normalizarPalavra));
}

/** Pelo menos 1 palavra de identificação da busca (sem cor, palavra vazia nem descrição genérica) aparece, inteira, no título ou na descrição. Sem sinônimos de propósito. */
export function temPalavraIdentificadoraEmComum(keyword: string, title: unknown, description: unknown): boolean {
  const ident = palavrasDeIdentificacao(keyword);
  if (ident.length === 0) return false;
  const palavras = new Set([...palavrasDoTexto(typeof title === 'string' ? title : ''), ...palavrasDoTexto(typeof description === 'string' ? description : '')]);
  return ident.some((w) => palavras.has(w));
}
