// Limite de envios por tipo e por chave embaralhada (e-mail e afins).
//
// Uso:  const ok = await consumeSendSlot({ kind: 'welcome_ip', key: clientIpFromHeaders(req.headers), limit: 5, windowSeconds: 86400 });
//       if (ok) enviar();   // se !ok, a operação principal continua e só o envio é omitido
//
// Regras:
//  - A chave nunca é gravada em claro: vira HMAC-SHA256 com SEND_THROTTLE_SECRET (variável de ambiente).
//  - Falha fechada: sem segredo, sem chave, tabela ausente ou qualquer erro => devolve false (o envio não sai)
//    e NUNCA lança erro, para não derrubar a operação principal.
//  - Limpeza oportunista: depois de cada chamada remove (até 500) linhas do mesmo tipo mais antigas que a janela.
//  - A tabela é criada pela migration 017 (src/db/migrations/017_send_throttle_events.sql); a aplicação não a cria.
import crypto from 'crypto';
import { getClient, query } from '@/lib/db';

export interface SendSlotOptions {
  kind: string;                         // tipo do envio, ex.: 'welcome_ip'
  key: string | null | undefined;       // identificador original (ex.: IP); nunca é gravado em claro
  limit: number;                        // máximo de envios na janela
  windowSeconds: number;                // tamanho da janela, em segundos
}

/** IPv6 vira o prefixo /64 (um mesmo usuário recebe o /64 inteiro); IPv4 fica como está. */
function normalizeIp(ip: string): string {
  const v = ip.trim().toLowerCase();
  if (!v.includes(':')) return v;
  const [head, tail = ''] = v.split('::');
  const h = head ? head.split(':') : [];
  const t = tail ? tail.split(':') : [];
  const groups = v.includes('::') ? [...h, ...Array(Math.max(0, 8 - h.length - t.length)).fill('0'), ...t] : h;
  return groups.slice(0, 4).map(g => g.padStart(4, '0')).join(':') + '::/64';
}

/** IP do cliente a partir dos cabeçalhos que a Vercel define; null se não houver. */
export function clientIpFromHeaders(headers: Headers): string | null {
  const vercel = headers.get('x-vercel-forwarded-for')?.split(',')[0]?.trim();
  const real = headers.get('x-real-ip')?.trim();
  const fwd = headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  const ip = vercel || real || fwd;
  return ip ? normalizeIp(ip) : null;
}

function hashKey(kind: string, key: string): string | null {
  const secret = process.env.SEND_THROTTLE_SECRET;
  if (!secret || secret.length < 16) return null;
  return crypto.createHmac('sha256', secret).update(`${kind}:${key}`).digest('hex');
}

/** true somente se havia vaga na janela E o envio foi registrado. Nunca lança erro. */
export async function consumeSendSlot(opts: SendSlotOptions): Promise<boolean> {
  try {
    if (!opts.key) return false;
    const keyHash = hashKey(opts.kind, opts.key);
    if (!keyHash) return false;

    let allowed = false;
    const client = await getClient();
    try {
      await client.query('BEGIN');
      // Serializa chamadas concorrentes da mesma chave (o limite não "vaza" em cadastros simultâneos).
      await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [`${opts.kind}:${keyHash}`]);
      const used = await client.query(
        `SELECT COUNT(*)::int AS n FROM send_throttle_events
          WHERE kind = $1 AND key_hash = $2 AND created_at > NOW() - make_interval(secs => $3::double precision)`,
        [opts.kind, keyHash, opts.windowSeconds],
      );
      if ((used.rows[0]?.n ?? 0) < opts.limit) {
        await client.query('INSERT INTO send_throttle_events (kind, key_hash) VALUES ($1, $2)', [opts.kind, keyHash]);
        allowed = true;
      }
      await client.query('COMMIT');
    } catch {
      try { await client.query('ROLLBACK'); } catch { /* ignora */ }
      return false;
    } finally {
      client.release();
    }

    // Limpeza oportunista (fora da transação; falha silenciosa).
    query(
      `DELETE FROM send_throttle_events WHERE id IN (
         SELECT id FROM send_throttle_events
          WHERE kind = $1 AND created_at < NOW() - make_interval(secs => $2::double precision) LIMIT 500)`,
      [opts.kind, opts.windowSeconds],
    ).catch(() => {});

    return allowed;
  } catch {
    return false;
  }
}
