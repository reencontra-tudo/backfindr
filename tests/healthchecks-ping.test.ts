// Aviso ao Healthchecks ao fim das 3 rotinas agendadas. Banco e rede SIMULADOS; só dados FICTÍCIOS (as «URLs de ping» abaixo são falsas).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { readFileSync } from 'fs';

vi.mock('@/lib/db', () => ({ query: vi.fn(async () => ({ rows: [] })) }));
vi.mock('@/lib/events', () => ({ Events: { matchingStarted: async () => {}, matchingCompleted: async () => {}, matchFound: async () => {}, ownerNotified: async () => {} }, recordEvent: async () => {} }));
vi.mock('@/lib/pushNotification', () => ({ sendPushToUser: vi.fn(async () => {}), matchPayload: () => ({}) }));
vi.mock('@/lib/email', () => ({ sendMatchAlertEmail: vi.fn(async () => ({})) }));
vi.mock('@/lib/publicSignals/sources', () => ({ SOURCES: [] }));
vi.mock('@/lib/publicSignals/extract', () => ({ extractSignal: vi.fn(async () => null) }));

import { comPing, VARIAVEIS_DE_PING } from '@/lib/healthchecksPing';

const CRON_FALSO = 'segredo-cron-falso-de-teste';
const SIGNALS_FALSO = 'segredo-sinais-falso-de-teste';
const URL_MATCHING = 'https://hc.exemplo.invalid/ping/aaaa-matching-falso';
const URL_LEMBRETES = 'https://hc.exemplo.invalid/ping/bbbb-lembretes-falso';
const URL_INGESTAO = 'https://hc.exemplo.invalid/ping/cccc-ingestao-falso';

const req = (headers: Record<string, string> = {}, method = 'GET') => new NextRequest('http://localhost/x', { method, headers });
const bearer = (s: string) => ({ authorization: `Bearer ${s}` });

let chamadas: { url: string; init: RequestInit | undefined }[] = [];
let fetchMock: ReturnType<typeof vi.fn>;
const urlsChamadas = () => chamadas.map((c) => c.url);

function ligarFetch(impl?: (url: string) => Promise<Response>) {
  fetchMock = vi.fn(async (url: unknown, init?: RequestInit) => {
    chamadas.push({ url: String(url), init });
    return impl ? impl(String(url)) : new Response('OK', { status: 200 });
  });
  vi.stubGlobal('fetch', fetchMock);
}

beforeEach(() => {
  chamadas = [];
  process.env.HC_PING_MATCHING = URL_MATCHING; process.env.HC_PING_FOUND_PENDING = URL_LEMBRETES; process.env.HC_PING_INGESTAO = URL_INGESTAO;
  process.env.CRON_SECRET = CRON_FALSO; process.env.SIGNALS_CRON_SECRET = SIGNALS_FALSO;
  delete process.env.MATCHING_ATIVO;
  ligarFetch();
});
afterEach(() => {
  vi.unstubAllGlobals(); vi.restoreAllMocks();
  for (const k of ['HC_PING_MATCHING', 'HC_PING_FOUND_PENDING', 'HC_PING_INGESTAO', 'CRON_SECRET', 'SIGNALS_CRON_SECRET', 'MATCHING_ATIVO']) delete process.env[k];
});

