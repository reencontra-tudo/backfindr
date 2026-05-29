export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

// GET /api/v1/custody/link/[token]
// Público — destinatário acessa o link recebido no WhatsApp
// Retorna info do item sem dados sensíveis do remetente
export async function GET(
  _req: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const res = await query(
      `SELECT c.id, c.descricao, c.status, c.destinatario_nome,
              c.custodiado_em, c.entregue_em,
              usr.name AS remetente_nome,
              cust.name AS custodiante_nome,
              cond.nome AS condominio_nome, cond.endereco AS condominio_endereco
       FROM custodias c
       LEFT JOIN users usr        ON usr.id  = c.remetente_id
       LEFT JOIN users cust       ON cust.id = c.custodiante_id
       LEFT JOIN condominios cond ON cond.id = c.condominio_id
       WHERE c.link_token = $1`,
      [params.token]
    );

    if (res.rows.length === 0) {
      return NextResponse.json({ detail: 'Link inválido ou expirado' }, { status: 404 });
    }

    const cust = res.rows[0];

    // Registrar visualização (fire-and-forget)
    query(
      `INSERT INTO custody_eventos (custodia_id, tipo, observacao)
       VALUES ($1, 'visualizado', 'Link acessado pelo destinatário')`,
      [cust.id]
    ).catch(() => {});

    return NextResponse.json(cust);
  } catch (e: unknown) {
    return NextResponse.json({ detail: String(e) }, { status: 500 });
  }
}
