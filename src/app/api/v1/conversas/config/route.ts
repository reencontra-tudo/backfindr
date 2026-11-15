export const dynamic = 'force-dynamic';
import { successResponse } from '@/lib/response';
import { MENSAGENS_ATIVO } from '@/lib/conversas';

// GET /api/v1/conversas/config — a tela pergunta se a área de mensagens está ligada (MENSAGENS_ATIVO=1). Público, sem dado nenhum.
export async function GET() {
  return successResponse({ ativo: MENSAGENS_ATIVO() });
}
