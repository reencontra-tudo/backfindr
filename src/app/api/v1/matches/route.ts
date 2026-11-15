export const dynamic = 'force-dynamic';
import { NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { verifyToken, extractTokenFromHeader } from '@/lib/jwt';
import { maskSignalForPublicApi } from '@/lib/objectPublicView';
import { successResponse, unauthorizedResponse, internalErrorResponse } from '@/lib/response';

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

    // Buscar matches do usuário
    const result = await query(
      `SELECT m.id, m.lost_object_id, m.found_object_id, m.score, m.status, m.created_at, m.updated_at,
              lo.title as lost_title, lo.description as lost_description,
              fo.title as found_title, fo.description as found_description,
              lo.source as _lost_source, fo.source as _found_source
       FROM matches m
       LEFT JOIN objects lo ON m.lost_object_id = lo.id
       LEFT JOIN objects fo ON m.found_object_id = fo.id
       WHERE lo.user_id = $1 OR fo.user_id = $1
       ORDER BY m.created_at DESC`,
      [payload.sub]
    );

    // Objeto de SINAL PÚBLICO (perdido ou achado) sai com título e descrição mascarados; usuário e legado idênticos. As colunas `_..._source`
    // só servem para decidir e não vão na resposta.
    const matches = result.rows.map((row: Record<string, unknown>) => {
      const { _lost_source, _found_source, ...resto } = row;
      const lost = maskSignalForPublicApi({ source: _lost_source, title: resto.lost_title, description: resto.lost_description });
      const found = maskSignalForPublicApi({ source: _found_source, title: resto.found_title, description: resto.found_description });
      return { ...resto, lost_title: lost.title, lost_description: lost.description, found_title: found.title, found_description: found.description };
    });
    return successResponse({
      matches,
      total: matches.length,
    });
  } catch (error) {
    return internalErrorResponse(error);
  }
}
