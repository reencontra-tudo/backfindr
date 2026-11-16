// Marca de vida das 3 rotinas agendadas (helper e rotas). Banco SIMULADO: o que importa aqui é QUANDO e O QUE a marca grava e que a resposta da rota não muda.
// Só dados FICTÍCIOS.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { readFileSync } from 'fs';

const db = vi.hoisted(() => ({
  marcas: [] as { sql: string; params: unknown[] }[],
  modo: 'normal' as 'normal' | 'tabela_ausente' | 'trava',
}));
vi.mock('@/lib/db', () => ({
  query: vi.fn(async (sql: string, params: unknown[] = []) => {
    if (/INSERT INTO rotina_execucoes/.test(sql)) {
      if (db.modo === 'tabela_ausente') throw Object.assign(new Error('relation "rotina_execucoes" does not exist'), { code: '42P01' });
      if (db.modo === 'trava') return new Promise(() => {});
      db.marcas.push({ sql, params });
      return { rows: [] };
    }
    return { rows: [] };
  }),
}));
vi.mock('@/lib/events', () => ({ Events: { matchingStarted: async () => {}, matchingCompleted: async () => {}, matchFound: async () => {}, ownerNotified: async () => {} }, recordEvent: async () => {} }));
vi.mock('@/lib/pushNotification', () => ({ sendPushToUser: vi.fn(async () => {}), matchPayload: () => ({}) }));
vi.mock('@/lib/email', () => ({ sendMatchAlertEmail: vi.fn(async () => ({})) }));
vi.mock('@/lib/publicSignals/sources', () => ({ SOURCES: [] }));
vi.mock('@/lib/publicSignals/extract', () => ({ extractSignal: vi.fn(async () => null) }));

import { comMarca, resumoSeguro, resultadoDaResposta } from '@/lib/rotinaMarca';

const CRON_FALSO = 'segredo-cron-falso-de-teste';
const SIGNALS_FALSO = 'segredo-sinais-falso-de-teste';
const req = (headers: Record<string, string> = {}, method = 'GET') => new NextRequest('http://localhost/x', { method, headers });
const bearer = (s: string) => ({ authorization: `Bearer ${s}` });
const marca = (i = 0) => ({ rotina: db.marcas[i].params[0], resultado: db.marcas[i].params[2], resumo: JSON.parse(db.marcas[i].params[3] as string) });

describe('funções puras', () => {
  it('resumo guarda só contagens: números, verdadeiro/falso, tamanho de listas e números de stats; nunca texto', () => {
    const r = resumoSeguro({ ok: true, ativo: false, objects_processed: 3, errors: ['segredo-no-erro', 'outro'], message: 'texto livre com Maria Souza', stats: { inserted: 4, nome: 'x' }, aninhado: { a: 1 } });
    expect(r).toEqual({ ok: true, ativo: false, objects_processed: 3, errors_n: 2, stats_inserted: 4 });
    expect(JSON.stringify(r)).not.toMatch(/segredo|Maria|texto/);
    expect(resumoSeguro(null)).toEqual({});
    expect(resumoSeguro([1, 2])).toEqual({});
    expect(resumoSeguro('texto')).toEqual({});
  });
  it('resultado: 400+ é erro; ativo:false é desligada; o resto é ok', () => {
    expect(resultadoDaResposta(200, { ok: true })).toBe('ok');
    expect(resultadoDaResposta(200, { ok: true, ativo: false })).toBe('desligada');
    expect(resultadoDaResposta(500, { ok: false })).toBe('erro');
    expect(resultadoDaResposta(401, null)).toBe('erro');
    expect(resultadoDaResposta(200, null)).toBe('ok');
  });
  it('comMarca devolve a MESMA resposta (corpo e status) e grava ok / erro', async () => {
    db.marcas.length = 0;
    const ok = await comMarca('x', async () => new Response(JSON.stringify({ a: 1, texto: 'segredo' }), { status: 200 }));
    expect(ok.status).toBe(200);
    expect(await ok.json()).toEqual({ a: 1, texto: 'segredo' });
    const ruim = await comMarca('x', async () => new Response('{"error":"x"}', { status: 500 }));
    expect(ruim.status).toBe(500);
    expect(db.marcas.map((_, i) => marca(i).resultado)).toEqual(['ok', 'erro']);
    expect(marca(0).resumo).toEqual({ a: 1 });
  });
  it('comMarca: se a rotina lançar, grava erro e relança o MESMO erro', async () => {
    db.marcas.length = 0;
    const falha = new Error('estourou');
    await expect(comMarca('x', async () => { throw falha; })).rejects.toBe(falha);
    expect(marca(0).resultado).toBe('erro');
    expect(marca(0).resumo).toEqual({});
  });
  it('comMarca: corpo que não é JSON não derruba nada', async () => {
    db.marcas.length = 0;
    const r = await comMarca('x', async () => new Response('texto puro', { status: 200 }));
    expect(await r.text()).toBe('texto puro');
    expect(marca(0).resultado).toBe('ok');
  });
});

