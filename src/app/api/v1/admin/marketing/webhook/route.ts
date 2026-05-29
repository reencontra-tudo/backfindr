import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
export const dynamic = 'force-dynamic';

const WEBHOOK_TOKEN = process.env.WEBHOOK_TOKEN ?? 'backfindr-webhook-secret-2024';

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

// ─── POST /api/v1/admin/marketing/webhook ─────────────────────────────────────
export async function POST(req: NextRequest) {
  // Verificar token de autenticação
  const authHeader = req.headers.get('Authorization') ?? '';
  const token = authHeader.replace('Bearer ', '').trim();
  if (token !== WEBHOOK_TOKEN) {
    return NextResponse.json({ detail: 'Token inválido' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const {
      rede,
      texto,
      link,
      keyword = '',
      usuario = '',
      cidade = '',
      tipoItem,
      comentarios = 0,
      dataPost,
      origem = 'webhook',
    } = body;

    if (!rede || !texto || !link) {
      return NextResponse.json(
        { detail: 'Campos obrigatórios: rede, texto, link' },
        { status: 400 }
      );
    }

    const validRedes = ['facebook', 'instagram', 'twitter', 'reddit', 'tiktok'];
    if (!validRedes.includes(rede)) {
      return NextResponse.json(
        { detail: `rede deve ser um de: ${validRedes.join(', ')}` },
        { status: 400 }
      );
    }

    const parsedDate = dataPost ? new Date(dataPost) : new Date();
    const finalTipoItem = tipoItem || detectTipoItem(texto);
    const { score, prioridade } = calcScore(texto, comentarios, parsedDate, finalTipoItem);

    // Verificar duplicata pelo link
    const existing = await query(
      `SELECT id FROM marketing_leads WHERE link = $1 LIMIT 1`,
      [link]
    );
    if (existing.rows.length > 0) {
      return NextResponse.json(
        { detail: 'Lead já existe (link duplicado)', id: existing.rows[0].id },
        { status: 409 }
      );
    }

    const result = await query(
      `INSERT INTO marketing_leads 
        (rede, keyword, texto, link, source_url, usuario, cidade, tipo_item, comentarios, data_post, score, prioridade, status, origem)
       VALUES ($1,$2,$3,$4,$4,$5,$6,$7,$8,$9,$10,$11,'novo',$12)
       RETURNING id`,
      [rede, keyword, texto, link, usuario, cidade, finalTipoItem, comentarios, parsedDate, score, prioridade, origem]
    );

    return NextResponse.json(
      { id: result.rows[0].id, score, prioridade, message: 'Lead criado com sucesso' },
      { status: 201 }
    );
  } catch (error) {
    console.error('[marketing/webhook POST]', error);
    return NextResponse.json({ detail: 'Erro interno ao processar lead' }, { status: 500 });
  }
}

// ─── GET /api/v1/admin/marketing/webhook ─────────────────────────────────────
// Retorna a documentação do webhook
export async function GET(req: NextRequest) {
  const baseUrl = process.env.NEXTAUTH_URL ?? 'https://backfindr.com';
  return NextResponse.json({
    endpoint: `POST ${baseUrl}/api/v1/admin/marketing/webhook`,
    token: `Bearer ${WEBHOOK_TOKEN}`,
    campos: {
      rede: { tipo: 'string', obrigatorio: true, valores: 'facebook | instagram | twitter | reddit | tiktok' },
      texto: { tipo: 'string', obrigatorio: true, descricao: 'Texto completo do post' },
      link: { tipo: 'string', obrigatorio: true, descricao: 'URL do post original' },
      keyword: { tipo: 'string', obrigatorio: false, descricao: 'Palavra-chave usada na busca' },
      usuario: { tipo: 'string', obrigatorio: false, descricao: '@usuario ou nome' },
      cidade: { tipo: 'string', obrigatorio: false, descricao: 'Cidade do usuário' },
      tipoItem: { tipo: 'string', obrigatorio: false, descricao: 'celular | pet | documentos | carteira | chaves | mochila | notebook | outro' },
      comentarios: { tipo: 'number', obrigatorio: false, descricao: 'Número de comentários' },
      dataPost: { tipo: 'ISO 8601', obrigatorio: false, descricao: 'Data/hora do post' },
    },
    exemplo_curl: `curl -X POST ${baseUrl}/api/v1/admin/marketing/webhook \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer ${WEBHOOK_TOKEN}" \\
  -d '{
    "rede": "facebook",
    "texto": "Perdi meu celular ontem na Paulista...",
    "link": "https://facebook.com/post/123",
    "keyword": "perdi celular",
    "usuario": "João Silva",
    "cidade": "São Paulo",
    "tipoItem": "celular",
    "comentarios": 5,
    "dataPost": "${new Date().toISOString()}"
  }'`,
  });
}
