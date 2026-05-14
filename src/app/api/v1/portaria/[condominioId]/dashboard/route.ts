export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requireAuth } from '@/lib/adminGuard';

// GET /api/v1/portaria/[condominioId]/dashboard
// Porteiro autenticado visualiza o painel operacional
export async function GET(
  req: NextRequest,
  { params }: { params: { condominioId: string } }
) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const { condominioId } = params;

  try {
    // Verificar se o usuário tem acesso a este condomínio
    // (porteiro vinculado, b2b_admin do parceiro, ou admin interno)
    const acesso = await verificarAcesso(auth.user.id, auth.user.role, condominioId);
    if (!acesso) {
      return NextResponse.json({ detail: 'Sem acesso a este condomínio' }, { status: 403 });
    }

    // Buscar dados do condomínio
    const condRes = await query(
      `SELECT id, nome, slug, cidade, total_unidades FROM condominios WHERE id = $1`,
      [condominioId]
    );
    if (condRes.rows.length === 0) {
      return NextResponse.json({ detail: 'Condomínio não encontrado' }, { status: 404 });
    }
    const condominio = condRes.rows[0];

    // Encomendas pendentes
    const encomendasPendentes = await query(
      `SELECT e.id, e.remetente, e.descricao, e.registrado_em, e.status,
              u.numero AS unidade, u.bloco,
              usr.name AS morador_nome
       FROM encomendas e
       LEFT JOIN unidades u ON u.id = e.unidade_id
       LEFT JOIN users usr ON usr.id = e.morador_id
       WHERE e.condominio_id = $1 AND e.status = 'pendente'
       ORDER BY e.registrado_em DESC
       LIMIT 50`,
      [condominioId]
    );

    // Custódias ativas
    const custodiasAtivas = await query(
      `SELECT c.id, c.descricao, c.destinatario_nome, c.status,
              c.custodiado_em, c.qr_code,
              usr.name AS remetente_nome
       FROM custodias c
       LEFT JOIN users usr ON usr.id = c.remetente_id
       WHERE c.condominio_id = $1 AND c.status IN ('registrado','custodiado')
       ORDER BY c.created_at DESC
       LIMIT 50`,
      [condominioId]
    );

    // Estatísticas do dia
    const hoje = new Date().toISOString().split('T')[0];
    const statsHoje = await query(
      `SELECT
         COUNT(*) FILTER (WHERE status = 'pendente')                             AS pendentes,
         COUNT(*) FILTER (WHERE status = 'entregue' AND DATE(entregue_em) = $2) AS entregues_hoje,
         COUNT(*) FILTER (WHERE DATE(registrado_em) = $2)                       AS recebidas_hoje
       FROM encomendas
       WHERE condominio_id = $1`,
      [condominioId, hoje]
    );

    const stats = statsHoje.rows[0] as {
      pendentes: string;
      entregues_hoje: string;
      recebidas_hoje: string;
    };

    return NextResponse.json({
      condominio,
      stats: {
        encomendas_pendentes:  parseInt(stats.pendentes, 10),
        encomendas_entregues_hoje: parseInt(stats.entregues_hoje, 10),
        encomendas_recebidas_hoje: parseInt(stats.recebidas_hoje, 10),
        custodias_ativas: custodiasAtivas.rows.length,
      },
      encomendas_pendentes: encomendasPendentes.rows,
      custodias_ativas: custodiasAtivas.rows,
    });
  } catch (e: unknown) {
    return NextResponse.json({ detail: String(e) }, { status: 500 });
  }
}

async function verificarAcesso(
  userId: string,
  role: string,
  condominioId: string
): Promise<boolean> {
  if (role === 'super_admin' || role === 'admin') return true;

  // Verificar se é porteiro deste condomínio
  const porteiro = await query(
    `SELECT id FROM porteiros WHERE user_id = $1 AND condominio_id = $2 AND active = true`,
    [userId, condominioId]
  );
  if (porteiro.rows.length > 0) return true;

  // Verificar se é b2b_admin do parceiro deste condomínio
  const b2bAdmin = await query(
    `SELECT u.id FROM users u
     JOIN condominios c ON c.b2b_partner_id = u.b2b_partner_id
     WHERE u.id = $1 AND c.id = $2`,
    [userId, condominioId]
  );
  return b2bAdmin.rows.length > 0;
}
