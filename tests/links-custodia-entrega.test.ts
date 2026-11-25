// Links de custódia e de entrega (/custody/<token>, /delivery/<token>):
//  - geradores criptográficos (formato igual ao de antes, sem Math.random);
//  - colunas consistentes com o esquema REAL: entregas.link_token (não existe `token`) e cliente_* (não existem destinatario_*).
// A parte de banco usa um Postgres REAL e é pulada sem TEST_DATABASE_URL. ATENÇÃO: recria users, estabelecimentos,
// entregadores, entregas, custodias, condominios e custody_eventos (banco descartável).
//
//   TEST_DATABASE_URL=postgres://u:pw@127.0.0.1:5432/bftest npx vitest run --config tests/vitest.config.ts tests/links-custodia-entrega.test.ts
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { removerTabelas } from './helpers/limpeza-banco';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { Pool } from 'pg';
import { NextRequest } from 'next/server';
import { gerarQrCode, gerarToken } from '@/lib/notifyModulos';

/** Tabelas que este arquivo cria no banco de teste; removidas ao terminar (ver helpers/limpeza-banco.ts). */
const TABELAS_DO_TESTE = ['condominios', 'custodias', 'custody_eventos', 'entrega_eventos', 'entregadores', 'entregas', 'estabelecimentos', 'users'];

const TEST_DB = process.env.TEST_DATABASE_URL;
if (TEST_DB) process.env.DATABASE_URL = TEST_DB;

// O token de teste é o próprio user_id.
vi.mock('@/lib/jwt', () => ({
  extractTokenFromHeader: (h: string | null) => (h?.startsWith('Bearer ') ? h.slice(7) : null),
  verifyToken: (t: string) => ({ sub: t }),
}));

const ROOT = path.resolve(__dirname, '..');
const lê = (p: string) => readFileSync(path.join(ROOT, p), 'utf8');

describe('geradores de token e de código de QR', () => {
  it('gerarToken: prefixo + 32 caracteres do mesmo alfabeto de antes (54 símbolos, sem I, L, O, 0, 1)', () => {
    for (let i = 0; i < 200; i++) {
      const t = gerarToken('dlv_');
      expect(t).toMatch(/^dlv_[ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789]{32}$/);
      expect(t.length).toBe(36);
    }
    expect(gerarToken()).toMatch(/^[A-Za-z2-9]{32}$/);
    expect(gerarToken('cst_')).toMatch(/^cst_/);
  });
  it('gerarToken: sem repetição em 20 mil tokens e distribuição próxima da uniforme', () => {
    const vistos = new Set<string>();
    const cont: Record<string, number> = {};
    for (let i = 0; i < 20000; i++) {
      const t = gerarToken();
      vistos.add(t);
      for (const c of t) cont[c] = (cont[c] ?? 0) + 1;
    }
    expect(vistos.size).toBe(20000);
    const total = 20000 * 32;
    const esperado = total / 54;
    expect(Object.keys(cont).length).toBe(54);
    for (const c of Object.keys(cont)) expect(Math.abs(cont[c] - esperado) / esperado, c).toBeLessThan(0.05);
  });
  it('gerarQrCode: 8 caracteres 0-9 e A-Z (cabe em qr_code varchar(20)), sem repetição em 20 mil', () => {
    const vistos = new Set<string>();
    for (let i = 0; i < 20000; i++) {
      const q = gerarQrCode();
      expect(q).toMatch(/^[0-9A-Z]{8}$/);
      vistos.add(q);
    }
    expect(vistos.size).toBe(20000);
  });
  it('os geradores usam crypto, e nenhum Math.random sobrou nos módulos de custódia e entrega', () => {
    const lib = lê('src/lib/notifyModulos.ts');
    expect(lib).toContain("import { randomInt } from 'crypto'");
    const trecho = lib.slice(lib.indexOf('export function gerarToken'), lib.indexOf('// ─── Calcular distância'));
    expect(trecho).not.toContain('Math.random');
    expect(trecho).toContain('randomInt(');
    const varre = (dir: string, acc: string[] = []) => {
      for (const n of readdirSync(path.join(ROOT, dir))) {
        const rel = `${dir}/${n}`;
        if (statSync(path.join(ROOT, rel)).isDirectory()) varre(rel, acc);
        else if (/\.tsx?$/.test(n)) acc.push(rel);
      }
      return acc;
    };
    for (const f of [...varre('src/app/api/v1/delivery'), ...varre('src/app/api/v1/custody')]) {
      expect(lê(f), f).not.toContain('Math.random');
    }
  });
});

