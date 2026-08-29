// ─── Score de compatibilidade entre dois objetos (perdido × achado) ────────
// Consolidado em 26/08/2026 a partir de 3 cópias que já haviam divergido:
// matching/run/route.ts (individual, dono aciona), admin/matching/run-all/
// route.ts ("Rodar matching" no painel admin) e cron/matching/route.ts
// (agendado). As 3 tinham calculateMatchScore/calculateScore quase iguais,
// mas não idênticas — matching/run/route.ts tinha sinônimos + score de
// descrição que os outros dois não tinham, e admin/matching/run-all/
// route.ts tinha bônus de marca (+10) que os outros dois não tinham.
//
// Esta consolidação NÃO muda comportamento ainda — as opções abaixo
// reproduzem exatamente o que cada chamador já fazia antes (ver
// options passadas em cada route.ts). Mudança de lógica (categoria virar
// filtro obrigatório em vez de peso) é um passo separado, posterior.

// ─── Dicionário de sinônimos (PT-BR, normalizado sem acento) ───────────────
// Usado só quando options.synonyms = true (hoje: só matching/run/route.ts).
const SINONIMOS: Record<string, string[]> = {
  bolsa: ['mochila', 'sacola', 'bag', 'pochete', 'carteira', 'maleta', 'pasta'],
  mochila: ['bolsa', 'sacola', 'bag', 'morral', 'saco'],
  sacola: ['bolsa', 'mochila', 'bag', 'saco'],
  celular: ['telefone', 'smartphone', 'iphone', 'android', 'aparelho', 'samsung', 'motorola'],
  telefone: ['celular', 'smartphone', 'aparelho'],
  carteira: ['wallet', 'bolsa', 'porta-documentos', 'porta documentos'],
  chave: ['chaves', 'chaveiro', 'key'],
  oculos: ['lentes', 'armacao', 'grau', 'sol'],
  notebook: ['computador', 'laptop', 'note', 'mac', 'macbook'],
  computador: ['notebook', 'laptop', 'pc', 'desktop'],
  caderno: ['cadernos', 'agenda', 'livro', 'bloco', 'diario'],
  agenda: ['caderno', 'livro', 'bloco', 'diario'],
  cachorro: ['cao', 'dog', 'pet', 'animal', 'canino'],
  cao: ['cachorro', 'dog', 'pet', 'animal'],
  gato: ['cat', 'felino', 'pet', 'animal', 'gatinho'],
  relogio: ['watch', 'smartwatch', 'cronometro'],
  documento: ['documentos', 'rg', 'cpf', 'identidade', 'passaporte', 'habilitacao', 'cnh'],
  identidade: ['rg', 'documento', 'cpf', 'passaporte'],
  onibus: ['bus', 'coletivo', 'transporte'],
  trem: ['metro', 'metrô', 'subway'],
  tablet: ['ipad', 'kindle', 'leitor'],
  fone: ['fones', 'headphone', 'earphone', 'airpod', 'auricular', 'headset'],
  headphone: ['fone', 'fones', 'earphone', 'airpod', 'auricular'],
};

