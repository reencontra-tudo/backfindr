export const dynamic = 'force-dynamic';
import { NextRequest } from 'next/server';
import bcryptjs from 'bcryptjs';
import { query } from '@/lib/db';
import { createAccessToken, createRefreshToken } from '@/lib/jwt';
import { successResponse, errorResponse, conflictResponse, internalErrorResponse } from '@/lib/response';
import { sendWelcomeEmail } from '@/lib/email';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, email, password, phone } = body;

    // Validação
    if (!name || !email || !password) {
      return errorResponse('Name, email and password are required', 400);
    }

    if (password.length < 8) {
      return errorResponse('Password must be at least 8 characters', 400);
    }

    // Verificar se usuário já existe
    const userExists = await query(
      'SELECT id FROM users WHERE email = $1',
      [email.toLowerCase()]
    );

    if (userExists.rows.length > 0) {
      return conflictResponse('User with this email already exists');
    }

    // Hash da senha
    const hashedPassword = await bcryptjs.hash(password, 10);

    // Ler cookie de origem de aquisição (definido pelo middleware na primeira visita)
    let acquisition: {
      utm_source?: string | null; utm_medium?: string | null; utm_campaign?: string | null;
      utm_content?: string | null; utm_term?: string | null; referrer?: string | null; landing_page?: string | null;
    } = {};
    try {
      const cookieValue = request.cookies.get('bf_acquisition')?.value;
      if (cookieValue) acquisition = JSON.parse(cookieValue);
    } catch { /* cookie ausente ou inválido — segue sem atribuição */ }

    // Criar usuário
    const result = await query(
      `INSERT INTO users (
         name, email, password, phone,
         utm_source, utm_medium, utm_campaign, utm_content, utm_term, referrer, landing_page,
         created_at, updated_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())
       RETURNING id, email, name`,
      [
        name, email.toLowerCase(), hashedPassword, phone || null,
        acquisition.utm_source || null, acquisition.utm_medium || null, acquisition.utm_campaign || null,
        acquisition.utm_content || null, acquisition.utm_term || null,
        acquisition.referrer || null, acquisition.landing_page || null,
      ]
    );

    const user = result.rows[0];

    // Enviar e-mail de boas-vindas (não bloqueia o cadastro se falhar)
    sendWelcomeEmail({ name: user.name, email: user.email }).catch(() => {});

    // Gerar tokens
    const accessToken = createAccessToken(user.id, user.email);
    const refreshToken = createRefreshToken(user.id, user.email);

    return successResponse(
      {
        access_token: accessToken,
        refresh_token: refreshToken,
        token_type: 'bearer',
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
        },
      },
      201
    );
  } catch (error) {
    return internalErrorResponse(error);
  }
}
