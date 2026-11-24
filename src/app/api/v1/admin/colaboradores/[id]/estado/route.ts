// POST /api/v1/admin/colaboradores/[id]/estado  corpo: { acao: "suspender" | "reativar" | "excluir", motivo } (E7). Admin. Suspender e excluir exigem motivo; tudo auditado; nada é apagado.
import { NextRequest, NextResponse } from 'next/server';
import { getClient } from '@/lib/db';
import { mudarEstado, type AcaoDeEstado } from '@/lib/colaboradores/admin';
import { ehResposta, guardaAdmin, lerCorpo, SEM_CACHE, UUID } from '@/lib/colaboradores/rotaAdmin';

export const dynamic = 'force-dynamic';
const STATUS = { NAO_ENCONTRADO: 404, INTERNO: 409, TRANSICAO_INVALIDA: 409, MOTIVO_OBRIGATORIO: 400 } as const;

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const g = await guardaAdmin(req); if (ehResposta(g)) return g;
  if (!UUID.test(params.id)) return NextResponse.json({ ok: false, erro: 'Identificador inválido.' }, { status: 400, headers: SEM_CACHE });
  const b = await lerCorpo(req); if (!b) return NextResponse.json({ ok: false, erro: 'Corpo inválido.' }, { status: 400, headers: SEM_CACHE });
  if (b.acao !== 'suspender' && b.acao !== 'reativar' && b.acao !== 'excluir') return NextResponse.json({ ok: false, erro: 'Ação inválida.' }, { status: 400, headers: SEM_CACHE });
  const client = await getClient();
  try {
    const r = await mudarEstado(client, params.id, b.acao as AcaoDeEstado, g.adminId, typeof b.motivo === 'string' ? b.motivo : null);
    return r.ok ? NextResponse.json(r, { headers: SEM_CACHE }) : NextResponse.json(r, { status: STATUS[r.erro], headers: SEM_CACHE });
  } catch (e) { console.error('[colaboradores] mudança de estado falhou', e instanceof Error ? e.message : 'erro'); return NextResponse.json({ ok: false, erro: 'Não foi possível concluir agora.' }, { status: 500, headers: SEM_CACHE }); }
  finally { client.release(); }
}
