import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminGuard';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

// ─── Scoring ──────────────────────────────────────────────────────────────────
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

// ─── Detectar tipo de item pelo texto ─────────────────────────────────────────
function detectTipoItem(texto: string): string {
  const t = texto.toLowerCase();
  if (t.includes('celular') || t.includes('iphone') || t.includes('smartphone')) return 'celular';
  if (t.includes('notebook') || t.includes('laptop') || t.includes('computador')) return 'notebook';
  if (t.includes('cachorro') || t.includes('gato') || t.includes('pet') || t.includes('animal')) return 'pet';
  if (t.includes('documento') || t.includes('rg') || t.includes('cpf') || t.includes('carteira de identidade')) return 'documentos';
  if (t.includes('carteira') || t.includes('wallet')) return 'carteira';
  if (t.includes('chave')) return 'chaves';
  if (t.includes('mochila') || t.includes('bolsa')) return 'mochila';
  return 'outro';
}

// ─── POST /api/v1/admin/marketing/apify/run ──────────────────────────────────
export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;

  const apifyToken = process.env.APIFY_API_TOKEN;
  if (!apifyToken) {
    return NextResponse.json(
      { detail: 'APIFY_API_TOKEN não configurado. Configure a variável de ambiente no Vercel.' },
      { status: 503 }
    );
  }

  try {
    const body = await req.json();
    const { config_id, keyword, actor_id, max_results = 100, rede = 'facebook' } = body;

    // Buscar config do banco se config_id fornecido
    let finalKeyword = keyword;
    let finalActorId = actor_id || 'powerai/facebook-post-search-scraper';
    let finalMaxResults = max_results;
    let configDbId = config_id;

    if (config_id) {
      const configRes = await query(
        `SELECT * FROM marketing_apify_configs WHERE id = $1`,
        [config_id]
      );
      if (configRes.rows.length > 0) {
        const cfg = configRes.rows[0];
        finalKeyword = cfg.keyword;
        finalActorId = cfg.actor_id;
        finalMaxResults = cfg.max_results;
      }
    }

    if (!finalKeyword) {
      return NextResponse.json({ detail: 'keyword é obrigatória' }, { status: 400 });
    }

    // Disparar run no Apify
    const runBody = {
      query: finalKeyword,
      maxResults: finalMaxResults,
    };

    const runResp = await fetch(
      `https://api.apify.com/v2/acts/${encodeURIComponent(finalActorId)}/runs?token=${apifyToken}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(runBody),
      }
    );

    if (!runResp.ok) {
      const errText = await runResp.text();
      return NextResponse.json(
        { detail: `Apify run error: ${errText.slice(0, 200)}` },
        { status: 502 }
      );
    }

    const runData = await runResp.json() as { data?: { id?: string; defaultDatasetId?: string; status?: string } };
    const runId = runData?.data?.id ?? '';
    const datasetId = runData?.data?.defaultDatasetId ?? '';

    // Atualizar last_run no banco
    if (configDbId) {
      await query(
        `UPDATE marketing_apify_configs SET last_run_at = NOW(), last_run_id = $1 WHERE id = $2`,
        [runId, configDbId]
      );
    }

    // Aguardar conclusão do run (polling com timeout de 120s)
    let runStatus = runData?.data?.status ?? 'RUNNING';
    const maxWait = 120000;
    const pollInterval = 5000;
    const startTime = Date.now();

    while (runStatus === 'RUNNING' || runStatus === 'READY') {
      if (Date.now() - startTime > maxWait) break;
      await new Promise((r) => setTimeout(r, pollInterval));
      const statusResp = await fetch(
        `https://api.apify.com/v2/actor-runs/${runId}?token=${apifyToken}`
      );
      if (statusResp.ok) {
        const statusData = await statusResp.json() as { data?: { status?: string } };
        runStatus = statusData?.data?.status ?? runStatus;
      }
    }

    if (runStatus !== 'SUCCEEDED') {
      return NextResponse.json({
        run_id: runId,
        status: runStatus,
        saved: 0,
        duplicates: 0,
        message: `Run ${runStatus} — use o run_id para importar manualmente`,
      });
    }

    // Importar itens do dataset
    const itemsResp = await fetch(
      `https://api.apify.com/v2/datasets/${datasetId}/items?token=${apifyToken}&format=json&limit=${finalMaxResults}`
    );
    if (!itemsResp.ok) {
      return NextResponse.json({ run_id: runId, status: runStatus, saved: 0, duplicates: 0, message: 'Erro ao buscar dataset' });
    }

    const items = await itemsResp.json() as Record<string, unknown>[];
    let saved = 0;
    let duplicates = 0;

    for (const item of items) {
      try {
        const texto = String(item.text || item.message || item.content || '');
        if (!texto || texto.length < 10) continue;

        const link = String(item.url || item.link || item.postUrl || '');
        const usuario = String(item.authorName || item.username || item.user || '');
        const comentarios = Number(item.commentsCount || item.comments || 0);
        const dataPost = item.createdAt || item.date || item.timestamp
          ? new Date(String(item.createdAt || item.date || item.timestamp))
          : new Date();
        const sourceUrl = link;

        // Deduplication
        if (sourceUrl) {
          const existing = await query(
            `SELECT id FROM marketing_leads WHERE source_url = $1 LIMIT 1`,
            [sourceUrl]
          );
          if (existing.rows.length > 0) { duplicates++; continue; }
        }

        // Extrair cidade do texto
        const cidadeMatch = texto.match(/(?:em|na|no|de)\s+([A-ZÀ-Ú][a-zà-ú]+(?:\s+[A-ZÀ-Ú][a-zà-ú]+)?)/);
        const cidade = cidadeMatch ? cidadeMatch[1].trim() : '';

        const tipoItem = detectTipoItem(texto);
        const { score, prioridade } = calcScore(texto, comentarios, dataPost, tipoItem);

        await query(
          `INSERT INTO marketing_leads
            (rede, keyword, texto, link, usuario, data_post, comentarios, cidade, tipo_item,
             score, prioridade, status, origem, source_url)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'novo',$12,$13)`,
          [rede, finalKeyword, texto, link, usuario, dataPost, comentarios, cidade, tipoItem,
           score, prioridade, 'apify-import', sourceUrl]
        );
        saved++;
      } catch {
        // skip invalid items
      }
    }

    return NextResponse.json({
      run_id: runId,
      dataset_id: datasetId,
      status: runStatus,
      saved,
      duplicates,
      total: items.length,
      message: `${saved} leads importados (${duplicates} duplicatas ignoradas)`,
    });
  } catch (error) {
    console.error('[marketing/apify/run POST]', error);
    return NextResponse.json({ detail: 'Erro ao disparar coleta' }, { status: 500 });
  }
}

