// Programa de Colaboradores, E1: ajudantes do navegador (sem banco). Código na URL (?colab=) e em sessionStorage, nunca em cookie.
import { describe, it, expect } from 'vitest';
import { codigoDaUrl, codigoGuardado, codigoInicial, codigoValido, guardarCodigo, limparCodigoGuardado } from '@/lib/colaboradores/cliente';

const armazemFalso = () => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v); }, removeItem: (k: string) => { m.delete(k); }, m }; };

describe('formato do código', () => {
  it('aceita @nome e código curto; recusa o resto', () => {
    for (const ok of ['@backfindr', 'backfindr', 'ZL27', 'zl27', '@grupo-sp-1', 'ab']) expect(codigoValido(ok), ok).toBe(true);
    for (const ruim of ['', ' ', 'a', '@', '@@x', 'a b', 'ação', 'a_b', 'x'.repeat(31), '<script>', 'a.b', null, undefined, 5, {}]) expect(codigoValido(ruim as unknown), String(ruim)).toBe(false);
  });
});

describe('código vindo da URL', () => {
  it('lê só ?colab= e só se for válido', () => {
    expect(codigoDaUrl('?colab=ZL27')).toBe('ZL27');
    expect(codigoDaUrl('?x=1&colab=%40backfindr')).toBe('@backfindr');
    expect(codigoDaUrl('?colab=')).toBeNull();
    expect(codigoDaUrl('?colab=%3Cscript%3E')).toBeNull();
    expect(codigoDaUrl('?c=ZL27')).toBeNull();
    expect(codigoDaUrl(new URLSearchParams('colab=abc'))).toBe('abc');
  });
});

describe('sessionStorage (só a aba; nenhum cookie)', () => {
  it('guarda, lê e limpa; recusa valor inválido; sem armazém não quebra', () => {
    const a = armazemFalso();
    guardarCodigo('ZL27', a); expect(codigoGuardado(a)).toBe('ZL27');
    guardarCodigo('<x>', a); expect(codigoGuardado(a)).toBe('ZL27');
    limparCodigoGuardado(a); expect(codigoGuardado(a)).toBeNull();
    expect(() => { guardarCodigo('ZL27', null); limparCodigoGuardado(null); }).not.toThrow();
    expect(codigoGuardado(null)).toBeNull();
    const quebrado = { getItem: () => { throw new Error('x'); }, setItem: () => { throw new Error('x'); }, removeItem: () => { throw new Error('x'); } };
    expect(() => { guardarCodigo('ZL27', quebrado); limparCodigoGuardado(quebrado); }).not.toThrow();
    expect(codigoGuardado(quebrado)).toBeNull();
  });

  it('valor adulterado no armazém é ignorado', () => {
    const a = armazemFalso(); a.setItem('bf_colab', '<img onerror=x>');
    expect(codigoGuardado(a)).toBeNull();
  });
});

describe('código inicial do formulário', () => {
  it('DESLIGADO: sempre null, mesmo com ?colab= e com valor guardado', () => {
    const a = armazemFalso(); a.setItem('bf_colab', 'ZL27');
    expect(codigoInicial('?colab=ABCD', a, false)).toBeNull();
  });
  it('LIGADO: a URL tem prioridade; sem URL usa o guardado; sem nada, null', () => {
    const a = armazemFalso();
    expect(codigoInicial('', a, true)).toBeNull();
    a.setItem('bf_colab', 'ZL27');
    expect(codigoInicial('', a, true)).toBe('ZL27');
    expect(codigoInicial('?colab=@backfindr', a, true)).toBe('@backfindr');
  });
  it('o interruptor do navegador está DESLIGADO por padrão (variável ausente)', () => {
    expect(process.env.NEXT_PUBLIC_COLABORADORES_ATIVO).toBeUndefined();
    expect(codigoInicial('?colab=ZL27', armazemFalso())).toBeNull();
  });
});