function removerAcentos(str: string): string {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function normalizarPalavra(word: string): string {
  word = removerAcentos(word).toLowerCase().trim();
  // Remove plural simples: 's' final em palavras com mais de 4 letras
  if (word.length > 4 && word.endsWith('s')) word = word.slice(0, -1);
  return word;
}

// STOPWORDS do gate de sobreposicao de texto (27/08/2026)
// Achado real ao investigar "Cachorro Leon"/"Gato Dinho"/"Suri Shitzu" todos
// batendo em "Cachorro encontrado no bairro Parque Verde": a unica palavra
// em comum em todos os casos era "bairro" - presente em quase toda
// descricao gerada pelo Public Signals ("Categoria: X. Local: bairro Y.
// Ocorrencia identificada automaticamente..."). Confirmado com as fontes
// reais (DDDs diferentes, especies diferentes - gato x cachorro) que zero
// desses pares tinha qualquer relacao de verdade. "documento" teve o mesmo
// problema no par Ceoli Faller x Cristiano Cardoso - nome da categoria nao
// e sobreposicao real, so descreve o tipo de objeto que qualquer par da
// mesma categoria ja compartilha por definicao.
const STOPWORDS = new Set([
  // Estrutura da descricao/boilerplate do Public Signals
  'bairro', 'categoria', 'local', 'ocorrencia', 'identificada',
  'automaticamente', 'partir', 'canal', 'institucional', 'fonte', 'nome',
  'achados', 'perdidos',
  // Verbos/status genericos de titulo - descrevem o que aconteceu, nao QUAL
  // objeto e
  'perdeu', 'perdida', 'perdido', 'desapareceu', 'encontrado', 'encontrada',
  'encontrou', 'roubado', 'roubada', 'sumiu', 'procura',
  // Nome da propria categoria em portugues - bater so nisso nao e
  // sobreposicao real, e o filtro de categoria (ja obrigatorio) repetido
  'documento', 'documentos', 'identidade', 'cachorro', 'cachorra', 'gato',
  'gata', 'animal', 'veiculo', 'celular', 'bicicleta', 'joia', 'joias',
  'roupa', 'roupas', 'eletronico', 'eletronicos', 'bolsa', 'carteira',
  'chave', 'chaves',
]);

function isStopword(word: string): boolean {
  return STOPWORDS.has(normalizarPalavra(word));
}

function tokenizar(text: string): string[] {
  return removerAcentos(text)
    .toLowerCase()
    .split(/\s+/)
    .filter(w => w.length > 2)
    .filter(w => !isStopword(w));
}

// Descrição de Public Signals é sintética (buildPublicSignalDescription):
// título + " Categoria: X. Local: bairro Y, Cidade, UF. Ocorrência
// identificada automaticamente...". O "Local:" inclui cidade/estado
// inteiros, que são IDÊNTICOS em todo objeto da mesma fonte/região —
// achado real (29/08/2026): 213 candidatos ambíguos numa rodada só, a
// maioria só por "cascavel" em comum entre objetos sem nenhuma relação
// real (cidade inteira, não bairro específico — bairro já é tratado à
// parte, no título, e continua válido como sinal). Corta tudo a partir de
// " Categoria:" (marcador fixo do template) antes de comparar descrição —
// descrição de usuário real, que não tem esse marcador, continua
// completa e sem alteração.
function stripSyntheticBoilerplate(text: unknown): string {
  const str = String(text || '');
  const idx = str.indexOf(' Categoria:');
  return idx === -1 ? str : str.slice(0, idx);
}

function expandirTokens(tokens: string[]): Set<string> {
  const expanded = new Set<string>();
  for (const token of tokens) {
    const norm = normalizarPalavra(token);
    expanded.add(norm);
    const sinonimos = SINONIMOS[norm] || [];
    for (const s of sinonimos) expanded.add(normalizarPalavra(s));
  }
  return expanded;
}

// ─── Grupos de categoria equivalentes ───────────────────────────────────────
// 'animal' (444 objetos, legado Webjetos) e 'pet' (323, categoria atual do
// app) são o mesmo conceito com nome diferente por herança do import —
// confirmado 1:1 com is_legacy (26/08/2026). Sem isso, o filtro obrigatório
// de categoria (25/08/2026) nunca deixava um cão cadastrado como 'animal'
// casar com um cão cadastrado como 'pet', mesmo na mesma rua.
const CATEGORY_SYNONYMS: Record<string, string[]> = {
  pet: ['pet', 'animal'],
  animal: ['pet', 'animal'],
};

// Retorna o grupo de categorias compatíveis com `category` (inclui ela
// mesma). Categorias sem sinônimo conhecido retornam um grupo de 1.
export function expandCategoryGroup(category: string): string[] {
  return CATEGORY_SYNONYMS[category] || [category];
}

// ─── Cálculo de distância (Haversine) ──────────────────────────────────────
export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export interface MatchScoreOptions {
  // true só em matching/run/route.ts (dono aciona manualmente) — expande
  // sinônimos no título e pontua sobreposição de descrição.
  synonyms?: boolean;
  description?: boolean;
  // true só em admin/matching/run-all/route.ts ("Rodar matching" no painel).
  brand?: boolean;
}

// ─── Score heurístico (0-100) ──────────────────────────────────────────────
export function calculateMatchScore(
  obj: Record<string, unknown>,
  candidate: Record<string, unknown>,
  options: MatchScoreOptions = {}
): number {
  let score = 0;

  // Categoria (+30)
  const objCat = obj.category || obj.type;
  const canCat = candidate.category || candidate.type;
  if (objCat && canCat && objCat === canCat) score += 30;

  // Distância geográfica
  const lat1 = parseFloat(obj.latitude as string);
  const lon1 = parseFloat(obj.longitude as string);
  const lat2 = parseFloat(candidate.latitude as string);
  const lon2 = parseFloat(candidate.longitude as string);
  if (!isNaN(lat1) && !isNaN(lat2)) {
    const distKm = haversineKm(lat1, lon1, lat2, lon2);
    if (distKm <= 2) score += 40;
    else if (distKm <= 10) score += 30;
    else if (distKm <= 25) score += 15;
    else if (distKm <= 50) score += 5;
  } else {
    score += 15; // sem localização, benefício da dúvida
  }

  // Título
  if (options.synonyms) {
    // matching/run/route.ts: tokeniza (len>2) + expande sinônimos dos dois lados
    if (obj.title && candidate.title) {
      const w1 = expandirTokens(tokenizar(obj.title as string));
      const w2 = expandirTokens(tokenizar(candidate.title as string));
      const common = [...w1].filter(w => w2.has(w)).length;
      if (common > 0) score += Math.min(20, common * 7);
    }
  } else {
    // admin/matching/run-all e cron/matching: split simples, len>3, sem sinônimo
    const objWords = String(obj.title || '').toLowerCase().split(/\s+/).filter(Boolean);
    const canWords = String(candidate.title || '').toLowerCase().split(/\s+/).filter(Boolean);
    const commonWords = objWords.filter(w => w.length > 3 && canWords.includes(w));
    if (commonWords.length > 0) score += Math.min(20, commonWords.length * 7);
  }

  // Descrição — só matching/run/route.ts (options.description = true)
  if (options.description && obj.description && candidate.description) {
    const w1 = tokenizar(stripSyntheticBoilerplate(obj.description));
    const w2 = expandirTokens(tokenizar(stripSyntheticBoilerplate(candidate.description)));
    const w1Expanded = expandirTokens(w1);
    const common = [...w1Expanded].filter(w => w2.has(w)).length;
    score += Math.min(10, (common / Math.max(w1.length, 1)) * 10);
  }

  // Cor
  if (options.synonyms) {
    // matching/run/route.ts normaliza (remove acento/caixa) antes de comparar
    if (obj.color && candidate.color) {
      const c1 = normalizarPalavra(obj.color as string);
      const c2 = normalizarPalavra(candidate.color as string);
      if (c1 === c2) score += 10;
    }
  } else {
    // admin/matching/run-all e cron/matching comparam direto, sem normalizar
    if (obj.color && candidate.color && obj.color === candidate.color) score += 10;
  }

  // Marca — só admin/matching/run-all/route.ts (options.brand = true)
  if (options.brand && obj.brand && candidate.brand && obj.brand === candidate.brand) {
    score += 10;
  }

  return Math.min(100, Math.round(score));
}

// ─── Sobreposição mínima de texto (26/08/2026) ─────────────────────────────
// Categoria (agora filtro obrigatório) + distância sozinhas bastavam pra
// bater o threshold sem nenhuma palavra em comum entre os dois objetos —
// 42% das matches do diagnóstico (score=45) eram exatamente isso: mesma
// categoria, raio de 10-25km, zero sobreposição de título/descrição. Esta
// função replica a MESMA lógica de comparação de texto de
// calculateMatchScore (mesmas options, pra não divergir de novo), mas
// devolve só um booleano — usada como gate extra, independente da soma do
// score, antes de criar o match.
export function hasTextOverlap(
  obj: Record<string, unknown>,
  candidate: Record<string, unknown>,
  options: MatchScoreOptions = {}
): boolean {
  if (options.synonyms) {
    if (obj.title && candidate.title) {
      const w1 = expandirTokens(tokenizar(obj.title as string));
      const w2 = expandirTokens(tokenizar(candidate.title as string));
      if ([...w1].some(w => w2.has(w))) return true;
    }
    if (options.description && obj.description && candidate.description) {
      const w1 = tokenizar(stripSyntheticBoilerplate(obj.description));
      const w2 = expandirTokens(tokenizar(stripSyntheticBoilerplate(candidate.description)));
      const w1Expanded = expandirTokens(w1);
      if ([...w1Expanded].some(w => w2.has(w))) return true;
    }
    return false;
  }
  // length > 2 (27/08/2026, mesmo limiar do tokenizar): antes, um nome
  // curto real (ex: "Rex", 3 letras) só passava "por acidente" porque a
  // palavra de categoria ("cachorro") também estava nas duas strings e essa
  // sim tinha length > 3 — descoberto testando o fix de stopwords contra um
  // par de controle real (mesmo nome, mesma cor). Com "cachorro" virando
  // stopword, manter o limiar em > 3 bloquearia esse match legítimo junto
  // com os falsos positivos.
  //
  // Descrição incluída aqui (29/08/2026): até então só o título contava
  // pra admin/cron (só o caminho individual olhava descrição, e mesmo
  // assim só como pontos extras, não como parte do gate). Investigando o
  // par Duke/Branca × "Cachorra encontrada" (ambos bairro Neva), a razão
  // de não terem casado acabou sendo outra (o achado foi ingerido depois
  // da última rodada de matching) — mas a lacuna em si é real: um objeto
  // com detalhe distintivo só na descrição (não repetido no título) nunca
  // tinha chance de passar pelo gate nos caminhos admin/cron, mesmo o
  // dado já existindo em objects.description.
  if (simpleWordOverlap(obj.title, candidate.title)) return true;
  if (simpleWordOverlap(stripSyntheticBoilerplate(obj.description), stripSyntheticBoilerplate(candidate.description))) return true;
  return false;
}

function simpleWordOverlap(textA: unknown, textB: unknown): boolean {
  const wordsA = String(textA || '').toLowerCase().split(/\s+/).filter(Boolean);
  const wordsB = String(textB || '').toLowerCase().split(/\s+/).filter(Boolean);
  return wordsA.some(w => w.length > 2 && !isStopword(w) && wordsB.includes(w));
}

// FUNIL DE MATCHING EM ESTAGIOS (27/08/2026)
//
// Redesenho aprovado por Marcos, ver comparacao completa na conversa.
// Substitui o score linear (categoria+distancia+texto+cor somados) como
// criterio de decisao por estagios eliminatorios, do mais barato pro mais
// caro:
//
//   ESTAGIO 1 (SQL, ja existe nos 3 route.ts, sem mudanca de lugar):
//     categoria compativel + is_legacy=false + distancia <= raio.
//
//   ESTAGIO 2 (aqui embaixo): hasTextOverlap OBRIGATORIO primeiro (elimina
//     sem nem calcular confianca) -- so depois soma sinais corroborantes
//     (distancia + cor + marca, categoria excluida por ja ter sido usada
//     no estagio 1) numa "confianca" que decide DIRETO vs AMBIGUO.
//
//   ESTAGIO 3 (semanticMatchScore, promovido de matching/run/route.ts pra
//     cá): so roda pra quem ficou AMBIGUO no estagio 2 -- antes so existia
//     no caminho individual, agora formalizado e reaproveitavel nos 3.
//
//   ESTAGIO 4 (especie/pet_species): reservado, fora de escopo agora --
//     o funil ja fica pronto pra receber sem precisar reestruturar de novo.
//
// Estimativa real rodada contra a base atual (27/08/2026, script
// temporario, deletado): de 708 pares que sobrevivem ao estagio 1, 678 sao
// eliminados aqui por falta de overlap real de texto, 21 viram match
// direto e so 9 vao pro estagio 3 -- volume seguro pra formalizar LLM nos
// 3 caminhos (cron incluso) sem repetir o susto dos "668 candidatos".

// Confianca minima do estagio 2 pra virar match direto sem precisar do
// estagio 3. Constante nomeada e documentada de proposito -- e o ponto
// mais facil de ficar desalinhado entre os 3 caminhos de novo, mesmo
// problema ja visto com o score duplicado antes da consolidacao.
export const STAGE2_DIRECT_MATCH_CONFIDENCE = 40;
// Abaixo disso, mesmo tendo overlap de texto real, os sinais corroborantes
// (distancia/cor/marca) sao fracos demais pra justificar o custo do
// estagio 3 -- elimina de vez em vez de gastar chamada de LLM.
export const STAGE2_AMBIGUOUS_MIN_CONFIDENCE = 15;

export interface Stage2Options {
  color?: boolean; // true por padrao (default abaixo) -- so false se o chamador quiser ignorar cor
  brand?: boolean; // true so no caminho admin, onde marca e coletada
}

// Soma so os sinais do ESTAGIO 2 (distancia, cor, marca) -- categoria fica
// de fora de proposito, ja foi usada como filtro eliminatorio no estagio 1
// e nao deveria contar de novo (peso morto identificado no diagnostico
// original: par que ja sobreviveu o filtro de categoria ganhava +30 de
// graca, sem informacao nova).
export function computeStage2Confidence(
  obj: Record<string, unknown>,
  candidate: Record<string, unknown>,
  options: Stage2Options = {}
): number {
  let confidence = 0;

  const lat1 = parseFloat(obj.latitude as string);
  const lon1 = parseFloat(obj.longitude as string);
  const lat2 = parseFloat(candidate.latitude as string);
  const lon2 = parseFloat(candidate.longitude as string);
  if (!isNaN(lat1) && !isNaN(lat2)) {
    const distKm = haversineKm(lat1, lon1, lat2, lon2);
    if (distKm <= 2) confidence += 40;
    else if (distKm <= 10) confidence += 30;
    else if (distKm <= 25) confidence += 15;
    else if (distKm <= 50) confidence += 5;
  } else {
    confidence += 15; // sem localizacao, beneficio da duvida (mesmo de hoje)
  }

  if (options.color !== false && obj.color && candidate.color) {
    if (normalizarPalavra(obj.color as string) === normalizarPalavra(candidate.color as string)) {
      confidence += 10;
    }
  }

  if (options.brand && obj.brand && candidate.brand && obj.brand === candidate.brand) {
    confidence += 10;
  }

  return confidence;
}

// Checagem leve de espécie (29/08/2026) -- versão reduzida do pet_species
// completo (esse continua reservado pro Estágio 4, fora de escopo). Só
// palavra-chave no título de cada lado; se os dois tiverem um sinal claro
// e forem espécies diferentes, elimina no Estágio 2, antes do LLM — mesmo
// nível dos outros filtros baratos. Se qualquer lado não tiver sinal claro
// (ex: "Perdi meu bichinho"), não elimina, deixa pros estágios seguintes
// decidirem. Achado real: "Gata Fioninha" batendo com "Cachorro
// encontrado" só por compartilharem o nome do bairro — nenhum dos dois
// filtros de texto (overlap genérico, agora com stopwords) pega isso
// sozinho, porque "Fioninha" e "Cachorro" são palavras reais, só que de
// espécies diferentes.
const SPECIES_PATTERNS: Record<string, RegExp> = {
  cachorro: /cachorr|cadela|canino|vira-?lata|pinscher|labrador|poodle|pastor|buldogue|rottweiler|beagle|d[aá]lmata|husky|shih-?tzu|shitzu|chihuahua|golden retriever/i,
  gato: /\bgat[oa]s?\b|felino|\bpersa\b|siam[eê]s|angor[áa]|maine coon/i,
  ave: /calopsita|papagaio|periquito|canario|canário|\barara\b|curi[oó]|cacatua/i,
};

function detectSpecies(text: unknown): string | null {
  const str = String(text || '');
  for (const species of Object.keys(SPECIES_PATTERNS)) {
    if (SPECIES_PATTERNS[species].test(str)) return species;
  }
  return null;
}

// Exportado pra permitir teste/depuração isolada -- não é usado direto
// pelos route.ts, que chamam classifyStage2.
export function hasSpeciesConflict(
  obj: Record<string, unknown>,
  candidate: Record<string, unknown>
): boolean {
  const s1 = detectSpecies(obj.title);
  const s2 = detectSpecies(candidate.title);
  return s1 !== null && s2 !== null && s1 !== s2;
}

export type Stage2Decision = 'eliminated' | 'ambiguous' | 'direct';

export interface Stage2Result {
  decision: Stage2Decision;
  confidence: number;
  textOverlap: boolean;
  speciesConflict?: boolean;
}

// Orquestrador do estagio 2 -- ponto de entrada unico pros 3 route.ts,
// substitui a linha antiga `score >= threshold && hasTextOverlap(...)`.
export function classifyStage2(
  obj: Record<string, unknown>,
  candidate: Record<string, unknown>,
  overlapOptions: MatchScoreOptions = {},
  confidenceOptions: Stage2Options = {}
): Stage2Result {
  if (hasSpeciesConflict(obj, candidate)) {
    return { decision: 'eliminated', confidence: 0, textOverlap: false, speciesConflict: true };
  }
  const textOverlap = hasTextOverlap(obj, candidate, overlapOptions);
  if (!textOverlap) {
    return { decision: 'eliminated', confidence: 0, textOverlap: false };
  }
  const confidence = computeStage2Confidence(obj, candidate, confidenceOptions);
  if (confidence >= STAGE2_DIRECT_MATCH_CONFIDENCE) {
    return { decision: 'direct', confidence, textOverlap: true };
  }
  if (confidence >= STAGE2_AMBIGUOUS_MIN_CONFIDENCE) {
    return { decision: 'ambiguous', confidence, textOverlap: true };
  }
  return { decision: 'eliminated', confidence, textOverlap: true };
}

// ESTAGIO 3 -- validacao semantica via LLM (27/08/2026)
// Promovido de matching/run/route.ts pra ca -- antes so existia no
// caminho individual, como um `else if` ad-hoc pra faixa de score 20-39.
// Agora e um estagio formal do funil, reaproveitavel pelos 3 caminhos:
// so roda pra quem `classifyStage2` classificou como 'ambiguous'.
export async function semanticMatchScore(
  obj: Record<string, unknown>,
  candidate: Record<string, unknown>
): Promise<number> {
  try {
    const prompt = `Você é um especialista em recuperação de objetos perdidos.
Avalie se os dois objetos abaixo provavelmente são o mesmo objeto.

OBJETO A (${obj.status === 'lost' ? 'PERDIDO' : 'ACHADO'}):
Título: ${obj.title}
Descrição: ${obj.description || '(sem descrição)'}
Cor: ${obj.color || '(não informada)'}
Categoria: ${obj.category || obj.type || '(não informada)'}

OBJETO B (${candidate.status === 'lost' ? 'PERDIDO' : 'ACHADO'}):
Título: ${candidate.title}
Descrição: ${candidate.description || '(sem descrição)'}
Cor: ${candidate.color || '(não informada)'}
Categoria: ${candidate.category || candidate.type || '(não informada)'}

Responda APENAS com um JSON no formato:
{"score": <número de 0 a 100>, "reason": "<explicação em uma frase>"}

Onde score representa a probabilidade de serem o mesmo objeto:
0-20: improvável | 21-50: possível | 51-80: provável | 81-100: quase certeza`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 150,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) return 0;

    const data = await response.json();
    const text = data.content?.[0]?.text || '';
    const clean = text.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);
    return typeof parsed.score === 'number' ? parsed.score : 0;
  } catch {
    console.error('[matching] Erro na validação semântica');
    return 0; // falha silenciosa — não bloqueia o fluxo
  }
}

// Threshold pra aceitar o veredito do estagio 3 -- mesmo valor historico
// que ja existia so no caminho individual (aiScore >= 60), agora
// compartilhado pelos 3.
export const STAGE3_SEMANTIC_ACCEPT_THRESHOLD = 60;
