// GET /api/v1/colaboradores/validar?codigo=<@nome ou código curto>  (Programa de Colaboradores, E1)
// Pública. Devolve só { ok: true, nome } para colaborador ATIVO, e { ok: false } para inexistente OU inativo (mesma resposta, nada confirma que o código existe).
// Sem COLABORADORES_ATIVO=1 responde 404, como se a rota não existisse. Sem cookie, sem registro do texto digitado.
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { colaboradoresAtivo } from '@/lib/colaboradores/rota';
import { resolverColaborador } from '@/lib/colaboradores/codigo';
import { limitarValidacao } from '@/lib/colaboradores/limite';
import { clientIpFromHeaders } from '@/lib/sendThrottle';

export const dynamic = 'force-dynamic';

const SEM_CACHE = { 'Cache-Control': 'no-store' };

export async function GET(req: NextRequest) {
  if (!colaboradoresAtivo()) return new NextResponse(null, { status: 404 });
  const origem = clientIpFromHeaders(req.headers) ?? 'sem-ip';
  if (limitarValidacao(origem)) return NextResponse.json({ ok: false, limite: true }, { status: 429, headers: SEM_CACHE });
  try {
    const c = await resolverColaborador(query, req.nextUrl.searchParams.get('codigo'));
    return NextResponse.json(c ? { ok: true, nome: c.nome } : { ok: false }, { headers: SEM_CACHE });
  } catch (e) {
    console.error('[colaboradores] validação falhou', e instanceof Error ? e.message : 'erro');
    return NextResponse.json({ ok: false, erro: true }, { status: 500, headers: SEM_CACHE });
  }
}
