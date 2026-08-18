export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { SOURCES } from '@/lib/publicSignals/sources';
import { extractSignal } from '@/lib/publicSignals/extract';
import { computeContentHash } from '@/lib/publicSignals/dedup';

// ─── POST /api/v1/admin/public-signals/ingest ──────────────────────────────
// Chamado 1x/dia pelo n8n (Railway) — NÃO pelo cron da Vercel (Hobby só
// permite 1x/dia mesmo, e o matching já usa esse slot). Autenticação
// server-to-server via secret dedicado (SIGNALS_CRON_SECRET), separado do
// CRON_SECRET do matching pra poder revogar um sem afetar o outro.
//
// Pipeline: Discovery (fontes em src/lib/publicSignals/sources.ts) →
// dedup grosso (source_url) → Extraction (LLM) → dedup fino (hash de
// conteúdo) → classificação de confiança → INSERT em public_signal_evidence
// como 'pending'. Nada aqui publica em objects — isso só acontece na
// aprovação manual (fora do escopo deste endpoint).
//
// Não roda matching, não gera objeto, não notifica ninguém. Fail-safe:
// sem SIGNALS_CRON_SECRET configurado, o endpoint recusa qualquer chamada.

const CONTACT_RETENTION_MONTHS = 12;

const SOURCE_CONFIDENCE: Record<string, number> = {
  institution: 80,
  press_rss: 50,
  google_alert_corroboration: 30,
};

export async function POST(request: NextRequest) {
  const secret = process.env.SIGNALS_CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { detail: 'SIGNALS_CRON_SECRET não configurado — endpoint desabilitado por padrão (fail-safe).' },
      { status: 503 }
    );
  }
  const provided = request.headers.get('x-signals-cron-secret');
  if (provided !== secret) {
    return NextResponse.json({ detail: 'Não autorizado' }, { status: 401 });
  }

  const stats = {
    sources: 0,
    itemsSeen: 0,
    skippedExistingUrl: 0,
    skippedNotRelevant: 0,
    skippedDuplicateContent: 0,
    inserted: 0,
    errors: 0,
  };

  for (const source of SOURCES) {
    stats.sources++;
    let rawItems;
    try {
      rawItems = await source.fetchItems();
    } catch (err) {
      console.error(`[public-signals/ingest] falha ao buscar fonte ${source.id}`, err);
      stats.errors++;
      continue;
    }

    for (const raw of rawItems) {
      stats.itemsSeen++;
      try {
        // ── Dedup grosso: source_url exata já vista antes ──────────────
        const existing = await query(
          `SELECT 1 FROM public_signal_evidence WHERE source_url = $1 LIMIT 1`,
          [raw.link]
        );
        if (existing.rows.length > 0) {
          stats.skippedExistingUrl++;
          continue;
        }

        // ── Extraction ──────────────────────────────────────────────────
        const extracted = await extractSignal({ ...raw, sourceType: source.type });
        if (!extracted || !extracted.is_relevant) {
          stats.skippedNotRelevant++;
          continue;
        }

        // ── Dedup fino: hash de conteúdo normalizado ────────────────────
        const dedupHash = computeContentHash(extracted.title, extracted.category, extracted.location_text);
        const dupCheck = await query(
          `SELECT id FROM public_signal_evidence WHERE dedup_hash = $1 AND status IN ('pending','approved') LIMIT 1`,
          [dedupHash]
        );
        if (dupCheck.rows.length > 0) {
          // MVP: duplicata não vira linha nova (nem soma "corroboração" —
          // fica pra depois se o volume justificar). Isso já implementa
          // "Google Alert nunca é fonte primária isolada": se o único jeito
          // dele bater aqui é confirmando algo que outra fonte já achou,
          // ele nunca cria nada sozinho.
          stats.skippedDuplicateContent++;
          continue;
        }

        // Google Alerts sem match de dedup = não tem corroboração de
        // nenhuma outra fonte ainda → descarta (nunca é fonte primária).
        if (source.type === 'google_alert_corroboration') {
          stats.skippedNotRelevant++;
          continue;
        }

        // ── Retenção de dado sensível (seção 3) ─────────────────────────
        const hasContact = extracted.has_contact_data === true;
        const expiresAt = hasContact
          ? new Date(Date.now() + CONTACT_RETENTION_MONTHS * 30 * 24 * 60 * 60 * 1000)
          : null;

        const confidence = SOURCE_CONFIDENCE[source.type] ?? 30;

        await query(
          `INSERT INTO public_signal_evidence
             (source_url, source_type, has_contact_data, contact_snapshot,
              extracted_fields, dedup_hash, expires_at, status, captured_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', NOW())`,
          [
            raw.link,
            source.type,
            hasContact,
            hasContact ? JSON.stringify({ text: extracted.contact_text }) : null,
            JSON.stringify({
              title: extracted.title,
              category: extracted.category,
              status_guess: extracted.status_guess,
              location_text: extracted.location_text,
              confidence_score: confidence,
              raw_title: raw.title,
              raw_description: raw.description,
            }),
            dedupHash,
            expiresAt,
          ]
        );
        stats.inserted++;
      } catch (err) {
        console.error('[public-signals/ingest] erro processando item', err);
        stats.errors++;
      }
    }
  }

  return NextResponse.json({ ok: true, stats });
}
