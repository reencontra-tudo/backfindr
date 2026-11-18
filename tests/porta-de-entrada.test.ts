// Porta de entrada com sessão existente: login/cadastro redirecionam; home só troca «Entrar» por «Meu painel» no cliente, depois de montar. Sem banco.
import { afterEach, describe, expect, it, vi } from 'vitest';
import React from 'react';
import { readFileSync } from 'fs';
import path from 'path';
import { renderToString } from 'react-dom/server';

(globalThis as unknown as { React: typeof React }).React = React;
const read = (rel: string) => readFileSync(path.join(__dirname, '..', rel), 'utf8');

import Navbar from '@/components/home/Navbar';
import { deveRedirecionar, PARAMS_QUE_DESLIGAM } from '@/components/auth/PortaDeEntrada';
import { pedirArmazenamentoPersistente } from '@/lib/armazenamento';
import { getPostLoginRedirect } from '@/lib/redirectByRole';

describe('home: visitante sem login vê exatamente o que via antes', () => {
  const html = renderToString(React.createElement(Navbar)).replace(/<!-- -->/g, '');
  it('«Entrar» continua apontando para /auth/login, com as mesmas classes; «Criar conta» também', () => {
    expect(html).toContain('<a class="text-sm text-white/50 transition-colors hover:text-white" href="/auth/login">Entrar</a>');
    expect(html).toContain('href="/auth/register"'); expect(html).toContain('Criar conta');
  });
  it('não aparece «Meu painel» no HTML do servidor (estado logado só no cliente, depois de montar)', () => {
    expect(html).not.toContain('Meu painel'); expect(html).not.toContain('data-nav-meu-painel');
  });
  it('o HTML do servidor é igual em renderizações repetidas (sem diferença de hidratação)', () => {
    expect(renderToString(React.createElement(Navbar))).toBe(renderToString(React.createElement(Navbar)));
  });
  it('marcação do topo, links e logotipo continuam', () => {
    for (const t of ['href="/"', 'Ao vivo', 'Como funciona', 'Pets', 'href="/map"', 'Logo Backfindr']) expect(html, t).toContain(t);
  });
});

describe('home com sessão: «Meu painel» leva ao destino por perfil', () => {
  const nav = read('src/components/home/Navbar.tsx');
  it('o estado logado vem do hook (cliente, após montar) e troca só o botão «Entrar»', () => {
    expect(nav).toContain("const logado = estado === 'logado';");
    expect(nav).toMatch(/logado \? \([\s\S]*href=\{getPostLoginRedirect\(role\)\}[\s\S]*Meu painel[\s\S]*\) : \([\s\S]*href="\/auth\/login"[\s\S]*Entrar/);
  });
  it('destino por perfil', () => {
    expect(getPostLoginRedirect('user')).toBe('/dashboard'); expect(getPostLoginRedirect('admin')).toBe('/admin/dashboard');
    expect(getPostLoginRedirect('super_admin')).toBe('/admin/dashboard'); expect(getPostLoginRedirect('b2b_admin')).toBe('/parceiro');
    expect(getPostLoginRedirect(undefined)).toBe('/dashboard');
  });
});

describe('hook useSessaoExistente', () => {
  const h = read('src/hooks/useSessaoExistente.ts');
  it('começa «indefinido» (igual no servidor e na 1ª renderização) e decide antes da pintura, só no cliente', () => {
    expect(h).toContain("useState<EstadoSessao>('indefinido')"); expect(h).toContain('useLayoutEffect');
  });
  it('sem cookie de login: visitante, sem chamar o servidor; com cookie: confirma com fetchMe (a renovação é a do interceptor)', () => {
    expect(h).toMatch(/if \(!ativo \|\| !temCookieDeLogin\(\)\) \{ setEstado\('visitante'\); return; \}/);
    expect(h).toContain('useAuthStore.getState().fetchMe().finally(');
    expect(h).toMatch(/isAuthenticated && user\) \{ setRole\(user\.role \?\? null\); setEstado\('logado'\); \} else setEstado\('visitante'\)/);
  });
  it('só informa se o cookie existe; nunca devolve nem registra o valor', () => {
    expect(h).toMatch(/return !!\(Cookies\.get\('access_token'\) \|\| Cookies\.get\('refresh_token'\)\)/);
    expect(h).not.toMatch(/console\.|localStorage|sessionStorage|fetch\(|axios/);
  });
});

describe('login e cadastro: sessão válida redireciona sem mostrar o formulário', () => {
  const porta = read('src/components/auth/PortaDeEntrada.tsx');
  it('vai ao destino pretendido (next) ou ao destino por perfil, com replace', () => {
    expect(porta).toContain('router.replace(consumirProximaPagina() ?? getPostLoginRedirect(role))');
    expect(porta).toContain("if (ativo && estado === 'logado')");
  });
  it('enquanto confirma (ou já logado) mostra só um indicador; sem sessão, o formulário de sempre', () => {
    expect(porta).toMatch(/estado === 'verificando' \|\| estado === 'logado'\)[\s\S]*data-porta-de-entrada="verificando"/);
    expect(porta).toContain('return <>{children}</>;');
  });
  it('fluxos em andamento (erro, plano, contexto «achei») seguem como sempre', () => {
    expect(PARAMS_QUE_DESLIGAM).toEqual(['error', 'plan', 'de']);
    const q = (s: string) => new URLSearchParams(s);
    expect(deveRedirecionar(q(''))).toBe(true); expect(deveRedirecionar(q('next=%2Fdashboard%2Fmensagens'))).toBe(true);
    for (const s of ['error=oauth_denied', 'plan=pro', 'de=ABC12345']) expect(deveRedirecionar(q(s)), s).toBe(false);
    expect(deveRedirecionar(q('ref=feed'))).toBe(true); // origem do ícone de perfil do Feed: com sessão, redireciona
  });
  it('as duas portas usam o componente; o formulário não mudou', () => {
    for (const f of ['src/app/auth/login/page.tsx', 'src/app/auth/register/page.tsx']) {
      const s = read(f); expect(s, f).toContain("import { PortaDeEntrada } from '@/components/auth/PortaDeEntrada'"); expect(s, f).toMatch(/<PortaDeEntrada>\s*<(Login|Register)Form \/>\s*<\/PortaDeEntrada>/);
    }
    expect(read('src/app/auth/login/page.tsx')).toContain("consumirProximaPagina() ?? getPostLoginRedirect(user?.role)");
  });
  it('telas de conclusão do link por e-mail e do Google (consomem o token) não foram tocadas', () => {
    for (const f of ['src/app/auth/magic-confirm/page.tsx', 'src/app/auth/magic-success/page.tsx', 'src/app/auth/google-success/page.tsx']) expect(read(f)).not.toContain('PortaDeEntrada');
  });
});

