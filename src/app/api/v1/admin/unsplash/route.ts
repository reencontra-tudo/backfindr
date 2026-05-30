export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';


/**
 * GET /api/v1/admin/unsplash?q=termo
 *
 * Busca fotos no Unsplash para usar como capa de posts da Comunidade.
 * Requer UNSPLASH_ACCESS_KEY nas env vars.
 * Somente admins podem chamar este endpoint.
 */
export async function GET(req: NextRequest) {

  const { searchParams } = new URL(req.url);
  const q = searchParams.get('q')?.trim();

  if (!q) {
    return NextResponse.json({ detail: 'Parâmetro q é obrigatório' }, { status: 400 });
  }

  const accessKey = process.env.UNSPLASH_ACCESS_KEY;
  if (!accessKey) {
    return NextResponse.json(
      { detail: 'UNSPLASH_ACCESS_KEY não configurada. Adicione nas variáveis de ambiente do Vercel.' },
      { status: 503 }
    );
  }

  try {
    const url = new URL('https://api.unsplash.com/search/photos');
    url.searchParams.set('query', q);
    url.searchParams.set('per_page', '12');
    url.searchParams.set('orientation', 'landscape');
    url.searchParams.set('content_filter', 'high'); // apenas conteúdo seguro

    const res = await fetch(url.toString(), {
      headers: {
        'Authorization': `Client-ID ${accessKey}`,
        'Accept-Version': 'v1',
      },
    });

    if (!res.ok) {
      const err = await res.text();
      console.error('[unsplash]', res.status, err);
      return NextResponse.json(
        { detail: 'Erro ao buscar no Unsplash. Verifique a chave de API.' },
        { status: 502 }
      );
    }

    const data = await res.json() as {
      results: {
        id: string;
        urls: { small: string; regular: string };
        alt_description: string | null;
        user: { name: string };
      }[];
    };

    // Retorna apenas os campos necessários para o frontend
    const photos = data.results.map(p => ({
      id: p.id,
      urls: { small: p.urls.small, regular: p.urls.regular },
      alt_description: p.alt_description,
      user: { name: p.user.name },
    }));

    return NextResponse.json({ photos });
  } catch (err) {
    console.error('[unsplash]', err);
    return NextResponse.json({ detail: 'Erro interno ao buscar imagens' }, { status: 500 });
  }
}
