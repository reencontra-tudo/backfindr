// ─── Mensagem da plataforma (admin → dono, caixa de notificações in-app) ────
// Somente in-app: sem e-mail, push ou WhatsApp. Tipo gravado em notifications.type.
// Validação pura, separada da rota para ser testável.

export const PLATFORM_MESSAGE_TYPE = 'platform_message';
export const PLATFORM_MESSAGE_TITLE_MAX = 80;
export const PLATFORM_MESSAGE_TEXT_MAX = 500;
export const PLATFORM_MESSAGE_LINK_MAX = 200;

/** Escapa HTML: o texto da mensagem é sempre texto puro, nunca marcação. */
export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Inverso de escapeHtml, usado só para exibir como texto (nunca como HTML). */
export function unescapeHtml(s: string): string {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&');
}

// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

function clean(s: string): string {
  return s.replace(CONTROL_CHARS, '').trim();
}

/** Link só pode ser caminho interno: começa com "/", sem "//", "\", espaços ou esquema. */
export function isInternalPath(link: string): boolean {
  if (!link.startsWith('/') || link.startsWith('//')) return false;
  if (link.length > PLATFORM_MESSAGE_LINK_MAX) return false;
  if (/[\\\s\u0000-\u001F\u007F]/.test(link)) return false;
  return true;
}

export interface ValidatedMessage {
  title: string;
  message: string;
  link: string | null;
}

export function validatePlatformMessage(
  body: { title?: unknown; message?: unknown; link?: unknown },
): { ok: true; value: ValidatedMessage } | { ok: false; error: string } {
  if (typeof body.title !== 'string' || !clean(body.title)) {
    return { ok: false, error: 'O título é obrigatório' };
  }
  if (typeof body.message !== 'string' || !clean(body.message)) {
    return { ok: false, error: 'O texto é obrigatório' };
  }
  const title = clean(body.title);
  const message = clean(body.message);
  if (title.length > PLATFORM_MESSAGE_TITLE_MAX) {
    return { ok: false, error: `O título deve ter no máximo ${PLATFORM_MESSAGE_TITLE_MAX} caracteres` };
  }
  if (message.length > PLATFORM_MESSAGE_TEXT_MAX) {
    return { ok: false, error: `O texto deve ter no máximo ${PLATFORM_MESSAGE_TEXT_MAX} caracteres` };
  }
  let link: string | null = null;
  if (body.link !== undefined && body.link !== null && body.link !== '') {
    if (typeof body.link !== 'string' || !isInternalPath(body.link.trim())) {
      return { ok: false, error: 'O link deve ser um caminho interno começando com "/" (links externos não são aceitos)' };
    }
    link = body.link.trim();
  }
  return { ok: true, value: { title: escapeHtml(title), message: escapeHtml(message), link } };
}
