import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

const WEBHOOK_TOKEN = process.env.WEBHOOK_TOKEN ?? 'backfindr-webhook-secret-2024';
const APIFY_API_TOKEN = process.env.APIFY_API_TOKEN ?? '';

function calcScore(texto: string, comentarios: number, dataPost: Date, tipoItem: string) {
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
  const prioridade = score >= 6 ? 'alta' : score >= 4 ? 'media' : 'baixa';
  return { score, prioridade };
}

function detectTipoItem(texto: string): string {
  const t = texto.toLowerCase();
  if (t.includes('celular') || t.includes('iphone') || t.includes('smartphone')) return 'celular';
  if (t.includes('notebook') || t.includes('laptop') || t.includes('computador')) return 'notebook';
  if (t.includes('cachorro') || t.includes('gato') || t.includes('pet') || t.includes('animal')) return 'pet';
  if (t.includes('documento') || t.includes('rg') || t.includes('cpf')) return 'documentos';
  if (t.includes('carteira') || t.includes('wallet')) return 'carteira';
  if (t.includes('chave')) return 'chaves';
  if (t.includes('mochila') || t.includes('bolsa')) return 'mochila';
  return 'outro';
}

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('Authorization') ?? '';
  const token = authHeader.replace('Bearer ', '').trim();
  if (token !== WEBHOOK_TOKEN) {
    return NextResponse.json({ detail: 'Token inválido' }, { status: 401 });
  }

  try {
    const body = await req.json();
    console.log('[apify-webhook] payload recebido:', JSON.stringify(body).slice(0, 500));

    const datasetId = body?.resource?.defaultDatasetId;
    const keyword = body?.resource?.acts?.[0]?.title ?? '';

    if (!datasetId) {
      return NextResponse.json({ detail: 'datasetId não encontrado no payload' }, { status: 400 });
    }

    const apifyUrl = `https://api.apify.com/v2/datasets/${datasetId}/items?token=${APIFY_API_TOKEN}&limit=100`;
    const apifyRes = await fetch(apifyUrl);
    if (!apifyRes.ok) {
      return NextResponse.json({ detail: 'Erro ao buscar dataset no Apify' }, { status: 500 });
    }

    const items: any[] = await apifyRes.json();
    console.log(`[apify-webhook] ${items.length} items no dataset`);

    let criados = 0;
    let duplicados = 0;
    let erros = 0;

    for (const item of items) {
      try {
        const texto = item.message || item.text || item.postText || '';
        const link = item.url || item.postUrl || item.link || '';
        const usuario = item.author?.name || item.authorName || item.userName || '';
        const comentarios = item.comments_count || item.commentsCount || item.comments || 0;
        const dataPost = item.time || item.createdAt || item.timestamp || new Date().toISOString();

        if (!texto || !link) continue;

        const parsedDate = new Date(dataPost);
        const finalTipoItem = detectTipoItem(texto);
        const { score, prioridade } = calcScore(texto, comentarios, parsedDate, finalTipoItem);

        const existing = await query(
          'SELECT id FROM marketing_leads WHERE link = $1 LIMIT 1',
          [link]
        );
        if (existing.rows.length > 0) { duplicados++; continue; }

        await query(
          `INSERT INTO marketing_leads
            (rede, keyword, texto, link, source_url, usuario, cidade, tipo_item, comentarios, data_post, score, prioridade, status, origem)
           VALUES ($1,$2,$3,$4,$4,$5,$6,$7,$8,$9,$10,$11,'novo',$12)`,
          ['facebook', keyword, texto, link, usuario, '', finalTipoItem, comentarios, parsedDate, score, prioridade, 'apify']
        );
        criados++;
      } catch (e) {
        console.error('[apify-webhook] erro no item:', e);
        erros++;
      }
    }

    return NextResponse.json({ criados, duplicados, erros, total: items.length });
  } catch (error) {
    console.error('[apify-webhook] erro geral:', error);
    return NextResponse.json({ detail: 'Erro interno' }, { status: 500 });
  }
}
