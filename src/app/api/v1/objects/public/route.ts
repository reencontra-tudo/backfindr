export const dynamic = 'force-dynamic';
import { NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { successResponse, internalErrorResponse } from '@/lib/response';
import { isBuscaAmpla, temPalavraEmComum, tituloRecuperado } from '@/lib/flowMatch/relevance';
import { buscarRegistrosRecentesParecidos } from '@/lib/flowMatch/recentSimilar';
import { maskSignalForPublicApi } from '@/lib/objectPublicView';
import { localizacaoPublica } from '@/lib/publicLocation';

import { SCORE_MIN_BUSCA, buildKeywordConditions, calcularScoreBusca, expandirKeyword, expandirTokens, tokenizar, type OpcoesBusca } from '@/lib/buscaPublica';
import { compilarFamilias, nivelDoItem, palavrasExatas } from '@/lib/buscaFamilias';

// Verifica se FTS existe no banco
let hasFTS: boolean | null = null;
async function checkFTS(): Promise<boolean> {
  if (hasFTS !== null) return hasFTS;
  try {
    const r = await query(
      `SELECT 1 FROM information_schema.columns
       WHERE table_name = 'objects' AND column_name = 'search_vector' LIMIT 1`
    );
    hasFTS = r.rows.length > 0;
  } catch { hasFTS = false; }
  return hasFTS;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status   = searchParams.get('status') || '';
    const category = searchParams.get('category');
    const keyword  = (searchParams.get('keyword') || searchParams.get('q') || '').trim();
    // Busca mais candidatos do que o solicitado para compensar o filtro de score
    const requestedSize = Math.min(parseInt(searchParams.get('size') || searchParams.get('limit') || '20'), 500);
    const fetchSize = keyword.length > 0 ? Math.min(requestedSize * 10, 500) : requestedSize;
    const cursor   = searchParams.get('cursor');
    const page     = parseInt(searchParams.get('page') || '1');
    const offset   = cursor ? null : (page - 1) * fetchSize;

    // Opção NOVA, desligada por padrão: só o passo 2 de /flow/found e /flow/lost envia `strict=1`.
    // Sem ela, nada abaixo muda (home, /buscar, /achei, painel e sitemap seguem idênticos).
    const strict = searchParams.get('strict') === '1';
    // Opção NOVA, desligada por padrão (etapa 1 do vocabulário por família): `amplo=1` liga radical corrigido, casamento sem acento, família e categoria.
    // Só a busca do /achei envia. Fluxos /flow/* (com ou sem strict) e qualquer outro consumidor NÃO enviam: seguem exatamente como eram. Com strict=1, `amplo` é ignorado.
    const amplo = searchParams.get('amplo') === '1' && !strict;
    if (strict && isBuscaAmpla(keyword)) {
      // Busca ampla demais: não lista itens fracos; o fluxo mostra o aviso «precisa de mais detalhes».
      // `items` fica vazio; só registros RECENTES de usuário/sinal (nunca legado) vão em `recent_similar` (até 3).
      const recent_similar = await buscarRegistrosRecentesParecidos(keyword, status);
      return successResponse({
        items: [], total: 0, page, size: requestedSize, next_cursor: null,
        keywords_expanded: [], score_threshold: SCORE_MIN_BUSCA, needs_details: true, recent_similar,
      });
    }

    await checkFTS();

    const params: unknown[] = [];
    const conditions: string[] = ['is_public = true'];

    if (status && status !== 'all') {
      params.push(status);
      conditions.push(`status = $${params.length}`);
      if (status === 'found') {
        conditions.push(`(is_legacy = false OR is_legacy IS NULL)`);
      }
    } else {
      conditions.push(`status IN ('lost', 'found', 'stolen')`);
    }

    if (category) {
      params.push(category);
      conditions.push(`category = $${params.length}`);
    }

    const fam = amplo && keyword.length > 0 ? compilarFamilias(keyword) : null;
    const opcoes: OpcoesBusca | undefined = fam ? { radical: true, semAcento: true, categoriasDaBusca: fam.categorias } : undefined;
    const termosExpandidos = keyword.length > 0 ? [...expandirKeyword(keyword, opcoes), ...(fam?.termos ?? [])] : [];
    if (termosExpandidos.length > 0) {
      conditions.push(buildKeywordConditions(termosExpandidos, params, opcoes));
    }

    if (cursor) {
      params.push(cursor);
      conditions.push(`updated_at < $${params.length}`);
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const orderBy = `ORDER BY
      CASE WHEN is_boosted = true AND (boost_expires_at IS NULL OR boost_expires_at > NOW()) THEN 0 ELSE 1 END ASC,
      CASE WHEN images IS NOT NULL AND images != '[]' AND images != 'null' THEN 0 ELSE 1 END ASC,
      updated_at DESC NULLS LAST`;

    params.push(fetchSize);
    const limitParam = params.length;

    let paginationClause: string;
    if (cursor) {
      paginationClause = `LIMIT $${limitParam}`;
    } else {
      params.push(offset as number);
      paginationClause = `LIMIT $${limitParam} OFFSET $${params.length}`;
    }

    const sql = `
      SELECT
        id, title, description, status, category, type,
        location, latitude, longitude, qr_code,
        color, brand, breed, images,
        is_legacy, source, reward_amount, reward_description,
        is_boosted, boost_expires_at, created_at, updated_at
      FROM objects
      ${whereClause}
      ${orderBy}
      ${paginationClause}
    `;

    const result = await query(sql, params);

    // ── Normalizar e calcular score pós-query ─────────────────────────────
    const allItems = result.rows.map((row: Record<string, unknown>) => {
      const item = {
        id: row.id,
        title: row.title,
        description: row.description || '',
        status: row.status,
        category: row.category || row.type || 'other',
        unique_code: row.qr_code,
        owner_id: null,
        photos: (() => {
          try {
            if (Array.isArray(row.images)) return row.images;
            if (typeof row.images === 'string') return JSON.parse(row.images as string);
            return [];
          } catch { return []; }
        })(),
        // Endereço público só com «bairro, cidade - UF» nos cadastros de usuário (legado e sinal público saem como estão). A pontuação usa `row` (texto original).
        location: localizacaoPublica((() => {
          const lat = row.latitude ? parseFloat(String(row.latitude)) : null;
          const lng = row.longitude ? parseFloat(String(row.longitude)) : null;
          if (lat && lng && !isNaN(lat) && !isNaN(lng)) {
            return { lat, lng, address: (row.location as string) || undefined };
          }
          if (row.location && typeof row.location === 'string') {
            try {
              const parsed = JSON.parse(row.location as string);
              if (parsed.lat && parsed.lng) return parsed;
            } catch { /* não é JSON */ }
          }
          return null;
        })(), { is_legacy: row.is_legacy as boolean | null, source: row.source as string | null }),
        color: row.color,
        brand: row.brand,
        pet_breed: row.breed,
        is_legacy: row.is_legacy,
        source: row.source,
        is_boosted: row.is_boosted ?? false,
        reward_amount: row.reward_amount ? parseFloat(String(row.reward_amount)) : null,
        reward_description: row.reward_description || null,
        created_at: row.created_at,
        updated_at: row.updated_at,
        _score: keyword.length > 0 ? calcularScoreBusca(keyword, row, opcoes) : 100,
        // só com `amplo=1`: nível 0 palavra exata, 1 família/categoria, 2 nota (ver src/lib/buscaFamilias.ts); sempre sobre a linha ORIGINAL do banco
        _nivel: fam ? nivelDoItem(keyword, fam, row, keyword.length > 0 ? calcularScoreBusca(keyword, row, opcoes) : 100, SCORE_MIN_BUSCA) : null,
        _exatas: fam ? palavrasExatas(keyword, row) : 0,
      };
      return item;
    });

    // Só com strict=1: cor sozinha não conta e título «recuperado/a» não aparece (a pontuação e a ordem não mudam)
    const kwExpandidoStrict = strict ? expandirTokens(tokenizar(keyword)) : null;
    const passaStrict = (item: (typeof allItems)[number]) => !strict || (
      !tituloRecuperado(item.title) &&
      temPalavraEmComum(
        kwExpandidoStrict as Set<string>,
        expandirTokens(tokenizar((item.title as string) || '')),
        expandirTokens(tokenizar((item.description as string) || '')),
      )
    );

    // Filtra por score mínimo e ordena por relevância (quando há keyword)
    const selecionados = keyword.length > 0
      ? (fam
          ? allItems
              .filter(item => item._nivel !== null)
              .sort((a, b) => (a._nivel as number) - (b._nivel as number) || b._score - a._score || b._exatas - a._exatas)
          : allItems
              .filter(item => item._score >= SCORE_MIN_BUSCA)
              .filter(passaStrict)
              .sort((a, b) => b._score - a._score)
        ).slice(0, requestedSize)
      : allItems.slice(0, requestedSize);

    // Só SINAL PÚBLICO: nome de pessoa mascarado e sem o endereço da fonte, na RESPOSTA. O casamento da busca, a pontuação, o filtro do passo 2,
    // a ordem e o corte acima usaram o texto original; usuário e legado passam sem alteração.
    // `_nivel` e `_exatas` são internos (só ordenam): a resposta tem os mesmos campos de sempre
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const items = selecionados.map(({ _nivel, _exatas, ...item }) => maskSignalForPublicApi(item));

    const nextCursor = items.length === requestedSize
      ? String(items[items.length - 1].updated_at)
      : null;

    return successResponse({
      items,
      total: cursor ? undefined : items.length,
      page: cursor ? undefined : page,
      size: requestedSize,
      next_cursor: nextCursor,
      keywords_expanded: termosExpandidos,
      score_threshold: keyword.length > 0 ? SCORE_MIN_BUSCA : null,
    });
  } catch (error) {
    return internalErrorResponse(error);
  }
}
