// Painel «Notícias recentes» do mapa: filtro de relevância, idade, país, duplicados e limpeza de HTML. Funções PURAS (sem rede, sem relógio escondido):
// a rota `src/app/api/v1/news/route.ts` só busca os feeds e chama `filtrarNoticias`. Testes em `tests/noticias-filtro.test.ts` e `tests/noticias-rota.test.ts`
// impedem que o filtro deixe de ser aplicado sem alguém perceber (a rota nasceu em 13/04/2026 SEM filtro de relevância: ver `docs/mapa-noticias/DIAGNOSTICO.md`).
//
// ESCOPO (decisão do fundador, 24/11/2026): notícias do BRASIL sobre RECUPERAÇÃO ou DEVOLUÇÃO de bens perdidos, furtados ou roubados (polícia recupera/devolve
// celulares, veículos, cargas, objetos; achados e perdidos de aeroportos, metrô, terminais e prefeituras). NÃO entra: política; crime sem bem recuperado ou
// devolvido; dicas e serviços; produtos e apps de nome parecido; outros países; propaganda; violência explícita.
// Sem IA (opção A): termos fixos, lista de exclusões, corte de idade. Limite conhecido: lista de países é parcial (ver PAISES_FORA).

export interface Noticia {
  title: string;
  link: string;
  source: string;
  pubDate: string;
  description: string;
}

/** Idade máxima de uma notícia no painel. */
export const IDADE_MAXIMA_DIAS = 30;
/** Máximo de itens devolvidos ao painel. */
export const MAXIMO_ITENS = 15;
/** Semelhança de títulos (Jaccard das palavras) a partir da qual dois itens são o mesmo assunto. */
export const LIMITE_SEMELHANCA = 0.6;
/** Se os dois títulos citam o mesmo número (de 2 ou mais dígitos, ex.: «48 celulares»), basta uma semelhança menor: é quase certo o mesmo fato. */
export const LIMITE_COM_NUMERO = 0.3;

/** Buscas do Google News (RSS). Específicas do escopo; o `when:30d` do Google já corta o que é velho na origem (o código confere a data de novo). */
export const BUSCAS = [
  'polícia devolve celulares roubados',
  'mutirão devolução celulares roubados',
  'polícia recupera celulares roubados',
  'polícia recupera veículos roubados',
  'carga roubada recuperada',
  'objetos furtados recuperados polícia',
  'achados e perdidos devolução objetos',
] as const;

export const urlDaBusca = (busca: string): string =>
  `https://news.google.com/rss/search?q=${encodeURIComponent(`${busca} when:${IDADE_MAXIMA_DIAS}d`)}&hl=pt-BR&gl=BR&ceid=BR:pt-419`;

// ── Limpeza de HTML ──────────────────────────────────────────────────────────────────────────────────────────────────
// Bug antigo (BACKFINDR.md): o código tirava as tags ANTES de decodificar as entidades, então o HTML escapado do Google (`&lt;a href=...&gt;`) passava cru.
// Agora: decodifica primeiro (até 2 vezes, para o escape duplo), depois tira as tags, junta os espaços.
const ENTIDADES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

