// Etapa 1 da correção dos alertas do passo 2 (/flow/found e /flow/lost): relevância estrita opcional (`strict=1`),
// aviso de «busca ampla», oculto de «recuperado» e idade amigável. Parte 1 sem banco; parte 2 com Postgres real:
//   TEST_DATABASE_URL=postgres://postgres:pw@127.0.0.1:5432/backfindr_test \
//     npx vitest@2 run --config tests/vitest.config.ts tests/flow-match-relevance.test.ts
// ATENÇÃO: a parte 2 recria as tabelas do banco de teste. Use banco descartável.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import React from 'react';
import { readFileSync, readdirSync } from 'fs';
import path from 'path';
import { Pool } from 'pg';
import { renderToString } from 'react-dom/server';
import { NextRequest } from 'next/server';

(globalThis as unknown as { React: typeof React }).React = React;
const TEST_DB = process.env.TEST_DATABASE_URL;
if (TEST_DB) process.env.DATABASE_URL = TEST_DB;

import { isBuscaAmpla, palavrasDeIdentificacao, tituloRecuperado, temPalavraEmComum, temPalavraIdentificadoraEmComum, palavrasDoTexto, CORES, PALAVRAS_VAZIAS, MAX_REGISTROS_RECENTES, DIAS_REGISTROS_RECENTES } from '@/lib/flowMatch/relevance';
import { formatAge } from '@/lib/flowMatch/age';
import FlowMatchCard from '@/components/flow/FlowMatchCard';

const root = path.join(__dirname, '..');
const read = (rel: string) => readFileSync(path.join(root, rel), 'utf8');
const semComentarios = (s: string) => s.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

describe('busca ampla (regra objetiva: menos de 2 palavras de identificação)', () => {
  it('as 3 buscas da auditoria', () => {
    expect(palavrasDeIdentificacao('Pochete de couro preta')).toEqual(['pochete']); // «couro» é material, «preta» é cor, «de» é vazia
    expect(isBuscaAmpla('Pochete de couro preta')).toBe(true);
    expect(palavrasDeIdentificacao('Chaves de carro')).toEqual(['chave', 'carro']);
    expect(isBuscaAmpla('Chaves de carro')).toBe(false);
    expect(palavrasDeIdentificacao('Celular Samsung preto')).toEqual(['celular', 'samsung']);
    expect(isBuscaAmpla('Celular Samsung preto')).toBe(false);
  });
  it('só tipo, só cor, só vazias ou vazio são amplas; tipo + marca/modelo/lugar não', () => {
    for (const k of ['celular', 'celular azul', 'bolsa preta de couro', 'um objeto preto', 'perdi minha coisa', '', '   ', 'de da com']) expect(isBuscaAmpla(k), k).toBe(true);
    for (const k of ['iPhone 11', 'Samsung A10', 'carteira marrom Centro', 'cachorro pinscher', 'chaves Honda Civic']) expect(isBuscaAmpla(k), k).toBe(false);
  });
  it('acento, caixa e pontuação não atrapalham', () => {
    expect(isBuscaAmpla('POCHETE, de couro PRETA!')).toBe(true);
    expect(isBuscaAmpla('Óculos de grau, Ray-Ban')).toBe(false);
  });
  it('listas fechadas: cores e palavras vazias conhecidas', () => {
    for (const c of ['preto', 'preta', 'branca', 'azul', 'cinza', 'marrom', 'rosa', 'dourado']) expect(CORES.has(c), c).toBe(true);
    for (const v of ['de', 'da', 'com', 'uma', 'meu', 'perdi']) expect(PALAVRAS_VAZIAS.has(v), v).toBe(true);
  });
});

