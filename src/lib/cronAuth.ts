import crypto from 'crypto';
import type { NextRequest } from 'next/server';

/**
 * true somente se o cabeçalho `Authorization: Bearer <CRON_SECRET>` bate com a variável CRON_SECRET.
 * - Comparação em tempo constante (HMAC dos dois lados com chave aleatória por chamada → mesmo tamanho).
 * - Falha fechada: sem CRON_SECRET configurado, ou sem cabeçalho, devolve false.
 * - Só lê o cabeçalho (nunca a URL) e nunca registra o valor.
 */
export function hasValidCronSecret(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = req.headers.get('authorization');
  if (!header || !header.startsWith('Bearer ')) return false;
  const given = header.slice(7);
  const k = crypto.randomBytes(32);
  const a = crypto.createHmac('sha256', k).update(given).digest();
  const b = crypto.createHmac('sha256', k).update(secret).digest();
  return crypto.timingSafeEqual(a, b);
}
