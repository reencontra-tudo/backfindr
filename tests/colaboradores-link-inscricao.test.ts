// Modo teste (PC-16, refinamento do fundador de 25/11/2026): o link/botão para `/colaborador/seja` existe SOMENTE no admin.
// Fora do admin só ficam: o retorno do formulário de inscrição (login/cadastro com `next=`) e o link de volta dentro da página de política.
import { describe, expect, it, vi } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import * as ReactNS from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const SRC = path.join(__dirname, '../src');
function arquivos(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => { const p = path.join(dir, n); return statSync(p).isDirectory() ? arquivos(p) : /\.(ts|tsx)$/.test(n) ? [p] : []; });
}
const rel = (p: string) => path.relative(path.join(__dirname, '..'), p).replace(/\\/g, '/');
const PERMITIDOS = new Set([
  'src/app/admin/colaboradores/page.tsx',                 // o único botão/link (modo teste)
  'src/app/colaborador/seja/page.tsx',                    // a própria página (só o comentário de cabeçalho)
  'src/app/colaborador/politica/page.tsx',                // «Voltar para a inscrição», dentro da política
  'src/components/colaboradores/FormularioInscricao.tsx', // retorno de login/cadastro (`next=/colaborador/seja`) dentro do formulário
]);

describe('link para /colaborador/seja: só no admin (modo teste, PC-16)', () => {
  it('nenhum outro arquivo do site aponta para /colaborador/seja', () => {
    const achados = arquivos(SRC).filter((f) => readFileSync(f, 'utf8').includes('/colaborador/seja')).map(rel).sort();
    expect(achados.filter((f) => !PERMITIDOS.has(f))).toEqual([]);
    expect(achados).toContain('src/app/admin/colaboradores/page.tsx');   // e o admin continua tendo o dele
  });

  it('o painel do usuário comum (/dashboard/colaborador) não tem mais o botão «Quero ser colaborador» nem link para a inscrição', () => {
    const src = readFileSync(path.join(SRC, 'app/dashboard/colaborador/page.tsx'), 'utf8');
    expect(src).not.toContain('/colaborador/seja');
    expect(src).not.toMatch(/Quero ser colaborador/i);
    expect(src).toContain('Você ainda não tem uma página de colaborador.');   // o aviso continua; só o botão saiu
  });

  it('o menu, o rodapé, o sitemap e o robots não citam a inscrição', () => {
    for (const f of ['app/sitemap.ts', 'app/robots.ts', 'middleware.ts', 'app/layout.tsx']) expect(readFileSync(path.join(SRC, f), 'utf8'), f).not.toContain('colaborador/seja');
    for (const f of arquivos(path.join(SRC, 'components')).filter((x) => /(Footer|Navbar|Header|Menu|Nav)/i.test(path.basename(x)))) expect(readFileSync(f, 'utf8'), rel(f)).not.toContain('colaborador/seja');
  });

  it('a tela do admin mostra «Abrir página de inscrição (modo teste)» apontando para /colaborador/seja', async () => {
    (globalThis as { React?: unknown }).React = ReactNS;
    vi.stubGlobal('fetch', () => new Promise(() => {}));   // nenhuma chamada de rede: a tela só é desenhada
    const Pagina = (await import('@/app/admin/colaboradores/page')).default as () => React.ReactElement;
    const html = renderToStaticMarkup(ReactNS.createElement(Pagina));
    expect(html).toContain('Abrir página de inscrição (modo teste)');
    expect(html).toMatch(/href="\/colaborador\/seja"/);
    expect(html).toContain('Só abre com a inscrição ligada');
    vi.unstubAllGlobals();
  });

  it('a página /colaborador/seja segue noindex e continua abrindo por endereço (código inalterado)', () => {
    const src = readFileSync(path.join(SRC, 'app/colaborador/seja/page.tsx'), 'utf8');
    expect(src).toContain('robots: { index: false, follow: false }');
    expect(src).toContain('inscricaoAtiva()');
  });
});
