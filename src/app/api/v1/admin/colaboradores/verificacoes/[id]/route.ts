// POST /api/v1/admin/colaboradores/verificacoes/[id]  corpo: { decisao: "aprovar" | "recusar", motivo? } (E5). Admin. Aprovar libera `verificado_em`; recusar exige motivo.
import { NextRequest, NextResponse } from 'next/server';
import { getClient } from '@/lib/db';
import { requireAdmin } from '@/lib/adminGuard';
import { decidirVerificacao } from '@/lib/colaboradores/inscricao';
import { desligada, SEM_CACHE } from '@/lib/colaboradores/rotaInscricao';

export const dynamic = 'force-dynamic';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const off = desligada(); if (off) return off;
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;
  if (!UUID.test(params.id)) return NextResponse.json({ ok: false, erro: 'Identificador inválido.' }, { status: 400, headers: SEM_CACHE });
  let corpo: { decisao?: unknown; motivo?: unknown } = {};
  try { corpo = await req.json(); } catch { return NextResponse.json({ ok: false, erro: 'Corpo inválido.' }, { status: 400, headers: SEM_CACHE }); }
  if (corpo.decisao !== 'aprovar' && corpo.decisao !== 'recusar') return NextResponse.json({ ok: false, erro: 'Decisão inválida.' }, { status: 400, headers: SEM_CACHE });
  const client = await getClient();
  try {
    const r = await decidirVerificacao(client, params.id, corpo.decisao, auth.user.id, typeof corpo.motivo === 'string' ? corpo.motivo : null);
    if (r.ok) return NextResponse.json({ ok: true }, { headers: SEM_CACHE });
    const status = r.erro === 'NAO_ENCONTRADA' ? 404 : r.erro === 'MOTIVO_OBRIGATORIO' ? 400 : 409;
    return NextResponse.json({ ok: false, erro: r.erro }, { status, headers: SEM_CACHE });
  } catch (e) {
    console.error('[colaboradores] decisão de verificação falhou', e instanceof Error ? e.message : 'erro');
    return NextResponse.json({ ok: false, erro: 'Não foi possível concluir agora.' }, { status: 500, headers: SEM_CACHE });
  } finally {
    client.release();
  }
}
