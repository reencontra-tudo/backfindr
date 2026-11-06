// Push opcional da mensagem da plataforma (decidido por mensagem; chave geral PLATFORM_MESSAGE_PUSH_ENABLED). Banco e push simulados.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'fs';

const query = vi.fn();
const sendPushToUser = vi.fn();
vi.mock('@/lib/db', () => ({ query: (...a: unknown[]) => query(...a) }));
vi.mock('@/lib/pushNotification', () => ({ sendPushToUser: (...a: unknown[]) => sendPushToUser(...a) }));

import { pushPlatformMessage, platformPushLabel, PLATFORM_MESSAGE_PUSH_ENABLED } from '@/lib/platformMessagePush';

const user = (over = {}) => ({ rows: [{ is_system: false, is_legacy: false, ...over }] });

beforeEach(() => {
  process.env.VAPID_PUBLIC_KEY = 'pub'; process.env.VAPID_PRIVATE_KEY = 'priv';
  query.mockReset(); sendPushToUser.mockReset();
  sendPushToUser.mockResolvedValue(undefined);
});

describe('chave geral', () => {
  it('a constante vem ligada (a escolha é por mensagem, na rota)', () => {
    expect(PLATFORM_MESSAGE_PUSH_ENABLED).toBe(true);
  });
  it('com a chave desligada nada é consultado nem enviado (restaura o comportamento anterior)', async () => {
    expect(await pushPlatformMessage('u1', { enabled: false })).toEqual({ sent: false, reason: 'desligado' });
    expect(query).not.toHaveBeenCalled();
    expect(sendPushToUser).not.toHaveBeenCalled();
  });
  it('a rota só chama o módulo quando push === true', () => {
    const route = readFileSync('src/app/api/v1/admin/platform-messages/route.ts', 'utf8');
    expect(route).toMatch(/wantPush = body\.push === true/);
    expect(route).toMatch(/if \(!wantPush\) return/);
    expect(route).not.toMatch(/nodemailer|sendEmail|deliverEmail|emailSend/i);
  });
});

describe('quando ligado', () => {
  const on = { enabled: true };

  it('push ativado e preferência não desligada: envia texto fixo, link interno, sem o texto do admin', async () => {
    query.mockResolvedValueOnce(user()).mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [{}] });
    expect(await pushPlatformMessage('u1', on)).toEqual({ sent: true });
    const [uid, payload, options] = sendPushToUser.mock.calls[0];
    expect(uid).toBe('u1');
    expect(options).toEqual({ event: 'platform_message' });
    expect(payload.title).toBe('Você tem uma mensagem da equipe do Backfindr');
    expect(payload.url).toBe('/dashboard/notifications');
    expect(payload.url.startsWith('/')).toBe(true);
    expect(JSON.stringify(payload)).not.toMatch(/proteg|ocult|revelad|SMS|https?:/i);
  });

  it('linha de preferência com enabled = true também envia', async () => {
    query.mockResolvedValueOnce(user()).mockResolvedValueOnce({ rows: [{ enabled: true }] }).mockResolvedValueOnce({ rows: [{}] });
    expect((await pushPlatformMessage('u1', on)).sent).toBe(true);
  });

  it('preferência desligada: não envia', async () => {
    query.mockResolvedValueOnce(user()).mockResolvedValueOnce({ rows: [{ enabled: false }] });
    expect(await pushPlatformMessage('u1', on)).toEqual({ sent: false, reason: 'preferencia_desligada' });
    expect(sendPushToUser).not.toHaveBeenCalled();
  });

  it('usuário sem push ativo: não envia e informa', async () => {
    query.mockResolvedValueOnce(user()).mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [] });
    expect(await pushPlatformMessage('u1', on)).toEqual({ sent: false, reason: 'sem_push_ativo' });
    expect(sendPushToUser).not.toHaveBeenCalled();
  });

  it('legado (usuário ou objeto) e conta de sistema: recusados', async () => {
    query.mockResolvedValueOnce(user({ is_legacy: true }));
    expect(await pushPlatformMessage('u1', on)).toEqual({ sent: false, reason: 'legado' });
    query.mockResolvedValueOnce(user({ is_system: true }));
    expect(await pushPlatformMessage('u1', on)).toEqual({ sent: false, reason: 'conta_de_sistema' });
    expect(sendPushToUser).not.toHaveBeenCalled();
  });

  it('usuário inexistente: não envia', async () => {
    query.mockResolvedValueOnce({ rows: [] });
    expect(await pushPlatformMessage('u1', on)).toEqual({ sent: false, reason: 'usuario_nao_encontrado' });
  });

  it('tabela de preferências ausente ou erro de banco: NÃO envia', async () => {
    query.mockResolvedValueOnce(user()).mockRejectedValueOnce(Object.assign(new Error('x'), { code: '42P01' }));
    expect(await pushPlatformMessage('u1', on)).toEqual({ sent: false, reason: 'preferencias_indisponiveis' });
    expect(sendPushToUser).not.toHaveBeenCalled();
  });

  it('falha no envio do push não lança', async () => {
    query.mockResolvedValueOnce(user()).mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [{}] });
    sendPushToUser.mockRejectedValueOnce(new Error('x'));
    expect(await pushPlatformMessage('u1', on)).toEqual({ sent: false, reason: 'erro_no_envio' });
  });
});

describe('frases para o administrador', () => {
  it('uma por situação', () => {
    expect(platformPushLabel({ sent: true })).toBe('push enviado');
    expect(platformPushLabel({ sent: false, reason: 'sem_push_ativo' })).toBe('usuário sem push ativo');
    expect(platformPushLabel({ sent: false, reason: 'preferencia_desligada' })).toBe('usuário desligou esse aviso');
    expect(platformPushLabel({ sent: false, reason: 'legado' })).toBe('push não enviado (legado/conta de sistema)');
    expect(platformPushLabel({ sent: false, reason: 'conta_de_sistema' })).toBe('push não enviado (legado/conta de sistema)');
    expect(platformPushLabel({ sent: false, reason: 'erro_no_envio' })).toBe('push não enviado (falha técnica)');
  });
});

describe('migration 024', () => {
  it('é aditiva, idempotente, marcada como aplicada em 04/11/2026 e traz reversão', () => {
    const sql = readFileSync('src/db/migrations/024_notification_preferences_platform_message.sql', 'utf8');
    expect(sql).toContain('APLICADA em 04/11/2026');
    expect(sql).not.toContain('NÃO APLICADA');
    expect(sql).toContain('DROP CONSTRAINT IF EXISTS notification_preferences_event_check');
    expect(sql).toContain("'platform_message'");
    expect(sql).toMatch(/Reversão/);
  });
});
