export const dynamic = 'force-dynamic';
import { NextRequest } from 'next/server';
import { MATCHING_ATIVO } from '@/lib/matchingSeguranca';
import { awaitSends } from '@/lib/awaitSends';
import { mascararDigitosLongos, camposDeDocumento, statusIgnoraTitular } from '@/lib/documentPrivacy';
import { query } from '@/lib/db';
import { limitesDoPlano, mensagemDeLimite, STATUS_QUE_NAO_CONTAM } from '@/lib/planos';
import { verifyToken, extractTokenFromHeader } from '@/lib/jwt';
import { successResponse, unauthorizedResponse, internalErrorResponse } from '@/lib/response';
import { enqueueSocialPosts } from '@/lib/socialPost';
import { Events } from '@/lib/events';
import { SYSTEM_ACCOUNT_ID } from '@/lib/systemAccount';
import { findSimilarObjects, SIMILAR_OBJECT_ERROR } from '@/lib/similarObjects';
import { colaboradoresAtivo } from '@/lib/colaboradores/rota';
import { resolverColaborador, CODIGO_COLABORADOR_INVALIDO, MENSAGEM_CODIGO_INVALIDO, type ColaboradorResolvido } from '@/lib/colaboradores/codigo';

// Limites de objetos por plano: fonte única em `src/lib/planos.ts` (PL-01).

