import { NextRequest, NextResponse } from 'next/server';

const N8N_URL = process.env.NEXT_PUBLIC_N8N_URL ?? '';

/**
 * Proxy reverso para o n8n que remove o header X-Frame-Options,
 * permitindo que o n8n seja carregado em iframe no painel admin.
 *
 * O iframe aponta para /api/n8n-proxy?path=... (mesmo domínio),
 * evitando o bloqueio SAMEORIGIN do n8n.
 */
export async function GET(request: NextRequest) {
  if (!N8N_URL) {
    return new NextResponse('N8N_URL não configurada', { status: 503 });
  }

  const { searchParams } = new URL(request.url);
  const path = searchParams.get('path') ?? '/';
  const targetUrl = N8N_URL.replace(/\/$/, '') + (path.startsWith('/') ? path : '/' + path);

  try {
    // Encaminhar todos os headers relevantes, exceto host
    const headers: Record<string, string> = {};
    request.headers.forEach((value, key) => {
      if (!['host', 'x-forwarded-host', 'x-forwarded-proto'].includes(key.toLowerCase())) {
        headers[key] = value;
      }
    });

    const response = await fetch(targetUrl, {
      method: request.method,
      headers,
      redirect: 'follow',
    });

    // Copiar headers da resposta, removendo X-Frame-Options e CSP frame-ancestors
    const responseHeaders = new Headers();
    response.headers.forEach((value, key) => {
      const lowerKey = key.toLowerCase();
      if (lowerKey === 'x-frame-options') return; // remover
      if (lowerKey === 'content-security-policy') {
        // Remover frame-ancestors da CSP
        const newCsp = value
          .split(';')
          .map((d) => d.trim())
          .filter((d) => !d.startsWith('frame-ancestors'))
          .join('; ');
        responseHeaders.set(key, newCsp);
        return;
      }
      responseHeaders.set(key, value);
    });

    const body = await response.arrayBuffer();
    return new NextResponse(body, {
      status: response.status,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error('[n8n-proxy] Erro:', error);
    return new NextResponse('Erro ao conectar ao n8n', { status: 502 });
  }
}
