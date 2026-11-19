// Dicionário AMPLIADO da busca (ETAPA 1 do plano de sinônimos). UM lugar só, organizado por grupo e fácil de ampliar por dados:
// para incluir um par basta acrescentar uma linha em GRUPOS, RELACOES ou CATEGORIAS abaixo (a etapa 2 deve alimentar estes mesmos três
// formatos a partir de pares aprovados por um admin; nada aqui depende de código).
//
// QUEM USA: só as consumidoras de BUSCA que pedirem o dicionário ampliado (hoje: a busca do Feed e o /achei, via `amplo=1`).
// QUEM NÃO USA (de propósito): o MATCHING (src/lib/matching.ts tem o SEU dicionário próprio, uma cópia independente) e os fluxos /flow/*
// (chamam /api/v1/objects/public sem `amplo`, então seguem com o dicionário antigo `SINONIMOS` de src/lib/buscaPublica.ts, congelado).
//
// REGRAS DE ESCRITA (conservadoras — só equivalência óbvia, sem generalizar):
//  • termos em minúsculas, SEM acento, no singular simples (o radical «s» final é tratado por quem constrói: «oculos» vira «oculo»);
//  • GRUPOS: equivalência nos DOIS sentidos (qualquer termo do grupo acha os outros). Use só para sinônimos de verdade.
//  • RELACOES: um sentido só (de → para). Use para termos GUARDA-CHUVA («veiculo» acha «carro», mas «carro» não acha «veiculo»): como a
//    pontuação expande os dois lados, um guarda-chuva nos dois sentidos ligaria «moto» a «carro» por transitividade.
//  • NÃO ligar coisas que só se parecem por contexto (ex.: «carro» e «chave»: há chaves de carro, mas não são o carro).
//  • CATEGORIAS: palavra → categoria(s) do banco. «carro», «moto», «veiculo» devem achar qualquer ocorrência de categoria Veículo
//    mesmo que o título use outra palavra. Valores são os da coluna `category` (o Feed trata «animal» como «pet»).

export interface Grupo { nome: string; termos: string[] }
export interface Relacao { de: string; para: string[] }
export interface RegraCategoria { categorias: string[]; termos: string[] }

// ─── Equivalências nos dois sentidos ─────────────────────────────────────────
export const GRUPOS: Grupo[] = [
  // Veículos
  { nome: 'carro', termos: ['carro', 'automovel', 'auto'] },
  { nome: 'moto', termos: ['moto', 'motocicleta'] },
  { nome: 'bicicleta', termos: ['bicicleta', 'bike', 'bici'] },
  // Documentos
  { nome: 'identidade', termos: ['rg', 'identidade'] },
  { nome: 'habilitacao', termos: ['cnh', 'habilitacao'] },
  // Pets
  { nome: 'cachorro', termos: ['cachorro', 'cachorra', 'cadela', 'cao', 'dog'] },
  { nome: 'gato', termos: ['gato', 'gata', 'gatinho', 'felino', 'cat'] },
  { nome: 'pet', termos: ['pet', 'animal', 'bicho'] },
  // Cartão, mala
  { nome: 'cartao', termos: ['cartao', 'cartoes'] },
  { nome: 'mala', termos: ['mala', 'bagagem', 'valise'] },
  // Joias
  { nome: 'anel', termos: ['anel', 'alianca'] },
  // Celular e eletrônicos
  { nome: 'celular', termos: ['celular', 'telefone', 'smartphone'] },
  { nome: 'notebook', termos: ['notebook', 'laptop'] },
];

// ─── Um sentido só (de → para): termos guarda-chuva e marcas ─────────────────
export const RELACOES: Relacao[] = [
  { de: 'veiculo', para: ['carro', 'automovel', 'auto', 'moto', 'motocicleta'] },
  { de: 'pet', para: ['cachorro', 'cachorra', 'gato', 'gata', 'cao'] },
  { de: 'animal', para: ['cachorro', 'cachorra', 'gato', 'gata', 'cao'] },
  { de: 'cartao', para: ['credito', 'debito', 'bancario'] },
  { de: 'bancario', para: ['cartao'] },
  { de: 'joia', para: ['anel', 'alianca', 'colar', 'brinco', 'pulseira', 'corrente'] },
  { de: 'eletronico', para: ['celular', 'notebook', 'tablet', 'computador', 'fone', 'headphone'] },
  { de: 'celular', para: ['xiaomi', 'galaxy'] },
  // rg/cpf/cnh/passaporte → «documento»: NÃO precisa de relação (o antigo `documento` já expande para eles nos dois lados da pontuação)
];

