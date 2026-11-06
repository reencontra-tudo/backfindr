// Camada de canais: SMS desligado, horário de silêncio (virada do dia e fuso de São Paulo), urgência e registro do resultado.
// Funções puras e adaptadores simulados; nada é enviado.
//
//   npx vitest@2 run --config tests/vitest.config.ts tests/channels.test.ts
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/db', () => ({ query: vi.fn(async () => ({ rows: [] })) }));
vi.mock('@/lib/pushNotification', () => ({ sendPushToUser: vi.fn(async () => undefined) }));
vi.mock('@/lib/emailSend', () => ({ deliverEmail: vi.fn(async () => ({ ok: true, id: 'x' })) }));

import { send, CHANNEL_ENABLED, isQuietHour, localHour, shouldDeferPush, urgencyForEvent } from '@/lib/channels';
import { sendPushToUser } from '@/lib/pushNotification';
import { deliverEmail } from '@/lib/emailSend';

describe('SMS desligado', () => {
  it('está desligado na configuração e os outros canais ligados', () => {
    expect(CHANNEL_ENABLED).toEqual({ app: true, push: true, email: true, sms: false });
  });
  it('tentativa de uso devolve "canal desativado" sem chamar nada', async () => {
    const adapter = vi.fn();
    const log = vi.fn();
    const r = await send('sms', { to: '+5500000000000', text: 'oi' }, { adapters: { sms: adapter }, log });
    expect(r).toEqual({ channel: 'sms', status: 'skipped', reason: 'canal desativado' });
    expect(adapter).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledWith(r);
  });
  it('com a configuração real, o adaptador de SMS padrão também não envia', async () => {
    const r = await send('sms', { to: 'x', text: 'y' }, { enabled: { ...CHANNEL_ENABLED, sms: true } });
    expect(r).toMatchObject({ channel: 'sms', status: 'skipped', reason: 'canal desativado' });
  });
});

describe('send', () => {
  it('push e e-mail reaproveitam os envios existentes e registram "enviado"', async () => {
    const log = vi.fn();
    expect(await send('push', { userId: 'u', title: 't', body: 'b' }, { log })).toMatchObject({ channel: 'push', status: 'sent' });
    expect(sendPushToUser).toHaveBeenCalledTimes(1);
    expect(await send('email', { to: 'a@b.c', subject: 's', html: 'h', category: 'service', source: 't' }, { log }))
      .toMatchObject({ channel: 'email', status: 'sent' });
    expect(deliverEmail).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledTimes(2);
  });
  it('falha do adaptador vira resultado "failed", sem lançar', async () => {
    const r = await send('app', { userId: 'u', title: 't', message: 'm', type: 'x' }, {
      adapters: { app: async () => { throw new Error('boom'); } }, log: () => {},
    });
    expect(r).toEqual({ channel: 'app', status: 'failed', error: 'boom' });
  });
});

const at = (iso: string) => new Date(iso);

describe('horário de silêncio (22h–7h, fuso de São Paulo, UTC−3)', () => {
  it('converte para a hora local de São Paulo', () => {
    expect(localHour(at('2026-11-01T01:30:00Z'))).toBe(22); // 31/10 22:30 em SP
    expect(localHour(at('2026-11-01T10:00:00Z'))).toBe(7);
  });
  it('virada do dia: 22h, 23h, 0h e 6h59 são silêncio; 7h e 21h59 não', () => {
    expect(isQuietHour(at('2026-11-01T01:00:00Z'))).toBe(true);  // 22:00
    expect(isQuietHour(at('2026-11-01T02:30:00Z'))).toBe(true);  // 23:30
    expect(isQuietHour(at('2026-11-01T03:00:00Z'))).toBe(true);  // 00:00
    expect(isQuietHour(at('2026-11-01T09:59:00Z'))).toBe(true);  // 06:59
    expect(isQuietHour(at('2026-11-01T10:00:00Z'))).toBe(false); // 07:00
    expect(isQuietHour(at('2026-11-01T00:59:00Z'))).toBe(false); // 21:59
  });
  it('o mesmo instante pode ser silêncio em um fuso e não em outro', () => {
    const t = at('2026-11-01T01:00:00Z'); // 22:00 em SP, 10:00 em Tóquio
    expect(isQuietHour(t, 'America/Sao_Paulo')).toBe(true);
    expect(isQuietHour(t, 'Asia/Tokyo')).toBe(false);
  });
  it('fuso inválido usa São Paulo', () => {
    expect(isQuietHour(at('2026-11-01T01:00:00Z'), 'Nao/Existe')).toBe(true);
  });
});

describe('urgência e adiamento de push', () => {
  const noite = at('2026-11-01T02:00:00Z'); // 23:00 em SP
  const dia = at('2026-11-01T15:00:00Z');   // 12:00 em SP
  it('achado pelo QR e mensagem de chat saem sempre, até no silêncio', () => {
    expect(shouldDeferPush({ event: 'qr_scan', now: noite })).toBe(false);
    expect(shouldDeferPush({ event: 'chat_message', now: noite })).toBe(false);
  });
  it('urgência baixa e média esperam no silêncio e saem de dia', () => {
    for (const event of ['match', 'returned', 'lembrete']) {
      expect(shouldDeferPush({ event, now: noite })).toBe(true);
      expect(shouldDeferPush({ event, now: dia })).toBe(false);
    }
  });
  it('mapa de urgência', () => {
    expect(urgencyForEvent('qr_scan')).toBe('high');
    expect(urgencyForEvent('chat_message')).toBe('high');
    expect(urgencyForEvent('match')).toBe('medium');
    expect(urgencyForEvent('qualquer')).toBe('low');
  });
});
