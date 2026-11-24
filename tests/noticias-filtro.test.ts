// Painel «Notícias recentes» do mapa: filtro de relevância, idade, duplicados e limpeza de HTML (src/lib/noticias/filtro.ts).
// A AMOSTRA abaixo são os 15 itens REAIS que a produção mostrava em 24/11/2026 (manchetes e fontes como vieram do Google News), classificados no diagnóstico
// (docs/mapa-noticias/DIAGNOSTICO.md): 6 relevantes, 2 tangenciais (dica do GOV.BR) e 7 irrelevantes. Estes testes existem para que o filtro NÃO possa
// sumir ou afrouxar sem alguém perceber: a rota nasceu em 13/04/2026 sem filtro nenhum e ninguém notou por 7 meses.
import { describe, expect, it } from 'vitest';
import {
  BUSCAS, IDADE_MAXIMA_DIAS, MAXIMO_ITENS, avaliarTitulo, dentroDaIdade, filtrarNoticias, lerRss, limparHtml, semelhanca, tituloSemFonte, urlDaBusca, type Noticia,
} from '@/lib/noticias/filtro';

const AGORA = Date.parse('2026-11-24T04:42:00Z');
const AMOSTRA: Array<{ n: number; grupo: 'relevante' | 'tangencial' | 'irrelevante'; source: string; pubDate: string; title: string }> = [
  { n: 1, grupo: 'irrelevante', source: "ClickPB", pubDate: '2026-11-21T18:34:00Z', title: "Com filha de 7 anos no carro, motorista embriagado é preso após bater em quatro carros em São Bernardo do Campo - ClickPB" },
  { n: 2, grupo: 'irrelevante', source: "Portal do Marcos Santos", pubDate: '2026-11-20T23:39:35Z', title: "Polícia Federal diz que não foram encontrados registros de conversas entre Vorcaro e Mendonça - Portal do Marcos Santos" },
  { n: 3, grupo: 'irrelevante', source: "TV Sim Brasil", pubDate: '2026-11-18T20:32:33Z', title: "Meta lança app Achados no Brasil para disputar OLX e Enjoei - TV Sim Brasil" },
  { n: 4, grupo: 'irrelevante', source: "Tecnoblog", pubDate: '2026-11-17T17:44:06Z', title: "Meta lança Achados, app para comprar e vender itens no Brasil - Tecnoblog" },
  { n: 5, grupo: 'irrelevante', source: "Exame", pubDate: '2026-11-17T16:35:27Z', title: "Meta lança Achados no Brasil, app que reúne anúncios do Facebook e Instagram - Exame" },
  { n: 6, grupo: 'relevante', source: ":: Bahia Jornal ::", pubDate: '2026-11-13T20:42:35Z', title: "Polícia Civil recupera celulares com restrição de furto ou roubo em Ribeira do Pombal e Euclides da Cunha - :: Bahia Jornal ::" },
  { n: 7, grupo: 'relevante', source: ":: Bahia Jornal ::", pubDate: '2026-11-12T20:41:11Z', title: "Celular com restrição de roubo é recuperado em Euclides da Cunha - :: Bahia Jornal ::" },
  { n: 8, grupo: 'relevante', source: "band.com.br", pubDate: '2026-11-12T14:54:12Z', title: "Celular roubado de ex-marido de Ivete Sangalo é recuperado em São Paulo - band.com.br" },
  { n: 9, grupo: 'relevante', source: "CNN Brasil", pubDate: '2026-11-10T08:00:00Z', title: "Mais de três mil celulares roubados no Rio serão devolvidos para vítimas - CNN Brasil" },
  { n: 10, grupo: 'tangencial', source: "Impactto News", pubDate: '2026-11-07T08:00:00Z', title: "Perdeu ou teve o celular roubado? Veja como recuperar a conta GOV.BR em minutos - Impactto News" },
  { n: 11, grupo: 'tangencial', source: "Capital Digital", pubDate: '2026-11-06T08:00:00Z', title: "GOV.BR orienta 56 milhões de usuários a cadastrar e-mail para recuperar conta em caso de perda ou roubo do celular - Capital Digital" },
  { n: 12, grupo: 'irrelevante', source: "BBC", pubDate: '2026-10-27T07:00:00Z', title: "Flávio Bolsonaro pode ser considerado foragido? - BBC" },
  { n: 13, grupo: 'relevante', source: "G1", pubDate: '2026-10-20T07:00:00Z', title: "Polícia recupera 17 celulares com registro de roubo ou furto em casa abandonada em Belém - G1" },
  { n: 14, grupo: 'irrelevante', source: "Île-de-France Mobilités", pubDate: '2026-10-19T07:00:00Z', title: "Uma plataforma única para encontrar itens perdidos no transporte - Île-de-France Mobilités" },
  { n: 15, grupo: 'relevante', source: "R7", pubDate: '2026-10-13T07:00:00Z', title: "Segurança Presente prende suspeito de roubo e recupera celulares na avenida Brasil, no Rio - R7" },
];
const item = (a: (typeof AMOSTRA)[number]): Noticia => ({ title: a.title, link: `https://news.google.com/rss/articles/item${a.n}`, source: a.source, pubDate: a.pubDate, description: '' });
const sem = (a: (typeof AMOSTRA)[number]) => tituloSemFonte(a.title, a.source);

