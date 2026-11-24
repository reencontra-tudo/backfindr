// GET/POST /api/v1/admin/colaboradores/regras (E7). Admin. GET: regras vigentes e agendadas. POST { chave, valor, vigente_desde?, motivo }: nova versão (só daqui para frente), auditada.
import { NextRequest, NextResponse } from 'next/server';
import { getClient, query } from '@/lib/db';
import { definirRegra, regrasVigentes } from '@/lib/colaboradores/admin';
import { ehResposta, guardaAdmin, lerCorpo, SEM_CACHE } from '@/lib/colaboradores/rotaAdmin';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const g = await guardaAdmin(req); if (ehResposta(g)) return g;
  try { return NextResponse.json({ ok: true, ...(await regrasVigentes(query)) }, { headers: SEM_CACHE }); }
  catch (e) { console.error('[colaboradores] regras falharam', e instanceof Error ? e.message : 'erro'); return NextResponse.json({ ok: false, erro: 'Não foi possível consultar agora.' }, { status: 500, headers: SEM_CACHE }); }
}

export async function POST(req: NextRequest) {
  const g = await guardaAdmin(req); if (ehResposta(g)) return g;
  const b = await lerCorpo(req); if (!b) return NextResponse.json({ ok: false, erro: 'Corpo inválido.' }, { status: 400, headers: SEM_CACHE });
  const client = await getClient();
  try {
    const r = await definirRegra(client, String(b.chave ?? ''), b.valor, b.vigente_desde, b.motivo, g.adminId);
    return r.ok ? NextResponse.json(r, { status: 201, headers: SEM_CACHE }) : NextResponse.json(r, { status: 400, headers: SEM_CACHE });
  } catch (e) { console.error('[colaboradores] mudança de regra falhou', e instanceof Error ? e.message : 'erro'); return NextResponse.json({ ok: false, erro: 'Não foi possível concluir agora.' }, { status: 500, headers: SEM_CACHE }); }
  finally { client.release(); }
}
