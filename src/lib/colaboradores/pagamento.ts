// Programa de Colaboradores (E6): dados de pagamento (chave PIX e documento), CIFRADOS em repouso. SOMENTE SERVIDOR.
// Cifra: AES-256-GCM (autenticada). A chave de cifragem vem da variável de ambiente PIX_CHAVE_CIFRAGEM (32 bytes em base64), criada pelo fundador/NAV na Vercel e
// guardada FORA do sistema; sem ela, este módulo RECUSA gravar (nunca grava em claro). O valor da chave nunca é registrado em log nem devolvido.
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

export class CifragemIndisponivel extends Error { constructor() { super('PIX_CHAVE_CIFRAGEM ausente ou inválida'); this.name = 'CifragemIndisponivel'; } }

function chaveDe(env: Record<string, string | undefined>): Buffer {
  const b = Buffer.from(env.PIX_CHAVE_CIFRAGEM ?? '', 'base64');
  if (b.length !== 32) throw new CifragemIndisponivel();
  return b;
}
export const cifragemConfigurada = (env: Record<string, string | undefined> = process.env): boolean => { try { chaveDe(env); return true; } catch { return false; } };

/** `v1:<iv>:<tag>:<texto cifrado>` em base64. Cada chamada usa um IV novo (o mesmo texto nunca gera o mesmo resultado). */
export function cifrar(texto: string, env: Record<string, string | undefined> = process.env): string {
  const iv = randomBytes(12); const c = createCipheriv('aes-256-gcm', chaveDe(env), iv);
  const ct = Buffer.concat([c.update(texto, 'utf8'), c.final()]);
  return `v1:${iv.toString('base64')}:${c.getAuthTag().toString('base64')}:${ct.toString('base64')}`;
}
export function decifrar(valor: string, env: Record<string, string | undefined> = process.env): string {
  const [v, iv, tag, ct] = valor.split(':'); if (v !== 'v1' || !iv || !tag || !ct) throw new Error('formato inválido');
  const d = createDecipheriv('aes-256-gcm', chaveDe(env), Buffer.from(iv, 'base64')); d.setAuthTag(Buffer.from(tag, 'base64'));
  return Buffer.concat([d.update(Buffer.from(ct, 'base64')), d.final()]).toString('utf8');
}

const digitos = (t: string) => t.replace(/\D/g, '');
export function cpfValido(t: string): boolean {
  const d = digitos(t); if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  const dv = (n: number) => { let s = 0; for (let i = 0; i < n; i++) s += Number(d[i]) * (n + 1 - i); const r = (s * 10) % 11; return r === 10 ? 0 : r; };
  return dv(9) === Number(d[9]) && dv(10) === Number(d[10]);
}
export function cnpjValido(t: string): boolean {
  const d = digitos(t); if (d.length !== 14 || /^(\d)\1{13}$/.test(d)) return false;
  const dv = (n: number) => { const p = n === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]; let s = 0; for (let i = 0; i < n; i++) s += Number(d[i]) * p[i]; const r = s % 11; return r < 2 ? 0 : 11 - r; };
  return dv(12) === Number(d[12]) && dv(13) === Number(d[13]);
}

export type TipoChave = 'cpf' | 'cnpj' | 'email' | 'telefone' | 'aleatoria';
export interface DadosPagamento { tipoChave: TipoChave; chave: string; titularNome: string; documentoTipo: 'cpf' | 'cnpj'; documento: string }
export type ErrosPagamento = Partial<Record<'tipo_chave' | 'chave' | 'titular_nome' | 'documento', string>>;

const semControle = (t: string) => t.replace(/[\u0000-\u001F\u007F‪-‮⁦-⁩]/g, '').replace(/\s+/g, ' ').trim();

export function validarDadosPagamento(corpo: unknown): { ok: true; dados: DadosPagamento } | { ok: false; erros: ErrosPagamento } {
  const b = (corpo && typeof corpo === 'object' ? corpo : {}) as Record<string, unknown>; const erros: ErrosPagamento = {};
  const tipo = b.tipo_chave as TipoChave; const chaveBruta = typeof b.chave === 'string' ? b.chave.trim() : '';
  let chave = chaveBruta;
  if (!['cpf', 'cnpj', 'email', 'telefone', 'aleatoria'].includes(String(tipo))) erros.tipo_chave = 'Escolha o tipo da chave PIX.';
  else if (tipo === 'cpf') { chave = digitos(chaveBruta); if (!cpfValido(chave)) erros.chave = 'CPF inválido.'; }
  else if (tipo === 'cnpj') { chave = digitos(chaveBruta); if (!cnpjValido(chave)) erros.chave = 'CNPJ inválido.'; }
  else if (tipo === 'email') { chave = chaveBruta.toLowerCase(); if (!/^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/.test(chave) || chave.length > 254) erros.chave = 'E-mail inválido.'; }
  else if (tipo === 'telefone') { chave = digitos(chaveBruta); if (!/^\d{10,13}$/.test(chave)) erros.chave = 'Telefone inválido (com DDD).'; }
  else if (!/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(chaveBruta)) erros.chave = 'Chave aleatória inválida.';
  const titular = typeof b.titular_nome === 'string' ? semControle(b.titular_nome) : '';
  if (titular.length < 2 || titular.length > 120) erros.titular_nome = 'Informe o nome completo do titular (2 a 120 caracteres).';
  const doc = digitos(typeof b.documento === 'string' ? b.documento : ''); const docTipo: 'cpf' | 'cnpj' = doc.length === 14 ? 'cnpj' : 'cpf';
  if (!(docTipo === 'cpf' ? cpfValido(doc) : cnpjValido(doc))) erros.documento = 'CPF ou CNPJ do titular inválido.';
  if (Object.keys(erros).length > 0) return { ok: false, erros };
  return { ok: true, dados: { tipoChave: tipo, chave, titularNome: titular, documentoTipo: docTipo, documento: doc } };
}

/** Final mostrável (últimos 4 caracteres): a tela NUNCA mostra a chave inteira. */
export const finalDe = (t: string) => t.slice(-4);