// ─── Palavra → categoria do banco (reconhecimento por categoria) ─────────────
export const CATEGORIAS: RegraCategoria[] = [
  { categorias: ['vehicle'], termos: ['carro', 'automovel', 'auto', 'veiculo', 'moto', 'motocicleta'] },
  { categorias: ['bike'], termos: ['bicicleta', 'bike', 'bici'] },
  { categorias: ['pet', 'animal'], termos: ['pet', 'animal', 'bicho'] },
  // só «documento» e «identidade» pedem a categoria inteira; «rg», «cnh» etc. ficam só como sinônimos (senão «rg» listaria toda CNH e todo passaporte)
  { categorias: ['document'], termos: ['documento', 'identidade'] },
  { categorias: ['phone'], termos: ['celular', 'telefone', 'smartphone'] },
  { categorias: ['electronics'], termos: ['eletronico', 'notebook', 'computador', 'tablet', 'laptop'] },
  { categorias: ['wallet'], termos: ['carteira'] },
  { categorias: ['keys'], termos: ['chave', 'chaveiro'] },
  { categorias: ['bag'], termos: ['bolsa', 'mochila', 'mala', 'sacola'] },
  { categorias: ['jewelry'], termos: ['joia', 'anel', 'colar', 'brinco', 'alianca', 'pulseira'] },
  { categorias: ['clothing'], termos: ['roupa', 'casaco', 'jaqueta', 'blusa'] },
];

export type Dicionario = Record<string, string[]>;

/**
 * Junta o dicionário ANTIGO (somente leitura; é o `SINONIMOS` congelado de buscaPublica.ts) com GRUPOS e RELACOES.
 * `norm` é a normalização da busca (sem acento, minúsculas, singular simples): as CHAVES passam por ela, o que conserta «oculos» e «onibus»
 * (a chave antiga nunca casava porque a palavra buscada já chegava sem o «s»). Os valores ficam como escritos (quem expande os normaliza).
 */
export function construirDicionario(antigo: Dicionario, norm: (w: string) => string): Dicionario {
  const out: Dicionario = {};
  const juntar = (de: string, para: string[]) => {
    const k = norm(de); const lista = (out[k] ??= []);
    for (const p of para) if (norm(p) !== k && !lista.some((x) => norm(x) === norm(p))) lista.push(p);
  };
  for (const [k, v] of Object.entries(antigo)) juntar(k, v);
  for (const g of GRUPOS) for (const t of g.termos) juntar(t, g.termos);
  for (const r of RELACOES) juntar(r.de, r.para);
  return out;
}

/** Categorias do banco que as palavras da busca (já normalizadas) pedem. Ex.: ['carro'] → ['vehicle']. */
export function categoriasDaBusca(palavrasNormalizadas: string[], norm: (w: string) => string): string[] {
  const set = new Set<string>();
  const ps = new Set(palavrasNormalizadas);
  for (const r of CATEGORIAS) if (r.termos.some((t) => ps.has(norm(t)))) r.categorias.forEach((c) => set.add(c));
  return [...set];
}

/** Todos os termos conhecidos (chaves, valores e termos de categoria), já normalizados: servem para não descartar palavras curtas como «rg». */
export function termosConhecidos(dic: Dicionario, norm: (w: string) => string): Set<string> {
  const s = new Set<string>();
  for (const [k, v] of Object.entries(dic)) { s.add(norm(k)); v.forEach((x) => s.add(norm(x))); }
  for (const r of CATEGORIAS) r.termos.forEach((t) => s.add(norm(t)));
  return s;
}
