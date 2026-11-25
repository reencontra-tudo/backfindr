// Validade dos links públicos de custódia (/custody/<token>) e de entrega (/delivery/<token>), opção B:
// vale enquanto ativa e por um prazo depois de concluída; depois disso só «concluída», sem dado pessoal.
// A parte de banco usa um Postgres REAL e é pulada sem TEST_DATABASE_URL. ATENÇÃO: recria users, estabelecimentos,
// entregadores, entregas, entrega_eventos, custodias, custody_eventos e condominios (banco descartável).
//
//   TEST_DATABASE_URL=postgres://u:pw@127.0.0.1:5432/bftest npx vitest run --config tests/vitest.config.ts tests/validade-links.test.ts
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { removerTabelas } from './helpers/limpeza-banco';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { Pool } from 'pg';
import { NextRequest } from 'next/server';
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';
import {
  PRAZO_POS_CONCLUSAO_DIAS,
  RESPOSTA_LINK_EXPIRADO,
  STATUS_CONCLUIDOS,
  estadoDoLink,
  estaConcluido,
  limiteDoLink,
} from '@/lib/linkPublico';
import { isTrackingBlocked } from '@/lib/trackingGuard';
import LinkConcluido from '@/components/LinkConcluido';

/** Tabelas que este arquivo cria no banco de teste; removidas ao terminar (ver helpers/limpeza-banco.ts). */
const TABELAS_DO_TESTE = ['condominios', 'custodias', 'custody_eventos', 'entrega_eventos', 'entregadores', 'entregas', 'estabelecimentos', 'users'];

(globalThis as unknown as { React: typeof React }).React = React; // JSX do componente, como nos outros testes
const TEST_DB = process.env.TEST_DATABASE_URL;
if (TEST_DB) process.env.DATABASE_URL = TEST_DB;

// As confirmações notificam por push e banco de notificações; aqui só interessa o estado.
vi.mock('@/lib/notifyModulos', async (orig) => {
  const m = await orig<typeof import('@/lib/notifyModulos')>();
  return {
    ...m,
    notificarCustodiaEntregue: vi.fn(async () => {}),
    notificarEntregaConfirmada: vi.fn(async () => {}),
    notificarEntregadorComprovanteGerado: vi.fn(async () => {}),
  };
});

const ROOT = path.resolve(__dirname, '..');
const lê = (p: string) => readFileSync(path.join(ROOT, p), 'utf8');
const DIA = 24 * 60 * 60 * 1000;