// Helper para normalizar um row do banco para o formato RegisteredObject
function normalizeObject(row: Record<string, unknown>) {
  const lat = row.latitude ? parseFloat(String(row.latitude)) : null;
  const lng = row.longitude ? parseFloat(String(row.longitude)) : null;

  let location = null;
  if (lat && lng && !isNaN(lat) && !isNaN(lng)) {
    location = { lat, lng, address: row.location as string || undefined };
  } else if (row.location && typeof row.location === 'string') {
    try {
      const parsed = JSON.parse(row.location as string);
      if (parsed.lat && parsed.lng) location = parsed;
    } catch { /* não é JSON */ }
  }

  let photos: string[] = [];
  try {
    if (Array.isArray(row.images)) photos = row.images as string[];
    else if (typeof row.images === 'string') photos = JSON.parse(row.images as string);
  } catch { photos = []; }

  return {
    id: row.id,
    title: row.title,
    description: row.description || '',
    status: row.status,
    category: row.category || row.type || 'other',
    unique_code: row.qr_code,
    owner_id: row.user_id,
    photos,
    location,
    color: row.color,
    brand: row.brand,
    pet_breed: row.breed,
    is_legacy: row.is_legacy,
    source: row.source,
    reward_amount: row.reward_amount ? parseFloat(String(row.reward_amount)) : null,
    reward_description: row.reward_description || null,
    category_fields: row.category_fields || {},
    // Só a lista do próprio dono precisa: o painel usa para o aviso «alguém pode ter encontrado» (marca real, não o status do objeto).
    found_pending_confirmation: row.found_pending_confirmation === true,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = extractTokenFromHeader(authHeader);

    if (!token) return unauthorizedResponse();

    const payload = verifyToken(token);
    if (!payload) return unauthorizedResponse();

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const page = parseInt(searchParams.get('page') || '1');
    const size = Math.min(parseInt(searchParams.get('size') || '20'), 100);
    const offset = (page - 1) * size;

    const params: unknown[] = [payload.sub];
    const conditions = ['user_id = $1'];

    if (status) {
      params.push(status);
      conditions.push(`status = $${params.length}`);
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const result = await query(
      `SELECT id, title, description, status, category, type, location, latitude, longitude,
              qr_code, images, color, brand, breed, is_legacy, source, user_id,
              reward_amount, reward_description, category_fields, created_at, updated_at,
              found_pending_confirmation
       FROM objects
       ${whereClause}
       ORDER BY created_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, size, offset]
    );

    const countResult = await query(
      `SELECT COUNT(*) as count FROM objects ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].count);

    const items = result.rows.map((row: Record<string, unknown>) => normalizeObject(row));

    return successResponse({
      items,
      total,
      page,
      size,
      pages: Math.ceil(total / size),
    });
  } catch (error) {
    return internalErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = extractTokenFromHeader(authHeader);

    if (!token) return unauthorizedResponse();

    const payload = verifyToken(token);
    if (!payload) return unauthorizedResponse();

    // ── Verificar limite de objetos por plano ──────────────────────────────
    const userResult = await query(
      `SELECT plan, plan_expires_at FROM users WHERE id = $1`,
      [payload.sub]
    );

    if (userResult.rows.length === 0) return unauthorizedResponse();

    const userRow = userResult.rows[0] as { plan: string; plan_expires_at: string | null };
    const rawPlan = userRow.plan || 'free';

    // Verificar se o plano pago ainda está ativo
    const isPaidActive = rawPlan !== 'free' && (
      !userRow.plan_expires_at || new Date(userRow.plan_expires_at) > new Date()
    );
    const effectivePlan = isPaidActive ? rawPlan : 'free';
    const limites = limitesDoPlano(effectivePlan);
    const maxObjects = limites.maxObjetos;

    // Conta só objetos ATIVOS do próprio usuário: arquivados, devolvidos, apagados e LEGADOS não ocupam vaga (PL-01, vale para todos os planos).
    // O limite diário (só free) olha os cadastros das últimas 24 h, de qualquer status, para não ser burlado apagando e recriando.
    const countResult = await query(
      `SELECT COUNT(*) FILTER (WHERE status <> ALL($2::text[]) AND COALESCE(is_legacy, false) = false) AS ativos,
              COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours' AND COALESCE(is_legacy, false) = false) AS hoje
         FROM objects WHERE user_id = $1`,
      [payload.sub, [...STATUS_QUE_NAO_CONTAM]]
    );
    const currentCount = parseInt(countResult.rows[0].ativos);
    const criadosHoje = parseInt(countResult.rows[0].hoje);

    const tipoDeLimite: 'total' | 'diario' | null =
      currentCount >= maxObjects ? 'total'
      : (limites.maxPorDia !== null && criadosHoje >= limites.maxPorDia) ? 'diario'
      : null;

    if (tipoDeLimite) {
      return successResponse(
        {
          error: 'limit_reached',
          limit_type: tipoDeLimite,
          message: mensagemDeLimite(tipoDeLimite, effectivePlan, limites),
          current_count: currentCount,
          max_objects: maxObjects,
          plan: effectivePlan,
          upgrade_url: '/pricing',
        },
        403
      );
    }
    // ──────────────────────────────────────────────────────────────────────

    const body = await request.json();
    const { title: tituloBruto, description: descricaoBruta, status, type, category, location, images, reward_amount, reward_description, confirm_duplicate, colaborador_codigo: colaboradorCodigoBruto, ...categoryFields } = body;
    let { latitude, longitude } = body;

    // Documento de USUÁRIO: o número nunca fica inteiro (só os 4 últimos dígitos); sequências longas no texto livre são mascaradas.
    // Só esta categoria muda; as demais seguem exatamente como antes.
    const ehDocumento = (category || type) === 'document';
    const mascarar = (t: unknown) => (ehDocumento && typeof t === 'string' ? mascararDigitosLongos(t) : t);
    const title = mascarar(tituloBruto) as typeof tituloBruto;
    const description = mascarar(descricaoBruta) as typeof descricaoBruta;
    // «Encontrei»: titular e final do documento recebidos são ignorados (não se grava o nome inteiro de um terceiro).
    const ignoraTitular = ehDocumento && statusIgnoraTitular(status || 'lost');
    const doc = ehDocumento ? (ignoraTitular ? { subjectName: null, documentType: camposDeDocumento(body).documentType, last4: null } : camposDeDocumento(body)) : null;
    if (ehDocumento) {
      // Lista fechada: só coordenadas (como já era) e os 4 últimos dígitos. Nada de número inteiro, e nenhuma chave desconhecida, no banco.
      for (const k of Object.keys(categoryFields)) {
        if (k !== 'latitude' && k !== 'longitude') delete (categoryFields as Record<string, unknown>)[k];
      }
      if (doc!.last4) (categoryFields as Record<string, unknown>).document_last4 = doc!.last4;
    }

    if (!title || (!type && !category)) {
      return successResponse({ detail: 'Title and type/category are required' }, 400);
    }

    // ── Programa de Colaboradores (E1): código do colaborador, lido de forma EXPLÍCITA (a chave acima sai de `categoryFields`: nunca vai para `category_fields`).
    // Só com COLABORADORES_ATIVO=1; desligado, o valor é ignorado e nenhuma consulta é feita. Código inválido ou de colaborador inativo: o cadastro NÃO é criado.
    let colaborador: ColaboradorResolvido | null = null;
    if (colaboradoresAtivo() && colaboradorCodigoBruto !== undefined && colaboradorCodigoBruto !== null && !(typeof colaboradorCodigoBruto === 'string' && colaboradorCodigoBruto.trim() === '')) {
      colaborador = await resolverColaborador(query, colaboradorCodigoBruto);
      if (!colaborador) {
        return successResponse({ error: CODIGO_COLABORADOR_INVALIDO, detail: MENSAGEM_CODIGO_INVALIDO }, 400);
      }
    }

    // ── Aviso de objeto parecido (nunca bloqueia: confirm_duplicate: true cria) ──
    // Só objetos do próprio usuário, mesma categoria. Conta de sistema não passa por aqui.
    if (confirm_duplicate !== true && payload.sub !== SYSTEM_ACCOUNT_ID && typeof title === 'string') {
      try {
        const similar = await findSimilarObjects(query, {
          userId: payload.sub,
          category: category || type,
          title,
          description,
        });
        if (similar.length > 0) {
          return successResponse(
            {
              error: SIMILAR_OBJECT_ERROR,
              detail: 'Você já tem um objeto parecido com este.',
              similar_objects: similar,
            },
            409
          );
        }
      } catch (err) {
        // Falha na checagem não pode impedir o cadastro: segue sem aviso.
        console.error('Similar-object check failed, continuing without warning:', err);
      }
    }

    // Geocoding fallback: se não tem lat/lng mas tem endereço, geocodificar via Mapbox
    if ((!latitude || !longitude) && location && typeof location === 'string' && location.trim().length > 2) {
      const mapboxToken = process.env.MAPBOX_SERVER_TOKEN || process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
      if (mapboxToken) {
        try {
          const geoRes = await fetch(
            `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(location)}.json?access_token=${mapboxToken}&language=pt&limit=1&country=br`
          );
          if (geoRes.ok) {
            const geoData = await geoRes.json();
            const coords = geoData.features?.[0]?.center; // [lng, lat]
            if (coords && coords.length === 2) {
              longitude = coords[0];
              latitude = coords[1];
            }
          }
        } catch { /* geocoding falhou - salvar sem coordenadas */ }
      }
    }

    const cat = category || type;
    const qrCode = `${Math.random().toString(36).substring(2, 10).toUpperCase()}`;

    // Com colaborador: comando próprio (as 2 colunas da atribuição entram no MESMO INSERT, e o gatilho do banco impede mudá-las depois). Sem colaborador: o comando original, igual ao de sempre.
    const result = colaborador ? await query(
      `INSERT INTO objects (user_id, title, description, status, category, type, location, latitude, longitude, qr_code, images, is_public, reward_amount, reward_description, category_fields, subject_name, document_type, created_at, updated_at, colaborador_id, colaborador_codigo)
       VALUES ($1, $2, $3, $4, $5, $5, $6, $7, $8, $9, $10, true, $11, $12, $13, $14, $15, NOW(), NOW(), $16, $17)
       RETURNING id, title, description, status, category, type, location, latitude, longitude, qr_code, images, reward_amount, reward_description, category_fields, created_at, updated_at`,
      [payload.sub, title, description || null, status || 'lost', cat, location || null, latitude || null, longitude || null, qrCode, JSON.stringify(images || []), reward_amount || null, reward_description || null, JSON.stringify(categoryFields), doc?.subjectName ?? null, doc?.documentType ?? null, colaborador.id, colaborador.codigoRegistrado]
    ) : await query(
      `INSERT INTO objects (user_id, title, description, status, category, type, location, latitude, longitude, qr_code, images, is_public, reward_amount, reward_description, category_fields, subject_name, document_type, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $5, $6, $7, $8, $9, $10, true, $11, $12, $13, $14, $15, NOW(), NOW())
       RETURNING id, title, description, status, category, type, location, latitude, longitude, qr_code, images, reward_amount, reward_description, category_fields, created_at, updated_at`,
      [payload.sub, title, description || null, status || 'lost', cat, location || null, latitude || null, longitude || null, qrCode, JSON.stringify(images || []), reward_amount || null, reward_description || null, JSON.stringify(categoryFields), doc?.subjectName ?? null, doc?.documentType ?? null]
    );

    const newObject = normalizeObject(result.rows[0] as Record<string, unknown>);

    // ── Registrar eventos no Sistema Vivo (fire-and-forget) ──────────────
    Events.objectCreated(newObject.id as string, payload.sub).catch(() => {});
    Events.objectPublished(newObject.id as string).catch(() => {});
    Events.objectIndexed(newObject.id as string).catch(() => {});
    if (newObject.status === 'protected') {
      Events.qrGenerated(newObject.id as string, payload.sub, { via: 'create_protected' }).catch(() => {});
    }

    // ── Enfileirar posts sociais automáticos (fire-and-forget) ────────────
    enqueueSocialPosts({
      id: newObject.id as string,
      title: newObject.title as string,
      description: newObject.description as string | null,
      status: newObject.status as string,
      category: newObject.category as string,
      unique_code: (newObject.unique_code as string) ?? qrCode,
      qr_code: qrCode,
      location: newObject.location as { address?: string } | null,
      images: (newObject.photos as string[]) ?? [],
      reward_amount: newObject.reward_amount as number | null,
      reward_description: newObject.reward_description as string | null,
    }).catch(() => { /* silencioso — não bloquear o cadastro */ });

    // ── Disparar matching automático ──────────────────────────────────────
    // Só com MATCHING_ATIVO=1 (desligado por padrão: nada acontece aqui). O corpo leva `objectId`, o nome que a rota lê
    // (antes ia `object_id` e a rota respondia 400, então o gancho nunca funcionou).
    // Em função serverless, a chamada solta pode ser interrompida antes de sair; por isso se espera, no máximo 1 segundo, só o suficiente
    // para ela ser despachada (o matching roda em outra chamada, que continua depois). O cadastro nunca falha nem espera mais que isso por causa do matching.
    if (MATCHING_ATIVO() && payload.sub !== SYSTEM_ACCOUNT_ID) {
      try {
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://backfindr.com';
        const disparo = fetch(`${baseUrl}/api/v1/matching/run`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({ objectId: newObject.id }),
        }).catch((err) => { console.error('[matching] gancho de criação falhou:', err); });
        await awaitSends([disparo], 1000);
      } catch (err) {
        console.error('[matching] gancho de criação falhou:', err);
      }
    }

    return successResponse(newObject, 201);
  } catch (error) {
    return internalErrorResponse(error);
  }
}
