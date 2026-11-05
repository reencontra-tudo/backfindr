// public/sw.js carregado em sandbox (node:vm) com self, clients e registration simulados.
// Parte "caracterização": payload mínimo e clique sem ação, como sempre foi. Parte "novo": recursos aditivos.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import vm from 'node:vm';

type Handler = (e: Record<string, unknown>) => void;

function load(opts: { windows?: Array<{ visibilityState?: string; url?: string }>; hasOpenWindow?: boolean } = {}) {
  const handlers: Record<string, Handler> = {};
  const shown: Array<{ title: string; options: Record<string, unknown> }> = [];
  const posted: unknown[][] = [];
  const navigated: string[] = [];
  const focused: number[] = [];
  const opened: string[] = [];
  const wins = (opts.windows ?? []).map((w, i) => ({
    visibilityState: w.visibilityState ?? 'visible',
    navigate: (u: string) => { navigated.push(u); },
    focus: async () => { focused.push(i); },
    postMessage: (m: unknown) => { posted.push([i, m]); },
  }));
  const self = {
    addEventListener: (n: string, h: Handler) => { handlers[n] = h; },
    location: { origin: 'https://backfindr.com' },
    registration: { showNotification: async (title: string, options: Record<string, unknown>) => { shown.push({ title, options }); } },
  };
  const clients: Record<string, unknown> = { matchAll: async () => wins };
  if (opts.hasOpenWindow !== false) clients.openWindow = async (u: string) => { opened.push(u); };
  const ctx = vm.createContext({ self, clients, URL, console });
  vm.runInContext(readFileSync('public/sw.js', 'utf8'), ctx);
  return { handlers, shown, posted, navigated, focused, opened };
}

async function push(sw: ReturnType<typeof load>, payload: unknown) {
  let p: Promise<unknown> | undefined;
  sw.handlers.push({
    data: { json: () => payload, text: () => 'texto puro' },
    waitUntil: (x: Promise<unknown>) => { p = x; },
  });
  await p;
}
async function click(sw: ReturnType<typeof load>, data: unknown, action?: string) {
  let p: Promise<unknown> | undefined;
  let closed = false;
  sw.handlers.notificationclick({
    action,
    notification: { data, close: () => { closed = true; } },
    waitUntil: (x: Promise<unknown>) => { p = x; },
  });
  await p;
  return closed;
}

describe('caracterização: push com payload mínimo (como hoje)', () => {
  it('título, corpo, ícone, badge, tag e url iguais aos de sempre', async () => {
    const sw = load();
    await push(sw, { title: 'T', body: 'B', url: '/dashboard/x', tag: 'tg' });
    expect(sw.shown).toHaveLength(1);
    expect(sw.shown[0].title).toBe('T');
    const o = sw.shown[0].options;
    expect(o.body).toBe('B');
    expect(o.icon).toBe('/icons/logo-backfindr-small.png');
    expect(o.badge).toBe('/icons/logo-backfindr-small.png');
    expect(o.tag).toBe('tg');
    expect(o.data).toEqual({ url: '/dashboard/x' });
  });
  it('sem título/url: Backfindr e /dashboard; sem dados: nada', async () => {
    const sw = load();
    await push(sw, {});
    expect(sw.shown[0].title).toBe('Backfindr');
    expect(sw.shown[0].options.data).toEqual({ url: '/dashboard' });
    const sw2 = load();
    let called = false;
    sw2.handlers.push({ data: null, waitUntil: () => { called = true; } });
    expect(called).toBe(false);
  });
  it('payload que não é JSON vira o corpo', async () => {
    const sw = load();
    let p: Promise<unknown> | undefined;
    sw.handlers.push({ data: { json: () => { throw new Error('x'); }, text: () => 'texto puro' }, waitUntil: (x: Promise<unknown>) => { p = x; } });
    await p;
    expect(sw.shown[0].title).toBe('Backfindr');
    expect(sw.shown[0].options.body).toBe('texto puro');
  });
});

describe('caracterização: clique sem ação (como hoje)', () => {
  it('fecha, navega a aba aberta e foca', async () => {
    const sw = load({ windows: [{}] });
    expect(await click(sw, { url: '/dashboard/chat/1' })).toBe(true);
    expect(sw.navigated).toEqual(['/dashboard/chat/1']);
    expect(sw.focused).toEqual([0]);
    expect(sw.opened).toEqual([]);
  });
  it('sem aba aberta abre janela; sem url vai a /dashboard', async () => {
    const sw = load({ windows: [] });
    await click(sw, undefined);
    expect(sw.opened).toEqual(['/dashboard']);
  });
});