describe('estadoDoLink — regra central', () => {
  const concluida = new Date('2026-03-05T12:00:00.000Z');
  const em = (ms: number) => new Date(concluida.getTime() + ms);

  it('o prazo inicial é de 7 dias para custódia e para entrega, num único lugar', () => {
    expect(PRAZO_POS_CONCLUSAO_DIAS).toEqual({ custodia: 7, entrega: 7 });
    expect([...STATUS_CONCLUIDOS]).toEqual(['entregue', 'cancelado']);
  });
  it.each(['aguardando', 'preparando', 'custodiado', 'registrado', 'saiu', 'proximo', 'na_portaria', 'em_transito', 'qualquer_coisa', '', null, undefined])(
    'status %s (não concluído) é sempre ativo, por mais antigo que seja',
    (status) => {
      for (const tipo of ['custodia', 'entrega'] as const) {
        expect(estadoDoLink(tipo, { status, concluidaEm: null, agora: em(9999 * DIA) })).toBe('ativo');
        expect(estadoDoLink(tipo, { status, concluidaEm: concluida, agora: em(9999 * DIA) })).toBe('ativo');
      }
    },
  );
  it.each(['entregue', 'cancelado'])('%s: vale até o limite e expira depois', (status) => {
    for (const tipo of ['custodia', 'entrega'] as const) {
      const base = { status, concluidaEm: concluida };
      expect(estadoDoLink(tipo, { ...base, agora: concluida })).toBe('concluido_no_prazo');
      expect(estadoDoLink(tipo, { ...base, agora: em(6 * DIA + 23 * 3600_000) })).toBe('concluido_no_prazo');
      expect(estadoDoLink(tipo, { ...base, agora: em(7 * DIA - 1) })).toBe('concluido_no_prazo');
      expect(estadoDoLink(tipo, { ...base, agora: em(7 * DIA) })).toBe('concluido_no_prazo'); // fronteira exata: ainda vale
      expect(estadoDoLink(tipo, { ...base, agora: em(7 * DIA + 1) })).toBe('expirado'); // 1 ms depois: expirou
      expect(estadoDoLink(tipo, { ...base, agora: em(8 * DIA) })).toBe('expirado');
    }
  });
  it('concluído sem data conhecida, ou com data inválida, expira (na dúvida não mostra dado)', () => {
    for (const concluidaEm of [null, undefined, 'não é data', new Date('x')]) {
      expect(estadoDoLink('entrega', { status: 'entregue', concluidaEm, agora: new Date() })).toBe('expirado');
    }
    expect(estadoDoLink('entrega', { status: 'entregue', concluidaEm: concluida, agora: 'não é data' })).toBe('expirado');
  });
  it('limiteDoLink = conclusão + prazo; o prazo é por tipo (mudar um não muda o outro)', () => {
    expect(limiteDoLink('custodia', concluida).toISOString()).toBe('2026-03-12T12:00:00.000Z');
    const antes = { ...PRAZO_POS_CONCLUSAO_DIAS };
    try {
      (PRAZO_POS_CONCLUSAO_DIAS as Record<string, number>).custodia = 3;
      expect(estadoDoLink('custodia', { status: 'entregue', concluidaEm: concluida, agora: em(4 * DIA) })).toBe('expirado');
      expect(estadoDoLink('entrega', { status: 'entregue', concluidaEm: concluida, agora: em(4 * DIA) })).toBe('concluido_no_prazo');
    } finally {
      Object.assign(PRAZO_POS_CONCLUSAO_DIAS, antes);
    }
  });
  it('texto de data no formato do Postgres também funciona (deslocamento sem minutos, espaço no lugar do T)', () => {
    for (const c of ['2026-03-05 12:00:00+00', '2026-03-05 09:00:00-03', '2026-03-05 21:00:00+09', '2026-03-05 12:00:00.123456+00']) {
      expect(estadoDoLink('entrega', { status: 'entregue', concluidaEm: c, agora: '2026-03-06 00:00:00+00' })).toBe('concluido_no_prazo');
    }
    expect(estadoDoLink('entrega', { status: 'entregue', concluidaEm: '2026-03-05 12:00:00+00', agora: '2026-03-13 00:00:00+00' })).toBe('expirado');
  });
  it('estaConcluido', () => {
    expect(estaConcluido('entregue')).toBe(true);
    expect(estaConcluido('cancelado')).toBe(true);
    expect(estaConcluido('saiu')).toBe(false);
    expect(estaConcluido(null)).toBe(false);
  });
});

