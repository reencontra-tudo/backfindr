export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requireAuth } from '@/lib/adminGuard';
import { notificarEncomendaChegou, enviarWhatsApp } from '@/lib/notifyModulos';
import { z } from 'zod';

const EncomendaSchema = z.object({
  morador_id:      z.string().uuid().optional(),
  unidade_numero:  z.string().min(1).max(20).optional(),
  unidade_bloco:   z.string().max(20).optional(),
  remetente:       z.string().max(200).optional(),
  descricao:       z.string().optional(),
  foto_url:        z.string().url().optional(),
  codigo_rastreio: z.string().max(100).optional(),
  ocr_dados:       z.record(z.unknown()).optional(),
});

// GET /api/v1/portaria/[condominioId]/encomendas
export async function GET(
  req: NextRequest,
  { params }: { params: { condominioId: string } }
) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const url    = new URL(req.url);
  const status = url.searchParams.get('status') ?? '';
  const page   = Math.max(1, parseInt(url.searchParams.get('page') ?? '1'));
  const size   = Math.min(100, parseInt(url.searchParams.get('size') ?? '30'));
  const offset = (page - 1) * size;

  try {
    const conditions = [`e.condominio_id = $1`];
    const qParams: unknown[] = [params.condominioId];
    let idx = 2;

    if (status) {
      conditions.push(`e.status = $${idx}`);
      qParams.push(status);
      idx++;
    }

    const where = `WHERE ${conditions.join(' AND ')}`;

    const [countRes, rowsRes] = await Promise.all([
      query(`SELECT COUNT(*) FROM encomendas e ${where}`, qParams),
      query(
        `SELECT e.*,
                u.numero AS unidade_numero, u.bloco AS unidade_bloco,
                usr.name AS morador_nome, usr.phone AS morador_telefone
         FROM encomendas e
         LEFT JOIN unidades u   ON u.id = e.unidade_id
         LEFT JOIN users usr    ON usr.id = e.morador_id
         ${where}
         ORDER BY e.registrado_em DESC
         LIMIT $${idx} OFFSET $${idx + 1}`,
        [...qParams, size, offset]
      ),
    ]);

    return NextResponse.json({
      items: rowsRes.rows,
      total: parseInt(countRes.rows[0].count, 10),
      page,
      size,
    });
  } catch (e: unknown) {
    return NextResponse.json({ detail: String(e) }, { status: 500 });
  }
}

// POST /api/v1/portaria/[condominioId]/encomendas
// Porteiro registra chegada de encomenda
export async function POST(
  req: NextRequest,
  { params }: { params: { condominioId: string } }
) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const body   = await req.json();
  const parsed = EncomendaSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ detail: parsed.error.issues }, { status: 400 });
  }

  const {
    morador_id, unidade_numero, unidade_bloco,
    remetente, descricao, foto_url, codigo_rastreio, ocr_dados,
  } = parsed.data;

  try {
    // Buscar condomínio
    const condRes = await query(
      `SELECT id, nome, whatsapp_notify, push_notify
       FROM condominios WHERE id = $1 AND active = true`,
      [params.condominioId]
    );
    if (condRes.rows.length === 0) {
      return NextResponse.json({ detail: 'Condomínio não encontrado' }, { status: 404 });
    }
    const cond = condRes.rows[0] as {
      id: string; nome: string; whatsapp_notify: boolean; push_notify: boolean;
    };

    // Resolver unidade e morador a partir do número informado
    let unidadeId: string | null       = null;
    let moradorId: string | null       = morador_id ?? null;
    let moradorTelefone: string | null = null;
    let moradorNome                    = '';

    if (unidade_numero) {
      const unRes = await query(
        `SELECT u.id, u.user_id, usr.name, usr.phone
         FROM unidades u
         LEFT JOIN users usr ON usr.id = u.user_id
         WHERE u.condominio_id = $1
           AND u.numero = $2
           AND (u.bloco = $3 OR ($3 IS NULL AND u.bloco IS NULL))`,
        [params.condominioId, unidade_numero, unidade_bloco ?? null]
      );
      if (unRes.rows.length > 0) {
        const row = unRes.rows[0] as {
          id: string; user_id: string | null; name: string | null; phone: string | null;
        };
        unidadeId       = row.id;
        moradorId       = moradorId ?? row.user_id;
        moradorNome     = row.name ?? '';
        moradorTelefone = row.phone;
      }
    }

    // Inserir encomenda
    const encRes = await query(
      `INSERT INTO encomendas
         (condominio_id, unidade_id, morador_id, porteiro_id,
          remetente, descricao, foto_url, codigo_rastreio, ocr_dados, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'pendente')
       RETURNING *`,
      [
        params.condominioId, unidadeId, moradorId, auth.user.id,
        remetente ?? null, descricao ?? null,
        foto_url ?? null, codigo_rastreio ?? null,
        ocr_dados ? JSON.stringify(ocr_dados) : null,
      ]
    );
    const encomenda = encRes.rows[0];

    // Notificar morador (fire-and-forget)
    if (moradorId) {
      const rem = remetente ?? 'remetente desconhecido';

      if (cond.push_notify) {
        notificarEncomendaChegou(moradorId, rem, cond.nome).catch(() => {});
      }

      if (cond.whatsapp_notify && moradorTelefone) {
        const msg = `📦 *Backfindr Portaria — ${cond.nome}*\n\nChegou uma encomenda de *${rem}* para você.\n\nRealize a retirada na portaria quando puder.\n\n_${new Date().toLocaleString('pt-BR')}_`;
        enviarWhatsApp(moradorTelefone, msg).catch(() => {});
      }
    }

    return NextResponse.json({
      ...encomenda,
      morador_nome:     moradorNome,
      unidade_numero:   unidade_numero ?? null,
      unidade_bloco:    unidade_bloco ?? null,
    }, { status: 201 });

  } catch (e: unknown) {
    return NextResponse.json({ detail: String(e) }, { status: 500 });
  }
}