describe('«cor sozinha não conta»', () => {
  const s = (...w: string[]) => new Set(w);
  it('só cor em comum: não passa; palavra de identificação em comum: passa', () => {
    expect(temPalavraEmComum(s('pochete', 'couro', 'preta'), s('gatinha', 'preta'), s('gata', 'preta'))).toBe(false);
    expect(temPalavraEmComum(s('pochete', 'couro', 'preta'), s('bolsa', 'couro'), s())).toBe(true);
    expect(temPalavraEmComum(s('celular', 'preto'), s('celular', 'azul'), s())).toBe(true);
  });
  it('palavra vazia em comum não conta', () => {
    expect(temPalavraEmComum(s('com', 'preto'), s('com', 'preto'), s())).toBe(false);
  });
});

describe('«recuperado/recuperada» só como palavra inteira no título', () => {
  it('oculta', () => {
    for (const t of ['RECUPERADO - Cachorrinha', 'Gata Recuperada!', 'recuperado', 'Celular Samsung recuperádo', 'X (RECUPERADA)']) expect(tituloRecuperado(t), t).toBe(true);
  });
  it('não oculta', () => {
    for (const t of ['Celular Samsung - recuperação em andamento', 'Irrecuperável', 'recuperando meu celular', 'Recuperados', 'Perda de chave de carro', '', null, undefined]) expect(tituloRecuperado(t as string), String(t)).toBe(false);
  });
});

describe('registros recentes parecidos (busca ampla): palavra identificadora em comum', () => {
  it('limites: até 3 itens, últimos 90 dias', () => { expect(MAX_REGISTROS_RECENTES).toBe(3); expect(DIAS_REGISTROS_RECENTES).toBe(90); });
  it('palavra inteira, sem acento, sem cor/vazia/genérica e sem sinônimos', () => {
    expect(palavrasDoTexto('Celulares, Óculos-de-grau 11')).toEqual(new Set(['celulare', 'oculo', 'grau', '11']));
    expect(temPalavraIdentificadoraEmComum('Celular azul', 'Celular azul', 'Perdi no parque')).toBe(true);
    expect(temPalavraIdentificadoraEmComum('Celular azul', 'Bolsa azul', 'cor azul')).toBe(false);        // só a cor em comum
    expect(temPalavraIdentificadoraEmComum('Pochete de couro preta', 'Bolsa preta', 'bolsa de couro')).toBe(false); // «couro» é genérica; «bolsa» não é sinônimo aqui
    expect(temPalavraIdentificadoraEmComum('Pochete de couro preta', 'Pochete de couro marrom', '')).toBe(true);
    expect(temPalavraIdentificadoraEmComum('de da com', 'de da com', '')).toBe(false);
    expect(temPalavraIdentificadoraEmComum('Celular', 'Celularistas', '')).toBe(false); // palavra inteira, não pedaço
  });
});

describe('idade amigável', () => {
  const NOW = Date.parse('2026-11-12T12:00:00Z');
  const ago = (ms: number) => new Date(NOW - ms).toISOString();
  const D = 24 * 3600 * 1000;
  it('minutos e horas como antes', () => {
    expect(formatAge(ago(5 * 60000), NOW)).toBe('há 5 min');
    expect(formatAge(ago(3 * 3600000), NOW)).toBe('há 3h');
  });
  it('até 30 dias: dias', () => {
    expect(formatAge(ago(1 * D), NOW)).toBe('há 1 dia');
    expect(formatAge(ago(14 * D), NOW)).toBe('há 14 dias');
    expect(formatAge(ago(30 * D), NOW)).toBe('há 30 dias');
  });
  it('de 31 dias a 12 meses: meses', () => {
    expect(formatAge(ago(31 * D), NOW)).toBe('há 1 mês');
    expect(formatAge(ago(65 * D), NOW)).toBe('há 2 meses');
    expect(formatAge(ago(364 * D), NOW)).toBe('há 12 meses');
  });
  it('a partir de 1 ano: «há mais de N anos»', () => {
    expect(formatAge(ago(365 * D), NOW)).toBe('há mais de 1 ano');
    expect(formatAge(ago(4811 * D), NOW)).toBe('há mais de 13 anos');
    expect(formatAge(ago(3650 * D), NOW)).toBe('há mais de 10 anos');
  });
  it('sem data, data inválida ou no futuro não quebram', () => {
    expect(formatAge(undefined, NOW)).toBe(''); expect(formatAge('lixo', NOW)).toBe('');
    expect(formatAge(new Date(NOW + 5 * 60000).toISOString(), NOW)).toBe('há 0 min');
  });
  it('o card compartilhado mostra o formato novo (e continua com título, descrição e rótulo)', () => {
    const old = new Date(Date.now() - 4811 * D).toISOString();
    const h = renderToString(React.createElement(FlowMatchCard, { item: { id: '1', title: 'Sumiu minha gatinha', description: 'Gata preta', created_at: old }, label: 'Pode ser o dono' })).replace(/<!-- -->/g, '');
    expect(h).toContain('há mais de 13 anos'); expect(h).not.toMatch(/há \d{4} dias/);
    expect(h).toContain('Sumiu minha gatinha'); expect(h).toContain('Pode ser o dono');
  });
});

