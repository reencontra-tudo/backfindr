// Programa de Colaboradores, etapa E0: roteamento de `/@nome` pelo middleware. Sem banco.
import { describe, it, expect, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { middleware } from '@/middleware';
import { rotaDeColaborador, slugValido, colaboradoresAtivo } from '@/lib/colaboradores/rota';

const BASE = 'https://backfindr.com';
const req = (caminho: string, headers: Record<string, string> = {}) => new NextRequest(`${BASE}${caminho}`, { headers });

afterEach(() => { delete process.env.COLABORADORES_ATIVO; });

describe('rotaDeColaborador / slug (funções puras)', () => {
  it('formato do @nome: minúsculas, números e hífen; 3 a 30; sem hífen nas pontas', () => {
    for (const ok of ['abc', 'backfindr', 'grupo-sp-1', 'a1b', 'a'.repeat(30)]) expect(slugValido(ok), ok).toBe(true);
    for (const ruim of ['', 'ab', 'a'.repeat(31), '-abc', 'abc-', 'ab_c', 'ab c', 'Abc', 'ação', 'a.b.c']) expect(slugValido(ruim), ruim).toBe(false);
  });

  it('só casa /@nome (com ou sem barra final)', () => {
    expect(rotaDeColaborador('/@backfindr')).toEqual({ tipo: 'reescrever', slug: 'backfindr' });
    expect(rotaDeColaborador('/@backfindr/')).toEqual({ tipo: 'reescrever', slug: 'backfindr' });
    expect(rotaDeColaborador('/@BackFindr')).toEqual({ tipo: 'minusculas', slug: 'backfindr' });
  });

  it('qualquer outro caminho NÃO casa (404 normal, nada muda)', () => {
    for (const c of ['/', '/feed', '/@', '/@ab', '/@-abc', '/@abc/def', '/x/@abc', '/@abc%2Fx', '/colaborador/abc', '/@a_b', '/@' + 'a'.repeat(31), '/objeto/ABC123']) {
      expect(rotaDeColaborador(c), c).toBeNull();
    }
  });

  it('o interruptor só liga com exatamente «1»', () => {
    expect(colaboradoresAtivo({})).toBe(false);
    for (const v of ['', '0', 'true', 'TRUE', 'sim', ' 1']) expect(colaboradoresAtivo({ COLABORADORES_ATIVO: v }), v).toBe(false);
    expect(colaboradoresAtivo({ COLABORADORES_ATIVO: '1' })).toBe(true);
  });
});

describe('middleware', () => {
  it('DESLIGADO (padrão): /@nome não é reescrito nem redirecionado (404 como hoje)', () => {
    for (const c of ['/@backfindr', '/@BackFindr', '/@backfindr/']) {
      const r = middleware(req(c));
      expect(r.headers.get('x-middleware-rewrite'), c).toBeNull();
      expect(r.headers.get('location'), c).toBeNull();
      expect(r.headers.get('x-middleware-next')).toBe('1');
    }
  });

  it('LIGADO: /@nome é reescrito para /colaborador/nome (a URL do navegador não muda)', () => {
    process.env.COLABORADORES_ATIVO = '1';
    const r = middleware(req('/@backfindr?c=ZL27'));
    expect(r.headers.get('x-middleware-rewrite')).toBe(`${BASE}/colaborador/backfindr?c=ZL27`);
    expect(r.headers.get('location')).toBeNull();
  });

  it('LIGADO: maiúsculas viram redirecionamento 308 para a URL em minúsculas', () => {
    process.env.COLABORADORES_ATIVO = '1';
    const r = middleware(req('/@BackFindr?x=1'));
    expect(r.status).toBe(308);
    expect(r.headers.get('location')).toBe(`${BASE}/@backfindr?x=1`);
  });

  it('LIGADO: caminhos que não são de colaborador seguem exatamente como com o interruptor desligado', () => {
    const caminhos = ['/', '/feed', '/feed/pagina/2', '/objeto/ABC123', '/flow/found', '/colaborador/backfindr', '/@ab', '/@abc/def', '/auth/login'];
    const antes = caminhos.map((c) => { const r = middleware(req(c, { referer: 'https://exemplo.com/' })); return [r.status, r.headers.get('x-middleware-rewrite'), r.headers.get('location'), r.headers.get('set-cookie')]; });
    process.env.COLABORADORES_ATIVO = '1';
    const depois = caminhos.map((c) => { const r = middleware(req(c, { referer: 'https://exemplo.com/' })); return [r.status, r.headers.get('x-middleware-rewrite'), r.headers.get('location'), r.headers.get('set-cookie')]; });
    expect(depois).toEqual(antes);
  });

  it('o cookie de origem continua sendo gravado, com o caminho ORIGINAL (/@nome), no ramo reescrito', () => {
    process.env.COLABORADORES_ATIVO = '1';
    const r = middleware(req('/@backfindr', { referer: 'https://exemplo.com/' }));
    const cookie = decodeURIComponent(r.headers.get('set-cookie') ?? '');
    expect(cookie).toContain('bf_acquisition=');
    expect(cookie).toContain('"landing_page":"/@backfindr"');
  });

  it('o redirecionamento de links antigos com token continua valendo (com o interruptor ligado ou desligado)', () => {
    for (const ligado of [false, true]) {
      if (ligado) process.env.COLABORADORES_ATIVO = '1';
      const r = middleware(req('/auth/google-success?access_token=abc&refresh_token=def&x=1'));
      expect(r.headers.get('location')).toBe(`${BASE}/auth/google-success?x=1`);
    }
  });
});
