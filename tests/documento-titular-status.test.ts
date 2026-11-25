// Fase 0: titular e final do documento só em «perdi» e «roubado» (lista de permissão); «encontrei» não mostra nem grava.
// Postgres REAL (pula sem TEST_DATABASE_URL) + formulário. Só dados FICTÍCIOS.
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { removerTabelas } from './helpers/limpeza-banco';
import { Pool } from 'pg';
import { randomUUID } from 'crypto';
import { NextRequest } from 'next/server';
import { readFileSync } from 'fs';
import React, { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { statusMostraTitular, statusIgnoraTitular } from '@/lib/documentPrivacy';
import { DynamicCategoryFields } from '@/components/ui/DynamicCategoryFields';

/** Tabelas que este arquivo cria no banco de teste; removidas ao terminar (ver helpers/limpeza-banco.ts). */
const TABELAS_DO_TESTE = ['objects', 'users'];

(globalThis as unknown as { React: typeof React }).React = React; // o componente usa JSX clássico
const TEST_DB = process.env.TEST_DATABASE_URL;
if (TEST_DB) process.env.DATABASE_URL = TEST_DB;

vi.mock('@/lib/jwt', () => ({
  extractTokenFromHeader: (h: string | null) => (h?.startsWith('Bearer ') ? h.slice(7) : null),
  verifyToken: (t: string) => ({ sub: t }),
}));
vi.mock('@/lib/events', () => {
  const noop = () => Promise.resolve();
  return { Events: { objectCreated: noop, objectPublished: noop, objectIndexed: noop, qrGenerated: noop, qrScanned: noop, statusChanged: noop, objectReturned: noop } };
});
vi.mock('@/lib/socialPost', () => ({ enqueueSocialPosts: () => Promise.resolve() }));

describe('lista de permissão de status', () => {
  it('só lost e stolen mostram; todo o resto não (inclusive valores desconhecidos)', () => {
    expect(statusMostraTitular('lost')).toBe(true);
    expect(statusMostraTitular('stolen')).toBe(true);
    for (const s of ['found', 'returned', 'protected', 'archived', 'recovered', 'qualquer', '', null, undefined, 1]) expect(statusMostraTitular(s)).toBe(false);
  });
  it('só found ignora na gravação', () => {
    expect(statusIgnoraTitular('found')).toBe(true);
    for (const s of ['lost', 'stolen', 'protected', 'returned', undefined]) expect(statusIgnoraTitular(s)).toBe(false);
  });
});

describe('formulário: campos de documento por status', () => {
  const html = (hide: string[]) => renderToStaticMarkup(createElement(DynamicCategoryFields, { category: 'document', values: {}, onChange: () => {}, hideFields: hide }));
  it('«perdi»: mostra tipo, nome do titular com aviso e 4 dígitos', () => {
    const h = html([]);
    expect(h).toContain('Nome do titular');
    expect(h).toContain('aparecerá publicamente');
    expect(h).toContain('Últimos 4 dígitos');
    expect(h).toContain('Tipo de Documento');
  });
  it('«encontrei»: some o nome, o aviso e os 4 dígitos; o tipo continua', () => {
    const h = html(['document_owner_name', 'document_last4']);
    expect(h).not.toContain('Nome do titular');
    expect(h).not.toContain('aparecerá publicamente');
    expect(h).not.toContain('Últimos 4 dígitos');
    expect(h).toContain('Tipo de Documento');
  });
  it('outras categorias não são afetadas pela prop', () => {
    const a = renderToStaticMarkup(createElement(DynamicCategoryFields, { category: 'phone', values: {}, onChange: () => {} }));
    const b = renderToStaticMarkup(createElement(DynamicCategoryFields, { category: 'phone', values: {}, onChange: () => {}, hideFields: [] }));
    expect(a).toBe(b);
  });
});

describe('formulário: código (nova e edição)', () => {
  const nova = readFileSync('src/app/dashboard/objects/new/page.tsx', 'utf8');
  const edicao = readFileSync('src/app/dashboard/objects/[id]/edit/page.tsx', 'utf8');
  it('criação: esconde e não envia o titular em «encontrei»', () => {
    expect(nova).toMatch(/hideFields=\{category === 'document' && status === 'found' \? \['document_owner_name', 'document_last4'\] : \[\]\}/);
    expect(nova).toMatch(/data\.category === 'document' && data\.status !== 'found'/);
  });
  it('edição: esconde e não envia o titular em «encontrei»', () => {
    expect(edicao).toMatch(/hideFields=\{status === 'found' \? \['document_owner_name', 'document_last4'\] : \[\]\}/);
    expect(edicao).toMatch(/\.\.\.\(status !== 'found' \? \{/);
  });
});

describe.skipIf(!TEST_DB)('API: titular só em perdi/roubado (Postgres real)', () => {
  let pool: Pool;
  let POST: (req: NextRequest) => Promise<Response>;
  let PATCH: (req: NextRequest, ctx: { params: { id: string } }) => Promise<Response>;
  let GETSCAN: (req: NextRequest, ctx: { params: { code: string } }) => Promise<Response>;
  let userId: string;

  const req = (method: string, uid: string, body?: unknown) =>
    new NextRequest('http://localhost/x', { method, headers: { authorization: `Bearer ${uid}`, 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const post = (body: Record<string, unknown>) => POST(req('POST', userId, { confirm_duplicate: true, ...body }));
  const row = async (id: string) => (await pool.query('SELECT * FROM objects WHERE id = $1', [id])).rows[0];
  const scanById = async (id: string) => (await (await GETSCAN(req('GET', userId), { params: { code: (await row(id)).qr_code } })).json());
  const doc = { title: 'RG perdido', description: 'Perdi minha carteira de identidade', category: 'document', document_type: 'rg', document_owner_name: 'Ana Souza Teste', document_last4: '1234' };

  beforeAll(async () => {
    pool = new Pool({ connectionString: TEST_DB });
    await pool.query('DROP TABLE IF EXISTS objects, users CASCADE');
    await pool.query(`CREATE TABLE users (id uuid PRIMARY KEY, plan text, plan_expires_at timestamptz, is_legacy boolean DEFAULT false)`);
    await pool.query(`CREATE TABLE objects (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title varchar NOT NULL, description text, status varchar DEFAULT 'lost', type varchar NOT NULL, location varchar,
      latitude numeric, longitude numeric, qr_code varchar NOT NULL UNIQUE, images jsonb DEFAULT '[]',
      created_at timestamp DEFAULT now(), updated_at timestamp DEFAULT now(), category varchar, is_public boolean DEFAULT true,
      reward_amount numeric, reward_description text, category_fields jsonb DEFAULT '{}', subject_name varchar, document_type varchar,
      color varchar, brand varchar, breed varchar, is_legacy boolean DEFAULT false, source varchar, resolved_at timestamp,
      found_pending_confirmation boolean DEFAULT false, found_pending_since timestamp)`);
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response('{}'))));
    ({ POST } = await import('@/app/api/v1/objects/route'));
    ({ PATCH } = await import('@/app/api/v1/objects/[id]/route'));
    ({ GET: GETSCAN } = await import('@/app/api/v1/objects/scan/[code]/route'));
  });
  beforeEach(async () => {
    userId = randomUUID();
    await pool.query(`INSERT INTO users (id, plan) VALUES ($1, 'business')`, [userId]);
  });
  afterAll(async () => { vi.unstubAllGlobals(); await removerTabelas(pool, TABELAS_DO_TESTE); await pool?.end(); });

  it('perdi e roubado: titular e final saem na API por código (como antes)', async () => {
    for (const status of ['lost', 'stolen']) {
      const id = (await (await post({ ...doc, status })).json()).id;
      const s = await scanById(id);
      expect(s.titular).toBe('Ana Souza Teste');
      expect(s.documento_final).toBe('1234');
    }
  });

  it('demais status não mostram, mesmo com o dado gravado (returned, protected, archived, found por inserção direta)', async () => {
    for (const status of ['returned', 'protected', 'archived', 'found']) {
      const code = randomUUID().slice(0, 8).toUpperCase();
      const id = (await pool.query(
        `INSERT INTO objects (user_id, title, description, status, category, type, qr_code, subject_name, category_fields)
         VALUES ($1,'Doc','d',$2,'document','document',$3,'Ana Souza Teste','{"document_last4":"1234"}') RETURNING id`, [userId, status, code])).rows[0].id;
      const s = await scanById(id);
      expect('titular' in s).toBe(false);
      expect('documento_final' in s).toBe(false);
    }
  });

  it('legado e sinal público continuam sem os campos, em qualquer status', async () => {
    for (const [source, legacy] of [['public_signal', false], [null, true]] as const) {
      const code = randomUUID().slice(0, 8).toUpperCase();
      const id = (await pool.query(
        `INSERT INTO objects (user_id, title, description, status, category, type, qr_code, subject_name, category_fields, source, is_legacy)
         VALUES ($1,'Doc','d','lost','document','document',$2,'Ana Souza Teste','{"document_last4":"1234"}',$3,$4) RETURNING id`, [userId, code, source, legacy])).rows[0].id;
      const s = await scanById(id);
      expect('titular' in s).toBe(false);
    }
  });

  it('POST «encontrei»: titular e final são ignorados (não gravam); tipo continua', async () => {
    const id = (await (await post({ ...doc, status: 'found' })).json()).id;
    const r = await row(id);
    expect(r.subject_name).toBeNull();
    expect(r.category_fields.document_last4).toBeUndefined();
    expect(r.document_type).toBe('rg');
    const s = await scanById(id);
    expect('titular' in s).toBe(false);
  });

  it('POST sem status (padrão perdi) segue gravando', async () => {
    const id = (await (await post({ ...doc })).json()).id;
    expect((await row(id)).subject_name).toBe('Ana Souza Teste');
  });

  it('PATCH lost -> found: some da saída pública, o dado gravado não é apagado; found -> lost volta a aparecer', async () => {
    const id = (await (await post({ ...doc, status: 'lost' })).json()).id;
    expect((await scanById(id)).titular).toBe('Ana Souza Teste');
    await PATCH(req('PATCH', userId, { status: 'found' }), { params: { id } });
    expect('titular' in (await scanById(id))).toBe(false);
    expect((await row(id)).subject_name).toBe('Ana Souza Teste'); // não apagou
    await PATCH(req('PATCH', userId, { status: 'lost' }), { params: { id } });
    expect((await scanById(id)).titular).toBe('Ana Souza Teste');
  });

  it('PATCH que muda para found ou em objeto found: titular e final recebidos são ignorados (nada alterado)', async () => {
    const id = (await (await post({ ...doc, status: 'lost' })).json()).id;
    await PATCH(req('PATCH', userId, { status: 'found', document_owner_name: 'Outro Nome Teste', document_last4: '9999' }), { params: { id } });
    let r = await row(id);
    expect(r.subject_name).toBe('Ana Souza Teste');
    expect(r.category_fields.document_last4).toBe('1234');
    await PATCH(req('PATCH', userId, { document_owner_name: '', document_last4: '' }), { params: { id } }); // já está found
    r = await row(id);
    expect(r.subject_name).toBe('Ana Souza Teste');
    expect(r.category_fields.document_last4).toBe('1234');
  });

  it('PATCH em perdi segue atualizando titular e final (sem mudança)', async () => {
    const id = (await (await post({ ...doc, status: 'lost' })).json()).id;
    await PATCH(req('PATCH', userId, { document_owner_name: 'Bia Lima Teste', document_last4: '5678' }), { params: { id } });
    const r = await row(id);
    expect(r.subject_name).toBe('Bia Lima Teste');
    expect(r.category_fields.document_last4).toBe('5678');
  });

  it('outras categorias: resposta da API por código idêntica (sem chaves de documento) em qualquer status', async () => {
    for (const status of ['lost', 'found']) {
      const id = (await (await post({ title: 'Celular', description: 'aparelho preto', category: 'phone', status })).json()).id;
      const s = await scanById(id);
      expect(Object.keys(s).filter((k) => ['titular', 'documento_final'].includes(k))).toEqual([]);
    }
  });
});

describe('regressão estática: gate é lista de permissão e a saída pública só vem da API por código', () => {
  const ler = (p: string) => readFileSync(p, 'utf8');
  it('a API por código usa a lista de permissão', () => {
    const s = ler('src/app/api/v1/objects/scan/[code]/route.ts');
    expect(s).toMatch(/statusMostraTitular\(row\.status\)/);
    expect(s).not.toMatch(/status !== 'found'/);
  });
  it('POST e PATCH usam o corte de «encontrei»', () => {
    expect(ler('src/app/api/v1/objects/route.ts')).toMatch(/statusIgnoraTitular\(status \|\| 'lost'\)/);
    expect(ler('src/app/api/v1/objects/[id]/route.ts')).toMatch(/!statusIgnoraTitular\(linhaFinal\.status\)/);
  });
  it('nenhuma outra saída lê o titular ou o final', () => {
    const { execSync } = require('child_process');
    const achados = execSync(`grep -rlE "subject_name|document_last4" src --include=*.ts --include=*.tsx || true`, { encoding: 'utf8' }).trim().split('\n').sort();
    expect(achados).toEqual([
      'src/app/api/v1/objects/[id]/route.ts',
      'src/app/api/v1/objects/route.ts',
      'src/app/api/v1/objects/scan/[code]/route.ts',
      'src/app/dashboard/objects/[id]/edit/page.tsx',
      'src/app/dashboard/objects/new/page.tsx',
      'src/config/categoryFields.ts',
      'src/lib/documentPrivacy.ts',
      'src/types/index.ts',
    ].sort());
  });
});
