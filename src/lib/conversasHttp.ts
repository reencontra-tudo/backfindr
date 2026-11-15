// Ajudantes das rotas de conversas: chave de funcionalidade, login e resposta padrão. Nenhuma rota daqui existe «de verdade»
// sem MENSAGENS_ATIVO=1 (responde 404, como se não existisse).
import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, extractTokenFromHeader } from '@/lib/jwt';
import { MENSAGENS_ATIVO, ehTabelaAusente } from '@/lib/conversas';
import { notFoundResponse, unauthorizedResponse, internalErrorResponse } from '@/lib/response';

export const fora = () => notFoundResponse();
export const erro = (detail: string, status: number) => NextResponse.json({ detail }, { status });

/** Devolve o id do usuário logado, ou a resposta pronta (404 com a função desligada, 401 sem login). */
export function exigirLogin(request: NextRequest): { userId: string } | NextResponse {
  if (!MENSAGENS_ATIVO()) return fora();
  const token = extractTokenFromHeader(request.headers.get('authorization'));
  if (!token) return unauthorizedResponse();
  const payload = verifyToken(token);
  if (!payload) return unauthorizedResponse();
  return { userId: payload.sub };
}

export function tratarErro(e: unknown): NextResponse {
  if (ehTabelaAusente(e)) return erro('Mensagens indisponíveis no momento.', 503);
  return internalErrorResponse(e);
}

import { carregarConversa, papelNaConversa, type Conversa } from '@/lib/conversas';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Login + conversa + papel. Quem NÃO é parte recebe 404 (igual a «não existe»: nada de enumerar conversas alheias). */
export async function exigirParte(request: NextRequest, id: string): Promise<{ userId: string; conversa: Conversa; papel: 'dono' | 'achador' } | NextResponse> {
  const a = exigirLogin(request); if (a instanceof NextResponse) return a;
  if (!UUID.test(id)) return notFoundResponse();
  const conversa = await carregarConversa(id);
  if (!conversa) return notFoundResponse();
  const papel = papelNaConversa(conversa, a.userId);
  if (!papel) return notFoundResponse();
  return { userId: a.userId, conversa, papel };
}
