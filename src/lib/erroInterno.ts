// Resposta e registro de erros INTERNOS (falha de banco, exceção inesperada).
//
// Regra: o navegador nunca recebe o texto da exceção, da consulta ou do banco (nome de tabela, coluna, trecho
// de SQL, caminho de arquivo, pilha de chamadas). Recebe uma mensagem simples e um código estável. O detalhe
// completo vai só para o log do servidor, com segredos e dados pessoais redigidos.
//
// Erro de VALIDAÇÃO voltado ao usuário («e-mail inválido», «senha curta») não passa por aqui: continua com a
// mensagem atual, devolvida pela própria rota com errorResponse(...) e status 4xx.

import { NextResponse } from 'next/server';

export const MENSAGEM_ERRO_INTERNO = 'Não foi possível concluir agora. Tente novamente em instantes.';
export const CODIGO_ERRO_INTERNO = 'erro_interno';

const REDIGIDO = '[redigido]';

// Ordem importa: primeiro o que tem formato próprio (credenciais), depois o genérico.
const REDACOES: ReadonlyArray<[RegExp, string]> = [
  [/\bBearer\s+[A-Za-z0-9._~+/=-]+/gi, `Bearer ${REDIGIDO}`],
  [/\beyJ[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]*/g, REDIGIDO], // JWT
  [/\b([a-z][a-z0-9+.-]*:\/\/)[^\s/@:]+:[^\s/@]+@/gi, `$1${REDIGIDO}@`], // postgres://usuario:senha@host
  [/(["']?(?:access_?token|refresh_?token|id_?token|token|secret|client_secret|password|senha|api[_-]?key|authorization|cookie)["']?\s*[:=]\s*)(["']?)[^\s"',;&)]+/gi, `$1$2${REDIGIDO}`],
  [/\(([^()]{1,60})\)=\(([^()]*)\)/g, `($1)=(${REDIGIDO})`], // «Key (email)=(a@b.c) already exists»
  [/[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+/g, REDIGIDO], // e-mail
  [/(?<![\w-])(?:\+?\d{1,3}[\s.-]?)?\(?\d{2}\)?[\s.-]?\d{4,5}[\s.-]?\d{4}(?![\w-])/g, REDIGIDO], // telefone (com ou sem país e pontuação)
  [/\b[A-Za-z0-9_-]{32,}\b/g, REDIGIDO], // sequência longa e opaca (token de link, chave, hash)
];

/** Tira segredos e dados pessoais de um texto que vai para o log. */
export function redigirParaLog(texto: string): string {
  let t = String(texto);
  for (const [re, sub] of REDACOES) t = t.replace(re, sub);
  return t;
}

const CAMPOS_PG = ['code', 'severity', 'schema', 'table', 'column', 'constraint', 'routine'] as const;

/** Resumo do erro para o log: sem objeto bruto, sem consulta, sem parâmetros; texto redigido. */
export function resumoDoErroParaLog(erro: unknown): Record<string, unknown> {
  if (erro instanceof Error) {
    const r: Record<string, unknown> = { nome: erro.name, mensagem: redigirParaLog(erro.message) };
    const e = erro as unknown as Record<string, unknown>;
    for (const c of CAMPOS_PG) if (typeof e[c] === 'string' || typeof e[c] === 'number') r[c] = e[c];
    if (typeof e.detail === 'string') r.detalhe = redigirParaLog(e.detail);
    if (typeof erro.stack === 'string') r.pilha = redigirParaLog(erro.stack.split('\n').slice(1, 7).join('\n'));
    return r;
  }
  let texto: string;
  try {
    texto = typeof erro === 'string' ? erro : JSON.stringify(erro);
  } catch {
    texto = String(erro);
  }
  return { nome: typeof erro, mensagem: redigirParaLog(texto ?? '').slice(0, 500) };
}

/** Grava o detalhe do erro no log do servidor (nunca na resposta). */
export function registrarErroInterno(rota: string, erro: unknown): void {
  try {
    console.error(`[${rota}] erro interno`, resumoDoErroParaLog(erro));
  } catch {
    console.error(`[${rota}] erro interno (não foi possível resumir o erro)`);
  }
}

export interface OpcoesErroInterno {
  /** Nome do campo que a tela já lê («detail» por padrão; algumas rotas usam «error» ou «message»). */
  campo?: 'detail' | 'error' | 'message';
  /** Status HTTP (500 por padrão: o mesmo de antes). */
  status?: number;
  /** Mensagem simples própria da rota (ex.: «Não foi possível gerar o cartaz agora.»). */
  mensagem?: string;
}

/** Corpo público de um erro interno: mensagem simples e código estável. Nada do erro original. */
export function corpoErroInterno(opcoes: OpcoesErroInterno = {}): Record<string, string> {
  return { [opcoes.campo ?? 'detail']: opcoes.mensagem ?? MENSAGEM_ERRO_INTERNO, code: CODIGO_ERRO_INTERNO };
}

/** Registra o erro no log e devolve a resposta pública (JSON, status 500 por padrão). */
export function respostaErroInterno(rota: string, erro: unknown, opcoes: OpcoesErroInterno = {}): NextResponse {
  registrarErroInterno(rota, erro);
  return NextResponse.json(corpoErroInterno(opcoes), { status: opcoes.status ?? 500 });
}
