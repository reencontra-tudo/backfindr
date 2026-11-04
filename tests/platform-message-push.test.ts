// Push opcional da mensagem da plataforma: preparado e DESLIGADO. Banco e push simulados.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'fs';

const query = vi.fn();
const sendPushToUser = vi.fn();
vi.mock('@/lib/db', () => ({ query: (...a: unknown[]) => query(...a) }));
vi.mock('@/lib/pushNotification', () => ({ sendPushToUser: (...a: unknown[]) => sendPushToUser(...a) }));

import { pushPlatformMessage, PLATFORM_MESSAGE_PUSH_ENABLED } from '@/lib/platformMessagePush';

const user = (over = {}) => ({ rows: [{ is_system: false, is_legacy: false, ...over }] });

beforeEach(() => {
  query.mockReset(); sendPushToUser.mockReset();
  sendPushToUser.mockResolvedValue(undefined);
});

describe('desligado por padrão', () => {
  it('a constante vem desligada e nada é consultado nem enviado', async () => {
    expect(PLATFORM_MESSAGE_PUSH_ENABLED).toBe(false);
    expect(await pushPlatformMessage('u1')).toEqual({ sent: false, reason: 'desligado' });
    expect(query).not.toHaveBeenCalled();
    expect(sendPushToUser).not.toHaveBeenCalled();
  });
  it('a rota da mensagem da plataforma não chama o módulo (continua somente in-app)', () => {
    const route = readFileSync('src/app/api/v1/admin/platform-messages/route.ts', 'utf8');
    expect(route).not.toMatch(/platformMessagePush|sendPushToUser|pushPlatformMessage/);
  });
});

describe('quando ligado (enabled: true)', () => {
  const on = { enabled: true };

  it('push ativado e preferência não desligada: envia texto fixo, link interno, sem o texto do admin', async () => {
    query.mockResolvedValueOnce(user()).mockResolvedValueOnce({ rows: [] });
    expect(await pushPlatformMessage('u1', on)).toEqual({ sent: true });
    const [uid, payload, options] = sendPushToUser.mock.calls[0];
    expect(uid).toBe('u1');
    expect(options).toBeUndefined();
    expect(payload.url).toBe('/dashboard/notifications');
    expect(payload.url.startsWith('/')).toBe(true);
    expect(JSON.stringify(payload)).not.toMatch(/proteg|ocult|revelad|SMS|https?:/i);
  });

  it('linha de preferência com enabled = true também envia', async () => {
    query.mockResolvedValueOnce(user()).mockResolvedValueOnce({ rows: [{ enabled: true }] });
    expect((await pushPlatformMessage('u1', on)).sent).toBe(true);
  });

  it('preferência desligada: não envia', async () => {
    query.mockResolvedValueOnce(user()).mockResolvedValueOnce({ rows: [{ enabled: false }] });
    expect(await pushPlatformMessage('u1', on)).toEqual({ sent: false, reason: 'preferencia_desligada' });
    expect(sendPushToUser).not.toHaveBeenCalled();
  });

  it('usuário sem push ativado: o envio central não tem dispositivo e não faz nada (sem erro)', async () => {
    query.mockResolvedValueOnce(user()).mockResolvedValueOnce({ rows: [] });
    sendPushToUser.mockResolvedValueOnce(undefined); // sendPushToUser retorna sem enviar quando não há inscrição
    expect((await pushPlatformMessage('u1', on)).sent).toBe(true);
    expect(sendPushToUser).toHaveBeenCalledTimes(1);
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
    query.mockResolvedValueOnce(user()).mockResolvedValueOnce({ rows: [] });
    sendPushToUser.mockRejectedValueOnce(new Error('x'));
    expect(await pushPlatformMessage('u1', on)).toEqual({ sent: false, reason: 'erro_no_envio' });
  });
});

describe('migration 024', () => {
  it('é aditiva, idempotente, não aplicada e traz reversão', () => {
    const sql = readFileSync('src/db/migrations/024_notification_preferences_platform_message.sql', 'utf8');
    expect(sql).toContain('NÃO APLICADA');
    expect(sql).toContain('DROP CONSTRAINT IF EXISTS notification_preferences_event_check');
    expect(sql).toContain("'platform_message'");
    expect(sql).toMatch(/Reversão/);
  });
});
