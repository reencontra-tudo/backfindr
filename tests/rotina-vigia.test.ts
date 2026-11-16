// Vigia das rotinas agendadas. Parte pura + Postgres REAL (pula sem TEST_DATABASE_URL) com e-mail e push SIMULADOS. Só dados FICTÍCIOS.
import { afterAll, beforeAll, beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { Pool } from 'pg';
import { randomUUID } from 'crypto';
import { NextRequest } from 'next/server';
import { readFileSync } from 'fs';
import { avaliar, destinosDeEmail, textoDoAviso, type MarcaResumo } from '@/lib/vigiaRotinas';
import { ROTINAS_ESPERADAS } from '@/lib/rotinasEsperadas';

const TEST_DB = process.env.TEST_DATABASE_URL;
if (TEST_DB) process.env.DATABASE_URL = TEST_DB;

const enviados = vi.hoisted(() => ({ pushes: [] as unknown[][], emails: [] as { to: string; subject: string; html: string; category: string }[] }));
vi.mock('@/lib/pushNotification', () => ({ sendPushToUser: vi.fn(async (...a: unknown[]) => { enviados.pushes.push(a); }), matchPayload: () => ({}) }));
vi.mock('@/lib/emailSend', () => ({ deliverEmail: vi.fn(async (o: { to: string; subject: string; html: string; category: string }) => { enviados.emails.push(o); return { ok: true, id: 'x' }; }) }));

const SEGREDO_VIGIA = 'segredo-vigia-falso-de-teste';
const MIN = 60_000; const H = 60 * MIN;
const AGORA = new Date('2026-11-20T12:00:00Z');
const atras = (ms: number) => new Date(AGORA.getTime() - ms);

describe('decisão pura (avaliar)', () => {
  const marcas = (o: Record<string, MarcaResumo>) => new Map(Object.entries(o));
  const semAlertas = new Map<string, { ultimaFalha: null; ultimoQualquer: null }>();
  const av = (m: Record<string, MarcaResumo>, antiga: Date | null, alertas: Parameters<typeof avaliar>[2] = semAlertas as never) => avaliar(AGORA, marcas(m), alertas, antiga);
  const viva = (ms: number, resultado: MarcaResumo['resultado'] = 'ok'): MarcaResumo => ({ iniciou_em: atras(ms), resultado });
  const todasVivas = { matching: viva(5 * MIN), 'found-pending-reminders': viva(3 * H), 'ingestao-sinais': viva(5 * H) };

  it('tudo vivo: nada a avisar', () => {
    const r = av(todasVivas, atras(10 * H));
    expect(r.map((x) => x.estado)).toEqual(['ok', 'ok', 'ok']);
    expect(r.map((x) => x.aviso)).toEqual([null, null, null]);
  });
  it('limites: matching 45 min, diárias 36 h (no limite ainda vale; passou, avisa)', () => {
    expect(av({ ...todasVivas, matching: viva(45 * MIN) }, atras(H))[0].estado).toBe('ok');
    const r = av({ ...todasVivas, matching: viva(46 * MIN) }, atras(H));
    expect(r[0].estado).toBe('atrasada'); expect(r[0].aviso).toBe('falha');
    expect(av({ ...todasVivas, 'ingestao-sinais': viva(36 * H) }, atras(40 * H))[2].estado).toBe('ok');
    expect(av({ ...todasVivas, 'ingestao-sinais': viva(36 * H + MIN) }, atras(40 * H))[2].estado).toBe('atrasada');
  });
  it('marca «desligada» conta como viva; marca «erro» alerta mesmo recente', () => {
    expect(av({ ...todasVivas, matching: viva(5 * MIN, 'desligada') }, atras(H))[0]).toMatchObject({ estado: 'desligada', aviso: null });
    expect(av({ ...todasVivas, matching: viva(5 * MIN, 'erro') }, atras(H))[0]).toMatchObject({ estado: 'erro', aviso: 'falha' });
  });
  it('rotina que nunca teve marca: só avisa 48 h depois da marca mais antiga da tabela', () => {
    const { 'found-pending-reminders': _x, ...semLembretes } = todasVivas;
    expect(av(semLembretes, atras(47 * H))[1]).toMatchObject({ estado: 'sem_marca_ainda', aviso: null });
    expect(av(semLembretes, atras(48 * H))[1]).toMatchObject({ estado: 'nunca_registrou', aviso: 'falha' });
  });
  it('limite de 6 h entre avisos de falha da mesma rotina', () => {
    const al = (h: number) => new Map([['matching', { ultimaFalha: { tipo: 'falha' as const, criado_em: atras(h * H) }, ultimoQualquer: { tipo: 'falha' as const, criado_em: atras(h * H) } }]]);
    const parada = { ...todasVivas, matching: viva(3 * H) };
    expect(av(parada, atras(10 * H), al(5.9))[0].aviso).toBeNull();
    expect(av(parada, atras(10 * H), al(6))[0].aviso).toBe('falha');
  });
  it('normalização: um único aviso, só se o último aviso da rotina foi de falha', () => {
    const falhou = new Map([['matching', { ultimaFalha: { tipo: 'falha' as const, criado_em: atras(3 * H) }, ultimoQualquer: { tipo: 'falha' as const, criado_em: atras(3 * H) } }]]);
    expect(av(todasVivas, atras(10 * H), falhou)[0].aviso).toBe('normalizada');
    const jaAvisou = new Map([['matching', { ultimaFalha: { tipo: 'falha' as const, criado_em: atras(3 * H) }, ultimoQualquer: { tipo: 'normalizada' as const, criado_em: atras(H) } }]]);
    expect(av(todasVivas, atras(10 * H), jaAvisou)[0].aviso).toBeNull();
  });
  it('texto curto, em português, com a rotina, o tempo e o que olhar; sem segredo', () => {
    const a = av({ ...todasVivas, matching: viva(2 * H + 10 * MIN) }, atras(H))[0];
    const t = textoDoAviso(a);
    expect(t.titulo).toMatch(/Matching automático/);
    expect(t.mensagem).toMatch(/2 h 10 min/);
    expect(t.mensagem).toMatch(/n8n/);
    expect(t.mensagem).toMatch(/CRON_SECRET/);
    expect(t.mensagem.length).toBeLessThan(400);
    expect(t.mensagem).not.toMatch(/Bearer|sk-|token/i);
  });
  it('e-mails: variável opcional VIGIA_EMAILS ou os administradores; nada fixo no código', () => {
    expect(destinosDeEmail([{ email: 'a@teste.invalid' }, { email: 'b@teste.invalid' }, { email: null }], undefined)).toEqual(['a@teste.invalid', 'b@teste.invalid']);
    expect(destinosDeEmail([{ email: 'a@teste.invalid' }], ' x@teste.invalid , y@teste.invalid ')).toEqual(['x@teste.invalid', 'y@teste.invalid']);
    expect(readFileSync('src/lib/vigiaRotinas.ts', 'utf8')).not.toMatch(/@backfindr\.com/);
  });
});

describe.skipIf(!TEST_DB)('vigia com banco real e a migration 026', () => {
  let pool: Pool;
  let VIGIA: (r: NextRequest) => Promise<Response>;
  let rodarVigia: (agora?: Date) => Promise<{ status: string; motivo?: string; rotinas: { rotina: string; estado: string; aviso_enviado: string | null }[] }>;
  let adminId: string;

  const req = (auth?: string) => new NextRequest('http://localhost/api/v1/cron/vigia-rotinas', { headers: auth ? { authorization: auth } : {} });
  const marca = (rotina: string, minAtras: number, resultado: 'ok' | 'erro' | 'desligada' = 'ok') =>
    pool.query(`INSERT INTO rotina_execucoes (rotina, iniciou_em, resultado, resumo) VALUES ($1, NOW() - ($2 || ' minutes')::interval, $3, '{}')`, [rotina, String(minAtras), resultado]);
  const viva = async (rotina: string, minAtras = 5) => marca(rotina, minAtras);
  const alertas = async (rotina?: string) => (await pool.query(`SELECT rotina, tipo FROM rotina_alertas ${rotina ? `WHERE rotina = '${rotina}'` : ''} ORDER BY criado_em`)).rows;
  const sino = async () => (await pool.query(`SELECT user_id, title, type FROM notifications`)).rows;

  beforeAll(async () => {
    pool = new Pool({ connectionString: TEST_DB });
    await pool.query('DROP TABLE IF EXISTS rotina_alertas, rotina_execucoes, notifications, users CASCADE');
    await pool.query(`CREATE TABLE users (id uuid PRIMARY KEY, name text, email text, role text, is_system_account boolean NOT NULL DEFAULT false, b2b_partner_id uuid, is_legacy boolean DEFAULT false)`);
    await pool.query(`CREATE TABLE notifications (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid, title text, message text, type text, url text, read boolean DEFAULT false, created_at timestamp DEFAULT now())`);
    // As tabelas das marcas vêm EXATAMENTE do arquivo da migration (prova que o SQL roda em Postgres comum, sem as funções do Supabase).
    await pool.query(readFileSync('src/db/migrations/026_rotina_execucoes.sql', 'utf8'));
    ({ GET: VIGIA } = await import('@/app/api/v1/cron/vigia-rotinas/route'));
    ({ rodarVigia } = (await import('@/lib/vigiaRotinas')) as unknown as { rodarVigia: typeof rodarVigia });
  });
  beforeEach(async () => {
    enviados.pushes.length = 0; enviados.emails.length = 0;
    process.env.VIGIA_SECRET = SEGREDO_VIGIA; delete process.env.VIGIA_EMAILS;
    await pool.query('TRUNCATE rotina_alertas, rotina_execucoes, notifications, users CASCADE');
    adminId = randomUUID();
    await pool.query(`INSERT INTO users (id, name, email, role) VALUES ($1,'Admin Teste','admin1@teste.invalid','admin')`, [adminId]);
    await pool.query(`INSERT INTO users (id, name, email, role, is_system_account) VALUES ($1,'Sistema','sistema@teste.invalid','admin',true)`, [randomUUID()]);
    await pool.query(`INSERT INTO users (id, name, email, role, is_legacy) VALUES ($1,'Legado','legado@teste.invalid','admin',true)`, [randomUUID()]);
    await pool.query(`INSERT INTO users (id, name, email, role) VALUES ($1,'Comum','comum@teste.invalid','user')`, [randomUUID()]);
  });
  afterEach(() => { delete process.env.VIGIA_SECRET; delete process.env.VIGIA_EMAILS; });
  afterAll(async () => { await pool?.end(); });

  it('migration: RLS ligada nas duas tabelas e nenhuma política', async () => {
    const rls = (await pool.query(`SELECT relname, relrowsecurity FROM pg_class WHERE relname IN ('rotina_execucoes','rotina_alertas') ORDER BY relname`)).rows;
    expect(rls).toEqual([{ relname: 'rotina_alertas', relrowsecurity: true }, { relname: 'rotina_execucoes', relrowsecurity: true }]);
    expect(Number((await pool.query(`SELECT COUNT(*) FROM pg_policies WHERE tablename IN ('rotina_execucoes','rotina_alertas')`)).rows[0].count)).toBe(0);
  });
  it('migration: roda duas vezes sem erro (idempotente) e o resultado só aceita ok, erro ou desligada', async () => {
    await pool.query(readFileSync('src/db/migrations/026_rotina_execucoes.sql', 'utf8'));
    await expect(pool.query(`INSERT INTO rotina_execucoes (rotina, iniciou_em, resultado) VALUES ('x', NOW(), 'qualquer')`)).rejects.toThrow();
    await expect(pool.query(`INSERT INTO rotina_alertas (rotina, tipo) VALUES ('x', 'outro')`)).rejects.toThrow();
  });

  it('segredo: sem VIGIA_SECRET ou com segredo errado ou ausente, 401', async () => {
    expect((await VIGIA(req(`Bearer ${SEGREDO_VIGIA}`))).status).toBe(200);
    expect((await VIGIA(req())).status).toBe(401);
    expect((await VIGIA(req('Bearer errado'))).status).toBe(401);
    expect((await VIGIA(req(SEGREDO_VIGIA))).status).toBe(401);
    delete process.env.VIGIA_SECRET;
    expect((await VIGIA(req(`Bearer ${SEGREDO_VIGIA}`))).status).toBe(401);
    expect((await VIGIA(req('Bearer '))).status).toBe(401);
  });

  it('sem nenhuma marca: «sem dados» e não avisa ninguém', async () => {
    const r = await (await VIGIA(req(`Bearer ${SEGREDO_VIGIA}`))).json();
    expect(r).toMatchObject({ ok: true, status: 'sem_dados' });
    expect(enviados.pushes.length + enviados.emails.length).toBe(0);
    expect(await alertas()).toEqual([]);
    expect(await sino()).toEqual([]);
  });

  it('tabelas ainda não existem (migration não aplicada): 200, «sem dados», sem avisar', async () => {
    await pool.query('ALTER TABLE rotina_execucoes RENAME TO rotina_execucoes_x');
    try {
      const r = await VIGIA(req(`Bearer ${SEGREDO_VIGIA}`));
      expect(r.status).toBe(200);
      expect(await r.json()).toMatchObject({ ok: true, status: 'sem_dados' });
    } finally { await pool.query('ALTER TABLE rotina_execucoes_x RENAME TO rotina_execucoes'); }
  });

  it('tudo vivo: ok, sem aviso (marca «desligada» do matching conta como viva)', async () => {
    await marca('matching', 5, 'desligada'); await viva('found-pending-reminders', 120); await viva('ingestao-sinais', 600);
    const r = await (await VIGIA(req(`Bearer ${SEGREDO_VIGIA}`))).json();
    expect(r.status).toBe('ok');
    expect(r.rotinas.map((x: { estado: string }) => x.estado)).toEqual(['desligada', 'ok', 'ok']);
    expect(enviados.pushes.length + enviados.emails.length + (await alertas()).length).toBe(0);
  });

  it('marca velha: avisa UMA vez (sino, push e e-mail) e respeita as 6 horas', async () => {
    await marca('matching', 130); await viva('found-pending-reminders', 120); await viva('ingestao-sinais', 600);
    const r1 = await (await VIGIA(req(`Bearer ${SEGREDO_VIGIA}`))).json();
    expect(r1.status).toBe('com_alerta');
    expect(r1.rotinas[0]).toMatchObject({ rotina: 'matching', estado: 'atrasada', aviso_enviado: 'falha' });
    expect(await alertas('matching')).toEqual([{ rotina: 'matching', tipo: 'falha' }]);
    // só o administrador comum recebe: sistema, legado e usuário comum ficam de fora
    expect(enviados.pushes.map((p) => p[0])).toEqual([adminId]);
    expect(enviados.emails.map((e) => e.to)).toEqual(['admin1@teste.invalid']);
    expect(enviados.emails[0].category).toBe('service');
    expect(enviados.emails[0].subject).toMatch(/Matching automático/);
    expect((await sino()).map((n) => n.type)).toEqual(['rotina_vigia']);
    // segunda chamada logo depois: nada novo
    enviados.pushes.length = 0; enviados.emails.length = 0;
    const r2 = await (await VIGIA(req(`Bearer ${SEGREDO_VIGIA}`))).json();
    expect(r2.rotinas[0].aviso_enviado).toBeNull();
    expect(enviados.pushes.length + enviados.emails.length).toBe(0);
    expect((await alertas('matching')).length).toBe(1);
    // passadas 6 horas, avisa de novo
    await pool.query(`UPDATE rotina_alertas SET criado_em = NOW() - interval '6 hours 1 minute'`);
    await (await VIGIA(req(`Bearer ${SEGREDO_VIGIA}`))).json();
    expect((await alertas('matching')).length).toBe(2);
  });

  it('normalização: avisa uma única vez quando a rotina volta', async () => {
    await marca('matching', 130); await viva('found-pending-reminders', 120); await viva('ingestao-sinais', 600);
    await VIGIA(req(`Bearer ${SEGREDO_VIGIA}`));
    enviados.pushes.length = 0; enviados.emails.length = 0;
    await viva('matching', 1);                                      // voltou
    const r = await (await VIGIA(req(`Bearer ${SEGREDO_VIGIA}`))).json();
    expect(r.rotinas[0]).toMatchObject({ estado: 'ok', aviso_enviado: 'normalizada' });
    expect((await alertas('matching')).map((a) => a.tipo)).toEqual(['falha', 'normalizada']);
    expect(enviados.emails.map((e) => e.subject)).toEqual([expect.stringMatching(/normalizada/i)]);
    enviados.pushes.length = 0; enviados.emails.length = 0;
    const r2 = await (await VIGIA(req(`Bearer ${SEGREDO_VIGIA}`))).json();
    expect(r2.rotinas[0].aviso_enviado).toBeNull();                 // não repete
    expect(enviados.pushes.length + enviados.emails.length).toBe(0);
  });

  it('marca «erro» alerta como falha, mesmo recente', async () => {
    await marca('ingestao-sinais', 5, 'erro'); await viva('matching', 5); await viva('found-pending-reminders', 120);
    const r = await (await VIGIA(req(`Bearer ${SEGREDO_VIGIA}`))).json();
    expect(r.rotinas[2]).toMatchObject({ rotina: 'ingestao-sinais', estado: 'erro', aviso_enviado: 'falha' });
    expect(enviados.emails[0].html).toMatch(/terminou com erro/);
  });

  it('rotina que nunca teve marca: só avisa 48 h depois da marca mais antiga da tabela', async () => {
    await viva('matching', 5); await marca('ingestao-sinais', 47 * 60);
    const r1 = await (await VIGIA(req(`Bearer ${SEGREDO_VIGIA}`))).json();
    expect(r1.rotinas[1]).toMatchObject({ rotina: 'found-pending-reminders', estado: 'sem_marca_ainda', aviso_enviado: null });
    await pool.query(`UPDATE rotina_execucoes SET iniciou_em = NOW() - interval '49 hours' WHERE rotina = 'ingestao-sinais'`);
    await viva('ingestao-sinais', 600);
    const r2 = await (await VIGIA(req(`Bearer ${SEGREDO_VIGIA}`))).json();
    expect(r2.rotinas[1]).toMatchObject({ estado: 'nunca_registrou', aviso_enviado: 'falha' });
  });

  it('VIGIA_EMAILS opcional escolhe os destinatários do e-mail (o sino e o push seguem para os administradores)', async () => {
    process.env.VIGIA_EMAILS = 'um@teste.invalid, dois@teste.invalid';
    await marca('matching', 130); await viva('found-pending-reminders', 120); await viva('ingestao-sinais', 600);
    await VIGIA(req(`Bearer ${SEGREDO_VIGIA}`));
    expect(enviados.emails.map((e) => e.to).sort()).toEqual(['dois@teste.invalid', 'um@teste.invalid']);
    expect(enviados.pushes.length).toBe(1);
  });

  it('o vigia só lê as marcas: não grava marca de si mesmo e não altera as existentes', async () => {
    await viva('matching', 5); await viva('found-pending-reminders', 120); await viva('ingestao-sinais', 600);
    const antes = (await pool.query('SELECT COUNT(*)::int n FROM rotina_execucoes')).rows[0].n;
    await VIGIA(req(`Bearer ${SEGREDO_VIGIA}`));
    expect((await pool.query('SELECT COUNT(*)::int n FROM rotina_execucoes')).rows[0].n).toBe(antes);
  });

  it('falha de um canal de aviso não derruba o vigia nem impede o registro do aviso', async () => {
    const { sendPushToUser } = await import('@/lib/pushNotification');
    (sendPushToUser as unknown as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('push fora'));
    await marca('matching', 130); await viva('found-pending-reminders', 120); await viva('ingestao-sinais', 600);
    const r = await VIGIA(req(`Bearer ${SEGREDO_VIGIA}`));
    expect(r.status).toBe(200);
    expect((await alertas('matching')).length).toBe(1);
    expect(enviados.emails.length).toBe(1);
  });
});

describe('regressão estática', () => {
  const ler = (p: string) => readFileSync(p, 'utf8');
  it('workflow do GitHub: 30 minutos, disparo manual, permissões mínimas, segredo lido do repositório, falha se não for 200', () => {
    const y = ler('.github/workflows/vigia-rotinas.yml');
    expect(y).toMatch(/cron: '\*\/30 \* \* \* \*'/);
    expect(y).toMatch(/workflow_dispatch:/);
    expect(y).toMatch(/permissions:\s*\n\s*contents: read/);
    expect(y).toMatch(/\$\{\{ secrets\.VIGIA_SECRET \}\}/);
    expect(y).toMatch(/https:\/\/backfindr\.com\/api\/v1\/cron\/vigia-rotinas/);
    expect(y).toMatch(/!= "200"/);
    expect(y).not.toMatch(/Bearer [A-Za-z0-9]{12,}/);
  });
  it('a rota do vigia usa o segredo próprio e responde 401 sem ele', () => {
    const r = ler('src/app/api/v1/cron/vigia-rotinas/route.ts');
    expect(r).toMatch(/process\.env\.VIGIA_SECRET/);
    expect(r).toMatch(/!segredo \|\|/);
    expect(r).not.toMatch(/process\.env\.(CRON_SECRET|SIGNALS_CRON_SECRET)/);
  });
  it('o vigia não apaga nada e as tabelas não têm DELETE nem UPDATE no código', () => {
    const { execSync } = require('child_process');
    const achados = execSync(`grep -rnE "(DELETE FROM|UPDATE) (rotina_execucoes|rotina_alertas)|TRUNCATE rotina" src --include=*.ts || true`, { encoding: 'utf8' }).trim();
    expect(achados).toBe('');
  });
});
