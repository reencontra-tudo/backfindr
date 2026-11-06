// Regra central de quem pode receber e-mail do Backfindr + hash do endereço + token de descadastro.
//
// Categorias:
//   'security'  redefinição de senha e magic link (pedidos pelo próprio usuário)
//   'service'   boas-vindas, alerta de match, objeto encontrado, avisos do próprio registro
//   'marketing' campanhas, dicas, reativação, guias
//
// Regras (canSendEmail):
//   - conta de sistema: nunca recebe, em nenhuma categoria.
//   - security: qualquer usuário, inclusive legado; recusa só se o endereço está suprimido por bounce.
//   - service: recusa legado e endereço suprimido (qualquer motivo).
//   - marketing: exige email_preferences.marketing_opt_in = true E endereço não suprimido. Usuário legado
//     só passa se o próprio usuário tiver opt-in registrado.
//
// O endereço nunca é gravado em texto puro: email_hash = HMAC-SHA256(EMAIL_HASH_SECRET, e-mail normalizado).
// Sem EMAIL_HASH_SECRET não há como consultar supressão: security e service seguem (com aviso no log, como
// antes da regra existir) e marketing é recusado.
import crypto from 'crypto';
import { query } from '@/lib/db';

export type EmailCategory = 'security' | 'service' | 'marketing';

export type SkipReason =
  | 'system_account'
  | 'legacy'
  | 'suppressed'
  | 'no_marketing_opt_in'
  | 'policy_unavailable';

export interface EmailRecipient {
  id?: string | null;
  email: string;
  is_legacy?: boolean | null;
  is_system_account?: boolean | null;
}

export type PolicyDecision =
  | { allowed: true; userId: string | null }
  | { allowed: false; reason: SkipReason; userId: string | null };

export type SuppressionReason = 'unsubscribe' | 'bounce' | 'complaint' | 'manual';

