// Programa de Colaboradores, E3: marca do colaborador no cartaz. Regras da consulta e da logo (o cartaz em si é comparado byte a byte no navegador/servidor local).
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { Pool } from 'pg';
import { randomUUID } from 'crypto';
import { readFileSync } from 'fs';
import path from 'path';
import sharp from 'sharp';
import { nomeParaCartaz, NOME_MAX, logoComoDataUrl, obterMarcaDoCartaz } from '@/lib/colaboradores/marca';

const TEST_DB = process.env.TEST_DATABASE_URL;
if (TEST_DB) process.env.DATABASE_URL = TEST_DB;
afterEach(() => { delete process.env.COLABORADORES_ATIVO; });

describe('nome no cartaz', () => {
  it('até 34 caracteres fica como está (com espaços normalizados); acima disso corta com reticências, sem cortar emoji', () => {
    expect(nomeParaCartaz('Grupo Achados SP')).toBe('Grupo Achados SP');
    expect(nomeParaCartaz('  Grupo   Achados   SP ')).toBe('Grupo Achados SP');
    const longo = nomeParaCartaz('A'.repeat(60));
    expect(Array.from(longo).length).toBe(NOME_MAX);
    expect(longo.endsWith('…')).toBe(true);
    const emoji = nomeParaCartaz('🐶'.repeat(50));
    expect(Array.from(emoji).length).toBe(NOME_MAX);
    expect(emoji.endsWith('…')).toBe(true);
    expect(emoji).not.toMatch(/�/);
  });
});

describe('logo do colaborador (https, limitada e reduzida)', () => {
  const png = async (lado = 400) => sharp({ create: { width: lado, height: lado, channels: 3, background: { r: 20, g: 184, b: 166 } } }).png().toBuffer();
  const resposta = (corpo: Buffer, tipo = 'image/png', status = 200) => new Response(new Uint8Array(corpo), { status, headers: { 'content-type': tipo } });

  it('baixa, reduz para 96×96 e devolve um PNG em data URL', async () => {
    const f = vi.fn(async () => resposta(await png(400)));
    const r = await logoComoDataUrl('https://exemplo.com/logo.png', f as unknown as typeof fetch);
    expect(r).toMatch(/^data:image\/png;base64,/);
    const meta = await sharp(Buffer.from(r!.split(',')[1], 'base64')).metadata();
    expect([meta.width, meta.height]).toEqual([96, 96]);
    expect(f).toHaveBeenCalledTimes(1);
  });
  it('só https: http, javascript, data, credenciais e vazio nem chegam a fazer pedido', async () => {
    const f = vi.fn();
    for (const u of ['http://exemplo.com/a.png', 'javascript:alert(1)', 'data:image/png;base64,AAAA', 'https://u:p@exemplo.com/a.png', '', null]) expect(await logoComoDataUrl(u as string | null, f as unknown as typeof fetch)).toBeNull();
    expect(f).not.toHaveBeenCalled();
  });
  it('recusa o que não é imagem aceita, o que passa de 2 MB, resposta com erro e falha de rede', async () => {
    expect(await logoComoDataUrl('https://x.com/a', (async () => resposta(Buffer.from('<svg/>'), 'image/svg+xml')) as unknown as typeof fetch)).toBeNull();
    expect(await logoComoDataUrl('https://x.com/a', (async () => resposta(Buffer.from('<html/>'), 'text/html')) as unknown as typeof fetch)).toBeNull();
    expect(await logoComoDataUrl('https://x.com/a', (async () => resposta(Buffer.alloc(2_000_001, 1), 'image/png')) as unknown as typeof fetch)).toBeNull();
    expect(await logoComoDataUrl('https://x.com/a', (async () => resposta(await png(), 'image/png', 404)) as unknown as typeof fetch)).toBeNull();
    expect(await logoComoDataUrl('https://x.com/a', (async () => { throw new Error('rede'); }) as unknown as typeof fetch)).toBeNull();
    expect(await logoComoDataUrl('https://x.com/a', (async () => resposta(Buffer.from('não é imagem'), 'image/png')) as unknown as typeof fetch)).toBeNull();   // sharp recusa
  });
});

describe('quando a marca existe', () => {
  it('com o programa DESLIGADO devolve null e NÃO consulta o banco (o cartaz atual não ganha consulta nenhuma)', async () => {
    const consulta = vi.fn();
    expect(await obterMarcaDoCartaz(consulta, randomUUID())).toBeNull();
    expect(consulta).not.toHaveBeenCalled();
  });
  it('falha do banco (por exemplo, colunas do programa inexistentes) = sem marca, sem lançar erro', async () => {
    process.env.COLABORADORES_ATIVO = '1';
    const consulta = vi.fn(async () => { throw new Error('column "colaborador_id" does not exist'); });
    const aviso = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(await obterMarcaDoCartaz(consulta, randomUUID())).toBeNull();
    expect(aviso).toHaveBeenCalled();
    aviso.mockRestore();
  });
});

