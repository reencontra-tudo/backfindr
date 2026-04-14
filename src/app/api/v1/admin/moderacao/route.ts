import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, backendHeaders, forwardParams } from '@/lib/adminGuard';
import { z } from 'zod';

const API = process.env.NEXT_PUBLIC_API_URL ?? '';

const ActionSchema = z.object({
  report_id:  z.string().uuid(),
  action:     z.enum(['dismiss', 'remove_object', 'suspend_user', 'block_user']),
  reason:     z.string().optional(),
});

// ─── GET /api/v1/admin/moderacao ─────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;

  const qs = forwardParams(req, ['status', 'type', 'page', 'size']);

  try {
    const res = await fetch(`${API}/api/v1/admin/reports${qs}`, {
      headers: backendHeaders(req),
    });

    if (res.ok) return NextResponse.json(await res.json());

    // Fallback estrutura vazia
    return NextResponse.json({ items: [], total: 0, pending: 0 });
  } catch {
    return NextResponse.json({ items: [], total: 0, pending: 0 });
  }
}

// ─── POST /api/v1/admin/moderacao ─────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ detail: 'JSON inválido' }, { status: 400 });
  }

  const result = ActionSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json(
      { detail: 'Dados inválidos', errors: result.error.flatten() },
      { status: 422 }
    );
  }

  const { report_id, action, reason } = result.data;

  try {
    // Executar ação correspondente no backend
    const actions: Record<string, () => Promise<Response>> = {
      dismiss: () =>
        fetch(`${API}/api/v1/admin/reports/${report_id}/dismiss`, {
          method: 'POST', headers: backendHeaders(req),
          body: JSON.stringify({ reason }),
        }),

      remove_object: async () => {
        // Buscar report para pegar object_id
        const reportRes = await fetch(
          `${API}/api/v1/admin/reports/${report_id}`,
          { headers: backendHeaders(req) }
        );
        if (!reportRes.ok) throw new Error('Report não encontrado');
        const report = await reportRes.json();

        return fetch(`${API}/api/v1/admin/objects/${report.object_id}`, {
          method: 'DELETE', headers: backendHeaders(req),
        });
      },

      suspend_user: async () => {
        const reportRes = await fetch(
          `${API}/api/v1/admin/reports/${report_id}`,
          { headers: backendHeaders(req) }
        );
        if (!reportRes.ok) throw new Error('Report não encontrado');
        const report = await reportRes.json();

        return fetch(`${API}/api/v1/admin/users/${report.target_user_id}`, {
          method: 'PATCH', headers: backendHeaders(req),
          body: JSON.stringify({ is_active: false }),
        });
      },

      block_user: async () => {
        const reportRes = await fetch(
          `${API}/api/v1/admin/reports/${report_id}`,
          { headers: backendHeaders(req) }
        );
        if (!reportRes.ok) throw new Error('Report não encontrado');
        const report = await reportRes.json();

        return fetch(`${API}/api/v1/admin/users/${report.target_user_id}`, {
          method: 'PATCH', headers: backendHeaders(req),
          body: JSON.stringify({ is_active: false, is_blocked: true }),
        });
      },
    };

    const handler = actions[action];
    if (!handler) {
      return NextResponse.json({ detail: 'Ação inválida' }, { status: 400 });
    }

    const res = await handler();
    return NextResponse.json(
      { success: true, action, report_id },
      { status: res.ok ? 200 : res.status }
    );

  } catch (e) {
    return NextResponse.json({ detail: String(e) }, { status: 500 });
  }
}
