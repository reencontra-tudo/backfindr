export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminGuard';
import { query } from '@/lib/db';
import { z } from 'zod';

const PartnerSchema = z.object({
  name:    z.string().min(2).max(200),
  type:    z.enum(['condominio', 'shopping', 'hotel', 'transporte', 'saude', 'educacao', 'outro']),
  city:    z.string().min(2).max(200),
  contact: z.string().min(2).max(200),
  email:   z.string().email(),
  phone:   z.string().optional(),
  notes:   z.string().optional(),
});

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;
  const url    = new URL(req.url);
  const status = url.searchParams.get('status') ?? '';
  const search = url.searchParams.get('search') ?? '';
  const page   = Math.max(1, parseInt(url.searchParams.get('page') ?? '1', 10));
  const size   = Math.min(100, Math.max(1, parseInt(url.searchParams.get('size') ?? '20', 10)));
  const offset = (page - 1) * size;
  const conditions: string[] = []; const params: unknown[] = []; let idx = 1;
  if (status) { conditions.push(`status = $${idx}`); params.push(status); idx++; }
  if (search) { conditions.push(`(name ILIKE $${idx} OR city ILIKE $${idx} OR email ILIKE $${idx})`); params.push(`%${search}%`); idx++; }
  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  try {
    const [countRes, rowsRes] = await Promise.all([
      query(`SELECT COUNT(*) FROM b2b_partners ${where}`, params),
      query(`SELECT * FROM b2b_partners ${where} ORDER BY created_at DESC LIMIT $${idx} OFFSET $${idx+1}`, [...params, size, offset]),
    ]);
    return NextResponse.json({ items: rowsRes.rows, total: parseInt(countRes.rows[0].count, 10), page, size });
  } catch (e) { return NextResponse.json({ items: [], total: 0 }); }
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;
  const body = await req.json();
  const parsed = PartnerSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ detail: parsed.error.issues }, { status: 400 });
  const { name, type, city, contact, email, phone, notes } = parsed.data;
  try {
    const res = await query(
      `INSERT INTO b2b_partners (name, type, city, contact, email, phone, notes) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [name, type, city, contact, email, phone ?? null, notes ?? null]
    );
    return NextResponse.json(res.rows[0], { status: 201 });
  } catch (e) { return NextResponse.json({ detail: 'Erro ao criar parceiro' }, { status: 500 }); }
}