describe('helper comPing', () => {
  it('sucesso (status abaixo de 400): um GET na URL de ping, sem corpo, e a resposta volta igual', async () => {
    const r = await comPing(VARIAVEIS_DE_PING.matching, async () => new Response(JSON.stringify({ a: 1 }), { status: 200 }));
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ a: 1 });
    expect(urlsChamadas()).toEqual([URL_MATCHING]);
    expect(chamadas[0].init?.method).toBe('GET');
    expect(chamadas[0].init?.body).toBeUndefined();
  });
  it('status 3xx ainda é sucesso; 400 ou mais é /fail', async () => {
    await comPing(VARIAVEIS_DE_PING.matching, async () => new Response(null, { status: 302 }));
    await comPing(VARIAVEIS_DE_PING.matching, async () => new Response('x', { status: 400 }));
    await comPing(VARIAVEIS_DE_PING.matching, async () => new Response('x', { status: 500 }));
    expect(urlsChamadas()).toEqual([URL_MATCHING, `${URL_MATCHING}/fail`, `${URL_MATCHING}/fail`]);
  });
  it('exceção: ping /fail e relança o MESMO erro', async () => {
    const erro = new Error('estourou');
    await expect(comPing(VARIAVEIS_DE_PING.foundPending, async () => { throw erro; })).rejects.toBe(erro);
    expect(urlsChamadas()).toEqual([`${URL_LEMBRETES}/fail`]);
  });
  it('barra no fim da URL não duplica: …/fail', async () => {
    process.env.HC_PING_MATCHING = `${URL_MATCHING}///`;
    await comPing(VARIAVEIS_DE_PING.matching, async () => new Response('x', { status: 500 }));
    expect(urlsChamadas()).toEqual([`${URL_MATCHING}/fail`]);
  });
  it('sem a variável (ou vazia): não faz nada e a resposta volta igual', async () => {
    delete process.env.HC_PING_MATCHING;
    const r = await comPing(VARIAVEIS_DE_PING.matching, async () => new Response('ok', { status: 200 }));
    expect(await r.text()).toBe('ok');
    process.env.HC_PING_MATCHING = '   ';
    await comPing(VARIAVEIS_DE_PING.matching, async () => new Response('ok', { status: 200 }));
    expect(chamadas.length).toBe(0);
  });
  it('ping com falha de rede: a resposta e a exceção não mudam', async () => {
    ligarFetch(async () => { throw new Error('rede caiu (https://hc.exemplo.invalid/ping/aaaa-matching-falso)'); });
    const r = await comPing(VARIAVEIS_DE_PING.matching, async () => new Response('ok', { status: 200 }));
    expect(r.status).toBe(200); expect(await r.text()).toBe('ok');
    const erro = new Error('da rotina');
    await expect(comPing(VARIAVEIS_DE_PING.matching, async () => { throw erro; })).rejects.toBe(erro);
  });
  it('ping que responde 500 ou 404 também não muda nada', async () => {
    ligarFetch(async () => new Response('erro', { status: 500 }));
    const r = await comPing(VARIAVEIS_DE_PING.matching, async () => new Response('ok', { status: 201 }));
    expect(r.status).toBe(201);
  });
  it('ping que nunca responde: a rotina espera no máximo cerca de 1,5 s', async () => {
    ligarFetch(() => new Promise<Response>(() => {}));
    const t0 = Date.now();
    const r = await comPing(VARIAVEIS_DE_PING.matching, async () => new Response('ok', { status: 200 }));
    expect(r.status).toBe(200);
    expect(Date.now() - t0).toBeLessThan(2500);
    expect(Date.now() - t0).toBeGreaterThanOrEqual(1400);
  }, 10000);
  it('a URL de ping nunca vai para o log (nem em falha de rede)', async () => {
    const logs: string[] = [];
    for (const m of ['log', 'warn', 'error', 'info', 'debug'] as const) vi.spyOn(console, m).mockImplementation((...a: unknown[]) => { logs.push(a.map(String).join(' ')); });
    ligarFetch(async () => { throw new Error(`falhou em ${URL_MATCHING}`); });
    await comPing(VARIAVEIS_DE_PING.matching, async () => new Response('ok', { status: 200 }));
    await comPing(VARIAVEIS_DE_PING.matching, async () => new Response('x', { status: 500 }));
    expect(logs.join('\n')).not.toContain('hc.exemplo.invalid');
    expect(logs.join('\n')).not.toContain('aaaa-matching-falso');
  });
});

