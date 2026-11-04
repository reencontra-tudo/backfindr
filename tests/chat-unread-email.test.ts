// E-mail de chat não lido: 30 min, 6 h, legado, suprimido, lido, teto diário, falha do Resend. Nada é enviado de verdade.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

type Row = Record<string, unknown>;
const query = vi.fn();
const resendSend = vi.fn();
vi.mock('@/lib/db', () => ({ query: (...a: unknown[]) => query(...a) }));
vi.mock('resend', () => ({ Resend: class { emails = { send: (...a: unknown[]) => resendSend(...a) }; } }));

import {
  runChatUnreadEmails, chatUnreadEmailHtml, findCandidates,
  CHAT_UNREAD_EMAIL_DAILY_CAP, GLOBAL_DAILY_GUARD,
} from '@/lib/chatUnreadEmail';
import { GET } from '@/app/api/v1/cron/chat-unread-email/route';

const M = (n: number) => `00000000-0000-0000-0000-00000000000${n}`;
const cand = (n: number, over: Row = {}) => ({ match_id: M(n), user_id: `u${n}`, email: `u${n}@teste.local`, unread: 1, ...over });

interface World {
  candidates?: Row[];
  recent?: Set<string>;        // `${user}:${match}` com e-mail nas últimas 6 h
  ownToday?: number;
  globalToday?: number;
  suppressed?: Set<string>;    // e-mails suprimidos
  legacyUsers?: Set<string>;
  historyDown?: boolean;
}
const logged: string[] = [];

function world(w: World = {}) {
  logged.length = 0;
  query.mockImplementation(async (sql: string, params: unknown[] = []) => {
    if (/FROM chat_messages cm/.test(sql)) return { rows: w.candidates ?? [] };
    if (/FROM email_messages/.test(sql)) {
      if (w.historyDown) throw Object.assign(new Error('x'), { code: '42P01' });
      if (/AND source = \$1\s*$/.test(sql.trim()) && /COUNT/.test(sql)) return { rows: [{ n: w.ownToday ?? 0 }] };
      if (/COUNT/.test(sql)) return { rows: [{ n: w.globalToday ?? 0 }] };
      return { rows: w.recent?.has(`${params[0]}:${String(params[2]).split(':')[1]}`) ? [{ '?column?': 1 }] : [] };
    }
    if (/INSERT INTO email_messages/.test(sql)) { logged.push(String(params[0])); return { rows: [] }; }
    if (/FROM email_suppressions/.test(sql)) return { rows: w.suppressed?.has('suprimido') ? [{ reason: 'unsubscribe' }] : [] };
    return { rows: [] };
  });
}

beforeEach(() => {
  query.mockReset(); resendSend.mockReset();
  resendSend.mockResolvedValue({ data: { id: 'rid-1' }, error: null });
  process.env.EMAIL_HASH_SECRET = 'teste-hash';
  process.env.RESEND_API_KEY = 'teste';
});

describe('consulta de candidatos', () => {
  it('só mensagens não lidas há mais de 30 min, nas últimas 24 h, sem legado nem conta de sistema', async () => {
    world({ candidates: [] });
    await findCandidates();
    const [sql, params] = query.mock.calls[0];
    const q = String(sql).replace(/\s+/g, ' ');
    expect(q).toContain('cm.is_read IS NOT TRUE');
    expect(q).toContain("cm.created_at <= NOW() - ($1 || ' minutes')::interval");
    expect(q).toContain("cm.created_at > NOW() - INTERVAL '24 hours'");
    expect(q).toContain('r.is_legacy IS NOT TRUE AND r.is_system_account IS NOT TRUE');
    expect(q).toContain('lo.is_legacy IS NOT TRUE AND fo.is_legacy IS NOT TRUE');
    expect(params).toEqual(['30']);
  });
});

