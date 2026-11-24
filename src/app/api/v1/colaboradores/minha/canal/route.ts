// POST /api/v1/colaboradores/minha/canal (E5). Logado. Troca do canal de origem: nova verificação; a liberação de comissão fica suspensa até a confirmação (POLÍTICA §3).
import { NextRequest, NextResponse } from 'next/server';
import { getClient } from '@/lib/db';
import { trocarCanal } from '@/lib/colaboradores/inscricao';
import { desligada, limitar, naoAutenticado, SEM_CACHE, usuarioLogado } from '@/lib/colaboradores/rotaInscricao';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const off = desligada(); if (off) return off;
  const user = usuarioLogado(req); if (!user) return naoAutenticado();
  if (limitar(`canal:${user}`, 5, 60 * 60_000)) return NextResponse.json({ ok: false, erro: 'Muitas tentativas. Tente de novo mais tarde.' }, { status: 429, headers: SEM_CACHE });
  let corpo: { canal_url?: unknown } = {};
  try { corpo = await req.json(); } catch { return NextResponse.json({ ok: false, erro: 'Corpo inválido.' }, { status: 400, headers: SEM_CACHE }); }
  const client = await getClient();
  try {
    const r = await trocarCanal(client, user, corpo?.canal_url);
    if (r.ok) return NextResponse.json({ ok: true, verificacao: r.verificacao }, { headers: SEM_CACHE });
    return r.erro === 'CANAL_INVALIDO'
      ? NextResponse.json({ ok: false, erro: 'Informe o endereço (https) do seu novo grupo, perfil ou página.', campos: { canal_url: 'Endereço inválido.' } }, { status: 400, headers: SEM_CACHE })
      : NextResponse.json({ ok: false, erro: 'Não há página ativa para alterar.' }, { status: 409, headers: SEM_CACHE });
  } catch (e) {
    console.error('[colaboradores] troca de canal falhou', e instanceof Error ? e.message : 'erro');
    return NextResponse.json({ ok: false, erro: 'Não foi possível concluir agora.' }, { status: 500, headers: SEM_CACHE });
  } finally {
    client.release();
  }
}
