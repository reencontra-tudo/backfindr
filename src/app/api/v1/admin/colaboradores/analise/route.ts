// POST /api/v1/admin/colaboradores/analise  corpo: { colaborador_id } (E8). Admin. Roda AGORA a análise de sinais do colaborador (contas recém-criadas usando o código; pico de ocorrências). Idempotente.
import { NextRequest, NextResponse } from 'next/server';
import { getClient } from '@/lib/db';
import { antifraudeAtivo, avaliarColaborador } from '@/lib/colaboradores/antifraude';
import { auditar } from '@/lib/colaboradores/auditoria';
import { ehResposta, guardaAdmin, lerCorpo, SEM_CACHE, UUID } from '@/lib/colaboradores/rotaAdmin';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  if (!antifraudeAtivo()) return new NextResponse(null, { status: 404 });
  const g = await guardaAdmin(req); if (ehResposta(g)) return g;
  const b = await lerCorpo(req); const id = typeof b?.colaborador_id === 'string' ? b.colaborador_id : '';
  if (!UUID.test(id)) return NextResponse.json({ ok: false, erro: 'Identificador inválido.' }, { status: 400, headers: SEM_CACHE });
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const c = await client.query('SELECT id FROM colaboradores WHERE id = $1', [id]);
    if (c.rows.length === 0) { await client.query('ROLLBACK'); return NextResponse.json({ ok: false, erro: 'Colaborador não encontrado.' }, { status: 404, headers: SEM_CACHE }); }
    const novos = await avaliarColaborador(client, id);
    await auditar(client, { ator: g.adminId, acao: 'analise_de_sinais', alvoTipo: 'colaborador', alvoId: id, depois: { novosSinais: novos } });
    await client.query('COMMIT');
    return NextResponse.json({ ok: true, novos }, { headers: SEM_CACHE });
  } catch (e) { try { await client.query('ROLLBACK'); } catch { /* já encerrada */ } console.error('[colaboradores] análise falhou', e instanceof Error ? e.message : 'erro'); return NextResponse.json({ ok: false, erro: 'Não foi possível concluir agora.' }, { status: 500, headers: SEM_CACHE }); }
  finally { client.release(); }
}
