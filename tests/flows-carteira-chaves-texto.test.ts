// Fluxos de carteira e de chaves: sem promessa de segurança nem de contato não exposto (Q-32).
// Fórmula aceita: «a conversa acontece pelo chat da plataforma». Mesma regra dos fluxos found e dos 6 de perdido.
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'fs';
import path from 'path';

const read = (rel: string) => readFileSync(path.join(__dirname, '..', rel), 'utf8');
const semComentarios = (s: string) => s.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const wallet = read('src/app/flow/wallet/client.tsx');
const keys = read('src/app/flow/keys/client.tsx');

describe('/flow/wallet', () => {
  it('passo 1: «Registre agora. Quem encontrou pode te devolver.» (uma vez, sem o trecho de segurança)', () => {
    expect((wallet.match(/Registre agora\. Quem encontrou pode te devolver\./g) ?? []).length).toBe(1);
  });
  it('sem «com segurança» nem «sem expor seu número» no fluxo', () => {
    const t = semComentarios(wallet);
    expect(t).not.toMatch(/com seguran[çc]a/i);
    expect(t).not.toMatch(/sem expor/i);
  });
  it('a fórmula já aceita continua exatamente como estava (passo 3)', () => {
    expect(wallet).toContain('Conta gratuita em segundos. Quem encontrar sua carteira pode te devolver — a conversa acontece pelo chat da plataforma.');
  });
});

describe('/flow/keys', () => {
  it('passo 1: «Registre em 30 segundos. Quem achar pode te devolver.» (uma vez)', () => {
    expect((keys.match(/Registre em 30 segundos\. Quem achar pode te devolver\./g) ?? []).length).toBe(1);
  });
  it('passo 3: «Conta gratuita em segundos. Quem achar suas chaves pode te devolver pelo chat.» (uma vez; «pelo chat» fica)', () => {
    expect((keys.match(/Conta gratuita em segundos\. Quem achar suas chaves pode te devolver pelo chat\./g) ?? []).length).toBe(1);
  });
  it('sem «com segurança» no fluxo', () => {
    expect(semComentarios(keys)).not.toMatch(/com seguran[çc]a/i);
  });
});

describe('o resto não mudou', () => {
  it('os avisos de notificação continuam como estavam', () => {
    expect(keys).toContain('Quando alguém reportar chaves parecidas, você é avisado na hora.');
    expect(wallet).toContain('Quando alguém reportar uma carteira parecida, você é avisado na hora.');
  });
  it('o texto dos 6 fluxos de perdido e do found continua o da etapa anterior', () => {
    for (const f of ['lost', 'bike', 'keys', 'phone', 'vehicle', 'wallet']) expect(read(`src/app/flow/${f}/client.tsx`), f).toContain('Gratuito. Publique seu alerta agora.');
    expect(read('src/app/flow/found/client.tsx')).toContain('Gratuito. Publique seu achado agora.');
  });
  it('a fórmula aceita do componente compartilhado segue igual', () => {
    expect(read('src/components/flow/FlowLayout.tsx')).toContain('A conversa acontece pelo chat da plataforma.');
  });
  it('os demais fluxos não foram tocados: lost, bike, phone, vehicle, found, pet, protect, stolen não ganham nem perdem as frases de segurança que já tinham', () => {
    // vehicle e phone não tinham «com segurança»; nenhum outro fluxo ganhou o trecho
    for (const f of ['lost', 'bike', 'phone', 'vehicle', 'found', 'pet', 'protect', 'stolen']) expect(semComentarios(read(`src/app/flow/${f}/client.tsx`)), f).not.toMatch(/com seguran[çc]a/i);
  });
  it('o passo 2 (strict=1) continua só em found e lost', () => {
    for (const f of ['lost', 'found']) expect(read(`src/app/flow/${f}/client.tsx`)).toContain("params.set('strict', '1')");
    for (const f of ['bike', 'keys', 'phone', 'vehicle', 'wallet', 'pet', 'stolen']) expect(read(`src/app/flow/${f}/client.tsx`), f).not.toContain('strict');
  });
  it('wallet e keys continuam noindex, sem canonical próprio', () => {
    for (const f of ['wallet', 'keys']) {
      const p = read(`src/app/flow/${f}/page.tsx`);
      expect(p, f).toMatch(/robots:\s*'noindex'/);
      expect(p, f).not.toMatch(/canonical/);
    }
  });
  it('nenhum fluxo novo', () => {
    expect(readdirSync(path.join(__dirname, '../src/app/flow')).sort()).toEqual(['bike', 'found', 'keys', 'lost', 'pet', 'phone', 'protect', 'stolen', 'vehicle', 'wallet']);
  });
});
