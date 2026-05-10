export const dynamic = 'force-dynamic';
import { NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { verifyToken, extractTokenFromHeader } from '@/lib/jwt';
import { successResponse, unauthorizedResponse, errorResponse, internalErrorResponse } from '@/lib/response';

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = extractTokenFromHeader(authHeader);
    if (!token) return unauthorizedResponse();

    const payload = verifyToken(token);
    if (!payload) return unauthorizedResponse();

    // Verificar se o usuário tem plano business
    const userResult = await query(
      'SELECT id, plan FROM users WHERE id = $1',
      [payload.sub]
    );
    if (userResult.rows.length === 0) return unauthorizedResponse();

    const user = userResult.rows[0];
    if (user.plan !== 'business') {
      return errorResponse('Plano Business necessário para acessar este recurso', 403);
    }

    const userId = payload.sub;

    // Total de objetos do usuário
    const totalObjectsRes = await query(
      'SELECT COUNT(*) as count FROM objects WHERE user_id = $1',
      [userId]
    );

    // Objetos por status
    const byStatusRes = await query(
      `SELECT status, COUNT(*) as count FROM objects WHERE user_id = $1 GROUP BY status`,
      [userId]
    );

    // Objetos cadastrados nos últimos 30 dias
    const recentRes = await query(
      `SELECT COUNT(*) as count FROM objects WHERE user_id = $1 AND created_at >= NOW() - INTERVAL '30 days'`,
      [userId]
    );

    // Matches do usuário
    const matchesRes = await query(
      `SELECT COUNT(*) as count FROM matches m
       JOIN objects o ON (m.object_id = o.id OR m.matched_object_id = o.id)
       WHERE o.user_id = $1`,
      [userId]
    );

    // Matches confirmados (recuperações)
    const confirmedMatchesRes = await query(
      `SELECT COUNT(*) as count FROM matches m
       JOIN objects o ON (m.object_id = o.id OR m.matched_object_id = o.id)
       WHERE o.user_id = $1 AND m.status = 'confirmed'`,
      [userId]
    );

    // Objetos com QR Code escaneados (scan_count > 0)
    const scannedRes = await query(
      `SELECT COUNT(*) as count FROM objects WHERE user_id = $1 AND scan_count > 0`,
      [userId]
    );

    // Últimos 10 objetos cadastrados
    const recentObjectsRes = await query(
      `SELECT id, title, status, category, created_at, scan_count, qr_code
       FROM objects WHERE user_id = $1
       ORDER BY created_at DESC LIMIT 10`,
      [userId]
    );

    // Objetos por categoria
    const byCategoryRes = await query(
      `SELECT COALESCE(category, type, 'other') as category, COUNT(*) as count
       FROM objects WHERE user_id = $1
       GROUP BY COALESCE(category, type, 'other')
       ORDER BY count DESC`,
      [userId]
    );

    const totalObjects = parseInt(totalObjectsRes.rows[0].count);
    const confirmedMatches = parseInt(confirmedMatchesRes.rows[0].count);

    const statusMap: Record<string, number> = {};
    for (const row of byStatusRes.rows) {
      statusMap[row.status] = parseInt(row.count);
    }

    return successResponse({
      summary: {
        total_objects: totalObjects,
        recent_objects: parseInt(recentRes.rows[0].count),
        total_matches: parseInt(matchesRes.rows[0].count),
        confirmed_matches: confirmedMatches,
        recovery_rate: totalObjects > 0
          ? Math.round((confirmedMatches / totalObjects) * 100)
          : 0,
        scanned_objects: parseInt(scannedRes.rows[0].count),
      },
      by_status: statusMap,
      by_category: byCategoryRes.rows.map(r => ({
        category: r.category,
        count: parseInt(r.count),
      })),
      recent_objects: recentObjectsRes.rows,
    });
  } catch (error) {
    return internalErrorResponse(error);
  }
}
