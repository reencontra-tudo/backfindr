export const dynamic = 'force-dynamic';
import { NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { successResponse, notFoundResponse, internalErrorResponse } from '@/lib/response';
import { Events } from '@/lib/events';
import { POST as notifyOwnerOfScan } from './notify/route';

export async function GET(
  request: NextRequest,
  { params }: { params: { code: string } }
) {
  try {
    // Busca por qr_code OU por id (UUID) para suportar links do mapa
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(params.code);
    const result = await query(
      `SELECT id, title, description, status, category, type, location, latitude, longitude,
              qr_code, images, color, brand, breed, is_legacy, source,
              reward_amount, reward_description, created_at, updated_at,
              (is_legacy IS TRUE OR EXISTS (SELECT 1 FROM users u WHERE u.id = objects.user_id AND u.is_legacy IS TRUE)) AS legacy_blocked
       FROM objects
       WHERE ${isUUID ? 'id::text = $1 OR qr_code = $1' : 'qr_code = $1'}`,
      [params.code]
    );

    if (result.rows.length === 0) return notFoundResponse();

    const row = result.rows[0] as Record<string, unknown>;
    const lat = row.latitude ? parseFloat(String(row.latitude)) : null;
    const lng = row.longitude ? parseFloat(String(row.longitude)) : null;
    let location = null;
    if (lat && lng && !Number.isNaN(lat) && !Number.isNaN(lng)) {
      location = { lat, lng, address: (row.location as string) || undefined };
    } else if (row.location && typeof row.location === 'string') {
      try { const p = JSON.parse(row.location as string); if (p.lat && p.lng) location = p; } catch { /* não é JSON */ }
    }
    let photos: string[] = [];
    try {
      if (Array.isArray(row.images)) photos = row.images as string[];
      else if (typeof row.images === 'string') photos = JSON.parse(row.images as string);
    } catch { photos = []; }

    // ── Registrar a ABERTURA DA PÁGINA no Sistema Vivo (fire-and-forget) ────────────────
    // Este evento é só «alguém abriu a página» (sem metadata.via): pode ser pessoa, robô, pré-visualização de link.
    // Escaneamento REAL de pessoa é o evento com metadata.via, gravado pelo POST …/notify (ver src/lib/events.ts).
    // Não se grava abertura de página de objeto do LEGADO (objeto ou dono legado; mesma regra do aviso ao dono)
    // nem de SINAL PÚBLICO: o legado não gera métrica (DECISOES B-27/Q-07) e sinal público não tem dono a quem mostrar.
    // A resposta JSON abaixo não muda.
    if (row.legacy_blocked !== true && row.source !== 'public_signal') {
      Events.qrScanned(row.id as string).catch(() => {});
    }

    return successResponse({
      id: row.id, title: row.title, description: row.description || '',
      status: row.status, category: row.category || row.type || 'other',
      unique_code: row.qr_code, photos, location,
      color: row.color, brand: row.brand, pet_breed: row.breed,
      is_legacy: row.is_legacy, source: row.source,
      reward_amount: row.reward_amount ? parseFloat(String(row.reward_amount)) : null,
      reward_description: row.reward_description || null,
      created_at: row.created_at, updated_at: row.updated_at,
    });
  } catch (error) {
    return internalErrorResponse(error);
  }
}

// Este endpoint não é chamado por nenhum cliente do repositório (a interface usa /notify). Para não manter
// duas regras de aviso, ele passa a ser um alias fino do /notify: mesmo intervalo de 15 min, mesma notificação
// com url, mesmo e-mail e mesma barreira de legado. A resposta mantém o formato próprio; o corpo da requisição
// (texto livre) deixa de ser usado, para que um visitante anônimo não escolha o texto que o dono recebe.
export async function POST(
  request: NextRequest,
  { params }: { params: { code: string } }
) {
  const res = await notifyOwnerOfScan(request, { params });
  if (!res.ok) return res;
  return successResponse({ message: 'Notification sent' });
}
