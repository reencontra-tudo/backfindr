/**
 * Governança de dados — regras puras (sem banco, sem rede) para exclusão com motivo, retenção e ator.
 * Princípio: dado inserido jamais é apagado sem rastro; vai para a lixeira por um prazo; tudo é auditável.
 * Testado em tests/governance.test.mjs (node --test). Migração: docs/migrations/018_*.sql.
 */

/** Prazo padrão de retenção na lixeira (dias). Configurável por GOV_RETENTION_DAYS; a limpeza definitiva é separada e desligada. */
export const RETENTION_DAYS_DEFAULT = 90;

export function retentionDays(raw: string | undefined | null = process.env.GOV_RETENTION_DAYS ?? process.env.NEXT_PUBLIC_GOV_RETENTION_DAYS): number {
  const n = Number.parseInt(String(raw ?? ''), 10);
  return Number.isFinite(n) && n >= 1 && n <= 3650 ? n : RETENTION_DAYS_DEFAULT;
}

export function restorableUntil(deletedAt: Date, days: number = retentionDays()): Date {
  return new Date(deletedAt.getTime() + days * 24 * 60 * 60 * 1000);
}

// ─── Motivos de exclusão ──────────────────────────────────────────────────────

/** Ação que o modal oferece em vez de só registrar o motivo. */
export type OwnerReasonAction =
  | 'delete'            // segue para a exclusão lógica
  | 'mark_recovered'    // oferece "marcar como recuperado" (e pergunta se o Backfindr ajudou)
  | 'review_duplicates' // mostra ocorrências parecidas do mesmo usuário; manter uma
  | 'edit'              // leva à edição
  | 'pause'             // oculta sem excluir (reativável)
  | 'privacy_request';  // leva ao pedido de exclusão de dados (LGPD) — outro fluxo

export interface OwnerReason {
  code: string;
  label: string;
  action: OwnerReasonAction;
  /** permite texto curto opcional */
  allowsText?: boolean;
}

/** Ordem da lista do modal. "Prefiro não dizer" nunca é obrigatório: o dono sempre conclui. */
export const OWNER_REASONS: readonly OwnerReason[] = [
  { code: 'recuperei', label: 'Encontrei ou recuperei o item', action: 'mark_recovered' },
  { code: 'duplicada', label: 'Cadastrei duas vezes', action: 'review_duplicates' },
  { code: 'errado', label: 'Cadastrei errado', action: 'edit' },
  { code: 'pausar', label: 'Quero pausar por enquanto', action: 'pause' },
  { code: 'desisti', label: 'Desisti / não preciso mais divulgar', action: 'delete' },
  { code: 'pedido_lgpd', label: 'Quero que apaguem meus dados', action: 'privacy_request' },
  { code: 'outro', label: 'Outro', action: 'delete', allowsText: true },
  { code: 'nao_informado', label: 'Prefiro não dizer', action: 'delete' },
] as const;

/** Códigos gravados em deleted_reason pelo caminho do dono (ver CHECK da migração 018). */
export const OWNER_DELETE_CODES = ['nao_informado', 'recuperei', 'duplicada', 'errado', 'desisti', 'pedido_lgpd', 'outro'] as const;

/** Lista fixa do admin; o motivo é OBRIGATÓRIO na exclusão feita por admin. */
export const ADMIN_REASONS = [
  { code: 'adm_denuncia', label: 'Denúncia procedente (moderação)' },
  { code: 'adm_duplicidade', label: 'Duplicidade' },
  { code: 'adm_dado_incorreto', label: 'Dado incorreto ou impróprio' },
  { code: 'adm_solicitacao_titular', label: 'Solicitação do titular (por canal oficial)' },
  { code: 'adm_spam_teste', label: 'Spam ou teste' },
  { code: 'adm_outro', label: 'Outro (descrever)' },
] as const;

export const REASON_TEXT_MAX = 200;

