import { query } from '@/lib/db';

export interface EventPayload {
  object_id: string;
  type: string;
  title: string;
  description?: string;
  source?: string;
  actor_type?: string;
  actor_id?: string;
  user_id?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Registra um evento de objeto de forma assíncrona e não-bloqueante.
 * Nunca lança exceção — falha silenciosa para não impactar o fluxo principal.
 */
export async function recordEvent(payload: EventPayload): Promise<void> {
  try {
    await query(
      `INSERT INTO object_events
        (object_id, type, title, description, source, actor_type, actor_id, user_id, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        payload.object_id,
        payload.type,
        payload.title,
        payload.description ?? null,
        payload.source ?? 'system',
        payload.actor_type ?? null,
        payload.actor_id ?? null,
        payload.user_id ?? null,
        JSON.stringify(payload.metadata ?? {}),
      ]
    );
  } catch (err) {
    console.error('[events] Failed to record event:', payload.type, payload.object_id, err);
  }
}

// ── Eventos de uso do QR Code (medição) ───────────────────────────────────────
// Servem para medir quantos objetos têm QR gerado, baixado ou impresso (gatilho de destaque do QR).
// Usam só os campos já existentes (type, metadata); sem coluna nova e sem migration.
// Nunca são gravados para dono legado (registros do Webjetos ficam fora de qualquer métrica).
//
// REGRA DE CONTAGEM DE ESCANEAMENTO: para contar escaneamento de PESSOA, use apenas `qr_scanned`
// com `metadata.via` (gravado pelo POST /api/v1/objects/scan/[code]/notify). O `qr_scanned` do GET
// /api/v1/objects/scan/[code] registra qualquer abertura da página (robôs, pré-visualização de link
// e verificações internas) e superestima os escaneamentos reais.
export type QrUsageEvent = 'qr_generated' | 'qr_downloaded' | 'qr_printed';

const QR_USAGE_TITLES: Record<QrUsageEvent, string> = {
  qr_generated: 'QR Code gerado',
  qr_downloaded: 'QR Code baixado',
  qr_printed: 'QR Code impresso',
};

export async function recordQrUsage(
  object_id: string,
  user_id: string,
  type: QrUsageEvent,
  metadata?: Record<string, unknown>
): Promise<void> {
  try {
    const legacy = await query(`SELECT COALESCE(is_legacy, false) AS is_legacy FROM users WHERE id = $1`, [user_id]);
    if (legacy.rows[0]?.is_legacy) return;
    await recordEvent({
      object_id, user_id, type, title: QR_USAGE_TITLES[type],
      source: 'owner', actor_type: 'user', actor_id: user_id, metadata,
    });
  } catch (err) {
    console.error('[events] Failed to record QR usage:', type, object_id, err);
  }
}

// ── Helpers semânticos ────────────────────────────────────────────────────────

export const Events = {
  objectCreated: (object_id: string, user_id: string) =>
    recordEvent({ object_id, user_id, type: 'object_created', title: 'Ocorrência criada', source: 'owner', actor_type: 'user', actor_id: user_id }),

  objectPublished: (object_id: string) =>
    recordEvent({ object_id, type: 'object_published', title: 'Publicada na rede Backfindr', source: 'system' }),

  objectIndexed: (object_id: string) =>
    recordEvent({ object_id, type: 'object_indexed', title: 'Indexada para busca', source: 'system' }),

  matchingStarted: (object_id: string) =>
    recordEvent({ object_id, type: 'matching_started', title: 'IA iniciou comparação de objetos', source: 'system' }),

  matchingCompleted: (object_id: string, count: number) =>
    recordEvent({ object_id, type: 'matching_completed', title: `IA analisou ${count} objetos`, source: 'system', metadata: { objects_compared: count } }),

  matchFound: (object_id: string, match_id: string, score: number) =>
    recordEvent({ object_id, type: 'match_found', title: 'Possível correspondência encontrada', source: 'system', metadata: { match_id, score } }),

  qrScanned: (object_id: string, metadata?: Record<string, unknown>) =>
    recordEvent({ object_id, type: 'qr_scanned', title: 'QR Code escaneado', source: 'community', actor_type: 'anonymous', metadata }),

  ownerNotified: (object_id: string, user_id: string) =>
    recordEvent({ object_id, user_id, type: 'owner_notified', title: 'Dono notificado', source: 'system' }),

  boostStarted: (object_id: string, user_id: string, boost_type: string, amount: number) =>
    recordEvent({ object_id, user_id, type: 'boost_started', title: 'Boost ativado — alcance ampliado', source: 'owner', actor_type: 'user', actor_id: user_id, metadata: { boost_type, amount } }),

  boostExpired: (object_id: string) =>
    recordEvent({ object_id, type: 'boost_expired', title: 'Boost expirou', source: 'system' }),

  objectReturned: (object_id: string, user_id: string) =>
    recordEvent({ object_id, user_id, type: 'object_returned', title: 'Objeto recuperado 🎉', source: 'owner', actor_type: 'user', actor_id: user_id }),

  qrGenerated: (object_id: string, user_id: string, metadata?: Record<string, unknown>) =>
    recordQrUsage(object_id, user_id, 'qr_generated', metadata),

  qrDownloaded: (object_id: string, user_id: string, metadata?: Record<string, unknown>) =>
    recordQrUsage(object_id, user_id, 'qr_downloaded', metadata),

  qrPrinted: (object_id: string, user_id: string, metadata?: Record<string, unknown>) =>
    recordQrUsage(object_id, user_id, 'qr_printed', metadata),

  statusChanged: (object_id: string, from: string, to: string, user_id?: string) =>
    recordEvent({ object_id, user_id, type: 'status_changed', title: `Status alterado para ${to}`, source: 'owner', actor_type: 'user', actor_id: user_id, metadata: { from, to } }),
};
