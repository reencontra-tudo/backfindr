import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import bcrypt from 'bcryptjs';

function slugify(str: string) {
  return str
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .substring(0, 60);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { nome, email, password, phone } = body;

    if (!nome || !email || !password) {
      return NextResponse.json(
        { detail: 'Nome, e-mail e senha são obrigatórios' },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { detail: 'Senha deve ter no mínimo 8 caracteres' },
        { status: 400 }
      );
    }

    const emailLower = email.toLowerCase();

    // Verificar se e-mail já existe
    const existing = await query(
      'SELECT id FROM users WHERE email = $1',
      [emailLower]
    );
    if (existing.rows.length > 0) {
      return NextResponse.json(
        { detail: 'E-mail já cadastrado' },
        { status: 409 }
      );
    }

    // Gerar slug único
    let slug = slugify(nome);
    const slugCheck = await query(
      'SELECT id FROM b2b_partners WHERE slug = $1',
      [slug]
    );
    if (slugCheck.rows.length > 0) {
      slug = slug + '-' + Date.now().toString(36);
    }

    // Criar parceiro B2B
    const partnerRes = await query(
      'INSERT INTO b2b_partners (nome, name, slug, email, phone, active) VALUES ($1, $1, $2, $3, $4, true) RETURNING id',
      [nome, slug, emailLower, phone ?? null]
    );
    const partnerId = partnerRes.rows[0].id;

    // Hash da senha
    const passwordHash = await bcrypt.hash(password, 10);

    // Criar usuário b2b_admin — salva nas duas colunas (password e password_hash)
    await query(
      'INSERT INTO users (name, email, password, password_hash, role, plan, b2b_partner_id, is_active) VALUES ($1, $2, $3, $3, $4, $5, $6, $7)',
      [nome, emailLower, passwordHash, 'b2b_admin', 'free', partnerId, true]
    );

    return NextResponse.json(
      { message: 'Parceiro cadastrado com sucesso', partner_id: partnerId },
      { status: 201 }
    );
  } catch (e: unknown) {
    console.error('Erro no cadastro B2B:', e);
    return NextResponse.json(
      { detail: 'Erro interno ao criar parceiro' },
      { status: 500 }
    );
  }
}
