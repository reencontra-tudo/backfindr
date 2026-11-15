// Documento de USUÁRIO: nome do titular público por escolha do dono; número só com os 4 últimos dígitos.
// Parte 1: funções puras. Parte 2: POST/PATCH/leitura por código num Postgres REAL (pula sem TEST_DATABASE_URL).
// Só dados FICTÍCIOS.
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { Pool } from 'pg';
import { randomUUID } from 'crypto';
import { NextRequest } from 'next/server';
import { readFileSync } from 'fs';
import { mascararDigitosLongos, ultimos4Digitos, nomeDoTitular, tipoDeDocumento, camposDeDocumento } from '@/lib/documentPrivacy';

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

describe('mascararDigitosLongos', () => {
  it('CPF pontuado e só dígitos: fica só o final', () => {
    expect(mascararDigitosLongos('CPF 123.456.789-00 perdido')).toBe('CPF ***8900 perdido');
    expect(mascararDigitosLongos('cpf 12345678900')).toBe('cpf ***8900');
  });
  it('com espaços e hífens, RG e CNPJ', () => {
    expect(mascararDigitosLongos('RG 12 345 678 9')).toBe('RG ***6789');
    expect(mascararDigitosLongos('RG 12.345.678-9')).toBe('RG ***6789');
    expect(mascararDigitosLongos('CNPJ 12.345.678/0001-95')).toBe('CNPJ ***0195');
  });
  it('6 dígitos mascara; 5 dígitos e menos não', () => {
    expect(mascararDigitosLongos('número 123456')).toBe('número ***3456');
    expect(mascararDigitosLongos('número 12345')).toBe('número 12345');
    expect(mascararDigitosLongos('final 1234')).toBe('final 1234');
  });
  it('datas e CEP não são mascarados; texto sem número não muda', () => {
    expect(mascararDigitosLongos('perdi em 15/03/2030')).toBe('perdi em 15/03/2030');
    expect(mascararDigitosLongos('perdi em 15-03-30')).toBe('perdi em 15-03-30');
    expect(mascararDigitosLongos('Rua X, CEP 01310-100')).toBe('Rua X, CEP 01310-100');
    expect(mascararDigitosLongos('Carteira de identidade azul')).toBe('Carteira de identidade azul');
  });
  it('telefone é mascarado (comportamento informado)', () => {
    expect(mascararDigitosLongos('ligar 11 91234-5678')).toBe('ligar ***5678');
  });
  it('dois números no mesmo texto', () => {
    expect(mascararDigitosLongos('CPF 11122233344 e RG 123456789')).toBe('CPF ***3344 e RG ***6789');
  });
});

describe('ultimos4Digitos / campos', () => {
  it('trunca para os 4 últimos e ignora o que não é dígito', () => {
    expect(ultimos4Digitos('1234')).toBe('1234');
    expect(ultimos4Digitos('123.456.789-00')).toBe('8900');
    expect(ultimos4Digitos('12')).toBe('12');
    expect(ultimos4Digitos('abc')).toBeNull();
    expect(ultimos4Digitos('')).toBeNull();
    expect(ultimos4Digitos(null)).toBeNull();
    expect(ultimos4Digitos(12345678900)).toBe('8900');
  });
  it('tipo de documento só da lista', () => {
    expect(tipoDeDocumento('rg')).toBe('rg');
    expect(tipoDeDocumento('xpto')).toBeNull();
  });
  it('nome do titular: limpa, limita e mascara dígitos longos', () => {
    expect(nomeDoTitular('  Ana   Souza Teste ')).toBe('Ana Souza Teste');
    expect(nomeDoTitular('   ')).toBeNull();
    expect(nomeDoTitular('x'.repeat(300))!.length).toBe(100);
    expect(nomeDoTitular('Ana 12345678900')).toBe('Ana ***8900');
  });
  it('document_number (formato antigo) vira só os 4 últimos', () => {
    expect(camposDeDocumento({ document_number: '123.456.789-00' }).last4).toBe('8900');
    expect(camposDeDocumento({ document_last4: '99887766' }).last4).toBe('7766');
  });
});

