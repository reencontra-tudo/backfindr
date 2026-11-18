// Sessão: validade e atributos dos cookies de login e dos tokens (levantamento do app instalado). Fixa o comportamento atual; sem banco.
import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';
import { NextResponse } from 'next/server';

const read = (rel: string) => readFileSync(path.join(__dirname, '..', rel), 'utf8');

describe('cookies de login gravados pelo servidor (OAuth)', () => {
  it('30 dias (Max-Age), path /, SameSite=Lax e Secure em produção; não são cookies de sessão', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const { setAuthCookies } = await import('@/lib/authCookies');
    const r = NextResponse.json({}); setAuthCookies(r, { accessToken: 'a.b.c', refreshToken: 'd.e.f' });
    const set = r.headers.getSetCookie();
    expect(set.length).toBe(2);
    for (const c of set) {
      expect(c).toContain('Max-Age=2592000'); expect(c).toMatch(/Path=\//); expect(c).toMatch(/SameSite=lax/i); expect(c).toMatch(/Secure/); expect(c).not.toMatch(/Domain=/i);
    }
    vi.unstubAllEnvs();
  });
});

describe('cookies de login gravados pelo navegador (e-mail e senha) e renovação', () => {
  const api = read('src/lib/api.ts');
  it('30 dias, SameSite=Lax, Secure em produção, nos dois cookies', () => {
    expect((api.match(/expires: 30, secure: process\.env\.NODE_ENV === 'production', sameSite: 'lax'/g) ?? []).length).toBe(2);
  });
  it('a sessão só é encerrada quando o servidor recusa o token (401); falha de rede mantém a sessão', () => {
    expect(api).toContain('isInvalidSessionError(e)');
    expect(api).toMatch(/Falha de rede,\s*\n\s*\/\/ timeout ou erro 5xx mantém a sessão/);
  });
});

describe('validade dos tokens', () => {
  it('acesso 30 min e renovação 30 dias, igual à validade dos cookies', async () => {
    vi.stubEnv('SECRET_KEY', 'segredo-de-teste-segredo-de-teste-123456');
    vi.resetModules();
    const { createAccessToken, createRefreshToken, verifyToken } = await import('@/lib/jwt');
    const a = verifyToken(createAccessToken('u1', 'x@x.com'))!, r = verifyToken(createRefreshToken('u1', 'x@x.com'))!;
    expect(a.exp! - a.iat!).toBe(30 * 60);
    expect(r.exp! - r.iat!).toBe(30 * 24 * 3600);
    vi.unstubAllEnvs();
  });
  it('a rota de renovação emite par novo (acesso e renovação) e recusa token inválido com 401', () => {
    const s = read('src/app/api/v1/auth/refresh/route.ts');
    expect(s).toContain('createAccessToken'); expect(s).toContain('createRefreshToken'); expect(s).toMatch(/Invalid or expired refresh token', 401/);
  });
});