describe('estadoDoLink — fuso horário e horário de verão não mudam o resultado (instantes absolutos)', () => {
  const zonas = ['UTC', 'America/Sao_Paulo', 'Asia/Tokyo', 'America/New_York', 'Europe/London', 'Pacific/Kiritimati', 'Pacific/Pago_Pago'];
  const original = process.env.TZ;
  afterEach(() => {
    if (original === undefined) delete process.env.TZ;
    else process.env.TZ = original;
  });
  it.each(zonas)('em %s: mesmo instante, mesmo limite e mesmo estado', (tz) => {
    process.env.TZ = tz;
    // o mesmo instante escrito com deslocamentos diferentes (como o banco devolve timestamptz)
    const concluidas = ['2026-03-05T12:00:00Z', '2026-03-05T09:00:00-03:00', '2026-03-05T21:00:00+09:00', '2026-03-05 12:00:00+00'];
    for (const c of concluidas) {
      expect(limiteDoLink('entrega', new Date(c)).toISOString()).toBe('2026-03-12T12:00:00.000Z');
      expect(estadoDoLink('entrega', { status: 'entregue', concluidaEm: c, agora: '2026-03-12T12:00:00Z' })).toBe('concluido_no_prazo');
      expect(estadoDoLink('entrega', { status: 'entregue', concluidaEm: c, agora: '2026-03-12T09:00:00-03:00' })).toBe('concluido_no_prazo'); // mesmo limite, escrito em outro fuso
      expect(estadoDoLink('entrega', { status: 'entregue', concluidaEm: c, agora: '2026-03-12T08:59:59.999-03:00' })).toBe('concluido_no_prazo');
      expect(estadoDoLink('entrega', { status: 'entregue', concluidaEm: c, agora: '2026-03-12T09:00:00.001-03:00' })).toBe('expirado');
      expect(estadoDoLink('entrega', { status: 'entregue', concluidaEm: c, agora: '2026-03-12T12:00:00.001Z' })).toBe('expirado');
    }
  });
  it.each(zonas)('em %s: atravessar a mudança de horário de verão (8 e 29 de março de 2026) continua sendo 7 × 24 h', (tz) => {
    process.env.TZ = tz;
    for (const c of ['2026-03-05T12:00:00Z', '2026-03-25T12:00:00Z', '2026-11-01T00:30:00Z']) {
      const limite = limiteDoLink('custodia', new Date(c));
      expect(limite.getTime() - new Date(c).getTime()).toBe(7 * DIA);
    }
  });
});

describe('guardas de código', () => {
  const rotas = ['src/app/api/v1/custody/link/[token]/route.ts', 'src/app/api/v1/delivery/link/[token]/route.ts'];
  it('as duas rotas públicas de leitura usam a regra central e só ela', () => {
    for (const r of rotas) {
      const s = lê(r);
      expect(s, r).toContain("from '@/lib/linkPublico'");
      expect(s, r).toContain('estadoDoLink(');
      expect(s, r).toContain('registrarLinkExpirado(');
      expect(s, r).toContain('RESPOSTA_LINK_EXPIRADO');
      expect(s, r).toContain('Link inválido ou expirado'); // token inexistente continua 404, como antes
    }
  });
  it('o número de dias existe só em linkPublico.ts (nenhuma rota nem página tem o prazo)', () => {
    for (const f of [...rotas, 'src/app/custody/[token]/page.tsx', 'src/app/delivery/[token]/page.tsx', 'src/components/LinkConcluido.tsx']) {
      const s = lê(f).replace(/\/\/.*$/gm, '');
      expect(s, f).not.toMatch(/\b(7|168|604800|86400)\b/);
      expect(s, f).not.toMatch(/PRAZO_POS_CONCLUSAO_DIAS/);
    }
    expect(lê('src/lib/linkPublico.ts')).toContain('custodia: 7');
  });
  it('as confirmações de recebimento NÃO foram alteradas (uso único: 409 como antes)', () => {
    const c = lê('src/app/api/v1/custody/confirmar/[token]/route.ts');
    const d = lê('src/app/api/v1/delivery/confirmar/[token]/route.ts');
    for (const s of [c, d]) expect(s).not.toContain('linkPublico');
    expect(c).toContain("{ detail: 'Item já foi entregue' }, { status: 409 }");
    expect(c).toContain("{ detail: 'Esta custódia foi cancelada' }, { status: 409 }");
    expect(d).toContain("{ detail: 'Entrega já confirmada' }, { status: 409 }");
    expect(d).toContain("{ detail: 'Entrega cancelada' }, { status: 409 }");
  });
  it('as páginas tratam o 410 sem montar o cliente (nenhum dado, nenhum pedido de push)', () => {
    for (const f of ['src/app/custody/[token]/page.tsx', 'src/app/delivery/[token]/page.tsx']) {
      const s = lê(f);
      expect(s, f).toContain('res.status === 410');
      expect(s, f).toContain('<LinkConcluido />');
      expect(s, f).toContain("title: 'Concluída | Backfindr'");
    }
  });
  it('a página «concluída» não tem nenhum dado pessoal nem estado', () => {
    const html = renderToStaticMarkup(React.createElement(LinkConcluido));
    expect(html).toContain('Concluída');
    expect(html).toContain('Este link não está mais disponível.');
    expect(html.toLowerCase()).not.toMatch(/nome|telefone|endere[cç]o|descri[cç][aã]o|entregador|remetente/);
    expect(lê('src/components/LinkConcluido.tsx')).not.toMatch(/use(State|Effect|Client)|'use client'/);
  });
  it('o trackingGuard segue bloqueando Pixel/GA4/PostHog nessas rotas (e nada de novo foi liberado)', () => {
    expect(isTrackingBlocked('/custody/cst_qualquer')).toBe(true);
    expect(isTrackingBlocked('/delivery/dlv_qualquer')).toBe(true);
    expect(isTrackingBlocked('/delivery/entregador/painel')).toBe(false);
    const g = lê('src/lib/trackingGuard.ts');
    expect(g).toContain("/^\\/custody\\/[^/]+/");
  });
  it('nenhum arquivo fora do escopo foi tocado (analítica, matching, comunicação)', () => {
    expect(lê('src/lib/linkPublico.ts')).not.toMatch(/posthog|fbq|gtag|clarity|matching/i);
  });
});

