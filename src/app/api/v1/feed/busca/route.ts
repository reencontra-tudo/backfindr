// GET /api/v1/feed/busca?q=… — busca por texto do Feed (pública, sem login, SOMENTE LEITURA). Aceita os mesmos filtros do Feed
// (status, categoria, cidade, uf, escopo). Resposta: lista FIXA de campos do card (FeedItem), `ampla` e `meta.truncated`.
// Nunca devolve 401, legado, dono, contato, coordenadas, descrição bruta nem o texto digitado. Sem cache compartilhado: a consulta não
// fica guardada em CDN (só o navegador de quem digitou guarda por 1 min).
import { NextRequest, NextResponse } from 'next/server';
import { parseFeedParams } from '@/lib/feed/query';
import { buscarNoFeed } from '@/lib/feed/busca';

export async function GET(request: NextRequest) {
  try {
    const sp = new URL(request.url).searchParams;
    const r = await buscarNoFeed(sp.get('q'), parseFeedParams(sp));
    return NextResponse.json(
      { items: r.items, ampla: r.ampla, meta: { truncated: r.truncated } },
      { headers: { 'Cache-Control': 'private, max-age=60' } },
    );
  } catch (error) {
    if ((error as { digest?: string })?.digest === 'DYNAMIC_SERVER_USAGE') throw error;
    console.error('[feed] erro na busca'); // sem o texto digitado
    return NextResponse.json({ detail: 'Erro ao buscar' }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
  }
}
