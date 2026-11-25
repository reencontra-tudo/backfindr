// POST /api/v1/colaboradores/visita  corpo: { slug } (E8). Pública. Soma 1 à contagem do dia do colaborador. NÃO lê IP, cookie nem cabeçalho algum e não registra nada em log:
// só o @nome entra. Responde sempre 204 vazio (não confirma se o @nome existe). Desligada (sem COLABORADORES_VISITAS=1) = 404.
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { acimaDoTeto, registrarVisita, slugDeVisita, visitasAtivas } from '@/lib/colaboradores/visitas';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  if (!visitasAtivas()) return new NextResponse(null, { status: 404 });
  let slug: string | null = null;
  try { slug = slugDeVisita(((await req.json()) as { slug?: unknown })?.slug); } catch { slug = null; }
  if (slug && !acimaDoTeto(slug)) { try { await registrarVisita(query, slug); } catch { /* sem log: nada de pessoa aqui; falha de contagem não importa */ } }
  return new NextResponse(null, { status: 204, headers: { 'Cache-Control': 'no-store' } });
}
