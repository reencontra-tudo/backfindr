// PostHog: nenhuma credencial na URL enviada (todo evento, não só o $pageview). Tokens fictícios.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { redactTrackingUrl, TRACKING_BLOCKED_PATHS } from '@/lib/trackingGuard';
import { sanitizePosthogEvent } from '@/lib/posthogSanitize';

const ROOT = path.resolve(__dirname, '..');
const lê = (p: string) => readFileSync(path.join(ROOT, p), 'utf8');
const T = 'SEGREDOTESTE9f3a';
const ORIGEM = 'https://exemplo.test';

describe('redactTrackingUrl', () => {
  it.each([
    [`${ORIGEM}/auth/magic-confirm?token=${T}`, `${ORIGEM}/auth/magic-confirm`],
    [`${ORIGEM}/auth/reset-password?token=${T}&a=1`, `${ORIGEM}/auth/reset-password?a=1`],
    [`${ORIGEM}/x?a=1&access_token=${T}&b=2`, `${ORIGEM}/x?a=1&b=2`],
    [`${ORIGEM}/x?ACCESS_TOKEN=${T}`, `${ORIGEM}/x`],
    [`${ORIGEM}/x#access_token=${T}&token_type=bearer`, `${ORIGEM}/x#token_type=bearer`],
    [`${ORIGEM}/x#access_token=${T}`, `${ORIGEM}/x`],
    [`${ORIGEM}/custody/cst_${T}`, `${ORIGEM}/custody/[token]`],
    [`${ORIGEM}/delivery/dlv_${T}?x=1`, `${ORIGEM}/delivery/[token]?x=1`],
    [`/custody/cst_${T}`, `/custody/[token]`],
    [`/delivery/dlv_${T}/`, `/delivery/[token]/`],
    [`${ORIGEM}/CUSTODY/cst_${T}`, `${ORIGEM}/CUSTODY/[token]`],
    [`/%64elivery/dlv_${T}`, `/%64elivery/[token]`],
  ])('%s → %s', (de, para) => {
    expect(redactTrackingUrl(de)).toBe(para);
  });
  it.each([
    `${ORIGEM}/pricing`, `${ORIGEM}/faq#preco`, `${ORIGEM}/x?utm_source=a&code=PROMO&key=1&next=%2Fobjeto%2FABC`,
    `${ORIGEM}/delivery/entregador/painel`, `/delivery/entregador/cadastro`, `/custody`, `/delivery`,
    `${ORIGEM}/objeto/ABC123`, '$direct', '', 'texto qualquer', `${ORIGEM}/blog/post?ref=feed`,
  ])('não mexe em %s', (v) => {
    expect(redactTrackingUrl(v)).toBe(v);
  });
  it('não quebra com texto malformado', () => {
    expect(() => redactTrackingUrl('http://%E0%A4%A/x?%E0%A4%A=1#%')).not.toThrow();
    expect(() => redactTrackingUrl(undefined as unknown as string)).not.toThrow();
  });
});

describe('sanitizePosthogEvent — página com token: nada é enviado', () => {
  const ev = { event: '$pageview', properties: { $current_url: `${ORIGEM}/x` } };
  it.each([
    [{ pathname: '/auth/magic-confirm', search: `?token=${T}` }],
    [{ pathname: '/auth/reset-password', search: `?token=${T}` }],
    [{ pathname: `/custody/cst_${T}` }],
    [{ pathname: `/delivery/dlv_${T}` }],
    [{ pathname: '/pricing', search: `?token=${T}` }],
    [{ pathname: '/x', search: '', hash: `#access_token=${T}` }],
  ])('descarta o evento em %j', (loc) => {
    expect(sanitizePosthogEvent(ev, loc)).toBeNull();
    expect(sanitizePosthogEvent({ event: '$autocapture', properties: {} }, loc)).toBeNull();
    expect(sanitizePosthogEvent({ event: '$pageleave', properties: {} }, loc)).toBeNull();
    expect(sanitizePosthogEvent({ event: '$snapshot', properties: {} }, loc)).toBeNull();
  });
  it('null entra, null sai', () => {
    expect(sanitizePosthogEvent(null, { pathname: '/' })).toBeNull();
  });
});