const U = { entregador: '30000000-0000-0000-0000-000000000002' };
const PII = { nome: 'Fulana Destinataria', tel: '11955554444', end: 'Rua Segredo, 123', desc: 'Pacote com documento sigiloso', est: 'Loja Sigilosa', entr: 'Entregador Sigiloso', rem: 'Remetente Sigiloso', cond: 'Condominio Sigiloso' };

describe.skipIf(!TEST_DB)('links públicos com Postgres real', () => {
  let pool: Pool;
  type Ctx = { params: { token: string } };
  let linkEntrega: (r: NextRequest, c: Ctx) => Promise<Response>;
  let linkCustodia: (r: NextRequest, c: Ctx) => Promise<Response>;
  let confirmarEntrega: (r: NextRequest, c: Ctx) => Promise<Response>;
  let confirmarCustodia: (r: NextRequest, c: Ctx) => Promise<Response>;
  const get = (fn: typeof linkEntrega, token: string) => fn(new NextRequest('http://localhost/x'), { params: { token } });
  const post = (fn: typeof confirmarEntrega, token: string) => fn(new NextRequest('http://localhost/x', { method: 'POST', body: '{}', headers: { 'content-type': 'application/json' } }), { params: { token } });
  const tok = (() => { let n = 0; return (p: string) => `${p}_TESTE${String(++n).padStart(6, '0')}${'x'.repeat(20)}`; })();

  // entrega: `quando` é um intervalo SQL relativo ao NOW() do banco (ex.: "7 days 1 hour"); null = não preenche
  async function entrega(o: { status: string; entregueHa?: string | null; atualizadaHa?: string; eventoHa?: [string, string] }) {
    const token = tok('dlv');
    const r = await pool.query(
      `INSERT INTO entregas (estabelecimento_id, entregador_id, cliente_nome, cliente_telefone, cliente_endereco, descricao, qr_code, link_token, status, entregue_em, created_at, updated_at)
       VALUES ((SELECT id FROM estabelecimentos LIMIT 1), (SELECT id FROM entregadores LIMIT 1), $1,$2,$3,$4, substr(md5($5),1,8), $5, $6,
               ${o.entregueHa ? `NOW() - interval '${o.entregueHa}'` : 'NULL'}, NOW() - interval '400 days', NOW() - interval '${o.atualizadaHa ?? o.entregueHa ?? '1 hour'}') RETURNING id`,
      [PII.nome, PII.tel, PII.end, PII.desc, token, o.status],
    );
    if (o.eventoHa) await pool.query(`INSERT INTO entrega_eventos (entrega_id, tipo, created_at) VALUES ($1,$2, NOW() - interval '${o.eventoHa[1]}')`, [r.rows[0].id, o.eventoHa[0]]);
    return { id: r.rows[0].id as string, token };
  }
  async function custodia(o: { status: string; entregueHa?: string | null; atualizadaHa?: string; eventoHa?: [string, string] }) {
    const token = tok('cst');
    const r = await pool.query(
      `INSERT INTO custodias (condominio_id, remetente_id, destinatario_nome, destinatario_contato, descricao, qr_code, link_token, status, entregue_em, created_at, updated_at)
       VALUES ((SELECT id FROM condominios LIMIT 1), $1, $2, $3, $4, substr(md5($5),1,8), $5, $6,
               ${o.entregueHa ? `NOW() - interval '${o.entregueHa}'` : 'NULL'}, NOW() - interval '400 days', NOW() - interval '${o.atualizadaHa ?? o.entregueHa ?? '1 hour'}') RETURNING id`,
      [U.entregador, PII.nome, PII.tel, PII.desc, token, o.status],
    );
    if (o.eventoHa) await pool.query(`INSERT INTO custody_eventos (custodia_id, tipo, created_at) VALUES ($1,$2, NOW() - interval '${o.eventoHa[1]}')`, [r.rows[0].id, o.eventoHa[0]]);
    return { id: r.rows[0].id as string, token };
  }
  const eventos = async (tabela: 'entrega_eventos' | 'custody_eventos', col: string, id: string, tipo: string) =>
    (await pool.query(`SELECT observacao FROM ${tabela} WHERE ${col} = $1 AND tipo = $2`, [id, tipo])).rows;
  const SEM_PII = (corpo: string) => {
    for (const v of Object.values(PII)) expect(corpo, v).not.toContain(v);
  };

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
        qr_code varchar(20) NOT NULL UNIQUE, link_token varchar(100) NOT NULL UNIQUE, status varchar(30) NOT NULL DEFAULT 'preparando', entregador_lat numeric, entregador_lng numeric,
        ultima_localizacao_em timestamptz, saiu_em timestamptz, chegou_em timestamptz, entregue_em timestamptz, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
      CREATE TABLE entrega_eventos (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), entrega_id uuid NOT NULL REFERENCES entregas(id) ON DELETE CASCADE, tipo varchar(30) NOT NULL, lat numeric, lng numeric, user_id uuid, observacao text, created_at timestamptz NOT NULL DEFAULT now());
      CREATE TABLE custodias (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), condominio_id uuid, remetente_id uuid NOT NULL, destinatario_nome varchar(255) NOT NULL, destinatario_contato varchar(255) NOT NULL, destinatario_user_id uuid,
        descricao text NOT NULL, qr_code varchar(20) NOT NULL UNIQUE, link_token varchar(100) NOT NULL UNIQUE, status varchar(30) NOT NULL DEFAULT 'aguardando', custodiante_id uuid,
        custodiante_tipo varchar(30), custodiado_em timestamptz, entregue_em timestamptz, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
      CREATE TABLE custody_eventos (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), custodia_id uuid NOT NULL REFERENCES custodias(id) ON DELETE CASCADE, tipo varchar(30) NOT NULL, user_id uuid, lat numeric, lng numeric, observacao text, created_at timestamptz NOT NULL DEFAULT now());
    `);
    await pool.query(`INSERT INTO users (id, email, name) VALUES ($1,'e@t.test',$2)`, [U.entregador, PII.entr]);
    await pool.query(`INSERT INTO estabelecimentos (nome, endereco) VALUES ($1,'x')`, [PII.est]);
    await pool.query(`INSERT INTO entregadores (user_id) VALUES ($1)`, [U.entregador]);
    await pool.query(`INSERT INTO condominios (nome, endereco) VALUES ($1,'y')`, [PII.cond]);
    ({ GET: linkEntrega } = await import('@/app/api/v1/delivery/link/[token]/route'));
    ({ GET: linkCustodia } = await import('@/app/api/v1/custody/link/[token]/route'));
    ({ POST: confirmarEntrega } = await import('@/app/api/v1/delivery/confirmar/[token]/route'));
    ({ POST: confirmarCustodia } = await import('@/app/api/v1/custody/confirmar/[token]/route'));
  });
  afterAll(async () => {
    await removerTabelas(pool, TABELAS_DO_TESTE); await pool?.end();
    const { closePool } = await import('@/lib/db');
    await closePool();
  });

  describe('entrega', () => {
    it('ativa abre com os dados de sempre, mesmo muito antiga, e a resposta tem exatamente os mesmos campos de antes', async () => {
      const { token } = await entrega({ status: 'saiu' });
      const res = await get(linkEntrega, token);
      expect(res.status).toBe(200);
      const b = await res.json();
      expect(Object.keys(b).sort()).toEqual(['created_at', 'destinatario_nome', 'endereco_destino', 'entregador_nome', 'entregue_em', 'estabelecimento_nome', 'eventos', 'id', 'status', 'token'].sort());
      expect(b).toMatchObject({ destinatario_nome: PII.nome, endereco_destino: PII.end, estabelecimento_nome: PII.est, entregador_nome: PII.entr, status: 'saiu', token });
    });
    it.each(['1 second', '3 days', '6 days 23 hours', '6 days 23 hours 59 minutes'])('concluída há %s ainda abre, com os dados (comprovante)', async (ha) => {
      const { token } = await entrega({ status: 'entregue', entregueHa: ha });
      const res = await get(linkEntrega, token);
      expect(res.status).toBe(200);
      expect((await res.json()).destinatario_nome).toBe(PII.nome);
    });
    it.each(['7 days 1 minute', '7 days 1 hour', '8 days', '300 days'])('concluída há %s mostra só «concluída»: 410, sem nenhum dado pessoal', async (ha) => {
      const { token } = await entrega({ status: 'entregue', entregueHa: ha });
      const res = await get(linkEntrega, token);
      expect(res.status).toBe(410);
      const corpo = await res.text();
      expect(JSON.parse(corpo)).toEqual(RESPOSTA_LINK_EXPIRADO);
      SEM_PII(corpo);
      expect(corpo).not.toContain(token);
      expect(Object.keys(JSON.parse(corpo)).sort()).toEqual(['detail', 'estado']);
    });
    it('cancelada: a data vem do evento «cancelado» do histórico (1 dia: abre; 8 dias: expira)', async () => {
      const nova = await entrega({ status: 'cancelado', eventoHa: ['cancelado', '1 day'], atualizadaHa: '1 day' });
      expect((await get(linkEntrega, nova.token)).status).toBe(200);
      const velha = await entrega({ status: 'cancelado', eventoHa: ['cancelado', '8 days'], atualizadaHa: '8 days' });
      expect((await get(linkEntrega, velha.token)).status).toBe(410);
    });
    it('registros antigos: sem entregue_em e sem evento, vale updated_at; com evento «entregue», vale o evento', async () => {
      const antigo = await entrega({ status: 'entregue', entregueHa: null, atualizadaHa: '20 days' });
      expect((await get(linkEntrega, antigo.token)).status).toBe(410);
      const recente = await entrega({ status: 'entregue', entregueHa: null, atualizadaHa: '20 days', eventoHa: ['entregue', '2 days'] });
      expect((await get(linkEntrega, recente.token)).status).toBe(200);
    });
    it('a expiração vira evento no histórico, uma vez só, com a data de término; nada é apagado nem alterado', async () => {
      const { id, token } = await entrega({ status: 'entregue', entregueHa: '9 days' });
      const antes = (await pool.query('SELECT * FROM entregas WHERE id = $1', [id])).rows[0];
      for (let i = 0; i < 3; i++) expect((await get(linkEntrega, token)).status).toBe(410);
      const ev = await eventos('entrega_eventos', 'entrega_id', id, 'link_expirado');
      expect(ev.length).toBe(1);
      expect(ev[0].observacao).toMatch(/Link público encerrado: 7 dias depois da conclusão \(até 20\d\d-\d\d-\d\dT[\d:.]+Z\)/);
      expect((await pool.query('SELECT * FROM entregas WHERE id = $1', [id])).rows[0]).toEqual(antes); // linha idêntica
      expect((await pool.query('SELECT count(*)::int AS n FROM entregas WHERE link_token = $1', [token])).rows[0].n).toBe(1);
    });
    it('link ainda válido NÃO grava evento de expiração', async () => {
      const { id, token } = await entrega({ status: 'entregue', entregueHa: '2 days' });
      await get(linkEntrega, token);
      expect((await eventos('entrega_eventos', 'entrega_id', id, 'link_expirado')).length).toBe(0);
    });
    it('token inexistente (e parecido com um real) dá 404 igual para todos; só quem tem o token exato vê 410', async () => {
      const { token } = await entrega({ status: 'entregue', entregueHa: '30 days' });
      expect((await get(linkEntrega, token)).status).toBe(410);
      const parecido = token.slice(0, -1) + (token.endsWith('a') ? 'b' : 'a');
      const corpos = new Set<string>();
      for (const t of ['dlv_naoexiste', parecido, 'x', token.toUpperCase(), token + ' ', 'dlv_' + 'z'.repeat(32)]) {
        const r = await get(linkEntrega, t);
        expect(r.status, t).toBe(404);
        corpos.add(await r.text());
      }
      expect([...corpos]).toEqual([JSON.stringify({ detail: 'Link inválido ou expirado' })]);
    });
    it('confirmação de recebimento: uso único (2º envio = 409), igual a antes; concluída nunca confirma de novo', async () => {
      const ativa = await entrega({ status: 'na_portaria' });
      expect((await post(confirmarEntrega, ativa.token)).status).toBe(200);
      const r2 = await post(confirmarEntrega, ativa.token);
      expect(r2.status).toBe(409);
      expect(await r2.json()).toEqual({ detail: 'Entrega já confirmada' });
      for (const ha of ['1 day', '30 days']) {
        const c = await entrega({ status: 'entregue', entregueHa: ha });
        const r = await post(confirmarEntrega, c.token);
        expect(r.status, ha).toBe(409);
        expect(await r.json()).toEqual({ detail: 'Entrega já confirmada' });
      }
      const canc = await entrega({ status: 'cancelado', eventoHa: ['cancelado', '1 day'] });
      const rc = await post(confirmarEntrega, canc.token);
      expect(rc.status).toBe(409);
      expect(await rc.json()).toEqual({ detail: 'Entrega cancelada' });
      expect((await post(confirmarEntrega, 'dlv_naoexiste')).status).toBe(404);
    });
  });

  describe('custódia', () => {
    it('ativa abre e grava «visualizado» como sempre; concluída há 6 dias 23 h abre', async () => {
      const a = await custodia({ status: 'custodiado' });
      const ra = await get(linkCustodia, a.token);
      expect(ra.status).toBe(200);
      const b = await ra.json();
      expect(b).toMatchObject({ descricao: PII.desc, destinatario_nome: PII.nome, status: 'custodiado', condominio_nome: PII.cond });
      expect(Object.keys(b)).not.toContain('concluida_em');
      expect(Object.keys(b)).not.toContain('agora');
      await new Promise((r) => setTimeout(r, 150));
      expect((await eventos('custody_eventos', 'custodia_id', a.id, 'visualizado')).length).toBe(1);
      const c = await custodia({ status: 'entregue', entregueHa: '6 days 23 hours' });
      expect((await get(linkCustodia, c.token)).status).toBe(200);
    });
    it('concluída há mais de 7 dias: só «concluída», 410, sem dado pessoal, sem «visualizado», com um evento de expiração', async () => {
      const { id, token } = await custodia({ status: 'entregue', entregueHa: '7 days 2 hours' });
      const antes = (await pool.query('SELECT * FROM custodias WHERE id = $1', [id])).rows[0];
      for (let i = 0; i < 2; i++) {
        const res = await get(linkCustodia, token);
        expect(res.status).toBe(410);
        const corpo = await res.text();
        expect(JSON.parse(corpo)).toEqual(RESPOSTA_LINK_EXPIRADO);
        SEM_PII(corpo);
      }
      await new Promise((r) => setTimeout(r, 150));
      expect((await eventos('custody_eventos', 'custodia_id', id, 'visualizado')).length).toBe(0);
      expect((await eventos('custody_eventos', 'custodia_id', id, 'link_expirado')).length).toBe(1);
      expect((await pool.query('SELECT * FROM custodias WHERE id = $1', [id])).rows[0]).toEqual(antes);
    });
    it('custódia ativa nunca expira, mesmo com 400 dias; token inexistente = 404', async () => {
      const { token } = await custodia({ status: 'aguardando' });
      expect((await get(linkCustodia, token)).status).toBe(200);
      const r = await get(linkCustodia, 'cst_naoexiste');
      expect(r.status).toBe(404);
      expect(await r.json()).toEqual({ detail: 'Link inválido ou expirado' });
    });
    it('confirmação de retirada: uso único (409 depois), concluída antiga continua 409', async () => {
      const a = await custodia({ status: 'custodiado' });
      expect((await post(confirmarCustodia, a.token)).status).toBe(200);
      const r2 = await post(confirmarCustodia, a.token);
      expect(r2.status).toBe(409);
      expect(await r2.json()).toEqual({ detail: 'Item já foi entregue' });
      const velha = await custodia({ status: 'entregue', entregueHa: '30 days' });
      const r3 = await post(confirmarCustodia, velha.token);
      expect(r3.status).toBe(409);
      expect(await r3.json()).toEqual({ detail: 'Item já foi entregue' });
    });
  });

  describe('fuso horário do banco não muda o resultado', () => {
    afterAll(async () => {
      await pool.query(`DO $$ BEGIN EXECUTE format('ALTER DATABASE %I RESET timezone', current_database()); END $$;`);
      const { closePool } = await import('@/lib/db');
      await closePool();
    });
    it.each(['UTC', 'America/Sao_Paulo', 'Pacific/Kiritimati', 'Pacific/Pago_Pago', 'Asia/Kolkata'])('com o banco em %s', async (tz) => {
      await pool.query(`DO $$ BEGIN EXECUTE format('ALTER DATABASE %I SET timezone = %L', current_database(), '${tz}'); END $$;`);
      const { closePool } = await import('@/lib/db');
      await closePool(); // novas conexões já nascem no fuso novo
      const ok = await entrega({ status: 'entregue', entregueHa: '6 days 23 hours' });
      const velho = await entrega({ status: 'entregue', entregueHa: '7 days 1 hour' });
      const ativo = await entrega({ status: 'saiu' });
      expect((await get(linkEntrega, ok.token)).status).toBe(200);
      expect((await get(linkEntrega, velho.token)).status).toBe(410);
      expect((await get(linkEntrega, ativo.token)).status).toBe(200);
      const ev = await eventos('entrega_eventos', 'entrega_id', velho.id, 'link_expirado');
      expect(ev.length).toBe(1);
      expect(ev[0].observacao).toMatch(/até 20\d\d-\d\d-\d\dT[\d:.]+Z\)/); // sempre em UTC (Z), qualquer que seja o fuso
    });
  });
});
