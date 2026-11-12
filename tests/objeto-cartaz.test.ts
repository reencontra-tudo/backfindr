// Cartaz (imagem usada em «Baixar cartaz» e na pré-visualização de compartilhamento, og:image) de SINAL PÚBLICO:
// nome de pessoa mascarado ANTES de virar imagem. Usuário e legado: exatamente como hoje.
//   npx vitest@2 run --config tests/vitest.config.ts tests/objeto-cartaz.test.ts
import { describe, expect, it, vi, beforeEach } from 'vitest';
import React from 'react';
import { NextRequest } from 'next/server';

(globalThis as unknown as { React: typeof React }).React = React;

// O texto dentro de um PNG não se procura como texto: capturamos o que a rota ENTREGA ao gerador de imagem.
const captured: { element: unknown }[] = [];
vi.mock('next/og', () => ({
  ImageResponse: class { body = null; constructor(el: unknown) { captured.push({ element: el }); } },
}));
const queryMock = vi.fn();
vi.mock('@/lib/db', () => ({ query: (...a: unknown[]) => queryMock(...a) }));

import { maskSharedTexts } from '@/lib/objectPublicView';

const NAME = 'Pablo Miguel Ferreira de Melo Sebastiani';
const PIECES = ['Pablo', 'Miguel', 'Ferreira', 'Melo', 'Sebastiani'];
const row = (o: Record<string, unknown>) => ({
  id: '11111111-1111-1111-1111-111111111111', title: 'x', description: null, status: 'found', category: 'document',
  qr_code: 'TST00001', images: [], source: null, location: 'Centro, Cascavel, PR', latitude: null, longitude: null,
  reward_amount: null, created_at: '2026-10-01T00:00:00.000Z', has_active_boost: false, ...o,
});
const SIGNAL = row({ source: 'public_signal', title: `Documento encontrado em nome de ${NAME}`, description: `Documento encontrado em nome de ${NAME}. Categoria: documento.`, location: `Casa em nome de ${NAME}` });
const USER = row({ title: `Documento em nome de ${NAME}`, description: `Achei o documento em nome de ${NAME}.` });
const LEGACY = row({ is_legacy: true, title: `Documento em nome de ${NAME}`, description: `RG de ${NAME}` });

function textOf(node: unknown): string {
  if (node == null || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(textOf).join(' ');
  const props = (node as { props?: { children?: unknown } }).props;
  return props ? textOf(props.children) : '';
}

async function poster(r: Record<string, unknown>, format: string) {
  captured.length = 0;
  queryMock.mockResolvedValue({ rows: [r] });
  const { GET } = await import('@/app/api/v1/objects/[id]/poster/route');
  await GET(new NextRequest(`http://localhost/api/v1/objects/TST00001/poster?format=${format}`), { params: { id: 'TST00001' } });
  expect(captured.length).toBe(1);
  return textOf(captured[0].element);
}

describe('maskSharedTexts', () => {
  it('sinal público: título, descrição e local sem o nome', () => {
    const r = maskSharedTexts('public_signal', { title: SIGNAL.title, description: SIGNAL.description, location: SIGNAL.location });
    for (const p of PIECES) for (const v of [r.title, r.description, r.location]) expect(v).not.toContain(p);
  });
  it('usuário, legado e origem ausente: MESMO objeto de volta', () => {
    for (const src of [null, undefined, 'qualquer']) { const t = { title: NAME, description: NAME, location: NAME }; expect(maskSharedTexts(src, t)).toBe(t); }
  });
});

describe('cartaz gerado (texto entregue à imagem)', () => {
  beforeEach(() => { vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false }) as Response)); });

  for (const format of ['vertical', 'square', 'a4']) {
    it(`SINAL PÚBLICO (${format}): o nome não vai para a imagem; o resto do texto continua`, async () => {
      const t = await poster(SIGNAL, format);
      for (const p of PIECES) expect(t, `${format}: ${p}`).not.toContain(p);
      expect(t).toContain('nome');       // «em nome de (nome omitido)» (cortado a 40 caracteres no subtítulo)
      expect(t).toMatch(/Cascavel|Casa em nome/); // o local segue aparecendo (sem nome)
    });
    it(`USUÁRIO e LEGADO (${format}): cartaz como hoje (nada mascarado)`, async () => {
      for (const r of [USER, LEGACY]) {
        const t = await poster(r, format);
        expect(t).not.toContain('(nome omitido)');
        expect(t).toMatch(/Pablo/); // texto do usuário/legado continua exatamente como é gerado hoje
      }
    });
  }

  it('o nome é mascarado ANTES do corte de 40 caracteres do subtítulo (nunca sobra pedaço de nome)', async () => {
    const t = await poster(row({ source: 'public_signal', title: 'Encontrado RG em nome de Pablo Miguel Ferreira' }), 'vertical');
    expect(t).not.toMatch(/Pablo|Miguel|Ferreira|Pabl/);
  });

  it('objeto inexistente continua 404', async () => {
    queryMock.mockResolvedValue({ rows: [] });
    const { GET } = await import('@/app/api/v1/objects/[id]/poster/route');
    const res = await GET(new NextRequest('http://localhost/x'), { params: { id: 'NAO' } });
    expect(res.status).toBe(404);
  });
});
