export const dynamic = 'force-dynamic';
// Máximo permitido no plano Hobby da Vercel — dá o teto de tempo real que
// existe, mas a defesa de verdade contra estourar isso é a paralelização +
// o MAX_ITEMS_PER_RUN abaixo, não esse número sozinho.
export const maxDuration = 60;

import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { SOURCES } from '@/lib/publicSignals/sources';
import { extractSignal, type RawSignalItem } from '@/lib/publicSignals/extract';
import { computeContentHash } from '@/lib/publicSignals/dedup';
import { sendPushToUser } from '@/lib/pushNotification';

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
//
// ── Histórico: por que existe paralelização + teto aqui ────────────────────
// Primeiro teste real (18/08/2026) processou os itens em sequência (um por
// vez, esperando a extração via LLM terminar antes do próximo) — com ~90
// candidatos vindos de 4 buscas RSS, isso passou de 60s reais e a função foi
// encerrada pela Vercel antes de conseguir responder, mesmo com todo o
// trabalho já commitado no banco (67 linhas inseridas certinho, resposta
// HTTP nunca chegou). Corrigido com lotes concorrentes (CONCURRENCY) + um
// teto explícito de itens por rodada (MAX_ITEMS_PER_RUN) como rede de
// segurança adicional — se um dia tiver pico de notícia e vier muito mais
// candidato que o normal, melhor processar em duas rodadas (o resto fica
// pra amanhã, sem problema — RSS renova todo dia) do que estourar de novo.

const CONTACT_RETENTION_MONTHS = 12;
const MAX_ITEMS_PER_RUN = 40;
const CONCURRENCY = 8;

const SOURCE_CONFIDENCE: Record<string, number> = {
  institution: 80,
  press_rss: 50,
  google_alert_corroboration: 30,
};

interface Stats {
  sources: number;
  itemsSeen: number;
  itemsSkippedCapReached: number;
  skippedExistingUrl: number;
  skippedNotRelevant: number;
  skippedDuplicateContent: number;
  inserted: number;
  errors: number;
}

// ── Alerta pra admin (não-b2b) ao fim da rodada ─────────────────────────────
// Pedido do usuário em 19/08/2026: quer saber quando o cron diário roda,
// sem precisar abrir o painel pra conferir. Reaproveita o mesmo par
// notifications+push já usado em src/lib/notifyModulos.ts (copiado aqui em
// vez de importado — aquele módulo é sobre Portaria/Custody/Delivery,
// import cruzado misturaria domínios sem necessidade real).
async function notifyAdminsOfIngestResult(stats: Stats): Promise<void> {
  try {
    const admins = await query(
      `SELECT id FROM users
       WHERE role IN ('admin', 'super_admin')
         AND is_system_account = false
         AND b2b_partner_id IS NULL`
    );
    if (admins.rows.length === 0) return;

    const title = stats.errors > 0
      ? '⚠️ Public Signals: ingestão com erros'
      : '📡 Public Signals: ingestão diária concluída';
    const message = `${stats.inserted} nova(s) evidência(s) na fila, de ${stats.sources} fonte(s) — `
      + `${stats.itemsSeen} itens vistos, ${stats.errors} erro(s).`;

    await Promise.allSettled(
      (admins.rows as { id: string }[]).map(async ({ id }) => {
        await query(
          `INSERT INTO notifications (user_id, title, message, type, created_at)
           VALUES ($1, $2, $3, 'public_signals_ingest', NOW())`,
          [id, title, message]
        );
        await sendPushToUser(id, {
          title,
          body: message,
          url: '/admin/public-signals',
          tag: 'public_signals_ingest',
        });
      })
    );
  } catch (err) {
    // Nunca deixa o alerta quebrar a resposta do endpoint — o ingest em si
    // já terminou e commitou no banco nesse ponto.
    console.error('[public-signals/ingest] falha ao notificar admins', err);
  }
}

