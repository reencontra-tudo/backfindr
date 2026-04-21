export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminGuard';
import { query } from '@/lib/db';

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;
  const results: Record<string, string> = {};
  try {
    await query(`CREATE TABLE IF NOT EXISTS reports (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), object_id UUID REFERENCES objects(id) ON DELETE SET NULL, reporter_id UUID REFERENCES users(id) ON DELETE SET NULL, type TEXT NOT NULL DEFAULT 'spam', reason TEXT, status TEXT NOT NULL DEFAULT 'pending', resolved_by UUID REFERENCES users(id) ON DELETE SET NULL, resolved_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`);
    await query(`CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status)`);
    results.reports = 'OK';
  } catch (e: unknown) { results.reports = String(e); }
  try {
    await query(`CREATE TABLE IF NOT EXISTS b2b_partners (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), name TEXT NOT NULL, type TEXT NOT NULL DEFAULT 'outro', city TEXT, contact TEXT, email TEXT, phone TEXT, notes TEXT, status TEXT NOT NULL DEFAULT 'prospect', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`);
    await query(`CREATE INDEX IF NOT EXISTS idx_b2b_status ON b2b_partners(status)`);
    results.b2b_partners = 'OK';
  } catch (e: unknown) { results.b2b_partners = String(e); }
  try {
    await query(`CREATE TABLE IF NOT EXISTS email_campaigns (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), type TEXT NOT NULL DEFAULT 'custom', subject TEXT NOT NULL, body_html TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'draft', sent_count INTEGER NOT NULL DEFAULT 0, failed_count INTEGER NOT NULL DEFAULT 0, filter_json JSONB, created_by UUID REFERENCES users(id) ON DELETE SET NULL, sent_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`);
    await query(`CREATE INDEX IF NOT EXISTS idx_campaigns_status ON email_campaigns(status)`);
    results.email_campaigns = 'OK';
  } catch (e: unknown) { results.email_campaigns = String(e); }
  return NextResponse.json({ results });
}
