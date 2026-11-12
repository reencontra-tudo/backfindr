// /flow/found: texto da linha abaixo do botão «Publicar achado agora» (decisão do Marcos, 12/11/2026).
// Sem promessa de contato protegido (Q-32) e sem o limite do plano grátis nesse texto.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';

const read = (rel: string) => readFileSync(path.join(__dirname, '..', rel), 'utf8');
const found = read('src/app/flow/found/client.tsx');
const visivel = (s: string) => s.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

describe('/flow/found: texto da linha abaixo do botão de publicar', () => {
  it('mostra exatamente «Gratuito. Publique seu achado agora.»', () => {
    expect(found).toMatch(/<p className="text-center text-white\/30 text-xs">\s*Gratuito\. Publique seu achado agora\.\s*<\/p>/);
    expect((found.match(/Gratuito\. Publique seu achado agora\./g) ?? []).length).toBe(1);
  });
  it('o texto antigo (promessa de contato não exposto) NÃO existe mais em nenhum arquivo do fluxo', () => {
    for (const f of ['src/app/flow/found/client.tsx', 'src/app/flow/found/page.tsx']) {
      const t = visivel(read(f));
      expect(t).not.toContain('Seu contato não fica exposto');
      expect(t).not.toMatch(/exposto publicamente/);
    }
  });
  it('o limite do plano grátis (3 objetos) e a cobrança NÃO aparecem no texto do fluxo', () => {
    const t = visivel(found);
    expect(t).not.toMatch(/\b3 objetos?\b|limite|Faça upgrade|plano (Gr[aá]tis|Pro)|R\$/i);
  });
  it('o botão e o resto do passo ficam como estavam', () => {
    expect(found).toContain('Publicar achado agora');
    expect(found).toContain('A conversa com o dono acontece pelo chat da plataforma.');
  });
  it('a página continua noindex e sem canonical próprio', () => {
    const p = read('src/app/flow/found/page.tsx');
    expect(p).toMatch(/robots:\s*'noindex'/);
    expect(p).not.toMatch(/canonical/);
  });
});