describe('relevância pelo título (amostra real de produção)', () => {
  it('a amostra tem 6 relevantes, 2 tangenciais e 7 irrelevantes', () => {
    expect(AMOSTRA.filter((a) => a.grupo === 'relevante')).toHaveLength(6);
    expect(AMOSTRA.filter((a) => a.grupo === 'tangencial')).toHaveLength(2);
    expect(AMOSTRA.filter((a) => a.grupo === 'irrelevante')).toHaveLength(7);
  });
  for (const a of AMOSTRA.filter((x) => x.grupo === 'relevante')) {
    it(`FICA #${a.n}: ${sem(a).slice(0, 60)}`, () => expect(avaliarTitulo(sem(a)).ok).toBe(true));
  }
  for (const a of AMOSTRA.filter((x) => x.grupo !== 'relevante')) {
    it(`SAI #${a.n} (${a.grupo}): ${sem(a).slice(0, 60)}`, () => expect(avaliarTitulo(sem(a)).ok).toBe(false));
  }
});

describe('exemplos do escopo definido pelo fundador', () => {
  const ficam = [
    'Polícia faz mutirão para devolver celulares roubados',
    'Polícia recupera 20 carros roubados em operação',
    'Polícia recupera produtos de furtos em loja de eletrônicos',
    'Achados e perdidos do aeroporto devolve objetos esquecidos por passageiros',
    'Metrô devolve documentos perdidos a donos em achados e perdidos',
    'Prefeitura inicia devolução de objetos perdidos nos terminais',
    'Carga roubada é recuperada pela polícia rodoviária',
    'PCMG já recuperou 2,2 mil celulares roubados em Minas Gerais',
    'Polícia Civil promove a devolução de 3 mil celulares recuperados na operação Rastreio',
    'PM recupera Toyota Yaris e iPhones roubados durante assalto a residência',
    'Polícia devolve mais de 3 mil celulares roubados no Rio; veja como recuperar o seu',
    'PRF recupera veículo em Irajá',
  ];
  for (const t of ficam) it(`fica: ${t}`, () => expect(avaliarTitulo(t).ok, avaliarTitulo(t).motivo).toBe(true));

  const saem: Array<[string, string]> = [
    ['Senado aprova projeto sobre roubo de celulares', 'política'],
    ['Suspeito é preso por roubo de celular em ônibus', 'crime sem bem recuperado'],
    ['Como recuperar celular roubado: veja o passo a passo', 'dica'],
    ['Meta lança app Achados para vender celulares usados', 'app de nome parecido'],
    ['Polícia de Lisboa recupera telemóveis roubados', 'outro país'],
    ['Homem é morto em assalto e polícia recupera celular roubado', 'violência explícita'],
    ['Loja anuncia promoção de celulares recuperados de leilão', 'propaganda'],
    ['Delegacia investiga furto de carro', 'investigação sem recuperação'],
  ];
  for (const [t, porque] of saem) it(`sai (${porque}): ${t}`, () => expect(avaliarTitulo(t).ok).toBe(false));
});