describe('guarda: as rotas de entrega usam só colunas que existem em `entregas`', () => {
  const ROTAS = [
    'src/app/api/v1/delivery/minhas-entregas/route.ts',
    'src/app/api/v1/delivery/entregador/entregas/route.ts',
    'src/app/api/v1/delivery/link/[token]/route.ts',
    'src/app/api/v1/delivery/confirmar/[token]/route.ts',
    'src/app/api/v1/delivery/entregas/route.ts',
  ];
  it('nenhuma consulta usa a coluna inexistente `token` (o nome real é link_token)', () => {
    for (const r of ROTAS) {
      const src = lê(r);
      expect(src, r).not.toMatch(/\be\.token\b/);
      expect(src, r).not.toMatch(/SELECT\s+id,\s*token\b/);
      expect(src, r).not.toMatch(/,\s*token\)\s*VALUES/i);
      expect(src, r).not.toMatch(/WHERE\s+token\b/i);
    }
  });
  it('nenhuma consulta usa as colunas inexistentes destinatario_*, endereco_destino em `entregas` (só como apelido da resposta)', () => {
    for (const r of ROTAS) {
      const sql = [...lê(r).matchAll(/`([^`]*(?:SELECT|INSERT)[^`]*)`/g)].map((m) => m[1]).join('\n');
      const semApelidos = sql.replace(/AS\s+(destinatario_nome|destinatario_phone|endereco_destino|token)\b/g, '');
      expect(semApelidos, r).not.toMatch(/\b(destinatario_nome|destinatario_phone|endereco_destino)\b/);
    }
  });
  it('as rotas de custódia seguem em link_token', () => {
    for (const r of ['src/app/api/v1/custody/link/[token]/route.ts', 'src/app/api/v1/custody/confirmar/[token]/route.ts']) {
      expect(lê(r), r).toContain('c.link_token = $1');
    }
  });
  it('minhas-entregas usa o gerador compartilhado (não tem mais gerador próprio)', () => {
    const s = lê('src/app/api/v1/delivery/minhas-entregas/route.ts');
    expect(s).toContain("import { gerarQrCode, gerarToken } from '@/lib/notifyModulos'");
    expect(s).not.toContain('function generateToken');
  });
});

const U = {
  dono: '20000000-0000-0000-0000-000000000001',
  entregadorUser: '20000000-0000-0000-0000-000000000002',
};

