import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requireAuth } from '@/lib/adminGuard';

// GET /api/v1/subscriptions?product=p1
// Retorna a subscription ativa do usuário autenticado para um produto
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(req.url);
  const product = searchParams.get('product') ?? 'p1';

  try {
    // Para p1: entity = user
    // Para p2: entity = partner (b2b_partner_id do user)
    // Para p3: entity = condominio (via unidade do user)
    // Para p4: entity = user (delivery_account)

    let entityId = auth.user.id;
    let entityType = 'user';

    if (product === 'p2' && auth.user.b2b_partner_id) {
      entityId = auth.user.b2b_partner_id;
      entityType = 'partner';
    }

    if (product === 'p3') {
      // Busca condomínio do usuário
      const unidade = await query(
        'SELECT condominio_id FROM unidades WHERE user_id = $1 LIMIT 1',
        [auth.user.id]
      );
      if (unidade.rows.length > 0) {
        entityId = unidade.rows[0].condominio_id;
        entityType = 'condominio';
      }
    }

    const res = await query(
      `SELECT * FROM subscriptions
       WHERE entity_type = $1 AND entity_id = $2 AND product = $3
       AND status = 'active'
       ORDER BY created_at DESC LIMIT 1`,
      [entityType, entityId, product]
    );

    if (res.rows.length === 0) {
      return NextResponse.json({
        plan: 'free',
        status: 'active',
        product,
        entity_type: entityType,
        entity_id: entityId,
      });
    }

    return NextResponse.json(res.rows[0]);
  } catch (e) {
    return NextResponse.json({ detail: String(e) }, { status: 500 });
  }
}

// POST /api/v1/subscriptions
// Cria ou atualiza uma subscription
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await req.json();
    const { entity_type, entity_id, product, plan, price_cents, mp_subscription_id, mp_payment_id, expires_at } = body;

    if (!entity_type || !entity_id || !product || !plan) {
      return NextResponse.json({ detail: 'Campos obrigatórios: entity_type, entity_id, product, plan' }, { status: 400 });
    }

    // Cancelar subscription anterior se existir
    await query(
      `UPDATE subscriptions SET status = 'canceled', updated_at = NOW()
       WHERE entity_type = $1 AND entity_id = $2 AND product = $3 AND status = 'active'`,
      [entity_type, entity_id, product]
    );

    // Criar nova
    const res = await query(
      `INSERT INTO subscriptions
       (entity_type, entity_id, product, plan, status, price_cents, mp_subscription_id, mp_payment_id, expires_at)
       VALUES ($1, $2, $3, $4, 'active', $5, $6, $7, $8)
       RETURNING *`,
      [entity_type, entity_id, product, plan, price_cents ?? 0, mp_subscription_id ?? null, mp_payment_id ?? null, expires_at ?? null]
    );

    return NextResponse.json(res.rows[0], { status: 201 });
  } catch (e) {
    return NextResponse.json({ detail: String(e) }, { status: 500 });
  }
}
