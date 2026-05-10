export const dynamic = 'force-dynamic';
import { NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { verifyToken, extractTokenFromHeader } from '@/lib/jwt';
import { successResponse, unauthorizedResponse, internalErrorResponse } from '@/lib/response';
import { enqueueSocialPosts } from '@/lib/socialPost';

// Limites de objetos por plano
const PLAN_MAX_OBJECTS: Record<string, number> = {
  free:     3,
  pro:      50,
  business: 500,
};

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
              reward_amount, reward_description, created_at, updated_at
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
    const maxObjects = PLAN_MAX_OBJECTS[effectivePlan] ?? PLAN_MAX_OBJECTS['free'];

    // Contar objetos ativos do usuário (excluindo deletados/arquivados)
    const countResult = await query(
      `SELECT COUNT(*) as count FROM objects WHERE user_id = $1 AND status != 'deleted'`,
      [payload.sub]
    );
    const currentCount = parseInt(countResult.rows[0].count);

    if (currentCount >= maxObjects) {
      return successResponse(
        {
          error: 'limit_reached',
          message: `Você atingiu o limite de ${maxObjects} objeto${maxObjects !== 1 ? 's' : ''} do plano ${effectivePlan}. Faça upgrade para adicionar mais.`,
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
    const { title, description, status, type, category, location, latitude, longitude, images, reward_amount, reward_description } = body;

    if (!title || (!type && !category)) {
      return successResponse({ detail: 'Title and type/category are required' }, 400);
    }

    const cat = category || type;
    const qrCode = `${Math.random().toString(36).substring(2, 10).toUpperCase()}`;

    const result = await query(
      `INSERT INTO objects (user_id, title, description, status, category, type, location, latitude, longitude, qr_code, images, is_public, reward_amount, reward_description, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $5, $6, $7, $8, $9, $10, true, $11, $12, NOW(), NOW())
       RETURNING id, title, description, status, category, type, location, latitude, longitude, qr_code, images, reward_amount, reward_description, created_at, updated_at`,
      [payload.sub, title, description || null, status || 'lost', cat, location || null, latitude || null, longitude || null, qrCode, JSON.stringify(images || []), reward_amount || null, reward_description || null]
    );

    const newObject = normalizeObject(result.rows[0] as Record<string, unknown>);

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

    return successResponse(newObject, 201);
  } catch (error) {
    return internalErrorResponse(error);
  }
}
