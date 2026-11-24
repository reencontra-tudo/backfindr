// PR (b): listas de admin, relatórios e busca do painel com «Animal» (decisão do fundador, 24/11/2026).
// Regra: Animal = animal + pet; Pet = só pet; as demais categorias continuam IGUAIS (só a própria).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { categoriasDaLista } from '@/lib/categorias';

const read = (p: string) => readFileSync(p, 'utf8');

describe('categoriasDaLista', () => {
  it('Animal inclui Pet', () => expect(categoriasDaLista('animal').sort()).toEqual(['animal', 'pet']));
  it('Pet mostra só pet', () => expect(categoriasDaLista('pet')).toEqual(['pet']));
  it('as demais ficam iguais (inclusive Eletrônico, que NÃO inclui Celular nas listas)', () => {
    for (const c of ['phone', 'electronics', 'vehicle', 'wallet', 'keys', 'bike', 'document', 'bag', 'jewelry', 'clothing', 'other', 'book', 'xyz'])
      expect(categoriasDaLista(c)).toEqual([c]);
  });
});

describe('servidor usa a regra nos 3 filtros', () => {
  for (const f of ['src/app/api/v1/admin/objects/route.ts', 'src/app/api/v1/admin/reports/export/route.ts', 'src/app/api/v1/objects/public/route.ts']) {
    it(f, () => {
      const s = read(f);
      expect(s).toContain("from '@/lib/categorias'");
      expect(s).toContain('categoriasDaLista(category)');
      expect(s).toContain('ANY(');
    });
  }
});

describe('telas têm a opção Animal antes de Pet', () => {
  for (const f of ['src/app/admin/objects/page.tsx', 'src/app/admin/relatorios/page.tsx', 'src/app/dashboard/search/page.tsx']) {
    it(f, () => {
      const s = read(f);
      const a = s.indexOf("value: 'animal'"), p = s.indexOf("value: 'pet'");
      expect(a).toBeGreaterThan(-1);
      expect(a).toBeLessThan(p);
    });
  }
});
