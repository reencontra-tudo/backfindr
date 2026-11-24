// POST /api/v1/admin/colaboradores/saques/[id]  corpo: { decisao: "pagar" | "recusar", comprovante?, motivo? } (E7). Admin. Pagar = o PIX foi feito fora do sistema; recusar exige motivo e devolve o valor ao saldo.
import { NextRequest, NextResponse } from 'next/server';
import { getClient } from '@/lib/db';
import { pagarSaque, recusarSaque } from '@/lib/colaboradores/admin';
import { ehResposta, guardaAdmin, lerCorpo, SEM_CACHE, UUID } from '@/lib/colaboradores/rotaAdmin';

export const dynamic = 'force-dynamic';
const STATUS = { NAO_ENCONTRADO: 404, JA_DECIDIDO: 409, MOTIVO_OBRIGATORIO: 400 } as const;

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const g = await guardaAdmin(req); if (ehResposta(g)) return g;
  if (!UUID.test(params.id)) return NextResponse.json({ ok: false, erro: 'Identificador inválido.' }, { status: 400, headers: SEM_CACHE });
  const b = await lerCorpo(req); if (!b) return NextResponse.json({ ok: false, erro: 'Corpo inválido.' }, { status: 400, headers: SEM_CACHE });
  if (b.decisao !== 'pagar' && b.decisao !== 'recusar') return NextResponse.json({ ok: false, erro: 'Decisão inválida.' }, { status: 400, headers: SEM_CACHE });
  const client = await getClient();
  try {
    const r = b.decisao === 'pagar' ? await pagarSaque(client, params.id, g.adminId, b.comprovante) : await recusarSaque(client, params.id, g.adminId, b.motivo);
    return r.ok ? NextResponse.json({ ok: true }, { headers: SEM_CACHE }) : NextResponse.json(r, { status: STATUS[r.erro], headers: SEM_CACHE });
  } catch (e) { console.error('[colaboradores] decisão de saque falhou', e instanceof Error ? e.message : 'erro'); return NextResponse.json({ ok: false, erro: 'Não foi possível concluir agora.' }, { status: 500, headers: SEM_CACHE }); }
  finally { client.release(); }
}
