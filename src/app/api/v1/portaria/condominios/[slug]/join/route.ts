export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requireAuth } from '@/lib/adminGuard';
import { z } from 'zod';

const JoinSchema = z.object({
  numero: z.string().min(1).max(20),  // número da unidade
  bloco:  z.string().max(20).optional(),
});

// POST /api/v1/portaria/condominios/[slug]/join
// Morador autenticado se vincula a uma unidade do condomínio
export async function POST(
  req: NextRequest,
  { params }: { params: { slug: string } }
) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const body   = await req.json();
  const parsed = JoinSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ detail: parsed.error.issues }, { status: 400 });
  }

  const { numero, bloco } = parsed.data;

  try {
    // Buscar condomínio
    const condRes = await query(
      `SELECT id, nome FROM condominios WHERE slug = $1 AND active = true`,
      [params.slug]
    );
    if (condRes.rows.length === 0) {
      return NextResponse.json({ detail: 'Condomínio não encontrado' }, { status: 404 });
    }
    const condominio = condRes.rows[0] as { id: string; nome: string };

    // Verificar se unidade já existe e está livre
    const unidadeRes = await query(
      `SELECT id, user_id FROM unidades
       WHERE condominio_id = $1 AND numero = $2 AND (bloco = $3 OR ($3 IS NULL AND bloco IS NULL))`,
      [condominio.id, numero, bloco ?? null]
    );

    let unidadeId: string;

    if (unidadeRes.rows.length > 0) {
      const unidade = unidadeRes.rows[0] as { id: string; user_id: string | null };
      if (unidade.user_id && unidade.user_id !== auth.user.id) {
        return NextResponse.json(
          { detail: 'Esta unidade já está vinculada a outro morador' },
          { status: 409 }
        );
      }
      // Vincular ao usuário atual
      await query(
        `UPDATE unidades SET user_id = $1, updated_at = NOW() WHERE id = $2`,
        [auth.user.id, unidade.id]
      );
      unidadeId = unidade.id;
    } else {
      // Criar unidade nova
      const novaUnidade = await query(
        `INSERT INTO unidades (condominio_id, numero, bloco, user_id)
         VALUES ($1, $2, $3, $4) RETURNING id`,
        [condominio.id, numero, bloco ?? null, auth.user.id]
      );
      unidadeId = novaUnidade.rows[0].id;
    }

    // Notificação de boas-vindas ao condomínio
    await query(
      `INSERT INTO notifications (user_id, title, message, type, created_at)
       VALUES ($1, $2, $3, $4, NOW())`,
      [
        auth.user.id,
        `🏢 Bem-vindo ao ${condominio.nome}!`,
        `Você está vinculado à unidade ${numero}${bloco ? ` — Bloco ${bloco}` : ''}. Agora você receberá alertas de encomendas e achados e perdidos do seu condomínio.`,
        'condominio_join',
      ]
    );

    return NextResponse.json({
      message: 'Vinculado com sucesso',
      condominio: { id: condominio.id, nome: condominio.nome, slug: params.slug },
      unidade: { id: unidadeId, numero, bloco: bloco ?? null },
    }, { status: 201 });
  } catch (e: unknown) {
    return NextResponse.json({ detail: String(e) }, { status: 500 });
  }
}