describe.skipIf(!TEST_DB)('rotas de entrega e de custódia com o esquema real', () => {
  let pool: Pool;
  let minhasGET: (r: NextRequest) => Promise<Response>;
  let minhasPOST: (r: NextRequest) => Promise<Response>;
  let entregadorGET: (r: NextRequest) => Promise<Response>;
  let linkEntregaGET: (r: NextRequest, c: { params: { token: string } }) => Promise<Response>;
  let linkCustodiaGET: (r: NextRequest, c: { params: { token: string } }) => Promise<Response>;
  const req = (url: string, userId?: string, init: RequestInit = {}) =>
    new NextRequest(`http://localhost${url}`, { ...init, headers: { ...(userId ? { authorization: `Bearer ${userId}` } : {}), 'content-type': 'application/json' } });

  beforeAll(async () => {
    pool = new Pool({ connectionString: TEST_DB });
    await pool.query(`
      DROP TABLE IF EXISTS custody_eventos, entrega_eventos, custodias, entregas, entregadores, estabelecimentos, condominios CASCADE;
      DROP TABLE IF EXISTS users CASCADE;
      CREATE TABLE users (id uuid PRIMARY KEY, email varchar(255) NOT NULL, name varchar(255) NOT NULL, phone varchar(50), plan varchar(50) DEFAULT 'free', role varchar(50), b2b_partner_id uuid);
      CREATE TABLE condominios (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), nome varchar(255) NOT NULL, endereco text NOT NULL);
      CREATE TABLE estabelecimentos (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), nome varchar(255) NOT NULL, telefone varchar(50), endereco text NOT NULL, lat numeric, lng numeric);
      CREATE TABLE entregadores (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL, estabelecimento_id uuid, veiculo varchar(50), status text, active boolean NOT NULL DEFAULT true);
      CREATE TABLE entregas (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), estabelecimento_id uuid, entregador_id uuid, entregador_user_id uuid, condominio_id uuid, user_id uuid,
        cliente_user_id uuid, cliente_nome varchar(255), cliente_telefone varchar(50), cliente_endereco text, cliente_lat numeric, cliente_lng numeric, descricao text,
        qr_code varchar(20) NOT NULL UNIQUE DEFAULT substring(gen_random_uuid()::text, 1, 8), link_token varchar(100) NOT NULL UNIQUE DEFAULT gen_random_uuid()::text,
        status varchar(30) NOT NULL DEFAULT 'preparando', entregador_lat numeric, entregador_lng numeric, ultima_localizacao_em timestamptz, saiu_em timestamptz,
        chegou_em timestamptz, entregue_em timestamptz, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
      CREATE TABLE custodias (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), condominio_id uuid, remetente_id uuid, destinatario_nome varchar(255), destinatario_contato varchar(255), destinatario_user_id uuid,
        descricao text, qr_code varchar(20) NOT NULL UNIQUE, link_token varchar(100) NOT NULL UNIQUE, status varchar(30) NOT NULL DEFAULT 'aguardando', custodiante_id uuid,
        custodiante_tipo varchar(30), custodiado_em timestamptz, entregue_em timestamptz, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
      CREATE TABLE custody_eventos (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), custodia_id uuid, tipo varchar(50), user_id uuid, lat numeric, lng numeric, observacao text, created_at timestamptz NOT NULL DEFAULT now());
      CREATE TABLE entrega_eventos (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), entrega_id uuid NOT NULL REFERENCES entregas(id) ON DELETE CASCADE, tipo varchar(30) NOT NULL, lat numeric, lng numeric, user_id uuid, observacao text, created_at timestamptz NOT NULL DEFAULT now());
    `);
    await pool.query(`INSERT INTO users (id, email, name, phone) VALUES ($1,'dono@t.test','Dono Teste','11988887777'), ($2,'ent@t.test','Entregador Teste','(11) 99999-0000')`, [U.dono, U.entregadorUser]);
    await pool.query(`INSERT INTO entregadores (user_id) VALUES ($1)`, [U.entregadorUser]);
    ({ GET: minhasGET, POST: minhasPOST } = await import('@/app/api/v1/delivery/minhas-entregas/route'));
    ({ GET: entregadorGET } = await import('@/app/api/v1/delivery/entregador/entregas/route'));
    ({ GET: linkEntregaGET } = await import('@/app/api/v1/delivery/link/[token]/route'));
    ({ GET: linkCustodiaGET } = await import('@/app/api/v1/custody/link/[token]/route'));
  });
  afterAll(async () => {
    await removerTabelas(pool, TABELAS_DO_TESTE); await pool?.end();
    const { closePool } = await import('@/lib/db');
    await closePool();
  });

  it('POST minhas-entregas cria a entrega nas colunas reais, com token e QR criptográficos e entregador achado pelo telefone (a pontuação não importa, só os dígitos)', async () => {
    const res = await minhasPOST(req('/x', U.dono, { method: 'POST', body: JSON.stringify({ destinatario_nome: 'Maria Teste', destinatario_phone: '11977776666', endereco_destino: 'Rua Teste, 10', entregador_phone: '11 99999.0000' }) }));
    expect(res.status).toBe(201);
    const b = await res.json();
    expect(b.token).toMatch(/^dlv_[A-Za-z2-9]{32}$/);
    expect(b.link_url).toContain(`/delivery/${b.token}`);
    expect(b).toMatchObject({ destinatario_nome: 'Maria Teste', destinatario_phone: '11977776666', endereco_destino: 'Rua Teste, 10', entregador_vinculado: true, status: 'aguardando' });
    const row = (await pool.query('SELECT link_token, qr_code, cliente_nome, cliente_telefone, cliente_endereco, user_id, entregador_id, status FROM entregas WHERE link_token = $1', [b.token])).rows[0];
    expect(row).toMatchObject({ link_token: b.token, cliente_nome: 'Maria Teste', cliente_telefone: '11977776666', cliente_endereco: 'Rua Teste, 10', user_id: U.dono, status: 'aguardando' });
    expect(row.qr_code).toMatch(/^[0-9A-Z]{8}$/);
    expect(row.entregador_id).not.toBeNull();
  });
  it('POST minhas-entregas sem entregador conhecido segue sem vínculo; campos obrigatórios continuam obrigatórios', async () => {
    const ok = await minhasPOST(req('/x', U.dono, { method: 'POST', body: JSON.stringify({ destinatario_nome: 'João', destinatario_phone: '1', endereco_destino: 'Rua', entregador_phone: '(21) 90000-0000' }) }));
    expect(ok.status).toBe(201);
    expect((await ok.json()).entregador_vinculado).toBe(false);
    const faltando = await minhasPOST(req('/x', U.dono, { method: 'POST', body: JSON.stringify({ destinatario_nome: 'João' }) }));
    expect(faltando.status).toBe(400);
    const semLogin = await minhasPOST(req('/x', undefined, { method: 'POST', body: '{}' }));
    expect(semLogin.status).toBe(401);
  });
  it('GET minhas-entregas lista só as do usuário, com os nomes de campo que as telas usam', async () => {
    const res = await minhasGET(req('/x', U.dono));
    expect(res.status).toBe(200);
    const { items } = await res.json();
    expect(items.length).toBe(2);
    expect(Object.keys(items[0]).sort()).toEqual(['created_at', 'destinatario_nome', 'destinatario_phone', 'endereco_destino', 'entregue_em', 'id', 'status', 'token'].sort());
    expect(items.every((i: { token: string }) => /^dlv_/.test(i.token))).toBe(true);
    const outro = await minhasGET(req('/x', U.entregadorUser));
    expect((await outro.json()).items.length).toBe(0);
  });
  it('GET entregador/entregas lista as entregas vinculadas ao entregador, com os mesmos campos', async () => {
    const res = await entregadorGET(req('/x', U.entregadorUser));
    expect(res.status).toBe(200);
    const { items } = await res.json();
    expect(items.length).toBe(1);
    expect(Object.keys(items[0]).sort()).toEqual(['created_at', 'destinatario_nome', 'destinatario_phone', 'endereco_destino', 'entregue_em', 'id', 'status', 'token'].sort());
  });
  it('GET delivery/link/<token> acha a entrega pelo link_token e devolve o nome do entregador; token desconhecido dá 404', async () => {
    const t = (await pool.query(`SELECT link_token FROM entregas WHERE cliente_nome = 'Maria Teste'`)).rows[0].link_token;
    const res = await linkEntregaGET(req('/x'), { params: { token: t } });
    expect(res.status).toBe(200);
    const b = await res.json();
    expect(b).toMatchObject({ token: t, destinatario_nome: 'Maria Teste', endereco_destino: 'Rua Teste, 10', entregador_nome: 'Entregador Teste', status: 'aguardando' });
    expect(b.eventos).toEqual([]);
    expect((await linkEntregaGET(req('/x'), { params: { token: 'dlv_inexistente' } })).status).toBe(404);
  });
  it('tokens JÁ EXISTENTES (gerados com o formato antigo, inclusive o UUID padrão do banco) continuam funcionando', async () => {
    const antigo = 'dlv_' + 'AbCdEfGhJkMnPqRsTuVwXyZ23456789a'.slice(0, 32);
    await pool.query(`INSERT INTO entregas (link_token, qr_code, cliente_nome, cliente_endereco, status) VALUES ($1, 'ANTIGO01', 'Cliente Antigo', 'Rua Velha', 'saiu')`, [antigo]);
    const padraoBanco = (await pool.query(`INSERT INTO entregas (cliente_nome, cliente_endereco) VALUES ('Cliente Padrão', 'Rua') RETURNING link_token`)).rows[0].link_token;
    for (const [t, nome] of [[antigo, 'Cliente Antigo'], [padraoBanco, 'Cliente Padrão']]) {
      const res = await linkEntregaGET(req('/x'), { params: { token: t } });
      expect(res.status, t).toBe(200);
      expect((await res.json()).destinatario_nome).toBe(nome);
    }
    await pool.query(`INSERT INTO custodias (qr_code, link_token, destinatario_nome, descricao) VALUES ('CST00001', 'cst_AntigoQualquer', 'Fulano', 'Caixa')`);
    const c = await linkCustodiaGET(req('/x'), { params: { token: 'cst_AntigoQualquer' } });
    expect(c.status).toBe(200);
    expect((await c.json()).destinatario_nome).toBe('Fulano');
    expect((await linkCustodiaGET(req('/x'), { params: { token: 'cst_nao_existe' } })).status).toBe(404);
  });
  it('1.000 tokens e QRs gerados cabem nas colunas e respeitam a unicidade do banco', async () => {
    const linhas = Array.from({ length: 1000 }, () => [gerarToken('dlv_'), gerarQrCode()]);
    await pool.query(`INSERT INTO entregas (link_token, qr_code) SELECT * FROM unnest($1::text[], $2::text[])`, [linhas.map((l) => l[0]), linhas.map((l) => l[1])]);
    const { rows } = await pool.query(`SELECT count(*)::int AS n FROM entregas WHERE link_token LIKE 'dlv_%'`);
    expect(rows[0].n).toBeGreaterThanOrEqual(1000);
  });
});