describe('armazenamento persistente', () => {
  afterEach(() => vi.unstubAllGlobals());
  it('indisponível (sem navigator.storage ou sem persist): não faz nada e não lança erro', async () => {
    vi.stubGlobal('navigator', {}); expect(await pedirArmazenamentoPersistente()).toBe(false);
    vi.stubGlobal('navigator', { storage: {} }); expect(await pedirArmazenamentoPersistente()).toBe(false);
    vi.unstubAllGlobals(); // sem navigator (servidor)
    expect(await pedirArmazenamentoPersistente()).toBe(false);
  });
  it('persist() que falha ou nega: false, sem erro; que aceita: true', async () => {
    vi.stubGlobal('navigator', { storage: { persist: vi.fn().mockRejectedValue(new Error('x')) } }); expect(await pedirArmazenamentoPersistente()).toBe(false);
    vi.stubGlobal('navigator', { storage: { persist: vi.fn().mockResolvedValue(false) } }); expect(await pedirArmazenamentoPersistente()).toBe(false);
    const persist = vi.fn().mockResolvedValue(true); vi.stubGlobal('navigator', { storage: { persist } });
    expect(await pedirArmazenamentoPersistente()).toBe(true); expect(persist).toHaveBeenCalledTimes(1);
  });
  it('é pedido quando a sessão é confirmada (fetchMe com sucesso), sem perguntar nada ao usuário', () => {
    expect(read('src/hooks/useAuth.ts')).toMatch(/set\(\{ user: data, isAuthenticated: true \}\); void pedirArmazenamentoPersistente\(\); \}/);
    expect(read('src/lib/armazenamento.ts')).not.toMatch(/alert|confirm\(|prompt\(|toast/);
  });
});

describe('o que NÃO mudou', () => {
  it('nenhum arquivo novo envia dado a analítica (diagnóstico por evento NÃO implementado: o consentimento de rastreamento está pendente)', () => {
    for (const f of ['src/hooks/useSessaoExistente.ts', 'src/components/auth/PortaDeEntrada.tsx', 'src/lib/armazenamento.ts'])
      expect(read(f), f).not.toMatch(/analytics|posthog|gtag|fbq|clarity|sendBeacon/i);
  });
  it('cookies, validade e renovação intactos', () => {
    const api = read('src/lib/api.ts'); expect((api.match(/expires: 30, secure: process\.env\.NODE_ENV === 'production', sameSite: 'lax'/g) ?? []).length).toBe(2);
    expect(read('src/lib/authCookies.ts')).toContain('60 * 60 * 24 * 30');
  });
});
