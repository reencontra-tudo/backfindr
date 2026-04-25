export const dynamic = 'force-dynamic';
import { NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { verifyToken, extractTokenFromHeader } from '@/lib/jwt';
import { successResponse, unauthorizedResponse, internalErrorResponse } from '@/lib/response';
import { sendMatchAlertEmail } from '@/lib/email';

const MAX_RADIUS_KM = 50;

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function calculateMatchScore(obj: Record<string, unknown>, candidate: Record<string, unknown>): number {
  let score = 0;
  const objCat = obj.category || obj.type;
  const canCat = candidate.category || candidate.type;
  if (objCat && canCat && objCat === canCat) score += 30;

  const lat1 = parseFloat(obj.latitude as string);
  const lon1 = parseFloat(obj.longitude as string);
  const lat2 = parseFloat(candidate.latitude as string);
  const lon2 = parseFloat(candidate.longitude as string);

  if (!isNaN(lat1) && !isNaN(lat2)) {
    const distKm = haversineKm(lat1, lon1, lat2, lon2);
    if (distKm <= 2)       score += 40;
    else if (distKm <= 10) score += 30;
    else if (distKm <= 25) score += 15;
    else if (distKm <= 50) score += 5;
  } else {
    score += 15;
  }

  if (obj.title && candidate.title) {
    const w1 = (obj.title as string).toLowerCase().split(/\s+/).filter(w => w.length > 2);
    const w2 = new Set((candidate.title as string).toLowerCase().split(/\s+/).filter(w => w.length > 2));
    const common = w1.filter(w => w2.has(w)).length;
    if (common > 0) score += Math.min(20, common * 7);
  }

  if (obj.description && candidate.description) {
    const w1 = (obj.description as string).toLowerCase().split(/\s+/).filter(w => w.length > 3);
    const w2 = new Set((candidate.description as string).toLowerCase().split(/\s+/).filter(w => w.length > 3));
    const common = w1.filter(w => w2.has(w)).length;
    score += (common / Math.max(w1.length, 1)) * 10;
  }

  return Math.min(100, Math.round(score));
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = extractTokenFromHeader(authHeader);
    if (!token) return unauthorizedResponse();

    const payload = verifyToken(token);
    if (!payload) return unauthorizedResponse();

    const body = await request.json();
    const { objectId } = body;
    if (!objectId) return successResponse({ detail: 'objectId is required' }, 400);

    const objectResult = await query(
      'SELECT * FROM objects WHERE id = $1 AND user_id = $2',
      [objectId, payload.sub]
    );
    if (objectResult.rows.length === 0) return successResponse({ detail: 'Object not found' }, 404);

    const object = objectResult.rows[0];
    const oppositeStatus = object.status === 'lost' ? 'found' : 'lost';
    const lat = parseFloat(object.latitude);
    const lon = parseFloat(object.longitude);
    const hasLocation = !isNaN(lat) && !isNaN(lon);

    let candidateQuery: string;
    let candidateParams: unknown[];

    if (hasLocation) {
      candidateQuery = `
        SELECT *,
          (6371 * acos(LEAST(1.0,
            cos(radians($3)) * cos(radians(latitude::float)) *
            cos(radians(longitude::float) - radians($4)) +
            sin(radians($3)) * sin(radians(latitude::float))
          ))) AS distance_km
        FROM objects
        WHERE status = $1
          AND id != $2
          AND latitude IS NOT NULL
          AND longitude IS NOT NULL
          AND (
            6371 * acos(LEAST(1.0,
              cos(radians($3)) * cos(radians(latitude::float)) *
              cos(radians(longitude::float) - radians($4)) +
              sin(radians($3)) * sin(radians(latitude::float))
            ))
          ) <= $5
        ORDER BY distance_km ASC
        LIMIT 200
      `;
      candidateParams = [oppositeStatus, objectId, lat, lon, MAX_RADIUS_KM];
    } else if (object.category) {
      candidateQuery = `
        SELECT * FROM objects
        WHERE status = $1 AND id != $2
          AND (category = $3 OR type = $3)
        ORDER BY created_at DESC LIMIT 100
      `;
      candidateParams = [oppositeStatus, objectId, object.category];
    } else {
      candidateQuery = `
        SELECT * FROM objects
        WHERE status = $1 AND id != $2
        ORDER BY created_at DESC LIMIT 100
      `;
      candidateParams = [oppositeStatus, objectId];
    }

    const candidatesResult = await query(candidateQuery, candidateParams);
    const matches: Record<string, unknown>[] = [];

    for (const candidate of candidatesResult.rows) {
      const score = calculateMatchScore(object, candidate);
      if (score < 40) continue;

      const existingMatch = await query(
        `SELECT id FROM matches
         WHERE (lost_object_id = $1 AND found_object_id = $2)
            OR (lost_object_id = $2 AND found_object_id = $1)`,
        [objectId, candidate.id]
      );
      if (existingMatch.rows.length > 0) continue;

      const lostId  = object.status === 'lost'  ? objectId : candidate.id;
      const foundId = object.status === 'found' ? objectId : candidate.id;

      const matchResult = await query(
        `INSERT INTO matches (lost_object_id, found_object_id, score, status, created_at, updated_at)
         VALUES ($1, $2, $3, 'pending', NOW(), NOW())
         RETURNING *`,
        [lostId, foundId, score]
      );
      const newMatch = matchResult.rows[0];
      matches.push(newMatch);

      // ── Notificar o dono do objeto perdido por e-mail ────────────────────────────────
      try {
        // Buscar o dono do objeto perdido
        const lostObj = object.status === 'lost' ? object : candidate;
        const foundObj = object.status === 'found' ? object : candidate;
        const ownerResult = await query(
          `SELECT u.name, u.email FROM users u
           JOIN objects o ON o.user_id = u.id
           WHERE o.id = $1`,
          [lostObj.id]
        );
        if (ownerResult.rows.length > 0) {
          const owner = ownerResult.rows[0];
          // Enviar e-mail de forma assíncrona (não bloquear a resposta)
          sendMatchAlertEmail(
            { name: owner.name, email: owner.email },
            lostObj.title as string,
            newMatch.id,
            score,
            foundObj.title as string
          ).catch(err => console.error('[matching] Falha ao enviar e-mail de match:', err));
        }
      } catch (emailErr) {
        console.error('[matching] Erro ao buscar dono para notificação:', emailErr);
      }
    }

    return successResponse({
      message: `Matching concluido. ${matches.length} match(es) encontrado(s).`,
      matches,
      candidates_checked: candidatesResult.rows.length,
      search_radius_km: hasLocation ? MAX_RADIUS_KM : null,
    });
  } catch (error) {
    return internalErrorResponse(error);
  }
}
