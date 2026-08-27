export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminGuard';
import { query } from '@/lib/db';
import { sendMatchAlertEmail } from '@/lib/email';
import {
  calculateMatchScore as calculateMatchScoreBase,
  expandCategoryGroup,
  classifyStage2,
  semanticMatchScore,
  STAGE3_SEMANTIC_ACCEPT_THRESHOLD,
} from '@/lib/matching';

const MAX_RADIUS_KM = 50;

// Consolidado em 26/08/2026 em src/lib/matching.ts — mantém exatamente o
// mesmo comportamento de antes (bônus de marca, sem sinônimo/descrição), só
// sem a lógica duplicada localmente. Ver comentário completo no módulo.
function calculateMatchScore(obj: Record<string, unknown>, candidate: Record<string, unknown>): number {
  return calculateMatchScoreBase(obj, candidate, { brand: true });
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
    // Estágio 3 formalizado aqui pela primeira vez (27/08/2026) — antes só
    // existia no caminho individual. Contadores pra reportar o custo real,
    // não só o resultado final.
    let totalAmbiguous = 0;
    let totalSemanticAccepted = 0;

    for (const object of lostObjects.rows) {
      const lat = parseFloat(object.latitude);
      const lon = parseFloat(object.longitude);
      const hasLocation = !isNaN(lat) && !isNaN(lon);

      let candidateQuery: string;
      let candidateParams: unknown[];

      // Categoria virou filtro obrigatório na busca (26/08/2026) — antes só
      // pesava no score (+30), o que deixava electronics↔other, vehicle↔other
      // etc. virarem candidatos e baterem o threshold só com distância +
      // sobreposição de palavras. Sem category, nenhum filtro é aplicado
      // (mesmo comportamento de antes pra objetos sem categoria).
      // animal/pet são o mesmo conceito com nome diferente por herança do
      // legado (26/08/2026) — expandCategoryGroup trata como sinônimo pra
      // não travar um cão 'animal' de casar com um cão 'pet'.
      const categoryGroup = object.category ? expandCategoryGroup(object.category as string) : null;
      const categoryFilter = categoryGroup ? 'AND (category = ANY($5) OR type = ANY($5))' : '';

      // is_legacy = false exclui os registros migrados do Webjetos
      // (26/08/2026) — 93% da base de objetos ativos hoje é desse legado
      // (2014-2016), com título/descrição genéricos demais ("CACHORRO
      // DESAPARECIDO" x2) pra matching automático fazer sentido. As 43
      // matches do diagnóstico eram 100% webjetos×webjetos.
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
            AND is_legacy = false
            ${categoryFilter}
          ORDER BY created_at DESC LIMIT 100
        `;
        candidateParams = categoryGroup
          ? [object.id, lat, lon, MAX_RADIUS_KM, categoryGroup]
          : [object.id, lat, lon, MAX_RADIUS_KM];
      } else if (categoryGroup) {
        candidateQuery = `
          SELECT * FROM objects
          WHERE status = 'found' AND id != $1
            AND is_legacy = false
            AND (category = ANY($2) OR type = ANY($2))
          ORDER BY created_at DESC LIMIT 50
        `;
        candidateParams = [object.id, categoryGroup];
      } else {
        continue; // sem localização e sem categoria, pula
      }

      const candidates = await query(candidateQuery, candidateParams);
      totalChecked += candidates.rows.length;

      for (const candidate of candidates.rows) {
        const score = calculateMatchScore(object, candidate); // só exibição (coluna score)

        // Funil em estágios (27/08/2026, ver src/lib/matching.ts) — overlap
        // de texto real obrigatório primeiro, confiança (sem categoria)
        // decide DIRETO vs AMBÍGUO entre quem sobreviveu.
        const stage2 = classifyStage2(object, candidate, {}, { brand: true });

        let finalScore: number | null = null;
        if (stage2.decision === 'direct') {
          finalScore = score;
        } else if (stage2.decision === 'ambiguous') {
          // Estágio 3 — antes não existia neste caminho, só no individual.
          // Volume estimado contra a base atual: ~9 candidatos ambíguos no
          // total do sistema, seguro rodar síncrono aqui.
          totalAmbiguous++;
          const aiScore = await semanticMatchScore(object, candidate);
          if (aiScore >= STAGE3_SEMANTIC_ACCEPT_THRESHOLD) {
            finalScore = Math.round((score + aiScore) / 2);
            totalSemanticAccepted++;
          }
        }
        if (finalScore === null) continue; // eliminado, ou ambíguo rejeitado pela LLM

        // Verifica se já existe match entre esses dois objetos
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
          [object.id, candidate.id, finalScore]
        );
        totalCreated++;

        // ── Notificar o dono do objeto perdido por e-mail (assíncrono) ─────────────────────
        try {
          const ownerResult = await query(
            `SELECT u.name, u.email FROM users u
             JOIN objects o ON o.user_id = u.id
             WHERE o.id = $1`,
            [object.id]
          );
          if (ownerResult.rows.length > 0) {
            const owner = ownerResult.rows[0];
            sendMatchAlertEmail(
              { name: owner.name, email: owner.email },
              object.title as string,
              matchResult.rows[0]?.id ?? '',
              finalScore,
              candidate.title as string
            ).catch(err => console.error('[admin/matching] Falha ao enviar e-mail de match:', err));
          }
        } catch (emailErr) {
          console.error('[admin/matching] Erro ao buscar dono para notificação:', emailErr);
        }
      }
    }

    return NextResponse.json({
      message: `Matching completo. ${totalCreated} match(es) criado(s) de ${totalChecked} candidatos verificados (${totalAmbiguous} ambíguo(s) enviado(s) ao estágio 3, ${totalSemanticAccepted} confirmado(s) pela IA).`,
      matches_created: totalCreated,
      candidates_checked: totalChecked,
      stage3_ambiguous: totalAmbiguous,
      stage3_accepted: totalSemanticAccepted,
      objects_processed: lostObjects.rows.length,
    });
  } catch (e) {
    console.error('[admin/matching/run-all]', e);
    return NextResponse.json({ detail: 'Erro ao rodar matching' }, { status: 500 });
  }
}
