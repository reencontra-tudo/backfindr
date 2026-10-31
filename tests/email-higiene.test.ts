// Testes de integração da higiene de e-mail: regra canSendEmail, envio central, descadastro, webhook do Resend,
// resultados no admin e cron de lifecycle. Usam um Postgres REAL. Sem TEST_DATABASE_URL a suíte é pulada.
// O cliente do Resend é SEMPRE um mock: nenhum e-mail real é enviado.
//
//   TEST_DATABASE_URL=postgres://postgres:postgres@127.0.0.1:54333/backfindr_test \
//     npx vitest@2 run --config tests/vitest.config.ts tests/email-higiene.test.ts
//
// ATENÇÃO: o schema de teste é recriado (DROP/CREATE das tabelas usadas). Use banco descartável.
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { Pool } from 'pg';
import crypto, { randomUUID } from 'crypto';
import fs from 'fs';
import path from 'path';
import { NextRequest } from 'next/server';

const TEST_DB = process.env.TEST_DATABASE_URL;
if (TEST_DB) process.env.DATABASE_URL = TEST_DB;

const { sendMock } = vi.hoisted(() => ({ sendMock: vi.fn() }));

// Resend real só para verificar assinatura (webhooks.verify); o envio é o mock.
vi.mock('resend', async (importOriginal) => {
  const mod = await importOriginal<typeof import('resend')>();
  class FakeResend extends mod.Resend {
    constructor(key?: string) {
      super(key || 're_test_key');
      Object.defineProperty(this, 'emails', { value: { send: sendMock } });
    }
  }
  return { ...mod, Resend: FakeResend };
});
vi.mock('@/lib/pushNotification', () => ({ sendPushToUser: () => Promise.resolve() }));
vi.mock('@/lib/adminGuard', () => ({ requireAdmin: () => Promise.resolve({ user: { id: 'admin' } }) }));

const HASH_SECRET = 'segredo-de-teste-hash';
const WEBHOOK_KEY = Buffer.from('chave-de-teste-do-webhook-1234567890').toString('base64');
const WEBHOOK_SECRET = `whsec_${WEBHOOK_KEY}`;

import { SYSTEM_ACCOUNT_ID } from '@/lib/systemAccount';
import {
  canSendEmail,
  createUnsubscribeToken,
  hashEmail,
  verifyUnsubscribeToken,
} from '@/lib/emailPolicy';
import { deliverEmail } from '@/lib/emailSend';

