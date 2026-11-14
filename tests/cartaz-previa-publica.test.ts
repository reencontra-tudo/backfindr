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
  globalThis.fetch = vi.fn(async (u: unknown) => { st.urls.push(String(u)); return new Response(new Uint8Array(Array(900).fill(7)), { status: 200, headers: { 'content-type': 'image/png' } }); }) as unknown as typeof fetch;
});

describe('cartaz: pré-visualização pública x cartaz do dono', () => {
  it('?publico=1, cadastro de usuário (o caso real e um fictício com rua): só «bairro, cidade - UF»', async () => {
    const j = await chama('format=vertical&publico=1');
    expect(j).toContain('Vila Modelo, Guarulhos - SP'); expect(j).not.toMatch(/Palmeiras|1224|07040/);
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

// ── Mini-mapa do cartaz: uma imagem estática do Mapbox (nada de blocos do OSM), validada; sem mapa = bloco some ─────────────────────────────────
describe('cartaz A4: mini-mapa «Local da ocorrência»', () => {
  const mapa = () => st.urls.filter(u => u.includes('api.mapbox.com'));
  beforeEach(() => { process.env.MAPBOX_SERVER_TOKEN = 'pk.teste-nao-real'; });
  it('um único pedido ao Mapbox (nenhum ao OpenStreetMap); o bloco aparece; o cartaz do dono usa a coordenada original e a prévia pública a arredondada', async () => {
    const dono = await chama('format=a4');
    expect(st.urls.some(u => u.includes('openstreetmap'))).toBe(false); expect(mapa().length).toBe(1);
    expect(mapa()[0]).toContain('-46.523457,-23.456789,14'); expect(dono).toContain('LOCAL DA OCORRÊNCIA');
    const pub = await chama('format=a4&publico=1');
    expect(mapa().length).toBe(1); expect(mapa()[0]).toContain('-46.523000,-23.457000,14'); expect(pub).toContain('LOCAL DA OCORRÊNCIA');
  });
  it('legado: ?publico=1 mantém a coordenada original', async () => {
    st.rows = [{ ...base, is_legacy: true, source: 'webjetos' }]; await chama('format=a4&publico=1'); expect(mapa()[0]).toContain('-46.523457,-23.456789,14');
  });
  it('Mapbox recusa (403), devolve página em vez de imagem ou não há token: sem mapa — o bloco some e o texto bairro/cidade continua', async () => {
    const proprio = globalThis.fetch;
    for (const resp of [() => new Response(new Uint8Array(Array(900).fill(7)), { status: 403, headers: { 'content-type': 'image/png' } }), () => new Response(new Uint8Array(Array(900).fill(7)), { status: 200, headers: { 'content-type': 'text/html' } }), () => { throw new Error('rede'); }]) {
      globalThis.fetch = vi.fn(async (u: unknown) => (String(u).includes('api.mapbox.com') ? resp() : new Response(new Uint8Array(Array(900).fill(7)), { status: 200, headers: { 'content-type': 'image/png' } }))) as unknown as typeof fetch;
      const j = await chama('format=a4&publico=1'); expect(j).not.toContain('LOCAL DA OCORRÊNCIA'); expect(j).toContain('Vila Modelo, Guarulhos - SP');
    }
    globalThis.fetch = proprio; delete process.env.MAPBOX_SERVER_TOKEN; delete process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    const j = await chama('format=a4'); expect(j).not.toContain('LOCAL DA OCORRÊNCIA'); expect(mapa().length).toBe(0);
  });
  it('frase do cartaz: sem «alerta imediato»; texto fiel', async () => {
    const j = await chama('format=a4');
    expect(j).toContain('Escaneie o QR Code para abrir a página do objeto e avisar que você o encontrou.'); expect(j).not.toMatch(/alerta imediato|ele recebe/);
  });
});