describe('filtrarNoticias: a lista inteira da produção', () => {
  const todos = AMOSTRA.map(item);
  it('sem corte de idade, ficam exatamente os 6 relevantes (e nenhum dos 9 outros)', () => {
    const r = filtrarNoticias(todos, { agora: AGORA, dias: 365 });
    const links = r.map((x) => x.link);
    for (const a of AMOSTRA) expect(links.includes(item(a).link), `#${a.n}`).toBe(a.grupo === 'relevante');
  });
  it('com o corte de ' + IDADE_MAXIMA_DIAS + ' dias, os 2 mais velhos (35 e 42 dias) saem e ficam 4', () => {
    const fica = filtrarNoticias(todos, { agora: AGORA }).map((x) => x.link).sort();
    expect(fica).toEqual([6, 7, 8, 9].map((n) => `https://news.google.com/rss/articles/item${n}`).sort());
    expect(filtrarNoticias(todos, { agora: AGORA })).toHaveLength(4);
  });
  it('mais novo primeiro, e o sufixo « - Fonte» sai do título (a fonte aparece ao lado)', () => {
    const r = filtrarNoticias(todos, { agora: AGORA });
    const datas = r.map((x) => Date.parse(x.pubDate));
    expect([...datas].sort((a, b) => b - a)).toEqual(datas);
    for (const x of r) expect(x.title.endsWith(` - ${x.source}`)).toBe(false);
  });
  it('respeita o máximo de itens', () => {
    const muitos: Noticia[] = Array.from({ length: 40 }, (_, i) => ({ title: `Polícia recupera ${i + 100} celulares roubados no bairro ${'abcdefghij'[i % 10]}${i}`, link: `https://x.test/${i}`, source: 'Teste', pubDate: '2026-11-20T10:00:00Z', description: '' }));
    expect(filtrarNoticias(muitos, { agora: AGORA, maximo: 5 }).length).toBeLessThanOrEqual(5);
    expect(MAXIMO_ITENS).toBe(15);
  });
});

describe('idade', () => {
  it('aceita até ' + IDADE_MAXIMA_DIAS + ' dias; recusa mais velho, sem data, data inválida e data muito no futuro', () => {
    expect(dentroDaIdade('2026-11-10T00:00:00Z', AGORA)).toBe(true);
    expect(dentroDaIdade('2026-10-13T00:00:00Z', AGORA)).toBe(false);
    expect(dentroDaIdade('', AGORA)).toBe(false);
    expect(dentroDaIdade('não é data', AGORA)).toBe(false);
    expect(dentroDaIdade('2027-01-01T00:00:00Z', AGORA)).toBe(false);
  });
});

describe('duplicados', () => {
  it('o mesmo assunto de veículos diferentes vira um item só (o mais novo)', () => {
    const base = { link: '', description: '' };
    const lista: Noticia[] = [
      { ...base, link: 'https://a.test/1', source: 'A', pubDate: '2026-11-20T10:00:00Z', title: 'Polícia recupera 17 celulares roubados em casa abandonada em Belém' },
      { ...base, link: 'https://b.test/2', source: 'B', pubDate: '2026-11-21T10:00:00Z', title: 'Polícia recupera 17 celulares roubados em casa abandonada de Belém' },
      { ...base, link: 'https://c.test/3', source: 'C', pubDate: '2026-11-19T10:00:00Z', title: 'Polícia devolve veículos roubados a donos em Goiânia' },
    ];
    const r = filtrarNoticias(lista, { agora: AGORA });
    expect(r).toHaveLength(2);
    expect(r[0].link).toBe('https://b.test/2');
  });
  it('mesmo fato com palavras diferentes, mas o mesmo número («48 celulares»), é um item só', () => {
    const base = { link: '', description: '', source: 'X', pubDate: '2026-11-20T10:00:00Z' };
    const lista: Noticia[] = [
      { ...base, link: 'https://a.test/1', title: 'Operação da Polícia Civil recupera 48 celulares furtados e prende cinco suspeitos na Micareta de Feira' },
      { ...base, link: 'https://b.test/2', title: 'Polícia prende mais cinco e recupera 48 celulares durante micareta de Feira; grupo é conhecido por ações em eventos' },
    ];
    expect(filtrarNoticias(lista, { agora: AGORA })).toHaveLength(1);
  });
  it('histórias parecidas mas de lugares e números diferentes continuam separadas', () => {
    const base = { link: '', description: '', source: 'X', pubDate: '2026-11-20T10:00:00Z' };
    const lista: Noticia[] = [
      { ...base, link: 'https://a.test/1', title: 'PRF recupera carro roubado em Niterói' },
      { ...base, link: 'https://b.test/2', title: 'PRF recupera moto furtada em Curitiba' },
    ];
    expect(filtrarNoticias(lista, { agora: AGORA })).toHaveLength(2);
  });
  it('mesmo link repetido entra uma vez', () => {
    const n: Noticia = { title: 'Polícia devolve celulares roubados em Recife', link: 'https://a.test/1', source: 'A', pubDate: '2026-11-20T10:00:00Z', description: '' };
    expect(filtrarNoticias([n, { ...n, title: 'Mutirão devolve celulares roubados em Recife hoje' }], { agora: AGORA })).toHaveLength(1);
  });
  it('semelhança: iguais = 1, sem nada em comum = 0', () => {
    expect(semelhanca('Polícia recupera celulares', 'Polícia recupera celulares')).toBe(1);
    expect(semelhanca('Polícia recupera celulares', 'Prefeitura inaugura escola')).toBe(0);
  });
});

