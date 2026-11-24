// POST /api/v1/colaboradores/imagem (E5). Logado. Envia a imagem da página do colaborador para o armazenamento PRÓPRIO (R2, pasta `partners`); nunca busca URL externa.
// Corpo: { imagem: "data:image/png|jpeg|webp;base64,..." } até 2 MB, conferida pelos primeiros bytes do arquivo. Resposta: { ok, url }.
import { NextRequest, NextResponse } from 'next/server';
import { uploadToR2 } from '@/lib/storage';
import { LIMITE_IMAGEM_BYTES, tipoDaImagem } from '@/lib/colaboradores/imagem';
import { desligada, limitar, naoAutenticado, SEM_CACHE, usuarioLogado } from '@/lib/colaboradores/rotaInscricao';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  const off = desligada(); if (off) return off;
  const user = usuarioLogado(req); if (!user) return naoAutenticado();
  if (limitar(`img:${user}`, 10, 60 * 60_000)) return NextResponse.json({ ok: false, erro: 'Muitos envios. Tente de novo mais tarde.' }, { status: 429, headers: SEM_CACHE });
  let corpo: { imagem?: unknown } = {};
  try { corpo = await req.json(); } catch { return NextResponse.json({ ok: false, erro: 'Corpo inválido.' }, { status: 400, headers: SEM_CACHE }); }
  const m = typeof corpo.imagem === 'string' ? /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=\s]+)$/.exec(corpo.imagem) : null;
  if (!m) return NextResponse.json({ ok: false, erro: 'Envie uma imagem PNG, JPEG ou WebP.' }, { status: 400, headers: SEM_CACHE });
  const buf = Buffer.from(m[2].replace(/\s+/g, ''), 'base64');
  if (buf.length === 0 || buf.length > LIMITE_IMAGEM_BYTES) return NextResponse.json({ ok: false, erro: 'A imagem deve ter até 2 MB.' }, { status: 413, headers: SEM_CACHE });
  const tipo = tipoDaImagem(buf);
  if (!tipo) return NextResponse.json({ ok: false, erro: 'O arquivo não é uma imagem PNG, JPEG ou WebP válida.' }, { status: 400, headers: SEM_CACHE });
  try {
    const r = await uploadToR2({ folder: 'partners', entityId: `colab-${user}`, data: buf, mimeType: tipo });
    return NextResponse.json({ ok: true, url: r.url }, { headers: SEM_CACHE });
  } catch (e) {
    console.error('[colaboradores] envio de imagem falhou', e instanceof Error ? e.message : 'erro');
    return NextResponse.json({ ok: false, erro: 'Não foi possível enviar a imagem agora.' }, { status: 500, headers: SEM_CACHE });
  }
}