describe('envio', () => {
  it('envia 1 e-mail de serviço com descadastro de um clique, sem conteúdo da mensagem', async () => {
    world({ candidates: [cand(1)] });
    const r = await runChatUnreadEmails();
    expect(r).toMatchObject({ sent: 1, skipped: 0, failed: 0, stopped: null });
    expect(resendSend).toHaveBeenCalledTimes(1);
    const mail = resendSend.mock.calls[0][0];
    expect(mail.to).toEqual(['u1@teste.local']);
    expect(mail.headers['List-Unsubscribe']).toMatch(/^<https:\/\/backfindr\.com\/api\/v1\/email\/unsubscribe\?t=/);
    expect(mail.headers['List-Unsubscribe-Post']).toBe('List-Unsubscribe=One-Click');
    expect(mail.html).toContain(`/dashboard/chat/${M(1)}`);
    expect(mail.html).not.toMatch(/proteg|ocult|revelad|SMS/i);
    expect(logged).toEqual(['rid-1']);
  });

  it('respeita 6 h: já enviou há menos de 6 h para essa conversa e destinatário → não envia', async () => {
    world({ candidates: [cand(1), cand(2)], recent: new Set([`u1:${M(1)}`]) });
    const r = await runChatUnreadEmails();
    expect(r).toMatchObject({ sent: 1, skipped: 1 });
    expect(resendSend.mock.calls[0][0].to).toEqual(['u2@teste.local']);
  });

  it('a verificação de 6 h usa a conversa, o usuário e a janela de 6 horas', async () => {
    world({ candidates: [cand(1)] });
    await runChatUnreadEmails();
    const call = query.mock.calls.find(c => /LIMIT 1/.test(String(c[0])) && /email_messages/.test(String(c[0])))!;
    expect(call[1]).toEqual(['u1', 'chat_unread', `chat_unread:${M(1)}`, '6']);
  });

  it('endereço suprimido: não envia (conta como recusado por regra, não como falha)', async () => {
    world({ candidates: [cand(1)], suppressed: new Set(['suprimido']) });
    const r = await runChatUnreadEmails();
    expect(r).toMatchObject({ sent: 0, skipped: 1, failed: 0 });
    expect(resendSend).not.toHaveBeenCalled();
  });

  it('mensagem lida / legado / conta de sistema: ficam fora do conjunto (a consulta não os devolve) → nada enviado', async () => {
    world({ candidates: [] });
    const r = await runChatUnreadEmails();
    expect(r.sent).toBe(0);
    expect(resendSend).not.toHaveBeenCalled();
  });

  it('teto diário próprio: ao atingir, para e registra o motivo', async () => {
    world({ candidates: [cand(1), cand(2)], ownToday: CHAT_UNREAD_EMAIL_DAILY_CAP });
    const r = await runChatUnreadEmails();
    expect(r).toMatchObject({ sent: 0, stopped: 'teto_diario_proprio', not_attempted: 2 });
    expect(resendSend).not.toHaveBeenCalled();
  });

  it('o teto vale dentro da mesma execução', async () => {
    world({ candidates: [cand(1), cand(2), cand(3)], ownToday: CHAT_UNREAD_EMAIL_DAILY_CAP - 2 });
    const r = await runChatUnreadEmails();
    expect(r).toMatchObject({ sent: 2, stopped: 'teto_diario_proprio', not_attempted: 1 });
  });

  it('reserva sobre o limite do Resend: com o total das últimas 24 h no limite de proteção, não envia', async () => {
    world({ candidates: [cand(1)], globalToday: GLOBAL_DAILY_GUARD });
    const r = await runChatUnreadEmails();
    expect(r).toMatchObject({ sent: 0, stopped: 'limite_global_resend' });
    expect(resendSend).not.toHaveBeenCalled();
  });

  it('falha do Resend nunca conta como enviado (nem para o teto)', async () => {
    world({ candidates: [cand(1), cand(2)] });
    resendSend.mockResolvedValue({ data: null, error: { name: 'application_error', message: 'x', statusCode: 500 } });
    const r = await runChatUnreadEmails();
    expect(r).toMatchObject({ sent: 0, failed: 2 });
    expect(logged).toEqual([]); // nada gravado em email_messages
  });

  it('exceção do Resend também não conta como enviado', async () => {
    world({ candidates: [cand(1)] });
    resendSend.mockRejectedValue(new Error('rede'));
    expect(await runChatUnreadEmails()).toMatchObject({ sent: 0, failed: 1 });
  });

  it('sem poder ler email_messages (dedup e teto), NÃO envia', async () => {
    world({ candidates: [cand(1)], historyDown: true });
    const r = await runChatUnreadEmails();
    expect(r).toMatchObject({ sent: 0, stopped: 'historico_indisponivel' });
    expect(resendSend).not.toHaveBeenCalled();
  });
});

describe('texto do e-mail', () => {
  it('só avisa e leva à conversa; sem conteúdo da mensagem nem dados do outro participante', () => {
    const html = chatUnreadEmailHtml(M(1));
    expect(html).toContain('Abrir conversa');
    expect(html).toContain('A conversa acontece pelo chat da plataforma.');
    expect(html).not.toMatch(/proteg|ocult|revelad|não revelad|SMS/i);
  });
});

describe('rota /api/v1/cron/chat-unread-email', () => {
  const call = (auth: string | null) =>
    GET(new NextRequest('http://x/api/v1/cron/chat-unread-email', { headers: auth ? { authorization: auth } : {} }));

  it('fail-closed: sem header, header errado ou sem CRON_SECRET → 401 e nada consultado', async () => {
    process.env.CRON_SECRET = 'segredo';
    expect((await call(null)).status).toBe(401);
    expect((await call('Bearer errado')).status).toBe(401);
    delete process.env.CRON_SECRET;
    expect((await call('Bearer undefined')).status).toBe(401);
    expect(query).not.toHaveBeenCalled();
  });

  it('com o segredo certo roda e devolve o resultado', async () => {
    process.env.CRON_SECRET = 'segredo';
    world({ candidates: [] });
    const res = await call('Bearer segredo');
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ sent: 0, stopped: null });
  });
});