const TOKEN_TTL_SECONDS = 2 * 365 * 24 * 60 * 60;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function secret(): string | null {
  const s = process.env.EMAIL_HASH_SECRET;
  return s && s.length > 0 ? s : null;
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** HMAC-SHA256 do e-mail normalizado; null se EMAIL_HASH_SECRET não estiver definida. */
export function hashEmail(email: string): string | null {
  const key = secret();
  if (!key) return null;
  return crypto.createHmac('sha256', key).update(`email:${normalizeEmail(email)}`).digest('hex');
}

// ─── Token de descadastro ───────────────────────────────────────────────────────
// token = base64url(JSON { h: hash do e-mail, u: user_id | null, c: campanha | null, e: expiração (epoch s) }) + '.' + HMAC.
// Nada de endereço em texto puro dentro do token.

function sign(payloadB64: string, key: string): string {
  return crypto.createHmac('sha256', key).update(`unsub:${payloadB64}`).digest('base64url');
}

export function createUnsubscribeToken(
  email: string,
  userId: string | null,
  campaignId: string | null = null,
  nowMs = Date.now(),
): string | null {
  const key = secret();
  const h = hashEmail(email);
  if (!key || !h) return null;
  const payload = { h, u: userId, c: campaignId, e: Math.floor(nowMs / 1000) + TOKEN_TTL_SECONDS };
  const b64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${b64}.${sign(b64, key)}`;
}

export type TokenCheck =
  | { ok: true; emailHash: string; userId: string | null; campaignId: string | null }
  | { ok: false; error: 'invalid' | 'expired' };

export function verifyUnsubscribeToken(token: string | null | undefined, nowMs = Date.now()): TokenCheck {
  const key = secret();
  if (!key || !token || typeof token !== 'string') return { ok: false, error: 'invalid' };
  const parts = token.split('.');
  if (parts.length !== 2) return { ok: false, error: 'invalid' };
  const [b64, sig] = parts;
  const expected = sign(b64, key);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return { ok: false, error: 'invalid' };
  let payload: { h?: unknown; u?: unknown; c?: unknown; e?: unknown };
  try {
    payload = JSON.parse(Buffer.from(b64, 'base64url').toString('utf8'));
  } catch {
    return { ok: false, error: 'invalid' };
  }
  if (typeof payload.h !== 'string' || typeof payload.e !== 'number') return { ok: false, error: 'invalid' };
  if (payload.e * 1000 < nowMs) return { ok: false, error: 'expired' };
  const userId = typeof payload.u === 'string' ? payload.u : null;
  const campaignId = typeof payload.c === 'string' && UUID_RE.test(payload.c) ? payload.c : null;
  return { ok: true, emailHash: payload.h, userId, campaignId };
}

// ─── Supressão ──────────────────────────────────────────────────────────────────

const UNDEFINED_TABLE = '42P01';

function isUndefinedTable(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { code?: string }).code === UNDEFINED_TABLE;
}

/** Insere o hash na lista de supressão. Idempotente: se já existe, não muda nada. true = inseriu agora. */
export async function addSuppressionByHash(params: {
  emailHash: string;
  userId?: string | null;
  reason: SuppressionReason;
  source: string;
}): Promise<boolean> {
  const r = await query(
    `INSERT INTO email_suppressions (email_hash, user_id, reason, source)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (email_hash) DO NOTHING`,
    [params.emailHash, params.userId ?? null, params.reason, params.source],
  );
  return (r.rowCount ?? 0) > 0;
}

async function suppressionReason(emailHash: string): Promise<SuppressionReason | null> {
  try {
    const r = await query(`SELECT reason FROM email_suppressions WHERE email_hash = $1`, [emailHash]);
    return (r.rows[0]?.reason as SuppressionReason | undefined) ?? null;
  } catch (err) {
    // Migration 020 ainda não aplicada: sem tabela, não há supressão registrada.
    if (isUndefinedTable(err)) return null;
    throw err;
  }
}

async function hasMarketingOptIn(userId: string): Promise<boolean> {
  try {
    const r = await query(`SELECT marketing_opt_in FROM email_preferences WHERE user_id = $1`, [userId]);
    return r.rows[0]?.marketing_opt_in === true;
  } catch (err) {
    if (isUndefinedTable(err)) return false;
    throw err;
  }
}

async function resolveUser(
  r: EmailRecipient,
): Promise<{ id: string | null; legacy: boolean; system: boolean }> {
  if (r.is_legacy !== undefined || r.is_system_account !== undefined) {
    return { id: r.id ?? null, legacy: r.is_legacy === true, system: r.is_system_account === true };
  }
  const res = await query(
    `SELECT id, is_legacy, is_system_account FROM users WHERE lower(email) = $1 LIMIT 1`,
    [normalizeEmail(r.email)],
  );
  const row = res.rows[0] as { id: string; is_legacy: boolean | null; is_system_account: boolean | null } | undefined;
  if (!row) return { id: r.id ?? null, legacy: false, system: false };
  return { id: row.id, legacy: row.is_legacy === true, system: row.is_system_account === true };
}

export async function canSendEmail(recipient: EmailRecipient, category: EmailCategory): Promise<PolicyDecision> {
  let user: { id: string | null; legacy: boolean; system: boolean };
  try {
    user = await resolveUser(recipient);
  } catch (err) {
    console.error('[email] não foi possível consultar o usuário para a regra de envio:', (err as { code?: string })?.code ?? 'erro');
    // Sem saber quem é o destinatário, só o e-mail de segurança (pedido pelo próprio usuário) segue.
    return category === 'security'
      ? { allowed: true, userId: recipient.id ?? null }
      : { allowed: false, reason: 'policy_unavailable', userId: recipient.id ?? null };
  }

  if (user.system) return { allowed: false, reason: 'system_account', userId: user.id };

  let reason: SuppressionReason | null = null;
  const hash = hashEmail(recipient.email);
  if (hash) {
    try {
      reason = await suppressionReason(hash);
    } catch (err) {
      console.error('[email] não foi possível consultar a lista de supressão:', (err as { code?: string })?.code ?? 'erro');
      return category === 'security'
        ? { allowed: true, userId: user.id }
        : { allowed: false, reason: 'policy_unavailable', userId: user.id };
    }
  } else if (category !== 'security') {
    console.warn('[email] EMAIL_HASH_SECRET ausente: supressão não pode ser consultada');
  }

  if (category === 'security') {
    return reason === 'bounce'
      ? { allowed: false, reason: 'suppressed', userId: user.id }
      : { allowed: true, userId: user.id };
  }

  if (category === 'service') {
    if (user.legacy) return { allowed: false, reason: 'legacy', userId: user.id };
    if (reason) return { allowed: false, reason: 'suppressed', userId: user.id };
    return { allowed: true, userId: user.id };
  }

  // marketing: exige opt-in registrado e endereço não suprimido (sem hash não dá para garantir isso).
  if (!hash) return { allowed: false, reason: 'policy_unavailable', userId: user.id };
  if (reason) return { allowed: false, reason: 'suppressed', userId: user.id };
  if (!user.id) return { allowed: false, reason: 'no_marketing_opt_in', userId: null };
  try {
    if (!(await hasMarketingOptIn(user.id))) return { allowed: false, reason: 'no_marketing_opt_in', userId: user.id };
  } catch (err) {
    console.error('[email] não foi possível consultar as preferências de e-mail:', (err as { code?: string })?.code ?? 'erro');
    return { allowed: false, reason: 'policy_unavailable', userId: user.id };
  }
  return { allowed: true, userId: user.id };
}
