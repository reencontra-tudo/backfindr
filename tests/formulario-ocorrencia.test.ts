// «Registrar Ocorrência» (/dashboard/objects/new): intent define o status (Status não é perguntado), descrição pré-preenchida e envio inválido nunca silencioso. Sem banco.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';

import {
  DESCRICAO_MIN, PASSO_CATEGORIA, PASSO_DETALHES, PASSO_LOCALIZACAO, PASSO_STATUS, descricaoDoTitulo, passoAnterior, passoInicial, proximoPasso, resumirErros, statusDefinidoPeloIntent,
} from '@/lib/formularioOcorrencia';

const page = readFileSync(path.join(__dirname, '..', 'src/app/dashboard/objects/new/page.tsx'), 'utf8');
const mapa = page.slice(page.indexOf('const INTENT_MAP'), page.indexOf('};', page.indexOf('const INTENT_MAP')));
const PRESETS = {
  lost: { status: 'lost', startStep: 1, mode: 'report' as const }, found: { status: 'found', startStep: 1, mode: 'report' as const },
  stolen: { status: 'stolen', startStep: 1, mode: 'report' as const }, protect: { status: 'protected', startStep: 0, mode: 'protect' as const },
  pet: { category: 'pet', status: 'lost', startStep: 1, mode: 'report' as const },
};

describe('presets do formulário (a página não mudou o INTENT_MAP)', () => {
  it('as 5 intenções continuam com os mesmos valores', () => {
    for (const [k, v] of Object.entries(PRESETS)) {
      const linha = mapa.split('\n').find((l) => new RegExp(`^\\s{2}${k}:`).test(l))!;
      expect(linha, k).toContain(`status: '${v.status}'`); expect(linha, k).toContain(`startStep: ${v.startStep}`); expect(linha, k).toContain(`mode: '${v.mode}'`);
    }
  });
});

describe('passo inicial e navegação', () => {
  it('found/lost/stolen SEM categoria do fluxo: abre na Categoria (não em Status); COM categoria (keys, wallet, vehicle, phone, bike): direto em Detalhes', () => {
    for (const i of ['found', 'lost', 'stolen'] as const) { expect(passoInicial(PRESETS[i], false), i).toBe(PASSO_CATEGORIA); expect(passoInicial(PRESETS[i], true), i).toBe(PASSO_DETALHES); }
    expect(passoInicial(PRESETS.pet, false)).toBe(PASSO_DETALHES);                                    // o preset já traz a categoria
  });
  it('o intent define o status: o passo Status nunca é perguntado (ida e volta)', () => {
    expect(statusDefinidoPeloIntent(PRESETS.found)).toBe(true);
    expect(proximoPasso(PASSO_CATEGORIA, 'report', true)).toBe(PASSO_DETALHES); expect(proximoPasso(PASSO_DETALHES, 'report', true)).toBe(PASSO_LOCALIZACAO);
    expect(passoAnterior(PASSO_DETALHES, 'report', true)).toBe(PASSO_CATEGORIA); expect(passoAnterior(PASSO_LOCALIZACAO, 'report', true)).toBe(PASSO_DETALHES);
    expect(proximoPasso(PASSO_LOCALIZACAO, 'report', true)).toBe(PASSO_LOCALIZACAO);                 // não passa do último
  });
  it('modo protect: idêntico a hoje (abre na Categoria, pula o Status)', () => {
    expect(statusDefinidoPeloIntent(PRESETS.protect)).toBe(false);                                      // mode protect: o pulo vem do modo, como antes
    expect(passoInicial(PRESETS.protect, true)).toBe(0); expect(passoInicial(PRESETS.protect, false)).toBe(0);
    expect(proximoPasso(0, 'protect', false)).toBe(2); expect(passoAnterior(2, 'protect', false)).toBe(0);
  });
  it('o «+» (sem intent): idêntico a hoje (Categoria → Status → Detalhes → Localização, e volta)', () => {
    expect(statusDefinidoPeloIntent({})).toBe(false); expect(passoInicial({}, false)).toBe(0); expect(passoInicial({}, true)).toBe(0);
    expect([0, 1, 2].map((p) => proximoPasso(p, 'report', false))).toEqual([1, 2, 3]); expect([3, 2, 1].map((p) => passoAnterior(p, 'report', false))).toEqual([2, 1, 0]);
    expect(proximoPasso(3, 'report', false)).toBe(3); expect(passoAnterior(0, 'report', false)).toBe(0);
  });
});

