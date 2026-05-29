export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requireAuth, requireAdmin } from '@/lib/adminGuard';
import { z } from 'zod';

const EstabelecimentoSchema = z.object({
  nome:           z.string().min(2).max(200),
  slug:           z.string().min(2).max(200).regex(/^[a-z0-9-]+$/),
  telefone:       z.string().max(30).optional(),
  endereco:       z.string().min(5),
  lat:            z.number().optional(),
  lng:            z.number().optional(),
  cidade:         z.string().max(100).optional(),
  estado:         z.string().length(2).optional(),
  b2b_partner_id: z.string().uuid().optional(),
});

// GET /api/v1/delivery/estabelecimentos — admin lista todos
export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;

  const url    = new URL(req.url);
  const search = url.searchParams.get('search') ?? '';
  const page   = Math.max(1, parseInt(url.searchParams.get('page') ?? '1'));
  const size   = Math.min(100, parseInt(url.searchParams.get('size') ?? '20'));
  const offset = (page - 1) * size;

  const conditions: string[] = [];
  const params: unknown[]    = [];
  let idx = 1;

  if (search) {
    conditions.push(`(e.nome ILIKE $${idx} OR e.cidade ILIKE $${idx})`);
    params.push(`%${search}%`);
    idx++;
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  try {
    const [countRes, rowsRes] = await Promise.all([
      query(`SELECT COUNT(*) FROM estabelecimentos e ${where}`, params),
      query(
        `SELECT e.* FROM estabelecimentos e
         ${where}
         ORDER BY e.created_at DESC
         LIMIT $${idx} OFFSET $${idx + 1}`,
        [...params, size, offset]
      ),
    ]);

    return NextResponse.json({
      items: rowsRes.rows,
      total: parseInt(countRes.rows[0].count, 10),
      page,
      size,
    });
  } catch (e: unknown) {
    return NextResponse.json({ detail: String(e) }, { status: 500 });
  }
}

// POST /api/v1/delivery/estabelecimentos — admin cria estabelecimento
export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;

  const body   = await req.json();
  const parsed = EstabelecimentoSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ detail: parsed.error.issues }, { status: 400 });
  }

  const { nome, slug, telefone, endereco, lat, lng, cidade, estado, b2b_partner_id } = parsed.data;

  try {
    const slugCheck = await query(
      `SELECT id FROM estabelecimentos WHERE slug = $1`, [slug]
    );
    if (slugCheck.rows.length > 0) {
      return NextResponse.json({ detail: 'Slug já em uso' }, { status: 409 });
    }

    const res = await query(
      `INSERT INTO estabelecimentos
         (nome, slug, telefone, endereco, lat, lng, cidade, estado, b2b_partner_id, criado_por)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       RETURNING *`,
      [
        nome, slug, telefone ?? null, endereco,
        lat ?? null, lng ?? null, cidade ?? null, estado ?? null,
        b2b_partner_id ?? null, auth.user.id,
      ]
    );

    return NextResponse.json(res.rows[0], { status: 201 });
  } catch (e: unknown) {
    return NextResponse.json({ detail: String(e) }, { status: 500 });
  }
}
