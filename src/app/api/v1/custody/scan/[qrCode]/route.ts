export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requireAuth } from '@/lib/adminGuard';
import { notificarCustodiaRecebida } from '@/lib/notifyModulos';

// POST /api/v1/custody/scan/[qrCode]
// Porteiro ou entregador escaneia QR — registra custódia
export async function POST(
  req: NextRequest,
  { params }: { params: { qrCode: string } }
) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const body = await req.json().catch(() => ({}));
  const { tipo = 'pessoa', lat, lng, observacao } = body as {
    tipo?: 'porteiro' | 'entregador' | 'pessoa';
    lat?: number;
    lng?: number;
    observacao?: string;
  };

  try {
    // Buscar custódia pelo QR
    const res = await query(
      `SELECT c.*, usr.name AS remetente_nome
       FROM custodias c
       LEFT JOIN users usr ON usr.id = c.remetente_id
       WHERE c.qr_code = $1`,
      [params.qrCode]
    );

    if (res.rows.length === 0) {
      return NextResponse.json({ detail: 'QR Code não encontrado' }, { status: 404 });
    }

    const cust = res.rows[0] as {
      id: string; status: string;
      remetente_id: string; remetente_nome: string;
      descricao: string; destinatario_nome: string;
      custodiante_id: string | null;
    };

    // Se já entregue ou cancelado, só retorna o status
    if (cust.status === 'entregue' || cust.status === 'cancelado') {
      return NextResponse.json(
        { detail: `Item já está com status: ${cust.status}`, status: cust.status },
        { status: 409 }
      );
    }

    // Se já tem custodiante e não é o mesmo usuário, bloquear
    if (cust.custodiante_id && cust.custodiante_id !== auth.user.id) {
      return NextResponse.json(
        { detail: 'Item já está sob custódia de outro usuário' },
        { status: 409 }
      );
    }

    // Atualizar para custodiado
    const updated = await query(
      `UPDATE custodias
       SET status           = 'custodiado',
           custodiante_id   = $1,
           custodiante_tipo = $2,
           custodiado_em    = COALESCE(custodiado_em, NOW()),
           updated_at       = NOW()
       WHERE id = $3
       RETURNING *`,
      [auth.user.id, tipo, cust.id]
    );

    // Registrar evento com localização
    await query(
      `INSERT INTO custody_eventos
         (custodia_id, tipo, user_id, lat, lng, observacao)
       VALUES ($1, 'custodiado', $2, $3, $4, $5)`,
      [
        cust.id, auth.user.id,
        lat ?? null, lng ?? null,
        observacao ?? `Custódia registrada por ${auth.user.name}`,
      ]
    );

    // Notificar remetente (fire-and-forget)
    notificarCustodiaRecebida(
      cust.remetente_id,
      cust.descricao,
      auth.user.name
    ).catch(() => {});

    return NextResponse.json({
      ...updated.rows[0],
      remetente_nome:    cust.remetente_nome,
      destinatario_nome: cust.destinatario_nome,
      message:           'Custódia registrada com sucesso',
    });
  } catch (e: unknown) {
    return NextResponse.json({ detail: String(e) }, { status: 500 });
  }
}

// GET /api/v1/custody/scan/[qrCode]
// Consulta pública pelo QR — retorna info básica (sem dados sensíveis)
export async function GET(
  _req: NextRequest,
  { params }: { params: { qrCode: string } }
) {
  try {
    const res = await query(
      `SELECT id, descricao, status, destinatario_nome, custodiado_em, created_at
       FROM custodias
       WHERE qr_code = $1`,
      [params.qrCode]
    );

    if (res.rows.length === 0) {
      return NextResponse.json({ detail: 'QR Code não encontrado' }, { status: 404 });
    }

    return NextResponse.json(res.rows[0]);
  } catch (e: unknown) {
    return NextResponse.json({ detail: String(e) }, { status: 500 });
  }
}
