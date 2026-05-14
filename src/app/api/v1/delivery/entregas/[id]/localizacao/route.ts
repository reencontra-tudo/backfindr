export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requireAuth } from '@/lib/adminGuard';
import {
  calcularDistanciaMetros,
  notificarEntregaProximo,
  notificarEntregaNaPortaria,
  enviarWhatsApp,
} from '@/lib/notifyModulos';
import { z } from 'zod';

const LocalizacaoSchema = z.object({
  lat: z.number(),
  lng: z.number(),
});

// POST /api/v1/delivery/entregas/[id]/localizacao
// Entregador envia posição atual — geofencing automático dispara alertas
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const body   = await req.json();
  const parsed = LocalizacaoSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ detail: parsed.error.issues }, { status: 400 });
  }

  const { lat, lng } = parsed.data;

  try {
    const entRes = await query(
      `SELECT e.*,
              est.nome AS estabelecimento_nome
       FROM entregas e
       LEFT JOIN estabelecimentos est ON est.id = e.estabelecimento_id
       WHERE e.id = $1`,
      [params.id]
    );

    if (entRes.rows.length === 0) {
      return NextResponse.json({ detail: 'Entrega não encontrada' }, { status: 404 });
    }

    const entrega = entRes.rows[0] as {
      id: string; status: string;
      cliente_user_id: string | null;
      cliente_telefone: string;
      cliente_lat: number | null; cliente_lng: number | null;
      estabelecimento_nome: string;
      descricao: string | null;
    };

    if (entrega.status === 'entregue' || entrega.status === 'cancelado') {
      return NextResponse.json({ detail: 'Entrega já finalizada' }, { status: 409 });
    }

    // Atualizar localização do entregador
    await query(
      `UPDATE entregas
       SET entregador_lat        = $1,
           entregador_lng        = $2,
           ultima_localizacao_em = NOW(),
           updated_at            = NOW()
       WHERE id = $3`,
      [lat, lng, params.id]
    );

    // Registrar evento de localização
    await query(
      `INSERT INTO entrega_eventos (entrega_id, tipo, user_id, lat, lng)
       VALUES ($1, 'localizacao', $2, $3, $4)`,
      [params.id, auth.user.id, lat, lng]
    );

    // ── Geofencing automático ──────────────────────────────────────────────
    let alertaDisparado: string | null = null;
    const est     = entrega.estabelecimento_nome;
    const clientId = entrega.cliente_user_id;
    const tel     = entrega.cliente_telefone;
    const appUrl  = process.env.NEXT_PUBLIC_APP_URL ?? 'https://backfindr.com';

    if (entrega.cliente_lat && entrega.cliente_lng) {
      const distancia = calcularDistanciaMetros(
        lat, lng,
        entrega.cliente_lat, entrega.cliente_lng
      );

      // 500m — "está chegando" (só dispara uma vez)
      if (distancia <= 500 && entrega.status === 'saiu') {
        await query(
          `UPDATE entregas SET status = 'proximo', updated_at = NOW() WHERE id = $1`,
          [params.id]
        );
        await query(
          `INSERT INTO entrega_eventos (entrega_id, tipo, user_id, lat, lng, observacao)
           VALUES ($1, 'proximo', $2, $3, $4, 'Geofencing 500m')`,
          [params.id, auth.user.id, lat, lng]
        );

        if (clientId) notificarEntregaProximo(clientId, est).catch(() => {});
        enviarWhatsApp(tel,
          `📍 *${est}*\nSeu entregador está chegando! Fique atento.`
        ).catch(() => {});
        alertaDisparado = 'proximo_500m';
      }

      // 100m — "quase chegando"
      if (distancia <= 100 && entrega.status === 'proximo') {
        await query(
          `INSERT INTO entrega_eventos (entrega_id, tipo, user_id, lat, lng, observacao)
           VALUES ($1, 'proximo_100m', $2, $3, $4, 'Geofencing 100m')`,
          [params.id, auth.user.id, lat, lng]
        );
        enviarWhatsApp(tel,
          `🚨 *${est}*\nSeu entregador está muito perto! Prepare-se para receber.`
        ).catch(() => {});
        alertaDisparado = 'proximo_100m';
      }

      // 30m — "chegou" → muda para na_portaria automaticamente
      if (distancia <= 30 && entrega.status === 'proximo') {
        await query(
          `UPDATE entregas
           SET status = 'na_portaria', chegou_em = NOW(), updated_at = NOW()
           WHERE id = $1`,
          [params.id]
        );
        await query(
          `INSERT INTO entrega_eventos (entrega_id, tipo, user_id, lat, lng, observacao)
           VALUES ($1, 'na_portaria', $2, $3, $4, 'Geofencing 30m — chegada automática')`,
          [params.id, auth.user.id, lat, lng]
        );

        if (clientId) notificarEntregaNaPortaria(clientId, est).catch(() => {});
        enviarWhatsApp(tel,
          `🔔 *${est}*\nSeu pedido chegou! O entregador está no local.\n\nConfirme o recebimento: ${appUrl}/delivery/${params.id}`
        ).catch(() => {});
        alertaDisparado = 'na_portaria_30m';
      }
    }

    return NextResponse.json({
      message:          'Localização atualizada',
      lat,
      lng,
      alerta_disparado: alertaDisparado,
    });
  } catch (e: unknown) {
    return NextResponse.json({ detail: String(e) }, { status: 500 });
  }
}
