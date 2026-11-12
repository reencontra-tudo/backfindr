// GET /api/v1/feed/geo — localização aproximada de QUEM PERGUNTA (país, sigla do estado, cidade), para o Feed.
// Somente leitura. Resposta POR VISITANTE: nunca pode ser guardada em cache compartilhado (Cache-Control: private, no-store).
// Não guarda nem registra IP, cidade ou coordenadas: sem banco, sem log, sem evento.
// 1) cabeçalhos de localização da Vercel; 2) reserva: ipapi.co chamado AQUI no servidor, só se os cabeçalhos faltarem
// (é o mesmo serviço e o mesmo IP que o navegador já enviava antes; agora sai do servidor).
import { NextRequest, NextResponse } from 'next/server';
import { NO_GEO, geoFromIpapi, geoFromVercelHeaders, visitorIp, type FeedGeo } from '@/lib/feed/geo';

export const dynamic = 'force-dynamic'; // resposta por visitante: nunca estática

const HEADERS = { 'Cache-Control': 'private, no-store' };
const IPAPI_TIMEOUT_MS = 2500; // cabe nos 4 s que o navegador espera

async function lookupIpapi(ip: string): Promise<FeedGeo> {
  try {
    const res = await fetch(`https://ipapi.co/${ip}/json/`, {
      signal: AbortSignal.timeout(IPAPI_TIMEOUT_MS), cache: 'no-store', headers: { Accept: 'application/json' },
    });
    if (!res.ok) return NO_GEO;
    return geoFromIpapi(await res.json());
  } catch { return NO_GEO; } // falha da reserva: não localizado, em silêncio (nada de log com IP)
}

export async function GET(request: NextRequest) {
  const answer = (g: FeedGeo) => NextResponse.json({ country: g.country, uf: g.uf, city: g.city }, { headers: HEADERS });
  try {
    const fromHeaders = geoFromVercelHeaders(request.headers);
    if (fromHeaders) return answer(fromHeaders);
    const ip = visitorIp(request.headers);
    return answer(ip ? await lookupIpapi(ip) : NO_GEO); // sem IP público não há o que perguntar à reserva
  } catch (error) {
    if ((error as { digest?: string })?.digest === 'DYNAMIC_SERVER_USAGE') throw error;
    return answer(NO_GEO);
  }
}
