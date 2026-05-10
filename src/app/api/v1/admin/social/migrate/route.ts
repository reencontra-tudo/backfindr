export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-migration-secret') ?? req.nextUrl.searchParams.get('secret');
  if (secret !== process.env.MIGRATION_SECRET) {
    return NextResponse.json({ detail: 'Não autorizado' }, { status: 401 });
  }

  const results: Record<string, string> = {};

  // ── social_posts: fila de publicações automáticas ─────────────────────────
  try {
    await query(`CREATE TABLE IF NOT EXISTS social_posts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      object_id UUID REFERENCES objects(id) ON DELETE CASCADE,
      channel TEXT NOT NULL,
      -- 'telegram' | 'whatsapp_link' | 'twitter' | 'facebook' | 'instagram'
      status TEXT NOT NULL DEFAULT 'pending',
      -- 'pending' | 'sent' | 'failed' | 'skipped'
      post_text TEXT NOT NULL,
      post_url TEXT,
      image_url TEXT,
      sent_at TIMESTAMPTZ,
      error_message TEXT,
      retry_count INTEGER NOT NULL DEFAULT 0,
      scheduled_for TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
    await query(`CREATE INDEX IF NOT EXISTS idx_social_posts_status ON social_posts(status)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_social_posts_channel ON social_posts(channel)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_social_posts_object ON social_posts(object_id)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_social_posts_scheduled ON social_posts(scheduled_for) WHERE status = 'pending'`);
    results.social_posts = 'OK';
  } catch (e: unknown) { results.social_posts = String(e); }

  // ── social_settings: configurações dos canais ─────────────────────────────
  try {
    await query(`CREATE TABLE IF NOT EXISTS social_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL DEFAULT '',
      description TEXT NOT NULL DEFAULT '',
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
    await query(`
      INSERT INTO social_settings (key, description, value) VALUES
        ('telegram_bot_token',    'Token do bot Telegram (@BotFather)',                 ''),
        ('telegram_channel_id',   'ID do canal Telegram (ex: -100123456789)',           ''),
        ('telegram_enabled',      'Publicar automaticamente no Telegram (true/false)',  'false'),
        ('whatsapp_group_link',   'Link de convite do grupo WhatsApp',                  ''),
        ('whatsapp_enabled',      'Incluir link WhatsApp nos posts (true/false)',        'false'),
        ('auto_post_enabled',     'Ativar publicação automática ao cadastrar objeto',    'true'),
        ('post_template',         'Template do post (use {title}, {status}, {url}, {category}, {reward})',
         '🔍 *{status_emoji} {title}*\n\n📂 Categoria: {category}\n📍 {location}\n{reward_line}\n\n🔗 Ver detalhes: {url}\n\n_Registrado no Backfindr — plataforma de objetos perdidos_')
      ON CONFLICT (key) DO NOTHING
    `);
    results.social_settings = 'OK';
  } catch (e: unknown) { results.social_settings = String(e); }

  return NextResponse.json({ ok: true, results });
}
