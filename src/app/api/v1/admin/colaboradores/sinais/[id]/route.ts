// POST /api/v1/admin/colaboradores/sinais/[id]  corpo: { decisao: "descartar" | "confirmar", motivo } (E8). Admin. Descartar libera a comissão retida; confirmar a mantém retida. Motivo obrigatório; auditada.
import { NextRequest, NextResponse } from 'next/server';
import { getClient } from '@/lib/db';
import { antifraudeAtivo, decidirSinal } from '@/lib/colaboradores/antifraude';
import { ehResposta, guardaAdmin, lerCorpo, SEM_CACHE, UUID } from '@/lib/colaboradores/rotaAdmin';

export const dynamic = 'force-dynamic';
const STATUS = { NAO_ENCONTRADO: 404, JA_DECIDIDO: 409, MOTIVO_OBRIGATORIO: 400 } as const;

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  if (!antifraudeAtivo()) return new NextResponse(null, { status: 404 });
  const g = await guardaAdmin(req); if (ehResposta(g)) return g;
  if (!UUID.test(params.id)) return NextResponse.json({ ok: false, erro: 'Identificador inválido.' }, { status: 400, headers: SEM_CACHE });
  const b = await lerCorpo(req); if (!b) return NextResponse.json({ ok: false, erro: 'Corpo inválido.' }, { status: 400, headers: SEM_CACHE });
  if (b.decisao !== 'descartar' && b.decisao !== 'confirmar') return NextResponse.json({ ok: false, erro: 'Decisão inválida.' }, { status: 400, headers: SEM_CACHE });
  const client = await getClient();
  try {
    const r = await decidirSinal(client, params.id, b.decisao, g.adminId, b.motivo);
    return r.ok ? NextResponse.json({ ok: true }, { headers: SEM_CACHE }) : NextResponse.json(r, { status: STATUS[r.erro], headers: SEM_CACHE });
  } catch (e) { console.error('[colaboradores] decisão de sinal falhou', e instanceof Error ? e.message : 'erro'); return NextResponse.json({ ok: false, erro: 'Não foi possível concluir agora.' }, { status: 500, headers: SEM_CACHE }); }
  finally { client.release(); }
}
