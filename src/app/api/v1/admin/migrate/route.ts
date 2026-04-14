import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { verifyToken, extractTokenFromHeader } from '@/lib/jwt';

export const dynamic = 'force-dynamic';

const ADMIN_IDS = process.env.ADMIN_IDS?.split(',').map(s => s.trim()) || [];
const MIGRATION_SECRET = process.env.MIGRATION_SECRET || '';

// POST /api/v1/admin/migrate — executa migrations pendentes
export async function POST(req: NextRequest) {
  let authorized = false;

  try {
    let body: Record<string, unknown> = {};
    try {
      const text = await req.text();
      if (text) body = JSON.parse(text);
    } catch { /* sem body */ }

    if (MIGRATION_SECRET && body.secret === MIGRATION_SECRET) {
      authorized = true;
    } else {
      const authHeader = req.headers.get('authorization');
      const token = extractTokenFromHeader(authHeader);
      if (token) {
        const payload = verifyToken(token);
        if (payload && (ADMIN_IDS.length === 0 || ADMIN_IDS.includes(payload.sub))) {
          authorized = true;
        }
      }
    }
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!authorized) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const migrations: { name: string; sql: string }[] = [
    // ── Migrações anteriores ──────────────────────────────────────────────────
    {
      name: 'add_reward_amount_to_objects',
      sql: `ALTER TABLE objects ADD COLUMN IF NOT EXISTS reward_amount NUMERIC(10,2) DEFAULT NULL`,
    },
    {
      name: 'add_reward_description_to_objects',
      sql: `ALTER TABLE objects ADD COLUMN IF NOT EXISTS reward_description TEXT DEFAULT NULL`,
    },

    // ── Colunas de plano na tabela users ──────────────────────────────────────
    {
      name: 'add_plan_columns_to_users',
      sql: `
        ALTER TABLE users
          ADD COLUMN IF NOT EXISTS plan VARCHAR(20) DEFAULT 'free',
          ADD COLUMN IF NOT EXISTS plan_expires_at TIMESTAMPTZ DEFAULT NULL,
          ADD COLUMN IF NOT EXISTS stripe_customer_id VARCHAR(100) DEFAULT NULL,
          ADD COLUMN IF NOT EXISTS stripe_subscription_id VARCHAR(100) DEFAULT NULL,
          ADD COLUMN IF NOT EXISTS mp_subscription_id VARCHAR(100) DEFAULT NULL,
          ADD COLUMN IF NOT EXISTS subscription_provider VARCHAR(20) DEFAULT NULL
      `,
    },

    // ── Tabela de configurações de planos (editável pelo admin) ───────────────
    {
      name: 'create_plan_configs_table',
      sql: `
        CREATE TABLE IF NOT EXISTS plan_configs (
          id           SERIAL PRIMARY KEY,
          slug         VARCHAR(20) UNIQUE NOT NULL,
          name         VARCHAR(50) NOT NULL,
          price_brl    NUMERIC(10,2) NOT NULL DEFAULT 0,
          max_objects  INTEGER NOT NULL DEFAULT 3,
          features     JSONB NOT NULL DEFAULT '[]',
          is_active    BOOLEAN NOT NULL DEFAULT true,
          stripe_price_id   VARCHAR(100) DEFAULT NULL,
          mp_plan_id        VARCHAR(100) DEFAULT NULL,
          created_at   TIMESTAMPTZ DEFAULT NOW(),
          updated_at   TIMESTAMPTZ DEFAULT NOW()
        )
      `,
    },

    // ── Dados iniciais dos planos ─────────────────────────────────────────────
    {
      name: 'seed_plan_configs',
      sql: `
        INSERT INTO plan_configs (slug, name, price_brl, max_objects, features)
        VALUES
          ('free',     'Grátis',   0,      3,   '["3 objetos","QR Code permanente","Busca manual","Suporte comunidade"]'),
          ('pro',      'Pro',      29.00,  50,  '["50 objetos","Matching automático","Notificações push e email","QR Code personalizado","Suporte por email","Relatório básico"]'),
          ('business', 'Business', 149.00, 500, '["500 objetos","Matching prioritário","Notificações push, email e SMS","QR Code bulk","5 usuários na conta","Relatórios completos","Suporte prioritário","Acesso à API"]')
        ON CONFLICT (slug) DO NOTHING
      `,
    },

    // ── Tabela de configurações de pagamento (gateways) ───────────────────────
    {
      name: 'create_payment_settings_table',
      sql: `
        CREATE TABLE IF NOT EXISTS payment_settings (
          id           SERIAL PRIMARY KEY,
          key          VARCHAR(100) UNIQUE NOT NULL,
          value        TEXT DEFAULT NULL,
          description  TEXT DEFAULT NULL,
          is_secret    BOOLEAN NOT NULL DEFAULT false,
          updated_at   TIMESTAMPTZ DEFAULT NOW()
        )
      `,
    },

    // ── Dados iniciais de configurações de pagamento ──────────────────────────
    {
      name: 'seed_payment_settings',
      sql: `
        INSERT INTO payment_settings (key, value, description, is_secret)
        VALUES
          ('stripe_mode',              'test',  'Modo do Stripe: test ou live',                          false),
          ('stripe_publishable_key',   NULL,    'Chave pública do Stripe (pk_test_... ou pk_live_...)',  false),
          ('stripe_secret_key',        NULL,    'Chave secreta do Stripe (sk_test_... ou sk_live_...)',  true),
          ('stripe_webhook_secret',    NULL,    'Webhook secret do Stripe',                              true),
          ('mp_mode',                  'test',  'Modo do Mercado Pago: test ou live',                    false),
          ('mp_public_key',            NULL,    'Chave pública do Mercado Pago',                         false),
          ('mp_access_token',          NULL,    'Access token do Mercado Pago',                          true),
          ('mp_webhook_secret',        NULL,    'Webhook secret do Mercado Pago',                        true),
          ('payments_enabled',         'false', 'Habilitar pagamentos na plataforma',                    false),
          ('free_trial_days',          '0',     'Dias de trial gratuito para novos usuários',            false),
          ('boost_price_7d',           '9.90',  'Preço do Boost de 7 dias (R$)',                         false),
          ('boost_price_30d',          '24.90', 'Preço do Boost de 30 dias (R$)',                        false),
          ('boost_alert_price',        '14.90', 'Preço do Alerta de Área (R$)',                          false)
        ON CONFLICT (key) DO NOTHING
      `,
    },

    // ── Tabela de boosts ──────────────────────────────────────────────────────
    {
      name: 'create_boosts_table',
      sql: `
        CREATE TABLE IF NOT EXISTS boosts (
          id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          object_id       UUID NOT NULL REFERENCES objects(id) ON DELETE CASCADE,
          user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          type            VARCHAR(20) NOT NULL DEFAULT '7d',
          status          VARCHAR(20) NOT NULL DEFAULT 'pending',
          amount_paid     NUMERIC(10,2) DEFAULT NULL,
          provider        VARCHAR(20) DEFAULT NULL,
          provider_ref    VARCHAR(200) DEFAULT NULL,
          starts_at       TIMESTAMPTZ DEFAULT NULL,
          expires_at      TIMESTAMPTZ DEFAULT NULL,
          created_at      TIMESTAMPTZ DEFAULT NOW(),
          updated_at      TIMESTAMPTZ DEFAULT NOW()
        )
      `,
    },
    {
      name: 'create_boosts_index',
      sql: `CREATE INDEX IF NOT EXISTS idx_boosts_object_id ON boosts(object_id)`,
    },
    {
      name: 'create_boosts_expires_index',
      sql: `CREATE INDEX IF NOT EXISTS idx_boosts_expires_at ON boosts(expires_at) WHERE status = 'active'`,
    },

    // ── Coluna boosted nos objetos ────────────────────────────────────────────
    {
      name: 'add_boost_columns_to_objects',
      sql: `
        ALTER TABLE objects
          ADD COLUMN IF NOT EXISTS is_boosted BOOLEAN DEFAULT false,
          ADD COLUMN IF NOT EXISTS boost_expires_at TIMESTAMPTZ DEFAULT NULL,
          ADD COLUMN IF NOT EXISTS visibility VARCHAR(20) DEFAULT 'active'
      `,
    },

    // ── Tabela de notificações de reengajamento ───────────────────────────────
    {
      name: 'create_boost_notifications_table',
      sql: `
        CREATE TABLE IF NOT EXISTS boost_notifications (
          id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          object_id   UUID NOT NULL REFERENCES objects(id) ON DELETE CASCADE,
          user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          day         INTEGER NOT NULL,
          sent_at     TIMESTAMPTZ DEFAULT NOW(),
          UNIQUE(object_id, day)
        )
      `,
    },

    // ── Tabela de assinaturas (histórico) ─────────────────────────────────────
    {
      name: 'create_subscriptions_table',
      sql: `
        CREATE TABLE IF NOT EXISTS subscriptions (
          id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          plan_slug       VARCHAR(20) NOT NULL,
          provider        VARCHAR(20) NOT NULL,
          provider_sub_id VARCHAR(200) DEFAULT NULL,
          status          VARCHAR(20) NOT NULL DEFAULT 'active',
          amount_brl      NUMERIC(10,2) DEFAULT NULL,
          started_at      TIMESTAMPTZ DEFAULT NOW(),
          expires_at      TIMESTAMPTZ DEFAULT NULL,
          cancelled_at    TIMESTAMPTZ DEFAULT NULL,
          created_at      TIMESTAMPTZ DEFAULT NOW(),
          updated_at      TIMESTAMPTZ DEFAULT NOW()
        )
      `,
    },
    {
      name: 'create_subscriptions_user_index',
      sql: `CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id)`,
    },
  ];

  const results: { name: string; status: string; error?: string }[] = [];

  for (const migration of migrations) {
    try {
      await query(migration.sql);
      results.push({ name: migration.name, status: 'ok' });
    } catch (err) {
      results.push({ name: migration.name, status: 'error', error: String(err) });
    }
  }

  return NextResponse.json({ results });
}
