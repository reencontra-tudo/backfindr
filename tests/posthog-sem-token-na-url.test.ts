// PostHog não pode receber token na URL ($pageview, autocapture, gravação). Tokens fictícios; nada de dado real.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { REDACTED, sanitizePostHogProps, sanitizeSnapshotData, sanitizeTrackedUrl } from '@/lib/trackingGuard';

const ORIGEM = 'https://backfindr.com';
const TOKEN = 'tok_FICTICIO_123';

describe('sanitizeTrackedUrl — rotas bloqueadas', () => {
  it.each([
    [`${ORIGEM}/auth/magic-confirm?token=${TOKEN}`, `${ORIGEM}/auth/magic-confirm`],
    [`${ORIGEM}/auth/reset-password?token=${TOKEN}&x=1#frag`, `${ORIGEM}/auth/reset-password`],
    [`/auth/magic-confirm?token=${TOKEN}`, '/auth/magic-confirm'],
    [`${ORIGEM}/custody/${TOKEN}`, `${ORIGEM}/custody/${REDACTED}`],
    [`${ORIGEM}/delivery/${TOKEN}?a=1`, `${ORIGEM}/delivery/${REDACTED}`],
    [`/custody/${TOKEN}/detalhe`, `/custody/${REDACTED}/detalhe`],
  ])('%s', (entrada, esperado) => {
    expect(sanitizeTrackedUrl(entrada)).toBe(esperado);
  });
});

describe('sanitizeTrackedUrl — parâmetros sensíveis em qualquer rota', () => {
  it.each([
    [`${ORIGEM}/pricing?token=${TOKEN}`, `${ORIGEM}/pricing`],
    [`${ORIGEM}/x?a=1&access_token=${TOKEN}&b=2`, `${ORIGEM}/x?a=1&b=2`],
    [`${ORIGEM}/x?ACCESS_TOKEN=${TOKEN}`, `${ORIGEM}/x`],
    [`${ORIGEM}/x?refresh_token=${TOKEN}&id_token=${TOKEN}&otp=1&secret=1&password=1&senha=1`, `${ORIGEM}/x`],
    [`${ORIGEM}/x#access_token=${TOKEN}&token_type=bearer`, `${ORIGEM}/x#token_type=bearer`],
    [`${ORIGEM}/x?a=1#access_token=${TOKEN}`, `${ORIGEM}/x?a=1`],
  ])('%s', (entrada, esperado) => {
    const saida = sanitizeTrackedUrl(entrada);
    expect(saida).toBe(esperado);
    expect(saida).not.toContain(TOKEN);
  });
});

describe('sanitizeTrackedUrl — o que NÃO muda', () => {
  it.each([
    `${ORIGEM}/`,
    `${ORIGEM}/pricing`,
    `${ORIGEM}/objeto/ABC123?aviso=1`,
    `${ORIGEM}/qualquer?utm_source=x&code=PROMO&key=abc&t=1`,
    `${ORIGEM}/checkout/success?type=boost&ref=x&object_id=abc`,
    `${ORIGEM}/delivery/entregador/painel`,
    `${ORIGEM}/custody`,
    '/dashboard',
    '',
  ])('%s fica igual', (u) => {
    expect(sanitizeTrackedUrl(u)).toBe(u);
  });
  it('valor que não é texto volta como veio', () => {
    expect(sanitizeTrackedUrl(undefined)).toBeUndefined();
    expect(sanitizeTrackedUrl(null)).toBeNull();
    expect(sanitizeTrackedUrl(42)).toBe(42);
  });
  it('texto malformado não quebra', () => {
    expect(() => sanitizeTrackedUrl('%E0%A4%A?%E0%A4%A=1#%')).not.toThrow();
  });
});

describe('sanitizePostHogProps', () => {
  it('limpa só as propriedades de URL e mantém as demais', () => {
    const props = {
      $current_url: `${ORIGEM}/auth/magic-confirm?token=${TOKEN}`,
      $pathname: `/custody/${TOKEN}`,
      $referrer: `${ORIGEM}/auth/reset-password?token=${TOKEN}`,
      $host: 'backfindr.com',
      plan: 'free',
      n: 3,
    };
    const out = sanitizePostHogProps(props);
    expect(JSON.stringify(out)).not.toContain(TOKEN);
    expect(out.$host).toBe('backfindr.com');
    expect(out.plan).toBe('free');
    expect(out.n).toBe(3);
    expect(Object.keys(out).sort()).toEqual(Object.keys(props).sort());
    expect(props.$current_url).toContain(TOKEN); // não altera o objeto original
  });
  it('aceita ausência de propriedades', () => {
    expect(sanitizePostHogProps(undefined)).toBeUndefined();
    expect(sanitizePostHogProps(null)).toBeNull();
  });
});

describe('gravação de sessão ($snapshot_data, eventos rrweb)', () => {
  const meta = { type: 4, data: { href: `${ORIGEM}/auth/reset-password?token=${TOKEN}`, width: 1280, height: 720 }, timestamp: 1 };
  const custom = { type: 5, data: { tag: '$pageview', payload: { href: `${ORIGEM}/x?access_token=${TOKEN}&ok=1` } }, timestamp: 2 };
  const outro = { type: 3, data: { source: 1, positions: [] }, timestamp: 3 };
  it('limpa data.href e data.payload.href e preserva o resto', () => {
    const out = sanitizeSnapshotData([meta, custom, outro]) as any[];
    expect(JSON.stringify(out)).not.toContain(TOKEN);
    expect(out[0].data.width).toBe(1280);
    expect(out[1].data.payload.href).toBe(`${ORIGEM}/x?ok=1`);
    expect(out[2]).toBe(outro);
  });
  it('aceita evento serializado em texto', () => {
    const out = sanitizeSnapshotData([JSON.stringify(meta)]) as string[];
    expect(out[0]).not.toContain(TOKEN);
    expect(JSON.parse(out[0]).data.height).toBe(720);
  });
  it('via sanitizePostHogProps, sem alterar o original nem os demais campos', () => {
    const props = { $snapshot_data: [meta], $session_id: 's1', $snapshot_bytes: 10 };
    const out = sanitizePostHogProps(props);
    expect(JSON.stringify(out)).not.toContain(TOKEN);
    expect(out.$session_id).toBe('s1');
    expect(out.$snapshot_bytes).toBe(10);
    expect(meta.data.href).toContain(TOKEN);
  });
});

describe('PostHogProvider — a fiação não pode regredir', () => {
  const src = readFileSync(path.resolve(__dirname, '../src/providers/PostHogProvider.tsx'), 'utf8');
  it('o $pageview manual passa a URL por sanitizeTrackedUrl, nunca a query inteira crua', () => {
    expect(src).toMatch(/capture\('\$pageview',\s*\{\s*\$current_url:\s*sanitizeTrackedUrl\(/);
    expect(src).not.toMatch(/\$current_url:\s*window\.location\.origin\s*\+\s*url\s*\}/);
  });
  it('o init usa before_send com sanitizePostHogProps (autocapture, saída de página e gravação)', () => {
    expect(src).toMatch(/before_send:/);
    expect(src).toMatch(/sanitizePostHogProps\(event\.properties\)/);
  });
  it('o mascaramento atual segue ligado', () => {
    for (const k of ['mask_all_text', 'mask_all_element_attributes', 'mask_personal_data_properties', 'maskAllInputs']) {
      expect(src).toContain(k);
    }
  });
  it('o identify segue só com o id interno', () => {
    expect(src).toMatch(/identify:\s*\(userId: string\)\s*=>\s*\{\s*posthog\.identify\(userId\);\s*\}/);
  });
});
