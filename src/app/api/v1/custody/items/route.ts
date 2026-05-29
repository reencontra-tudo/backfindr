export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requireAuth } from '@/lib/adminGuard';
import { gerarQrCode, gerarToken, notificarCustodiaCriada, enviarWhatsApp } from '@/lib/notifyModulos';
import { z } from 'zod';

const CustodiaSchema = z.object({
  destinatario_nome:    z.string().min(2).max(200),
  destinatario_contato: z.string().min(5).max(200), // telefone ou email
  descricao:            z.string().min(2),
  condominio_id:        z.string().uuid().optional(), // null = standalone
});

// GET /api/v1/custody/items — listar custódias do usuário autenticado
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const url    = new URL(req.url);
  const status = url.searchParams.get('status') ?? '';
  const page   = Math.max(1, parseInt(url.searchParams.get('page') ?? '1'));
  const size   = Math.min(100, parseInt(url.searchParams.get('size') ?? '20'));
  const offset = (page - 1) * size;

  try {
    const conditions = [`c.remetente_id = $1`];
    const qParams: unknown[] = [auth.user.id];
    let idx = 2;

    if (status) {
      conditions.push(`c.status = $${idx}`);
      qParams.push(status);
      idx++;
    }

    const where = `WHERE ${conditions.join(' AND ')}`;

    const [countRes, rowsRes] = await Promise.all([
      query(`SELECT COUNT(*) FROM custodias c ${where}`, qParams),
      query(
        `SELECT c.*,
                cust.name AS custodiante_nome,
                dest.name AS destinatario_user_nome,
                cond.nome AS condominio_nome
         FROM custodias c
         LEFT JOIN users cust ON cust.id = c.custodiante_id
         LEFT JOIN users dest ON dest.id = c.destinatario_user_id
         LEFT JOIN condominios cond ON cond.id = c.condominio_id
         ${where}
         ORDER BY c.created_at DESC
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

// POST /api/v1/custody/items — morador registra objeto para custódia
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const body   = await req.json();
  const parsed = CustodiaSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ detail: parsed.error.issues }, { status: 400 });
  }

  const { destinatario_nome, destinatario_contato, descricao, condominio_id } = parsed.data;

  try {
    // Gerar QR e link token únicos
    const qrCode    = gerarQrCode();
    const linkToken = gerarToken('cst_');

    const res = await query(
      `INSERT INTO custodias
         (remetente_id, destinatario_nome, destinatario_contato,
          descricao, qr_code, link_token, condominio_id, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'registrado')
       RETURNING *`,
      [
        auth.user.id, destinatario_nome, destinatario_contato,
        descricao, qrCode, linkToken, condominio_id ?? null,
      ]
    );

    const custodia = res.rows[0];

    // Registrar evento inicial
    await query(
      `INSERT INTO custody_eventos (custodia_id, tipo, user_id, observacao)
       VALUES ($1, 'registrado', $2, 'Item registrado pelo remetente')`,
      [custodia.id, auth.user.id]
    );

    // Notificar remetente (fire-and-forget)
    notificarCustodiaCriada(
      auth.user.id, descricao, destinatario_nome
    ).catch(() => {});

    // Enviar link ao destinatário via WhatsApp (fire-and-forget)
    const appUrl  = process.env.NEXT_PUBLIC_APP_URL ?? 'https://backfindr.com';
    const linkUrl = `${appUrl}/custody/${linkToken}`;
    const contato = destinatario_contato;
    const isPhone = /^\+?\d{8,}$/.test(contato.replace(/\D/g, ''));

    if (isPhone) {
      const msg =
        `📦 *Backfindr Custody*\n\n` +
        `*${auth.user.name}* deixou um item para você retirar:\n` +
        `"${descricao}"\n\n` +
        `Use este link para confirmar a retirada:\n${linkUrl}\n\n` +
        `_O link é pessoal e intransferível._`;
      enviarWhatsApp(contato, msg).catch(() => {});
    }

    return NextResponse.json({
      ...custodia,
      link_url: linkUrl,
    }, { status: 201 });
  } catch (e: unknown) {
    return NextResponse.json({ detail: String(e) }, { status: 500 });
  }
}
