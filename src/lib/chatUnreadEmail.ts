// E-mail "mensagem nova na conversa" (categoria serviço), para quem não leu depois de 30 minutos.
//
// Regras (Doc de comunicação + Q-18):
//   - só depois de 30 min sem leitura; no máximo 1 e-mail a cada 6 h por conversa e destinatário;
//   - nunca para legado (usuário ou objeto) nem conta de sistema; endereço suprimido é barrado por canSendEmail;
//   - passa SEMPRE pelo envio central (deliverEmail): link e cabeçalho de descadastro de um clique, sem caminho paralelo;
//   - teto diário próprio (CHAT_UNREAD_EMAIL_DAILY_CAP) e reserva sobre o limite do Resend (100/dia): se o total de
//     e-mails das últimas 24 h chegar a GLOBAL_DAILY_GUARD, não envia (a reserva fica para segurança e boas-vindas);
//   - o texto não traz o conteúdo da mensagem nem dados do outro participante.
// Dedup, teto e contagem leem email_messages (gravada pelo envio central só quando o Resend aceitou o e-mail):
// falha do Resend nunca conta como enviado. Se email_messages não puder ser lida, NÃO envia.
import { query } from '@/lib/db';
import { APP_URL } from '@/lib/constants';
import { esc } from '@/lib/email';
import { deliverEmail } from '@/lib/emailSend';

export const MIN_UNREAD_MINUTES = 30;
export const MIN_HOURS_BETWEEN_EMAILS = 6;
export const CHAT_UNREAD_EMAIL_DAILY_CAP = 20;
export const GLOBAL_DAILY_GUARD = 90;
export const SOURCE = 'chat_unread';
const MAX_CANDIDATES = 100;
const MIN_SEND_INTERVAL_MS = 600; // Resend: 2 envios por segundo
const TIME_BUDGET_MS = 40_000;

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export interface Candidate {
  match_id: string;
  user_id: string;
  email: string;
  unread: number;
}

export interface RunResult {
  sent: number;
  skipped: number;
  failed: number;
  not_attempted: number;
  stopped: string | null;
  errors: string[];
}

export function chatUnreadEmailHtml(matchId: string): string {
  const url = `${APP_URL}/dashboard/chat/${encodeURIComponent(matchId)}`;
  return `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Mensagem nova no Backfindr</title></head>
<body style="margin:0;padding:24px;background:#080b0f;font-family:Arial,sans-serif;color:#e2e8f0;">
<div style="max-width:480px;margin:0 auto;background:#0f1318;border:1px solid rgba(255,255,255,0.08);border-radius:16px;padding:32px;">
<h1 style="font-size:20px;margin:0 0 12px;color:#ffffff;">Você tem mensagem nova</h1>
<p style="font-size:15px;line-height:1.5;color:#94a3b8;margin:0 0 24px;">Há uma mensagem nova em uma das suas conversas no Backfindr. A conversa acontece pelo chat da plataforma.</p>
<a href="${esc(url)}" style="display:inline-block;background:#14b8a6;color:#0a0a0f;text-decoration:none;font-weight:600;font-size:15px;padding:12px 24px;border-radius:10px;">Abrir conversa</a>
</div></body></html>`;
}

/** Quem tem mensagem não lida há mais de 30 min. Legado e conta de sistema já ficam fora da consulta. */
export async function findCandidates(): Promise<Candidate[]> {
  const r = await query(
    `SELECT cm.match_id, r.id AS user_id, r.email, COUNT(*)::int AS unread
       FROM chat_messages cm
       JOIN matches m ON m.id = cm.match_id
       JOIN objects lo ON lo.id = m.lost_object_id
       JOIN objects fo ON fo.id = m.found_object_id
       JOIN users r ON r.id = CASE WHEN cm.sender_id = lo.user_id THEN fo.user_id
                                   WHEN cm.sender_id = fo.user_id THEN lo.user_id END
      WHERE cm.is_read IS NOT TRUE
        AND cm.created_at <= NOW() - ($1 || ' minutes')::interval
        AND cm.created_at >  NOW() - INTERVAL '24 hours'
        AND r.id <> cm.sender_id
        AND r.email IS NOT NULL
        AND r.is_legacy IS NOT TRUE AND r.is_system_account IS NOT TRUE
        AND lo.is_legacy IS NOT TRUE AND fo.is_legacy IS NOT TRUE
      GROUP BY cm.match_id, r.id, r.email
      LIMIT ${MAX_CANDIDATES}`,
    [String(MIN_UNREAD_MINUTES)],
  );
  return r.rows as Candidate[];
}

