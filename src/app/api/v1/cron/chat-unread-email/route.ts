export const dynamic = 'force-dynamic';
export const maxDuration = 60;
import { NextRequest } from 'next/server';
import { hasValidCronSecret } from '@/lib/cronAuth';
import { runChatUnreadEmails } from '@/lib/chatUnreadEmail';

/**
 * Cron: e-mail de "mensagem nova" para quem não leu o chat em 30 minutos (categoria serviço).
 * Regras, teto diário e dedup de 6 h em src/lib/chatUnreadEmail.ts.
 *
 * SEM AGENDAMENTO: a rota existe, mas nada a chama. O agendamento é decisão do Marcos depois do merge
 * (sugestão no PR: GET a cada 10 minutos, header `Authorization: Bearer <CRON_SECRET>`).
 * Fail-closed: sem CRON_SECRET configurado ou com header errado, responde 401.
 */
export async function GET(request: NextRequest) {
  if (!hasValidCronSecret(request)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }
  try {
    const result = await runChatUnreadEmails();
    console.log('[cron/chat-unread-email] Resultado:', { ...result, errors: result.errors.length });
    return new Response(JSON.stringify(result), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('[cron/chat-unread-email] Erro geral:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500 });
  }
}
