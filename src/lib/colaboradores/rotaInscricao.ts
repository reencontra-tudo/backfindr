// Utilidades comuns das rotas da inscrição de colaboradores (E5). SOMENTE SERVIDOR.
import { NextRequest, NextResponse } from 'next/server';
import { extractTokenFromHeader, verifyToken } from '@/lib/jwt';
import { inscricaoAtiva } from './inscricao';

export const SEM_CACHE = { 'Cache-Control': 'no-store' };

/** Interruptor desligado: a rota «não existe» (404 vazio), como o resto do programa. */
export const desligada = () => (inscricaoAtiva() ? null : new NextResponse(null, { status: 404 }));

/** Usuário logado (cookie ou cabeçalho) ou null. */
export function usuarioLogado(req: NextRequest): string | null {
  const token = req.cookies.get('access_token')?.value ?? extractTokenFromHeader(req.headers.get('authorization'));
  if (!token) return null;
  const p = verifyToken(token) as { sub?: string } | null;
  return p?.sub ? String(p.sub) : null;
}

export const naoAutenticado = () => NextResponse.json({ ok: false, erro: 'Faça login para continuar.' }, { status: 401, headers: SEM_CACHE });

// Limite simples em memória (por instância), como o da validação do código: freia abuso casual, não é barreira global.
const usos = new Map<string, { inicio: number; n: number }>();
export function limitar(chave: string, max: number, janelaMs: number, agora = Date.now()): boolean {
  if (usos.size > 5000) usos.clear();
  const u = usos.get(chave);
  if (!u || agora - u.inicio >= janelaMs) { usos.set(chave, { inicio: agora, n: 1 }); return false; }
  u.n += 1; return u.n > max;
}
export const resetLimites = () => usos.clear();

// E6: rotas que dependem de interruptores próprios (saldo e saque). Desligadas = 404 vazio.
import { saldoVisivel, saqueAtivo } from './saque';
export const desligadaSaldo = () => (saldoVisivel() ? null : new NextResponse(null, { status: 404 }));
export const desligadaSaque = () => (saqueAtivo() ? null : new NextResponse(null, { status: 404 }));
