// GET /api/v1/admin/colaboradores/lancamentos[?slug=<@nome>]  (E4, MODO SOMBRA). Admin. Conferência do livro de comissões (só leitura): lançamentos e saldo (pendente/disponível).
// Sem `slug`: resumo por colaborador. Nenhum colaborador vê isto (a tela dele é a E6). Desligada (sem COMISSAO_SOMBRA=1) = 404.
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requireAdmin } from '@/lib/adminGuard';
import { comissaoSombraAtiva, saldoDoColaborador } from '@/lib/colaboradores/comissao';
import { slugValido } from '@/lib/colaboradores/rota';

export const dynamic = 'force-dynamic';
const SEM_CACHE = { 'Cache-Control': 'no-store' };

export async function GET(req: NextRequest) {
  if (!comissaoSombraAtiva()) return new NextResponse(null, { status: 404 });
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;
  try {
    const slug = req.nextUrl.searchParams.get('slug')?.trim().replace(/^@/, '').toLowerCase();
    if (!slug) {
      const r = await query(
        `SELECT c.slug, c.estado, (c.verificado_em IS NOT NULL) AS verificado, COUNT(l.id)::int AS lancamentos,
                COALESCE(SUM(l.valor_centavos), 0)::int AS total_centavos
           FROM colaboradores c LEFT JOIN colaborador_lancamentos l ON l.colaborador_id = c.id GROUP BY c.id ORDER BY c.criado_em ASC LIMIT 500`);
      return NextResponse.json({ ok: true, resumo: r.rows }, { headers: SEM_CACHE });
    }
    if (!slugValido(slug)) return NextResponse.json({ ok: false, erro: '@nome inválido.' }, { status: 400, headers: SEM_CACHE });
    const c = await query('SELECT id, slug, estado, (verificado_em IS NOT NULL) AS verificado FROM colaboradores WHERE lower(slug) = $1 LIMIT 1', [slug]);
    if (c.rows.length === 0) return NextResponse.json({ ok: false, erro: 'Colaborador não encontrado.' }, { status: 404, headers: SEM_CACHE });
    const id = String(c.rows[0].id);
    const l = await query(
      `SELECT id, tipo, valor_centavos, pagamento_ref, percentual_aplicado, base_centavos, disponivel_em, em_analise, motivo, criado_em
         FROM colaborador_lancamentos WHERE colaborador_id = $1 ORDER BY criado_em DESC LIMIT 500`, [id]);
    return NextResponse.json({ ok: true, colaborador: c.rows[0], saldo: await saldoDoColaborador(query, id), lancamentos: l.rows }, { headers: SEM_CACHE });
  } catch (e) {
    console.error('[colaboradores] livro falhou', e instanceof Error ? e.message : 'erro');
    return NextResponse.json({ ok: false, erro: 'Não foi possível consultar agora.' }, { status: 500, headers: SEM_CACHE });
  }
}