/** Passo do modal de exclusão para cada motivo (lógica pura e testável; a tela só desenha). */
export type ModalStep = 'confirm' | 'text' | 'recovered' | 'duplicates' | 'edit' | 'pause' | 'privacy';
export function modalStepFor(code: string): ModalStep {
  const r = OWNER_REASONS.find((x) => x.code === code);
  if (!r) return 'confirm';
  switch (r.action) {
    case 'mark_recovered': return 'recovered';
    case 'review_duplicates': return 'duplicates';
    case 'edit': return 'edit';
    case 'pause': return 'pause';
    case 'privacy_request': return 'privacy';
    default: return r.allowsText ? 'text' : 'confirm';
  }
}


export type DeletionRole = 'owner' | 'admin';
export type DeletionResolution =
  | { ok: true; reason: string; reasonText: string | null }
  | { ok: false; error: 'reason_required' | 'reason_invalid' | 'reason_text_not_allowed' };

/** Texto livre pode conter dado pessoal: tratar como dado — aparar, normalizar espaços, tirar controles e limitar. */
export function normalizeReasonText(text: unknown): string | null {
  if (typeof text !== 'string') return null;
  // eslint-disable-next-line no-control-regex
  const t = text.replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, REASON_TEXT_MAX);
  return t.length > 0 ? t : null;
}

/**
 * Valida o motivo da exclusão.
 * - dono: motivo opcional (vazio → 'nao_informado'); aceita só códigos do dono; texto só em 'outro';
 * - admin: motivo OBRIGATÓRIO, só códigos da lista de admin; texto livre só em 'adm_outro'.
 */
export function resolveDeletion(role: DeletionRole, input: { reason?: unknown; reason_text?: unknown } | null | undefined): DeletionResolution {
  const raw = typeof input?.reason === 'string' ? input.reason.trim() : '';
  const text = normalizeReasonText(input?.reason_text);
  if (role === 'admin') {
    if (!raw) return { ok: false, error: 'reason_required' };
    const adm = ADMIN_REASONS.find((r) => r.code === raw);
    if (!adm) return { ok: false, error: 'reason_invalid' };
    if (text && raw !== 'adm_outro') return { ok: false, error: 'reason_text_not_allowed' };
    return { ok: true, reason: raw, reasonText: text };
  }
  const code = raw || 'nao_informado';
  if (!(OWNER_DELETE_CODES as readonly string[]).includes(code)) return { ok: false, error: 'reason_invalid' };
  if (text && code !== 'outro') return { ok: false, error: 'reason_text_not_allowed' };
  return { ok: true, reason: code, reasonText: text };
}

/** Resposta opcional à pergunta "O Backfindr ajudou?" ao marcar como recuperado. */
export function normalizeHelped(v: unknown): 'sim' | 'nao' | null {
  return v === 'sim' || v === 'nao' ? v : null;
}

// ─── Ator da auditoria ────────────────────────────────────────────────────────

export type ActorType = 'usuario' | 'admin' | 'impersonacao' | 'sistema' | 'script' | 'desconhecido';

export interface AuditActor {
  /** quem agiu (em impersonação: o ADMIN que está personificando) */
  id: string | null;
  type: ActorType;
  /** usuário-alvo quando type = 'impersonacao' */
  impersonatedId: string | null;
  /** rota ou rotina de origem, p.ex. "DELETE /api/v1/objects/[id]" */
  origin: string;
  requestId: string | null;
}

interface PayloadLike { sub?: string; impersonated_by?: string | null }

/**
 * Deriva o ator a partir do token. Token com `impersonated_by` → impersonação: ator = admin, alvo = sub.
 * `admin` = true quando a rota exige papel admin/super_admin (requireAdmin).
 */
export function actorFromPayload(payload: PayloadLike | null | undefined, origin: string, requestId: string | null = null, admin = false): AuditActor {
  if (!payload?.sub) return { id: null, type: 'desconhecido', impersonatedId: null, origin, requestId };
  if (payload.impersonated_by) {
    return { id: payload.impersonated_by, type: 'impersonacao', impersonatedId: payload.sub, origin, requestId };
  }
  return { id: payload.sub, type: admin ? 'admin' : 'usuario', impersonatedId: null, origin, requestId };
}

/** Ator das rotas de admin (requireAdmin já validou o papel). */
export function adminActor(adminId: string, origin: string, requestId: string | null = null): AuditActor {
  return { id: adminId, type: 'admin', impersonatedId: null, origin, requestId };
}

