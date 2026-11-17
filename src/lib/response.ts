import { NextResponse } from 'next/server';
import { respostaErroInterno } from '@/lib/erroInterno';

export function successResponse(data: any, status = 200) {
  return NextResponse.json(data, { status });
}

export function errorResponse(detail: string, status = 400) {
  return NextResponse.json({ detail }, { status });
}

export function unauthorizedResponse() {
  return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 });
}

export function notFoundResponse() {
  return NextResponse.json({ detail: 'Not found' }, { status: 404 });
}

export function conflictResponse(detail: string) {
  return NextResponse.json({ detail }, { status: 409 });
}

// Erro inesperado: o detalhe vai só para o log do servidor; o cliente recebe mensagem simples e código estável
// (src/lib/erroInterno.ts). Mesmo status (500) e mesmo campo («detail») de antes.
export function internalErrorResponse(error: any, rota = 'api') {
  return respostaErroInterno(rota, error);
}
