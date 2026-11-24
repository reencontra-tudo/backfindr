// POST /api/v1/admin/colaboradores/[id]/ajuste  corpo: { valor_centavos (com sinal), motivo (obrigatório) } (E7). Admin. Única forma de corrigir o livro; auditada.
import { NextRequest, NextResponse } from 'next/server';
import { getClient } from '@/lib/db';
import { ajusteDoAdmin } from '@/lib/colaboradores/admin';
import { ehResposta, guardaAdmin, lerCorpo, SEM_CACHE, UUID } from '@/lib/colaboradores/rotaAdmin';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const g = await guardaAdmin(req); if (ehResposta(g)) return g;
  if (!UUID.test(params.id)) return NextResponse.json({ ok: false, erro: 'Identificador inválido.' }, { status: 400, headers: SEM_CACHE });
  const b = await lerCorpo(req); if (!b) return NextResponse.json({ ok: false, erro: 'Corpo inválido.' }, { status: 400, headers: SEM_CACHE });
  const client = await getClient();
  try {
    const r = await ajusteDoAdmin(client, params.id, b.valor_centavos, b.motivo, g.adminId);
    return r.ok ? NextResponse.json({ ok: true }, { headers: SEM_CACHE }) : NextResponse.json(r, { status: r.erro === 'NAO_ENCONTRADO' ? 404 : 400, headers: SEM_CACHE });
  } catch (e) { console.error('[colaboradores] ajuste falhou', e instanceof Error ? e.message : 'erro'); return NextResponse.json({ ok: false, erro: 'Não foi possível concluir agora.' }, { status: 500, headers: SEM_CACHE }); }
  finally { client.release(); }
}
