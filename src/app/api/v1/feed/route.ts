// GET /api/v1/feed — Feed «Ocorrências recentes» (Fase 1). SOMENTE LEITURA, pública, sem autenticação
// (nunca devolve 401, para não disparar o redirecionamento global de login).
// Paginação por cursor opaco. Resposta com lista FIXA de campos (ver FeedItem em src/lib/feed/query.ts).
// Não mostra legado, não traz total, não faz JOIN com matches.
// Cache: o CDN guarda a resposta por alguns minutos (sem no-store); o banco só é lido a cada 2 min por instância.
import { NextRequest, NextResponse } from 'next/server';
import { decodeCursor, getRankedFeed, pageAfterCursor, parseFeedParams, FEED_PAGE_SIZE } from '@/lib/feed/query';

const CACHE = 'public, s-maxage=300, stale-while-revalidate=600';

export async function GET(request: NextRequest) {
  try {
    const sp = new URL(request.url).searchParams;
    const rawCursor = sp.get('cursor');
    const cursor = decodeCursor(rawCursor);
    if (rawCursor && !cursor) return NextResponse.json({ detail: 'Cursor inválido' }, { status: 400 });

    const limitRaw = parseInt(sp.get('limit') ?? '', 10);
    const size = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 30) : FEED_PAGE_SIZE;

    const ranked = await getRankedFeed(parseFeedParams(sp));
    const page = pageAfterCursor(ranked.items, cursor, size);

    return NextResponse.json({
      items: page.items,
      next_cursor: page.nextCursor,
      has_more: page.hasMore,
      meta: {
        view: 'ocorrencias_recentes',          // nunca «todas as ocorrências»; sem total de propósito
        location_applied: ranked.locationApplied,
        truncated: ranked.truncated,           // true = o teto de leitura foi atingido (as mais antigas ficaram de fora)
        regions: ranked.ufs,                   // UFs que têm ocorrências no Feed (sem contagens)
      },
    }, { headers: { 'Cache-Control': CACHE } });
  } catch (error) {
    // O Next sinaliza «rota dinâmica» lançando um erro interno: nunca engolir.
    if ((error as { digest?: string })?.digest === 'DYNAMIC_SERVER_USAGE') throw error;
    console.error('[feed] erro', error);
    return NextResponse.json({ detail: 'Erro ao carregar o Feed' }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
  }
}
