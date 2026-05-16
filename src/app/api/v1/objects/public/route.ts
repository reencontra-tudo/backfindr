export const dynamic = 'force-dynamic';
import { NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { successResponse, internalErrorResponse } from '@/lib/response';

// ─── Dicionário de sinônimos (PT-BR, normalizado sem acento) ───────────────
const SINONIMOS: Record<string, string[]> = {
  bolsa: ['mochila', 'sacola', 'bag', 'pochete', 'carteira', 'maleta', 'pasta'],
  mochila: ['bolsa', 'sacola', 'bag', 'morral', 'saco'],
  sacola: ['bolsa', 'mochila', 'bag', 'saco'],
  celular: ['telefone', 'smartphone', 'iphone', 'android', 'aparelho', 'samsung', 'motorola'],
  telefone: ['celular', 'smartphone', 'aparelho'],
  carteira: ['wallet', 'bolsa', 'porta-documentos'],
  chave: ['chaves', 'chaveiro', 'key'],
  oculos: ['lentes', 'armacao', 'grau', 'sol'],
  notebook: ['computador', 'laptop', 'note', 'mac', 'macbook'],
  computador: ['notebook', 'laptop', 'pc', 'desktop'],
  caderno: ['cadernos', 'agenda', 'livro', 'bloco', 'diario'],
  agenda: ['caderno', 'livro', 'bloco', 'diario'],
  cachorro: ['cao', 'dog', 'pet', 'animal', 'canino'],
  cao: ['cachorro', 'dog', 'pet', 'animal'],
  gato: ['cat', 'felino', 'pet', 'animal', 'gatinho'],
  relogio: ['watch', 'smartwatch', 'cronometro'],
  documento: ['documentos', 'rg', 'cpf', 'identidade', 'passaporte', 'habilitacao', 'cnh'],
  identidade: ['rg', 'documento', 'cpf', 'passaporte'],
  tablet: ['ipad', 'kindle', 'leitor'],
  fone: ['fones', 'headphone', 'earphone', 'airpod', 'auricular', 'headset'],
  headphone: ['fone', 'fones', 'earphone', 'airpod', 'auricular'],
  onibus: ['bus', 'coletivo', 'transporte'],
  trem: ['metro', 'subway'],
};

function removerAcentos(str: string): string {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function normalizarPalavra(word: string): string {
  word = removerAcentos(word).toLowerCase().trim();
  if (word.length > 4 && word.endsWith('s')) word = word.slice(0, -1);
  return word;
}

function tokenizar(text: string): string[] {
  return removerAcentos(text).toLowerCase().split(/\s+/).filter(w => w.length > 2);
}

function expandirTokens(tokens: string[]): Set<string> {
  const expanded = new Set<string>();
  for (const token of tokens) {
    const norm = normalizarPalavra(token);
    expanded.add(norm);
    for (const s of SINONIMOS[norm] || []) expanded.add(normalizarPalavra(s));
  }
  return expanded;
}

function expandirKeyword(keyword: string): string[] {
  const termos = new Set<string>();
  termos.add(keyword.toLowerCase().trim());
  const palavras = removerAcentos(keyword).toLowerCase().split(/\s+/).filter(w => w.length > 2);
  for (const palavra of palavras) {
    const norm = normalizarPalavra(palavra);
    termos.add(norm);
    for (const s of SINONIMOS[norm] || []) termos.add(s);
  }
  return [...termos];
}

function buildKeywordConditions(termosExpandidos: string[], params: unknown[]): string {
  const conds: string[] = [];
  for (const termo of termosExpandidos) {
    params.push(`%${termo}%`);
    const p = params.length;
    conds.push(
      `(LOWER(title) LIKE $${p} OR LOWER(description) LIKE $${p}` +
      ` OR LOWER(color) LIKE $${p} OR LOWER(brand) LIKE $${p} OR LOWER(breed) LIKE $${p})`
    );
  }
  return `(${conds.join(' OR ')})`;
}

// ─── Score de relevância pós-query (mesma lógica do matching) ─────────────
// Threshold mínimo para aparecer na busca pública
const SCORE_MIN_BUSCA = 20;

function calcularScoreBusca(keyword: string, item: Record<string, unknown>): number {
  let score = 0;

  const kwTokens = tokenizar(keyword);
  const kwExpanded = expandirTokens(kwTokens);

  // Título com sinônimos (+10 por palavra, até 40 pts)
  if (item.title) {
    const titleTokens = expandirTokens(tokenizar(item.title as string));
    const common = [...kwExpanded].filter(w => titleTokens.has(w)).length;
    if (common > 0) score += Math.min(40, common * 10);
  }

  // Descrição com sinônimos (até 20 pts)
  if (item.description) {
    const descTokens = expandirTokens(tokenizar(item.description as string));
    const common = [...kwExpanded].filter(w => descTokens.has(w)).length;
    score += Math.min(20, (common / Math.max(kwTokens.length, 1)) * 20);
  }

  // Cor coincide (+15)
  if (item.color) {
    const kwColors = kwTokens.map(normalizarPalavra);
    const itemColor = normalizarPalavra(item.color as string);
    if (kwColors.includes(itemColor)) score += 15;
  }

  // Categoria / tipo coincide com keyword (+10)
  if (item.category || item.type) {
    const cat = normalizarPalavra((item.category || item.type) as string);
    if ([...kwExpanded].includes(cat)) score += 10;
  }

  return Math.min(100, Math.round(score));
}

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

    const termosExpandidos = keyword.length > 0 ? expandirKeyword(keyword) : [];
    if (termosExpandidos.length > 0) {
      conditions.push(buildKeywordConditions(termosExpandidos, params));
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
        location: (() => {
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
        })(),
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
        _score: keyword.length > 0 ? calcularScoreBusca(keyword, row) : 100,
      };
      return item;
    });

    // Filtra por score mínimo e ordena por relevância (quando há keyword)
    const items = keyword.length > 0
      ? allItems
          .filter(item => item._score >= SCORE_MIN_BUSCA)
          .sort((a, b) => b._score - a._score)
          .slice(0, requestedSize)
      : allItems.slice(0, requestedSize);

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
