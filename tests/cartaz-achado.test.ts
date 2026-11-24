// Cartaz de ACHADO: chamada do QR Code coerente com quem lê (o DONO), só quando status = found (refinamento da F-23, 24/11/2026).
// Perdido, roubado e qualquer outro valor: textos IDÊNTICOS aos de antes. Banco e gerador de imagem simulados.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { readFileSync } from 'fs';
import path from 'path';
import * as ReactNS from 'react';
(globalThis as { React?: unknown }).React = ReactNS;

const st = vi.hoisted(() => ({ rows: [] as Record<string, unknown>[], jsx: null as unknown, urls: [] as string[] }));
vi.mock('@/lib/db', () => ({ query: vi.fn(async () => ({ rows: st.rows })) }));
vi.mock('next/og', () => ({ ImageResponse: class { constructor(jsx: unknown) { st.jsx = jsx; return new Response('png') as unknown as object; } } }));
vi.mock('sharp', () => ({ default: () => ({}) }));

import { GET } from '@/app/api/v1/objects/[id]/poster/route';

const RUA = 'Rua das Palmeiras Fictícias 1224, Vila Modelo, Guarulhos - SP, 07040-000';
const base = { id: 'u9', title: 'Mochila vermelha', description: 'Mochila vermelha tipo saco.', status: 'lost', category: 'bag', qr_code: 'YFNMFR2O', images: '[]', source: 'user', is_legacy: false,
  location: RUA, latitude: '-23.4567891', longitude: '-46.5234567', reward_amount: null, created_at: '2026-11-10T10:00:00Z', has_active_boost: false };
const chama = async (qs: string) => { st.jsx = null; st.urls = []; await GET(new NextRequest(`http://localhost/api/v1/objects/YFNMFR2O/poster?${qs}`), { params: { id: 'YFNMFR2O' } }); return JSON.stringify(st.jsx, (_k, v) => (typeof v === 'function' ? undefined : v)); };

beforeEach(() => {
  st.rows = [base];
  globalThis.fetch = vi.fn(async (u: unknown) => { st.urls.push(String(u)); return new Response(new Uint8Array(Array(900).fill(7)), { status: 200, headers: { 'content-type': 'image/png' } }); }) as unknown as typeof fetch;
});


import { chamadaDoCartaz } from '@/lib/cartazChamada';

const ANTIGOS = {
  quadrado: ['VOCÊ VIU? ESCANEIE', 'Avise o dono — backfindr.com'],
  vertical: ['AJUDE A ENCONTRAR', 'Você viu? Escaneie e avise o dono!'],
  a4: ['ESCANEIE SE VOCÊ VIU', 'Escaneie o QR Code para abrir a página do objeto e avisar que você o encontrou.'],
};
const NOVOS = {
  quadrado: ['É SEU? ESCANEIE', 'Veja a página do objeto — backfindr.com'],
  vertical: ['ESTE OBJETO FOI ENCONTRADO', 'É seu? Escaneie e avise.'],
  a4: ['É SEU? ESCANEIE', 'Escaneie o QR Code para abrir a página do objeto e avisar que ele é seu.'],
};
const FORMATOS = [['quadrado', 'format=square'], ['vertical', 'format=vertical'], ['a4', 'format=a4']] as const;

describe('chamadaDoCartaz (regra pura)', () => {
  it('achado: textos novos aprovados pelo fundador', () => {
    const c = chamadaDoCartaz('found');
    expect([c.quadrado.titulo, c.quadrado.linha]).toEqual(NOVOS.quadrado);
    expect([c.vertical.titulo, c.vertical.linha]).toEqual(NOVOS.vertical);
    expect([c.a4.titulo, c.a4.texto]).toEqual(NOVOS.a4);
  });
  it('perdido, roubado e qualquer outro valor: textos de antes, sem mudança', () => {
    for (const st of ['lost', 'stolen', 'returned', 'archived', '', null, undefined, 'outro']) {
      const c = chamadaDoCartaz(st as string);
      expect([c.quadrado.titulo, c.quadrado.linha]).toEqual(ANTIGOS.quadrado);
      expect([c.vertical.titulo, c.vertical.linha]).toEqual(ANTIGOS.vertical);
      expect([c.a4.titulo, c.a4.texto]).toEqual(ANTIGOS.a4);
    }
  });
  it('nenhuma frase promete resposta, alerta ou chat (F-23 b e d)', () => {
    const tudo = JSON.stringify([chamadaDoCartaz('found'), chamadaDoCartaz('lost')]);
    expect(tudo).not.toMatch(/alerta|imediat|chat|conversa|garant|responde/i);
  });
});

describe('cartaz gerado (3 formatos)', () => {
  for (const [fmt, qs] of FORMATOS) {
    it(`${fmt}: achado mostra os textos novos e NÃO os de antes`, async () => {
      st.rows = [{ ...base, status: 'found' }];
      const j = await chama(qs);
      for (const t of NOVOS[fmt]) expect(j).toContain(t);
      for (const t of ANTIGOS[fmt]) expect(j).not.toContain(t);
    });
    it(`${fmt}: perdido e roubado ficam idênticos aos de antes (e iguais entre si na chamada)`, async () => {
      for (const status of ['lost', 'stolen']) {
        st.rows = [{ ...base, status }];
        const j = await chama(qs);
        for (const t of ANTIGOS[fmt]) expect(j).toContain(t);
        for (const t of NOVOS[fmt]) expect(j).not.toContain(t);
      }
    });
  }
});

describe('guarda de código', () => {
  it('a rota usa chamadaDoCartaz(obj.status) e não tem mais as frases fixas', () => {
    const r = readFileSync(path.join(__dirname, '..', 'src/app/api/v1/objects/[id]/poster/route.tsx'), 'utf8');
    expect(r).toContain('chamadaDoCartaz(obj.status)');
    for (const f of ['VOCÊ VIU? ESCANEIE', 'AJUDE A ENCONTRAR', 'ESCANEIE SE VOCÊ VIU', 'Você viu? Escaneie']) expect(r).not.toContain(f);
  });
});