describe('os dois fluxos usam a opção nova; os outros 6 e o endpoint padrão não mudam', () => {
  const found = read('src/app/flow/found/client.tsx'), lost = read('src/app/flow/lost/client.tsx');
  it('found e lost enviam strict=1 e leem needs_details; eventos novos só com o fluxo', () => {
    for (const [nome, src] of [['found', found], ['lost', lost]] as const) {
      expect(src).toContain("params.set('strict', '1')");
      expect(src).toContain('data.needs_details === true');
      expect(src).toContain(`analytics.flowMatchNeedsDetailsShown('${nome}', recentes.length)`);
      expect(src).toContain(`analytics.flowMatchNoneShown('${nome}')`);
    }
    const ph = read('src/providers/PostHogProvider.tsx');
    expect(ph).toContain("posthog.capture('flow_match_needs_details_shown', { flow, recent_count: recentCount })");
    expect(ph).toContain("posthog.capture('flow_match_none_shown', { flow })");
  });
  it('seção «Registros recentes parecidos» nos dois fluxos: título neutro, rótulo «Ver registro», nunca «Pode ser o dono»; evento com a quantidade', () => {
    for (const src of [found, lost]) {
      expect(src).toContain('Registros recentes parecidos');
      expect(src).toContain('data-recent-similar');
      expect(src).toContain('label="Ver registro"');
      const secao = src.slice(src.indexOf('data-recent-similar'), src.indexOf('data-recent-similar') + 700);
      expect(secao).not.toMatch(/Pode ser o dono|É parecido com o meu/);
      expect(src).toContain('data.recent_similar.slice(0, 3)');
    }
    expect(read('src/providers/PostHogProvider.tsx')).toContain("posthog.capture('flow_match_needs_details_shown', { flow, recent_count: recentCount })");
  });
  it('aviso exato, dica, botão de editar, e a tela «nada encontrado» continua existindo, com texto diferente', () => {
    for (const src of [found, lost]) {
      expect(src).toContain('Sua busca precisa de mais detalhes para uma resposta melhor.');
      expect(src).toContain('Tente incluir o tipo do objeto, a marca, onde e quando.');
      expect(src).toContain('Editar minha busca');
      expect(src).toContain('data-needs-details');
    }
    expect(found).toContain('Nenhum alerta correspondente ainda.');
    expect(lost).toContain('Nenhum resultado ainda.');
  });
  it('textos novos sem promessa de contato protegido, SMS, chat protegido nem «gratuito»', () => {
    for (const t of ['Sua busca precisa de mais detalhes para uma resposta melhor.', 'Tente incluir o tipo do objeto, a marca, onde e quando.', 'Editar minha busca'])
      expect(t).not.toMatch(/gratuit|gr[aá]tis|protegid|exposto|SMS|chat/i);
  });
  it('pet, celular, chaves, carteira, veículo e bike NÃO usam strict (continuam como hoje)', () => {
    for (const f of ['pet', 'phone', 'keys', 'wallet', 'vehicle', 'bike', 'stolen']) expect(read(`src/app/flow/${f}/client.tsx`), f).not.toContain('strict');
  });
  it('o endpoint só muda com strict=1: caminho padrão intacto', () => {
    const r = semComentarios(read('src/app/api/v1/objects/public/route.ts'));
    expect(r).toContain("searchParams.get('strict') === '1'");
    expect(r).toMatch(/if \(strict && isBuscaAmpla\(keyword\)\)/);
    expect(r).toContain('SCORE_MIN_BUSCA'); expect(r).toContain('.slice(0, requestedSize)');
    expect(r).toContain('Math.min(requestedSize * 10, 500)'); // corte de candidatos igual
  });
  it('o resto do projeto (home, /buscar, /achei, painel, sitemap) não envia strict', () => {
    const dirs = ['src/app/page.tsx', 'src/components/HomeLiveMap.tsx', 'src/app/buscar/client.tsx', 'src/app/achei/client.tsx', 'src/app/dashboard/search/page.tsx', 'src/app/sitemap.ts', 'src/lib/api.ts'];
    for (const f of dirs) expect(read(f), f).not.toMatch(/strict['"=]/);
  });
  it('nenhum fluxo novo, nenhuma rota nova', () => {
    expect(readdirSync(path.join(root, 'src/app/flow')).sort()).toEqual(['bike', 'found', 'keys', 'lost', 'pet', 'phone', 'protect', 'stolen', 'vehicle', 'wallet']);
  });
});

describe.skipIf(!TEST_DB)('rota /api/v1/objects/public com banco real', () => {
  let pool: Pool;
  let GET: (r: NextRequest) => Promise<Response>;
  const call = async (qs: string) => { const r = await GET(new NextRequest(`http://localhost/api/v1/objects/public?${qs}`)); return r.json() as Promise<{ items: { title: string; unique_code: string; created_at: string }[]; needs_details?: boolean; total?: number }>; };
  const titles = (d: { items: { title: string }[] }) => d.items.map((i) => i.title);
  const flowFound = (kw: string) => call(`status=lost&keyword=${encodeURIComponent(kw)}&size=5`);
  const flowFoundStrict = (kw: string) => call(`status=lost&keyword=${encodeURIComponent(kw)}&size=5&strict=1`);
  const flowLostStrict = (kw: string) => call(`status=found&keyword=${encodeURIComponent(kw)}&size=5&strict=1`);

  beforeAll(async () => {
    pool = new Pool({ connectionString: TEST_DB });
    await pool.query(read('tests/fixtures/feed-schema.sql'));
    await pool.query(read('tests/fixtures/flow-match-seed.sql'));
    GET = (await import('@/app/api/v1/objects/public/route')).GET as never;
  });
  afterAll(async () => { await pool?.end(); });

  it('SEM strict (padrão): «Pochete de couro preta» continua devolvendo os 5 animais pretos como hoje, e a resposta não ganha campos novos', async () => {
    const d = await flowFound('Pochete de couro preta');
    expect(d.items.length).toBe(5);
    expect(titles(d).some((t) => /RECUPERADO/.test(t))).toBe(true);
    expect(Object.keys(d).sort()).toEqual(['items', 'keywords_expanded', 'next_cursor', 'page', 'score_threshold', 'size', 'total']);
    expect(d.needs_details).toBeUndefined();
  });
  it('/flow/found · «Pochete de couro preta»: busca ampla, aviso, nenhum item', async () => {
    const d = await flowFoundStrict('Pochete de couro preta');
    expect(d.needs_details).toBe(true); expect(d.items).toEqual([]);
  });
  it('/flow/found · «Chaves de carro»: continuam os sinais de chaves (46 a 83 dias), mesma ordem do padrão', async () => {
    const e = await flowFoundStrict('Chaves de carro'), p = await flowFound('Chaves de carro');
    expect(e.needs_details).toBeUndefined();
    expect(e.items.length).toBe(5);
    expect(e.items.every((i) => /chave de carro/i.test(i.title))).toBe(true);
    expect(titles(e)).toEqual(titles(p));
    const dias = e.items.map((i) => Math.floor((Date.now() - new Date(i.created_at).getTime()) / 86400000));
    expect(Math.min(...dias)).toBeGreaterThanOrEqual(46); expect(Math.max(...dias)).toBeLessThanOrEqual(83);
  });
  it('/flow/found · «Celular Samsung preto»: só itens de celular; «recuperado» fora; nenhum animal', async () => {
    const e = await flowFoundStrict('Celular Samsung preto');
    expect(e.needs_details).toBeUndefined();
    expect(e.items.length).toBeGreaterThan(0);
    for (const t of titles(e)) expect(t, t).toMatch(/celular|iphone/i);
    expect(titles(e).join('|')).not.toMatch(/gat|cadela|cachorr|vira-lat/i);
    expect(titles(e).some((t) => /RECUPERADO/.test(t))).toBe(false);
    // o item «recuperação em andamento» (usuário) NÃO é escondido por engano
    const todos = await call(`status=lost&keyword=${encodeURIComponent('Celular Samsung preto')}&size=20&strict=1`);
    expect(titles(todos)).toContain('Celular Samsung Galaxy - recuperação em andamento');
    expect(titles(todos)).not.toContain('Celular Samsung RECUPERADO');
    // sem strict, o mesmo item recuperado continua existindo na resposta padrão
    expect(titles(await call(`status=lost&keyword=${encodeURIComponent('Celular Samsung preto')}&size=20`))).toContain('Celular Samsung RECUPERADO');
  });
  it('/flow/lost · «Pochete de couro preta»: aviso de detalhes (sem erro) e nenhum item', async () => {
    const d = await flowLostStrict('Pochete de couro preta');
    expect(d.needs_details).toBe(true); expect(d.items).toEqual([]);
  });
  it('/flow/lost · «Celular Samsung preto»: sinais de celular achados; legado nunca entra em «achado» (regra que já existia)', async () => {
    const d = await flowLostStrict('Celular Samsung preto');
    expect(d.items.length).toBeGreaterThan(0);
    for (const t of titles(d)) expect(t).toMatch(/celular/i);
  });
  it('busca específica sem nada relevante: lista vazia SEM aviso de detalhes (é a tela «nada encontrado»)', async () => {
    const d = await flowFoundStrict('Violão Giannini azul');
    expect(d.items).toEqual([]); expect(d.needs_details).toBeUndefined();
  });
  it('cor sozinha não conta: «Gatinha siamesa preta» mostra a gatinha, não a cadela/cachorra só porque são pretas', async () => {
    const d = await flowFoundStrict('Gatinha siamesa preta');
    expect(titles(d)).toEqual(['Sumiu minha gatinha preta']);
    expect((await flowFound('Gatinha siamesa preta')).items.length).toBeGreaterThan(1); // padrão (sem strict) continua trazendo as outras
  });
  it('o legado «recuperado» some SÓ neste passo: continua na busca padrão, no mapa e nas contagens (nada foi apagado)', async () => {
    const strict = await call(`status=lost&keyword=${encodeURIComponent('Cachorrinha Pinscher Camila')}&size=20&strict=1`);
    expect(titles(strict).some((t) => /RECUPERADO/.test(t))).toBe(false);
    const padrao = await call(`status=lost&keyword=${encodeURIComponent('Cachorrinha Pinscher Camila')}&size=20`);
    expect(titles(padrao).some((t) => /RECUPERADO/.test(t))).toBe(true);
    const todos = await call('status=all&size=200');
    expect(titles(todos).some((t) => /RECUPERADO/.test(t))).toBe(true);
    const { rows } = await pool.query("select count(*)::int n from objects where title ~* 'RECUPERADO'");
    expect(rows[0].n).toBe(3); // nenhuma linha foi apagada nem alterada
  });
  it('/flow/found · «Celular azul»: busca ampla + até 3 registros recentes de usuário/sinal, mais novos primeiro; nunca legado, nunca > 90 dias', async () => {
    const d = await flowFoundStrict('Celular azul') as unknown as { items: unknown[]; needs_details: boolean; recent_similar: { title: string; unique_code: string; created_at: string; status: string }[] };
    expect(d.needs_details).toBe(true); expect(d.items).toEqual([]);
    expect(d.recent_similar.length).toBe(3);
    expect(d.recent_similar.map((i) => i.title)).toEqual(['Celular azul', 'Celular Samsung Galaxy - recuperação em andamento', 'Perda de celular Motorola no bairro Centro']);
    expect(d.recent_similar.every((i) => i.status === 'lost')).toBe(true);
    for (const i of d.recent_similar) {
      expect(i.unique_code).toMatch(/^(USR|SIG)/);                       // nada de LEG (legado)
      expect(Date.now() - new Date(i.created_at).getTime()).toBeLessThanOrEqual(90 * 86400000);
    }
    const todos = d.recent_similar.map((i) => i.title).join('|');
    expect(todos).not.toMatch(/legado|do João|RECUPERADO pela/);       // legado recente, registro de 120 dias e «recuperado» ficam de fora
  });
  it('/flow/found · «Pochete de couro preta»: aviso e NENHUM registro recente (não há pochete; bolsa preta recente não entra)', async () => {
    const d = await flowFoundStrict('Pochete de couro preta') as unknown as { items: unknown[]; needs_details: boolean; recent_similar: unknown[] };
    expect(d.needs_details).toBe(true); expect(d.items).toEqual([]); expect(d.recent_similar).toEqual([]);
  });
  it('/flow/lost · «Celular azul»: usa o status do fluxo (achados) e só sinais recentes', async () => {
    const d = await flowLostStrict('Celular azul') as unknown as { needs_details: boolean; recent_similar: { title: string; status: string; unique_code: string }[] };
    expect(d.needs_details).toBe(true);
    expect(d.recent_similar.map((i) => i.title)).toEqual(['Achado celular da marca Samsung', 'Achado celular da marca Motorola no bairro Pacaembu']);
    expect(d.recent_similar.every((i) => i.status === 'found' && /^(USR|SIG)/.test(i.unique_code))).toBe(true);
  });
  it('busca específica NÃO traz recent_similar (só o estado de busca ampla)', async () => {
    for (const kw of ['Chaves de carro', 'Celular Samsung preto', 'Violão Giannini azul']) {
      const d = await flowFoundStrict(kw) as unknown as { recent_similar?: unknown };
      expect(d.recent_similar, kw).toBeUndefined();
    }
  });
  it('sem strict a resposta é a de sempre, mesmo para busca ampla (sem needs_details nem recent_similar)', async () => {
    const d = await flowFound('Celular azul') as unknown as Record<string, unknown>;
    expect(d.recent_similar).toBeUndefined(); expect(d.needs_details).toBeUndefined();
    expect(Object.keys(d).sort()).toEqual(['items', 'keywords_expanded', 'next_cursor', 'page', 'score_threshold', 'size', 'total']);
  });
  it('estrito nunca ACRESCENTA itens: é sempre um subconjunto da lista padrão com a mesma ordem relativa', async () => {
    for (const kw of ['Chaves de carro', 'Celular Samsung preto', 'Gatinha siamesa preta', 'Cachorro Pinscher', 'Notebook Dell']) {
      const base = titles(await call(`status=lost&keyword=${encodeURIComponent(kw)}&size=50`));
      const est = titles(await call(`status=lost&keyword=${encodeURIComponent(kw)}&size=50&strict=1`));
      const pos = est.map((t) => base.indexOf(t));
      expect(pos.every((p) => p >= 0), kw).toBe(true);
      expect([...pos].sort((a, b) => a - b), kw).toEqual(pos);
    }
  });
});
