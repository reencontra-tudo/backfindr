import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

const WEBHOOK_TOKEN = process.env.WEBHOOK_TOKEN ?? 'backfindr-webhook-secret-2024';
const APIFY_API_TOKEN = process.env.APIFY_API_TOKEN ?? '';
const MAX_AGE_DAYS = 30;

const PALAVRAS_RELEVANTES = [
  'perdi', 'perdu', 'perdido', 'perdida', 'perdemos',
  'roubado', 'roubada', 'roubaram', 'roubei', 'furto', 'furtado', 'furtaram',
  'sumiu', 'sumiu', 'desapareceu', 'desaparecida', 'desaparecido',
  'achei', 'achamos', 'encontrei', 'encontrado', 'encontrada',
  'procuro', 'procurando', 'quem perdeu', 'quem encontrou',
  'recompensa', 'gratifica',
];

function isRelevante(texto: string): boolean {
  const t = texto.toLowerCase();
  return PALAVRAS_RELEVANTES.some((p) => t.includes(p));
}

function calcScore(texto: string, comentarios: number, dataPost: Date, tipoItem: string) {
  let s = 0;
  const t = (texto || '').toLowerCase();
  const horasPassadas = (Date.now() - new Date(dataPost).getTime()) / 3600000;

  if (horasPassadas > 720) return { score: 0, prioridade: 'baixa' };
  if (horasPassadas < 24) s += 3;
  else if (horasPassadas < 72) s += 2;
  else if (horasPassadas < 168) s += 1;

  if (t.includes('perdi') || t.includes('roubaram') || t.includes('roubado') || t.includes('furtado') || t.includes('perda')) s += 3;
  if ((comentarios || 0) < 10) s += 1;
  if (['celular', 'notebook', 'pet', 'cachorro', 'gato', 'documentos'].some((w) => t.includes(w))) s += 2;
  if (['celular', 'notebook', 'pet', 'documentos'].includes(tipoItem)) s += 1;
  if (t.includes('urgente') || t.includes('ajuda') || t.includes('desesperado')) s += 1;

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
    const datasetId = body?.resource?.defaultDatasetId;
    if (!datasetId) {
      return NextResponse.json({ detail: 'datasetId não encontrado' }, { status: 400 });
    }

    const apifyUrl = `https://api.apify.com/v2/datasets/${datasetId}/items?token=${APIFY_API_TOKEN}&limit=100`;
    const apifyRes = await fetch(apifyUrl);
    if (!apifyRes.ok) {
      return NextResponse.json({ detail: 'Erro ao buscar dataset' }, { status: 500 });
    }

    const items: any[] = await apifyRes.json();

    let criados = 0;
    let duplicados = 0;
    let filtrados = 0;
    let erros = 0;

    const maxAgeMs = MAX_AGE_DAYS * 24 * 60 * 60 * 1000;

    for (const item of items) {
      try {
        const texto = item.message || item.text || '';
        const link = item.url || item.postUrl || '';
        if (!texto || !link) continue;

        // Filtro de relevância
        if (!isRelevante(texto)) { filtrados++; continue; }

        const usuario = item.author?.name || item.authorName || '';
        const comentarios = item.comments_count || item.commentsCount || 0;

        let parsedDate: Date;
        if (typeof item.timestamp === 'number') {
          parsedDate = new Date(item.timestamp * 1000);
        } else {
          parsedDate = new Date(String(item.createdAt || item.date || item.timestamp || Date.now()));
        }

        // Filtro de idade
        if (Date.now() - parsedDate.getTime() > maxAgeMs) { filtrados++; continue; }

        const finalTipoItem = detectTipoItem(texto);
        const { score, prioridade } = calcScore(texto, comentarios, parsedDate, finalTipoItem);

        const existing = await query('SELECT id FROM marketing_leads WHERE link = $1 LIMIT 1', [link]);
        if (existing.rows.length > 0) { duplicados++; continue; }

        await query(
          `INSERT INTO marketing_leads
            (rede, keyword, texto, link, source_url, usuario, cidade, tipo_item, comentarios, data_post, score, prioridade, status, origem)
           VALUES ($1,$2,$3,$4,$4,$5,$6,$7,$8,$9,$10,$11,'novo',$12)`,
          ['facebook', '', texto, link, usuario, '', finalTipoItem, comentarios, parsedDate, score, prioridade, 'apify']
        );
        criados++;
      } catch (e) {
        erros++;
      }
    }

    console.log(`[apify-webhook] criados=${criados} filtrados=${filtrados} duplicados=${duplicados} erros=${erros}`);
    return NextResponse.json({ criados, duplicados, filtrados, erros, total: items.length });
  } catch (error) {
    return NextResponse.json({ detail: 'Erro interno' }, { status: 500 });
  }
}
