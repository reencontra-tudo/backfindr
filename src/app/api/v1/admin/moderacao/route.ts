export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminGuard';
import { query } from '@/lib/db';
import { z } from 'zod';

const ActionSchema = z.object({
  report_id: z.string().uuid(),
  action:    z.enum(['dismiss', 'remove_object', 'suspend_user', 'block_user']),
  reason:    z.string().optional(),
});

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;
  const url    = new URL(req.url);
  const status = url.searchParams.get('status') ?? '';
  const type   = url.searchParams.get('type')   ?? '';
  const page   = Math.max(1, parseInt(url.searchParams.get('page') ?? '1', 10));
  const size   = Math.min(100, Math.max(1, parseInt(url.searchParams.get('size') ?? '20', 10)));
  const offset = (page - 1) * size;
  const conditions: string[] = []; const params: unknown[] = []; let idx = 1;
  if (status) { conditions.push(`r.status = $${idx}`); params.push(status); idx++; }
  if (type)   { conditions.push(`r.type = $${idx}`);   params.push(type);   idx++; }
  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  try {
    const [countRes, rowsRes, pendingRes] = await Promise.all([
      query(`SELECT COUNT(*) FROM reports r ${where}`, params),
      query(`SELECT r.id, r.type, r.reason, r.status, r.created_at, o.title AS object_title, u.email AS reporter_email FROM reports r LEFT JOIN objects o ON o.id = r.object_id LEFT JOIN users u ON u.id = r.reporter_id ${where} ORDER BY r.created_at DESC LIMIT $${idx} OFFSET $${idx+1}`, [...params, size, offset]),
      query(`SELECT COUNT(*) FROM reports WHERE status = 'pending'`),
    ]);
    return NextResponse.json({ items: rowsRes.rows, total: parseInt(countRes.rows[0].count, 10), pending: parseInt(pendingRes.rows[0].count, 10), page, size });
  } catch (e) { return NextResponse.json({ items: [], total: 0, pending: 0 }); }
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;
  const body = await req.json();
  const parsed = ActionSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ detail: parsed.error.issues }, { status: 400 });
  const { report_id, action, reason } = parsed.data;
  try {
    const reportRes = await query(`SELECT * FROM reports WHERE id = $1`, [report_id]);
    if (reportRes.rows.length === 0) return NextResponse.json({ detail: 'Denúncia não encontrada' }, { status: 404 });
    const report = reportRes.rows[0];
    if (action === 'remove_object' && report.object_id) {
      await query(`UPDATE objects SET status = 'archived', updated_at = NOW() WHERE id = $1`, [report.object_id]);
    }
    await query(`UPDATE reports SET status = 'resolved', resolved_at = NOW(), reason = COALESCE($1, reason), updated_at = NOW() WHERE id = $2`, [reason ?? null, report_id]);
    return NextResponse.json({ success: true, action });
  } catch (e) { return NextResponse.json({ detail: 'Erro ao processar ação' }, { status: 500 }); }
}
