// Webhook do Mercado Pago — ENDURECIDO (etapa 0 da reativação do Programa de Colaboradores, 24/11/2026). O que mudou em relação ao anterior:
//  1) ASSINATURA: com MP_WEBHOOK_SECRET definido, aviso sem assinatura válida = 401 e nada é processado. Sem o segredo, segue como antes (com aviso no log),
//     para não derrubar pagamentos enquanto o fundador não cola o segredo na Vercel.
//  2) IDEMPOTÊNCIA: o mesmo pagamento (boost ou plano) nunca ativa duas vezes (trava por pagamento dentro de uma transação + checagem do registro existente).
//  3) ERRO DE VERDADE: falha interna ou do Mercado Pago = 500 (o Mercado Pago reenvia; é seguro por causa da idempotência). Só casos permanentes
//     (pagamento inexistente, não aprovado, sem metadados, dono divergente) respondem 200.
//  4) ESTORNO/CANCELAMENTO/CONTESTAÇÃO: registrados no log e respondidos 200; o Boost NÃO muda (decisão do fundador, #4); a comissão vem na E4.
//  5) DONO: o boost só ativa se o objeto existe e pertence ao usuário do pagamento.
// Plano e Boost continuam funcionando como antes quando tudo está em ordem.
import { NextRequest, NextResponse } from "next/server";
import { MercadoPagoConfig, Payment } from "mercadopago";
import { getClient } from "@/lib/db";
import { Events } from "@/lib/events";
import { assinaturaValida } from "@/lib/mpAssinatura";

const getMP = () => {
  const token = process.env.MP_ACCESS_TOKEN;
  if (!token) throw new Error("MP_ACCESS_TOKEN não configurado");
  return new MercadoPagoConfig({ accessToken: token });
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PLANOS_VENDAVEIS = new Set(["pro", "business"]);
const STATUS_DE_ESTORNO = new Set(["refunded", "cancelled", "charged_back"]);

type Resultado = { status: string; evento?: { objectId: string; userId: string; boostType: string; valor: number } };

/** Ativa o plano ou o boost UMA ÚNICA VEZ por pagamento (trava + checagem + gravação na mesma transação). */
async function processarAprovado(paymentId: string, metadata: Record<string, string>, valor: number): Promise<Resultado> {
  const paymentType = metadata.type;
  const userId = metadata.user_id;
  const client = await getClient();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`mp:${paymentId}`]);

    if (paymentType === "plan") {
      const planSlug = metadata.plan_slug || metadata.plan_id;
      if (!planSlug || !PLANOS_VENDAVEIS.has(planSlug) || !userId || !UUID.test(userId)) {
        await client.query("ROLLBACK");
        console.error(`MP webhook: plano/usuário inválido no pagamento ${paymentId} (analisar manualmente)`);
        return { status: "invalid_plan_metadata" };
      }
      const ja = await client.query("SELECT 1 FROM subscriptions_p1 WHERE provider = 'mercadopago' AND provider_sub_id = $1 LIMIT 1", [`mp_${paymentId}`]);
      if (ja.rows.length > 0) { await client.query("COMMIT"); return { status: "already_processed" }; }

      const expiresAt = new Date(); expiresAt.setMonth(expiresAt.getMonth() + 1);
      const expiresAtStr = expiresAt.toISOString();
      const upd = await client.query(
        `UPDATE users SET plan = $1, plan_expires_at = $2, mp_subscription_id = $3, subscription_provider = 'mercadopago', updated_at = NOW() WHERE id = $4`,
        [planSlug, expiresAtStr, `mp_${paymentId}`, userId],
      );
      if (upd.rowCount === 0) { await client.query("ROLLBACK"); console.error(`MP webhook: usuário ${userId} não existe (pagamento ${paymentId})`); return { status: "user_not_found" }; }
      await client.query(
        `INSERT INTO subscriptions_p1 (user_id, plan_slug, provider, provider_sub_id, status, amount_brl, started_at, expires_at, created_at)
         VALUES ($1, $2, 'mercadopago', $3, 'active', $4, NOW(), $5, NOW())`,
        [userId, planSlug, `mp_${paymentId}`, valor, expiresAtStr],
      );
      await client.query("COMMIT");
      console.log(`✅ Plano ${planSlug} ativado para usuário ${userId}`);
      return { status: "processed" };
    }

    if (paymentType === "boost") {
      const objectId = metadata.object_id;
      const boostType = metadata.boost_type || metadata.type || "7d";
      const days = Math.min(Math.max(parseInt(metadata.days || "7", 10) || 7, 1), 90);
      if (!objectId || !UUID.test(objectId) || !userId || !UUID.test(userId)) {
        await client.query("ROLLBACK");
        console.error(`MP webhook: boost sem objeto/usuário válidos no pagamento ${paymentId} (analisar manualmente)`);
        return { status: "invalid_boost_metadata" };
      }
      const ja = await client.query("SELECT 1 FROM boosts WHERE provider = 'mercadopago' AND provider_ref = $1 LIMIT 1", [String(paymentId)]);
      if (ja.rows.length > 0) { await client.query("COMMIT"); return { status: "already_processed" }; }

      const dono = await client.query("SELECT user_id FROM objects WHERE id = $1", [objectId]);
      if (dono.rows.length === 0 || String(dono.rows[0].user_id) !== userId) {
        await client.query("ROLLBACK");
        console.error(`MP webhook: objeto ${objectId} não existe ou não pertence ao pagador ${userId} (pagamento ${paymentId}; analisar manualmente)`);
        return { status: "owner_mismatch" };
      }
      const expiresAt = new Date(); expiresAt.setDate(expiresAt.getDate() + days);
      const expiresAtStr = expiresAt.toISOString();
      await client.query(
        `INSERT INTO boosts (object_id, user_id, type, status, amount_paid, provider, provider_ref, starts_at, expires_at, created_at)
         VALUES ($1, $2, $3, 'active', $4, 'mercadopago', $5, NOW(), $6, NOW())`,
        [objectId, userId, boostType, valor, String(paymentId), expiresAtStr],
      );
      await client.query(`UPDATE objects SET is_boosted = true, boost_expires_at = $1, updated_at = NOW() WHERE id = $2`, [expiresAtStr, objectId]);
      await client.query("COMMIT");
      console.log(`✅ Boost ${boostType} ativado para objeto ${objectId}`);
      return { status: "processed", evento: { objectId, userId, boostType, valor } };
    }

    await client.query("ROLLBACK");
    return { status: "unknown_type" };
  } catch (e) {
    try { await client.query("ROLLBACK"); } catch { /* já encerrada */ }
    throw e;
  } finally {
    client.release();
  }
}

