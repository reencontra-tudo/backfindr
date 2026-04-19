import { NextRequest, NextResponse } from "next/server";
import { MercadoPagoConfig, Payment } from "mercadopago";
import { query } from "@/lib/db";

const getMP = () => {
  const token = process.env.MP_ACCESS_TOKEN;
  if (!token) throw new Error("MP_ACCESS_TOKEN não configurado");
  return new MercadoPagoConfig({ accessToken: token });
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { type, data } = body;

    // Mercado Pago envia notificações de diferentes tipos
    if (type !== "payment") {
      return NextResponse.json({ status: "ignored" });
    }

    const paymentId = data?.id;
    if (!paymentId) {
      return NextResponse.json({ error: "Payment ID ausente" }, { status: 400 });
    }

    // Buscar detalhes do pagamento na API do MP
    const client = getMP();
    const paymentClient = new Payment(client);
    let payment;
    try {
      payment = await paymentClient.get({ id: paymentId });
    } catch (fetchError) {
      // Pagamento não encontrado na API do MP — retornar 200 para evitar reenvios
      console.warn(`Pagamento ${paymentId} não encontrado na API MP:`, fetchError);
      return NextResponse.json({ status: "payment_not_found" });
    }

    if (!payment || payment.status !== "approved") {
      console.log(`Pagamento ${paymentId} não aprovado: ${payment?.status}`);
      return NextResponse.json({ status: "not_approved" });
    }

    const metadata = payment.metadata as Record<string, string> | undefined;
    if (!metadata) {
      return NextResponse.json({ status: "no_metadata" });
    }

    const paymentType = metadata.type;
    const userId = metadata.user_id;

    if (paymentType === "plan") {
      // Ativar plano do usuário
      const planSlug = metadata.plan_slug || metadata.plan_id;

      const expiresAt = new Date();
      expiresAt.setMonth(expiresAt.getMonth() + 1);
      const expiresAtStr = expiresAt.toISOString();

      // Atualizar usuário com o novo plano
      await query(
        `UPDATE users
         SET plan = $1,
             plan_expires_at = $2,
             mp_subscription_id = $3,
             subscription_provider = 'mercadopago',
             updated_at = NOW()
         WHERE id = $4`,
        [planSlug, expiresAtStr, `mp_${paymentId}`, userId]
      );

      // Registrar na tabela subscriptions
      await query(
        `INSERT INTO subscriptions
           (user_id, plan_slug, provider, provider_sub_id, status, amount_brl, started_at, expires_at, created_at)
         VALUES ($1, $2, 'mercadopago', $3, 'active', $4, NOW(), $5, NOW())`,
        [
          userId,
          planSlug,
          `mp_${paymentId}`,
          payment.transaction_amount || 0,
          expiresAtStr,
        ]
      );

      console.log(`✅ Plano ${planSlug} ativado para usuário ${userId}`);

    } else if (paymentType === "boost") {
      // Ativar boost para o objeto
      const objectId = metadata.object_id;
      const boostType = metadata.boost_type || metadata.type || "7d";
      const days = parseInt(metadata.days || "7");

      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + days);
      const expiresAtStr = expiresAt.toISOString();

      // Inserir boost na tabela
      await query(
        `INSERT INTO boosts
           (object_id, user_id, type, status, amount_paid, provider, provider_ref, starts_at, expires_at, created_at)
         VALUES ($1, $2, $3, 'active', $4, 'mercadopago', $5, NOW(), $6, NOW())`,
        [
          objectId,
          userId,
          boostType,
          payment.transaction_amount || 0,
          String(paymentId),
          expiresAtStr,
        ]
      );

      // Atualizar objeto como boosted
      await query(
        `UPDATE objects
         SET is_boosted = true, boost_expires_at = $1, updated_at = NOW()
         WHERE id = $2`,
        [expiresAtStr, objectId]
      );

      console.log(`✅ Boost ${boostType} ativado para objeto ${objectId}`);
    }

    return NextResponse.json({ status: "processed" });
  } catch (error) {
    // Retornar 200 mesmo em erro para evitar loop de reenvios do MP
    // O MP reenvia indefinidamente se receber 4xx/5xx
    console.error("Erro no webhook MP:", error);
    return NextResponse.json({ status: "error", message: "Erro interno processado" });
  }
}

// GET para validação do webhook pelo MP
export async function GET() {
  return NextResponse.json({ status: "ok" });
}
