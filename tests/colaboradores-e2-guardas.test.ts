// Programa de Colaboradores, E2: guardas de segurança do piloto.
//  1) os DOIS interruptores devem andar juntos: aviso no admin quando diferentes, sem mudar nada quando iguais;
//  2) o gatilho da migration 026 só age sobre as colunas do programa (nenhum custo nem risco para UPDATEs normais de ocorrências);
//  3) PC-04: nenhuma página nem menu do site geral aponta para `/@nome` ou para a página do colaborador.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'fs';
import path from 'path';
import { NextRequest, NextResponse } from 'next/server';
import { renderToStaticMarkup } from 'react-dom/server';
import * as ReactNs from 'react';
import { Pool } from 'pg';
import { estadoInterruptores, lerInterruptores, textoDoAviso } from '@/lib/colaboradores/interruptores';

(globalThis as unknown as { React: unknown }).React = ReactNs;

const adminOk = { id: 'a1', role: 'admin' };
let autenticado = true;
vi.mock('@/lib/adminGuard', () => ({
  requireAdmin: async () => (autenticado ? adminOk : NextResponse.json({ detail: 'Não autenticado' }, { status: 401 })),
}));

afterEach(() => { delete process.env.COLABORADORES_ATIVO; delete process.env.NEXT_PUBLIC_COLABORADORES_ATIVO; autenticado = true; });

describe('1) interruptores: sempre juntos', () => {
  it('estado e texto do aviso', () => {
    expect(estadoInterruptores(false, false)).toEqual({ servidor: false, navegador: false, divergente: false });
    expect(estadoInterruptores(true, true)).toEqual({ servidor: true, navegador: true, divergente: false });
    expect(estadoInterruptores(true, false).divergente).toBe(true);
    expect(estadoInterruptores(false, true).divergente).toBe(true);
    expect(textoDoAviso(estadoInterruptores(true, false))).toMatch(/servidor: ligado; navegador: desligado/);
    expect(textoDoAviso(estadoInterruptores(false, true))).toMatch(/servidor: desligado; navegador: ligado/);
  });

  it('lê os dois interruptores do ambiente (só «1» liga)', () => {
    expect(lerInterruptores()).toEqual({ servidor: false, navegador: false, divergente: false });
    process.env.COLABORADORES_ATIVO = '1';
    expect(lerInterruptores()).toEqual({ servidor: true, navegador: false, divergente: true });
    process.env.NEXT_PUBLIC_COLABORADORES_ATIVO = '1';
    expect(lerInterruptores()).toEqual({ servidor: true, navegador: true, divergente: false });
    process.env.COLABORADORES_ATIVO = 'true';
    expect(lerInterruptores().servidor).toBe(false);
  });

  it('rota do admin: 401 sem login; com login devolve o estado, sem cache', async () => {
    const { GET } = await import('@/app/api/v1/admin/colaboradores/interruptores/route');
    const req = () => new NextRequest('http://localhost/api/v1/admin/colaboradores/interruptores');
    autenticado = false;
    expect((await GET(req())).status).toBe(401);
    autenticado = true;
    process.env.COLABORADORES_ATIVO = '1';
    const r = await GET(req());
    expect(r.status).toBe(200);
    expect(r.headers.get('cache-control')).toBe('no-store');
    expect(await r.json()).toEqual({ servidor: true, navegador: false, divergente: true });
  });

  it('o componente do aviso NÃO renderiza nada na primeira pintura (o painel fica idêntico ao de antes)', async () => {
    const { default: Aviso } = await import('@/components/colaboradores/AvisoInterruptores');
    expect(renderToStaticMarkup(ReactNs.createElement(Aviso))).toBe('');
  });

  it('o painel só ganha o componente do aviso e nada mais no <main> (alteração mínima no layout do admin)', () => {
    const src = readFileSync(path.join(__dirname, '../src/app/admin/layout.tsx'), 'utf8');
    expect(src).toContain("import AvisoInterruptores from '@/components/colaboradores/AvisoInterruptores';");
    expect(src).toMatch(/<main className="flex-1 overflow-auto">\s*\{\/\*[^]*?\*\/\}\s*<AvisoInterruptores \/>\s*\{children\}\s*<\/main>/);
  });
});

