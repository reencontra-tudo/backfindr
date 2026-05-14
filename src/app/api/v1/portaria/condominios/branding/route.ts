export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requireAuth } from '@/lib/adminGuard';
import { z } from 'zod';

const HEX_COLOR = /^#[0-9A-Fa-f]{6}$/;

const BrandingSchema = z.object({
  logo_url:              z.string().url().nullable().optional(),
  banner_url:            z.string().url().nullable().optional(),
  cor_primaria:          z.string().regex(HEX_COLOR, 'Cor inválida — use formato #RRGGBB').optional(),
  cor_texto:             z.string().regex(HEX_COLOR, 'Cor inválida — use formato #RRGGBB').optional(),
  mensagem_boas_vindas:  z.string().max(300).nullable().optional(),
  nome:                  z.string().min(2).max(200).optional(),
});

// GET /api/v1/portaria/condominios/branding?condominio_id=...
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const condominioId = new URL(req.url).searchParams.get('condominio_id');
  if (!condominioId) {
    return NextResponse.json({ detail: 'condominio_id obrigatório' }, { status: 400 });
  }

  try {
    const res = await query(
      `SELECT id, nome, slug, logo_url, banner_url,
              cor_primaria, cor_texto, mensagem_boas_vindas,
              cidade, estado, total_unidades, active
       FROM condominios
       WHERE id = $1`,
      [condominioId]
    );

    if (res.rows.length === 0) {
      return NextResponse.json({ detail: 'Condomínio não encontrado' }, { status: 404 });
    }

    return NextResponse.json(res.rows[0]);
  } catch (e: unknown) {
    return NextResponse.json({ detail: String(e) }, { status: 500 });
  }
}

// PATCH /api/v1/portaria/condominios/branding?condominio_id=...
export async function PATCH(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const condominioId = new URL(req.url).searchParams.get('condominio_id');
  if (!condominioId) {
    return NextResponse.json({ detail: 'condominio_id obrigatório' }, { status: 400 });
  }

  const body   = await req.json();
  const parsed = BrandingSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ detail: parsed.error.issues }, { status: 400 });
  }

  // Verificar acesso — admin ou b2b_admin do parceiro deste condomínio
  const podeEditar = await verificarAcesso(auth.user.id, auth.user.role, condominioId);
  if (!podeEditar) {
    return NextResponse.json({ detail: 'Sem permissão para editar este condomínio' }, { status: 403 });
  }

  const fields = parsed.data;
  const updates: Record<string, unknown> = {};

  if (fields.logo_url !== undefined)             updates.logo_url             = fields.logo_url;
  if (fields.banner_url !== undefined)           updates.banner_url           = fields.banner_url;
  if (fields.cor_primaria !== undefined)         updates.cor_primaria         = fields.cor_primaria;
  if (fields.cor_texto !== undefined)            updates.cor_texto            = fields.cor_texto;
  if (fields.mensagem_boas_vindas !== undefined) updates.mensagem_boas_vindas = fields.mensagem_boas_vindas;
  if (fields.nome !== undefined)                 updates.nome                 = fields.nome;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ detail: 'Nenhum campo para atualizar' }, { status: 400 });
  }

  try {
    const setClauses = Object.keys(updates)
      .map((k, i) => `${k} = $${i + 2}`)
      .join(', ');

    const res = await query(
      `UPDATE condominios
       SET ${setClauses}, updated_at = NOW()
       WHERE id = $1
       RETURNING id, nome, slug, logo_url, banner_url,
                 cor_primaria, cor_texto, mensagem_boas_vindas`,
      [condominioId, ...Object.values(updates)]
    );

    return NextResponse.json(res.rows[0]);
  } catch (e: unknown) {
    return NextResponse.json({ detail: String(e) }, { status: 500 });
  }
}

async function verificarAcesso(
  userId: string,
  role: string,
  condominioId: string
): Promise<boolean> {
  if (role === 'super_admin' || role === 'admin') return true;

  const res = await query(
    `SELECT u.id FROM users u
     JOIN condominios c ON c.b2b_partner_id = u.b2b_partner_id
     WHERE u.id = $1 AND c.id = $2`,
    [userId, condominioId]
  );
  return res.rows.length > 0;
}
