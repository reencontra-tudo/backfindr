export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminGuard';
import { query } from '@/lib/db';

// ─── PATCH /api/v1/admin/matches/[id] ────────────────────────────────────────
// Body: { status: 'confirmed' | 'rejected' | 'pending' }
//
// 'pending' (29/08/2026) — "Desfazer confirmação". Achado real: "Gata Rubi
// desapareceu no bairro Brasmadeira" × "Cachorro encontrado no bairro
// Brasmadeira" foi confirmado por engano (antes do fix de espécie), sem
// nenhuma forma de reverter. Investigado antes de adicionar isto: este
// endpoint (usado pelo botão do painel admin) só faz UPDATE matches SET
// status — nunca envia notificação/push/e-mail (isso só acontece no
// caminho de confirmação do PRÓPRIO usuário, em /api/v1/matches/[id]/
// route.ts, que é outro código). Reverter aqui é seguro e completo: não
// há efeito colateral pra desfazer além do campo em si.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;

  const body = await req.json().catch(() => ({}));
  const { status } = body as { status?: string };

  if (!status || !['confirmed', 'rejected', 'pending'].includes(status)) {
    return NextResponse.json({ detail: 'status deve ser confirmed, rejected ou pending' }, { status: 400 });
  }

  try {
    const result = await query(
      `UPDATE matches SET status = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING id, status, score, lost_object_id, found_object_id, updated_at`,
      [status, params.id]
    );
    if (result.rows.length === 0) {
      return NextResponse.json({ detail: 'Match não encontrado' }, { status: 404 });
    }
    return NextResponse.json(result.rows[0]);
  } catch (e) {
    console.error('[admin/matches/[id] PATCH]', e);
    return NextResponse.json({ detail: 'Erro ao atualizar match' }, { status: 500 });
  }
}