export function newRequestId(headers?: { get(name: string): string | null }): string {
  const h = headers?.get('x-vercel-id') || headers?.get('x-request-id');
  if (h) return h.slice(0, 120);
  return `req-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

// ─── Consulta de ocorrências parecidas do mesmo usuário ("Cadastrei duas vezes") ─
/** Parâmetros: $1 user_id, $2 id da ocorrência atual, $3 categoria, $4 título. Igual à usada no teste SQL T7. */
export const SIMILAR_OBJECTS_SQL = `
  SELECT o.id, o.title, o.status, o.category, o.created_at, o.qr_code
    FROM objects_active o
   WHERE o.user_id = $1 AND o.id <> $2 AND o.category = $3
     AND (lower(btrim(o.title)) = lower(btrim($4)) OR similarity(o.title, $4) >= 0.6)
   ORDER BY o.created_at DESC
   LIMIT 5`;

// ─── Textos honestos do modal (sem pressão emocional nem falsa urgência) ────────
export const SHARE_WARNING =
  'Cartões, QR Codes e posts que você já compartilhou deixarão de funcionar. Quem abrir o link vai ver que a ocorrência não está mais disponível.';
export function retentionNotice(days: number = retentionDays()): string {
  return `Ao fim de ${days} dias a ocorrência é anonimizada, não apagada: ficam só dados genéricos, sem como identificar você. Em pedido de apagamento (LGPD), a anonimização é na hora.`;
}
export function undoMessage(days: number = retentionDays()): string {
  return `Excluído. Você pode desfazer agora; ao fim de ${days} dias a ocorrência é anonimizada.`;
}

// ─── Anonimização (admin: "Anonimizar agora"; fim da retenção é rotina do sistema) ─────────────────────────
/** Motivos que o admin pode escolher (fim_retencao é só da rotina do sistema). Tudo é irreversível. */
export const ANON_REASONS = [
  { code: 'pedido_lgpd', label: 'Pedido de apagamento do titular (LGPD)' },
  { code: 'adm_solicitacao_titular', label: 'Solicitação do titular por canal oficial' },
  { code: 'adm_dado_pessoal_terceiros', label: 'Dado pessoal de terceiros na ocorrência' },
  { code: 'adm_outro', label: 'Outro (registrar na auditoria)' },
] as const;
/** Palavra que o admin digita para liberar o botão (proteção contra clique acidental). */
export const ANON_CONFIRM_WORD = 'ANONIMIZAR';
export type AnonResolution = { ok: true; reason: string } | { ok: false; error: 'reason_required' | 'reason_invalid' | 'confirmation_required' };
export function resolveAnonymization(input: { reason?: unknown; confirm?: unknown; confirm_text?: unknown } | null | undefined): AnonResolution {
  const raw = typeof input?.reason === 'string' ? input.reason.trim() : '';
  if (!raw) return { ok: false, error: 'reason_required' };
  if (!ANON_REASONS.some((r) => r.code === raw)) return { ok: false, error: 'reason_invalid' };
  if (input?.confirm !== true || input?.confirm_text !== ANON_CONFIRM_WORD) return { ok: false, error: 'confirmation_required' };
  return { ok: true, reason: raw };
}

/** Eventos de produto (PostHog) — só códigos, sem dado pessoal. */
export interface DeletionAnalytics { reason: string; category: string | null; status: string | null; by: 'dono' | 'admin' }
export function deletionAnalyticsProps(p: DeletionAnalytics): Record<string, string | null> {
  return { reason: p.reason, category: p.category, status: p.status, by: p.by };
}

/** Status que justificam alerta no Telegram quando a ocorrência é excluída ou marcada como recuperada (desenho; envio NÃO implementado). */
export const ALERT_STATUSES = ['stolen', 'lost'] as const;
export function shouldAlertOnChange(prevStatus: string | null | undefined, event: 'deleted' | 'recovered'): boolean {
  void event;
  return !!prevStatus && (ALERT_STATUSES as readonly string[]).includes(prevStatus);
}
