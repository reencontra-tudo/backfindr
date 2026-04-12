export const dynamic = 'force-dynamic';
import { NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { verifyToken, extractTokenFromHeader } from '@/lib/jwt';
import { successResponse, unauthorizedResponse, internalErrorResponse } from '@/lib/response';

// Função de matching por similaridade de texto e localização
async function calculateMatchScore(lostObject: any, foundObject: any): Promise<number> {
  let score = 0;

  // Categoria igual (se disponível)
  if (lostObject.category && foundObject.category && lostObject.category === foundObject.category) {
    score += 30;
  }

  // Localização próxima
  if (lostObject.latitude && foundObject.latitude) {
    const latDiff = Math.abs(parseFloat(lostObject.latitude) - parseFloat(foundObject.latitude));
    const lonDiff = Math.abs(parseFloat(lostObject.longitude) - parseFloat(foundObject.longitude));
    const distance = Math.sqrt(latDiff * latDiff + lonDiff * lonDiff);

    if (distance < 0.05) score += 40; // ~5km
    else if (distance < 0.1) score += 20;
    else if (distance < 0.2) score += 10;
  } else {
    // Sem localização, dar pontuação parcial
    score += 20;
  }

  // Título similar
  if (lostObject.title && foundObject.title) {
    const lostWords = lostObject.title.toLowerCase().split(/\s+/);
    const foundWords = foundObject.title.toLowerCase().split(/\s+/);
    const commonWords = lostWords.filter((w: string) => w.length > 2 && foundWords.includes(w)).length;
    if (commonWords > 0) score += Math.min(20, commonWords * 10);
  }

  // Descrição similar
  if (lostObject.description && foundObject.description) {
    const lostWords = lostObject.description.toLowerCase().split(/\s+/);
    const foundWords = foundObject.description.toLowerCase().split(/\s+/);
    const commonWords = lostWords.filter((w: string) => w.length > 3 && foundWords.includes(w)).length;
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

    // Buscar objeto do usuário
    const objectResult = await query(
      'SELECT * FROM objects WHERE id = $1 AND user_id = $2',
      [objectId, payload.sub]
    );

    if (objectResult.rows.length === 0) {
      return successResponse({ detail: 'Object not found' }, 404);
    }

    const object = objectResult.rows[0];

    // Buscar objetos com status oposto (se lost, buscar found e vice-versa)
    const oppositeStatus = object.status === 'lost' ? 'found' : 'lost';
    
    // Buscar candidatos com status oposto, excluindo o próprio objeto
    let candidateQuery = `SELECT * FROM objects WHERE status = $1 AND id != $2`;
    const candidateParams: any[] = [oppositeStatus, objectId];
    
    // Se tiver categoria, filtrar por categoria
    if (object.category) {
      candidateQuery += ` AND (category = $3 OR category IS NULL)`;
      candidateParams.push(object.category);
    }
    
    const candidatesResult = await query(candidateQuery, candidateParams);

    const matches: any[] = [];

    for (const candidate of candidatesResult.rows) {
      const score = await calculateMatchScore(object, candidate);

      if (score >= 40) {
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
      candidates_checked: candidatesResult.rows.length,
    });
  } catch (error) {
    return internalErrorResponse(error);
  }
}
