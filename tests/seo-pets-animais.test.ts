// PR (c): SEO opção A (decisão do fundador, 24/11/2026): manter os números (animal soma em pet) e mostrar o texto «Pets e animais» nas listas.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (p: string) => readFileSync(p, 'utf8');
const CAT = 'src/app/achados-perdidos/[cidade]/[categoria]/page.tsx';

describe('SEO opção A', () => {
  it('os números NÃO mudam: refresh-stats continua somando animal e pet no slug «pet»', () => {
    expect(read('src/app/api/v1/admin/municipalities/refresh-stats/route.ts')).toContain("WHEN o.category IN ('pet', 'animal') THEN 'pet'");
  });
  it('os endereços (slug «pet») não mudam', () => {
    expect(read('src/app/achados-perdidos/page.tsx')).toContain("slug: 'pet', label: 'Pets e animais'");
    expect(read('src/app/achados-perdidos/[cidade]/page.tsx')).toMatch(/slug: 'pet',\s+label: 'Pets e animais'/);
  });
  it('listas e caminho de navegação mostram «Pets e animais»', () => {
    const s = read(CAT);
    expect(s).toContain("nome: 'Pets e animais'");
    expect(s).toContain('{cat.nome ?? cat.label}');
    expect(s).toContain('{info.nome ?? info.label}');
  });
  it('títulos e frases da página da categoria NÃO mudam (continuam com «Pet»)', () => {
    const s = read(CAT);
    expect(s).toContain("pet:       { label: 'Pet', ");
    expect(s).toContain('title: `${cat?.label ?? params.categoria} Perdido em ${city.name}`');
    expect(s).toContain('`Perdi um ${cat.label.toLowerCase()}`');
    expect(s).toContain('O que fazer quando seu pet desaparece em ${city.name}');
  });
  it('as demais categorias ficam como estavam (sem `nome`)', () => {
    const s = read(CAT);
    expect((s.match(/nome:/g) ?? []).length).toBe(1);
  });
});