describe('as 3 rotas: ping só DEPOIS do segredo, resposta idêntica à de hoje', () => {
  let MATCHING: (r: NextRequest) => Promise<Response>;
  let LEMBRETES: (r: NextRequest) => Promise<Response>;
  let INGESTAO: (r: NextRequest) => Promise<Response>;
  beforeEach(async () => {
    ({ GET: MATCHING } = await import('@/app/api/v1/cron/matching/route'));
    ({ GET: LEMBRETES } = await import('@/app/api/v1/cron/found-pending-reminders/route'));
    ({ POST: INGESTAO } = await import('@/app/api/v1/admin/public-signals/ingest/route'));
  });

  it('segredo errado ou ausente: continua 401 (503 na ingestão sem segredo configurado) e NÃO pinga, nem sucesso nem /fail', async () => {
    for (const rota of [MATCHING, LEMBRETES]) {
      expect((await rota(req(bearer('errado')))).status).toBe(401);
      expect((await rota(req())).status).toBe(401);
    }
    const c = await INGESTAO(req({ 'x-signals-cron-secret': 'errado' }, 'POST'));
    expect(c.status).toBe(401); expect(await c.json()).toEqual({ detail: 'Não autorizado' });
    expect((await INGESTAO(req({}, 'POST'))).status).toBe(401);
    delete process.env.SIGNALS_CRON_SECRET;
    expect((await INGESTAO(req({ 'x-signals-cron-secret': 'qualquer' }, 'POST'))).status).toBe(503);
    delete process.env.CRON_SECRET;
    expect((await MATCHING(req(bearer('qualquer')))).status).toBe(401);
    expect(chamadas.length).toBe(0);
  });

  it('matching com a chave desligada: mesma resposta de hoje e ping de SUCESSO (conta como vivo)', async () => {
    const r = await MATCHING(req(bearer(CRON_FALSO)));
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ ok: true, ativo: false, message: 'Matching automático desligado (MATCHING_ATIVO). Nada foi processado.', objects_processed: 0, matches_created: 0 });
    expect(urlsChamadas()).toEqual([URL_MATCHING]);
  });
  it('matching ligado: mesma resposta de hoje e ping de sucesso', async () => {
    process.env.MATCHING_ATIVO = '1';
    const r = await MATCHING(req(bearer(CRON_FALSO)));
    const corpo = await r.json();
    expect(r.status).toBe(200);
    expect(Object.keys(corpo).sort()).toEqual(['duration_ms', 'matches_created', 'next_run_in_minutes', 'objects_processed', 'ok']);
    expect(urlsChamadas()).toEqual([URL_MATCHING]);
  });
  it('lembretes de «encontrei»: mesma resposta de hoje e ping de sucesso', async () => {
    const r = await LEMBRETES(req(bearer(CRON_FALSO)));
    expect(r.status).toBe(200);
    expect(await r.json()).toMatchObject({ reminders_d1: 0, reminders_d3: 0, reminders_d7: 0, auto_dismissed_d14: 0, errors: [] });
    expect(urlsChamadas()).toEqual([URL_LEMBRETES]);
  });
  it('ingestão de sinais: mesma resposta de hoje e ping de sucesso', async () => {
    const r = await INGESTAO(req({ 'x-signals-cron-secret': SIGNALS_FALSO }, 'POST'));
    expect(r.status).toBe(200);
    const corpo = await r.json();
    expect(corpo.ok).toBe(true);
    expect(corpo.stats).toMatchObject({ sources: 0, itemsSeen: 0, inserted: 0, errors: 0 });
    expect(urlsChamadas()).toEqual([URL_INGESTAO]);
  });

  it('rota que termina com erro (500) manda /fail e devolve o mesmo 500', async () => {
    const { query } = await import('@/lib/db');
    (query as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('banco caiu'));
    process.env.MATCHING_ATIVO = '1';
    const r = await MATCHING(req(bearer(CRON_FALSO)));
    expect(r.status).toBe(500);
    expect(await r.json()).toMatchObject({ ok: false });
    expect(urlsChamadas()).toEqual([`${URL_MATCHING}/fail`]);
    (query as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ rows: [] });
  });

  it('sem as variáveis: as 3 rotinas respondem IGUAL e nenhum ping sai', async () => {
    process.env.MATCHING_ATIVO = '1';
    const comVar = [await (await MATCHING(req(bearer(CRON_FALSO)))).json(), await (await LEMBRETES(req(bearer(CRON_FALSO)))).json(), (await (await INGESTAO(req({ 'x-signals-cron-secret': SIGNALS_FALSO }, 'POST'))).json()).stats];
    chamadas = [];
    for (const k of ['HC_PING_MATCHING', 'HC_PING_FOUND_PENDING', 'HC_PING_INGESTAO']) delete process.env[k];
    const semVar = [await (await MATCHING(req(bearer(CRON_FALSO)))).json(), await (await LEMBRETES(req(bearer(CRON_FALSO)))).json(), (await (await INGESTAO(req({ 'x-signals-cron-secret': SIGNALS_FALSO }, 'POST'))).json()).stats];
    expect(Object.keys(semVar[0]).sort()).toEqual(Object.keys(comVar[0]).sort());
    expect(semVar[1]).toEqual(comVar[1]);
    expect(semVar[2]).toEqual(comVar[2]);
    expect(chamadas.length).toBe(0);
  });

  it('ping lento ou quebrado não muda a resposta das 3 rotas', async () => {
    ligarFetch(async () => { throw new Error('rede'); });
    expect((await MATCHING(req(bearer(CRON_FALSO)))).status).toBe(200);
    expect((await LEMBRETES(req(bearer(CRON_FALSO)))).status).toBe(200);
    expect((await INGESTAO(req({ 'x-signals-cron-secret': SIGNALS_FALSO }, 'POST'))).status).toBe(200);
  });
});

