// Dicionário AMPLIADO da busca (ETAPA 1 do plano de sinônimos). UM lugar só, organizado por grupo e fácil de ampliar por dados:
// para incluir um par basta acrescentar uma linha em GRUPOS, RELACOES ou CATEGORIAS abaixo (a etapa 2 deve alimentar estes mesmos três
// formatos a partir de pares aprovados por um admin; nada aqui depende de código).
//
// QUEM USA: só as consumidoras de BUSCA que pedirem o dicionário ampliado (hoje: a busca do Feed e o /achei, via `amplo=1`).
// QUEM NÃO USA (de propósito): o MATCHING (src/lib/matching.ts tem o SEU dicionário próprio, uma cópia independente) e os fluxos /flow/*
// (chamam /api/v1/objects/public sem `amplo`, então seguem com o dicionário antigo `SINONIMOS` de src/lib/buscaPublica.ts, congelado).
//
// REGRAS DE ESCRITA (conservadoras — só equivalência óbvia, sem generalizar):
//  • termos em minúsculas, SEM acento, uma palavra só (a pontuação trabalha com palavras; frases como «cg 150» não casam, ficam de fora);
//  • GRUPOS: equivalência nos DOIS sentidos (qualquer termo do grupo acha os outros). Use só para sinônimos de verdade.
//  • RELACOES: um sentido só (de → para). Quem BUSCA `de` acha textos que tenham qualquer palavra de `para`; o contrário NÃO vale. É o que
//    impede que «chevrolet» liste todo carro: marca e modelo só são achados por «carro», nunca o inverso.
//  • NÃO ligar coisas que só se parecem por contexto (ex.: «carro» e «chave»: há chaves de carro, mas não são o carro).
//  • Palavras AMBÍGUAS ficam FORA (ver FORA_DO_DICIONARIO), mesmo que sejam modelo de veículo.
//
// VEÍCULOS (regra do Marcos): o banco só guarda category/type = «vehicle», SEM separar carro de moto. Por isso a distinção carro × moto depende
// do TEXTO (título, descrição, marca, modelo): «carro» acha os termos de carro, «moto» acha os termos de moto e NENHUM dos dois pede a categoria
// inteira (senão «carro» listaria moto). Só «veiculo» (guarda-chuva) acha todos os termos de veículo, caminhão, Honda e a categoria vehicle inteira.
// Honda (e qualquer marca que faça carro E moto) não é ligada a «carro» nem a «moto»: só «veiculo» e a própria palavra «honda» a acham.
// CATEGORIAS: palavra → categoria(s) do banco. Valores são os da coluna `category` (o Feed trata «animal» como «pet»).

export interface Grupo { nome: string; termos: string[] }
export interface Relacao { de: string; para: string[] }
export interface RegraCategoria { categorias: string[]; termos: string[] }

// ─── Veículos, por tipo (dados reutilizados em RELACOES abaixo) ──────────────
/** O que «carro» acha (além de «automovel», que vem do grupo): tipos de carro, marcas SÓ de carro e modelos de carro. */
export const TERMOS_DE_CARRO = [
  // tipos
  'caminhonete', 'picape', 'pickup', 'van', 'utilitario', 'suv', 'sedan', 'hatch',
  // marcas só de carro
  'chevrolet', 'fiat', 'volkswagen', 'vw', 'ford', 'toyota', 'hyundai', 'renault', 'nissan', 'jeep', 'peugeot', 'citroen',
  // modelos de carro (fora: gol, up, fit, uno, ka, onix, polo — ambíguos)
  'spin', 'prisma', 'celta', 'palio', 'siena', 'strada', 'civic', 'corolla', 'hb20', 'hilux', 'saveiro',
];
/** O que «moto» acha (além de «motocicleta», que vem do grupo): tipo, marca SÓ de moto e modelos de moto. */
export const TERMOS_DE_MOTO = ['scooter', 'yamaha', 'biz', 'fazer'];
/** Caminhão é veículo, não carro: só «veiculo» o acha. */
export const TERMOS_DE_VEICULO_ALEM_DE_CARRO_E_MOTO = ['caminhao', 'honda'];

