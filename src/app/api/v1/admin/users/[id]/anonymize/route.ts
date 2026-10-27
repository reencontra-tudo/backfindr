export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/adminGuard';
import { withActor } from '@/lib/audit';
import { adminActor, newRequestId, resolveAnonymization, ANON_REASONS } from '@/lib/governance';

/**
 * POST /api/v1/admin/users/[id]/anonymize  { reason, confirm: true, confirm_text: 'ANONIMIZAR' }  (somente super_admin)
 * Anonimiza a CONTA (dados pessoais, credenciais, mapa de auditoria) e todas as ocorrências não-legado dela. IRREVERSÍVEL.
 * Sem tela por enquanto (rota para o pedido de apagamento do titular, após validação jurídica do fluxo).
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireSuperAdmin(req);
  if (auth instanceof NextResponse) return auth;
  let body: { reason?: unknown; confirm?: unknown; confirm_text?: unknown } | null = null;
  try { body = await req.json(); } catch { body = null; }
  const decision = resolveAnonymization(body);
  if (!decision.ok) return NextResponse.json({ detail: `Confirmação e motivo obrigatórios (${decision.error})`, allowed: ANON_REASONS.map((r) => r.code) }, { status: 400 });
  try {
    const actor = adminActor(auth.user.id, 'POST /api/v1/admin/users/[id]/anonymize', newRequestId(req.headers));
    const result = await withActor(actor, async (q) => {
      const r = await q('SELECT audit.anonymize_user($1::uuid, $2) AS r', [params.id, decision.reason]);
      return r.rows[0]?.r as Record<string, unknown>;
    });
    if (result?.executado) return NextResponse.json({ anonymized: true, objects: result.ocorrencias_anonimizadas, legacy_objects_untouched: result.ocorrencias_legado_nao_tratadas });
    if (String(result?.motivo).startsWith('recusado')) return NextResponse.json({ detail: `Recusado (${result?.motivo})` }, { status: 409 });
    if (result?.motivo === 'ja_anonimizado') return NextResponse.json({ anonymized: true, already: true });
    return NextResponse.json({ detail: 'Usuário não encontrado' }, { status: 404 });
  } catch (e) { return NextResponse.json({ detail: 'Erro ao anonimizar' }, { status: 500 }); }
}
