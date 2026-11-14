// GET /api/v1/feed/contexto?de=<código> — contexto mínimo para o /achei quando a pessoa chega pelo «Informar que encontrei» de um card do Feed.
// SOMENTE LEITURA, pública. Devolve só { titulo (mascarado), categoria, situacao } de um PERDIDO de USUÁRIO elegível ao Feed (mesma regra:
// público, não legado, status «lost», sem sinal público). Para qualquer outro valor — inexistente, privado, legado, achado, roubado, sinal público,
// código malformado — a resposta é IDÊNTICA: { "contexto": null }, 200, mesmos cabeçalhos; nunca confirma que um código existe.
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { maskPersonNames } from '@/lib/privacy/maskPersonNames';
import { FEED_ELIGIBILITY_WHERE } from '@/lib/feed/query';
import { feedCategoryKey, FEED_CATEGORY_LABELS } from '@/lib/feed/category';
import { lerDe } from '@/lib/feed/contexto';
import { limitar } from '@/lib/feed/limite';

export const dynamic = 'force-dynamic';

const CABECALHOS = { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=60', 'X-Content-Type-Options': 'nosniff' };
const NADA = () => NextResponse.json({ contexto: null }, { status: 200, headers: CABECALHOS });

export async function GET(req: NextRequest) {
  const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || req.headers.get('x-real-ip') || 'desconhecido';
  if (limitar(ip)) return NextResponse.json({ contexto: null }, { status: 429, headers: { 'Cache-Control': 'no-store', 'Retry-After': '60' } });
  const de = lerDe(new URL(req.url).searchParams.get('de'));
  if (!de) return NADA();
  try {
    const r = await query(
      `SELECT o.title, o.category, o.type
         FROM objects o
        WHERE o.qr_code = $1 AND ${FEED_ELIGIBILITY_WHERE}
          AND o.status = 'lost' AND o.source IS DISTINCT FROM 'public_signal'
        LIMIT 1`, [de]);
    const row = r.rows[0];
    if (!row) return NADA();
    const categoria = feedCategoryKey(row.category ?? row.type);
    const titulo = maskPersonNames(row.title) || 'Ocorrência sem título';
    return NextResponse.json({ contexto: { titulo, categoria, categoria_rotulo: FEED_CATEGORY_LABELS[categoria], situacao: 'lost' } }, { status: 200, headers: CABECALHOS });
  } catch {
    return NADA();   // erro de leitura: igual a «nada» (a página fica como hoje)
  }
}
