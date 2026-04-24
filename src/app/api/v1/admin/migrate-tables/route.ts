export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

// Este endpoint usa verificação direta por MIGRATION_SECRET para permitir
// execução inicial quando o banco ainda não tem a coluna role
export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-migration-secret') ?? req.nextUrl.searchParams.get('secret');
  if (secret !== process.env.MIGRATION_SECRET) {
    return NextResponse.json({ detail: 'Não autorizado' }, { status: 401 });
  }

  const results: Record<string, string> = {};

  // ── reports ──────────────────────────────────────────────────────────────
  try {
    await query(`CREATE TABLE IF NOT EXISTS reports (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      object_id UUID REFERENCES objects(id) ON DELETE SET NULL,
      reporter_id UUID REFERENCES users(id) ON DELETE SET NULL,
      type TEXT NOT NULL DEFAULT 'spam',
      reason TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      resolved_by UUID REFERENCES users(id) ON DELETE SET NULL,
      resolved_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
    await query(`CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status)`);
    results.reports = 'OK';
  } catch (e: unknown) { results.reports = String(e); }

  // ── b2b_partners ─────────────────────────────────────────────────────────
  try {
    await query(`CREATE TABLE IF NOT EXISTS b2b_partners (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'outro',
      city TEXT,
      contact TEXT,
      email TEXT,
      phone TEXT,
      notes TEXT,
      status TEXT NOT NULL DEFAULT 'prospect',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
    await query(`CREATE INDEX IF NOT EXISTS idx_b2b_status ON b2b_partners(status)`);
    results.b2b_partners = 'OK';
  } catch (e: unknown) { results.b2b_partners = String(e); }

  // ── email_campaigns ───────────────────────────────────────────────────────
  try {
    await query(`CREATE TABLE IF NOT EXISTS email_campaigns (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      type TEXT NOT NULL DEFAULT 'custom',
      subject TEXT NOT NULL,
      body_html TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'draft',
      sent_count INTEGER NOT NULL DEFAULT 0,
      failed_count INTEGER NOT NULL DEFAULT 0,
      filter_json JSONB,
      created_by UUID REFERENCES users(id) ON DELETE SET NULL,
      sent_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
    await query(`CREATE INDEX IF NOT EXISTS idx_campaigns_status ON email_campaigns(status)`);
    results.email_campaigns = 'OK';
  } catch (e: unknown) { results.email_campaigns = String(e); }

  // ── users: coluna role ────────────────────────────────────────────────────
  // role: 'super_admin' | 'b2b_admin' | 'user'
  try {
    await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'user'`);
    await query(`CREATE INDEX IF NOT EXISTS idx_users_role ON users(role)`);
    results.users_role = 'OK';
  } catch (e: unknown) { results.users_role = String(e); }

  // ── users: coluna b2b_partner_id ─────────────────────────────────────────
  try {
    await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS b2b_partner_id UUID REFERENCES b2b_partners(id) ON DELETE SET NULL`);
    await query(`CREATE INDEX IF NOT EXISTS idx_users_b2b_partner ON users(b2b_partner_id)`);
    results.users_b2b_partner_id = 'OK';
  } catch (e: unknown) { results.users_b2b_partner_id = String(e); }

  // ── users: colunas is_active e is_legacy (se não existirem) ──────────────
  try {
    await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true`);
    await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_legacy BOOLEAN NOT NULL DEFAULT false`);
    results.users_flags = 'OK';
  } catch (e: unknown) { results.users_flags = String(e); }

  // ── users: coluna admin_permissions (permissões granulares por colaborador) ───
  try {
    await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS admin_permissions JSONB`);
    results.users_admin_permissions = 'OK';
  } catch (e: unknown) { results.users_admin_permissions = String(e); }

  // ── team_invites: convites pendentes de colaboradores ─────────────────────
  try {
    await query(`CREATE TABLE IF NOT EXISTS team_invites (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'admin',
      permissions JSONB,
      invited_by UUID REFERENCES users(id) ON DELETE SET NULL,
      token TEXT NOT NULL UNIQUE,
      accepted_at TIMESTAMPTZ,
      expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '7 days',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
    await query(`CREATE INDEX IF NOT EXISTS idx_team_invites_email ON team_invites(email)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_team_invites_token ON team_invites(token)`);
    results.team_invites = 'OK';
  } catch (e: unknown) { results.team_invites = String(e); }

  return NextResponse.json({ ok: true, results });
}
