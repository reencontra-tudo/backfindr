export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, extractTokenFromHeader } from '@/lib/jwt';
import { withActor, logEvent } from '@/lib/audit';
import { newRequestId } from '@/lib/governance';

/**
 * POST /api/v1/admin/impersonate/end — registra o FIM da impersonação na trilha de auditoria.
 * Chamado pelo cliente (stopImpersonation) com o token de impersonação ainda ativo. Só registra; o token expira em 2 h.
 */
export async function POST(req: NextRequest) {
  const token = req.cookies.get('access_token')?.value ?? extractTokenFromHeader(req.headers.get('authorization'));
  const payload = token ? verifyToken(token) : null;
  if (!payload?.impersonated_by) return NextResponse.json({ detail: 'Sessão não é de impersonação' }, { status: 400 });
  try {
    const actor = {
      id: payload.impersonated_by, type: 'impersonacao' as const, impersonatedId: payload.sub,
      origin: 'POST /api/v1/admin/impersonate/end', requestId: newRequestId(req.headers),
    };
    await withActor(actor, (q) => logEvent(q, 'impersonation_end', actor, payload.sub, {}));
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
