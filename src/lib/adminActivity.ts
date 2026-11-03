// Normalização da "Atividade recente" do /admin/dashboard.
// A API (/api/v1/admin/activity) devolve { items: [{ type, label, ts, ... }] };
// a tela já aceitou { id, description, created_at }, então os dois formatos entram aqui.

export interface ActivityItem {
  id: string;
  type: string;
  description: string;
  /** ISO 8601, ou string vazia quando a data falta ou é inválida. */
  created_at: string;
}

const TYPE_TEXT: Record<string, string> = {
  user_registered: 'Novo usuário',
  object_registered: 'Objeto registrado',
  match_confirmed: 'Match confirmado',
  qr_scan: 'QR escaneado',
};

function asText(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

function asDateString(v: unknown): string {
  if (typeof v !== 'string' && typeof v !== 'number' && !(v instanceof Date)) return '';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? '' : d.toISOString();
}

export function normalizeActivityItem(raw: unknown): ActivityItem | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;

  const type = asText(r.type);
  const created_at = asDateString(r.created_at ?? r.ts);

  // Formato antigo: description já vem pronta. Formato novo: tipo + label.
  let description = asText(r.description);
  if (!description) {
    const label = asText(r.label);
    const prefix = TYPE_TEXT[type] ?? '';
    description = prefix && label ? `${prefix}: ${label}` : prefix || label;
  }

  const id = asText(r.id) || [type, created_at, description].join('|');
  return { id, type, description, created_at };
}

/** Aceita { items }, { activity } ou array puro. Itens inválidos são descartados. */
export function normalizeActivity(payload: unknown): ActivityItem[] {
  const list = Array.isArray(payload)
    ? payload
    : ((payload as { items?: unknown; activity?: unknown } | null)?.items
        ?? (payload as { activity?: unknown } | null)?.activity
        ?? []);
  if (!Array.isArray(list)) return [];

  // Chave estável: id derivado do conteúdo, com sufixo quando dois itens são idênticos.
  const seen = new Map<string, number>();
  const out: ActivityItem[] = [];
  for (const raw of list) {
    const item = normalizeActivityItem(raw);
    if (!item) continue;
    const n = seen.get(item.id) ?? 0;
    seen.set(item.id, n + 1);
    out.push(n === 0 ? item : { ...item, id: `${item.id}#${n}` });
  }
  return out;
}

/** Vazio quando a data falta ou é inválida; nunca "NaN". */
export function timeAgo(dateStr: string | null | undefined, now: number = Date.now()): string {
  if (!dateStr) return '';
  const t = new Date(dateStr).getTime();
  if (Number.isNaN(t)) return '';
  const mins = Math.floor((now - t) / 60000);
  if (mins < 1) return 'agora';
  if (mins < 60) return `há ${mins}min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `há ${hrs}h`;
  return `há ${Math.floor(hrs / 24)}d`;
}