describe('limpeza de HTML (bug do stripHtml: tirava as tags ANTES de decodificar as entidades)', () => {
  it('HTML escapado do Google vira texto limpo (o caso real: <a href=...>título</a>&nbsp;<font>fonte</font>)', () => {
    const cru = '&lt;a href="https://news.google.com/rss/articles/abc?oc=5"&gt;Celular recuperado em SP&lt;/a&gt;&amp;nbsp;&lt;font color="#6f6f6f"&gt;band.com.br&lt;/font&gt;';
    const limpo = limparHtml(cru);
    expect(limpo).toBe('Celular recuperado em SP band.com.br');
    expect(limpo).not.toMatch(/[<>]|href|&lt;|&gt;/);
  });
  it('entidades numéricas e CDATA', () => {
    expect(limparHtml('<![CDATA[Cão &#39;Rex&#39; &amp; dono]]>')).toBe("Cão 'Rex' & dono");
    expect(limparHtml('a&#x2013;b')).toBe('a–b');
  });
  it('tags reais também saem', () => { expect(limparHtml('<b>oi</b>  <i>tudo</i>')).toBe('oi tudo'); });
});

describe('leitura do RSS', () => {
  const xml = `<rss><channel>
    <item><title>Polícia recupera celulares roubados em Natal - G1</title><link>https://news.google.com/rss/articles/x1</link><pubDate>Tue, 20 Oct 2026 07:00:00 GMT</pubDate>
      <description>&lt;a href="https://news.google.com/rss/articles/x1"&gt;Polícia recupera celulares&lt;/a&gt;</description><source url="https://g1.globo.com">G1</source></item>
    <item><title>sem link</title></item>
  </channel></rss>`;
  it('lê título, link, fonte e data; descrição sem HTML; item sem link é ignorado', () => {
    const r = lerRss(xml);
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ title: 'Polícia recupera celulares roubados em Natal - G1', source: 'G1', link: 'https://news.google.com/rss/articles/x1' });
    expect(r[0].description).toBe('Polícia recupera celulares');
  });
});

describe('buscas', () => {
  it('são específicas do escopo (nenhuma é a busca ampla antiga) e vão para o Brasil em português com limite de dias', () => {
    expect(BUSCAS.length).toBeGreaterThanOrEqual(6);
    for (const b of BUSCAS) {
      expect(b).toMatch(/recupera|devolv|devolu|mutir|recuperad|achados e perdidos/i);
      expect(urlDaBusca(b)).toContain('hl=pt-BR');
      expect(urlDaBusca(b)).toContain('gl=BR');
      expect(decodeURIComponent(urlDaBusca(b))).toContain(`when:${IDADE_MAXIMA_DIAS}d`);
    }
    for (const antiga of ['objeto perdido encontrado Brasil', 'celular roubado recuperado Brasil', 'achado e entregue Brasil']) expect(BUSCAS).not.toContain(antiga);
  });
});
