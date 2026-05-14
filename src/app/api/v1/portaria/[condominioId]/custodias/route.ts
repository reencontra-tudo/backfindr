export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requireAuth } from '@/lib/adminGuard';
import { notificarCustodiaRecebida } from '@/lib/notifyModulos';

// POST /api/v1/portaria/[condominioId]/custodias
// Porteiro escaneia QR de objeto deixado por morador — registra custódia
export async function POST(
  req: NextRequest,
  { params }: { params: { condominioId: string } }
) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const body = await req.json();
  const { qr_code } = body as { qr_code?: string };

  if (!qr_code) {
    return NextResponse.json({ detail: 'qr_code é obrigatório' }, { status: 400 });
  }

  try {
    // Buscar custódia pelo QR
    const custRes = await query(
      `SELECT c.*, usr.name AS remetente_nome
       FROM custodias c
       LEFT JOIN users usr ON usr.id = c.remetente_id
       WHERE c.qr_code = $1`,
      [qr_code]
    );

    if (custRes.rows.length === 0) {
      return NextResponse.json({ detail: 'QR Code não encontrado' }, { status: 404 });
    }

    const cust = custRes.rows[0] as {
      id: string; status: string; remetente_id: string;
      descricao: string; remetente_nome: string;
      destinatario_nome: string; condominio_id: string | null;
    };

    if (cust.status === 'entregue' || cust.status === 'cancelado') {
      return NextResponse.json(
        { detail: `Item já está com status: ${cust.status}` },
        { status: 409 }
      );
    }

    // Vincular ao condomínio se ainda não estiver
    const condominioId = cust.condominio_id ?? params.condominioId;

    // Atualizar status para custodiado
    const updated = await query(
      `UPDATE custodias
       SET status = 'custodiado',
           custodiante_id   = $1,
           custodiante_tipo = 'porteiro',
           condominio_id    = $2,
           custodiado_em    = NOW(),
           updated_at       = NOW()
       WHERE id = $3
       RETURNING *`,
      [auth.user.id, condominioId, cust.id]
    );

    // Registrar evento
    await query(
      `INSERT INTO custody_eventos (custodia_id, tipo, user_id, observacao)
       VALUES ($1, 'custodiado', $2, 'Registrado pela portaria')`,
      [cust.id, auth.user.id]
    );

    // Notificar remetente (fire-and-forget)
    notificarCustodiaRecebida(
      cust.remetente_id,
      cust.descricao,
      auth.user.name
    ).catch(() => {});

    return NextResponse.json({
      ...updated.rows[0],
      remetente_nome:     cust.remetente_nome,
      destinatario_nome:  cust.destinatario_nome,
    });
  } catch (e: unknown) {
    return NextResponse.json({ detail: String(e) }, { status: 500 });
  }
}

// GET /api/v1/portaria/[condominioId]/custodias
// Listar custódias ativas do condomínio
export async function GET(
  req: NextRequest,
  { params }: { params: { condominioId: string } }
) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  try {
    const res = await query(
      `SELECT c.*,
              usr.name AS remetente_nome,
              cust.name AS custodiante_nome
       FROM custodias c
       LEFT JOIN users usr  ON usr.id  = c.remetente_id
       LEFT JOIN users cust ON cust.id = c.custodiante_id
       WHERE c.condominio_id = $1
         AND c.status IN ('registrado','custodiado')
       ORDER BY c.created_at DESC`,
      [params.condominioId]
    );

    return NextResponse.json({ items: res.rows, total: res.rows.length });
  } catch (e: unknown) {
    return NextResponse.json({ detail: String(e) }, { status: 500 });
  }
}
