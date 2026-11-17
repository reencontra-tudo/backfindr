export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import {
  RESPOSTA_LINK_EXPIRADO,
  SQL_CUSTODIA_CONCLUIDA_EM,
  STATUS_HTTP_LINK_EXPIRADO,
  estadoDoLink,
  registrarLinkExpirado,
} from '@/lib/linkPublico';

// GET /api/v1/custody/link/[token]
// Público — destinatário acessa o link recebido no WhatsApp
// Retorna info do item sem dados sensíveis do remetente
export async function GET(
  _req: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const res = await query(
      `SELECT c.id, c.descricao, c.status, c.destinatario_nome,
              c.custodiado_em, c.entregue_em,
              usr.name AS remetente_nome,
              cust.name AS custodiante_nome,
              cond.nome AS condominio_nome, cond.endereco AS condominio_endereco,
              ${SQL_CUSTODIA_CONCLUIDA_EM} AS concluida_em, NOW() AS agora
       FROM custodias c
       LEFT JOIN users usr        ON usr.id  = c.remetente_id
       LEFT JOIN users cust       ON cust.id = c.custodiante_id
       LEFT JOIN condominios cond ON cond.id = c.condominio_id
       WHERE c.link_token = $1`,
      [params.token]
    );

    if (res.rows.length === 0) {
      return NextResponse.json({ detail: 'Link inválido ou expirado' }, { status: 404 });
    }

    const { concluida_em, agora, ...cust } = res.rows[0];

    // Validade (src/lib/linkPublico.ts): depois do prazo só o estado «concluída», sem nenhum dado da custódia.
    if (estadoDoLink('custodia', { status: cust.status, concluidaEm: concluida_em, agora }) === 'expirado') {
      await registrarLinkExpirado(query, 'custodia', cust.id, concluida_em);
      return NextResponse.json(RESPOSTA_LINK_EXPIRADO, { status: STATUS_HTTP_LINK_EXPIRADO });
    }

    // Registrar visualização (fire-and-forget)
    query(
      `INSERT INTO custody_eventos (custodia_id, tipo, observacao)
       VALUES ($1, 'visualizado', 'Link acessado pelo destinatário')`,
      [cust.id]
    ).catch(() => {});

    return NextResponse.json(cust);
  } catch (e: unknown) {
    return NextResponse.json({ detail: String(e) }, { status: 500 });
  }
}
