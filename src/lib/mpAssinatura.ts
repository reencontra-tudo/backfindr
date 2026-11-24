// Validação da ASSINATURA dos avisos (webhook) do Mercado Pago. Formato documentado pelo Mercado Pago (HIPÓTESE: não pude abrir a documentação oficial
// daqui; confirmar com a notificação simulada do painel do Mercado Pago / compra de teste antes de confiar):
//   cabeçalho `x-signature: ts=<carimbo>,v1=<hmac>`; `x-request-id`; texto assinado: `id:<data.id>;request-id:<x-request-id>;ts:<ts>;`
//   (partes ausentes são omitidas); HMAC-SHA256 em hexadecimal com a «assinatura secreta» do painel do Mercado Pago.
// O segredo NUNCA é lido do chat: fica na variável MP_WEBHOOK_SECRET (Vercel, só Production), colada pelo fundador.
import { createHmac, timingSafeEqual } from 'node:crypto';

export interface EntradaAssinatura {
  xSignature: string | null;
  xRequestId: string | null;
  /** `data.id` da notificação (da URL ou do corpo). */
  dataId: string | null;
  segredo: string;
}

export function partesDaAssinatura(h: string | null): { ts: string | null; v1: string | null } {
  let ts: string | null = null; let v1: string | null = null;
  for (const parte of (h ?? '').split(',')) {
    const [k, ...v] = parte.split('=');
    const chave = (k ?? '').trim(); const valor = v.join('=').trim();
    if (chave === 'ts') ts = valor; else if (chave === 'v1') v1 = valor;
  }
  return { ts, v1 };
}

export function textoAssinado(dataId: string | null, xRequestId: string | null, ts: string | null): string {
  const id = dataId && /^[A-Za-z0-9]+$/.test(dataId) ? dataId.toLowerCase() : dataId;
  let m = '';
  if (id) m += `id:${id};`;
  if (xRequestId) m += `request-id:${xRequestId};`;
  if (ts) m += `ts:${ts};`;
  return m;
}

export function assinar(texto: string, segredo: string): string {
  return createHmac('sha256', segredo).update(texto).digest('hex');
}

export function assinaturaValida(e: EntradaAssinatura): boolean {
  const { ts, v1 } = partesDaAssinatura(e.xSignature);
  if (!ts || !v1 || !e.segredo) return false;
  const esperado = Buffer.from(assinar(textoAssinado(e.dataId, e.xRequestId, ts), e.segredo), 'utf8');
  const recebido = Buffer.from(v1, 'utf8');
  return esperado.length === recebido.length && timingSafeEqual(esperado, recebido);
}