async function processItem(
  raw: Omit<RawSignalItem, 'sourceType' | 'regionHint'>,
  sourceType: RawSignalItem['sourceType'],
  stats: Stats,
  seenHashesThisRun: Set<string>,
  regionHint: string | null
): Promise<void> {
  try {
    // ── Dedup grosso: source_url exata já vista antes (banco) ────────────
    const existing = await query(
      `SELECT 1 FROM public_signal_evidence WHERE source_url = $1 LIMIT 1`,
      [raw.link]
    );
    if (existing.rows.length > 0) {
      stats.skippedExistingUrl++;
      return;
    }

    // ── Extraction (a parte lenta — é por isso que roda em lote) ─────────
    const extracted = await extractSignal({ ...raw, sourceType, regionHint });
    if (!extracted || !extracted.is_relevant) {
      stats.skippedNotRelevant++;
      return;
    }

    // ── Dedup fino: hash de conteúdo normalizado ──────────────────────────
    const dedupHash = computeContentHash(extracted.title, extracted.category, extracted.location_text);

    // Checagem em memória PRIMEIRO, síncrona, sem await entre checar e
    // marcar — evita duas tarefas concorrentes do mesmo lote inserirem a
    // mesma ocorrência (ambas passariam pela checagem no banco abaixo se
    // rodassem ao mesmo tempo, já que nenhuma inseriu ainda).
    if (seenHashesThisRun.has(dedupHash)) {
      stats.skippedDuplicateContent++;
      return;
    }
    seenHashesThisRun.add(dedupHash);

    const dupCheck = await query(
      `SELECT id FROM public_signal_evidence WHERE dedup_hash = $1 AND status IN ('pending','approved') LIMIT 1`,
      [dedupHash]
    );
    if (dupCheck.rows.length > 0) {
      // MVP: duplicata não vira linha nova (nem soma "corroboração" — fica
      // pra depois se o volume justificar). Isso já implementa "Google
      // Alert nunca é fonte primária isolada": se o único jeito dele bater
      // aqui é confirmando algo que outra fonte já achou, ele nunca cria
      // nada sozinho.
      stats.skippedDuplicateContent++;
      return;
    }

    // Google Alerts sem match de dedup = não tem corroboração de nenhuma
    // outra fonte ainda → descarta (nunca é fonte primária).
    if (sourceType === 'google_alert_corroboration') {
      stats.skippedNotRelevant++;
      return;
    }

    // ── Retenção de dado sensível (seção 3) ───────────────────────────────
    const hasContact = extracted.has_contact_data === true;
    const expiresAt = hasContact
      ? new Date(Date.now() + CONTACT_RETENTION_MONTHS * 30 * 24 * 60 * 60 * 1000)
      : null;

    const confidence = SOURCE_CONFIDENCE[sourceType] ?? 30;

    // O SELECT acima (dupCheck) já filtra a maioria dos casos — o
    // ON CONFLICT aqui é o backstop atômico de verdade contra duas
    // execuções sobrepostas do cron tentando inserir o mesmo dedup_hash ao
    // mesmo tempo (constraint uq_public_signal_evidence_dedup_hash,
    // migration 008). Sem isso, o SELECT-then-INSERT tinha uma janela de
    // corrida real, só de baixo risco prático com cadência 1x/dia.
    const insertResult = await query(
      `INSERT INTO public_signal_evidence
         (source_url, source_type, has_contact_data, contact_snapshot,
          extracted_fields, dedup_hash, expires_at, status, captured_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', NOW())
       ON CONFLICT (dedup_hash) DO NOTHING
       RETURNING id`,
      [
        raw.link,
        sourceType,
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
    if (insertResult.rows.length > 0) {
      stats.inserted++;
    } else {
      // ON CONFLICT pegou uma corrida que o SELECT prévio não viu.
      stats.skippedDuplicateContent++;
    }
  } catch (err) {
    console.error('[public-signals/ingest] erro processando item', err);
    stats.errors++;
  }
}

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

  const stats: Stats = {
    sources: 0,
    itemsSeen: 0,
    itemsSkippedCapReached: 0,
    skippedExistingUrl: 0,
    skippedNotRelevant: 0,
    skippedDuplicateContent: 0,
    inserted: 0,
    errors: 0,
  };
  const seenHashesThisRun = new Set<string>();

  // ── Discovery: junta os itens de todas as fontes antes de processar ────
  const allItems: { raw: Omit<RawSignalItem, 'sourceType' | 'regionHint'>; sourceType: RawSignalItem['sourceType']; regionHint: string | null }[] = [];
  for (const source of SOURCES) {
    stats.sources++;
    try {
      const rawItems = await source.fetchItems();
      for (const raw of rawItems) allItems.push({ raw, sourceType: source.type, regionHint: source.regionHint });
    } catch (err) {
      console.error(`[public-signals/ingest] falha ao buscar fonte ${source.id}`, err);
      stats.errors++;
    }
  }
  stats.itemsSeen = allItems.length;

  // ── Teto de segurança: se vier muito mais candidato que o normal (pico
  // de notícia), processa só MAX_ITEMS_PER_RUN — o resto fica pra próxima
  // rodada. Embaralha ANTES de cortar: sem isso, a ordem de discovery é
  // sempre a mesma (mesma sequência de queries/fontes), então os itens do
  // fim da fila nunca seriam avaliados de verdade — não "adiados pra
  // amanhã", mas praticamente nunca vistos, já que os mesmos itens do
  // início tendem a reaparecer dia após dia. Embaralhando, com o tempo todo
  // candidato tem chance de ser avaliado em algum dia, mesmo sem aumentar
  // o teto.
  for (let i = allItems.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [allItems[i], allItems[j]] = [allItems[j], allItems[i]];
  }
  const toProcess = allItems.slice(0, MAX_ITEMS_PER_RUN);
  stats.itemsSkippedCapReached = allItems.length - toProcess.length;

  // ── Processa em lotes concorrentes — é isso que resolve o timeout ──────
  for (let i = 0; i < toProcess.length; i += CONCURRENCY) {
    const batch = toProcess.slice(i, i + CONCURRENCY);
    await Promise.all(
      batch.map(({ raw, sourceType, regionHint }) => processItem(raw, sourceType, stats, seenHashesThisRun, regionHint))
    );
  }

  await notifyAdminsOfIngestResult(stats);

  return NextResponse.json({ ok: true, stats });
}
