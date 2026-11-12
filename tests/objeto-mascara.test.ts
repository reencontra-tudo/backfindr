// Páginas /objeto/[code] de SINAL PÚBLICO: nome de pessoa mascarado no HTML e no JSON embutido.
// Objetos de usuários e do legado NÃO podem mudar.
//   npx vitest@2 run --config tests/vitest.config.ts tests/objeto-mascara.test.ts
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';

// O vitest compila JSX no modo clássico; as páginas usam o modo automático do Next.
(globalThis as unknown as { React: typeof React }).React = React;

import { maskObjectForPublicPage } from '@/lib/objectPublicView';
import { maskPersonNames } from '@/lib/privacy/maskPersonNames';

const NAME = 'Pablo Miguel Ferreira de Melo Sebastiani';
const PIECES = ['Pablo', 'Miguel', 'Ferreira', 'Melo', 'Sebastiani'];
const base = (o: Record<string, unknown>) => ({
  id: '11111111-1111-1111-1111-111111111111', title: 'x', description: '', status: 'found', category: 'document',
  unique_code: 'TST00001', photos: [], location: { lat: -24.9, lng: -53.4, address: 'Centro, Cascavel, PR' },
  color: null, brand: null, pet_breed: null, is_legacy: false, source: null, reward_amount: null, reward_description: null,
  created_at: '2026-10-01T00:00:00.000Z', updated_at: '2026-10-01T00:00:00.000Z', ...o,
});
const SIGNAL = base({ source: 'public_signal', title: `Documento encontrado em nome de ${NAME}`, description: `Documento encontrado em nome de ${NAME}. Categoria: documento. Local: Centro.` });
const USER = base({ source: null, title: `Documento em nome de ${NAME}`, description: `Achei o documento em nome de ${NAME}.` });
const LEGACY = base({ source: null, is_legacy: true, title: `Documento em nome de ${NAME}`, description: `RG de ${NAME}` });

describe('maskObjectForPublicPage', () => {
  it('sinal público: título e descrição sem o nome; resto intacto', () => {
    const r = maskObjectForPublicPage(SIGNAL as never) as typeof SIGNAL;
    for (const p of PIECES) { expect(r.title).not.toContain(p); expect(r.description).not.toContain(p); }
    expect(r.title).toBe('Documento encontrado em nome de (nome omitido)');
    expect({ ...r, title: 0, description: 0 }).toEqual({ ...SIGNAL, title: 0, description: 0 });
  });
  it('mascara também o endereço do local, quando houver nome', () => {
    const r = maskObjectForPublicPage(base({ source: 'public_signal', title: 'a', location: { lat: 1, lng: 2, address: 'Casa em nome de Ana Paula Souza' } }) as never) as typeof SIGNAL;
    expect(r.location.address).not.toContain('Ana');
  });
  it('usuário e legado: devolve EXATAMENTE o mesmo objeto (mesma referência, nada alterado)', () => {
    expect(maskObjectForPublicPage(USER as never)).toBe(USER);
    expect(maskObjectForPublicPage(LEGACY as never)).toBe(LEGACY);
    expect((USER as { title: string }).title).toContain(NAME);
  });
  it('aceita nulo e objeto sem campos', () => {
    expect(maskObjectForPublicPage(null)).toBeNull();
    expect(maskObjectForPublicPage(undefined)).toBeUndefined();
    expect(maskObjectForPublicPage({ source: 'public_signal' } as never)).toEqual({ source: 'public_signal', title: undefined, description: undefined, location: undefined });
  });
  it('título sem nome de pessoa não muda', () => {
    const o = base({ source: 'public_signal', title: 'Gato Derick desapareceu', description: 'Gato Derick desapareceu. Categoria: pet.' });
    expect(maskObjectForPublicPage(o as never)).toEqual(o);
    expect(maskPersonNames('Gato Derick desapareceu')).toBe('Gato Derick desapareceu');
  });
});

describe('página /objeto/[code] renderizada (HTML + metadados + JSON-LD)', () => {
  const realFetch = globalThis.fetch;
  const serve = (obj: unknown) => { globalThis.fetch = vi.fn(async () => ({ ok: true, json: async () => ({ success: true, data: obj }) }) as Response) as typeof fetch; };
  beforeEach(() => { vi.resetModules(); });
  afterEach(() => { globalThis.fetch = realFetch; });

  const render = async (obj: unknown) => {
    serve(obj);
    const mod = await import('@/app/objeto/[code]/page');
    const meta = await mod.generateMetadata({ params: { code: 'TST00001' } });
    const html = renderToString(await mod.default({ params: { code: 'TST00001' } }));
    return { html, metaJson: JSON.stringify(meta) };
  };

  it('SINAL PÚBLICO: o nome não aparece no HTML (título, h1, JSON-LD) nem nos metadados (title, description, OG, Twitter)', async () => {
    const { html, metaJson } = await render(SIGNAL);
    for (const p of PIECES) { expect(html, `HTML: ${p}`).not.toContain(p); expect(metaJson, `meta: ${p}`).not.toContain(p); }
    expect(html).toContain('(nome omitido)');
    expect(metaJson).toContain('(nome omitido)');
    expect(html).toMatch(/<h1[^>]*>[^<]*\(nome omitido\)/);
    expect(html).toContain('application/ld+json');
  });

  it('USUÁRIO e LEGADO: HTML e metadados idênticos ao comportamento atual (nada mascarado)', async () => {
    for (const obj of [USER, LEGACY]) {
      const { html, metaJson } = await render(obj);
      expect(html).toContain(NAME);
      expect(metaJson).toContain(NAME);
      expect(html).not.toContain('(nome omitido)');
    }
  });
});
