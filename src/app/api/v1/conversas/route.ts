export const dynamic = 'force-dynamic';
import { NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { successResponse } from '@/lib/response';
import { exigirLogin, erro, tratarErro } from '@/lib/conversasHttp';
import { criarAviso } from '@/lib/conversasAviso';
import { estadoVisivel, type Filtro } from '@/lib/conversas';
import { NextResponse } from 'next/server';

const FILTROS: Record<Filtro, string> = {
  aguardando_voce: `c.dono_id = $1 AND c.estado = 'aguardando'`,
  aguardando_dono: `c.achador_id = $1 AND c.estado = 'aguardando'`,
  abertas: `(c.dono_id = $1 OR c.achador_id = $1) AND c.estado = 'aberta'`,
  encerradas: `(c.dono_id = $1 OR c.achador_id = $1) AND c.estado IN ('recusada','encerrada','cancelada','arquivada','bloqueada')`,
};

// POST /api/v1/conversas — criar o aviso «encontrei» (login obrigatório). Corpo: { codigo, mensagem }.
export async function POST(request: NextRequest) {
  const a = exigirLogin(request); if (a instanceof NextResponse) return a;
  try {
    const body = await request.json().catch(() => ({}));
    const r = await criarAviso(a.userId, String(body?.codigo ?? ''), body?.mensagem);
    if (!r.ok) return NextResponse.json({ detail: r.detail, conversa_id: r.conversaId ?? null }, { status: r.status });
    return successResponse({ conversa_id: r.conversaId, message: 'Aviso registrado' }, 201);
  } catch (e) { return tratarErro(e); }
}

// GET /api/v1/conversas?filtro=aguardando_voce|aguardando_dono|abertas|encerradas&objeto=<id> — conversas do usuário logado
export async function GET(request: NextRequest) {
  const a = exigirLogin(request); if (a instanceof NextResponse) return a;
  try {
    const url = new URL(request.url);
    const filtro = url.searchParams.get('filtro') as Filtro | null;
    if (filtro && !(filtro in FILTROS)) return erro('Filtro inválido.', 400);
    const objeto = url.searchParams.get('objeto');
    const onde = filtro ? FILTROS[filtro] : `(c.dono_id = $1 OR c.achador_id = $1)`;
    const params: unknown[] = [a.userId];
    let extra = '';
    if (objeto) { params.push(objeto); extra = ` AND c.object_id::text = $2`; }
    const r = await query(
      `SELECT c.id, c.estado, c.criada_em, c.ultima_atividade, c.objeto_titulo, c.primeira_mensagem, c.confirmado_dono_em,
              CASE WHEN c.dono_id = $1 THEN 'dono' ELSE 'achador' END AS papel,
              CASE WHEN c.dono_id = $1 THEN c.object_id ELSE NULL END AS object_id,
              (SELECT COUNT(*)::int FROM mensagens_conversa m
                WHERE m.conversa_id = c.id AND m.tipo = 'texto' AND m.lida_em IS NULL AND m.autor_id IS DISTINCT FROM $1) AS nao_lidas
         FROM conversas c
        WHERE ${onde}${extra}
        ORDER BY c.ultima_atividade DESC
        LIMIT 100`,
      params,
    );
    const agora = new Date();
    const conversas = r.rows.map((c: Record<string, unknown>) => ({ ...c, estado_visivel: estadoVisivel(c as never, agora) }));
    return successResponse({ conversas, total: conversas.length });
  } catch (e) { return tratarErro(e); }
}