describe('as 3 rotinas: marca só DEPOIS do segredo; resposta idêntica à de hoje', () => {
  let MATCHING: (r: NextRequest) => Promise<Response>;
  let LEMBRETES: (r: NextRequest) => Promise<Response>;
  let INGESTAO: (r: NextRequest) => Promise<Response>;

  beforeEach(async () => {
    db.marcas.length = 0; db.modo = 'normal';
    process.env.CRON_SECRET = CRON_FALSO; process.env.SIGNALS_CRON_SECRET = SIGNALS_FALSO;
    delete process.env.MATCHING_ATIVO;
    ({ GET: MATCHING } = await import('@/app/api/v1/cron/matching/route'));
    ({ GET: LEMBRETES } = await import('@/app/api/v1/cron/found-pending-reminders/route'));
    ({ POST: INGESTAO } = await import('@/app/api/v1/admin/public-signals/ingest/route'));
  });
  afterEach(() => { delete process.env.CRON_SECRET; delete process.env.SIGNALS_CRON_SECRET; delete process.env.MATCHING_ATIVO; });

  it('segredo errado ou ausente: continua 401 (e 503 na ingestão sem segredo configurado) e NÃO grava marca', async () => {
    for (const rota of [MATCHING, LEMBRETES]) {
      const a = await rota(req(bearer('errado'))); expect(a.status).toBe(401);
      const b = await rota(req()); expect(b.status).toBe(401);
    }
    const c = await INGESTAO(req({ 'x-signals-cron-secret': 'errado' }, 'POST')); expect(c.status).toBe(401);
    expect(await c.json()).toEqual({ detail: 'Não autorizado' });
    const d = await INGESTAO(req({}, 'POST')); expect(d.status).toBe(401);
    delete process.env.SIGNALS_CRON_SECRET;
    const e = await INGESTAO(req({ 'x-signals-cron-secret': 'qualquer' }, 'POST')); expect(e.status).toBe(503);
    delete process.env.CRON_SECRET;
    expect((await MATCHING(req(bearer('qualquer')))).status).toBe(401); // sem CRON_SECRET configurado: fail-closed como hoje
    expect(db.marcas.length).toBe(0);
  });

  it('matching com a chave desligada: mesma resposta de hoje e marca «desligada» (conta como viva)', async () => {
    const r = await MATCHING(req(bearer(CRON_FALSO)));
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ ok: true, ativo: false, message: 'Matching automático desligado (MATCHING_ATIVO). Nada foi processado.', objects_processed: 0, matches_created: 0 });
    expect(db.marcas.length).toBe(1);
    expect(marca()).toMatchObject({ rotina: 'matching', resultado: 'desligada' });
    expect(marca().resumo).toMatchObject({ ok: true, ativo: false, objects_processed: 0 });
  });

  it('matching ligado: mesma resposta de hoje e marca «ok» com contagens', async () => {
    process.env.MATCHING_ATIVO = '1';
    const r = await MATCHING(req(bearer(CRON_FALSO)));
    const corpo = await r.json();
    expect(r.status).toBe(200);
    expect(Object.keys(corpo).sort()).toEqual(['duration_ms', 'matches_created', 'next_run_in_minutes', 'objects_processed', 'ok']);
    expect(marca()).toMatchObject({ rotina: 'matching', resultado: 'ok' });
    expect(marca().resumo).toMatchObject({ objects_processed: 0, matches_created: 0, next_run_in_minutes: 15 });
  });

  it('lembretes de «encontrei»: mesma resposta de hoje e marca «ok»', async () => {
    const r = await LEMBRETES(req(bearer(CRON_FALSO)));
    expect(r.status).toBe(200);
    expect(await r.json()).toMatchObject({ reminders_d1: 0, reminders_d3: 0, reminders_d7: 0, auto_dismissed_d14: 0, errors: [] });
    expect(marca()).toMatchObject({ rotina: 'found-pending-reminders', resultado: 'ok' });
    expect(marca().resumo).toMatchObject({ reminders_d1: 0, errors_n: 0 });
  });

  it('ingestão de sinais: mesma resposta de hoje e marca «ok» com as contagens de stats', async () => {
    const r = await INGESTAO(req({ 'x-signals-cron-secret': SIGNALS_FALSO }, 'POST'));
    expect(r.status).toBe(200);
    const corpo = await r.json();
    expect(corpo.ok).toBe(true);
    expect(corpo.stats).toMatchObject({ sources: 0, itemsSeen: 0, inserted: 0, errors: 0 });
    expect(marca()).toMatchObject({ rotina: 'ingestao-sinais', resultado: 'ok' });
    expect(marca().resumo).toMatchObject({ ok: true, stats_inserted: 0, stats_errors: 0 });
  });

  it('migration não aplicada (tabela ausente): as 3 rotinas respondem IDÊNTICO e sem lançar', async () => {
    process.env.MATCHING_ATIVO = '1';
    const antes = [
      (await (await MATCHING(req(bearer(CRON_FALSO)))).json()),
      (await (await LEMBRETES(req(bearer(CRON_FALSO)))).json()),
      (await (await INGESTAO(req({ 'x-signals-cron-secret': SIGNALS_FALSO }, 'POST'))).json()),
    ];
    db.modo = 'tabela_ausente';
    const status = [
      await MATCHING(req(bearer(CRON_FALSO))), await LEMBRETES(req(bearer(CRON_FALSO))), await INGESTAO(req({ 'x-signals-cron-secret': SIGNALS_FALSO }, 'POST')),
    ];
    expect(status.map((s) => s.status)).toEqual([200, 200, 200]);
    const depois = [await status[0].json(), await status[1].json(), await status[2].json()];
    expect(Object.keys(depois[0]).sort()).toEqual(Object.keys(antes[0]).sort());
    expect(depois[1]).toEqual(antes[1]);
    expect(depois[2].stats).toEqual(antes[2].stats);
  });

  it('banco travado na gravação: a rotina não espera mais que cerca de 1,5 s', async () => {
    db.modo = 'trava';
    const t0 = Date.now();
    const r = await LEMBRETES(req(bearer(CRON_FALSO)));
    expect(r.status).toBe(200);
    expect(Date.now() - t0).toBeLessThan(3000);
  }, 10000);
});

