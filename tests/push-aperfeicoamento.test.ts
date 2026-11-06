// Aperfeiçoamento do push (Web): helpers de payload, mensagem da plataforma urgente e som com o app aberto.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const query = vi.fn();
const sendPushToUser = vi.fn();
vi.mock('@/lib/db', () => ({ query: (...a: unknown[]) => query(...a) }));
vi.mock('web-push', () => ({ default: { setVapidDetails: vi.fn(), sendNotification: vi.fn() } }));

describe('helpers de payload: textos e urls idênticos aos de antes', () => {
  it('match, match confirmado, scan e chat (comparação exata)', async () => {
    const m = await import('@/lib/pushNotification');
    expect(m.matchPayload('m1', 'Chave', 0.874)).toEqual({
      title: '🔍 Match encontrado!',
      body: 'Possível correspondência para "Chave" com 87% de similaridade.',
      url: '/dashboard/chat/m1', tag: 'match-m1', actions: [{ action: 'view', title: 'Ver match' }],
    });
    expect(m.matchConfirmedPayload('m1', 'Chave')).toEqual({
      title: '✅ Match confirmado!',
      body: 'A outra parte confirmou o match para "Chave". Combine a devolução pelo chat.',
      url: '/dashboard/chat/m1', tag: 'match-confirmed-m1', actions: [{ action: 'chat', title: 'Abrir chat' }],
    });
    expect(m.scanPayload('Chave', 'o1')).toEqual({
      title: '📱 QR Code escaneado!',
      body: 'Alguém escaneou o QR Code do seu objeto "Chave".',
      url: '/dashboard/objects/o1', tag: 'scan-o1', actions: [{ action: 'view', title: 'Ver objeto' }],
    });
    expect(m.chatPayload('Ana', 'm1', 'oi')).toEqual({
      title: '💬 Nova mensagem de Ana', body: 'oi',
      url: '/dashboard/chat/m1', // CORRIGIDO: antes '/dashboard/matches/m1' (rota inexistente, 404)
      tag: 'chat-m1', actions: [{ action: 'reply', title: 'Responder' }],
    });
    const long = 'x'.repeat(100);
    expect(m.chatPayload('Ana', 'm1', long).body).toBe('x'.repeat(77) + '…');
  });
  it('a rota antiga /dashboard/matches/{id} não existe; /dashboard/chat/{matchId} existe', async () => {
    const { existsSync } = await import('fs');
    expect(existsSync('src/app/dashboard/matches/[id]')).toBe(false);
    expect(existsSync('src/app/dashboard/matches/[matchId]')).toBe(false);
    expect(existsSync('src/app/dashboard/chat/[matchId]/page.tsx')).toBe(true);
  });
});

describe('mensagem da plataforma urgente (regras do #86 intactas)', () => {
  beforeEach(() => {
    process.env.VAPID_PUBLIC_KEY = 'pub'; process.env.VAPID_PRIVATE_KEY = 'priv';
    query.mockReset(); sendPushToUser.mockReset(); sendPushToUser.mockResolvedValue(undefined);
    vi.resetModules();
    vi.doMock('@/lib/pushNotification', () => ({ sendPushToUser: (...a: unknown[]) => sendPushToUser(...a) }));
  });
  const ok = () => query
    .mockResolvedValueOnce({ rows: [{ is_system: false, is_legacy: false }] })
    .mockResolvedValueOnce({ rows: [] })
    .mockResolvedValueOnce({ rows: [{}] });

  it('urgent: true vai ao payload; texto fixo e evento mantidos', async () => {
    ok();
    const { pushPlatformMessage } = await import('@/lib/platformMessagePush');
    expect(await pushPlatformMessage('u1', { urgent: true })).toEqual({ sent: true });
    const [, payload, opts] = sendPushToUser.mock.calls[0];
    expect(payload).toEqual({
      title: 'Você tem uma mensagem da equipe do Backfindr', body: 'Abra as notificações para ler.',
      url: '/dashboard/notifications', tag: 'platform-message', urgent: true,
    });
    expect(opts).toEqual({ event: 'platform_message' });
  });
  it('sem urgent (ou diferente de true): payload exatamente como no #86, sem a chave', async () => {
    for (const o of [{}, { urgent: false }, { urgent: 'sim' as unknown as boolean }]) {
      sendPushToUser.mockClear(); ok();
      const { pushPlatformMessage } = await import('@/lib/platformMessagePush');
      await pushPlatformMessage('u1', o);
      expect(sendPushToUser.mock.calls[0][1]).toEqual({
        title: 'Você tem uma mensagem da equipe do Backfindr', body: 'Abra as notificações para ler.',
        url: '/dashboard/notifications', tag: 'platform-message',
      });
    }
  });
  it('urgente não fura as regras: legado, sistema, preferência desligada', async () => {
    const { pushPlatformMessage } = await import('@/lib/platformMessagePush');
    query.mockResolvedValueOnce({ rows: [{ is_system: false, is_legacy: true }] });
    expect(await pushPlatformMessage('u1', { urgent: true })).toEqual({ sent: false, reason: 'legado' });
    query.mockResolvedValueOnce({ rows: [{ is_system: true, is_legacy: false }] });
    expect(await pushPlatformMessage('u1', { urgent: true })).toEqual({ sent: false, reason: 'conta_de_sistema' });
    query.mockResolvedValueOnce({ rows: [{ is_system: false, is_legacy: false }] }).mockResolvedValueOnce({ rows: [{ enabled: false }] });
    expect(await pushPlatformMessage('u1', { urgent: true })).toEqual({ sent: false, reason: 'preferencia_desligada' });
    expect(sendPushToUser).not.toHaveBeenCalled();
  });
});