describe('novo: opções do aviso', () => {
  it('payload mínimo NÃO ganha image, requireInteraction nem actions; ganha vibração curta; sem tag, sem renotify', async () => {
    const sw = load();
    await push(sw, { title: 'T', body: 'B' });
    const o = sw.shown[0].options;
    expect('image' in o).toBe(false);
    expect('actions' in o).toBe(false);
    expect(o.requireInteraction).toBeFalsy();
    expect(o.renotify).toBeFalsy();
    expect(o.vibrate).toEqual([200, 100, 200]);
  });
  it('usa payload.icon; actions repassadas; renotify com tag', async () => {
    const sw = load();
    const actions = [{ action: 'reply', title: 'Responder' }];
    await push(sw, { title: 'T', body: 'B', tag: 'chat-1', icon: '/icons/x.png', actions });
    const o = sw.shown[0].options;
    expect(o.icon).toBe('/icons/x.png');
    expect(o.badge).toBe('/icons/logo-backfindr-small.png');
    expect(o.actions).toEqual(actions);
    expect(o.renotify).toBe(true);
  });
  it('urgente: requireInteraction e vibração mais longa', async () => {
    const sw = load();
    await push(sw, { title: 'T', body: 'B', urgent: true });
    const o = sw.shown[0].options;
    expect(o.requireInteraction).toBe(true);
    expect((o.vibrate as number[]).length).toBeGreaterThan(3);
    const sw2 = load();
    await push(sw2, { title: 'T', body: 'B', urgent: 'sim' });
    expect(sw2.shown[0].options.requireInteraction).toBeFalsy();
  });
  it('vibrate do payload (lista de números) é respeitado; valor inválido é ignorado', async () => {
    const sw = load();
    await push(sw, { title: 'T', vibrate: [50, 50, 50] });
    expect(sw.shown[0].options.vibrate).toEqual([50, 50, 50]);
    await push(sw, { title: 'T', vibrate: 'x' });
    expect(sw.shown[1].options.vibrate).toEqual([200, 100, 200]);
  });
  it('imagem: própria origem e r2.dev aceitas; outro domínio, http e esquemas estranhos ignorados', async () => {
    const sw = load();
    for (const image of ['/uploads/a.jpg', 'https://backfindr.com/a.jpg', 'https://pub-abc.r2.dev/a.jpg']) {
      await push(sw, { title: 'T', image });
    }
    expect(sw.shown.map((s) => s.options.image)).toEqual(['/uploads/a.jpg', 'https://backfindr.com/a.jpg', 'https://pub-abc.r2.dev/a.jpg']);
    const sw2 = load();
    for (const image of ['https://evil.com/a.jpg', 'http://pub-abc.r2.dev/a.jpg', 'javascript:alert(1)', '//evil.com/a.jpg', 'https://backfindr.com.evil.com/a.jpg', 'https://r2.dev.evil.com/a', 42]) {
      await push(sw2, { title: 'T', image });
    }
    expect(sw2.shown.every((s) => !('image' in s.options))).toBe(true);
  });
});

describe('novo: clique em ação', () => {
  it('qualquer ação abre a MESMA url do aviso', async () => {
    for (const action of ['reply', 'view', 'chat']) {
      const sw = load({ windows: [{}] });
      await click(sw, { url: '/dashboard/chat/9' }, action);
      expect(sw.navigated).toEqual(['/dashboard/chat/9']);
    }
  });
  it('ação sem janela aberta abre a url do aviso', async () => {
    const sw = load({ windows: [] });
    await click(sw, { url: '/dashboard/objects/3' }, 'view');
    expect(sw.opened).toEqual(['/dashboard/objects/3']);
  });
});

describe('novo: postMessage para janelas visíveis', () => {
  it('só janelas visíveis recebem, com tag e urgent; o aviso do sistema continua sendo exibido', async () => {
    const sw = load({ windows: [{ visibilityState: 'visible' }, { visibilityState: 'hidden' }, { visibilityState: 'visible' }] });
    await push(sw, { title: 'T', tag: 'chat-1', urgent: true });
    expect(sw.posted).toEqual([[0, { type: 'push-received', tag: 'chat-1', urgent: true }], [2, { type: 'push-received', tag: 'chat-1', urgent: true }]]);
    expect(sw.shown).toHaveLength(1);
  });
  it('sem tag/urgent: tag nula e urgent false; sem janelas visíveis, ninguém recebe', async () => {
    const sw = load({ windows: [{ visibilityState: 'hidden' }] });
    await push(sw, { title: 'T' });
    expect(sw.posted).toEqual([]);
    const sw2 = load({ windows: [{}] });
    await push(sw2, { title: 'T' });
    expect(sw2.posted[0][1]).toEqual({ type: 'push-received', tag: null, urgent: false });
  });
  it('janela que lança no postMessage não impede o aviso do sistema', async () => {
    const sw = load({ windows: [{}] });
    const sw2 = load({ windows: [{}] });
    // injeta falha: reconstrói o handler com janela que lança
    const handlers: Record<string, Handler> = {};
    const shown: unknown[] = [];
    const ctx = vm.createContext({
      self: { addEventListener: (n: string, h: Handler) => { handlers[n] = h; }, location: { origin: 'https://backfindr.com' },
        registration: { showNotification: async (t: string) => { shown.push(t); } } },
      clients: { matchAll: async () => [{ visibilityState: 'visible', postMessage: () => { throw new Error('x'); } }] },
      URL, console,
    });
    vm.runInContext(readFileSync('public/sw.js', 'utf8'), ctx);
    let p: Promise<unknown> | undefined;
    handlers.push({ data: { json: () => ({ title: 'T' }) }, waitUntil: (x: Promise<unknown>) => { p = x; } });
    await p;
    expect(shown).toEqual(['T']);
    expect(sw.handlers.push).toBeTypeOf('function'); expect(sw2.handlers.push).toBeTypeOf('function');
  });
  it('não há skipWaiting nem clients.claim (ciclo de atualização intacto)', () => {
    const src = readFileSync('public/sw.js', 'utf8');
    expect(src).not.toMatch(/skipWaiting|clients\.claim/);
  });
});