const TEST_DB = process.env.TEST_DATABASE_URL;
describe.skipIf(!TEST_DB)('2) gatilho da migration 026: só age sobre as colunas do programa', () => {
  const MIGRATION = readFileSync(path.join(__dirname, '../src/db/migrations/026_colaboradores.sql'), 'utf8');
  it('UPDATEs normais de objects nem consideram o gatilho; só mexer nas colunas do programa o aciona, e só se o valor mudar', async () => {
    const pool = new Pool({ connectionString: TEST_DB });
    const c = await pool.connect();
    try {
      await c.query('DROP TABLE IF EXISTS objects, colaboradores, users CASCADE');
      await c.query('CREATE TABLE users (id uuid PRIMARY KEY)');
      await c.query(`CREATE TABLE objects (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid, title text, status text, description text, images jsonb DEFAULT '[]', is_boosted boolean DEFAULT false, boost_expires_at timestamptz, category_fields jsonb, found_pending_confirmation boolean, updated_at timestamptz)`);
      await c.query(MIGRATION);
      const col = (await c.query(`INSERT INTO colaboradores (slug, codigo_curto, nome) VALUES ('grupo-sp','HX7R','Grupo SP') RETURNING id`)).rows[0].id;
      const o1 = (await c.query(`INSERT INTO objects (title, status) VALUES ('a','lost') RETURNING id`)).rows[0].id;
      const o2 = (await c.query(`INSERT INTO objects (title, status, colaborador_id, colaborador_codigo) VALUES ('b','lost',$1,'HX7R') RETURNING id`, [col])).rows[0].id;
      const chamadas = async () => Number((await c.query(`SELECT COALESCE(sum(calls),0) AS n FROM pg_stat_xact_user_functions WHERE funcname = 'objects_colaborador_imutavel'`)).rows[0].n);

      await c.query('BEGIN');
      await c.query(`SET LOCAL track_functions = 'all'`);
      // Os mesmos tipos de UPDATE que o código faz hoje: status, edição, boost, matching/aviso, imagens, categoria, descrição, busca.
      for (const o of [o1, o2]) {
        await c.query(`UPDATE objects SET status = 'found', updated_at = NOW() WHERE id = $1`, [o]);
        await c.query(`UPDATE objects SET title = 'novo', description = 'x', category_fields = '{}'::jsonb, updated_at = NOW() WHERE id = $1`, [o]);
        await c.query(`UPDATE objects SET is_boosted = true, boost_expires_at = NOW() + interval '7 days' WHERE id = $1`, [o]);
        await c.query(`UPDATE objects SET found_pending_confirmation = true WHERE id = $1`, [o]);
        await c.query(`UPDATE objects SET images = '[]' WHERE id = $1`, [o]);
      }
      expect(await chamadas()).toBe(0);                                   // a função do gatilho NUNCA foi executada
      await c.query(`UPDATE objects SET colaborador_id = colaborador_id, colaborador_codigo = colaborador_codigo WHERE id = $1`, [o2]);
      expect(await chamadas()).toBe(0);                                   // listar as colunas sem mudar o valor também não executa a função (cláusula WHEN)
      await c.query('SAVEPOINT s');
      await expect(c.query(`UPDATE objects SET colaborador_codigo = 'OUTRO' WHERE id = $1`, [o2])).rejects.toThrow(/não podem mudar/);
      await c.query('ROLLBACK TO s');
      // (a mudança real executa a função: ela levanta o erro acima; as contagens de um ponto de retorno desfeito não são mantidas pelo Postgres)
      await c.query('ROLLBACK');

      // O gatilho está definido por colunas (UPDATE OF) e com condição (WHEN): é isso que garante que UPDATEs normais não o consideram.
      const def = (await c.query(`SELECT pg_get_triggerdef(oid) AS d FROM pg_trigger WHERE tgname = 'trg_objects_colaborador_imutavel'`)).rows[0].d as string;
      expect(def).toMatch(/BEFORE UPDATE OF colaborador_id, colaborador_codigo ON/);
      expect(def).toMatch(/WHEN .*IS DISTINCT FROM/);
      // Nenhum gatilho de INSERT ou DELETE em objects foi criado pela migration.
      const tipos = (await c.query(`SELECT tgtype FROM pg_trigger WHERE tgrelid = 'objects'::regclass AND NOT tgisinternal`)).rows.map((r) => Number(r.tgtype));
      expect(tipos.length).toBe(1);
      expect(tipos[0] & 4).toBe(0);                                       // bit 4 = INSERT
      expect(tipos[0] & 8).toBe(0);                                       // bit 8 = DELETE
      expect(tipos[0] & 16).toBe(16);                                     // bit 16 = UPDATE
    } finally { c.release(); await pool.end(); }
  });
});

describe('3) PC-04: nada do site geral aponta para as páginas de colaborador', () => {
  const RAIZ = path.join(__dirname, '../src');
  const todos = (d: string): string[] => readdirSync(d).flatMap((n) => { const p = path.join(d, n); return statSync(p).isDirectory() ? todos(p) : /\.(ts|tsx)$/.test(n) ? [p] : []; });
  const PERMITIDOS = ['app/colaborador/', 'lib/colaboradores/', 'lib/clarity.ts', 'middleware.ts'];
  it('só os arquivos do programa (e o middleware e a lista do Clarity) citam `/@` ou `/colaborador`', () => {
    const citam = todos(RAIZ).filter((f) => /['"`]\/@|\/colaborador['"`/]/.test(readFileSync(f, 'utf8'))).map((f) => path.relative(RAIZ, f).split(path.sep).join('/'));
    const fora = citam.filter((f) => !PERMITIDOS.some((p) => f.startsWith(p) || f === p));
    expect(fora).toEqual([]);
  });
  it('o robots.ts não lista nem bloqueia páginas de colaborador (um Disallow revelaria o endereço)', () => {
    const robots = readFileSync(path.join(RAIZ, 'app/robots.ts'), 'utf8');
    expect(robots).not.toMatch(/colaborador|\/@/);
  });
  it('o sitemap só ganha a chamada do programa (vazia com o interruptor desligado)', () => {
    const sm = readFileSync(path.join(RAIZ, 'app/sitemap.ts'), 'utf8');
    expect(sm).toContain('paginasDeColaboradorParaSitemap(BASE)');
    expect(sm).not.toMatch(/\/@backfindr|colaborador\/seja/);
  });
});
