// Eventos de conversão na entrada direta: o Pixel/GA4 ainda não carregou quando o efeito da página roda.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { quandoTrackerPronto } from '@/lib/trackerReady';

const ROOT = path.resolve(__dirname, '..');
const lê = (p: string) => readFileSync(path.join(ROOT, p), 'utf8');

type Win = { location: { pathname: string; search: string; hash: string }; fbq?: unknown; gtag?: unknown };
let win: Win;
beforeEach(() => {
  vi.useFakeTimers();
  win = { location: { pathname: '/comecar', search: '', hash: '' } };
  (globalThis as unknown as { window: Win }).window = win;
});
afterEach(() => {
  vi.useRealTimers();
  delete (globalThis as unknown as { window?: Win }).window;
});

describe('quandoTrackerPronto', () => {
  it('tracker já existe (navegação interna): dispara na hora, uma vez', () => {
    win.fbq = () => {};
    const f = vi.fn();
    quandoTrackerPronto('fbq', f);
    expect(f).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(60_000);
    expect(f).toHaveBeenCalledTimes(1);
  });
  it('entrada direta: espera o tracker aparecer e dispara exatamente uma vez', () => {
    const f = vi.fn();
    quandoTrackerPronto('fbq', f);
    expect(f).not.toHaveBeenCalled();
    vi.advanceTimersByTime(150); // ~150 ms: ainda não existe
    expect(f).not.toHaveBeenCalled();
    win.fbq = () => {};
    vi.advanceTimersByTime(100);
    expect(f).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(60_000);
    expect(f).toHaveBeenCalledTimes(1);
  });
  it('gtag: espera além de 1,5 s (a janela antiga de 5 tentativas de 300 ms)', () => {
    const f = vi.fn();
    quandoTrackerPronto('gtag', f);
    vi.advanceTimersByTime(4000);
    expect(f).not.toHaveBeenCalled();
    win.gtag = () => {};
    vi.advanceTimersByTime(100);
    expect(f).toHaveBeenCalledTimes(1);
  });
  it('desiste depois do limite se o tracker nunca carregar (nada dispara, nada fica rodando)', () => {
    const f = vi.fn();
    quandoTrackerPronto('fbq', f, { limiteMs: 1000 });
    vi.advanceTimersByTime(1500);
    win.fbq = () => {};
    vi.advanceTimersByTime(5000);
    expect(f).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });
  it('cancelar (retorno do useEffect) impede o disparo e limpa o temporizador', () => {
    const f = vi.fn();
    const cancelar = quandoTrackerPronto('fbq', f);
    cancelar();
    win.fbq = () => {};
    vi.advanceTimersByTime(5000);
    expect(f).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });
  it('chamar duas vezes (duas montagens) dispara uma vez por chamada, nunca duas na mesma', () => {
    const a = vi.fn();
    const b = vi.fn();
    quandoTrackerPronto('fbq', a);
    quandoTrackerPronto('fbq', b);
    win.fbq = () => {};
    vi.advanceTimersByTime(300);
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
  });
  it.each([
    [{ pathname: '/auth/magic-confirm', search: '?token=abc', hash: '' }],
    [{ pathname: '/auth/reset-password', search: '?token=abc', hash: '' }],
    [{ pathname: '/custody/cst_x', search: '', hash: '' }],
    [{ pathname: '/delivery/dlv_x', search: '', hash: '' }],
    [{ pathname: '/pricing', search: '?access_token=abc', hash: '' }],
  ])('rota bloqueada pelo trackingGuard: nunca dispara, mesmo com o tracker presente (%j)', (loc) => {
    win.location = loc;
    win.fbq = () => {};
    const f = vi.fn();
    quandoTrackerPronto('fbq', f);
    vi.advanceTimersByTime(5000);
    expect(f).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });
  it('se a rota passar a ser bloqueada enquanto espera, não dispara', () => {
    const f = vi.fn();
    quandoTrackerPronto('fbq', f);
    win.location = { pathname: '/custody/cst_x', search: '', hash: '' };
    win.fbq = () => {};
    vi.advanceTimersByTime(300);
    expect(f).not.toHaveBeenCalled();
  });
  it('erro dentro do disparo não escapa (analítica nunca quebra a página)', () => {
    win.fbq = () => {};
    expect(() => quandoTrackerPronto('fbq', () => { throw new Error('x'); })).not.toThrow();
  });
  it('sem window (servidor): não faz nada', () => {
    delete (globalThis as unknown as { window?: Win }).window;
    const f = vi.fn();
    expect(() => quandoTrackerPronto('fbq', f)()).not.toThrow();
    expect(f).not.toHaveBeenCalled();
  });
});