describe('sanitizePosthogEvent — página normal: campos de URL sem credencial, resto igual', () => {
  const loc = { pathname: '/faq', search: '' };
  it('tira o token de $session_entry_url, $referrer, $pathname e do $set_once (o vazamento verificado em navegador)', () => {
    const e = {
      event: '$pageview',
      properties: {
        $current_url: `${ORIGEM}/faq`,
        $pathname: '/faq',
        $session_entry_url: `${ORIGEM}/auth/magic-confirm?token=${T}`,
        $referrer: `${ORIGEM}/auth/reset-password?token=${T}`,
        $prev_pageview_pathname: `/custody/cst_${T}`,
        $initial_referrer: '$direct',
      },
      $set_once: { $initial_current_url: `${ORIGEM}/delivery/dlv_${T}`, $initial_pathname: `/delivery/dlv_${T}` },
    };
    const o = sanitizePosthogEvent(e, loc)!;
    expect(JSON.stringify(o)).not.toContain(T);
    expect(o.properties!.$session_entry_url).toBe(`${ORIGEM}/auth/magic-confirm`);
    expect(o.properties!.$referrer).toBe(`${ORIGEM}/auth/reset-password`);
    expect(o.properties!.$prev_pageview_pathname).toBe('/custody/[token]');
    expect(o.$set_once!.$initial_current_url).toBe(`${ORIGEM}/delivery/[token]`);
    // o que não tem credencial fica exatamente igual
    expect(o.properties!.$current_url).toBe(`${ORIGEM}/faq`);
    expect(o.properties!.$pathname).toBe('/faq');
    expect(o.properties!.$initial_referrer).toBe('$direct');
  });
  it('não altera o objeto recebido', () => {
    const e = { event: '$pageview', properties: { $session_entry_url: `${ORIGEM}/x?token=${T}` } };
    const antes = JSON.stringify(e);
    sanitizePosthogEvent(e, loc);
    expect(JSON.stringify(e)).toBe(antes);
  });
  it('evento sem credencial volta o MESMO objeto (nada é copiado nem alterado)', () => {
    const e = { event: 'flow_started', properties: { flow: 'lost', $current_url: `${ORIGEM}/flow/lost`, distinct_id: 'u1' } };
    expect(sanitizePosthogEvent(e, { pathname: '/flow/lost' })).toBe(e);
  });
  it('eventos de produto, ID interno e propriedades de produto não mudam', () => {
    const e = {
      event: 'flow_step',
      properties: { flow: 'lost', step: 2, total: 5, distinct_id: 'id-interno', $user_id: 'id-interno', object_code: 'ABC123', from_page: '/pricing?plan=pro' },
      $set: { plan: 'free' },
    };
    expect(sanitizePosthogEvent(e, { pathname: '/flow/lost' })).toEqual(e);
  });
  it('texto que não é URL nunca é reescrito, mesmo falando em token', () => {
    const e = { event: 'findr_query', properties: { query: 'meu delivery/ token=abc perdi', nota: `token=${T}` } };
    expect(sanitizePosthogEvent(e, loc)).toEqual(e);
  });
});

describe('sanitizePosthogEvent — gravação de sessão ($snapshot)', () => {
  const loc = { pathname: '/dashboard/delivery' };
  it('limpa a URL da página (Meta) e os links do HTML gravado, e mantém o resto', () => {
    const snap = [
      { type: 4, data: { href: `${ORIGEM}/faq?token=${T}`, width: 390, height: 844 }, timestamp: 1 },
      { type: 2, data: { node: { childNodes: [{ tagName: 'a', attributes: { href: `/delivery/dlv_${T}`, class: 'x' } }, { tagName: 'a', attributes: { href: '/pricing' } }] } }, timestamp: 2 },
      { type: 3, data: { source: 1, positions: [{ x: 1, y: 2 }] }, timestamp: 3 },
    ];
    const e = { event: '$snapshot', properties: { $snapshot_data: snap, $session_id: 's1' } };
    const o = sanitizePosthogEvent(e, loc)!;
    expect(JSON.stringify(o)).not.toContain(T);
    const d = o.properties!.$snapshot_data as typeof snap;
    expect((d[0].data as { href: string }).href).toBe(`${ORIGEM}/faq`);
    expect(JSON.stringify(d[1])).toContain('/delivery/[token]');
    expect(JSON.stringify(d[1])).toContain('/pricing');
    expect(d[2]).toBe(snap[2]); // parte sem credencial: mesmo objeto
    expect(JSON.stringify(e)).toContain(T); // entrada intacta
  });
  it('só percorre o conteúdo profundo em $snapshot', () => {
    const e = { event: 'custom', properties: { dados: { href: `/delivery/dlv_${T}` } } };
    expect(sanitizePosthogEvent(e, { pathname: '/x' })).toBe(e);
  });
});

describe('guarda: o PostHog usa o filtro e a lista central', () => {
  const prov = lê('src/providers/PostHogProvider.tsx');
  it('posthog.init usa before_send com o filtro', () => {
    expect(prov).toContain("import { posthogBeforeSend } from '@/lib/posthogSanitize'");
    expect(prov).toMatch(/before_send:\s*posthogBeforeSend/);
  });
  it('o mascaramento total e o identify só com o ID interno continuam como estavam', () => {
    for (const trecho of ['mask_all_text:                  true', 'mask_all_element_attributes:    true', 'mask_personal_data_properties:  true', "session_recording: { maskAllInputs: true, maskTextSelector: '*' }", 'capture_pageview:  false', 'capture_pageleave: true', 'autocapture:       true']) {
      expect(prov, trecho).toContain(trecho);
    }
    expect(prov).toContain('identify:      (userId: string) => {\n    posthog.identify(userId);');
  });
  it('o filtro não tem lista própria: usa só o trackingGuard', () => {
    const f = lê('src/lib/posthogSanitize.ts');
    expect(f).toContain("from '@/lib/trackingGuard'");
    for (const proibido of ['magic-confirm', 'reset-password', "'access_token'.*'refresh_token'"]) {
      expect(f.replace(/\/\/.*$/gm, '')).not.toMatch(new RegExp(proibido.replace('.*', '[^\\n]*')));
    }
  });
  it('a lista central continua com as 4 rotas bloqueadas', () => {
    expect(TRACKING_BLOCKED_PATHS.length).toBe(4);
  });
  it('os eventos de produto do arquivo do provider e do Feed não foram tocados', () => {
    expect(prov).toContain("signUp:        (method: string) => posthog.capture('sign_up', { method })");
    expect(prov).toContain("posthog.capture('$pageview', { $current_url: window.location.origin + url })");
    expect(lê('src/lib/feed/analytics.ts')).toContain('posthog.capture(event, props)');
  });
});
