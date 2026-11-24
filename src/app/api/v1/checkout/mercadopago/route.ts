import { NextRequest, NextResponse } from "next/server";
import { MercadoPagoConfig, Preference } from "mercadopago";
import { verifyToken } from "@/lib/jwt";
import { query } from "@/lib/db";
import { assinaturasPausadas, MSG_ASSINATURAS_PAUSADAS } from "@/lib/modoCrescimento";

const getMP = () => {
  const token = process.env.MP_ACCESS_TOKEN;
  if (!token) throw new Error("MP_ACCESS_TOKEN não configurado");
  return new MercadoPagoConfig({ accessToken: token });
};

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    const user = authHeader ? verifyToken(authHeader.replace("Bearer ", "")) : null;

    // Endurecimento (24/11/2026): exige LOGIN (antes aceitava usuário «anonymous»), tanto para plano quanto para boost.
    if (!user?.sub) {
      return NextResponse.json({ error: "Faça login para continuar." }, { status: 401 });
    }

    const body = await req.json();
    // Suportar ambas as nomenclaturas (planId / plan_slug, objectId / object_id, boostType / boost_type)
    const {
      type,
      planId,
      plan_slug,
      objectId,
      object_id,
      boostType,
      boost_type,
    } = body;

    const resolvedPlanId = planId || plan_slug;
    const resolvedObjectId = objectId || object_id;
    const resolvedBoostType = boostType || boost_type;

    // Definir itens baseado no tipo de checkout
    let items: Array<{
      id: string;
      title: string;
      description: string;
      quantity: number;
      unit_price: number;
      currency_id: string;
    }> = [];

    let metadata: Record<string, string> = {};

    if (type === "plan") {
      // Modo crescimento (PL-01): nenhuma nova assinatura de plano. O Boost continua funcionando.
      if (assinaturasPausadas()) {
        return NextResponse.json({ error: MSG_ASSINATURAS_PAUSADAS, codigo: "ASSINATURAS_PAUSADAS" }, { status: 403 });
      }
      // Checkout de plano de assinatura
      const planPrices: Record<string, { title: string; price: number }> = {
        pro: { title: "Backfindr Pro", price: 29.90 },
        business: { title: "Backfindr Business", price: 149.90 },
      };

      const plan = planPrices[resolvedPlanId];
      if (!plan) {
        return NextResponse.json({ error: "Plano inválido" }, { status: 400 });
      }

      items = [{
        id: `plan_${resolvedPlanId}`,
        title: plan.title,
        description: `Assinatura mensal do plano ${plan.title}`,
        quantity: 1,
        unit_price: plan.price,
        currency_id: "BRL",
      }];

      metadata = {
        type: "plan",
        plan_id: resolvedPlanId,
        user_id: user.sub,
      };
    } else if (type === "boost") {
      // Checkout de boost para objeto
      const boostPrices: Record<string, { title: string; price: number; days: number }> = {
        boost_7: { title: "Boost 7 dias", price: 9.90, days: 7 },
        boost_30: { title: "Boost 30 dias", price: 24.90, days: 30 },
        alert_area: { title: "Alerta de Área", price: 14.90, days: 7 },
      };

      const boost = boostPrices[resolvedBoostType];
      if (!boost) {
        return NextResponse.json({ error: "Tipo de boost inválido" }, { status: 400 });
      }

      // Endurecimento (24/11/2026): o objeto precisa existir E pertencer a quem está pagando (404 igual nos dois casos: não revela objeto alheio).
      if (!resolvedObjectId) {
        return NextResponse.json({ error: "Objeto não informado" }, { status: 400 });
      }
      const dono = await query(
        "SELECT 1 FROM objects WHERE id::text = $1 AND user_id::text = $2 AND status <> 'deleted' LIMIT 1",
        [String(resolvedObjectId), String(user.sub)],
      );
      if (dono.rows.length === 0) {
        return NextResponse.json({ error: "Objeto não encontrado" }, { status: 404 });
      }

      items = [{
        id: `boost_${resolvedBoostType}`,
        title: boost.title,
        description: `${boost.title} para seu objeto — aumenta visibilidade por ${boost.days} dias`,
        quantity: 1,
        unit_price: boost.price,
        currency_id: "BRL",
      }];

      metadata = {
        type: "boost",
        boost_type: resolvedBoostType,
        object_id: String(resolvedObjectId),
        user_id: user.sub,
        days: String(boost.days),
      };
    } else {
      return NextResponse.json({ error: "Tipo de checkout inválido" }, { status: 400 });
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://backfindr.com";

    const client = getMP();
    const preference = new Preference(client);

    const response = await preference.create({
      body: {
        items,
        metadata,
        back_urls: {
          success: `${appUrl}/checkout/success?type=${type}&ref=${resolvedPlanId || resolvedBoostType}`,
          failure: `${appUrl}/checkout/failure`,
          pending: `${appUrl}/checkout/pending`,
        },
        auto_return: "approved",
        notification_url: `${appUrl}/api/v1/webhooks/mercadopago`,
        statement_descriptor: "BACKFINDR",
        payment_methods: {
          excluded_payment_types: [],
          installments: 1,
        },
      },
    });

    // Em modo teste (credenciais TEST-), usar sandbox_init_point
    const isSandbox = (process.env.MP_ACCESS_TOKEN || "").startsWith("TEST-");
    const url = isSandbox ? response.sandbox_init_point : response.init_point;

    return NextResponse.json({
      id: response.id,
      url,
      init_point: response.init_point,
      sandbox_init_point: response.sandbox_init_point,
    });
  } catch (error) {
    console.error("Erro no checkout MP:", error);
    return NextResponse.json(
      { error: "Erro ao criar preferência de pagamento" },
      { status: 500 }
    );
  }
}