// ─── Equivalências nos dois sentidos ─────────────────────────────────────────
export const GRUPOS: Grupo[] = [
  // Veículos («auto» NÃO entra: casa com «auto escola», «autopeças»)
  { nome: 'carro', termos: ['carro', 'automovel'] },
  { nome: 'moto', termos: ['moto', 'motocicleta'] },
  { nome: 'caminhonete', termos: ['caminhonete', 'picape', 'pickup'] },
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

// ─── Um sentido só (de → para): guarda-chuvas, tipos, marcas e modelos ───────
export const RELACOES: Relacao[] = [
  // Veículos
  { de: 'carro', para: TERMOS_DE_CARRO },
  { de: 'automovel', para: TERMOS_DE_CARRO },
  { de: 'moto', para: TERMOS_DE_MOTO },
  { de: 'motocicleta', para: TERMOS_DE_MOTO },
  { de: 'veiculo', para: ['carro', 'automovel', ...TERMOS_DE_CARRO, 'moto', 'motocicleta', ...TERMOS_DE_MOTO, ...TERMOS_DE_VEICULO_ALEM_DE_CARRO_E_MOTO] },
  // Pets, cartão, joias, eletrônicos
  { de: 'pet', para: ['cachorro', 'cachorra', 'gato', 'gata', 'cao'] },
  { de: 'animal', para: ['cachorro', 'cachorra', 'gato', 'gata', 'cao'] },
  { de: 'cartao', para: ['credito', 'debito', 'bancario'] },
  { de: 'bancario', para: ['cartao'] },
  { de: 'joia', para: ['anel', 'alianca', 'colar', 'brinco', 'pulseira', 'corrente'] },
  { de: 'eletronico', para: ['celular', 'notebook', 'tablet', 'computador', 'fone', 'headphone'] },
  { de: 'celular', para: ['xiaomi', 'galaxy'] },
  // rg/cpf/cnh/passaporte → «documento»: NÃO precisa de relação (o antigo `documento` já expande para eles)
];

// ─── Palavra → categoria do banco (reconhecimento por categoria) ─────────────
export const CATEGORIAS: RegraCategoria[] = [
  // SÓ «veiculo» pede a categoria vehicle inteira: o banco não separa carro de moto, então «carro» e «moto» NÃO podem pedi-la.
  { categorias: ['vehicle'], termos: ['veiculo'] },
  { categorias: ['bike'], termos: ['bicicleta', 'bike', 'bici'] },
  { categorias: ['pet', 'animal'], termos: ['pet', 'animal', 'bicho'] },
  // só «documento» e «identidade» pedem a categoria inteira; «rg», «cnh» etc. ficam só como sinônimos (senão «rg» listaria toda CNH)
  { categorias: ['document'], termos: ['documento', 'identidade'] },
  { categorias: ['phone'], termos: ['celular', 'telefone', 'smartphone'] },
  { categorias: ['electronics'], termos: ['eletronico', 'notebook', 'computador', 'tablet', 'laptop'] },
  { categorias: ['wallet'], termos: ['carteira'] },
  { categorias: ['keys'], termos: ['chave', 'chaveiro'] },
  { categorias: ['bag'], termos: ['bolsa', 'mochila', 'mala', 'sacola'] },
  { categorias: ['jewelry'], termos: ['joia', 'anel', 'colar', 'brinco', 'alianca', 'pulseira'] },
  { categorias: ['clothing'], termos: ['roupa', 'casaco', 'jaqueta', 'blusa'] },
];

/** Palavras que ficaram FORA de propósito (nem como termo, nem como contexto), com o motivo. Documentação + teste. */
export const FORA_DO_DICIONARIO: Array<{ termo: string; motivo: string }> = [
  { termo: 'auto', motivo: 'curto: casa com «auto escola», «autopeças», «auto de infração»; «automovel» já cobre' },
  { termo: 'gol', motivo: 'o gol do futebol («gol de placa») × Volkswagen Gol' },
  { termo: 'up', motivo: 'duas letras; inglês («up») × Volkswagen Up' },
  { termo: 'fit', motivo: 'inglês («fit», fitness) × Honda Fit' },
  { termo: 'uno', motivo: '«uno» (um, número) × Fiat Uno' },
  { termo: 'ka', motivo: 'duas letras; sílaba/nome × Ford Ka' },
  { termo: 'onix', motivo: '«ônix» também é uma pedra; Chevrolet Onix só com contexto, que o dicionário não tem' },
  { termo: 'polo', motivo: 'camisa polo e esporte polo × Volkswagen Polo' },
  { termo: 'sol', motivo: '«óculos de sol», o astro, nome próprio; já existe no dicionário antigo de «oculos»' },
  { termo: 'cg', motivo: 'duas letras, sigla comum; «CG 150» é frase de duas palavras, que a pontuação não casa' },
  { termo: 'cg 150', motivo: 'duas palavras: a pontuação trabalha com palavras isoladas' },
  { termo: 'pop', motivo: 'Honda Pop × música pop' },
  { termo: 'fan', motivo: 'Honda Fan × torcedor/ventilador' },
  { termo: 'tracker', motivo: 'Chevrolet Tracker × rastreador GPS' },
  { termo: 'creta', motivo: 'Hyundai Creta × a ilha de Creta × argila' },
];

export type Dicionario = Record<string, string[]>;

function adicionar(out: Dicionario, norm: (w: string) => string, de: string, para: string[]) {
  const k = norm(de); const lista = (out[k] ??= []);
  for (const p of para) if (norm(p) !== k && !lista.some((x) => norm(x) === norm(p))) lista.push(p);
}

/** Só os pares NOVOS (GRUPOS e RELACOES), com as chaves normalizadas: serve para reconhecer, no texto da ocorrência, uma palavra que a busca pediu. */
export function construirNovos(norm: (w: string) => string): Dicionario {
  const out: Dicionario = {};
  for (const g of GRUPOS) for (const t of g.termos) adicionar(out, norm, t, g.termos);
  for (const r of RELACOES) adicionar(out, norm, r.de, r.para);
  return out;
}

/**
 * Junta o dicionário ANTIGO (somente leitura; é o `SINONIMOS` congelado de buscaPublica.ts) com os pares novos.
 * `norm` é a normalização da busca (sem acento, minúsculas, singular simples): as CHAVES passam por ela, o que conserta «oculos» e «onibus»
 * (a chave antiga nunca casava porque a palavra buscada já chegava sem o «s»). Os valores ficam como escritos (quem expande os normaliza).
 */
export function construirDicionario(antigo: Dicionario, norm: (w: string) => string): Dicionario {
  const out: Dicionario = {};
  for (const [k, v] of Object.entries(antigo)) adicionar(out, norm, k, v);
  for (const [k, v] of Object.entries(construirNovos(norm))) adicionar(out, norm, k, v);
  return out;
}

/** Categorias do banco que as palavras da busca (já normalizadas) pedem. Ex.: ['veiculo'] → ['vehicle']; ['carro'] → []. */
export function categoriasDaBusca(palavrasNormalizadas: string[], norm: (w: string) => string): string[] {
  const set = new Set<string>();
  const ps = new Set(palavrasNormalizadas);
  for (const r of CATEGORIAS) if (r.termos.some((t) => ps.has(norm(t)))) r.categorias.forEach((c) => set.add(c));
  return [...set];
}

/** Todos os termos conhecidos (chaves, valores e termos de categoria), já normalizados: servem para não descartar palavras curtas como «rg» e «vw». */
export function termosConhecidos(dic: Dicionario, norm: (w: string) => string): Set<string> {
  const s = new Set<string>();
  for (const [k, v] of Object.entries(dic)) { s.add(norm(k)); v.forEach((x) => s.add(norm(x))); }
  for (const r of CATEGORIAS) r.termos.forEach((t) => s.add(norm(t)));
  return s;
}
