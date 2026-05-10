export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

const MIGRATION_SECRET = process.env.MIGRATION_SECRET || '';

/**
 * POST /api/v1/admin/fix-legacy-categories
 * Reclassifica categorias dos objetos legados do Webjetos que foram importados como 'other'.
 * Usa ILIKE hardcoded para evitar limite de parâmetros do PostgreSQL.
 */
export async function POST(req: NextRequest) {
  let authorized = false;
  try {
    const body = await req.json().catch(() => ({})) as Record<string, unknown>;
    if (MIGRATION_SECRET && body.secret === MIGRATION_SECRET) authorized = true;
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!authorized) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const results: Record<string, number> = {};

  try {
    // ── 1. Veículos ──────────────────────────────────────────────────────────
    const vehicleRes = await query(`
      UPDATE objects SET category = 'vehicle', updated_at = NOW()
      WHERE is_legacy = true AND category = 'other'
        AND (
          title ILIKE '%carro%' OR title ILIKE '%moto%' OR title ILIKE '%veículo%'
          OR title ILIKE '%veiculo%' OR title ILIKE '%automóvel%' OR title ILIKE '%automov%'
          OR title ILIKE '%bicicleta%' OR title ILIKE '%caminhão%' OR title ILIKE '%caminhao%'
          OR title ILIKE '%pickup%' OR title ILIKE '%ônibus%' OR title ILIKE '%onibus%'
          OR title ILIKE '%honda%' OR title ILIKE '%toyota%' OR title ILIKE '%chevrolet%'
          OR title ILIKE '%fiat%' OR title ILIKE '%ford %' OR title ILIKE '%volkswagen%'
          OR title ILIKE '% vw %' OR title ILIKE '%hyundai%' OR title ILIKE '%nissan%'
          OR title ILIKE '%renault%' OR title ILIKE '%peugeot%' OR title ILIKE '%citroen%'
          OR title ILIKE '%citroën%' OR title ILIKE '%jeep%' OR title ILIKE '%kawasaki%'
          OR title ILIKE '%yamaha%' OR title ILIKE '%suzuki%' OR title ILIKE '%harley%'
          OR title ILIKE '%ducati%' OR title ILIKE '%mercedes%' OR title ILIKE '%audi%'
          OR title ILIKE '%spin%' OR title ILIKE '%corolla%' OR title ILIKE '%civic%'
          OR title ILIKE '% gol %' OR title ILIKE '% uno %' OR title ILIKE '%palio%'
          OR title ILIKE '%onix%' OR title ILIKE '%hb20%' OR title ILIKE '%kwid%'
          OR title ILIKE '%cobalt%' OR title ILIKE '%cruze%' OR title ILIKE '%tracker%'
          OR title ILIKE '%compass%' OR title ILIKE '%renegade%' OR title ILIKE '%strada%'
          OR title ILIKE '%hilux%' OR title ILIKE '%ranger%' OR title ILIKE '%saveiro%'
          OR title ILIKE '%voyage%' OR title ILIKE '%prisma%' OR title ILIKE '%montana%'
          OR title ILIKE '%zafira%' OR title ILIKE '%kombi%' OR title ILIKE '%celta%'
          OR title ILIKE '%sandero%' OR title ILIKE '%punto%' OR title ILIKE '%siena%'
          OR title ILIKE '%fiesta%' OR title ILIKE '% ka %' OR title ILIKE '%scooter%'
          OR title ILIKE '%motocicleta%' OR title ILIKE '%caminhonete%'
          OR title ILIKE '%camionete%' OR title ILIKE '%utilitário%'
          OR title ILIKE '%furto veiculo%' OR title ILIKE '%roubo veiculo%'
          OR title ILIKE '%bike%' OR title ILIKE '%tornado%' OR title ILIKE '%fusca%'
          OR title ILIKE '%corsa%' OR title ILIKE '%astra%' OR title ILIKE '%vectra%'
          OR title ILIKE '%marea%' OR title ILIKE '%stilo%' OR title ILIKE '%bravo%'
          OR title ILIKE '%ducato%' OR title ILIKE '%kangoo%' OR title ILIKE '%scenic%'
          OR title ILIKE '%megane%' OR title ILIKE '%206%' OR title ILIKE '%307%'
          OR title ILIKE '%308%' OR title ILIKE '%c3 %' OR title ILIKE '%c4 %'
          OR title ILIKE '%xsara%' OR title ILIKE '%berlingo%' OR title ILIKE '%golf%'
          OR title ILIKE '%polo%' OR title ILIKE '%fox %' OR title ILIKE '%fusca%'
          OR title ILIKE '%mb1620%' OR title ILIKE '%mb%placa%' OR title ILIKE '%placa%'
          OR title ILIKE '%caçamba%' OR title ILIKE '%carreta%' OR title ILIKE '%reboque%'
          OR title ILIKE '%titan%' OR title ILIKE '%fan 160%' OR title ILIKE '%nxr%'
          OR title ILIKE '%xre%' OR title ILIKE '%pcx%' OR title ILIKE '%biz%'
          OR title ILIKE '%pop 110%' OR title ILIKE '%cg 150%' OR title ILIKE '%cg 125%'
          OR title ILIKE '%fazer%' OR title ILIKE '%lander%' OR title ILIKE '%tenere%'
          OR title ILIKE '%gs500%' OR title ILIKE '%cb 300%' OR title ILIKE '%twister%'
          OR title ILIKE '%bros%' OR title ILIKE '%nx350%'
          OR title ILIKE '%porsche%' OR title ILIKE '%porshe%' OR title ILIKE '%boxster%'
          OR title ILIKE '%ecosport%' OR title ILIKE '%eco sport%' OR title ILIKE '%tucson%'
          OR title ILIKE '%creta%' OR title ILIKE '%t-cross%' OR title ILIKE '%tcross%'
          OR title ILIKE '%nivus%' OR title ILIKE '%kicks%' OR title ILIKE '%duster%'
          OR title ILIKE '%captur%' OR title ILIKE '%hr-v%' OR title ILIKE '%hrv%'
          OR title ILIKE '%cr-v%' OR title ILIKE '%crv%' OR title ILIKE '%fit %'
          OR title ILIKE '%accord%' OR title ILIKE '%camry%' OR title ILIKE '%etios%'
          OR title ILIKE '%yaris%' OR title ILIKE '%sw4%' OR title ILIKE '%rav4%'
          OR title ILIKE '%land cruiser%' OR title ILIKE '%pajero%' OR title ILIKE '%outlander%'
          OR title ILIKE '%l200%' OR title ILIKE '%triton%' OR title ILIKE '%frontier%'
          OR title ILIKE '%amarok%' OR title ILIKE '%s10%' OR title ILIKE '%d20%'
          OR title ILIKE '%d10%' OR title ILIKE '%versa%' OR title ILIKE '%march%'
          OR title ILIKE '%logan%' OR title ILIKE '%fluence%' OR title ILIKE '%duster%'
          OR title ILIKE '%peças automotivas%' OR title ILIKE '%automovel%'
        )
    `);
    results.vehicle = vehicleRes.rowCount ?? 0;

    // ── 2. Pets / Animais ────────────────────────────────────────────────────
    const petRes = await query(`
      UPDATE objects SET category = 'pet', updated_at = NOW()
      WHERE is_legacy = true AND category = 'other'
        AND (
          title ILIKE '%cachorro%' OR title ILIKE '% cão %' OR title ILIKE '%gato%'
          OR title ILIKE '%felino%' OR title ILIKE '%canino%' OR title ILIKE '% pet %'
          OR title ILIKE '%animal%' OR title ILIKE '%pássaro%' OR title ILIKE '%passaro%'
          OR title ILIKE '%papagaio%' OR title ILIKE '%periquito%' OR title ILIKE '%hamster%'
          OR title ILIKE '%coelho%' OR title ILIKE '%tartaruga%' OR title ILIKE '%labrador%'
          OR title ILIKE '%golden%' OR title ILIKE '%poodle%' OR title ILIKE '%bulldog%'
          OR title ILIKE '%pastor%' OR title ILIKE '%pitbull%' OR title ILIKE '%rottweiler%'
          OR title ILIKE '%dachshund%' OR title ILIKE '%yorkshire%' OR title ILIKE '%pinscher%'
          OR title ILIKE '%beagle%' OR title ILIKE '%siamês%' OR title ILIKE '%siaes%'
          OR title ILIKE '%cadela%' OR title ILIKE '%cachorra%' OR title ILIKE '%gatinho%'
          OR title ILIKE '%gatinha%' OR title ILIKE '%filhote%' OR title ILIKE '%procura-se%'
          OR title ILIKE '%vira-lata%' OR title ILIKE '%viralata%'
          OR title ILIKE '%lhasa%' OR title ILIKE '%apso%' OR title ILIKE '%spitz%'
          OR title ILIKE '%schnauzer%' OR title ILIKE '%cocker%' OR title ILIKE '%dálmata%'
          OR title ILIKE '%dalmata%' OR title ILIKE '%chow%' OR title ILIKE '%akita%'
          OR title ILIKE '%shiba%' OR title ILIKE '%pug%' OR title ILIKE '%buldogue%'
          OR title ILIKE '%desaparecida%' OR title ILIKE '%desaparecido%'
        )
    `);
    results.pet = petRes.rowCount ?? 0;

    // ── 3. Eletrônicos ───────────────────────────────────────────────────────
    const electronicsRes = await query(`
      UPDATE objects SET category = 'electronics', updated_at = NOW()
      WHERE is_legacy = true AND category = 'other'
        AND (
          title ILIKE '%celular%' OR title ILIKE '%smartphone%' OR title ILIKE '%iphone%'
          OR title ILIKE '%samsung%' OR title ILIKE '%motorola%' OR title ILIKE '%xiaomi%'
          OR title ILIKE '%notebook%' OR title ILIKE '%laptop%' OR title ILIKE '%computador%'
          OR title ILIKE '%tablet%' OR title ILIKE '%ipad%' OR title ILIKE '%câmera%'
          OR title ILIKE '%camera%' OR title ILIKE '%filmadora%' OR title ILIKE '%drone%'
          OR title ILIKE '%playstation%' OR title ILIKE '%xbox%' OR title ILIKE '%nintendo%'
          OR title ILIKE '%televisor%' OR title ILIKE '% tv %' OR title ILIKE '%monitor%'
          OR title ILIKE '%projetor%' OR title ILIKE '%fone%' OR title ILIKE '%headphone%'
          OR title ILIKE '%macbook%' OR title ILIKE '%smartwatch%' OR title ILIKE '%airpod%'
          OR title ILIKE '%impressora%' OR title ILIKE '%hd externo%' OR title ILIKE '%eletrônicos%'
          OR title ILIKE '%eletronicos%' OR title ILIKE '%dermatoscópio%'
          OR title ILIKE '%dermatoscopio%' OR title ILIKE '%equipamento%'
          OR title ILIKE '%aparelho%' OR title ILIKE '%geladeira%' OR title ILIKE '%refrigerador%'
        )
    `);
    results.electronics = electronicsRes.rowCount ?? 0;

    // ── 4. Documentos ────────────────────────────────────────────────────────
    const documentRes = await query(`
      UPDATE objects SET category = 'document', updated_at = NOW()
      WHERE is_legacy = true AND category = 'other'
        AND (
          title ILIKE '%documento%' OR title ILIKE '% rg %' OR title ILIKE '% cpf %'
          OR title ILIKE '% cnh %' OR title ILIKE '%habilitação%' OR title ILIKE '%habilitacao%'
          OR title ILIKE '%passaporte%' OR title ILIKE '%carteira de trabalho%'
          OR title ILIKE '%certidão%' OR title ILIKE '%certidao%'
          OR title ILIKE '%título de eleitor%' OR title ILIKE '%titulo de eleitor%'
          OR title ILIKE '%identidade%' OR title ILIKE '%diploma%' OR title ILIKE '%certificado%'
        )
    `);
    results.document = documentRes.rowCount ?? 0;

    // ── 5. Joias e Relógios ──────────────────────────────────────────────────
    const jewelryRes = await query(`
      UPDATE objects SET category = 'jewelry', updated_at = NOW()
      WHERE is_legacy = true AND category = 'other'
        AND (
          title ILIKE '%joia%' OR title ILIKE '%jóia%' OR title ILIKE '% anel %'
          OR title ILIKE '%pulseira%' OR title ILIKE '% colar %' OR title ILIKE '%brinco%'
          OR title ILIKE '%relógio%' OR title ILIKE '%relogio%' OR title ILIKE '%aliança%'
          OR title ILIKE '%alianca%' OR title ILIKE '%corrente%' OR title ILIKE '%pingente%'
          OR title ILIKE '%bracelete%' OR title ILIKE '% ouro %' OR title ILIKE '% prata %'
          OR title ILIKE '%diamante%' OR title ILIKE '%esmeralda%' OR title ILIKE '%rubi%'
        )
    `);
    results.jewelry = jewelryRes.rowCount ?? 0;

    // ── 6. Bolsas e Mochilas ─────────────────────────────────────────────────
    const bagRes = await query(`
      UPDATE objects SET category = 'bag', updated_at = NOW()
      WHERE is_legacy = true AND category = 'other'
        AND (
          title ILIKE '%bolsa%' OR title ILIKE '%mochila%' OR title ILIKE '%carteira%'
          OR title ILIKE '% mala %' OR title ILIKE '%sacola%' OR title ILIKE '%pochete%'
          OR title ILIKE '%necessaire%' OR title ILIKE '% pasta %'
        )
    `);
    results.bag = bagRes.rowCount ?? 0;

    // ── 7. Chaves ────────────────────────────────────────────────────────────
    const keysRes = await query(`
      UPDATE objects SET category = 'keys', updated_at = NOW()
      WHERE is_legacy = true AND category = 'other'
        AND (
          title ILIKE '%chave %' OR title ILIKE '%chaveiro%' OR title ILIKE '%chaves%'
        )
    `);
    results.keys = keysRes.rowCount ?? 0;

    const totalUpdated = Object.values(results).reduce((a, b) => a + b, 0);

    const remainingRes = await query(
      `SELECT COUNT(*) FROM objects WHERE is_legacy = true AND category = 'other'`
    );
    const remaining = parseInt(remainingRes.rows[0].count, 10);

    return NextResponse.json({
      success: true,
      updated: results,
      total_updated: totalUpdated,
      remaining_other: remaining,
      message: `${totalUpdated} objetos reclassificados. ${remaining} ainda como 'other'.`,
    });

  } catch (e) {
    console.error('[fix-legacy-categories]', e);
    return NextResponse.json({ error: 'Erro ao reclassificar', detail: String(e) }, { status: 500 });
  }
}
