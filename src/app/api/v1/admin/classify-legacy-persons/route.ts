export const dynamic = 'force-dynamic';
export const maxDuration = 60;
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

const MIGRATION_SECRET = process.env.MIGRATION_SECRET || '';
const CONCURRENCY = 8;

/**
 * POST /api/v1/admin/classify-legacy-persons
 *
 * One-off (26/08/2026): identifica registros legados do Webjetos que
 * descrevem PESSOAS desaparecidas/encontradas, não objetos/animais — bug
 * encontrado no matching (pessoa desaparecida pareada com pet perdido).
 * Busca textual (`title ILIKE '%desaparecid%'`) já provou não ser
 * confiável: "Encontrado Thales da Hora Mendonça" não bate em nenhum
 * padrão de palavra-chave, só um nome próprio. Não existe nenhum campo
 * estrutural preservado da importação original do Webjetos que distinga
 * "pessoa" de "objeto/animal" (category_fields está vazio {} nesses
 * registros) — então a única forma confiável é classificação semântica
 * via LLM, mesmo padrão já usado em src/lib/publicSignals/extract.ts.
 *
 * Universo: source='webjetos' AND category IN ('pet','animal','other') —
 * as únicas 3 categorias onde um relato de pessoa poderia ter caído (as
 * outras: vehicle/document/jewelry/bag/book/electronics, têm palavras-
 * chave de objeto demais pra plausivelmente conter um relato de pessoa
 * sem nenhuma marca/modelo/termo do objeto no título). ~940 registros.
 *
 * Paginado via offset (body.offset, body.limit — default 150) porque
 * classificar via LLM não cabe no maxDuration de uma chamada só. Chame
 * repetidas vezes incrementando offset até `checked: 0`.
 *
 * body.apply (default false): se true, além de classificar, já marca
 * `status = 'archived'` nos confirmados como pessoa NESTA rodada. Rode
 * sempre com apply=false primeiro pra conferir a amostra antes de aplicar.
 */

interface CandidateRow {
  id: string;
  title: string;
  description: string | null;
  category: string;
  status: string;
  is_public: boolean;
}

async function classifyOne(row: CandidateRow): Promise<{ id: string; title: string; is_person: boolean; reason: string } | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `Você classifica registros legados de um sistema de achados-e-perdidos de OBJETOS e ANIMAIS. Alguns registros antigos, por engano, descrevem PESSOAS desaparecidas/encontradas — fora do escopo atual do produto (que é só bens materiais e animais de estimação).
Responda APENAS com JSON: {"is_person": <true se o texto descreve claramente um SER HUMANO desaparecido/encontrado (tem nome próprio de pessoa, idade, características físicas humanas, "abrigo", "família", etc — não um objeto ou animal); false caso contrário>, "reason": "<motivo em poucas palavras>"}
Na dúvida real (texto ambíguo demais pra decidir), responda is_person: false — é preferível manter um caso ambíguo do jeito que está do que arquivar um objeto/animal de verdade por engano.`,
          },
          { role: 'user', content: `Título: ${row.title}\nDescrição: ${row.description || '(sem descrição)'}\nCategoria atual no sistema: ${row.category}` },
        ],
        max_tokens: 100,
        temperature: 0,
      }),
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) return null;
    const data = await response.json();
    const raw = data.choices?.[0]?.message?.content || '';
    const clean = raw.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);
    return { id: row.id, title: row.title, is_person: parsed.is_person === true, reason: String(parsed.reason || '') };
  } catch (err) {
    console.error('[classify-legacy-persons] falha ao classificar', row.id, err);
    return null;
  }
}

export async function POST(req: NextRequest) {
  let authorized = false;
  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  if (MIGRATION_SECRET && body.secret === MIGRATION_SECRET) authorized = true;
  if (!authorized) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const offset = typeof body.offset === 'number' ? body.offset : 0;
  const limit = typeof body.limit === 'number' ? Math.min(body.limit, 200) : 150;
  const apply = body.apply === true;

  try {
    const rowsRes = await query(
      `SELECT id, title, description, category, status, is_public FROM objects
       WHERE source = 'webjetos' AND category IN ('pet', 'animal', 'other')
       ORDER BY id
       OFFSET $1 LIMIT $2`,
      [offset, limit]
    );
    const rows = rowsRes.rows as CandidateRow[];

    const results: { id: string; title: string; is_person: boolean; reason: string }[] = [];
    for (let i = 0; i < rows.length; i += CONCURRENCY) {
      const batch = rows.slice(i, i + CONCURRENCY);
      const classified = await Promise.all(batch.map(classifyOne));
      for (const c of classified) if (c) results.push(c);
    }

    const persons = results.filter(r => r.is_person);

    let archived = 0;
    if (apply && persons.length > 0) {
      const archiveRes = await query(
        `UPDATE objects SET status = 'archived', updated_at = NOW()
         WHERE id = ANY($1::uuid[]) AND status != 'archived'`,
        [persons.map(p => p.id)]
      );
      archived = archiveRes.rowCount ?? 0;
    }

    return NextResponse.json({
      offset,
      limit,
      checked: rows.length,
      classification_failed: rows.length - results.length,
      persons_found_this_batch: persons.length,
      archived_this_batch: archived,
      persons_sample: persons.slice(0, 10).map(p => ({ id: p.id, title: p.title, reason: p.reason })),
      next_offset: rows.length === limit ? offset + limit : null,
    });
  } catch (e) {
    console.error('[classify-legacy-persons]', e);
    return NextResponse.json({ error: 'Erro ao classificar', detail: String(e) }, { status: 500 });
  }
}
