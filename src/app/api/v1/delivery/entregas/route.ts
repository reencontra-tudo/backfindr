export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requireAuth } from '@/lib/adminGuard';
import { gerarQrCode, gerarToken, notificarEntregaSaiu, enviarWhatsApp } from '@/lib/notifyModulos';
import { z } from 'zod';

const EntregaSchema = z.object({
  estabelecimento_id: z.string().uuid(),
  cliente_nome:       z.string().min(2).max(200),
  cliente_telefone:   z.string().min(8).max(30),
  cliente_endereco:   z.string().min(5),
  cliente_lat:        z.number().optional(),
  cliente_lng:        z.number().optional(),
  descricao:          z.string().optional(),
  condominio_id:      z.string().uuid().optional(),
});

// GET /api/v1/delivery/entregas — listar entregas do estabelecimento
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const url               = new URL(req.url);
  const estabelecimento_id = url.searchParams.get('estabelecimento_id') ?? '';
  const status            = url.searchParams.get('status') ?? '';
  const page              = Math.max(1, parseInt(url.searchParams.get('page') ?? '1'));
  const size              = Math.min(100, parseInt(url.searchParams.get('size') ?? '20'));
  const offset            = (page - 1) * size;

  const conditions: string[] = [];
  const params: unknown[]    = [];
  let idx = 1;

  if (estabelecimento_id) {
    conditions.push(`e.estabelecimento_id = $${idx}`);
    params.push(estabelecimento_id);
    idx++;
  }
  if (status) {
    conditions.push(`e.status = $${idx}`);
    params.push(status);
    idx++;
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  try {
    const [countRes, rowsRes] = await Promise.all([
      query(`SELECT COUNT(*) FROM entregas e ${where}`, params),
      query(
        `SELECT e.*,
                est.nome AS estabelecimento_nome,
                ent.veiculo AS entregador_veiculo,
                usr.name AS entregador_nome
         FROM entregas e
         LEFT JOIN estabelecimentos est ON est.id = e.estabelecimento_id
         LEFT JOIN entregadores ent     ON ent.id = e.entregador_id
         LEFT JOIN users usr            ON usr.id = e.entregador_user_id
         ${where}
         ORDER BY e.created_at DESC
         LIMIT $${idx} OFFSET $${idx + 1}`,
        [...params, size, offset]
      ),
    ]);

    return NextResponse.json({
      items: rowsRes.rows,
      total: parseInt(countRes.rows[0].count, 10),
      page,
      size,
    });
  } catch (e: unknown) {
    return NextResponse.json({ detail: String(e) }, { status: 500 });
  }
}

// POST /api/v1/delivery/entregas — criar nova entrega
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const body   = await req.json();
  const parsed = EntregaSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ detail: parsed.error.issues }, { status: 400 });
  }

  const {
    estabelecimento_id, cliente_nome, cliente_telefone,
    cliente_endereco, cliente_lat, cliente_lng,
    descricao, condominio_id,
  } = parsed.data;

  try {
    // Verificar estabelecimento
    const estRes = await query(
      `SELECT id, nome FROM estabelecimentos WHERE id = $1 AND active = true`,
      [estabelecimento_id]
    );
    if (estRes.rows.length === 0) {
      return NextResponse.json({ detail: 'Estabelecimento não encontrado' }, { status: 404 });
    }
    const est = estRes.rows[0] as { id: string; nome: string };

    const qrCode    = gerarQrCode();
    const linkToken = gerarToken('dlv_');

    const res = await query(
      `INSERT INTO entregas
         (estabelecimento_id, cliente_nome, cliente_telefone, cliente_endereco,
          cliente_lat, cliente_lng, descricao, qr_code, link_token,
          condominio_id, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'preparando')
       RETURNING *`,
      [
        estabelecimento_id, cliente_nome, cliente_telefone, cliente_endereco,
        cliente_lat ?? null, cliente_lng ?? null,
        descricao ?? null, qrCode, linkToken,
        condominio_id ?? null,
      ]
    );

    const entrega = res.rows[0];

    // Registrar evento inicial
    await query(
      `INSERT INTO entrega_eventos (entrega_id, tipo, user_id, observacao)
       VALUES ($1, 'criada', $2, 'Entrega registrada')`,
      [entrega.id, auth.user.id]
    );

    const appUrl  = process.env.NEXT_PUBLIC_APP_URL ?? 'https://backfindr.com';
    const linkUrl = `${appUrl}/delivery/${linkToken}`;

    // Enviar link ao cliente via WhatsApp (fire-and-forget)
    const desc = descricao ?? 'seu pedido';
    const msg =
      `🛵 *${est.nome}*\n\n` +
      `Seu pedido está sendo preparado: "${desc}".\n\n` +
      `Acompanhe em tempo real:\n${linkUrl}\n\n` +
      `_Você receberá alertas quando o entregador sair e chegar._`;
    enviarWhatsApp(cliente_telefone, msg).catch(() => {});

    return NextResponse.json({
      ...entrega,
      estabelecimento_nome: est.nome,
      link_url: linkUrl,
    }, { status: 201 });
  } catch (e: unknown) {
    return NextResponse.json({ detail: String(e) }, { status: 500 });
  }
}
