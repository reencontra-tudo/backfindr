// GET /api/v1/admin/colaboradores/auditoria?alvo_tipo=&alvo_id=&acao= (E8). Admin. Leitura da trilha de auditoria (só INSERT), as 200 mais recentes, com filtros opcionais.
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { ehResposta, guardaAdmin, SEM_CACHE } from '@/lib/colaboradores/rotaAdmin';

export const dynamic = 'force-dynamic';
const TEXTO = /^[a-z0-9_:\-]{1,80}$/i;

export async function GET(req: NextRequest) {
  const g = await guardaAdmin(req); if (ehResposta(g)) return g;
  const p = req.nextUrl.searchParams; const filtros: string[] = []; const valores: unknown[] = [];
  for (const campo of ['alvo_tipo', 'alvo_id', 'acao'] as const) {
    const v = p.get(campo); if (!v) continue;
    if (!TEXTO.test(v)) return NextResponse.json({ ok: false, erro: `Filtro «${campo}» inválido.` }, { status: 400, headers: SEM_CACHE });
    valores.push(v); filtros.push(`${campo} = $${valores.length}`);
  }
  try {
    const r = await query(`SELECT id, ator_id, acao, alvo_tipo, alvo_id, antes, depois, motivo, criado_em FROM auditoria ${filtros.length ? 'WHERE ' + filtros.join(' AND ') : ''} ORDER BY criado_em DESC LIMIT 200`, valores);
    return NextResponse.json({ ok: true, auditoria: r.rows }, { headers: SEM_CACHE });
  } catch (e) { console.error('[colaboradores] auditoria falhou', e instanceof Error ? e.message : 'erro'); return NextResponse.json({ ok: false, erro: 'Não foi possível consultar agora.' }, { status: 500, headers: SEM_CACHE }); }
}
