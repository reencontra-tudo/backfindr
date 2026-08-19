export const dynamic = 'force-dynamic';
// Chamado interativamente por um admin (um item de cada vez, botão/form no
// painel) — sem paralelização/lote, ao contrário de ingest/route.ts que
// processa dezenas de itens vindos do cron. maxDuration default (10s do
// Hobby) é suficiente: 1 fetch de página + 1 chamada de LLM.

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/adminGuard';
import { query } from '@/lib/db';
import { fetchPageContent } from '@/lib/publicSignals/fetchPage';
import { extractSignal, type RawSignalItem } from '@/lib/publicSignals/extract';
import { computeContentHash } from '@/lib/publicSignals/dedup';

// ─── POST /api/v1/admin/public-signals/submit ──────────────────────────────
// Canal de entrada manual pra public_signal_evidence: um admin encontrou uma
// URL relevante fora do pipeline automático (ex: via Perplexity, busca
// manual) e quer submetê-la sem esperar o próximo cron. Reaproveita
// exatamente extract.ts e dedup.ts do pipeline automático — a única parte
// nova é buscar o conteúdo da própria página (fetchPage.ts), já que aqui
// não tem RSS entregando title/description prontos.
//
// Autenticação: requireAdmin (sessão de admin normal), NÃO o
// SIGNALS_CRON_SECRET — esse é exclusivo do endpoint de ingestão em massa
// chamado pelo n8n.
//
// URL é obrigatória, sem opção de colar texto solto — mantém a mesma
// garantia de proveniência do resto do pipeline (todo candidato rastreável
// até uma fonte real).
//
// Resultado sempre cai na mesma fila de aprovação manual (status='pending')
// — este canal não tem nenhum atalho de auto-publicação.

const SubmitSchema = z.object({
  source_url: z.string().url(),
  source_type: z.enum(['institution', 'press', 'other']),
});

// Confiança por tipo, só pra este canal — mesma escala de
// ingest/route.ts::SOURCE_CONFIDENCE (institution=80, press_rss=50), com um
// valor próprio pra 'other' (submissão manual sem categoria clara: acima do
// corroboration automático, abaixo de uma fonte já confiável — julgamento
// razoável, não um número testado).
const SUBMIT_CONFIDENCE: Record<string, number> = {
  institution: 80,
  press: 50,
  other: 40,
};

const SOURCE_TYPE_MAP: Record<string, RawSignalItem['sourceType']> = {
  institution: 'institution',
  press: 'press_rss',
  other: 'manual_other',
};

