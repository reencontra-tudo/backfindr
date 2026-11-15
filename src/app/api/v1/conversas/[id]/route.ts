export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { successResponse } from '@/lib/response';
import { exigirParte, tratarErro } from '@/lib/conversasHttp';
import { estadoVisivel, podeFazer, donoAindaPodeAceitar, TEXTOS, type Acao } from '@/lib/conversas';

// GET /api/v1/conversas/[id] — a conversa (só para as duas partes; quem não é parte recebe 404)
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const p = await exigirParte(request, params.id); if (p instanceof NextResponse) return p;
    const { conversa: c, papel, userId } = p;
    const m = await query(
      `SELECT id, texto, tipo, criada_em, lida_em, (autor_id = $2) AS minha FROM mensagens_conversa WHERE conversa_id = $1 ORDER BY criada_em ASC LIMIT 500`,
      [c.id, userId],
    );
    const mensagens = m.rows.map((x: { id: string; texto: string; tipo: string; criada_em: string; lida_em: string | null; minha: boolean | null }) => (
      { id: x.id, texto: x.texto, tipo: x.tipo, criada_em: x.criada_em, lida_em: x.lida_em, autor: x.tipo === 'sistema' ? 'sistema' : x.minha ? 'eu' : 'outro' }));
    const acoes: Record<string, boolean> = {};
    for (const a of ['aceitar', 'recusar', 'e_o_meu', 'enviar', 'encerrar_devolvido', 'encerrar_desisti', 'cancelar'] as Acao[]) acoes[a] = podeFazer(c, papel, a);
    if (acoes.aceitar && !donoAindaPodeAceitar(c)) acoes.aceitar = false;
    return successResponse({
      id: c.id, papel, estado: c.estado, estado_visivel: estadoVisivel(c), objeto_titulo: c.objeto_titulo,
      object_id: papel === 'dono' ? c.object_id : null,   // quem achou não recebe o id do objeto alheio
      criada_em: c.criada_em, aceita_em: c.aceita_em, confirmado_dono_em: c.confirmado_dono_em, encerrada_em: c.encerrada_em, motivo: c.motivo,
      acoes, mensagens,
      textos: { aguardando: TEXTOS.aguardando, aceitar: TEXTOS.aceitar },
    });
  } catch (e) { return tratarErro(e); }
}