describe('regressão estática', () => {
  const ler = (p: string) => readFileSync(p, 'utf8');
  it('em cada rota o ping vem DEPOIS da conferência do segredo', () => {
    const m = ler('src/app/api/v1/cron/matching/route.ts');
    expect(m.indexOf("return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });")).toBeLessThan(m.indexOf('comPing(VARIAVEIS_DE_PING.matching'));
    const f = ler('src/app/api/v1/cron/found-pending-reminders/route.ts');
    expect(f.indexOf('status: 401')).toBeLessThan(f.indexOf('comPing(VARIAVEIS_DE_PING.foundPending'));
    const i = ler('src/app/api/v1/admin/public-signals/ingest/route.ts');
    expect(i.indexOf('{ status: 401 }')).toBeLessThan(i.indexOf('comPing(VARIAVEIS_DE_PING.ingestao'));
  });
  it('só as 3 rotinas agendadas usam o ping; as demais não foram tocadas', () => {
    const { execSync } = require('child_process');
    const achados = execSync(`grep -rl "import { comPing" src --include=*.ts || true`, { encoding: 'utf8' }).trim().split('\n').sort();
    expect(achados).toEqual(['src/app/api/v1/admin/public-signals/ingest/route.ts', 'src/app/api/v1/cron/found-pending-reminders/route.ts', 'src/app/api/v1/cron/matching/route.ts']);
  });
  it('nenhuma tabela, rota de vigia, workflow, segredo novo nem e-mail foram criados', () => {
    const { existsSync } = require('fs');
    expect(existsSync('src/app/api/v1/cron/vigia-rotinas')).toBe(false);
    expect(existsSync('.github/workflows/vigia-rotinas.yml')).toBe(false);
    expect(existsSync('src/db/migrations/026_rotina_execucoes.sql')).toBe(false);
    const { execSync } = require('child_process');
    expect(execSync(`grep -rl "VIGIA_SECRET\\|rotina_execucoes" src .github .env.example || true`, { encoding: 'utf8' }).trim()).toBe('');
  });
  it('o helper não registra a URL, não envia corpo e só usa as 3 variáveis', () => {
    const h = ler('src/lib/healthchecksPing.ts');
    expect(h).not.toMatch(/console\./);
    expect(h).not.toMatch(/body:/);
    expect(h).toMatch(/HC_PING_MATCHING/); expect(h).toMatch(/HC_PING_FOUND_PENDING/); expect(h).toMatch(/HC_PING_INGESTAO/);
  });
});