describe.skipIf(!TEST_DB)('marca com banco real', () => {
  let pool: Pool;
  const SCHEMA = readFileSync(path.join(__dirname, 'fixtures/feed-schema.sql'), 'utf8');
  const MIGRATION = readFileSync(path.join(__dirname, '../src/db/migrations/026_colaboradores.sql'), 'utf8');
  const ids: Record<string, string> = {};
  const consulta = (t: string, p?: unknown[]) => pool.query(t, p as never[]);
  const obj = async (colab: string | null) => (await pool.query(`INSERT INTO objects (user_id, title, status, category, type, qr_code, images, is_public, is_legacy, colaborador_id, colaborador_codigo) VALUES ($1,'x','found','keys','keys',$2,'[]',true,false,$3,$4) RETURNING id`, [randomUUID(), randomUUID().slice(0, 8).toUpperCase(), colab, colab ? 'HX7R' : null])).rows[0].id as string;

  beforeAll(async () => { pool = new Pool({ connectionString: TEST_DB }); await pool.query(SCHEMA); });
  afterAll(async () => { await pool?.end(); });

  it('MIGRATION NÃO APLICADA (o caso da produção hoje): com o programa ligado, devolve null sem lançar erro', async () => {
    process.env.COLABORADORES_ATIVO = '1';
    const id = (await pool.query(`INSERT INTO objects (user_id, title, status, category, type, qr_code, images, is_public) VALUES ($1,'x','found','keys','keys','ABCD1234','[]',true) RETURNING id`, [randomUUID()])).rows[0].id;
    const aviso = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(await obterMarcaDoCartaz(consulta, id)).toBeNull();
    aviso.mockRestore();
  });

  describe('com a migration aplicada', () => {
    beforeAll(async () => { await pool.query(MIGRATION); });
    beforeEach(async () => {
      await pool.query('DELETE FROM objects');
      await pool.query('ALTER TABLE colaboradores DISABLE TRIGGER trg_colaboradores_sem_delete'); await pool.query('DELETE FROM colaboradores'); await pool.query('ALTER TABLE colaboradores ENABLE TRIGGER trg_colaboradores_sem_delete');
      const mk = async (slug: string, curto: string, nome: string, estado: string, img: string | null = null) => { ids[slug] = (await pool.query(`INSERT INTO colaboradores (slug, codigo_curto, nome, estado, imagem_url) VALUES ($1,$2,$3,$4,$5) RETURNING id`, [slug, curto, nome, estado, img])).rows[0].id; };
      await mk('grupo-sp', 'HX7R', 'Grupo Achados SP', 'ativo', 'https://exemplo.com/logo.png');
      await mk('sem-logo', 'QQ2K', 'Sem logo', 'ativo');
      await mk('suspenso', 'SU5P', 'Suspenso', 'suspenso');
      await mk('saiu', 'SA6U', 'Saiu', 'saiu');
      await mk('excluido', 'EX7C', 'Excluído', 'excluido');
      process.env.COLABORADORES_ATIVO = '1';
    });

    it('ocorrência cadastrada com o código de um colaborador ATIVO: nome e logo (a logo vem do ajudante recebido)', async () => {
      const logo = vi.fn(async (u: string | null) => (u ? 'data:image/png;base64,AAAA' : null));
      expect(await obterMarcaDoCartaz(consulta, await obj(ids['grupo-sp']), logo)).toEqual({ nome: 'Grupo Achados SP', logo: 'data:image/png;base64,AAAA' });
      expect(logo).toHaveBeenCalledWith('https://exemplo.com/logo.png');
    });
    it('sem logo cadastrada: só o nome', async () => {
      expect(await obterMarcaDoCartaz(consulta, await obj(ids['sem-logo']), async () => null)).toEqual({ nome: 'Sem logo', logo: null });
    });
    it('logo que falha ao baixar: o cartaz continua com o nome', async () => {
      expect(await obterMarcaDoCartaz(consulta, await obj(ids['grupo-sp']), async () => null)).toEqual({ nome: 'Grupo Achados SP', logo: null });
    });
    it('colaborador suspenso, que saiu ou excluído: SEM marca (não é divulgado)', async () => {
      for (const s of ['suspenso', 'saiu', 'excluido']) expect(await obterMarcaDoCartaz(consulta, await obj(ids[s])), s).toBeNull();
    });
    it('ocorrência SEM código de colaborador e ocorrência inexistente: sem marca', async () => {
      expect(await obterMarcaDoCartaz(consulta, await obj(null))).toBeNull();
      expect(await obterMarcaDoCartaz(consulta, randomUUID())).toBeNull();
    });
    it('programa desligado: ocorrência com código de colaborador ativo também sai SEM marca', async () => {
      const id = await obj(ids['grupo-sp']); delete process.env.COLABORADORES_ATIVO;
      expect(await obterMarcaDoCartaz(consulta, id)).toBeNull();
    });
  });
});

describe('o cartaz só ganha o que é aditivo', () => {
  it('a rota do cartaz recebeu só linhas novas (nenhuma linha existente alterada ou removida) e a marca só entra com «marca &&»', () => {
    const src = readFileSync(path.join(__dirname, '../src/app/api/v1/objects/[id]/poster/route.tsx'), 'utf8');
    expect(src).toContain('const marca = await obterMarcaDoCartaz(query, obj.id);');
    expect((src.match(/\{marca && <MarcaDoCartaz/g) ?? []).length).toBe(3);   // quadrado, vertical e A4
    expect(src).not.toMatch(/colaborador_id|colaborador_codigo/);               // a rota não cita as colunas: só o ajudante, com consulta própria
  });
});