describe.skipIf(!TEST_DB)('higiene de e-mail', () => {
  let pool: Pool;

  const mkUser = async (o: { email?: string; legacy?: boolean; system?: boolean; optIn?: boolean } = {}) => {
    const id = o.system ? SYSTEM_ACCOUNT_ID : randomUUID();
    const email = o.email ?? `${id.slice(0, 8)}@teste.local`;
    await pool.query(
      `INSERT INTO users (id, email, name, is_legacy, is_system_account, is_active) VALUES ($1, $2, 'Fulano de Tal', $3, $4, true)`,
      [id, email, !!o.legacy, !!o.system],
    );
    if (o.optIn) {
      await pool.query(
        `INSERT INTO email_preferences (user_id, marketing_opt_in, opt_in_at, policy_version, source) VALUES ($1, true, NOW(), 'teste', 'teste')`,
        [id],
      );
    }
    return { id, email };
  };

  const suppress = (email: string, reason: 'unsubscribe' | 'bounce' | 'complaint' | 'manual', userId: string | null = null) =>
    pool.query(`INSERT INTO email_suppressions (email_hash, user_id, reason, source) VALUES ($1, $2, $3, 'teste')`, [hashEmail(email), userId, reason]);

  const count = async (table: string, where = 'TRUE', params: unknown[] = []) =>
    Number((await pool.query(`SELECT COUNT(*) FROM ${table} WHERE ${where}`, params)).rows[0].count);

  beforeAll(async () => {
    pool = new Pool({ connectionString: TEST_DB });
    await pool.query(`DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
    END $$`);
    await pool.query(`DROP TABLE IF EXISTS reactivation_emails, email_events, email_messages, email_preferences, email_suppressions,
      email_campaigns, user_lifecycle_events, objects, users CASCADE`);
    await pool.query(`CREATE TABLE users (
      id uuid PRIMARY KEY, email varchar NOT NULL, name varchar, is_legacy boolean DEFAULT false,
      is_system_account boolean DEFAULT false, is_active boolean DEFAULT true, last_login timestamp,
      created_at timestamp DEFAULT now())`);
    await pool.query(`CREATE TABLE objects (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title varchar, status varchar, is_legacy boolean DEFAULT false, created_at timestamp DEFAULT now())`);
    await pool.query(`CREATE TABLE user_lifecycle_events (
      id serial PRIMARY KEY, user_id uuid, object_id uuid, event_type varchar, created_at timestamp DEFAULT now())`);
    // Mesma DDL de admin/migrate-tables/route.ts.
    await pool.query(`CREATE TABLE email_campaigns (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(), type TEXT NOT NULL DEFAULT 'custom', subject TEXT NOT NULL,
      body_html TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'draft', sent_count INTEGER NOT NULL DEFAULT 0,
      failed_count INTEGER NOT NULL DEFAULT 0, filter_json JSONB, created_by UUID REFERENCES users(id) ON DELETE SET NULL,
      sent_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`);
    // As migrations reais do PR, aplicadas duas vezes para provar idempotência.
    const dir = path.resolve(__dirname, '../src/db/migrations');
    for (const f of ['020_email_suppressions_preferences.sql', '021_email_messages_events.sql', '022_reactivation_emails.sql']) {
      const sql = fs.readFileSync(path.join(dir, f), 'utf8');
      await pool.query(sql);
      await pool.query(sql);
    }
  });

  afterAll(async () => {
    await pool?.end();
  });

  beforeEach(async () => {
    process.env.EMAIL_HASH_SECRET = HASH_SECRET;
    process.env.RESEND_WEBHOOK_SECRET = WEBHOOK_SECRET;
    delete process.env.EMAIL_REPLY_TO;
    process.env.RESEND_API_KEY = 're_test_key';
    process.env.CRON_SECRET = 'cron-de-teste';
    sendMock.mockReset();
    sendMock.mockResolvedValue({ data: { id: `re_${randomUUID()}` }, error: null });
    await pool.query(`TRUNCATE email_events, email_messages, email_preferences, email_suppressions, email_campaigns,
      reactivation_emails, user_lifecycle_events, objects, users CASCADE`);
  });

  // ─── Migrations ─────────────────────────────────────────────────────────────
  describe('migrations 020 a 022', () => {
    it('ligam RLS, sem policies, e sem grants para anon/authenticated', async () => {
      for (const t of ['email_suppressions', 'email_preferences', 'email_messages', 'email_events', 'reactivation_emails']) {
        const rls = await pool.query(`SELECT relrowsecurity FROM pg_class WHERE relname = $1`, [t]);
        expect(rls.rows[0].relrowsecurity, t).toBe(true);
        expect(await count('pg_policies', 'tablename = $1', [t]), t).toBe(0);
        const g = await pool.query(`SELECT has_table_privilege('anon', $1, 'SELECT') a, has_table_privilege('authenticated', $1, 'SELECT') b`, [t]);
        expect(g.rows[0], t).toEqual({ a: false, b: false });
      }
    });

    it('email_suppressions aceita só os 4 motivos e hash único', async () => {
      await expect(pool.query(`INSERT INTO email_suppressions (email_hash, reason) VALUES ('h1', 'outro')`)).rejects.toThrow();
      await pool.query(`INSERT INTO email_suppressions (email_hash, reason) VALUES ('h1', 'manual')`);
      await expect(pool.query(`INSERT INTO email_suppressions (email_hash, reason) VALUES ('h1', 'bounce')`)).rejects.toThrow();
    });

    it('reactivation_emails aceita o upsert que o cron usa', async () => {
      const u = await mkUser();
      const o = (await pool.query(`INSERT INTO objects (user_id, title, status) VALUES ($1, 'x', 'lost') RETURNING id`, [u.id])).rows[0].id;
      const upsert = `INSERT INTO reactivation_emails (object_id, user_id, sent_at) VALUES ($1, $2, NOW())
                      ON CONFLICT (object_id) DO UPDATE SET sent_at = NOW()`;
      await pool.query(upsert, [o, u.id]);
      await pool.query(upsert, [o, u.id]);
      expect(await count('reactivation_emails')).toBe(1);
      const q = await pool.query(`SELECT 1 FROM reactivation_emails re WHERE re.object_id = $1 AND re.sent_at > NOW() - INTERVAL '24 hours'`, [o]);
      expect(q.rowCount).toBe(1);
    });
  });

  // ─── canSendEmail ─────────────────────────────────────────────────────────────
  describe('canSendEmail', () => {
    it('conta de sistema: recusada em todas as categorias', async () => {
      const s = await mkUser({ system: true, optIn: true });
      for (const c of ['security', 'service', 'marketing'] as const) {
        expect(await canSendEmail({ email: s.email }, c), c).toMatchObject({ allowed: false, reason: 'system_account' });
      }
    });

    it('legado: security passa; service e marketing (sem opt-in) são recusados', async () => {
      const u = await mkUser({ legacy: true });
      expect(await canSendEmail({ email: u.email }, 'security')).toMatchObject({ allowed: true });
      expect(await canSendEmail({ email: u.email }, 'service')).toMatchObject({ allowed: false, reason: 'legacy' });
      expect(await canSendEmail({ email: u.email }, 'marketing')).toMatchObject({ allowed: false, reason: 'no_marketing_opt_in' });
    });

    it('legado com opt-in registrado por ele mesmo: marketing passa, service continua recusado', async () => {
      const u = await mkUser({ legacy: true, optIn: true });
      expect(await canSendEmail({ email: u.email }, 'marketing')).toMatchObject({ allowed: true });
      expect(await canSendEmail({ email: u.email }, 'service')).toMatchObject({ allowed: false, reason: 'legacy' });
    });

    it('bounce: bloqueia security, service e marketing', async () => {
      const u = await mkUser({ optIn: true });
      await suppress(u.email, 'bounce', u.id);
      for (const c of ['security', 'service', 'marketing'] as const) {
        expect(await canSendEmail({ email: u.email }, c), c).toMatchObject({ allowed: false, reason: 'suppressed' });
      }
    });

    it('descadastro: bloqueia service e marketing, mas NÃO security', async () => {
      const u = await mkUser({ optIn: true });
      await suppress(u.email, 'unsubscribe', u.id);
      expect(await canSendEmail({ email: u.email }, 'security')).toMatchObject({ allowed: true });
      expect(await canSendEmail({ email: u.email }, 'service')).toMatchObject({ allowed: false, reason: 'suppressed' });
      expect(await canSendEmail({ email: u.email }, 'marketing')).toMatchObject({ allowed: false, reason: 'suppressed' });
    });

    it('endereço é comparado sem diferenciar maiúsculas e espaços', async () => {
      const u = await mkUser({ email: 'Pessoa@Teste.Local' });
      await suppress('pessoa@teste.local', 'complaint', u.id);
      expect(await canSendEmail({ email: '  PESSOA@teste.local ' }, 'service')).toMatchObject({ allowed: false, reason: 'suppressed' });
    });

    it('marketing: sem opt-in recusa; com opt-in passa', async () => {
      const a = await mkUser();
      const b = await mkUser({ optIn: true });
      expect(await canSendEmail({ email: a.email }, 'marketing')).toMatchObject({ allowed: false, reason: 'no_marketing_opt_in' });
      expect(await canSendEmail({ email: b.email }, 'marketing')).toMatchObject({ allowed: true });
      expect(await canSendEmail({ email: a.email }, 'service')).toMatchObject({ allowed: true });
    });

    it('opt-in com valor falso não conta', async () => {
      const u = await mkUser();
      await pool.query(`INSERT INTO email_preferences (user_id, marketing_opt_in) VALUES ($1, false)`, [u.id]);
      expect(await canSendEmail({ email: u.email }, 'marketing')).toMatchObject({ allowed: false, reason: 'no_marketing_opt_in' });
    });

    it('destinatário sem cadastro: security e service passam; marketing recusa', async () => {
      expect(await canSendEmail({ email: 'novo@teste.local' }, 'security')).toMatchObject({ allowed: true });
      expect(await canSendEmail({ email: 'novo@teste.local' }, 'service')).toMatchObject({ allowed: true });
      expect(await canSendEmail({ email: 'novo@teste.local' }, 'marketing')).toMatchObject({ allowed: false });
    });

    it('sem EMAIL_HASH_SECRET: security e service seguem; marketing é recusado', async () => {
      delete process.env.EMAIL_HASH_SECRET;
      const u = await mkUser({ optIn: true });
      expect(await canSendEmail({ email: u.email }, 'security')).toMatchObject({ allowed: true });
      expect(await canSendEmail({ email: u.email }, 'service')).toMatchObject({ allowed: true });
      expect(await canSendEmail({ email: u.email }, 'marketing')).toMatchObject({ allowed: false, reason: 'policy_unavailable' });
    });
  });

  // ─── Envio central ────────────────────────────────────────────────────────────
  describe('deliverEmail', () => {
    it('sucesso: devolve o id, grava email_messages só com hash e manda List-Unsubscribe em service', async () => {
      const u = await mkUser({ email: 'dona@teste.local' });
      sendMock.mockResolvedValueOnce({ data: { id: 're_abc' }, error: null });
      const r = await deliverEmail({ to: u.email, subject: 'Assunto', html: '<html><body><p>oi</p></body></html>', category: 'service', source: 'welcome' });
      expect(r).toEqual({ ok: true, id: 're_abc' });

      const args = sendMock.mock.calls[0][0];
      expect(args.headers['List-Unsubscribe']).toMatch(/^<https?:\/\/.+\/api\/v1\/email\/unsubscribe\?t=.+>$/);
      expect(args.headers['List-Unsubscribe-Post']).toBe('List-Unsubscribe=One-Click');
      expect(args.html).toContain('Cancelar inscrição');
      expect(args.replyTo).toBeUndefined();

      const row = (await pool.query(`SELECT * FROM email_messages WHERE resend_id = 're_abc'`)).rows[0];
      expect(row.user_id).toBe(u.id);
      expect(row.to_email_hash).toBe(hashEmail('dona@teste.local'));
      expect(JSON.stringify(row)).not.toContain('dona@teste.local');
      expect(row.category).toBe('service');
    });

    it('security não leva List-Unsubscribe nem rodapé de descadastro', async () => {
      const u = await mkUser({ legacy: true });
      const r = await deliverEmail({ to: u.email, subject: 'Senha', html: '<body>x</body>', category: 'security', source: 'password_reset' });
      expect(r.ok).toBe(true);
      const args = sendMock.mock.calls[0][0];
      expect(args.headers).toBeUndefined();
      expect(args.html).not.toContain('Cancelar inscrição');
    });

    it('Reply-To só sai se EMAIL_REPLY_TO existir', async () => {
      const u = await mkUser();
      process.env.EMAIL_REPLY_TO = 'respostas@exemplo.test';
      await deliverEmail({ to: u.email, subject: 'a', html: '<body/>', category: 'service', source: 'x' });
      expect(sendMock.mock.calls[0][0].replyTo).toBe('respostas@exemplo.test');
    });

    it('erro do Resend vira failed (nunca ok) e não grava email_messages', async () => {
      const u = await mkUser();
      sendMock.mockResolvedValueOnce({ data: null, error: { name: 'rate_limit_exceeded', message: 'Too many requests' } });
      const r = await deliverEmail({ to: u.email, subject: 'a', html: '<body/>', category: 'service', source: 'x' });
      expect(r).toMatchObject({ ok: false, status: 'failed' });
      expect(await count('email_messages')).toBe(0);
    });

    it('exceção do cliente vira failed', async () => {
      const u = await mkUser();
      sendMock.mockRejectedValueOnce(new Error('rede caiu'));
      const r = await deliverEmail({ to: u.email, subject: 'a', html: '<body/>', category: 'service', source: 'x' });
      expect(r).toMatchObject({ ok: false, status: 'failed', error: 'rede caiu' });
    });

    it('resposta sem id também é falha', async () => {
      const u = await mkUser();
      sendMock.mockResolvedValueOnce({ data: {}, error: null });
      const r = await deliverEmail({ to: u.email, subject: 'a', html: '<body/>', category: 'service', source: 'x' });
      expect(r).toMatchObject({ ok: false, status: 'failed' });
    });

    it('recusa por regra é skipped e o cliente nem é chamado', async () => {
      const legacy = await mkUser({ legacy: true });
      const r = await deliverEmail({ to: legacy.email, subject: 'a', html: '<body/>', category: 'service', source: 'x' });
      expect(r).toEqual({ ok: false, status: 'skipped', reason: 'legacy' });
      expect(sendMock).not.toHaveBeenCalled();
    });

    it('registra campaign_id e lifecycle_event', async () => {
      const u = await mkUser({ optIn: true });
      const camp = (await pool.query(`INSERT INTO email_campaigns (type, subject, body_html) VALUES ('custom', 's', '<b/>') RETURNING id`)).rows[0].id;
      sendMock.mockResolvedValueOnce({ data: { id: 're_camp' }, error: null });
      await deliverEmail({ to: u.email, subject: 'a', html: '<body/>', category: 'marketing', source: 'campaign', campaignId: camp, lifecycleEvent: 'guide_photos_tip' });
      const row = (await pool.query(`SELECT campaign_id, lifecycle_event FROM email_messages WHERE resend_id = 're_camp'`)).rows[0];
      expect(row).toEqual({ campaign_id: camp, lifecycle_event: 'guide_photos_tip' });
    });
  });

  // ─── Token e descadastro ──────────────────────────────────────────────────────
  describe('descadastro', () => {
    let GET: (r: NextRequest) => Promise<Response>;
    let POST: (r: NextRequest) => Promise<Response>;
    beforeAll(async () => {
      process.env.EMAIL_HASH_SECRET = HASH_SECRET;
      ({ GET, POST } = await import('@/app/api/v1/email/unsubscribe/route'));
    });

    const url = (t?: string) => `http://localhost/api/v1/email/unsubscribe${t === undefined ? '' : `?t=${encodeURIComponent(t)}`}`;

    it('token válido: grava supressão "unsubscribe", responde 200 e é idempotente', async () => {
      const u = await mkUser({ email: 'sai@teste.local', optIn: true });
      const token = createUnsubscribeToken(u.email, u.id)!;
      const r1 = await GET(new NextRequest(url(token)));
      expect(r1.status).toBe(200);
      expect(await r1.text()).toContain('Inscrição cancelada');
      const r2 = await GET(new NextRequest(url(token)));
      expect(r2.status).toBe(200);
      const rows = (await pool.query(`SELECT reason, user_id, email_hash FROM email_suppressions`)).rows;
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({ reason: 'unsubscribe', user_id: u.id, email_hash: hashEmail('sai@teste.local') });
      expect((await pool.query(`SELECT marketing_opt_in FROM email_preferences WHERE user_id = $1`, [u.id])).rows[0].marketing_opt_in).toBe(false);
      expect(await canSendEmail({ email: u.email }, 'service')).toMatchObject({ allowed: false });
    });

    it('POST one-click também grava', async () => {
      const u = await mkUser();
      const r = await POST(new NextRequest(url(createUnsubscribeToken(u.email, u.id)!), { method: 'POST', body: 'List-Unsubscribe=One-Click' }));
      expect(r.status).toBe(200);
      expect(await r.json()).toEqual({ ok: true });
      expect(await count('email_suppressions')).toBe(1);
    });

    it('token adulterado: 400 e nada gravado', async () => {
      const u = await mkUser();
      const token = createUnsubscribeToken(u.email, u.id)!;
      const [b64, sig] = token.split('.');
      const fake = Buffer.from(JSON.stringify({ h: hashEmail('outra@teste.local'), u: null, c: null, e: 9999999999 })).toString('base64url');
      for (const bad of [`${b64}.${sig.slice(0, -2)}xx`, `${fake}.${sig}`, 'lixo', `${b64}`, '']) {
        const r = await GET(new NextRequest(url(bad)));
        expect(r.status, bad).toBe(400);
        const p = await POST(new NextRequest(url(bad), { method: 'POST' }));
        expect(p.status, bad).toBe(400);
      }
      expect((await GET(new NextRequest(url()))).status).toBe(400);
      expect(await count('email_suppressions')).toBe(0);
    });

    it('token expirado: 400 "expired" e nada gravado', async () => {
      const u = await mkUser();
      const old = createUnsubscribeToken(u.email, u.id, null, Date.now() - 3 * 365 * 24 * 3600 * 1000)!;
      expect(verifyUnsubscribeToken(old)).toEqual({ ok: false, error: 'expired' });
      const r = await GET(new NextRequest(url(old)));
      expect(r.status).toBe(400);
      expect(await r.text()).toContain('expirou');
      const p = await POST(new NextRequest(url(old), { method: 'POST' }));
      expect(await p.json()).toEqual({ ok: false, error: 'expired' });
      expect(await count('email_suppressions')).toBe(0);
    });

    it('token de outro segredo é inválido', async () => {
      const u = await mkUser();
      const token = createUnsubscribeToken(u.email, u.id)!;
      process.env.EMAIL_HASH_SECRET = 'outro-segredo';
      expect(verifyUnsubscribeToken(token)).toEqual({ ok: false, error: 'invalid' });
      process.env.EMAIL_HASH_SECRET = HASH_SECRET;
    });

    it('token com campanha grava a origem da campanha', async () => {
      const u = await mkUser();
      const camp = randomUUID();
      await GET(new NextRequest(url(createUnsubscribeToken(u.email, u.id, camp)!)));
      expect((await pool.query(`SELECT source FROM email_suppressions`)).rows[0].source).toBe(`unsubscribe_campaign:${camp}`);
    });
  });

  // ─── Webhook do Resend ────────────────────────────────────────────────────────
  describe('webhook do Resend', () => {
    let POST: (r: NextRequest) => Promise<Response>;
    beforeAll(async () => {
      ({ POST } = await import('@/app/api/v1/webhooks/resend/route'));
    });

    const sign = (id: string, ts: string, payload: string, key = WEBHOOK_KEY) =>
      'v1,' + crypto.createHmac('sha256', Buffer.from(key, 'base64')).update(`${id}.${ts}.${payload}`).digest('base64');

    const send = (event: Record<string, unknown>, opts: { badSig?: boolean; noHeaders?: boolean } = {}) => {
      const payload = JSON.stringify(event);
      const id = `msg_${randomUUID()}`;
      const ts = String(Math.floor(Date.now() / 1000));
      const headers: Record<string, string> = opts.noHeaders
        ? {}
        : { 'svix-id': id, 'svix-timestamp': ts, 'svix-signature': opts.badSig ? sign(id, ts, payload, Buffer.from('outra-chave').toString('base64')) : sign(id, ts, payload) };
      return POST(new NextRequest('http://localhost/api/v1/webhooks/resend', { method: 'POST', headers, body: payload }));
    };

    const evt = (type: string, emailId: string, extra: Record<string, unknown> = {}, at = '2026-10-31T12:00:00.000Z', to = ['alguem@teste.local']) => ({
      type,
      created_at: at,
      data: { email_id: emailId, created_at: at, from: 'Backfindr <noreply@backfindr.com.br>', to, subject: 'Assunto secreto', ...extra },
    });

    const seedMessage = async (resendId: string, email: string, userId: string | null = null) => {
      await pool.query(
        `INSERT INTO email_messages (resend_id, user_id, to_email_hash, category, source, subject) VALUES ($1, $2, $3, 'service', 'teste', 's')`,
        [resendId, userId, hashEmail(email)],
      );
    };

    it('sem RESEND_WEBHOOK_SECRET: 401 e nada gravado (rota inerte)', async () => {
      delete process.env.RESEND_WEBHOOK_SECRET;
      const r = await send(evt('email.delivered', 're_1'));
      expect(r.status).toBe(401);
      expect(await count('email_events')).toBe(0);
    });

    it('assinatura inválida: 401 e nada gravado', async () => {
      const r = await send(evt('email.bounced', 're_1', { bounce: { type: 'Permanent', subType: 'General', message: 'x' } }), { badSig: true });
      expect(r.status).toBe(401);
      expect(await count('email_events')).toBe(0);
      expect(await count('email_suppressions')).toBe(0);
    });

    it('sem cabeçalhos svix: 401', async () => {
      expect((await send(evt('email.delivered', 're_1'), { noHeaders: true })).status).toBe(401);
      expect(await count('email_events')).toBe(0);
    });

    it('delivered grava 1 evento; reentrega do mesmo evento não duplica', async () => {
      await seedMessage('re_d', 'alguem@teste.local');
      const e = evt('email.delivered', 're_d');
      const r1 = await send(e);
      expect(r1.status).toBe(200);
      expect(await r1.json()).toMatchObject({ ok: true, duplicate: false });
      const r2 = await send(e);
      expect(await r2.json()).toMatchObject({ ok: true, duplicate: true });
      expect(await count('email_events', `resend_id = 're_d' AND type = 'delivered'`)).toBe(1);
    });

    it('trata delivery_delayed, opened e clicked; ignora tipos não tratados', async () => {
      await send(evt('email.delivery_delayed', 're_x', {}, '2026-10-31T12:01:00.000Z'));
      await send(evt('email.opened', 're_x', {}, '2026-10-31T12:02:00.000Z'));
      await send(evt('email.clicked', 're_x', { click: { link: 'https://x.test/?t=SEGREDO', ipAddress: '1.2.3.4', userAgent: 'u', timestamp: 't' } }, '2026-10-31T12:03:00.000Z'));
      const ig = await send(evt('email.sent', 're_x'));
      expect(await ig.json()).toMatchObject({ ignored: true });
      const types = (await pool.query(`SELECT type FROM email_events ORDER BY type`)).rows.map((r) => r.type);
      expect(types).toEqual(['clicked', 'delivery_delayed', 'opened']);
    });

    it('bounce permanente suprime o endereço (hash vindo de email_messages), uma vez só', async () => {
      const u = await mkUser({ email: 'quica@teste.local' });
      await seedMessage('re_b', 'quica@teste.local', u.id);
      const e = evt('email.bounced', 're_b', { bounce: { type: 'Permanent', subType: 'General', message: 'mailbox quica@teste.local not found' } }, '2026-10-31T12:00:00.000Z', ['quica@teste.local']);
      expect((await send(e)).status).toBe(200);
      expect((await send(e)).status).toBe(200);
      const rows = (await pool.query(`SELECT reason, source, user_id, email_hash FROM email_suppressions`)).rows;
      expect(rows).toEqual([{ reason: 'bounce', source: 'resend_webhook', user_id: u.id, email_hash: hashEmail('quica@teste.local') }]);
      expect(await canSendEmail({ email: u.email }, 'security')).toMatchObject({ allowed: false });
    });

    it('bounce permanente sem linha em email_messages usa o endereço do evento só para o hash', async () => {
      await send(evt('email.bounced', 're_sem_linha', { bounce: { type: 'Permanent', subType: 'General', message: 'm' } }, '2026-10-31T12:00:00.000Z', ['corrida@teste.local']));
      const rows = (await pool.query(`SELECT email_hash FROM email_suppressions`)).rows;
      expect(rows).toEqual([{ email_hash: hashEmail('corrida@teste.local') }]);
    });

    it('bounce transitório grava o evento mas não suprime', async () => {
      await seedMessage('re_t', 'alguem@teste.local');
      await send(evt('email.bounced', 're_t', { bounce: { type: 'Transient', subType: 'MailboxFull', message: 'cheia' } }));
      expect(await count('email_events', `type = 'bounced'`)).toBe(1);
      expect(await count('email_suppressions')).toBe(0);
    });

    it('reclamação suprime com motivo "complaint"', async () => {
      const u = await mkUser({ email: 'spam@teste.local' });
      await seedMessage('re_c', 'spam@teste.local', u.id);
      await send(evt('email.complained', 're_c', {}, '2026-10-31T12:00:00.000Z', ['spam@teste.local']));
      expect((await pool.query(`SELECT reason FROM email_suppressions`)).rows).toEqual([{ reason: 'complaint' }]);
    });

    it('não grava endereço, assunto, link nem mensagem do servidor no payload', async () => {
      await seedMessage('re_p', 'privado@teste.local');
      await send(evt('email.bounced', 're_p', { bounce: { type: 'Permanent', subType: 'General', message: 'privado@teste.local rejeitado' } }, '2026-10-31T12:00:00.000Z', ['privado@teste.local']));
      await send(evt('email.clicked', 're_p', { click: { link: 'https://x.test/?t=TOKEN-SECRETO', ipAddress: '9.9.9.9', userAgent: 'ua', timestamp: 't' } }, '2026-10-31T12:05:00.000Z', ['privado@teste.local']));
      const all = JSON.stringify((await pool.query(`SELECT * FROM email_events`)).rows);
      for (const proibido of ['privado@teste.local', 'Assunto secreto', 'TOKEN-SECRETO', '9.9.9.9', 'rejeitado', 'noreply@backfindr.com.br']) {
        expect(all, proibido).not.toContain(proibido);
      }
    });
  });

  // ─── Resultados no admin ──────────────────────────────────────────────────────
  describe('admin/emails GET', () => {
    it('resultados por campanha, campanha antiga sem dados e saúde do envio', async () => {
      const { GET } = await import('@/app/api/v1/admin/emails/route');
      const old = (await pool.query(`INSERT INTO email_campaigns (type, subject, body_html, status, sent_count) VALUES ('webjetos_reativacao', 'antiga', '<b/>', 'sent', 50) RETURNING id`)).rows[0].id;
      const nova = (await pool.query(`INSERT INTO email_campaigns (type, subject, body_html, status, sent_count) VALUES ('custom', 'nova', '<b/>', 'sent', 3) RETURNING id`)).rows[0].id;
      for (const [rid, evs] of [['r1', ['delivered', 'opened']], ['r2', ['bounced']], ['r3', ['delivered', 'complained']]] as const) {
        await pool.query(`INSERT INTO email_messages (resend_id, to_email_hash, category, source, campaign_id, subject) VALUES ($1, 'h', 'marketing', 'campaign', $2, 's')`, [rid, nova]);
        for (const t of evs) await pool.query(`INSERT INTO email_events (resend_id, type, occurred_at) VALUES ($1, $2, NOW())`, [rid, t]);
      }
      await pool.query(`INSERT INTO email_suppressions (email_hash, reason, source) VALUES ('s1', 'unsubscribe', $1), ('s2', 'bounce', 'resend_webhook')`, [`unsubscribe_campaign:${nova}`]);

      const body = await (await GET(new NextRequest('http://localhost/api/v1/admin/emails'))).json();
      const byId = Object.fromEntries(body.campaigns.map((c: { id: string }) => [c.id, c]));
      expect(byId[old].results).toBeNull();
      expect(byId[nova].results).toMatchObject({ tracked: 3, delivered: 2, bounced: 1, complained: 1, opened: 1, clicked: 0, unsubscribed: 1 });
      expect(body.tracking).toMatchObject({ available: true, webhook_configured: true });
      expect(body.health).toMatchObject({ days: 30, sent: 3, suppressed_total: 2 });
      expect(body.health.delivery_rate).toBeCloseTo(2 / 3);
      expect(body.health.bounce_rate).toBeCloseTo(1 / 3);
    });

    it('sem nenhum evento do Resend, as taxas são nulas (não 0%)', async () => {
      const { GET } = await import('@/app/api/v1/admin/emails/route');
      await pool.query(`INSERT INTO email_messages (resend_id, to_email_hash, category, source, subject) VALUES ('rz', 'h', 'service', 'welcome', 's')`);
      const body = await (await GET(new NextRequest('http://localhost/api/v1/admin/emails'))).json();
      expect(body.health).toMatchObject({ sent: 1, events: 0, delivery_rate: null, bounce_rate: null, complaint_rate: null });
    });
  });

  // ─── Campanha em massa ────────────────────────────────────────────────────────
  describe('admin/emails POST', () => {
    const post = async (body: Record<string, unknown>) => {
      const { POST } = await import('@/app/api/v1/admin/emails/route');
      return POST(new NextRequest('http://localhost/api/v1/admin/emails', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }));
    };
    const base = { type: 'custom', subject: 'Assunto da campanha', body_html: '<p>Olá, {{name}}</p>', limit: 50 };

    it('conta enviados, falhas (erro do Resend) e ignorados (sem opt-in); legado e sistema ficam de fora', async () => {
      const ok = await mkUser({ optIn: true });
      const falha = await mkUser({ optIn: true });
      await mkUser(); // sem opt-in: ignorado
      await mkUser({ legacy: true, optIn: true }); // legado: fora da seleção
      await mkUser({ system: true, optIn: true }); // sistema: fora da seleção
      sendMock.mockImplementation(async (a: { to: string[] }) =>
        a.to[0] === falha.email ? { data: null, error: { name: 'x', message: 'recusado' } } : { data: { id: `re_${randomUUID()}` }, error: null });

      const res = await (await post(base)).json();
      expect(res).toMatchObject({ sent: 1, failed: 1, skipped: 1 });
      const camp = (await pool.query(`SELECT sent_count, failed_count, skipped_count FROM email_campaigns WHERE id = $1`, [res.campaign_id])).rows[0];
      expect(camp).toEqual({ sent_count: 1, failed_count: 1, skipped_count: 1 });
      expect(await count('email_messages', 'campaign_id = $1', [res.campaign_id])).toBe(1);
      expect(sendMock.mock.calls.some((c) => c[0].to[0] === ok.email)).toBe(true);
      // {{name}} é escapado.
      await pool.query(`UPDATE users SET name = '<b>x</b>' WHERE id = $1`, [ok.id]);
      sendMock.mockClear();
      await post(base);
      expect(sendMock.mock.calls.find((c) => c[0].to[0] === ok.email)?.[0].html).toContain('&lt;b&gt;x&lt;/b&gt;');
    });

    it('campanha de reativação do Webjetos continua bloqueada', async () => {
      await mkUser({ optIn: true });
      const r = await post({ ...base, type: 'webjetos_reativacao' });
      expect(r.status).toBe(400);
      expect(sendMock).not.toHaveBeenCalled();
    });

    it('teste para um endereço avulso envia 1 e respeita supressão', async () => {
      const r = await post({ ...base, test_email: 'admin@teste.local' });
      expect(await r.json()).toMatchObject({ sent: 1, failed: 0 });
      await suppress('barrado@teste.local', 'bounce');
      const r2 = await post({ ...base, test_email: 'barrado@teste.local' });
      expect(r2.status).toBe(400);
    });
  });

  // ─── cron/lifecycle (0.3) ─────────────────────────────────────────────────────
  describe('cron/lifecycle grava evento só com envio realmente feito', () => {
    it('guia mensal: envio ok grava; erro do Resend e recusa por regra não gravam', async () => {
      const ok = await mkUser({ optIn: true });
      const falha = await mkUser({ optIn: true });
      const semOptIn = await mkUser();
      const legado = await mkUser({ legacy: true, optIn: true });
      sendMock.mockImplementation(async (a: { to: string[] }) =>
        a.to[0] === falha.email ? { data: null, error: { name: 'x', message: 'recusado' } } : { data: { id: `re_${randomUUID()}` }, error: null });

      const { GET } = await import('@/app/api/v1/cron/lifecycle/route');
      const res = await GET(new NextRequest('http://localhost/api/v1/cron/lifecycle', { headers: { authorization: 'Bearer cron-de-teste' } }));
      const body = await res.json();
      expect(res.status).toBe(200);
      expect(body.educational_guides).toBe(1);
      expect(body.skipped).toBe(1);
      expect(body.errors.some((e: string) => e.includes('guia'))).toBe(true);

      const ev = (await pool.query(`SELECT user_id, event_type FROM user_lifecycle_events WHERE event_type LIKE 'guide_%'`)).rows;
      expect(ev).toHaveLength(1);
      expect(ev[0].user_id).toBe(ok.id);
      for (const u of [falha, semOptIn, legado]) expect(ev.some((e) => e.user_id === u.id), u.email).toBe(false);
      // o legado nem chega a ser selecionado (filtro do cron); o e-mail dele nunca foi tentado
      expect(sendMock.mock.calls.some((c) => c[0].to[0] === legado.email)).toBe(false);
    });
  });
});