describe('guarda: quem usa o auxiliar e o que não mudou', () => {
  it('ViewContent espera o tracker; o evento e as propriedades são os mesmos', () => {
    const vc = lê('src/app/comecar/TrackViewContent.tsx');
    expect(vc).toContain("quandoTrackerPronto('fbq'");
    expect(vc).toContain("window.fbq?.('track', 'ViewContent', {");
    expect(vc).toContain("content_name: 'comecar_landing'");
  });
  it('ocorrencia_publicada NÃO foi alterado (verificado: já dispara uma vez na entrada direta, mesmo com carga lenta)', () => {
    const s = lê('src/app/dashboard/objects/[id]/sucesso/page.tsx');
    expect(s).not.toContain('quandoTrackerPronto');
    expect(s).toContain('const maxAttempts = 5;');
    expect(s).toContain("window.gtag('event', 'ocorrencia_publicada', {");
    expect(s).toContain('ga4AlreadyFired(id)'); // uma vez por objeto por sessão: continua valendo
    expect(s).toContain('ga4MarkFired(id)');
  });
  it('Lead e Purchase NÃO foram alterados (continuam exatamente como estavam)', () => {
    expect(lê('src/app/auth/register/page.tsx')).toContain("if (typeof window !== 'undefined' && (window as any).fbq) {\n        (window as any).fbq('track', 'Lead');\n      }");
    const c = lê('src/app/checkout/success/client.tsx');
    expect(c).toContain("(window as any).fbq('track', 'Purchase', {\n                  value: data.data.active_boost.amount_paid,\n                  currency: 'BRL',\n                  content_name: data.data.active_boost.type,\n                });");
    expect(c).not.toContain('quandoTrackerPronto');
    expect(lê('src/app/auth/register/page.tsx')).not.toContain('quandoTrackerPronto');
  });
  it('o auxiliar usa o trackingGuard e não tem lista de rotas própria', () => {
    const h = lê('src/lib/trackerReady.ts');
    expect(h).toContain("from '@/lib/trackingGuard'");
    expect(h).not.toContain('magic-confirm');
  });
  it('só há 4 pontos de chamada a fbq/gtag fora do TrackingScripts (um novo precisa ser avaliado)', () => {
    // Lista dos chamadores conhecidos; um quinto exige decidir se precisa esperar o tracker.
    const esperados = [
      'src/app/auth/register/page.tsx',
      'src/app/checkout/success/client.tsx',
      'src/app/comecar/TrackViewContent.tsx',
      'src/app/dashboard/objects/[id]/sucesso/page.tsx',
    ];
    const achados: string[] = [];
    const { readdirSync, statSync } = require('node:fs') as typeof import('node:fs');
    const varre = (dir: string) => {
      for (const n of readdirSync(path.join(ROOT, dir))) {
        const rel = `${dir}/${n}`;
        if (statSync(path.join(ROOT, rel)).isDirectory()) varre(rel);
        else if (/\.tsx?$/.test(n) && /\b(?:fbq|gtag)\s*\??\.?\(|window\.(?:fbq|gtag)\b|\(window as any\)\.fbq/.test(lê(rel))) achados.push(rel);
      }
    };
    varre('src');
    expect(achados.filter((f) => f !== 'src/components/TrackingScripts.tsx' && f !== 'src/lib/trackerReady.ts').sort()).toEqual(esperados.sort());
  });
});
