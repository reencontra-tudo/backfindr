// Programa de Colaboradores (E3): marca do colaborador no cartaz (imagem de divulgação) de uma ocorrência cadastrada com o código dele. SOMENTE SERVIDOR.
//
// REGRA DE NÃO REGRESSÃO: sem a marca, o cartaz sai IDÊNTICO ao de hoje. Por isso:
//  • com COLABORADORES_ATIVO desligado, esta função devolve null SEM consultar o banco (o cartaz atual não ganha nenhuma consulta nova);
//  • a consulta é SEPARADA e à prova de falha: se as colunas do programa não existirem (migration 026 não aplicada) ou o banco falhar, devolve null;
//  • só colaborador ATIVO tem marca (suspenso, que saiu ou excluído não é divulgado);
//  • a logo é opcional: só https, baixada com limite de tempo e de tamanho e REDUZIDA (96×96) antes de entrar no cartaz; qualquer falha = só o nome.
import sharp from 'sharp';
import { colaboradoresAtivo } from './rota';
import { urlSegura } from './pagina';

export interface MarcaCartaz { nome: string; logo: string | null }

type Consulta = (texto: string, params?: unknown[]) => Promise<{ rows: Array<Record<string, unknown>> }>;

export const NOME_MAX = 34;
const LOGO_LADO = 96;
const LOGO_MAX_BYTES = 2_000_000;
const LOGO_TIMEOUT_MS = 5_000;

/** Nome para o cartaz: até NOME_MAX caracteres (por caractere, sem cortar emoji ao meio), com reticências se cortou. */
export function nomeParaCartaz(nome: string): string {
  const letras = Array.from(nome.replace(/\s+/g, ' ').trim());
  return letras.length <= NOME_MAX ? letras.join('') : letras.slice(0, NOME_MAX - 1).join('').trimEnd() + '…';
}

/** Baixa a logo (https), limita tempo e tamanho, e devolve um PNG 96×96 em data URL. Qualquer falha = null. */
export async function logoComoDataUrl(url: string | null, buscar: typeof fetch = fetch): Promise<string | null> {
  const seguro = urlSegura(url);
  if (!seguro) return null;
  try {
    const res = await buscar(seguro, { cache: 'no-store', redirect: 'follow', signal: AbortSignal.timeout(LOGO_TIMEOUT_MS), headers: { 'User-Agent': 'Backfindr-Cartaz/1.0 (+https://backfindr.com)' } });
    const tipo = res.headers.get('content-type') ?? '';
    if (!res.ok || !/^image\/(png|jpe?g|webp)/i.test(tipo)) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length === 0 || buf.length > LOGO_MAX_BYTES) return null;
    const png = await sharp(buf).resize(LOGO_LADO, LOGO_LADO, { fit: 'cover' }).png().toBuffer();
    return `data:image/png;base64,${png.toString('base64')}`;
  } catch { return null; }
}

export async function obterMarcaDoCartaz(
  consulta: Consulta,
  objectId: string,
  logo: (url: string | null) => Promise<string | null> = logoComoDataUrl,
): Promise<MarcaCartaz | null> {
  if (!colaboradoresAtivo()) return null;
  try {
    const r = await consulta(
      `SELECT c.nome, c.imagem_url FROM objects o JOIN colaboradores c ON c.id = o.colaborador_id WHERE o.id = $1 AND c.estado = 'ativo' LIMIT 1`,
      [objectId],
    );
    const c = r.rows[0];
    if (!c || typeof c.nome !== 'string' || c.nome.trim() === '') return null;
    return { nome: nomeParaCartaz(c.nome), logo: await logo(typeof c.imagem_url === 'string' ? c.imagem_url : null) };
  } catch (e) {
    console.warn('[colaboradores] marca do cartaz indisponível; o cartaz sai sem ela:', e instanceof Error ? e.message : 'erro');
    return null;
  }
}
