// Ícone de perfil no topo do Feed: HTML do servidor igual para todos (indexável, funciona sem JS); só o cliente, depois de montar, troca o destino. Sem banco.
import { describe, expect, it } from 'vitest';
import React from 'react';
import { readFileSync } from 'fs';
import path from 'path';
import { renderToString } from 'react-dom/server';

(globalThis as unknown as { React: typeof React }).React = React;
const read = (rel: string) => readFileSync(path.join(__dirname, '..', rel), 'utf8');

import { PerfilIcone, PERFIL_HREF_VISITANTE } from '@/app/feed/PerfilIcone';
import { deveRedirecionar } from '@/components/auth/PortaDeEntrada';
import { getPostLoginRedirect } from '@/lib/redirectByRole';

describe('HTML do servidor do ícone (o mesmo para visitante e logado)', () => {
  const html = renderToString(React.createElement(PerfilIcone));
  it('é um link comum para /auth/login?ref=feed com nome acessível «Entrar» e só o ícone (sem texto visível)', () => {
    expect(html).toMatch(/<a [^>]*href="\/auth\/login\?ref=feed"/);
    expect(html).toContain('aria-label="Entrar"'); expect(html).toContain('data-feed-perfil="entrar"');
    expect(html).toMatch(/<svg[^>]*aria-hidden="true"/);
    expect(html.replace(/<svg[\s\S]*?<\/svg>/g, '').replace(/<[^>]+>/g, '').trim()).toBe('');
    expect(PERFIL_HREF_VISITANTE).toBe('/auth/login?ref=feed');
  });
  it('não depende de sessão no servidor: duas renderizações são idênticas e não há «Meu painel» no HTML', () => {
    expect(renderToString(React.createElement(PerfilIcone))).toBe(html);
    expect(html).not.toContain('Meu painel'); expect(html).not.toContain('data-feed-perfil="painel"');
  });
  it('área de toque 44×44 e foco visível', () => {
    expect(html).toMatch(/class="[^"]*\bh-11\b[^"]*\bw-11\b/); expect(html).toContain('focus-visible:ring-2');
  });
});

describe('estado logado só no cliente, com a lógica que já existia', () => {
  const src = read('src/app/feed/PerfilIcone.tsx');
  it('reusa useSessaoExistente e getPostLoginRedirect (sem lógica paralela de sessão)', () => {
    expect(src).toContain("import { useSessaoExistente } from '@/hooks/useSessaoExistente'");
    expect(src).toContain("import { getPostLoginRedirect } from '@/lib/redirectByRole'");
    expect(src).not.toMatch(/Cookies|localStorage|fetch\(|axios|fetchMe/);
  });
  it('logado → painel do perfil e «Meu painel»; indefinido/verificando/visitante → entrar', () => {
    expect(src).toContain("const logado = estado === 'logado';");
    expect(src).toContain('href={logado ? getPostLoginRedirect(role) : PERFIL_HREF_VISITANTE}');
    expect(src).toContain("aria-label={logado ? 'Meu painel' : 'Entrar'}");
    expect(getPostLoginRedirect('user')).toBe('/dashboard'); expect(getPostLoginRedirect('admin')).toBe('/admin/dashboard'); expect(getPostLoginRedirect('super_admin')).toBe('/admin/dashboard');
  });
  it('?ref=feed NÃO desativa o redirecionamento da tela de entrada (quem já tem sessão vai ao painel); erro, plano e «de» continuam desativando', () => {
    expect(deveRedirecionar(new URLSearchParams('ref=feed'))).toBe(true);
    for (const q of ['error=x', 'plan=pro', 'de=ABC']) expect(deveRedirecionar(new URLSearchParams(q)), q).toBe(false);
  });
  it('sem evento de rastreamento nem dado pessoal', () => { expect(src).not.toMatch(/analytics|feedEvents|posthog|gtag|fbq|clarity|\bemail\b|\bname\b/i); });
});

describe('topo do Feed', () => {
  const page = read('src/app/feed/[[...slug]]/page.tsx');
  it('o ícone é o ÚLTIMO item dos atalhos; nada foi removido nem movido (Mapa, Buscar, cadastro, Perdi/Encontrei)', () => {
    const nav = page.slice(page.indexOf('<nav aria-label="Atalhos"'), page.indexOf('</nav>'));
    expect(nav.indexOf('href="/map"')).toBeLessThan(nav.indexOf('href="/buscar"'));
    expect(nav.indexOf('href="/buscar"')).toBeLessThan(nav.indexOf('<RegisterMenu variant="header"'));
    expect(nav.indexOf('<RegisterMenu variant="header"')).toBeLessThan(nav.indexOf('<PerfilIcone />'));
    for (const t of ['<TopoBotoes pagina={page} />', '<RegisterMenu variant="fixed" pagina={page} />', 'Perdeu ou encontrou algo?']) expect(page).toContain(t);
  });
  it('topo respeita a área segura do iPhone; ordenação, filtros e a lista (FeedClient) não foram tocados', () => {
    expect(page).toContain('<header className="bf-topo-seguro border-b border-white/10">');
    expect(page).toContain('<FeedClient initialItems={pg.items}');
    expect(page).toContain("robots: page === 1 ? { index: true, follow: true } : { index: false, follow: true }");
  });
  it('FeedClient, FeedFoto e FeedCta não referenciam o ícone', () => {
    for (const f of ['src/app/feed/FeedClient.tsx', 'src/app/feed/FeedFoto.tsx', 'src/app/feed/FeedCta.tsx']) expect(read(f), f).not.toContain('PerfilIcone');
  });
});
