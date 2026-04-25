export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

const MIGRATION_SECRET = process.env.MIGRATION_SECRET || '';

/**
 * POST /api/v1/admin/fix-legacy-categories
 * Reclassifica categorias dos objetos legados do Webjetos que foram importados como 'other'.
 * Usa correspondência por palavras-chave no título para identificar a categoria correta.
 */
export async function POST(req: NextRequest) {
  // Autenticação via MIGRATION_SECRET
  let authorized = false;
  try {
    const body = await req.json().catch(() => ({})) as Record<string, unknown>;
    if (MIGRATION_SECRET && body.secret === MIGRATION_SECRET) {
      authorized = true;
    }
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!authorized) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const results: Record<string, number> = {};

  try {
    // ── 1. Veículos ──────────────────────────────────────────────────────────
    const vehicleKeywords = [
      'carro', 'moto', 'veículo', 'veiculo', 'automóvel', 'automov',
      'bicicleta', 'bike', 'caminhão', 'caminhao', 'pickup', 'ônibus', 'onibus',
      'honda', 'toyota', 'chevrolet', 'fiat', 'ford', 'volkswagen', ' vw ',
      'hyundai', 'nissan', 'renault', 'peugeot', 'citroën', 'citroen',
      'jeep', 'kawasaki', 'yamaha', 'suzuki', 'harley', 'ducati',
      'mercedes', 'audi', 'bmw', 'spin', 'corolla', 'civic', 'gol ',
      'uno ', 'palio', 'onix', 'hb20', 'kwid', 'mobi ', 'cobalt', 'cruze',
      'tracker', 'compass', 'renegade', 'strada', 'hilux', 'ranger',
      'saveiro', 'voyage', 'prisma', 'montana', 'zafira', 'kombi',
      'celta', 'sandero', 'punto', 'siena', 'fiesta', 'focus', 'ka ',
      'scooter', 'motocicleta', 'ciclomotor', 'triciclo', 'quadriciclo',
      'van ', 'utilitário', 'utilitario', 'reboque', 'carreta',
    ];

    const vehicleConditions = vehicleKeywords
      .map((_, i) => `LOWER(title) LIKE $${i + 1}`)
      .join(' OR ');
    const vehicleParams = vehicleKeywords.map(kw => `%${kw}%`);

    const vehicleRes = await query(
      `UPDATE objects
       SET category = 'vehicle', updated_at = NOW()
       WHERE is_legacy = true
         AND category = 'other'
         AND (${vehicleConditions})`,
      vehicleParams
    );
    results.vehicle = vehicleRes.rowCount ?? 0;

    // ── 2. Pets / Animais ────────────────────────────────────────────────────
    const petKeywords = [
      'cachorro', 'cão', 'cao ', 'gato', 'felino', 'canino', 'pet ',
      'animal', 'pássaro', 'passaro', 'ave ', 'papagaio', 'periquito',
      'hamster', 'coelho', 'tartaruga', 'cobra', 'lagarto', 'peixe',
      'cavalo', 'égua', 'egua', 'pônei', 'ponei', 'porco', 'ovelha',
      'vira-lata', 'viralata', 'labrador', 'golden', 'poodle', 'bulldog',
      'pastor', 'husky', 'pitbull', 'rottweiler', 'dachshund', 'shih',
      'yorkshire', 'maltês', 'maltes', 'pinscher', 'beagle', 'boxer',
      'siamês', 'siaes', 'persa ', 'maine', 'ragdoll', 'bengal',
    ];

    const petConditions = petKeywords
      .map((_, i) => `LOWER(title) LIKE $${i + 1}`)
      .join(' OR ');
    const petParams = petKeywords.map(kw => `%${kw}%`);

    const petRes = await query(
      `UPDATE objects
       SET category = 'pet', updated_at = NOW()
       WHERE is_legacy = true
         AND category = 'other'
         AND (${petConditions})`,
      petParams
    );
    results.pet = petRes.rowCount ?? 0;

    // ── 3. Eletrônicos ───────────────────────────────────────────────────────
    const electronicsKeywords = [
      'celular', 'smartphone', 'iphone', 'samsung', 'motorola', 'xiaomi',
      'notebook', 'laptop', 'computador', 'tablet', 'ipad', 'kindle',
      'câmera', 'camera', 'filmadora', 'drone', 'playstation', 'xbox',
      'nintendo', 'televisor', 'tv ', 'monitor', 'projetor', 'som ',
      'caixa de som', 'fone', 'headphone', 'headset', 'airpod',
      'macbook', 'apple watch', 'smartwatch', 'gps ', 'rádio', 'radio',
      'impressora', 'scanner', 'modem', 'roteador', 'hd externo',
    ];

    const electronicsConditions = electronicsKeywords
      .map((_, i) => `LOWER(title) LIKE $${i + 1}`)
      .join(' OR ');
    const electronicsParams = electronicsKeywords.map(kw => `%${kw}%`);

    const electronicsRes = await query(
      `UPDATE objects
       SET category = 'electronics', updated_at = NOW()
       WHERE is_legacy = true
         AND category = 'other'
         AND (${electronicsConditions})`,
      electronicsParams
    );
    results.electronics = electronicsRes.rowCount ?? 0;

    // ── 4. Documentos ────────────────────────────────────────────────────────
    const documentKeywords = [
      'documento', 'rg ', 'cpf ', 'cnh ', 'habilitação', 'habilitacao',
      'passaporte', 'carteira de trabalho', 'ctps', 'certidão', 'certidao',
      'título de eleitor', 'titulo de eleitor', 'cartão', 'cartao',
      'identidade', 'registro', 'diploma', 'certificado',
    ];

    const documentConditions = documentKeywords
      .map((_, i) => `LOWER(title) LIKE $${i + 1}`)
      .join(' OR ');
    const documentParams = documentKeywords.map(kw => `%${kw}%`);

    const documentRes = await query(
      `UPDATE objects
       SET category = 'document', updated_at = NOW()
       WHERE is_legacy = true
         AND category = 'other'
         AND (${documentConditions})`,
      documentParams
    );
    results.document = documentRes.rowCount ?? 0;

    // ── 5. Joias e Relógios ──────────────────────────────────────────────────
    const jewelryKeywords = [
      'joia', 'jóia', 'anel', 'pulseira', 'colar', 'brinco', 'relógio',
      'relogio', 'aliança', 'alianca', 'corrente', 'pingente', 'bracelete',
      'ouro', 'prata ', 'diamante', 'esmeralda', 'rubi', 'safira',
    ];

    const jewelryConditions = jewelryKeywords
      .map((_, i) => `LOWER(title) LIKE $${i + 1}`)
      .join(' OR ');
    const jewelryParams = jewelryKeywords.map(kw => `%${kw}%`);

    const jewelryRes = await query(
      `UPDATE objects
       SET category = 'jewelry', updated_at = NOW()
       WHERE is_legacy = true
         AND category = 'other'
         AND (${jewelryConditions})`,
      jewelryParams
    );
    results.jewelry = jewelryRes.rowCount ?? 0;

    // ── 6. Bolsas e Mochilas ─────────────────────────────────────────────────
    const bagKeywords = [
      'bolsa', 'mochila', 'carteira', 'mala ', 'sacola', 'pochete',
      'necessaire', 'pasta ', 'portfólio', 'portfolio',
    ];

    const bagConditions = bagKeywords
      .map((_, i) => `LOWER(title) LIKE $${i + 1}`)
      .join(' OR ');
    const bagParams = bagKeywords.map(kw => `%${kw}%`);

    const bagRes = await query(
      `UPDATE objects
       SET category = 'bag', updated_at = NOW()
       WHERE is_legacy = true
         AND category = 'other'
         AND (${bagConditions})`,
      bagParams
    );
    results.bag = bagRes.rowCount ?? 0;

    // ── 7. Chaves ────────────────────────────────────────────────────────────
    const keyKeywords = ['chave ', 'chaveiro', 'chaves '];

    const keyConditions = keyKeywords
      .map((_, i) => `LOWER(title) LIKE $${i + 1}`)
      .join(' OR ');
    const keyParams = keyKeywords.map(kw => `%${kw}%`);

    const keyRes = await query(
      `UPDATE objects
       SET category = 'keys', updated_at = NOW()
       WHERE is_legacy = true
         AND category = 'other'
         AND (${keyConditions})`,
      keyParams
    );
    results.keys = keyRes.rowCount ?? 0;

    // ── Totais ───────────────────────────────────────────────────────────────
    const totalUpdated = Object.values(results).reduce((a, b) => a + b, 0);

    // Contar quantos ainda ficaram como 'other'
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
    return NextResponse.json({ error: 'Erro ao reclassificar categorias', detail: String(e) }, { status: 500 });
  }
}
