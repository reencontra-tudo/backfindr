import { NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { verifyToken, extractTokenFromHeader } from '@/lib/jwt';
import { successResponse, unauthorizedResponse, internalErrorResponse } from '@/lib/response';

// Função simplificada de matching (em produção seria mais sofisticada com IA)
async function calculateMatchScore(lostObject: any, foundObject: any): Promise<number> {
  let score = 0;

  // Tipo deve ser igual
  if (lostObject.type === foundObject.type) score += 40;

  // Localização próxima (simplificado)
  if (lostObject.latitude && foundObject.latitude) {
    const latDiff = Math.abs(lostObject.latitude - foundObject.latitude);
    const lonDiff = Math.abs(lostObject.longitude - foundObject.longitude);
    const distance = Math.sqrt(latDiff * latDiff + lonDiff * lonDiff);

    if (distance < 0.05) score += 40; // ~5km
    else if (distance < 0.1) score += 20;
  }

  // Descrição similar (simplificado)
  if (lostObject.description && foundObject.description) {
    const lostWords = lostObject.description.toLowerCase().split(' ');
    const foundWords = foundObject.description.toLowerCase().split(' ');
    const commonWords = lostWords.filter((w: string) => foundWords.includes(w)).length;
    const similarity = (commonWords / Math.max(lostWords.length, foundWords.length)) * 20;
    score += similarity;
  }

  return Math.min(100, Math.round(score));
}

export async function POST(request: NextRequest) {
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

    const body = await request.json();
    const { objectId } = body;

    if (!objectId) {
      return successResponse({ detail: 'objectId is required' }, 400);
    }

    // Buscar objeto
    const objectResult = await query(
      'SELECT * FROM objects WHERE id = $1 AND user_id = $2',
      [objectId, payload.sub]
    );

    if (objectResult.rows.length === 0) {
      return successResponse({ detail: 'Object not found' }, 404);
    }

    const object = objectResult.rows[0];

    // Buscar objetos com status oposto
    const oppositeStatus = object.status === 'lost' ? 'found' : 'lost';
    const candidatesResult = await query(
      `SELECT * FROM objects WHERE status = $1 AND type = $2 AND id != $3`,
      [oppositeStatus, object.type, objectId]
    );

    const matches: any[] = [];

    for (const candidate of candidatesResult.rows) {
      const score = await calculateMatchScore(object, candidate);

      if (score >= 60) {
        // Verificar se match já existe
        const existingMatch = await query(
          `SELECT id FROM matches 
           WHERE (lost_object_id = $1 AND found_object_id = $2) 
              OR (lost_object_id = $2 AND found_object_id = $1)`,
          [objectId, candidate.id]
        );

        if (existingMatch.rows.length === 0) {
          // Criar novo match
          const lostId = object.status === 'lost' ? objectId : candidate.id;
          const foundId = object.status === 'found' ? objectId : candidate.id;

          const matchResult = await query(
            `INSERT INTO matches (lost_object_id, found_object_id, score, status, created_at, updated_at)
             VALUES ($1, $2, $3, 'pending', NOW(), NOW())
             RETURNING *`,
            [lostId, foundId, score]
          );

          matches.push(matchResult.rows[0]);
        }
      }
    }

    return successResponse({
      message: `Matching completed. Found ${matches.length} potential matches.`,
      matches,
    });
  } catch (error) {
    return internalErrorResponse(error);
  }
}