describe('som com o app aberto (preferência por aparelho)', () => {
  let store: Record<string, string>;
  const win = (storage: unknown, audio?: unknown) => ({ localStorage: storage, AudioContext: audio });
  beforeEach(() => { store = {}; vi.resetModules(); });
  afterEach(() => { vi.unstubAllGlobals(); });
  const okStorage = () => ({ getItem: (k: string) => store[k] ?? null, setItem: (k: string, v: string) => { store[k] = v; } });

  it('ligado por padrão; "off" desliga; religar volta', async () => {
    vi.stubGlobal('window', win(okStorage()));
    const m = await import('@/lib/pushSound');
    expect(m.isPushSoundEnabled()).toBe(true);
    m.setPushSoundEnabled(false);
    expect(store[m.PUSH_SOUND_KEY]).toBe('off');
    expect(m.isPushSoundEnabled()).toBe(false);
    m.setPushSoundEnabled(true);
    expect(m.isPushSoundEnabled()).toBe(true);
  });
  it('localStorage indisponível (lança): não quebra e conta como ligado', async () => {
    const bad = { getItem: () => { throw new Error('x'); }, setItem: () => { throw new Error('x'); } };
    vi.stubGlobal('window', win(bad));
    const m = await import('@/lib/pushSound');
    expect(m.isPushSoundEnabled()).toBe(true);
    expect(() => m.setPushSoundEnabled(false)).not.toThrow();
  });
  it('handlePushMessage: só toca com tipo certo, página visível e preferência ligada', async () => {
    const created: number[] = [];
    class FakeAudio {
      state = 'running'; currentTime = 0; destination = {};
      createOscillator() { created.push(1); return { type: '', frequency: { value: 0 }, connect: (n: unknown) => n, start() {}, stop() {} }; }
      createGain() { return { gain: { setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect: (n: unknown) => n }; }
      close() { return Promise.resolve(); }
    }
    vi.stubGlobal('window', win(okStorage(), FakeAudio));
    const m = await import('@/lib/pushSound');
    expect(m.handlePushMessage({ type: 'outro' }, true)).toBe(false);
    expect(m.handlePushMessage({ type: 'push-received' }, false)).toBe(false);
    expect(created).toHaveLength(0);
    expect(m.handlePushMessage({ type: 'push-received', urgent: true }, true)).toBe(true);
    expect(created.length).toBe(3); // urgente: três toques
    expect(m.pushSoundPlayedRecently()).toBe(true);
    m.setPushSoundEnabled(false);
    created.length = 0;
    expect(m.handlePushMessage({ type: 'push-received' }, true)).toBe(false);
    expect(created).toHaveLength(0);
  });
  it('autoplay bloqueado / sem AudioContext: falha em silêncio', async () => {
    class Blocked { constructor() { throw new Error('NotAllowedError'); } }
    vi.stubGlobal('window', win(okStorage(), Blocked));
    const m = await import('@/lib/pushSound');
    expect(() => m.playPushSound(true)).not.toThrow();
    expect(() => m.handlePushMessage({ type: 'push-received', urgent: true }, true)).not.toThrow();
    vi.stubGlobal('window', win(okStorage(), undefined));
    expect(() => m.playPushSound(true)).not.toThrow();
  });
});
