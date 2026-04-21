export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminGuard';
import { query } from '@/lib/db';

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
  const objWords = String(obj.title || '').toLowerCase().split(/\s+/).filter(Boolean);
  const canWords = String(candidate.title || '').toLowerCase().split(/\s+/).filter(Boolean);
  const commonWords = objWords.filter(w => w.length > 3 && canWords.includes(w));
  if (commonWords.length > 0) score += Math.min(20, commonWords.length * 7);
  if (obj.color && candidate.color && obj.color === candidate.color) score += 10;
  if (obj.brand && candidate.brand && obj.brand === candidate.brand) score += 10;
  return Math.min(100, score);
}

// ─── POST /api/v1/admin/matching/run-all ──────────────────────────────────────
export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;

  try {
    // Busca todos os objetos perdidos sem match pendente/confirmado
    const lostObjects = await query(
      `SELECT o.* FROM objects o
       WHERE o.status = 'lost'
         AND NOT EXISTS (
           SELECT 1 FROM matches m
           WHERE m.lost_object_id = o.id
             AND m.status IN ('pending', 'confirmed')
         )
       ORDER BY o.created_at DESC
       LIMIT 200`,
      []
    );

    let totalCreated = 0;
    let totalChecked = 0;

    for (const object of lostObjects.rows) {
      const lat = parseFloat(object.latitude);
      const lon = parseFloat(object.longitude);
      const hasLocation = !isNaN(lat) && !isNaN(lon);

      let candidateQuery: string;
      let candidateParams: unknown[];

      if (hasLocation) {
        candidateQuery = `
          SELECT * FROM objects
          WHERE status = 'found'
            AND id != $1
            AND latitude IS NOT NULL AND longitude IS NOT NULL
            AND (
              6371 * acos(LEAST(1.0,
                cos(radians($2)) * cos(radians(latitude::float)) *
                cos(radians(longitude::float) - radians($3)) +
                sin(radians($2)) * sin(radians(latitude::float))
              ))
            ) <= $4
          ORDER BY created_at DESC LIMIT 100
        `;
        candidateParams = [object.id, lat, lon, MAX_RADIUS_KM];
      } else if (object.category) {
        candidateQuery = `
          SELECT * FROM objects
          WHERE status = 'found' AND id != $1
            AND (category = $2 OR type = $2)
          ORDER BY created_at DESC LIMIT 50
        `;
        candidateParams = [object.id, object.category];
      } else {
        continue; // sem localização e sem categoria, pula
      }

      const candidates = await query(candidateQuery, candidateParams);
      totalChecked += candidates.rows.length;

      for (const candidate of candidates.rows) {
        const score = calculateMatchScore(object, candidate);
        if (score < 40) continue;

        // Verifica se já existe match entre esses dois objetos
        const existing = await query(
          `SELECT id FROM matches
           WHERE (lost_object_id = $1 AND found_object_id = $2)
              OR (lost_object_id = $2 AND found_object_id = $1)`,
          [object.id, candidate.id]
        );
        if (existing.rows.length > 0) continue;

        await query(
          `INSERT INTO matches (lost_object_id, found_object_id, score, status, created_at, updated_at)
           VALUES ($1, $2, $3, 'pending', NOW(), NOW())`,
          [object.id, candidate.id, score]
        );
        totalCreated++;
      }
    }

    return NextResponse.json({
      message: `Matching completo. ${totalCreated} match(es) criado(s) de ${totalChecked} candidatos verificados.`,
      matches_created: totalCreated,
      candidates_checked: totalChecked,
      objects_processed: lostObjects.rows.length,
    });
  } catch (e) {
    console.error('[admin/matching/run-all]', e);
    return NextResponse.json({ detail: 'Erro ao rodar matching' }, { status: 500 });
  }
}
