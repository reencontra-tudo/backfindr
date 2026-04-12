import { NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { verifyToken, extractTokenFromHeader } from '@/lib/jwt';
import { successResponse, unauthorizedResponse, internalErrorResponse } from '@/lib/response';

// Verificar se é admin (simplificado - em produção seria mais robusto)
const ADMIN_IDS = process.env.ADMIN_IDS?.split(',') || [];

export async function GET(request: NextRequest) {
  try {
    // Extrair token do header
    const authHeader = request.headers.get('authorization');
    const token = extractTokenFromHeader(authHeader);

    if (!token) {
      return unauthorizedResponse();
    }

    // Verificar token
    const payload = verifyToken(token);
    if (!payload) {
      return unauthorizedResponse();
    }

    // Verificar se é admin
    if (!ADMIN_IDS.includes(payload.sub)) {
      return unauthorizedResponse();
    }

    // Buscar estatísticas
    const totalUsersResult = await query('SELECT COUNT(*) as count FROM users');
    const totalObjectsResult = await query('SELECT COUNT(*) as count FROM objects');
    const lostObjectsResult = await query("SELECT COUNT(*) as count FROM objects WHERE status = 'lost'");
    const foundObjectsResult = await query("SELECT COUNT(*) as count FROM objects WHERE status = 'found'");
    const totalMatchesResult = await query('SELECT COUNT(*) as count FROM matches');
    const confirmedMatchesResult = await query("SELECT COUNT(*) as count FROM matches WHERE status = 'confirmed'");

    return successResponse({
      total_users: parseInt(totalUsersResult.rows[0].count),
      total_objects: parseInt(totalObjectsResult.rows[0].count),
      lost_objects: parseInt(lostObjectsResult.rows[0].count),
      found_objects: parseInt(foundObjectsResult.rows[0].count),
      total_matches: parseInt(totalMatchesResult.rows[0].count),
      confirmed_matches: parseInt(confirmedMatchesResult.rows[0].count),
      recovery_rate: totalObjectsResult.rows[0].count > 0 
        ? (parseInt(confirmedMatchesResult.rows[0].count) / parseInt(totalObjectsResult.rows[0].count) * 100).toFixed(2)
        : 0,
    });
  } catch (error) {
    return internalErrorResponse(error);
  }
}