const CONTACT_RETENTION_MONTHS = 12;

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;

  const body = await req.json().catch(() => null);
  const parsed = SubmitSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ detail: parsed.error.issues }, { status: 400 });
  }
  const { source_url, source_type } = parsed.data;
  const sourceType = SOURCE_TYPE_MAP[source_type];

  try {
    // ── Dedup grosso: mesma URL exata já submetida antes (automático ou manual) ──
    const existingByUrl = await query(
      `SELECT id, status FROM public_signal_evidence WHERE source_url = $1 LIMIT 1`,
      [source_url]
    );
    if (existingByUrl.rows.length > 0) {
      const existing = existingByUrl.rows[0];
      return NextResponse.json({
        ok: true,
        already_existed: true,
        reason: 'same_url',
        id: existing.id,
        status: existing.status,
        message: `Esta URL já foi submetida antes (id ${existing.id}, status atual: ${existing.status}).`,
      });
    }

    // ── Buscar e extrair conteúdo da página ────────────────────────────────
    const page = await fetchPageContent(source_url);
    if (!page) {
      return NextResponse.json(
        { detail: 'Não foi possível buscar ou extrair conteúdo dessa URL (página indisponível, bloqueou o fetch, ou sem título legível).' },
        { status: 422 }
      );
    }

    // ── Extração via LLM (regionHint null: submissão manual não tem fonte
    // pré-cadastrada com região fixa — cada URL pode ser de qualquer lugar) ──
    const extracted = await extractSignal({
      title: page.title,
      description: page.description,
      link: source_url,
      sourceType,
      regionHint: null,
    });

    if (!extracted) {
      return NextResponse.json(
        { detail: 'Falha na extração (erro de LLM/parsing — ver logs do servidor).' },
        { status: 502 }
      );
    }

    if (!extracted.is_relevant) {
      return NextResponse.json({
        ok: true,
        created: false,
        is_relevant: false,
        message: 'Extração concluída, mas o conteúdo não foi reconhecido como uma ocorrência relevante — nada foi criado.',
      });
    }

    // ── Dedup fino: hash de conteúdo normalizado ───────────────────────────
    const dedupHash = computeContentHash(extracted.title, extracted.category, extracted.location_text);
    const existingByHash = await query(
      `SELECT id, status FROM public_signal_evidence WHERE dedup_hash = $1 LIMIT 1`,
      [dedupHash]
    );
    if (existingByHash.rows.length > 0) {
      const existing = existingByHash.rows[0];
      return NextResponse.json({
        ok: true,
        already_existed: true,
        reason: 'same_content_hash',
        id: existing.id,
        status: existing.status,
        extracted: {
          title: extracted.title,
          category: extracted.category,
          status_guess: extracted.status_guess,
          location_text: extracted.location_text,
          has_contact_data: extracted.has_contact_data,
        },
        message: `Já existe uma evidência com o mesmo conteúdo (id ${existing.id}, status atual: ${existing.status}) — não duplicado.`,
      });
    }

    // ── Retenção de dado sensível (mesma regra do pipeline automático) ─────
    const hasContact = extracted.has_contact_data === true;
    const expiresAt = hasContact
      ? new Date(Date.now() + CONTACT_RETENTION_MONTHS * 30 * 24 * 60 * 60 * 1000)
      : null;
    const confidence = SUBMIT_CONFIDENCE[source_type] ?? 40;

    // ON CONFLICT como backstop de corrida (constraint uq_public_signal_evidence_dedup_hash,
    // migration 008) — baixo risco aqui (submissão única, um admin por vez),
    // mas mesma garantia atômica do pipeline automático, não uma versão mais fraca.
    const insertResult = await query(
      `INSERT INTO public_signal_evidence
         (source_url, source_type, has_contact_data, contact_snapshot,
          extracted_fields, dedup_hash, expires_at, status, captured_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', NOW())
       ON CONFLICT (dedup_hash) DO NOTHING
       RETURNING id`,
      [
        source_url,
        sourceType,
        hasContact,
        hasContact ? JSON.stringify({ text: extracted.contact_text }) : null,
        JSON.stringify({
          title: extracted.title,
          category: extracted.category,
          status_guess: extracted.status_guess,
          location_text: extracted.location_text,
          confidence_score: confidence,
          raw_title: page.title,
          raw_description: page.description,
        }),
        dedupHash,
        expiresAt,
      ]
    );

    if (insertResult.rows.length === 0) {
      // Perdeu a corrida do ON CONFLICT — outra submissão simultânea inseriu
      // o mesmo hash entre o SELECT e o INSERT. Busca o que ganhou.
      const winner = await query(`SELECT id, status FROM public_signal_evidence WHERE dedup_hash = $1 LIMIT 1`, [dedupHash]);
      return NextResponse.json({
        ok: true,
        already_existed: true,
        reason: 'race_on_insert',
        id: winner.rows[0]?.id ?? null,
        status: winner.rows[0]?.status ?? null,
        message: 'Outra submissão simultânea criou a mesma evidência primeiro — não duplicado.',
      });
    }

    return NextResponse.json({
      ok: true,
      created: true,
      id: insertResult.rows[0].id,
      status: 'pending',
      extracted: {
        title: extracted.title,
        category: extracted.category,
        status_guess: extracted.status_guess,
        location_text: extracted.location_text,
        has_contact_data: extracted.has_contact_data,
      },
      message: 'Evidência criada e adicionada à fila de aprovação manual (/admin/public-signals).',
    });
  } catch (err) {
    console.error('[public-signals/submit] erro ao processar submissão', err);
    return NextResponse.json({ detail: 'Erro interno ao processar submissão.' }, { status: 500 });
  }
}