describe('descrição pré-preenchida', () => {
  it('título de 10+ caracteres vira a descrição (editável); menos de 10, vazia', () => {
    expect(DESCRICAO_MIN).toBe(10);
    expect(descricaoDoTitulo('Achei um molho de chaves na rua Itapura')).toBe('Achei um molho de chaves na rua Itapura');
    expect(descricaoDoTitulo('  Chaves perdidas — molho  ')).toBe('Chaves perdidas — molho');
    expect(descricaoDoTitulo('carro Gol')).toBe(''); expect(descricaoDoTitulo('123456789')).toBe(''); expect(descricaoDoTitulo('1234567890')).toBe('1234567890'); expect(descricaoDoTitulo('')).toBe('');
  });
  it('só vale com intent (veio de um fluxo); o mínimo do schema (10) e o servidor NÃO mudaram', () => {
    expect(page).toContain("if (intent && prefillTitle && descricaoDoTitulo(prefillTitle)) setValue('description', descricaoDoTitulo(prefillTitle));");
    expect(page).toContain("description: z.string().min(10, 'Descrição muito curta').max(2000)");
    expect(page).toContain("category: z.string().min(1, 'Selecione uma categoria')");
    expect(readFileSync(path.join(__dirname, '..', 'src/app/api/v1/objects/route.ts'), 'utf8')).not.toContain('formularioOcorrencia');
  });
});

describe('envio inválido nunca é silencioso', () => {
  const e = (...c: string[]) => Object.fromEntries(c.map((k) => [k, { message: 'x' }]));
  it('sem categoria → passo Categoria e «Falta escolher a categoria»', () => {
    const r = resumirErros(e('category'), 'report', true); expect(r.passo).toBe(PASSO_CATEGORIA); expect(r.mensagens).toEqual(['Falta escolher a categoria']); expect(r.campoParaFocar).toBeNull();
  });
  it('descrição curta → Detalhes, aviso com o mínimo e foco na descrição', () => {
    const r = resumirErros(e('description'), 'report', true); expect(r.passo).toBe(PASSO_DETALHES); expect(r.mensagens).toEqual(['Falta a descrição (mínimo 10 letras)']); expect(r.campoParaFocar).toBe('description');
  });
  it('vários erros: vai ao PRIMEIRO passo com erro e lista tudo na ordem dos passos', () => {
    const r = resumirErros(e('description', 'category', 'title'), 'report', true);
    expect(r.passo).toBe(PASSO_CATEGORIA); expect(r.mensagens).toEqual(['Falta escolher a categoria', 'Falta o título (mínimo 3 letras)', 'Falta a descrição (mínimo 10 letras)']);
    expect(resumirErros(e('title', 'description'), 'report', true).campoParaFocar).toBe('title');
  });
  it('status faltando: no «+» leva ao passo Status; em protect ou com intent (Status nunca é perguntado) leva à Categoria', () => {
    expect(resumirErros(e('status'), 'report', false).passo).toBe(PASSO_STATUS);
    expect(resumirErros(e('status'), 'report', true).passo).toBe(PASSO_CATEGORIA); expect(resumirErros(e('status'), 'protect', false).passo).toBe(PASSO_CATEGORIA);
  });
  it('campo extra (pet, documento, recompensa) leva a Detalhes; localização ao último passo; sem erro nenhum não quebra', () => {
    expect(resumirErros(e('pet_breed'), 'report', false).passo).toBe(PASSO_DETALHES); expect(resumirErros(e('reward_amount'), 'protect', false).passo).toBe(PASSO_DETALHES);
    expect(resumirErros(e('address'), 'report', false).passo).toBe(PASSO_LOCALIZACAO); expect(resumirErros({}, 'report', false)).toEqual({ passo: PASSO_DETALHES, mensagens: [], campoParaFocar: null });
  });
  it('a página liga o onInvalid em TODOS os modos (protect e report), mostra o aviso (role=alert) e rola/foca; sem texto digitado em log nem rastreamento', () => {
    expect(page).toContain('onSubmit={handleSubmit(onSubmit, onInvalid)}'); expect(page).toContain('const onInvalid = (erros');
    expect(page).toContain('role="alert" data-form-aviso'); expect(page).toContain("scrollIntoView({ block: 'center', behavior: 'smooth' })"); expect(page).toContain('setFocus(focoPendente)');
    expect(page).not.toMatch(/console\.(log|error|warn)\(/); expect(readFileSync(path.join(__dirname, '..', 'src/lib/formularioOcorrencia.ts'), 'utf8')).not.toMatch(/analytics|posthog|gtag|fbq|console\./);
    expect(page).toContain('const nextStep = () => setStep((s) => proximoPasso(s, mode, statusDoIntent));');
  });
});