// ─── POST /api/v1/admin/marketing/apify/run (importar dataset existente) ─────
// Também aceita importar um dataset já existente via run_id
export async function PUT(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;

  const apifyToken = process.env.APIFY_API_TOKEN;
  if (!apifyToken) {
    return NextResponse.json({ detail: 'APIFY_API_TOKEN não configurado' }, { status: 503 });
  }

  try {
    const body = await req.json();
    const { run_id, keyword = '', rede = 'facebook', max_results = 500 } = body;

    if (!run_id) return NextResponse.json({ detail: 'run_id é obrigatório' }, { status: 400 });

    // Buscar dataset do run
    const runResp = await fetch(
      `https://api.apify.com/v2/actor-runs/${run_id}?token=${apifyToken}`
    );
    if (!runResp.ok) {
      return NextResponse.json({ detail: 'Run não encontrado' }, { status: 404 });
    }
    const runData = await runResp.json() as { data?: { defaultDatasetId?: string } };
    const datasetId = runData?.data?.defaultDatasetId;
    if (!datasetId) return NextResponse.json({ detail: 'Dataset não encontrado' }, { status: 404 });

    const itemsResp = await fetch(
      `https://api.apify.com/v2/datasets/${datasetId}/items?token=${apifyToken}&format=json&limit=${max_results}`
    );
    if (!itemsResp.ok) return NextResponse.json({ detail: 'Erro ao buscar dataset' }, { status: 502 });

    const items = await itemsResp.json() as Record<string, unknown>[];
    let saved = 0;
    let duplicates = 0;

    for (const item of items) {
      try {
        const texto = String(item.text || item.message || item.content || '');
        if (!texto || texto.length < 10) continue;

        const link = String(item.url || item.link || item.postUrl || '');
        const usuario = String(item.authorName || item.username || item.user || '');
        const comentarios = Number(item.commentsCount || item.comments || 0);
        const dataPost = item.createdAt || item.date
          ? new Date(String(item.createdAt || item.date))
          : new Date();
        const sourceUrl = link;

        if (sourceUrl) {
          const existing = await query(
            `SELECT id FROM marketing_leads WHERE source_url = $1 LIMIT 1`,
            [sourceUrl]
          );
          if (existing.rows.length > 0) { duplicates++; continue; }
        }

        const cidadeMatch = texto.match(/(?:em|na|no|de)\s+([A-ZÀ-Ú][a-zà-ú]+(?:\s+[A-ZÀ-Ú][a-zà-ú]+)?)/);
        const cidade = cidadeMatch ? cidadeMatch[1].trim() : '';
        const tipoItem = detectTipoItem(texto);
        const { score, prioridade } = calcScore(texto, comentarios, dataPost, tipoItem);

        await query(
          `INSERT INTO marketing_leads
            (rede, keyword, texto, link, usuario, data_post, comentarios, cidade, tipo_item,
             score, prioridade, status, origem, source_url)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'novo',$12,$13)`,
          [rede, keyword, texto, link, usuario, dataPost, comentarios, cidade, tipoItem,
           score, prioridade, 'apify-import', sourceUrl]
        );
        saved++;
      } catch {
        // skip
      }
    }

    return NextResponse.json({
      run_id,
      dataset_id: datasetId,
      saved,
      duplicates,
      total: items.length,
      message: `${saved} leads importados (${duplicates} duplicatas ignoradas)`,
    });
  } catch (error) {
    console.error('[marketing/apify/run PUT]', error);
    return NextResponse.json({ detail: 'Erro ao importar dataset' }, { status: 500 });
  }
}
