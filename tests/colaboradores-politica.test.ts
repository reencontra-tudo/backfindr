// A política que o produto mostra é a OFICIAL (docs/programa-colaboradores/POLITICA.md, aprovada pelo fundador em 23/11/2026): o texto do produto não pode divergir do documento.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { POLITICA_SECOES, POLITICA_VERSAO } from '@/content/politicaColaboradores';

const md = readFileSync('docs/programa-colaboradores/POLITICA.md', 'utf8').replace(/\\\[/g, '[').replace(/\\\]/g, ']');

describe('política oficial no produto', () => {
  it('as 9 seções e a versão', () => { expect(POLITICA_SECOES.length).toBe(9); expect(POLITICA_VERSAO).toBe('2026-11-23'); });
  it('todo texto do produto aparece literalmente no documento oficial (nada inventado)', () => {
    for (const s of POLITICA_SECOES) { expect(md).toContain(s.titulo); for (const b of s.blocos) expect(md, b.texto.slice(0, 80)).toContain(b.texto); }
  });
  it('todo parágrafo, item e caixa do documento oficial está no produto (nada omitido)', () => {
    const texto = POLITICA_SECOES.flatMap((s) => s.blocos.map((b) => b.texto)).join('\n');
    const linhas = md.split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('>') && !l.startsWith('#') && !/^Nov \d+, \d{4}/.test(l));
    for (const l of linhas) { const sem = l.replace(/^- \[ \] /, '').replace(/^- /, '').replace(/^\d+\.\s+/, ''); expect(texto, sem.slice(0, 80)).toContain(sem); }
  });
  it('pontos que o produto depende: 25 %, R$ 50, 10 dias úteis, 12 meses, sem dado de contato', () => {
    const t = JSON.stringify(POLITICA_SECOES); for (const f of ['25%', 'R$ 50', '10 dias úteis', '12 meses', 'sem dados de contato']) expect(t).toContain(f);
  });
});
