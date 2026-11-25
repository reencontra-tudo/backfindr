// Programa de Colaboradores, E2: a página `/colaborador/[slug]` (servidor) por dentro: interruptor, estados, metadados de indexação e marcação.
// Postgres REAL (sem TEST_DATABASE_URL a suíte é pulada). `cache` do React só existe no servidor do Next; aqui vira função comum.
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { Pool } from 'pg';
import { randomUUID } from 'crypto';
import { readFileSync } from 'fs';
import path from 'path';
import { renderToStaticMarkup } from 'react-dom/server';
import * as ReactNs from 'react';

// O vitest compila JSX no modo clássico (o Next usa o automático): publica o React como global para a página renderizar.
(globalThis as unknown as { React: unknown }).React = ReactNs;

vi.mock('react', async (orig) => ({ ...(await orig<typeof import('react')>()), cache: <T,>(f: T) => f }));

const TEST_DB = process.env.TEST_DATABASE_URL;
if (TEST_DB) process.env.DATABASE_URL = TEST_DB;
const SCHEMA = readFileSync(path.join(__dirname, 'fixtures/feed-schema.sql'), 'utf8');
const MIGRATION = readFileSync(path.join(__dirname, '../src/db/migrations/026_colaboradores.sql'), 'utf8');

describe.skipIf(!TEST_DB)('página /colaborador/[slug]', () => {
  let pool: Pool;
  let Pagina: (a: { params: { slug: string } }) => Promise<unknown>;
  let meta: (a: { params: { slug: string } }) => Promise<{ robots?: { index?: boolean }; alternates?: { canonical?: string }; title?: unknown }>;
  const ids: Record<string, string> = {};

  const obj = (titulo: string, colab: string | null, extra: { publico?: boolean } = {}) => pool.query(
    `INSERT INTO objects (user_id, title, status, category, type, location, qr_code, images, is_public, is_legacy, colaborador_id, colaborador_codigo)
     VALUES ($1,$2,'found','keys','keys','Tatuapé, São Paulo - SP',$3,'[]',$4,false,$5,$6)`,
    [randomUUID(), titulo, randomUUID().slice(0, 8).toUpperCase(), extra.publico ?? true, colab, colab ? 'HX7R' : null]);
  const erroDe = async (p: Promise<unknown>) => { try { await p; return null; } catch (e) { return e as { digest?: string }; } };

  beforeAll(async () => {
    pool = new Pool({ connectionString: TEST_DB });
    await pool.query(SCHEMA); await pool.query(MIGRATION);
    const mod = await import('@/app/colaborador/[slug]/page');
    Pagina = mod.default as never; meta = mod.generateMetadata as never;
  });
  afterAll(async () => { await pool?.end(); });
  beforeEach(async () => {
    await pool.query('DELETE FROM objects');
    await pool.query('ALTER TABLE colaboradores DISABLE TRIGGER trg_colaboradores_sem_delete'); await pool.query('DELETE FROM colaboradores'); await pool.query('ALTER TABLE colaboradores ENABLE TRIGGER trg_colaboradores_sem_delete');
    const mk = async (slug: string, curto: string, nome: string, estado: string, verificado: boolean, canal: string | null = null, desc: string | null = null) => {
      ids[slug] = (await pool.query(`INSERT INTO colaboradores (slug, codigo_curto, nome, estado, verificado_em, canal_url, descricao) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`, [slug, curto, nome, estado, verificado ? new Date().toISOString() : null, canal, desc])).rows[0].id;
    };
    await mk('grupo-sp', 'HX7R', 'Grupo SP', 'ativo', true, 'https://www.facebook.com/groups/x', 'Grupo de moradores da zona leste.');
    await mk('nao-verif', 'NV3N', 'Não verificado', 'ativo', false);
    await mk('suspenso', 'SU5P', 'Suspenso', 'suspenso', true);
    await mk('saiu', 'SA6U', 'Saiu', 'saiu', true);
    await mk('excluido', 'EX7C', 'Excluído', 'excluido', true);
    await mk('teste-ana', 'TT4A', 'Teste Ana', 'ativo', true);   // PC-16: colaborador de TESTE (verificado)
  });
  afterEach(() => { delete process.env.COLABORADORES_ATIVO; });
  const ligar = () => { process.env.COLABORADORES_ATIVO = '1'; };

  it('DESLIGADO (padrão): 404 antes de qualquer consulta, mesmo para um colaborador que existe', async () => {
    expect((await erroDe(Pagina({ params: { slug: 'grupo-sp' } })))?.digest).toBe('NEXT_NOT_FOUND');
    expect((await meta({ params: { slug: 'grupo-sp' } })).robots?.index).toBe(false);
  });

  it('LIGADO: estados — suspenso e saiu 307, excluído 308 (para o Feed; PC-13), inexistente e @nome malformado 404', async () => {
    ligar();
    expect((await erroDe(Pagina({ params: { slug: 'suspenso' } })))?.digest).toMatch(/^NEXT_REDIRECT;.*;\/feed;307;?$/);
    expect((await erroDe(Pagina({ params: { slug: 'saiu' } })))?.digest).toMatch(/^NEXT_REDIRECT;.*;\/feed;307;?$/);
    expect((await erroDe(Pagina({ params: { slug: 'excluido' } })))?.digest).toMatch(/^NEXT_REDIRECT;.*;\/feed;308;?$/);
    expect((await erroDe(Pagina({ params: { slug: 'nunca-existiu' } })))?.digest).toBe('NEXT_NOT_FOUND');
    expect((await erroDe(Pagina({ params: { slug: 'AB' } })))?.digest).toBe('NEXT_NOT_FOUND');
  });

  it('LIGADO: indexação — verificada e com conteúdo = index; sem conteúdo = noindex; NÃO verificada = noindex mesmo com conteúdo; canônica /@nome', async () => {
    ligar();
    const semConteudo = await meta({ params: { slug: 'grupo-sp' } });
    expect(semConteudo.robots?.index).toBe(false);
    await obj('Chaves achadas', ids['grupo-sp']);
    const comConteudo = await meta({ params: { slug: 'grupo-sp' } });
    expect(comConteudo.robots?.index).toBe(true);
    expect(comConteudo.alternates?.canonical).toMatch(/\/@grupo-sp$/);
    await obj('Chaves achadas 2', ids['nao-verif']);
    expect((await meta({ params: { slug: 'nao-verif' } })).robots?.index).toBe(false);
    expect((await meta({ params: { slug: 'suspenso' } })).robots?.index).toBe(false);
    expect((await meta({ params: { slug: 'nunca-existiu' } })).robots?.index).toBe(false);
  });

  it('LIGADO: colaborador de TESTE (@teste-…) verificado e com conteúdo fica noindex; a página continua abrindo (PC-16)', async () => {
    ligar(); await obj('[TESTE] chaves', ids['teste-ana']);
    const m = await meta({ params: { slug: 'teste-ana' } });
    expect(m.robots?.index).toBe(false);
    expect(m.alternates?.canonical).toMatch(/\/@teste-ana$/);
    await obj('Chaves reais', ids['grupo-sp']); expect((await meta({ params: { slug: 'grupo-sp' } })).robots?.index).toBe(true);   // os demais seguem iguais
    expect(await erroDe(Pagina({ params: { slug: 'teste-ana' } }))).toBeFalsy();
  });

  it('LIGADO: marcação — nome, «por Backfindr», link de origem seguro, botões com o código, cartões, sem promessas e sem dados de terceiros', async () => {
    ligar(); await obj('Molho de chaves achado', ids['grupo-sp']);
    const html = renderToStaticMarkup((await Pagina({ params: { slug: 'grupo-sp' } })) as never);
    expect(html).toContain('Grupo SP');
    expect(html).toContain('por Backfindr');
    expect(html).toContain('Grupo de moradores da zona leste.');
    expect(html).toMatch(/href="https:\/\/www\.facebook\.com\/groups\/x"[^>]*rel="nofollow noopener noreferrer"/);
    expect(html).toContain('href="/flow/lost?colab=HX7R"');
    expect(html).toContain('href="/flow/found?colab=HX7R"');
    expect(html).toContain('href="/flow/stolen?colab=HX7R"');
    expect(html).toContain('Molho de chaves achado');
    expect(html).toMatch(/href="\/objeto\/[A-Z0-9]{8}"/);
    const texto = html.replace(/<[^>]*>/g, ' ');   // só o que a pessoa lê (atributos como data-* ficam de fora)
    expect(texto).not.toMatch(/parceir|garant|imediat|protegid|chat|SMS|comiss|colaborador/i);
    expect(html).not.toMatch(/parceir|comiss/i);
    expect(html).not.toMatch(/user_id|latitude|longitude|e-mail|telefone/i);
  });

  it('LIGADO: sem ocorrências mostra o aviso de vazio e continua com os botões', async () => {
    ligar();
    const html = renderToStaticMarkup((await Pagina({ params: { slug: 'grupo-sp' } })) as never);
    expect(html).toContain('Ainda não há ocorrências registradas por aqui.');
    expect(html).toContain('href="/flow/found?colab=HX7R"');
  });

  it('LIGADO: texto do colaborador é escapado (nada de HTML próprio) e link não-https some', async () => {
    ligar();
    await pool.query(`UPDATE colaboradores SET nome = 'Grupo <script>alert(1)</script>', descricao = '<img src=x onerror=alert(1)>', canal_url = 'javascript:alert(1)' WHERE slug = 'grupo-sp'`);
    const html = renderToStaticMarkup((await Pagina({ params: { slug: 'grupo-sp' } })) as never);
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('<img src=x');
    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toContain('javascript:');
    expect(html).not.toContain('Voltar ao grupo');
  });

  it('o código do colaborador NÃO aparece na página, só o código curto nos links de cadastro (público por desenho)', async () => {
    ligar(); await obj('Qualquer', ids['grupo-sp']);
    const html = renderToStaticMarkup((await Pagina({ params: { slug: 'grupo-sp' } })) as never);
    expect(html.match(/HX7R/g)?.length).toBe(3);   // só os 3 botões
  });
});
