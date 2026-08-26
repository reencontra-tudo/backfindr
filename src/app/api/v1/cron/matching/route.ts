export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { Events } from '@/lib/events';
import { sendMatchAlertEmail } from '@/lib/email';
import { sendPushToUser, matchPayload } from '@/lib/pushNotification';
import { calculateMatchScore as calculateMatchScoreBase } from '@/lib/matching';

const MAX_RADIUS_KM = 50;
const SCORE_MIN = 40;
const CRON_INTERVAL_MINUTES = 15;

// Consolidado em 26/08/2026 em src/lib/matching.ts — mantém exatamente o
// mesmo comportamento de antes (sem sinônimo/descrição/marca), só sem a
// lógica duplicada localmente. Ver comentário completo no módulo.
function calculateScore(obj: Record<string, unknown>, candidate: Record<string, unknown>): number {
  return calculateMatchScoreBase(obj, candidate);
}

// GET — chamado pelo Vercel Cron
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  // Fail-closed (25/08/2026, rotação do CRON_SECRET): o fallback hardcoded
  // 'backfindr-cron-secret' era público no código-fonte — qualquer deploy
  // sem CRON_SECRET configurado ficava protegido só por uma string
  // conhecida. Sem CRON_SECRET, a rota recusa qualquer chamada.
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const startedAt = new Date();
  let totalMatches = 0;
  let totalObjects = 0;

  try {
    // Busca objetos lost/stolen sem match recente (última hora)
    const objects = await query(
      `SELECT * FROM objects
       WHERE status IN ('lost', 'stolen')
         AND NOT EXISTS (
           SELECT 1 FROM matches m
           WHERE m.lost_object_id = id
             AND m.status IN ('pending', 'confirmed')
         )
       ORDER BY created_at DESC
       LIMIT 100`,
      []
    );

    totalObjects = objects.rows.length;

    for (const object of objects.rows) {
      // ── Evento: matching iniciado ───────────────────────────────────
      Events.matchingStarted(object.id as string).catch(() => {});

      const lat = parseFloat(object.latitude);
      const lon = parseFloat(object.longitude);
      const hasLocation = !isNaN(lat) && !isNaN(lon);

      let candidateQuery: string;
      let candidateParams: unknown[];

      if (hasLocation) {
        candidateQuery = `
          SELECT * FROM objects
          WHERE status = 'found' AND id != $1
            AND latitude IS NOT NULL AND longitude IS NOT NULL
            AND (6371 * acos(LEAST(1.0,
              cos(radians($2)) * cos(radians(latitude::float)) *
              cos(radians(longitude::float) - radians($3)) +
              sin(radians($2)) * sin(radians(latitude::float))
            ))) <= $4
          ORDER BY created_at DESC LIMIT 100`;
        candidateParams = [object.id, lat, lon, MAX_RADIUS_KM];
      } else if (object.category) {
        candidateQuery = `
          SELECT * FROM objects
          WHERE status = 'found' AND id != $1
            AND (category = $2 OR type = $2)
          ORDER BY created_at DESC LIMIT 50`;
        candidateParams = [object.id, object.category];
      } else {
        Events.matchingCompleted(object.id as string, 0).catch(() => {});
        continue;
      }

      const candidates = await query(candidateQuery, candidateParams);
      let objectMatches = 0;

      for (const candidate of candidates.rows) {
        const score = calculateScore(object, candidate);
        if (score < SCORE_MIN) continue;

        const existing = await query(
          `SELECT id FROM matches
           WHERE (lost_object_id = $1 AND found_object_id = $2)
              OR (lost_object_id = $2 AND found_object_id = $1)`,
          [object.id, candidate.id]
        );
        if (existing.rows.length > 0) continue;

        const matchResult = await query(
          `INSERT INTO matches (lost_object_id, found_object_id, score, status, created_at, updated_at)
           VALUES ($1, $2, $3, 'pending', NOW(), NOW())
           RETURNING id`,
          [object.id, candidate.id, score]
        );

        const matchId = matchResult.rows[0]?.id as string;
        objectMatches++;
        totalMatches++;

        // ── Evento: match encontrado ─────────────────────────────────
        Events.matchFound(object.id as string, matchId, score).catch(() => {});

        // Notificar dono
        try {
          const ownerResult = await query(
            `SELECT u.id, u.name, u.email FROM users u
             JOIN objects o ON o.user_id = u.id
             WHERE o.id = $1`,
            [object.id]
          );
          if (ownerResult.rows.length > 0) {
            const owner = ownerResult.rows[0];
            sendMatchAlertEmail(
              { name: owner.name, email: owner.email },
              object.title as string,
              matchId,
              score,
              candidate.title as string
            ).catch(() => {});
            sendPushToUser(
              owner.id as string,
              matchPayload(matchId, object.title as string, score)
            ).catch(() => {});
            Events.ownerNotified(object.id as string, owner.id as string).catch(() => {});
          }
        } catch { /* silencioso */ }
      }

      // ── Evento: matching concluído ───────────────────────────────────
      Events.matchingCompleted(object.id as string, candidates.rows.length).catch(() => {});
    }

    const durationMs = Date.now() - startedAt.getTime();
    console.log(`[cron/matching] ${totalObjects} objetos, ${totalMatches} matches, ${durationMs}ms`);

    return NextResponse.json({
      ok: true,
      objects_processed: totalObjects,
      matches_created: totalMatches,
      duration_ms: durationMs,
      next_run_in_minutes: CRON_INTERVAL_MINUTES,
    });
  } catch (error) {
    console.error('[cron/matching] Erro:', error);
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 });
  }
}
