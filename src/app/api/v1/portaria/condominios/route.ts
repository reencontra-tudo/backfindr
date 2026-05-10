export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requireAdmin, requireAuth } from '@/lib/adminGuard';
import { z } from 'zod';

const CondominioSchema = z.object({
  nome:           z.string().min(2).max(200),
  slug:           z.string().min(2).max(200).regex(/^[a-z0-9-]+$/, 'Slug deve conter apenas letras minúsculas, números e hífens'),
  endereco:       z.string().min(5),
  cidade:         z.string().min(2).max(100),
  estado:         z.string().length(2),
  cep:            z.string().optional(),
  total_unidades: z.number().int().min(1).optional(),
  logo_url:       z.string().url().optional(),
  b2b_partner_id: z.string().uuid().optional(),
  whatsapp_notify:z.boolean().optional(),
  push_notify:    z.boolean().optional(),
  email_notify:   z.boolean().optional(),
});

// GET /api/v1/portaria/condominios — admin lista todos
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
    conditions.push(`(c.nome ILIKE $${idx} OR c.cidade ILIKE $${idx} OR c.slug ILIKE $${idx})`);
    params.push(`%${search}%`);
    idx++;
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  try {
    const [countRes, rowsRes] = await Promise.all([
      query(`SELECT COUNT(*) FROM condominios c ${where}`, params),
      query(
        `SELECT c.*, b.name AS parceiro_nome
         FROM condominios c
         LEFT JOIN b2b_partners b ON b.id = c.b2b_partner_id
         ${where}
         ORDER BY c.created_at DESC
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

// POST /api/v1/portaria/condominios — admin cria condomínio
export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;

  const body   = await req.json();
  const parsed = CondominioSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ detail: parsed.error.issues }, { status: 400 });
  }

  const {
    nome, slug, endereco, cidade, estado, cep,
    total_unidades, logo_url, b2b_partner_id,
    whatsapp_notify, push_notify, email_notify,
  } = parsed.data;

  try {
    // Verificar slug único
    const slugCheck = await query(`SELECT id FROM condominios WHERE slug = $1`, [slug]);
    if (slugCheck.rows.length > 0) {
      return NextResponse.json({ detail: 'Slug já em uso' }, { status: 409 });
    }

    const res = await query(
      `INSERT INTO condominios
         (nome, slug, endereco, cidade, estado, cep, total_unidades, logo_url,
          b2b_partner_id, whatsapp_notify, push_notify, email_notify, criado_por)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       RETURNING *`,
      [
        nome, slug, endereco, cidade, estado, cep ?? null,
        total_unidades ?? 0, logo_url ?? null,
        b2b_partner_id ?? null,
        whatsapp_notify ?? true,
        push_notify ?? true,
        email_notify ?? true,
        auth.user.id,
      ]
    );

    return NextResponse.json(res.rows[0], { status: 201 });
  } catch (e: unknown) {
    return NextResponse.json({ detail: String(e) }, { status: 500 });
  }
}