describe.skipIf(!TEST_DB)('documento de usuário: POST, PATCH e leitura por código (Postgres real)', () => {
  let pool: Pool;
  let POST: (req: NextRequest) => Promise<Response>;
  let PATCH: (req: NextRequest, ctx: { params: { id: string } }) => Promise<Response>;
  let GETSCAN: (req: NextRequest, ctx: { params: { code: string } }) => Promise<Response>;
  let userId: string;

  const req = (method: string, uid: string, body?: unknown) =>
    new NextRequest('http://localhost/x', { method, headers: { authorization: `Bearer ${uid}`, 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const post = (body: Record<string, unknown>) => POST(req('POST', userId, { confirm_duplicate: true, status: 'lost', ...body }));
  const row = async (id: string) => (await pool.query('SELECT * FROM objects WHERE id = $1', [id])).rows[0];
  const scan = async (code: string) => (await (await GETSCAN(req('GET', userId), { params: { code } })).json());

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
  afterAll(async () => { vi.unstubAllGlobals(); await pool?.end(); });

  it('POST: titular e tipo vão para as colunas; só os 4 últimos dígitos ficam; número inteiro não existe em lugar nenhum', async () => {
    const res = await post({ title: 'RG perdido', description: 'Perdi minha carteira de identidade', category: 'document',
      document_type: 'rg', document_owner_name: 'Ana Souza Teste', document_number: '123.456.789-00' });
    expect(res.status).toBe(201);
    const id = (await res.json()).id;
    const r = await row(id);
    expect(r.subject_name).toBe('Ana Souza Teste');
    expect(r.document_type).toBe('rg');
    expect(r.category_fields.document_last4).toBe('8900');
    const tudo = JSON.stringify(r);
    expect(tudo).not.toMatch(/123\.?456\.?789/);
    expect(tudo).not.toContain('12345678900');
  });

  it('POST: document_last4 longo é truncado nos 4 últimos; chaves desconhecidas não entram em documento', async () => {
    const res = await post({ title: 'CPF perdido', description: 'Perdi meu documento CPF hoje', category: 'document',
      document_last4: '99887766', cpf: '11122233344', document_number: '11122233344', latitude: -23.5, longitude: -46.6 });
    const r = await row((await res.json()).id);
    expect(r.category_fields).toEqual({ latitude: -23.5, longitude: -46.6, document_last4: '7766' });
    expect(JSON.stringify(r)).not.toContain('11122233344');
  });

  it('POST: título e descrição de documento com número longo saem mascarados (4 últimos ficam); título/descrição curtos e datas intactos', async () => {
    const res = await post({ title: 'CPF 123.456.789-00 perdido', description: 'Perdi em 15/03/2030 o documento 12345678900, CEP 01310-100', category: 'document' });
    const r = await row((await res.json()).id);
    expect(r.title).toBe('CPF ***8900 perdido');
    expect(r.description).toBe('Perdi em 15/03/2030 o documento ***8900, CEP 01310-100');
  });

  it('POST: outras categorias saem IDÊNTICAS (texto com dígitos longos, campos extras, sem titular)', async () => {
    const res = await post({ title: 'Celular 11 91234-5678 perdido', description: 'IMEI 123456789012345 do aparelho', category: 'phone',
      document_owner_name: 'Fulano', document_number: '123456789', phone_model: 'X1' });
    const r = await row((await res.json()).id);
    expect(r.title).toBe('Celular 11 91234-5678 perdido');
    expect(r.description).toBe('IMEI 123456789012345 do aparelho');
    expect(r.subject_name).toBeNull();
    expect(r.document_type).toBeNull();
    expect(r.category_fields).toEqual({ document_owner_name: 'Fulano', document_number: '123456789', phone_model: 'X1' });
  });

  it('PATCH: atualiza titular e final, mascara texto, apaga com vazio; nunca guarda o inteiro', async () => {
    const id = (await (await post({ title: 'RG perdido', description: 'Perdi minha carteira', category: 'document', document_owner_name: 'Ana Souza Teste', document_last4: '1111' })).json()).id;
    const res = await PATCH(req('PATCH', userId, { title: 'RG 123456789 perdido', document_owner_name: 'Bia Lima Teste', document_number: '999.888.777-66' }), { params: { id } });
    expect(res.status).toBe(200);
    const r = await row(id);
    expect(r.title).toBe('RG ***6789 perdido');
    await PATCH(req('PATCH', userId, { description: 'Número do documento 12345678900 e final 1234' }), { params: { id } });
    expect((await row(id)).description).toBe('Número do documento ***8900 e final 1234');
    expect(r.subject_name).toBe('Bia Lima Teste');
    expect(r.category_fields.document_last4).toBe('7766');
    expect(JSON.stringify(r)).not.toContain('999.888');
    // sem os campos de documento no corpo: nada muda neles
    await PATCH(req('PATCH', userId, { description: 'Nova descrição curta' }), { params: { id } });
    const r2 = await row(id);
    expect(r2.subject_name).toBe('Bia Lima Teste');
    expect(r2.category_fields.document_last4).toBe('7766');
    // vazio apaga
    await PATCH(req('PATCH', userId, { document_owner_name: '', document_last4: '' }), { params: { id } });
    const r3 = await row(id);
    expect(r3.subject_name).toBeNull();
    expect(r3.category_fields.document_last4).toBeUndefined();
  });

  it('PATCH: objeto de outra categoria não é mascarado nem ganha titular', async () => {
    const id = (await (await post({ title: 'Celular', description: 'aparelho preto', category: 'phone' })).json()).id;
    await PATCH(req('PATCH', userId, { title: 'Celular 11912345678', document_owner_name: 'Fulano' }), { params: { id } });
    const r = await row(id);
    expect(r.title).toBe('Celular 11912345678');
    expect(r.subject_name).toBeNull();
  });

  it('leitura por código: titular e final só em documento de USUÁRIO; sem dado, sem as chaves; outros objetos idênticos', async () => {
    const mk = async (over: Record<string, unknown>) => {
      const code = randomUUID().slice(0, 8).toUpperCase();
      await pool.query(
        `INSERT INTO objects (user_id, title, description, status, category, type, qr_code, source, is_legacy, subject_name, category_fields)
         VALUES ($1,$2,'d','lost',$3,$3,$4,$5,$6,'Nome Fictício Teste', $7::jsonb)`,
        [userId, 'Titulo ' + code, over.category ?? 'document', code, over.source ?? null, over.legacy ?? false, JSON.stringify({ document_last4: '4321' })]);
      return code;
    };
    const user = await scan(await mk({}));
    expect(user.titular).toBe('Nome Fictício Teste');
    expect(user.documento_final).toBe('4321');
    const sinal = await scan(await mk({ source: 'public_signal' }));
    expect('titular' in sinal).toBe(false);
    expect('documento_final' in sinal).toBe(false);
    const legado = await scan(await mk({ legacy: true }));
    expect('titular' in legado).toBe(false);
    // documento de usuário que é do legado (conta legada): nunca recebe titular
    const donoLegado = randomUUID();
    await pool.query(`INSERT INTO users (id, plan, is_legacy) VALUES ($1, 'free', true)`, [donoLegado]);
    const codeL = randomUUID().slice(0, 8).toUpperCase();
    await pool.query(`INSERT INTO objects (user_id, title, description, status, category, type, qr_code, subject_name) VALUES ($1,'T','d','lost','document','document',$2,'Nome Fictício Legado')`, [donoLegado, codeL]);
    expect('titular' in (await scan(codeL))).toBe(false);
    const celular = await scan(await mk({ category: 'phone' }));
    expect('titular' in celular).toBe(false);
    expect('documento_final' in celular).toBe(false);
    // documento de usuário sem dados: sem as chaves
    const code = randomUUID().slice(0, 8).toUpperCase();
    await pool.query(`INSERT INTO objects (user_id, title, description, status, category, type, qr_code) VALUES ($1,'T','d','lost','document','document',$2)`, [userId, code]);
    const vazio = await scan(code);
    expect(Object.keys(vazio)).not.toContain('titular');
    expect(Object.keys(vazio)).not.toContain('documento_final');
  });
});

describe('regressão estática: máscara de nome segue só para sinal público; nada de gravação por outro caminho', () => {
  const ler = (p: string) => readFileSync(p, 'utf8');
  it('documentPrivacy não usa maskPersonNames e a máscara de nomes não é aplicada a objeto de usuário', () => {
    expect(ler('src/lib/documentPrivacy.ts')).not.toMatch(/maskPersonNames/);
    const scan = ler('src/app/api/v1/objects/scan/[code]/route.ts');
    expect(scan).toMatch(/row\.source !== 'public_signal'/);
    expect(scan).toMatch(/row\.legacy_blocked !== true/);
  });
  it('POST e PATCH só aplicam a máscara de dígitos quando a categoria é documento', () => {
    expect(ler('src/app/api/v1/objects/route.ts')).toMatch(/const ehDocumento = \(category \|\| type\) === 'document'/);
    const patch = ler('src/app/api/v1/objects/[id]/route.ts');
    expect(patch).toMatch(/categoriaFinal === 'document'/);
    expect(patch).toMatch(/atual\.source !== 'public_signal'/);
    expect(patch).toMatch(/atual\.is_legacy !== true/);
  });
  it('o formulário não pede mais o número inteiro nem campos que são descartados', () => {
    const cfg = ler('src/config/categoryFields.ts');
    expect(cfg).not.toMatch(/name: 'document_number'/);
    expect(cfg).toMatch(/name: 'document_last4'/);
    expect(cfg).toMatch(/maxLength: 4/);
  });
});
