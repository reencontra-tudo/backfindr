// Admin: quantos cards o Feed pode mostrar hoje (somente leitura). Mesma regra de elegibilidade do Feed (src/lib/feed/query.ts).
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminGuard';
import { countFeedEligible } from '@/lib/feed/stats';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;
  try {
    const counts = await countFeedEligible();
    return NextResponse.json({ ...counts, gerado_em: new Date().toISOString() });
  } catch (e) {
    console.error('[admin/feed/stats]', e);
    return NextResponse.json({ detail: 'Erro ao contar os cards do Feed' }, { status: 500 });
  }
}
