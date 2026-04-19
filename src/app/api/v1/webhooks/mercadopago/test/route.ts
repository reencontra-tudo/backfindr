/**
 * POST /api/v1/webhooks/mercadopago/test
 * Endpoint temporário para testar o processamento do webhook sem chamar a API do MP.
 * Só funciona em ambiente de teste (NODE_ENV !== 'production' OU com secret correto).
 */
import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

const TEST_SECRET = process.env.MIGRATION_SECRET || "backfindr_test_2025";

export async function POST(req: NextRequest) {
  const body = await req.json();

  // Verificar secret de teste
  if (body.secret !== TEST_SECRET) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { type, user_id, plan_slug, object_id, boost_type, days, amount } = body;

  try {
    if (type === "plan") {
      if (!user_id || !plan_slug) {
        return NextResponse.json({ error: "user_id e plan_slug são obrigatórios" }, { status: 400 });
      }

      const expiresAt = new Date();
      expiresAt.setMonth(expiresAt.getMonth() + 1);
      const expiresAtStr = expiresAt.toISOString();
      const fakePaymentId = `test_${Date.now()}`;

      // Atualizar usuário
      const userUpdate = await query(
        `UPDATE users
         SET plan = $1,
             plan_expires_at = $2,
             mp_subscription_id = $3,
             subscription_provider = 'mercadopago',
             updated_at = NOW()
         WHERE id = $4
         RETURNING id, email, plan, plan_expires_at`,
        [plan_slug, expiresAtStr, fakePaymentId, user_id]
      );

      if (userUpdate.rows.length === 0) {
        return NextResponse.json({ error: `Usuário ${user_id} não encontrado` }, { status: 404 });
      }

      // Registrar subscription
      await query(
        `INSERT INTO subscriptions
           (user_id, plan_slug, provider, provider_sub_id, status, amount_brl, started_at, expires_at, created_at)
         VALUES ($1, $2, 'mercadopago', $3, 'active', $4, NOW(), $5, NOW())`,
        [user_id, plan_slug, fakePaymentId, amount || 29.00, expiresAtStr]
      );

      return NextResponse.json({
        status: "ok",
        action: "plan_activated",
        user: userUpdate.rows[0],
        plan: plan_slug,
        expires_at: expiresAtStr,
        fake_payment_id: fakePaymentId,
      });

    } else if (type === "boost") {
      if (!object_id || !user_id) {
        return NextResponse.json({ error: "object_id e user_id são obrigatórios" }, { status: 400 });
      }

      const boostDays = parseInt(days || "7");
      const boostTypeVal = boost_type || "7d";
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + boostDays);
      const expiresAtStr = expiresAt.toISOString();
      const fakePaymentId = `test_boost_${Date.now()}`;

      // Inserir boost
      await query(
        `INSERT INTO boosts
           (object_id, user_id, type, status, amount_paid, provider, provider_ref, starts_at, expires_at, created_at)
         VALUES ($1, $2, $3, 'active', $4, 'mercadopago', $5, NOW(), $6, NOW())`,
        [object_id, user_id, boostTypeVal, amount || 9.90, fakePaymentId, expiresAtStr]
      );

      // Atualizar objeto
      const objUpdate = await query(
        `UPDATE objects
         SET is_boosted = true, boost_expires_at = $1, updated_at = NOW()
         WHERE id = $2
         RETURNING id, name, is_boosted, boost_expires_at`,
        [expiresAtStr, object_id]
      );

      return NextResponse.json({
        status: "ok",
        action: "boost_activated",
        object: objUpdate.rows[0] || null,
        boost_type: boostTypeVal,
        expires_at: expiresAtStr,
        fake_payment_id: fakePaymentId,
      });

    } else {
      return NextResponse.json({ error: "type deve ser 'plan' ou 'boost'" }, { status: 400 });
    }
  } catch (error) {
    console.error("Erro no teste de webhook:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
