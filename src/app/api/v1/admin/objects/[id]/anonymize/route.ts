export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminGuard';
import { withActor } from '@/lib/audit';
import { adminActor, newRequestId, resolveAnonymization, ANON_REASONS } from '@/lib/governance';

/**
 * POST /api/v1/admin/objects/[id]/anonymize  { reason, confirm: true, confirm_text: 'ANONIMIZAR' }
 * "Anonimizar agora": IRREVERSÍVEL. Mantém só dados genéricos (categoria, status, ano/trimestre, macro-região…), enfileira os
 * arquivos para remoção e registra tudo na trilha. Recusa legado. Motivo obrigatório e confirmação digitada (anti-clique acidental).
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;
  let body: { reason?: unknown; confirm?: unknown; confirm_text?: unknown } | null = null;
  try { body = await req.json(); } catch { body = null; }
  const decision = resolveAnonymization(body);
  if (!decision.ok) {
    return NextResponse.json({ detail: `Confirmação e motivo obrigatórios (${decision.error})`, allowed: ANON_REASONS.map((r) => r.code) }, { status: 400 });
  }
  try {
    const actor = adminActor(auth.user.id, 'POST /api/v1/admin/objects/[id]/anonymize', newRequestId(req.headers));
    const result = await withActor(actor, async (q) => {
      const r = await q('SELECT audit.anonymize_object($1::uuid, $2) AS r', [params.id, decision.reason]);
      return r.rows[0]?.r as Record<string, unknown>;
    });
    if (result?.executado) return NextResponse.json({ anonymized: true, macro_region: result.macro_regiao, files_enqueued: result.arquivos_enfileirados });
    if (result?.motivo === 'recusado_legado') return NextResponse.json({ detail: 'Ocorrência legada: anonimizar exige decisão do responsável.' }, { status: 409 });
    if (result?.motivo === 'ja_anonimizada') return NextResponse.json({ anonymized: true, already: true });
    return NextResponse.json({ detail: 'Ocorrência não encontrada' }, { status: 404 });
  } catch (e) { return NextResponse.json({ detail: 'Erro ao anonimizar' }, { status: 500 }); }
}
