export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

// Mesmo padrão do migrate-tables existente
// Protegido por MIGRATION_SECRET
export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-migration-secret') ?? req.nextUrl.searchParams.get('secret');
  if (secret !== process.env.MIGRATION_SECRET) {
    return NextResponse.json({ detail: 'Não autorizado' }, { status: 401 });
  }

  const results: Record<string, string> = {};

  // ── condominios ────────────────────────────────────────────────────────────
  try {
    await query(`CREATE TABLE IF NOT EXISTS condominios (
      id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      b2b_partner_id  UUID        REFERENCES b2b_partners(id) ON DELETE SET NULL,
      slug            VARCHAR(200) UNIQUE NOT NULL,
      nome            VARCHAR(200) NOT NULL,
      endereco        TEXT        NOT NULL,
      cidade          VARCHAR(100) NOT NULL,
      estado          VARCHAR(2)  NOT NULL,
      cep             VARCHAR(10),
      total_unidades  INTEGER     NOT NULL DEFAULT 0,
      logo_url        TEXT,
      whatsapp_notify BOOLEAN     NOT NULL DEFAULT true,
      push_notify     BOOLEAN     NOT NULL DEFAULT true,
      email_notify    BOOLEAN     NOT NULL DEFAULT true,
      active          BOOLEAN     NOT NULL DEFAULT true,
      criado_por      UUID        REFERENCES users(id) ON DELETE SET NULL,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
    await query(`CREATE INDEX IF NOT EXISTS idx_condominios_slug    ON condominios(slug)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_condominios_active  ON condominios(active)`);
    results.condominios = 'OK';
  } catch (e: unknown) { results.condominios = String(e); }

  // ── unidades ───────────────────────────────────────────────────────────────
  try {
    await query(`CREATE TABLE IF NOT EXISTS unidades (
      id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      condominio_id UUID        NOT NULL REFERENCES condominios(id) ON DELETE CASCADE,
      numero        VARCHAR(20) NOT NULL,
      bloco         VARCHAR(20),
      user_id       UUID        REFERENCES users(id) ON DELETE SET NULL,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(condominio_id, numero, bloco)
    )`);
    await query(`CREATE INDEX IF NOT EXISTS idx_unidades_condominio ON unidades(condominio_id)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_unidades_user       ON unidades(user_id)`);
    results.unidades = 'OK';
  } catch (e: unknown) { results.unidades = String(e); }

  // ── porteiros ──────────────────────────────────────────────────────────────
  try {
    await query(`CREATE TABLE IF NOT EXISTS porteiros (
      id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      condominio_id UUID        NOT NULL REFERENCES condominios(id) ON DELETE CASCADE,
      user_id       UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      turno         VARCHAR(20) NOT NULL DEFAULT 'dia',
      active        BOOLEAN     NOT NULL DEFAULT true,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(condominio_id, user_id)
    )`);
    await query(`CREATE INDEX IF NOT EXISTS idx_porteiros_condominio ON porteiros(condominio_id)`);
    results.porteiros = 'OK';
  } catch (e: unknown) { results.porteiros = String(e); }

  // ── encomendas ─────────────────────────────────────────────────────────────
  try {
    await query(`CREATE TABLE IF NOT EXISTS encomendas (
      id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      condominio_id     UUID        NOT NULL REFERENCES condominios(id) ON DELETE CASCADE,
      unidade_id        UUID        REFERENCES unidades(id) ON DELETE SET NULL,
      morador_id        UUID        REFERENCES users(id) ON DELETE SET NULL,
      porteiro_id       UUID        REFERENCES users(id) ON DELETE SET NULL,
      remetente         VARCHAR(200),
      descricao         TEXT,
      foto_url          TEXT,
      codigo_rastreio   VARCHAR(100),
      status            VARCHAR(30) NOT NULL DEFAULT 'pendente',
      ocr_dados         JSONB,
      registrado_em     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      entregue_em       TIMESTAMPTZ,
      entregue_para_id  UUID        REFERENCES users(id) ON DELETE SET NULL,
      created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
    await query(`CREATE INDEX IF NOT EXISTS idx_encomendas_condominio ON encomendas(condominio_id)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_encomendas_morador    ON encomendas(morador_id)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_encomendas_status     ON encomendas(status)`);
    results.encomendas = 'OK';
  } catch (e: unknown) { results.encomendas = String(e); }

  // ── custodias ──────────────────────────────────────────────────────────────
  try {
    await query(`CREATE TABLE IF NOT EXISTS custodias (
      id                    UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
      condominio_id         UUID         REFERENCES condominios(id) ON DELETE SET NULL,
      remetente_id          UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      destinatario_nome     VARCHAR(200) NOT NULL,
      destinatario_contato  VARCHAR(200) NOT NULL,
      destinatario_user_id  UUID         REFERENCES users(id) ON DELETE SET NULL,
      descricao             TEXT         NOT NULL,
      qr_code               VARCHAR(20)  UNIQUE NOT NULL,
      link_token            VARCHAR(100) UNIQUE NOT NULL,
      status                VARCHAR(30)  NOT NULL DEFAULT 'registrado',
      custodiante_id        UUID         REFERENCES users(id) ON DELETE SET NULL,
      custodiante_tipo      VARCHAR(30),
      custodiado_em         TIMESTAMPTZ,
      entregue_em           TIMESTAMPTZ,
      created_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
      updated_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW()
    )`);
    await query(`CREATE INDEX IF NOT EXISTS idx_custodias_qr        ON custodias(qr_code)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_custodias_token     ON custodias(link_token)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_custodias_remetente ON custodias(remetente_id)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_custodias_status    ON custodias(status)`);
    results.custodias = 'OK';
  } catch (e: unknown) { results.custodias = String(e); }

  // ── custody_eventos ────────────────────────────────────────────────────────
  try {
    await query(`CREATE TABLE IF NOT EXISTS custody_eventos (
      id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      custodia_id UUID        NOT NULL REFERENCES custodias(id) ON DELETE CASCADE,
      tipo        VARCHAR(30) NOT NULL,
      user_id     UUID        REFERENCES users(id) ON DELETE SET NULL,
      lat         DECIMAL(10,7),
      lng         DECIMAL(10,7),
      observacao  TEXT,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
    await query(`CREATE INDEX IF NOT EXISTS idx_custody_eventos_custodia ON custody_eventos(custodia_id)`);
    results.custody_eventos = 'OK';
  } catch (e: unknown) { results.custody_eventos = String(e); }

  // ── estabelecimentos ───────────────────────────────────────────────────────
  try {
    await query(`CREATE TABLE IF NOT EXISTS estabelecimentos (
      id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
      b2b_partner_id  UUID         REFERENCES b2b_partners(id) ON DELETE SET NULL,
      nome            VARCHAR(200) NOT NULL,
      slug            VARCHAR(200) UNIQUE NOT NULL,
      telefone        VARCHAR(30),
      endereco        TEXT         NOT NULL,
      lat             DECIMAL(10,7),
      lng             DECIMAL(10,7),
      cidade          VARCHAR(100),
      estado          VARCHAR(2),
      plano           VARCHAR(30)  NOT NULL DEFAULT 'basic',
      active          BOOLEAN      NOT NULL DEFAULT true,
      criado_por      UUID         REFERENCES users(id) ON DELETE SET NULL,
      created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
      updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
    )`);
    await query(`CREATE INDEX IF NOT EXISTS idx_estabelecimentos_slug ON estabelecimentos(slug)`);
    results.estabelecimentos = 'OK';
  } catch (e: unknown) { results.estabelecimentos = String(e); }

  // ── entregadores ───────────────────────────────────────────────────────────
  try {
    await query(`CREATE TABLE IF NOT EXISTS entregadores (
      id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id             UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      estabelecimento_id  UUID        REFERENCES estabelecimentos(id) ON DELETE SET NULL,
      veiculo             VARCHAR(50),
      active              BOOLEAN     NOT NULL DEFAULT true,
      created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(user_id, estabelecimento_id)
    )`);
    await query(`CREATE INDEX IF NOT EXISTS idx_entregadores_user ON entregadores(user_id)`);
    results.entregadores = 'OK';
  } catch (e: unknown) { results.entregadores = String(e); }

  // ── entregas ───────────────────────────────────────────────────────────────
  try {
    await query(`CREATE TABLE IF NOT EXISTS entregas (
      id                    UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
      estabelecimento_id    UUID         NOT NULL REFERENCES estabelecimentos(id) ON DELETE CASCADE,
      entregador_id         UUID         REFERENCES entregadores(id) ON DELETE SET NULL,
      entregador_user_id    UUID         REFERENCES users(id) ON DELETE SET NULL,
      condominio_id         UUID         REFERENCES condominios(id) ON DELETE SET NULL,
      cliente_user_id       UUID         REFERENCES users(id) ON DELETE SET NULL,
      cliente_nome          VARCHAR(200) NOT NULL,
      cliente_telefone      VARCHAR(30)  NOT NULL,
      cliente_endereco      TEXT         NOT NULL,
      cliente_lat           DECIMAL(10,7),
      cliente_lng           DECIMAL(10,7),
      descricao             TEXT,
      qr_code               VARCHAR(20)  UNIQUE NOT NULL,
      link_token            VARCHAR(100) UNIQUE NOT NULL,
      status                VARCHAR(30)  NOT NULL DEFAULT 'preparando',
      entregador_lat        DECIMAL(10,7),
      entregador_lng        DECIMAL(10,7),
      ultima_localizacao_em TIMESTAMPTZ,
      saiu_em               TIMESTAMPTZ,
      chegou_em             TIMESTAMPTZ,
      entregue_em           TIMESTAMPTZ,
      created_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
      updated_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW()
    )`);
    await query(`CREATE INDEX IF NOT EXISTS idx_entregas_qr            ON entregas(qr_code)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_entregas_token         ON entregas(link_token)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_entregas_status        ON entregas(status)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_entregas_estabelecimento ON entregas(estabelecimento_id)`);
    results.entregas = 'OK';
  } catch (e: unknown) { results.entregas = String(e); }

  // ── entrega_eventos ────────────────────────────────────────────────────────
  try {
    await query(`CREATE TABLE IF NOT EXISTS entrega_eventos (
      id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      entrega_id  UUID        NOT NULL REFERENCES entregas(id) ON DELETE CASCADE,
      tipo        VARCHAR(30) NOT NULL,
      lat         DECIMAL(10,7),
      lng         DECIMAL(10,7),
      user_id     UUID        REFERENCES users(id) ON DELETE SET NULL,
      observacao  TEXT,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
    await query(`CREATE INDEX IF NOT EXISTS idx_entrega_eventos_entrega ON entrega_eventos(entrega_id)`);
    results.entrega_eventos = 'OK';
  } catch (e: unknown) { results.entrega_eventos = String(e); }

  const allOk = Object.values(results).every(v => v === 'OK');
  return NextResponse.json({ ok: allOk, results }, { status: allOk ? 200 : 207 });
}
