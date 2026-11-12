// Fluxos de PERDIDO (/flow/lost, bike, keys, phone, vehicle, wallet): texto abaixo do botão «Publicar alerta agora».
// Decisão do Marcos (mesma regra do /flow/found): sem promessa de contato protegido (Q-32), «Gratuito» fica,
// o limite do plano grátis não aparece nesse texto.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';

const read = (rel: string) => readFileSync(path.join(__dirname, '..', rel), 'utf8');
const semComentarios = (s: string) => s.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const FLUXOS = ['lost', 'bike', 'keys', 'phone', 'vehicle', 'wallet'] as const;
const NOVO = 'Gratuito. Publique seu alerta agora.';

describe.each(FLUXOS)('/flow/%s: texto abaixo do botão de publicar', (f) => {
  const src = read(`src/app/flow/${f}/client.tsx`);
  it('mostra exatamente «Gratuito. Publique seu alerta agora.» (uma vez), logo abaixo do botão «Publicar alerta agora»', () => {
    expect((src.match(/Gratuito\. Publique seu alerta agora\./g) ?? []).length).toBe(1);
    const i = src.indexOf(NOVO), j = src.lastIndexOf('Publicar alerta agora', i);
    expect(j).toBeGreaterThan(-1);
    expect(i - j).toBeLessThan(400);
  });
  it('o texto antigo (contato não exposto) não existe mais no fluxo', () => {
    for (const file of [`src/app/flow/${f}/client.tsx`, `src/app/flow/${f}/page.tsx`]) {
      const t = semComentarios(read(file));
      expect(t).not.toContain('Seu contato não fica exposto');
      expect(t).not.toMatch(/exposto publicamente/);
    }
  });
  it('o limite do plano grátis e a cobrança não aparecem no texto', () => {
    const linha = src.split('\n').find((l) => l.includes(NOVO)) ?? '';
    expect(linha).not.toMatch(/\b3 objetos?\b|limite|upgrade|plano|R\$/i);
  });
  it('a página continua noindex e sem canonical próprio', () => {
    const p = read(`src/app/flow/${f}/page.tsx`);
    expect(p).toMatch(/robots:\s*'noindex'/);
    expect(p).not.toMatch(/canonical/);
  });
});

describe('o resto não mudou', () => {
  it('nenhum texto antigo em lugar nenhum do código (src)', () => {
    const achados: string[] = [];
    const walk = (dir: string) => {
      for (const e of require('fs').readdirSync(path.join(__dirname, '..', dir), { withFileTypes: true })) {
        const rel = `${dir}/${e.name}`;
        if (e.isDirectory()) walk(rel);
        else if (/\.(tsx?|jsx?)$/.test(e.name) && read(rel).includes('Seu contato não fica exposto publicamente')) achados.push(rel);
      }
    };
    walk('src');
    expect(achados).toEqual([]);
  });
  it('found, pet, protect e stolen mantêm os textos que já tinham', () => {
    expect(read('src/app/flow/found/client.tsx')).toContain('Gratuito. Publique seu achado agora.');
    expect(read('src/app/flow/pet/client.tsx')).toContain('Gratuito. A conversa acontece pelo chat da plataforma.');
    expect(read('src/app/flow/protect/client.tsx')).toContain('Gratuito. Você gerencia todos os seus itens protegidos em um só lugar.');
    expect(read('src/app/flow/stolen/client.tsx')).toContain('Gratuito. Você será notificado se o item aparecer na rede.');
    for (const f of ['found', 'pet', 'protect', 'stolen']) expect(read(`src/app/flow/${f}/client.tsx`)).not.toContain('Publique seu alerta agora');
  });
  it('o passo 2 (strict=1) continua nos dois fluxos que o usam e não foi para os outros', () => {
    for (const f of ['lost', 'found']) expect(read(`src/app/flow/${f}/client.tsx`)).toContain("params.set('strict', '1')");
    for (const f of ['bike', 'keys', 'phone', 'vehicle', 'wallet', 'pet', 'stolen']) expect(read(`src/app/flow/${f}/client.tsx`), f).not.toContain('strict');
  });
  it('nenhum fluxo novo', () => {
    expect(require('fs').readdirSync(path.join(__dirname, '../src/app/flow')).sort()).toEqual(['bike', 'found', 'keys', 'lost', 'pet', 'phone', 'protect', 'stolen', 'vehicle', 'wallet']);
  });
});
