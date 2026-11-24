// Validação da ASSINATURA dos avisos (webhook) do Mercado Pago — conferida em 24/11/2026 contra o validador do SDK OFICIAL do Mercado Pago
// (`WebhookSignatureValidator`, pacote `mercadopago@3.6.2`, `dist/utils/webhook`) e contra as regras documentadas informadas pelo fundador:
//   • cabeçalho `x-signature: ts=<segundos>,v1=<hmac>` (partes separadas por vírgula; chaves sem diferenciar maiúscula; `ts` só dígitos);
//   • texto assinado (manifest): `id:<data.id>;request-id:<x-request-id>;ts:<ts>;` — o `data.id` vem dos PARÂMETROS DA URL (`?data.id=`), NÃO do corpo;
//     pares AUSENTES são OMITIDOS (nunca entram vazios);
//   • HMAC-SHA256 com a «assinatura secreta» do painel do Mercado Pago, em hexadecimal, comparado em tempo constante com o `v1`.
// DIFERENÇA CONHECIDA (relato de desenvolvedores × SDK): a documentação/relatos mandam converter `data.id` ALFANUMÉRICO para minúsculo antes do cálculo; o SDK
// oficial NÃO converte (usa o valor como veio). Para não rejeitar aviso legítimo em nenhum dos dois casos, aceitamos o manifest com o id COMO VEIO e,
// só se o id tiver letras maiúsculas, também o manifest com o id em minúsculo. Para pagamentos (ids numéricos) as duas formas são idênticas.
// Não usamos o validador do SDK porque o projeto está no `mercadopago@2.12.0` (sem o validador); migrar para a 3.x é uma mudança maior, tratada à parte.
// O segredo NUNCA é lido do chat: fica na variável MP_WEBHOOK_SECRET (Vercel, só Production), colada pelo fundador.
import { createHmac, timingSafeEqual } from 'node:crypto';

export interface EntradaAssinatura {
  xSignature: string | null | undefined;
  xRequestId: string | null | undefined;
  /** Valor do parâmetro `data.id` da URL (não do corpo). */
  dataId: string | null | undefined;
  segredo: string;
}

/** Igual ao `normalise` do SDK: texto aparado; vazio ou ausente = `undefined`. */
const limpo = (v: string | null | undefined): string | undefined => {
  if (v === undefined || v === null) return undefined;
  const t = String(v).trim();
  return t.length > 0 ? t : undefined;
};

export function partesDaAssinatura(h: string | null | undefined): { ts: string | null; hashes: Record<string, string> } {
  const hashes: Record<string, string> = {}; let ts: string | null = null;
  for (const parte of (limpo(h) ?? '').split(',')) {
    const i = parte.indexOf('='); if (i === -1) continue;
    const chave = parte.slice(0, i).trim().toLowerCase(); const valor = parte.slice(i + 1).trim();
    if (!chave || !valor) continue;
    if (chave === 'ts') ts = valor; else if (/^v\d+$/.test(chave)) hashes[chave] = valor;
  }
  return { ts, hashes };
}

/** Manifest como o SDK oficial monta: pares ausentes omitidos; `ts` sempre presente; termina com `;`. */
export function textoAssinado(dataId: string | null | undefined, xRequestId: string | null | undefined, ts: string): string {
  const p: string[] = []; const id = limpo(dataId); const rid = limpo(xRequestId);
  if (id) p.push(`id:${id}`);
  if (rid) p.push(`request-id:${rid}`);
  p.push(`ts:${ts}`);
  return p.join(';') + ';';
}

export function assinar(texto: string, segredo: string): string {
  return createHmac('sha256', segredo).update(texto).digest('hex');
}

const iguais = (a: string, b: string) => Buffer.byteLength(a) === Buffer.byteLength(b) && timingSafeEqual(Buffer.from(a), Buffer.from(b));

export function assinaturaValida(e: EntradaAssinatura): boolean {
  if (!e.segredo) return false;
  const { ts, hashes } = partesDaAssinatura(e.xSignature);
  if (!ts || !/^\d+$/.test(ts)) return false;
  const recebido = hashes.v1; if (!recebido) return false;
  const id = limpo(e.dataId);
  const candidatos = [id];
  if (id && /^[A-Za-z0-9]+$/.test(id) && id !== id.toLowerCase()) candidatos.push(id.toLowerCase());
  return candidatos.some((c) => iguais(assinar(textoAssinado(c, e.xRequestId, ts), e.segredo), recebido));
}