function decodificar(texto: string): string {
  return texto
    .replace(/&#x([0-9a-f]+);/gi, (_, h: string) => { const n = parseInt(h, 16); return n > 0 && n < 0x110000 ? String.fromCodePoint(n) : ''; })
    .replace(/&#(\d+);/g, (_, d: string) => { const n = parseInt(d, 10); return n > 0 && n < 0x110000 ? String.fromCodePoint(n) : ''; })
    .replace(/&([a-z]+);/gi, (m, nome: string) => ENTIDADES[nome.toLowerCase()] ?? m);
}

export function limparHtml(html: string): string {
  let t = String(html ?? '');
  const cdata = t.match(/^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/);
  if (cdata) t = cdata[1];
  for (let i = 0; i < 2; i++) t = decodificar(t);
  return t.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

// ── Texto para comparação ────────────────────────────────────────────────────────────────────────────────────────────
/** Minúsculas, sem acento, só letras/números/espaço (permite usar \b nas expressões). */
export const normalizar = (t: string): string =>
  t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

/** O Google acrescenta « - Veículo» ao fim do título; tira esse sufixo quando é igual à fonte (o painel já mostra a fonte ao lado). */
export function tituloSemFonte(titulo: string, fonte: string): string {
  const t = titulo.trim(); const f = fonte.trim();
  if (f && t.toLowerCase().endsWith(` - ${f.toLowerCase()}`)) return t.slice(0, t.length - f.length - 3).trim();
  return t;
}

// ── Regras de relevância (sobre o TÍTULO normalizado, sem a fonte) ───────────────────────────────────────────────────
// 1) verbo/ato de recuperação ou devolução
const RECUPERACAO = /\b(recuper\w*|devolv\w*|devolucao|devolucoes|restitu\w*|mutirao|reaveu|reaver|entreg\w+ (aos?|as?) (donos?|vitimas?|proprietarios?|donas?)|entregu\w+ (a|as|na|pela) (policia|delegacia))\b/;
// 2) bem (objeto, veículo, carga...)
const BEM = /\b(celular\w*|smartphones?|aparelhos?|veiculos?|carros?|motos?|motocicletas?|bicicletas?|bikes?|caminh\w+|cargas?|objetos?|documentos?|pertences?|bagagens?|malas?|produtos?|mercadorias?|eletronicos?|iphones?|tablets?|drones?|televisao|televisores?|equipamentos?|automoveis?|picapes?|tratores?|notebooks?|computadores?|relogios?|joias?|bens|ferramentas?|cabos?|fios|itens|pecas?)\b/;
// 3) contexto: perda/furto/roubo, achados e perdidos, OU quem recupera/devolve é a polícia/uma operação/um mutirão (o título costuma omitir «roubado»)
const CONTEXTO = /\b(roub\w+|furt\w+|perdid\w+|extravi\w+|esquecid\w+|achados e perdidos|subtraid\w+|restricao|polic\w+|pm|prf|pcmg|pcerj|delegacia\w*|operacao|mutirao|batalhao|guarda municipal)\b/;

// Exclusões: qualquer uma derruba o item, mesmo que passe nas três regras acima.
const EXCLUSOES: Array<[string, RegExp]> = [
  ['dica ou serviço', /\b(passo a passo|dicas?|tutorial|gov br|govbr|senha|login|conta|contas|e mail|golpes?|pix|aplicativos?|apps?)\b/],
  ['produto ou app de nome parecido', /\b(meta|olx|enjoei|marketplace|facebook|instagram|mercado livre|shopee|achados no brasil|anuncios?|promocao|oferta|desconto|cupom)\b/],
  ['política', /\b(politic\w*|eleicao|eleicoes|eleitoral|eleitoral|partido|senador\w*|deputad\w*|vereador\w*|governador\w*|prefeito|ministro|ministerio publico|stf|congresso|senado|bolsonaro|lula|planalto|impeachment|delacao)\b/],
  ['violência explícita', /\b(homicidio\w*|assassin\w+|latrocinio|estupro|cadaver|esfaque\w*|decapit\w*|morto|morta|mortos|mortas|morre\w*|morreu|feminicidio|chacina|tiroteio)\b/],
  ['outro país', new RegExp(`\\b(${[
    'ile de france', 'paris', 'portugal', 'lisboa', 'espanha', 'madri', 'italia', 'roma', 'alemanha', 'reino unido',
    'londres', 'estados unidos', 'eua', 'nova york', 'argentina', 'buenos aires', 'uruguai', 'chile', 'colombia', 'mexico', 'peru', 'paraguai', 'bolivia', 'venezuela', 'china', 'japao', 'india',
  ].join('|')})\\b`)],
];

export type Motivo = 'ok' | 'sem recuperação/devolução' | 'sem bem' | 'sem perda/furto/roubo' | string;

/** Diz se o título é do escopo do painel e, se não for, o motivo (usado nos testes e na amostra do diagnóstico). */
export function avaliarTitulo(tituloSemSufixo: string): { ok: boolean; motivo: Motivo } {
  const t = normalizar(tituloSemSufixo);
  for (const [nome, re] of EXCLUSOES) if (re.test(t)) return { ok: false, motivo: `excluído: ${nome}` };
  if (!RECUPERACAO.test(t)) return { ok: false, motivo: 'sem recuperação/devolução' };
  if (!BEM.test(t)) return { ok: false, motivo: 'sem bem' };
  if (!CONTEXTO.test(t)) return { ok: false, motivo: 'sem perda/furto/roubo' };
  return { ok: true, motivo: 'ok' };
}

// ── Idade ─────────────────────────────────────────────────────────────────────────────────────────────────────────────
/** Sem data válida = descarta (sem a data não dá para saber se é recente; mesma regra do Public Signals). Data no futuro além de 1 dia também descarta. */
export function dentroDaIdade(pubDate: string, agora: number, dias: number = IDADE_MAXIMA_DIAS): boolean {
  const t = pubDate ? new Date(pubDate).getTime() : NaN;
  if (!Number.isFinite(t)) return false;
  return t >= agora - dias * 86_400_000 && t <= agora + 86_400_000;
}

// ── Duplicados ────────────────────────────────────────────────────────────────────────────────────────────────────────
const PALAVRAS_VAZIAS = new Set(['de', 'da', 'do', 'das', 'dos', 'em', 'no', 'na', 'nos', 'nas', 'com', 'para', 'por', 'um', 'uma', 'uns', 'umas', 'ao', 'aos', 'as', 'os', 'que', 'e', 'o', 'a', 'apos', 'sao', 'foi', 'sera', 'serao', 'sobre']);
// Radical de 5 letras: «devolver/devolverem», «celular/celulares», «recupera/recuperou» contam como a mesma palavra; números e siglas ficam inteiros.
const radical = (p: string): string => (/^\d+$/.test(p) ? p : p.slice(0, 5));
const palavras = (titulo: string): Set<string> => new Set(normalizar(titulo).split(' ').filter((p) => p.length >= 3 && !PALAVRAS_VAZIAS.has(p)).map(radical));

const numeros = (titulo: string): Set<string> => new Set((normalizar(titulo).match(/\b\d{2,}\b/g) ?? []));

/** Mesmo assunto? Semelhança alta, ou semelhança média com um número em comum. */
export function mesmoAssunto(a: string, b: string): boolean {
  const sim = semelhanca(a, b);
  if (sim >= LIMITE_SEMELHANCA) return true;
  if (sim < LIMITE_COM_NUMERO) return false;
  const na = numeros(a); for (const n of numeros(b)) if (na.has(n)) return true;
  return false;
}

export function semelhanca(a: string, b: string): number {
  const A = palavras(a); const B = palavras(b);
  if (A.size === 0 || B.size === 0) return 0;
  let comuns = 0; for (const p of A) if (B.has(p)) comuns++;
  return comuns / (A.size + B.size - comuns);
}

// ── Junção ────────────────────────────────────────────────────────────────────────────────────────────────────────────
export interface OpcoesFiltro { agora?: number; dias?: number; maximo?: number }

/** Recebe os itens crus (já com HTML limpo) e devolve só os do escopo, recentes, sem duplicados, do mais novo para o mais antigo. */
export function filtrarNoticias(itens: Noticia[], opcoes: OpcoesFiltro = {}): Noticia[] {
  const agora = opcoes.agora ?? Date.now();
  const dias = opcoes.dias ?? IDADE_MAXIMA_DIAS;
  const maximo = opcoes.maximo ?? MAXIMO_ITENS;
  const candidatos = itens
    .map((n) => ({ ...n, title: tituloSemFonte(n.title, n.source) }))
    .filter((n) => n.link.startsWith('http') && n.title.length > 10)
    .filter((n) => dentroDaIdade(n.pubDate, agora, dias))
    .filter((n) => avaliarTitulo(n.title).ok)
    .sort((x, y) => new Date(y.pubDate).getTime() - new Date(x.pubDate).getTime());
  const escolhidos: Noticia[] = [];
  const links = new Set<string>();
  for (const n of candidatos) {
    if (links.has(n.link)) continue;
    if (escolhidos.some((e) => mesmoAssunto(e.title, n.title))) continue;
    links.add(n.link);
    escolhidos.push(n);
    if (escolhidos.length >= maximo) break;
  }
  return escolhidos;
}

// ── Leitura do RSS ───────────────────────────────────────────────────────────────────────────────────────────────────
/** Lê os `<item>` de um RSS do Google News. Título, descrição e fonte passam por `limparHtml`; o link é só aparado. */
export function lerRss(xml: string): Noticia[] {
  const itens: Noticia[] = [];
  const re = /<item>([\s\S]*?)<\/item>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) {
    const x = m[1];
    const pega = (tag: string) => x.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`))?.[1];
    const titulo = pega('title'); const link = pega('link');
    if (!titulo || !link) continue;
    const fonte = pega('source');
    itens.push({
      title: limparHtml(titulo),
      link: limparHtml(link),
      source: fonte ? limparHtml(fonte) : 'Google News',
      pubDate: (pega('pubDate') ?? '').trim(),
      description: limparHtml(pega('description') ?? '').substring(0, 200),
    });
  }
  return itens;
}
