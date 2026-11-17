import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requireAuth } from '@/lib/adminGuard';
import { gerarQrCode, gerarToken } from '@/lib/notifyModulos';
import { respostaErroInterno } from '@/lib/erroInterno';

// Colunas reais de `entregas` (conferidas no esquema): link_token, cliente_nome, cliente_telefone,
// cliente_endereco. A resposta mantém os nomes que as telas já usam (token, destinatario_*, endereco_destino).
const CAMPOS_ENTREGA = `id, link_token AS token, cliente_nome AS destinatario_nome,
              cliente_telefone AS destinatario_phone, cliente_endereco AS endereco_destino,
              status, created_at, entregue_em`;

// GET /api/v1/delivery/minhas-entregas
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  try {
    const res = await query(
      `SELECT ${CAMPOS_ENTREGA}
       FROM entregas
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 50`,
      [auth.user.id]
    );
    return NextResponse.json({ items: res.rows });
  } catch (e) {
    return respostaErroInterno('delivery/minhas-entregas', e);
  }
}

// POST /api/v1/delivery/minhas-entregas
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await req.json();
    const { destinatario_nome, destinatario_phone, endereco_destino, entregador_phone } = body;

    if (!destinatario_nome || !destinatario_phone || !endereco_destino) {
      return NextResponse.json(
        { detail: 'Nome, telefone e endereço do destinatário são obrigatórios' },
        { status: 400 }
      );
    }

    // Buscar entregador pelo telefone (opcional)
    let entregadorId = null;
    if (entregador_phone) {
      // O telefone do entregador está em users.phone (entregadores não tem coluna de telefone); compara só os dígitos.
      const entregador = await query(
        `SELECT en.id FROM entregadores en
         JOIN users u ON u.id = en.user_id
         WHERE regexp_replace(COALESCE(u.phone, ''), '\\D', '', 'g') = $1 AND en.active = true
         LIMIT 1`,
        [entregador_phone.replace(/\D/g, '')]
      );
      if (entregador.rows.length > 0) {
        entregadorId = entregador.rows[0].id;
      }
    }

    const token = gerarToken('dlv_');

    const res = await query(
      `INSERT INTO entregas
         (user_id, cliente_nome, cliente_telefone, cliente_endereco,
          entregador_id, status, qr_code, link_token)
       VALUES ($1, $2, $3, $4, $5, 'aguardando', $6, $7)
       RETURNING *`,
      [auth.user.id, destinatario_nome, destinatario_phone,
       endereco_destino, entregadorId, gerarQrCode(), token]
    );

    const entrega = res.rows[0];
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3003';

    return NextResponse.json({
      ...entrega,
      token,
      destinatario_nome: entrega.cliente_nome,
      destinatario_phone: entrega.cliente_telefone,
      endereco_destino: entrega.cliente_endereco,
      entregador_vinculado: entregadorId !== null,
      link_url: `${appUrl}/delivery/${token}`,
    }, { status: 201 });
  } catch (e) {
    return respostaErroInterno('delivery/minhas-entregas', e);
  }
}
