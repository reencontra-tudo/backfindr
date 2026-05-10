export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requireAuth } from '@/lib/adminGuard';
import {
  notificarEntregaSaiu,
  notificarEntregaProximo,
  notificarEntregaNaPortaria,
  notificarEntregadorComprovanteGerado,
  enviarWhatsApp,
} from '@/lib/notifyModulos';
import { z } from 'zod';

const StatusSchema = z.object({
  status: z.enum(['preparando', 'saiu', 'proximo', 'na_portaria', 'cancelado']),
  entregador_user_id: z.string().uuid().optional(),
  lat: z.number().optional(),
  lng: z.number().optional(),
  observacao: z.string().optional(),
});

// PATCH /api/v1/delivery/entregas/[id]/status
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const body   = await req.json();
  const parsed = StatusSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ detail: parsed.error.issues }, { status: 400 });
  }

  const { status, entregador_user_id, lat, lng, observacao } = parsed.data;

  try {
    const entRes = await query(
      `SELECT e.*,
              est.nome AS estabelecimento_nome,
              usr.name AS cliente_nome_db
       FROM entregas e
       LEFT JOIN estabelecimentos est ON est.id = e.estabelecimento_id
       LEFT JOIN users usr            ON usr.id = e.cliente_user_id
       WHERE e.id = $1`,
      [params.id]
    );

    if (entRes.rows.length === 0) {
      return NextResponse.json({ detail: 'Entrega não encontrada' }, { status: 404 });
    }

    const entrega = entRes.rows[0] as {
      id: string; status: string;
      cliente_user_id: string | null;
      cliente_nome: string; cliente_telefone: string;
      entregador_user_id: string | null;
      estabelecimento_nome: string;
      descricao: string | null;
    };

    if (entrega.status === 'entregue' || entrega.status === 'cancelado') {
      return NextResponse.json(
        { detail: `Entrega já está com status: ${entrega.status}` },
        { status: 409 }
      );
    }

    // Campos a atualizar
    const updates: Record<string, unknown> = {
      status,
      updated_at: new Date(),
    };

    if (entregador_user_id) updates.entregador_user_id = entregador_user_id;
    if (status === 'saiu')        updates.saiu_em    = new Date();
    if (status === 'na_portaria') updates.chegou_em  = new Date();

    // Montar UPDATE dinâmico
    const setClauses = Object.keys(updates).map((k, i) => `${k} = $${i + 2}`).join(', ');
    const setValues  = Object.values(updates);

    await query(
      `UPDATE entregas SET ${setClauses} WHERE id = $1`,
      [params.id, ...setValues]
    );

    // Registrar evento com localização
    await query(
      `INSERT INTO entrega_eventos (entrega_id, tipo, user_id, lat, lng, observacao)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        params.id, status, auth.user.id,
        lat ?? null, lng ?? null,
        observacao ?? null,
      ]
    );

    const est     = entrega.estabelecimento_nome;
    const desc    = entrega.descricao ?? 'pedido';
    const tel     = entrega.cliente_telefone;
    const clientId = entrega.cliente_user_id;
    const appUrl  = process.env.NEXT_PUBLIC_APP_URL ?? 'https://backfindr.com';

    // Notificações por status (fire-and-forget)
    if (status === 'saiu') {
      if (clientId) notificarEntregaSaiu(clientId, desc, est).catch(() => {});
      enviarWhatsApp(tel,
        `🛵 *${est}*\nSeu pedido saiu para entrega!\n"${desc}"\n\nAcompanhe: ${appUrl}/delivery/${params.id}`
      ).catch(() => {});
    }

    if (status === 'proximo') {
      if (clientId) notificarEntregaProximo(clientId, est).catch(() => {});
      enviarWhatsApp(tel,
        `📍 *${est}*\nSeu entregador está chegando perto de você!`
      ).catch(() => {});
    }

    if (status === 'na_portaria') {
      if (clientId) notificarEntregaNaPortaria(clientId, est).catch(() => {});
      enviarWhatsApp(tel,
        `🔔 *${est}*\nSeu pedido está na portaria. Pode descer para retirar!`
      ).catch(() => {});
    }

    return NextResponse.json({ message: 'Status atualizado', status });
  } catch (e: unknown) {
    return NextResponse.json({ detail: String(e) }, { status: 500 });
  }
}