/** E-mails aceitos pelo Resend nas últimas 24 h: só desta origem, ou de todas as origens. */
async function countSince24h(onlyThisSource: boolean): Promise<number> {
  const r = onlyThisSource
    ? await query(`SELECT COUNT(*)::int AS n FROM email_messages WHERE sent_at > NOW() - INTERVAL '24 hours' AND source = $1`, [SOURCE])
    : await query(`SELECT COUNT(*)::int AS n FROM email_messages WHERE sent_at > NOW() - INTERVAL '24 hours'`);
  return Number(r.rows[0]?.n) || 0;
}

async function sentRecently(userId: string, matchId: string): Promise<boolean> {
  const r = await query(
    `SELECT 1 FROM email_messages
      WHERE user_id = $1 AND source = $2 AND lifecycle_event = $3
        AND sent_at > NOW() - ($4 || ' hours')::interval
      LIMIT 1`,
    [userId, SOURCE, `${SOURCE}:${matchId}`, String(MIN_HOURS_BETWEEN_EMAILS)],
  );
  return r.rows.length > 0;
}

export async function runChatUnreadEmails(): Promise<RunResult> {
  const res: RunResult = { sent: 0, skipped: 0, failed: 0, not_attempted: 0, stopped: null, errors: [] };
  const startedAt = Date.now();

  let own: number;
  let global: number;
  let candidates: Candidate[];
  try {
    candidates = await findCandidates();
    own = await countSince24h(true);
    global = await countSince24h(false);
  } catch (err) {
    // Sem poder ler o histórico de envios (ex.: migration 021 ausente) não dá para garantir dedup nem teto.
    res.stopped = 'historico_indisponivel';
    res.errors.push(`Erro ao consultar candidatos ou histórico: ${(err as { code?: string })?.code ?? 'erro'}`);
    return res;
  }

  let lastCallAt = 0;
  const pace = async () => {
    const wait = lastCallAt + MIN_SEND_INTERVAL_MS - Date.now();
    if (wait > 0) await sleep(wait);
    lastCallAt = Date.now();
  };

  for (let i = 0; i < candidates.length; i++) {
    const c = candidates[i];
    if (own >= CHAT_UNREAD_EMAIL_DAILY_CAP) {
      res.stopped = 'teto_diario_proprio';
      res.not_attempted = candidates.length - i;
      break;
    }
    if (global >= GLOBAL_DAILY_GUARD) {
      res.stopped = 'limite_global_resend';
      res.not_attempted = candidates.length - i;
      break;
    }
    if (Date.now() - startedAt > TIME_BUDGET_MS) {
      res.stopped = 'tempo_esgotado';
      res.not_attempted = candidates.length - i;
      break;
    }

    try {
      if (await sentRecently(c.user_id, c.match_id)) { res.skipped++; continue; }
    } catch (err) {
      res.stopped = 'historico_indisponivel';
      res.errors.push(`Erro ao consultar histórico: ${(err as { code?: string })?.code ?? 'erro'}`);
      res.not_attempted = candidates.length - i;
      break;
    }

    const result = await deliverEmail({
      to: c.email,
      subject: 'Você tem mensagem nova no Backfindr',
      html: chatUnreadEmailHtml(c.match_id),
      category: 'service',
      source: SOURCE,
      lifecycleEvent: `${SOURCE}:${c.match_id}`,
      recipient: { id: c.user_id, is_legacy: false, is_system_account: false },
      beforeSend: pace,
    });
    if (result.ok) { res.sent++; own++; global++; }
    else if (result.status === 'skipped') res.skipped++;
    else { res.failed++; res.errors.push('Falha no envio (Resend recusou ou erro)'); }
  }
  return res;
}
