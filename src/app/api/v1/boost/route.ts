import { NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { verifyToken, extractTokenFromHeader } from '@/lib/jwt';
import { successResponse, errorResponse, internalErrorResponse } from '@/lib/response';

export const dynamic = 'force-dynamic';

// Preços padrão caso payment_settings não exista
const DEFAULT_PRICES: Record<string, number> = {
  '7d':    9.90,
  '30d':   24.90,
  'alert': 14.90,
};

async function getBoostPrices(): Promise<Record<string, number>> {
  try {
    const result = await query(
      `SELECT key, value FROM payment_settings WHERE key IN ('boost_price_7d','boost_price_30d','boost_alert_price')`
    );
    const prices = { ...DEFAULT_PRICES };
    for (const row of result.rows) {
      if (row.key === 'boost_price_7d')    prices['7d']    = parseFloat(row.value) || DEFAULT_PRICES['7d'];
      if (row.key === 'boost_price_30d')   prices['30d']   = parseFloat(row.value) || DEFAULT_PRICES['30d'];
      if (row.key === 'boost_alert_price') prices['alert'] = parseFloat(row.value) || DEFAULT_PRICES['alert'];
    }
    return prices;
  } catch {
    return DEFAULT_PRICES;
  }
}

// GET /api/v1/boost?object_id=xxx — status do boost de um objeto
export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization');
    const token = extractTokenFromHeader(authHeader);
    if (!token) return errorResponse('Unauthorized', 401);
    const payload = verifyToken(token);
    if (!payload) return errorResponse('Invalid token', 401);

    const objectId = req.nextUrl.searchParams.get('object_id');
    if (!objectId) return errorResponse('object_id required', 400);

    const [boostResult, pricesResult] = await Promise.all([
      query(
        `SELECT id, type, status, starts_at, expires_at, amount_paid
         FROM boosts
         WHERE object_id = $1 AND user_id = $2 AND status = 'active'
         ORDER BY expires_at DESC LIMIT 1`,
        [objectId, payload.sub]
      ),
      getBoostPrices(),
    ]);

    return successResponse({
      active_boost: boostResult.rows[0] || null,
      prices: pricesResult,
    });
  } catch (error) {
    return internalErrorResponse(error);
  }
}

// POST /api/v1/boost — criar boost (modo teste: aprova automaticamente)
export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization');
    const token = extractTokenFromHeader(authHeader);
    if (!token) return errorResponse('Unauthorized', 401);
    const payload = verifyToken(token);
    if (!payload) return errorResponse('Invalid token', 401);

    const body = await req.json();
    const { object_id, type } = body; // type: '7d' | '30d' | 'alert'

    if (!object_id || !type) return errorResponse('object_id e type são obrigatórios', 400);
    if (!['7d', '30d', 'alert'].includes(type)) return errorResponse('type inválido', 400);

    // Verificar se o objeto pertence ao usuário
    const objResult = await query(
      `SELECT id, title FROM objects WHERE id = $1 AND user_id = $2`,
      [object_id, payload.sub]
    );
    if (objResult.rows.length === 0) return errorResponse('Objeto não encontrado', 404);

    const prices = await getBoostPrices();
    const amount = prices[type];

    // Verificar se payments estão habilitados
    let paymentsEnabled = false;
    try {
      const settingResult = await query(
        `SELECT value FROM payment_settings WHERE key = 'payments_enabled'`
      );
      paymentsEnabled = settingResult.rows[0]?.value === 'true';
    } catch { /* tabela não existe ainda */ }

    if (!paymentsEnabled) {
      // Modo teste: aprovar automaticamente sem cobrança
      const daysMap: Record<string, number> = { '7d': 7, '30d': 30, 'alert': 7 };
      const days = daysMap[type] || 7;
      const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

      const boostResult = await query(
        `INSERT INTO boosts (object_id, user_id, type, status, amount_paid, provider, starts_at, expires_at)
         VALUES ($1, $2, $3, 'active', $4, 'test', NOW(), $5)
         RETURNING id, type, status, starts_at, expires_at`,
        [object_id, payload.sub, type, amount, expiresAt]
      );

      // Atualizar objeto como boosted
      await query(
        `UPDATE objects SET is_boosted = true, boost_expires_at = $1 WHERE id = $2`,
        [expiresAt, object_id]
      );

      return successResponse({
        boost: boostResult.rows[0],
        test_mode: true,
        message: 'Boost ativado em modo de teste (sem cobrança)',
      });
    }

    // Modo produção: redirecionar para checkout (Stripe ou MP)
    // TODO: implementar checkout real quando chaves forem configuradas
    return successResponse({
      checkout_url: `/pricing?boost=true&object_id=${object_id}&type=${type}`,
      amount,
      test_mode: false,
    });
  } catch (error) {
    return internalErrorResponse(error);
  }
}
