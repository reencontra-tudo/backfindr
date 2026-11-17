// gerarToken (links de custódia "cst_" e entrega "dlv_") usa gerador criptográfico, mantendo o formato:
// prefixo + 32 caracteres do alfabeto sem caracteres ambíguos.
//
//   npx vitest run --config tests/vitest.config.ts tests/gerar-token.test.ts
import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';

vi.mock('@/lib/db', () => ({ query: vi.fn() }));
vi.mock('@/lib/pushNotification', () => ({ sendPushToUser: vi.fn() }));

import { gerarToken, ALFABETO_TOKEN } from '@/lib/notifyModulos';

describe('gerarToken', () => {
  it.each(['cst_', 'dlv_', ''])('mantém o formato com prefixo "%s"', (p) => {
    const t = gerarToken(p);
    expect(t.startsWith(p)).toBe(true);
    expect(t.slice(p.length)).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789]{32}$/);
    expect(t.length).toBe(p.length + 32);
  });

  it('não repete em 5000 gerações', () => {
    const s = new Set(Array.from({ length: 5000 }, () => gerarToken('x_')));
    expect(s.size).toBe(5000);
  });

  it('usa todo o alfabeto (sem viés grosseiro)', () => {
    const vistos = new Set(Array.from({ length: 2000 }, () => gerarToken()).join(''));
    expect([...vistos].sort().join('')).toBe([...ALFABETO_TOKEN].sort().join(''));
  });

  it('não depende de Math.random', () => {
    const spy = vi.spyOn(Math, 'random');
    gerarToken('cst_');
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
    const src = readFileSync(path.resolve(__dirname, '../src/lib/notifyModulos.ts'), 'utf8');
    const corpo = src.slice(src.indexOf('export function gerarToken'), src.indexOf('export function gerarQrCode'));
    expect(corpo).not.toContain('Math.random');
  });
});
