export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import bcryptjs from 'bcryptjs';
import { query } from '@/lib/db';
import { requireSuperAdmin } from '@/lib/adminGuard';
import { SYSTEM_ACCOUNT_ID, SYSTEM_ACCOUNT_EMAIL, SYSTEM_ACCOUNT_NAME } from '@/lib/systemAccount';

// ─── POST /api/v1/admin/seed-system-account ────────────────────────────────
// Cria (uma única vez, idempotente) a conta-âncora usada pelas ocorrências de
// Public Signal. Requer migration 006 já aplicada (coluna is_system_account +
// constraints). Restrito a super_admin — é uma ação de infraestrutura de
// segurança, não uma rotina de operação do dia a dia.
//
// A senha é um valor aleatório gerado aqui e imediatamente descartado (nunca
// logado, nunca retornado na resposta) — login por senha correta é inviável
// na prática. A defesa real contra login é a constraint de schema
// (is_system_account nunca passa pelo fluxo normal) + o filtro explícito em
// src/app/api/v1/auth/login/route.ts.
export async function POST(req: NextRequest) {
  const auth = await requireSuperAdmin(req);
  if (auth instanceof NextResponse) return auth;

  try {
    const existing = await query(`SELECT id FROM users WHERE id = $1`, [SYSTEM_ACCOUNT_ID]);
    if (existing.rows.length > 0) {
      return NextResponse.json({ created: false, message: 'Conta-âncora já existe.', id: SYSTEM_ACCOUNT_ID });
    }

    // Também não deixa criar se o e-mail reservado já estiver em uso por
    // outra linha (não deveria acontecer, mas evita colisão silenciosa).
    const emailTaken = await query(`SELECT id FROM users WHERE email = $1`, [SYSTEM_ACCOUNT_EMAIL]);
    if (emailTaken.rows.length > 0) {
      return NextResponse.json(
        { detail: `E-mail reservado ${SYSTEM_ACCOUNT_EMAIL} já está em uso por outra conta (id ${emailTaken.rows[0].id}). Aborting.` },
        { status: 409 }
      );
    }

    // Senha aleatória descartável — nunca persistida em texto plano, nunca logada.
    const discardedPassword = crypto.randomBytes(48).toString('hex');
    const hashedPassword = await bcryptjs.hash(discardedPassword, 10);

    await query(
      `INSERT INTO users (id, name, email, password, plan, is_active, is_system_account, created_at, updated_at)
       VALUES ($1, $2, $3, $4, 'free', false, true, NOW(), NOW())`,
      [SYSTEM_ACCOUNT_ID, SYSTEM_ACCOUNT_NAME, SYSTEM_ACCOUNT_EMAIL, hashedPassword]
    );

    return NextResponse.json({ created: true, id: SYSTEM_ACCOUNT_ID, email: SYSTEM_ACCOUNT_EMAIL });
  } catch (error) {
    console.error('[admin/seed-system-account POST]', error);
    return NextResponse.json(
      { detail: 'Erro ao criar conta-âncora — confirme se a migration 006 (is_system_account, constraints) já foi aplicada.' },
      { status: 500 }
    );
  }
}