export async function POST(req: NextRequest) {
  try {
    let body: { type?: string; data?: { id?: string | number } } | null = null;
    try { body = await req.json(); } catch { return NextResponse.json({ error: "Corpo inválido" }, { status: 400 }); }
    const { type, data } = body ?? {};

    // 1) Assinatura (só exige quando o segredo está configurado)
    const segredo = process.env.MP_WEBHOOK_SECRET;
    const dataIdUrl = new URL(req.url).searchParams.get("data.id");
    const dataId = dataIdUrl ?? (data?.id !== undefined ? String(data.id) : null);
    if (segredo) {
      const ok = assinaturaValida({ xSignature: req.headers.get("x-signature"), xRequestId: req.headers.get("x-request-id"), dataId, segredo });
      if (!ok) {
        console.warn("MP webhook: assinatura inválida ou ausente — nada foi processado");
        return NextResponse.json({ error: "Assinatura inválida" }, { status: 401 });
      }
    } else {
      console.warn("MP webhook: MP_WEBHOOK_SECRET ausente — assinatura NÃO verificada");
    }

    if (type !== "payment") return NextResponse.json({ status: "ignored" });

    const paymentId = data?.id;
    if (!paymentId) return NextResponse.json({ error: "Payment ID ausente" }, { status: 400 });

    // 2) Detalhes do pagamento na API do MP: «não existe» é permanente (200); qualquer outra falha é transitória (500, o MP reenvia)
    const paymentClient = new Payment(getMP());
    let payment;
    try {
      payment = await paymentClient.get({ id: paymentId });
    } catch (fetchError) {
      const e = fetchError as { status?: number; cause?: { status?: number } };
      const codigo = e?.status ?? e?.cause?.status;
      if (codigo === 404) {
        console.warn(`Pagamento ${paymentId} não encontrado na API MP:`, fetchError);
        return NextResponse.json({ status: "payment_not_found" });
      }
      throw fetchError;
    }

    // 3) Estorno, cancelamento e contestação: só registrar (o Boost não muda; a comissão é tratada na E4)
    if (payment && STATUS_DE_ESTORNO.has(String(payment.status))) {
      console.warn(`MP webhook: pagamento ${paymentId} com status ${payment.status} registrado (sem alterar boost nem plano)`);
      return NextResponse.json({ status: "refund_noted" });
    }

    if (!payment || payment.status !== "approved") {
      console.log(`Pagamento ${paymentId} não aprovado: ${payment?.status}`);
      return NextResponse.json({ status: "not_approved" });
    }

    const metadata = payment.metadata as Record<string, string> | undefined;
    if (!metadata) return NextResponse.json({ status: "no_metadata" });

    // 4) Processar uma única vez
    const r = await processarAprovado(String(paymentId), metadata, Number(payment.transaction_amount) || 0);
    if (r.evento) {
      Events.boostStarted(r.evento.objectId, r.evento.userId, r.evento.boostType, r.evento.valor).catch(() => {});
    }
    return NextResponse.json({ status: r.status });
  } catch (error) {
    // Erro de verdade (500): o Mercado Pago reenvia; é seguro porque o processamento é idempotente.
    console.error("Erro no webhook MP:", error);
    return NextResponse.json({ status: "error", message: "Erro interno" }, { status: 500 });
  }
}

// GET para validação do webhook pelo MP
export async function GET() {
  return NextResponse.json({ status: "ok" });
}