describe('regressão estática', () => {
  const ler = (p: string) => readFileSync(p, 'utf8');
  it('em cada rota a marca é chamada DEPOIS da conferência do segredo', () => {
    const m = ler('src/app/api/v1/cron/matching/route.ts');
    expect(m.indexOf("return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });")).toBeLessThan(m.indexOf("comMarca('matching'"));
    const f = ler('src/app/api/v1/cron/found-pending-reminders/route.ts');
    expect(f.indexOf("status: 401")).toBeLessThan(f.indexOf("comMarca('found-pending-reminders'"));
    const i = ler('src/app/api/v1/admin/public-signals/ingest/route.ts');
    expect(i.indexOf("{ status: 401 }")).toBeLessThan(i.indexOf("comMarca('ingestao-sinais'"));
  });
  it('só as 3 rotinas agendadas gravam marca; as demais não foram tocadas', () => {
    const { execSync } = require('child_process');
    const achados = execSync(`grep -rl "import { comMarca }" src --include=*.ts || true`, { encoding: 'utf8' }).trim().split('\n').sort();
    expect(achados).toEqual([
      'src/app/api/v1/admin/public-signals/ingest/route.ts', 'src/app/api/v1/cron/found-pending-reminders/route.ts', 'src/app/api/v1/cron/matching/route.ts',
    ].sort());
  });
  it('a lista de rotinas esperadas é uma constante única e só tem as 3 agendadas', async () => {
    const { ROTINAS_ESPERADAS } = await import('@/lib/rotinasEsperadas');
    expect(ROTINAS_ESPERADAS.map((r) => [r.id, r.limiteMinutos])).toEqual([['matching', 45], ['found-pending-reminders', 2160], ['ingestao-sinais', 2160]]);
  });
});
