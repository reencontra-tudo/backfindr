export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminGuard';
import { query } from '@/lib/db';
import { z } from 'zod';
import { SYSTEM_ACCOUNT_ID } from '@/lib/systemAccount';
import { buildPublicSignalDescription } from '@/lib/publicSignals/description';

// ─── GET /api/v1/admin/public-signals ──────────────────────────────────────
// Fila de aprovação (seção 6 do prompt master). Lista evidências
// pendentes (ou outro status via ?status=) pra revisão manual — nada aqui
// nunca foi promovido a objects até um admin aprovar explicitamente.
export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;

  const url    = new URL(req.url);
  const status = url.searchParams.get('status') || 'pending';
  const page   = Math.max(1, parseInt(url.searchParams.get('page') ?? '1', 10));
  const size   = Math.min(100, Math.max(1, parseInt(url.searchParams.get('size') ?? '20', 10)));
  const offset = (page - 1) * size;

  try {
    const [countRes, rowsRes, pendingRes] = await Promise.all([
      query(`SELECT COUNT(*) FROM public_signal_evidence WHERE status = $1`, [status]),
      query(
        `SELECT id, source_url, source_type, has_contact_data, extracted_fields,
                dedup_hash, expires_at, status, object_id, captured_at
         FROM public_signal_evidence
         WHERE status = $1
         ORDER BY captured_at DESC
         LIMIT $2 OFFSET $3`,
        [status, size, offset]
      ),
      query(`SELECT COUNT(*) FROM public_signal_evidence WHERE status = 'pending'`),
    ]);
    return NextResponse.json({
      items: rowsRes.rows,
      total: parseInt(countRes.rows[0].count, 10),
      pending: parseInt(pendingRes.rows[0].count, 10),
      page,
      size,
    });
  } catch (e) {
    console.error('[admin/public-signals GET]', e);
    return NextResponse.json({ items: [], total: 0, pending: 0 });
  }
}

// ─── POST /api/v1/admin/public-signals ─────────────────────────────────────
// approve: cria o objects (user_id=conta-âncora, source='public_signal',
// is_public=true) a partir dos campos já extraídos, geocodifica o
// location_text (mesmo fallback Mapbox do cadastro normal — sem isso o
// objeto nunca apareceria como pin no mapa, só entraria na busca por
// texto). reject: só marca status, não cria nada.
const ActionSchema = z.object({
  evidence_id: z.string().uuid(),
  action: z.enum(['approve', 'reject']),
});

// regionHint (27/08/2026): backstop deterministico contra a LLM esquecer de
// incluir a regiao no location_text. Achado real: "Cachorro encontrado no
// bairro Parque Verde" (fonte CGN, regiao fixa "Cascavel, PR") geocodificou
// para o bairro homonimo de Belem-PA porque location_text veio so como
// "Parque Verde" -- a LLM nao seguiu a instrucao do prompt de completar com
// a regiao. regionHint agora vem persistido desde a ingestao (migration
// 015), entao nao depende mais so da LLM ter feito certo: (1) garante a
// regiao na propria query mandada pro Mapbox se o texto ainda nao a
// mencionar, e (2) valida o place_name do resultado contra a regiao antes
// de aceitar -- prefere null (sem pin, bonus neutro no matching) a um pin
// errado virando ima de match falso.
async function geocode(
  locationText: string,
  regionHint: string | null
): Promise<{ lat: number | null; lng: number | null }> {
  const mapboxToken = process.env.MAPBOX_SERVER_TOKEN || process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  if (!mapboxToken || !locationText || locationText.trim().length < 2) return { lat: null, lng: null };

  const regionCity = regionHint ? regionHint.split(',')[0].trim().toLowerCase() : null;
  const alreadyHasRegion = regionCity && locationText.toLowerCase().includes(regionCity);
  const geocodeQuery = regionHint && !alreadyHasRegion
    ? `${locationText}, ${regionHint}`
    : locationText;

  try {
    const geoRes = await fetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(geocodeQuery)}.json?access_token=${mapboxToken}&language=pt&limit=1&country=br`,
      { signal: AbortSignal.timeout(8000) }
    );
    if (!geoRes.ok) return { lat: null, lng: null };
    const geoData = await geoRes.json();
    const feature = geoData.features?.[0];
    const coords = feature?.center; // [lng, lat]
    if (!coords || coords.length !== 2) return { lat: null, lng: null };

    if (regionCity) {
      const placeName = String(feature.place_name || '').toLowerCase();
      if (!placeName.includes(regionCity)) {
        // Resultado do Mapbox nao bate com a regiao conhecida da fonte —
        // mesmo padrao do bug real (Belem-PA em vez de Cascavel-PR). Sem
        // local é mais seguro que local errado.
        return { lat: null, lng: null };
      }
    }

    return { lat: coords[1], lng: coords[0] };
  } catch {
    return { lat: null, lng: null };
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;
  const { user: adminUser } = auth;

  const body = await req.json();
  const parsed = ActionSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ detail: parsed.error.issues }, { status: 400 });
  const { evidence_id, action } = parsed.data;

  try {
    const evidenceRes = await query(`SELECT * FROM public_signal_evidence WHERE id = $1`, [evidence_id]);
    if (evidenceRes.rows.length === 0) {
      return NextResponse.json({ detail: 'Evidência não encontrada' }, { status: 404 });
    }
    const evidence = evidenceRes.rows[0];
    if (evidence.status !== 'pending') {
      return NextResponse.json({ detail: `Já foi revisada (status atual: ${evidence.status})` }, { status: 409 });
    }

    if (action === 'reject') {
      await query(
        `UPDATE public_signal_evidence SET status = 'rejected', reviewed_by = $1 WHERE id = $2`,
        [adminUser.id, evidence_id]
      );
      return NextResponse.json({ success: true, action: 'reject' });
    }

    // ── approve ────────────────────────────────────────────────────────────
    const fields = evidence.extracted_fields as {
      title?: string; category?: string; status_guess?: string; location_text?: string | null;
    } | null;
    if (!fields?.title) {
      return NextResponse.json({ detail: 'extracted_fields incompleto — não é possível aprovar' }, { status: 422 });
    }

    const { lat, lng } = fields.location_text
      ? await geocode(fields.location_text, evidence.region_hint ?? null)
      : { lat: null, lng: null };
    const qrCode = `${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
    const status = ['lost', 'found', 'stolen'].includes(fields.status_guess ?? '') ? fields.status_guess : 'lost';
    const category = fields.category || 'other';

    const objectRes = await query(
      `INSERT INTO objects
         (user_id, title, description, status, category, type, location, latitude, longitude,
          qr_code, images, is_public, category_fields, source, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $5, $6, $7, $8, $9, $10, true, $11, 'public_signal', NOW(), NOW())
       RETURNING id`,
      [
        SYSTEM_ACCOUNT_ID,
        fields.title,
        buildPublicSignalDescription(fields, evidence.source_url, evidence.source_type),
        status,
        category,
        fields.location_text || null,
        lat,
        lng,
        qrCode,
        JSON.stringify([]),
        JSON.stringify({}),
      ]
    );
    const objectId = objectRes.rows[0].id;

    await query(
      `UPDATE public_signal_evidence SET status = 'approved', object_id = $1, reviewed_by = $2 WHERE id = $3`,
      [objectId, adminUser.id, evidence_id]
    );

    return NextResponse.json({ success: true, action: 'approve', object_id: objectId, geocoded: lat !== null });
  } catch (e) {
    console.error('[admin/public-signals POST]', e);
    return NextResponse.json({ detail: 'Erro ao processar ação' }, { status: 500 });
  }
}
