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
    const payment = await paymentClient.get({ id: paymentId });

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
      const planId = metadata.plan_id;
      const planLimits: Record<string, number> = {
        pro: 50,
        business: 500,
      };

      const expiresAt = new Date();
      expiresAt.setMonth(expiresAt.getMonth() + 1);

      await query(
        `UPDATE users SET plan = ?, plan_expires_at = ?, stripe_subscription_id = ? WHERE id = ?`,
        [planId, expiresAt.toISOString().slice(0, 19).replace("T", " "), `mp_${paymentId}`, userId]
      );

      // Registrar na tabela subscriptions
      await query(
        `INSERT INTO subscriptions (user_id, provider, provider_subscription_id, plan_id, status, current_period_start, current_period_end, created_at)
         VALUES (?, 'mercadopago', ?, ?, 'active', NOW(), ?, NOW())
         ON DUPLICATE KEY UPDATE status = 'active', current_period_end = ?, updated_at = NOW()`,
        [userId, `mp_${paymentId}`, planId, expiresAt.toISOString().slice(0, 19).replace("T", " "), expiresAt.toISOString().slice(0, 19).replace("T", " ")]
      );

      console.log(`✅ Plano ${planId} ativado para usuário ${userId}`);

    } else if (paymentType === "boost") {
      // Ativar boost para o objeto
      const objectId = metadata.object_id;
      const boostType = metadata.boost_type;
      const days = parseInt(metadata.days || "7");

      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + days);

      await query(
        `INSERT INTO boosts (object_id, user_id, boost_type, payment_id, payment_provider, amount_paid, status, expires_at, created_at)
         VALUES (?, ?, ?, ?, 'mercadopago', ?, 'active', ?, NOW())
         ON DUPLICATE KEY UPDATE status = 'active', expires_at = ?, updated_at = NOW()`,
        [
          objectId, userId, boostType, String(paymentId),
          payment.transaction_amount || 0,
          expiresAt.toISOString().slice(0, 19).replace("T", " "),
          expiresAt.toISOString().slice(0, 19).replace("T", " ")
        ]
      );

      console.log(`✅ Boost ${boostType} ativado para objeto ${objectId}`);
    }

    return NextResponse.json({ status: "processed" });
  } catch (error) {
    console.error("Erro no webhook MP:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

// GET para validação do webhook pelo MP
export async function GET() {
  return NextResponse.json({ status: "ok" });
}
