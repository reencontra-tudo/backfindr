import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminGuard';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

// ─── Scoring (espelhado do rastrear-integrado) ────────────────────────────────
function calcScore(
  texto: string,
  comentarios: number,
  dataPost: Date,
  tipoItem: string
): { score: number; prioridade: 'alta' | 'media' | 'baixa' } {
  let s = 0;
  const t = (texto || '').toLowerCase();
  if (t.includes('perdi') || t.includes('roubaram') || t.includes('roubado') || t.includes('perda')) s += 3;
  const horasPassadas = (Date.now() - new Date(dataPost).getTime()) / 3600000;
  if (horasPassadas < 24) s += 2;
  if ((comentarios || 0) < 10) s += 2;
  if (['celular', 'notebook', 'pet', 'cachorro', 'gato', 'documentos'].some((w) => t.includes(w))) s += 2;
  if (['celular', 'notebook', 'pet', 'documentos'].includes(tipoItem)) s += 2;
  if (t.includes('urgente') || t.includes('ajuda') || t.includes('desesperado') || t.includes('preciso')) s += 1;
  const score = Math.min(s, 10);
  const prioridade: 'alta' | 'media' | 'baixa' = score >= 6 ? 'alta' : score >= 4 ? 'media' : 'baixa';
  return { score, prioridade };
}

// ─── GET /api/v1/admin/marketing/leads ───────────────────────────────────────
export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;

  const url = new URL(req.url);
  const status = url.searchParams.get('status') || '';
  const rede = url.searchParams.get('rede') || '';
  const cidade = url.searchParams.get('cidade') || '';
  const prioridade = url.searchParams.get('prioridade') || '';
  const mostrarResolvidos = url.searchParams.get('mostrarResolvidos') === 'true';
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 200);
  const offset = parseInt(url.searchParams.get('offset') || '0');

  const conditions: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  const mostrarArquivados = url.searchParams.get('mostrarArquivados') === 'true';

  if (!mostrarArquivados) {
    conditions.push(`arquivado = FALSE`);
  }

  if (!mostrarResolvidos) {
    conditions.push(`resolvido = FALSE`);
  }
  if (status && status !== 'todos') {
    conditions.push(`status = $${idx++}`);
    params.push(status);
  }
  if (rede && rede !== 'todas') {
    conditions.push(`rede = $${idx++}`);
    params.push(rede);
  }
  if (cidade && cidade !== 'todas') {
    conditions.push(`cidade ILIKE $${idx++}`);
    params.push(`%${cidade}%`);
  }
  if (prioridade && prioridade !== 'todas') {
    conditions.push(`prioridade = $${idx++}`);
    params.push(prioridade);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  try {
    const [leadsRes, countRes] = await Promise.all([
      query(
        `SELECT * FROM marketing_leads
         ${where}
         ORDER BY score DESC, data_post DESC
         LIMIT $${idx} OFFSET $${idx + 1}`,
        [...params, limit, offset]
      ),
      query(`SELECT COUNT(*) FROM marketing_leads ${where}`, params),
    ]);

    return NextResponse.json({
      leads: leadsRes.rows,
      total: parseInt(countRes.rows[0].count),
      limit,
      offset,
    });
  } catch (error) {
    console.error('[marketing/leads GET]', error);
    return NextResponse.json({ detail: 'Erro ao buscar leads' }, { status: 500 });
  }
}

// ─── POST /api/v1/admin/marketing/leads ──────────────────────────────────────
export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await req.json();
    const {
      rede = 'facebook',
      keyword = '',
      texto,
      link,
      usuario = '',
      data_post,
      comentarios = 0,
      cidade = '',
      tipo_item = 'outro',
      origem = 'manual',
      source_url = '',
      comment_link = '',
    } = body;

    if (!texto || !link) {
      return NextResponse.json({ detail: 'texto e link são obrigatórios' }, { status: 400 });
    }

    const dataPost = data_post ? new Date(data_post) : new Date();
    const { score, prioridade } = calcScore(texto, comentarios, dataPost, tipo_item);

    // Deduplication por source_url
    if (source_url && source_url.trim() !== '') {
      const existing = await query(
        `SELECT id FROM marketing_leads WHERE source_url = $1 LIMIT 1`,
        [source_url.trim()]
      );
      if (existing.rows.length > 0) {
        return NextResponse.json(
          { id: existing.rows[0].id, duplicate: true, detail: 'Lead duplicado (source_url já existe)' },
          { status: 200 }
        );
      }
    }

    const result = await query(
      `INSERT INTO marketing_leads
        (rede, keyword, texto, link, usuario, data_post, comentarios, cidade, tipo_item,
         score, prioridade, status, origem, source_url, comment_link)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'novo',$12,$13,$14)
       RETURNING id`,
      [rede, keyword, texto, link, usuario, dataPost, comentarios, cidade, tipo_item,
       score, prioridade, origem, source_url || link, comment_link]
    );

    return NextResponse.json({ id: result.rows[0].id, duplicate: false, score, prioridade }, { status: 201 });
  } catch (error) {
    console.error('[marketing/leads POST]', error);
    return NextResponse.json({ detail: 'Erro ao criar lead' }, { status: 500 });
  }
}
