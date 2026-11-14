// Imagem de pré-visualização PÚBLICA do cartaz (?publico=1: og:image de /objeto e compartilhamento): só «bairro, cidade - UF» e mapa com coordenada arredondada.
// O cartaz do dono (sem o parâmetro) continua com o texto original. Nomes e endereços inventados. Banco e gerador de imagem simulados.
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
  globalThis.fetch = vi.fn(async (u: unknown) => { st.urls.push(String(u)); return new Response(new Uint8Array([1, 2, 3]), { status: 200, headers: { 'content-type': 'image/png' } }); }) as unknown as typeof fetch;
});

describe('cartaz: pré-visualização pública x cartaz do dono', () => {
  it('?publico=1, cadastro de usuário (o caso real e um fictício com rua): só «bairro, cidade - UF»; mapa com coordenada de 3 casas', async () => {
    const j = await chama('format=vertical&publico=1');
    expect(j).toContain('Vila Modelo, Guarulhos - SP'); expect(j).not.toMatch(/Palmeiras|1224|07040/);
    expect(st.urls.some(u => u.includes('tile.openstreetmap.org'))).toBe(true);
  });
  it('mapa do cartaz público usa a coordenada arredondada (ponto escolhido na divisa de dois blocos do mapa: exato e arredondado caem em blocos diferentes)', async () => {
    st.rows = [{ ...base, latitude: '-23.4567891', longitude: '-46.922507' }];
    await chama('format=vertical&publico=1');
    const bloco = (lng: number) => Math.floor((lng + 180) / 360 * 2 ** 15);
    expect(bloco(-46.922507)).not.toBe(bloco(-46.923));
    const xs = st.urls.filter(u => u.includes('tile.openstreetmap.org')).map(u => Number(u.split('/')[4]));
    expect(xs).toContain(bloco(-46.923) - 1); expect(xs).not.toContain(bloco(-46.922507) + 1);   // centro do mapa = bloco do valor arredondado
    st.rows = [{ ...base, latitude: '-23.4567891', longitude: '-46.922507' }];
    await chama('format=vertical');
    expect(st.urls.filter(u => u.includes('tile.openstreetmap.org')).map(u => Number(u.split('/')[4]))).toContain(bloco(-46.922507) + 1);   // cartaz do dono: coordenada exata
  });
  it('sem o parâmetro (cartaz que o dono baixa e imprime): texto original, intocado', async () => {
    const j = await chama('format=vertical');
    expect(j).toContain('Rua das Palmeiras'); expect(j).toContain('1224');
  });
  it('?publico=1 em legado e em sinal público: igual ao cartaz de hoje', async () => {
    for (const o of [{ is_legacy: true, source: 'webjetos' }, { is_legacy: false, source: 'public_signal', location: 'bairro Colonial, Cascavel, PR' }]) {
      st.rows = [{ ...base, ...o }];
      const com = await chama('format=vertical&publico=1'); const sem = await chama('format=vertical');
      expect(com).toBe(sem);
    }
  });
  it('só a página /objeto (og:image, Twitter, download de quem visita) pede a versão pública; o painel do dono e a API de cartaz não', () => {
    const r = (f: string) => readFileSync(path.join(__dirname, '..', f), 'utf8');
    expect(r('src/app/objeto/[code]/page.tsx').match(/poster\?format=vertical&publico=1/g)?.length).toBe(2);
    expect(r('src/app/objeto/[code]/client.tsx')).toContain('poster?format=${format}&publico=1');
    expect(r('src/lib/api.ts')).toContain("poster?format=${format}`"); expect(r('src/lib/api.ts')).not.toContain('publico=1');
    expect(r('src/app/dashboard/objects/[id]/page.tsx')).not.toContain('publico=1'); expect(r('src/components/PosterModal.tsx')).not.toContain('publico=1');
    expect(r('src/lib/posterFormatter.ts')).not.toMatch(/publicLocation|enderecoPublico/);
  });
});
