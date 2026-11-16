// Área de mensagens (Fase 1), com Postgres REAL (só com TEST_DATABASE_URL): fluxo completo com dois usuários, matriz estado × ator, IDOR,
// legado e sinal público, limites, «o objeto só muda no É o meu», RLS, anonimização e rotinas do cron. Banco próprio e descartável
// (backfindr_conv_test), criado a partir do servidor de teste; nada de produção. Nomes e dados inventados.
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { readFileSync } from 'fs';
import path from 'path';
import { Pool } from 'pg';

const TEST_DB = process.env.TEST_DATABASE_URL;
const h = vi.hoisted(() => {
  process.env.SECRET_KEY = process.env.SECRET_KEY || 'chave-de-teste-nao-real-0123456789';
  process.env.CRON_SECRET = 'cron-teste';
  const base = process.env.TEST_DATABASE_URL;
  if (base) process.env.DATABASE_URL = base.replace(/\/[^/?]+$/, '/backfindr_conv_test');
  return { pushes: [] as { user: string; payload: Record<string, string>; opts: unknown }[], emails: [] as { to: string; obj: Record<string, unknown> }[] };
});
vi.mock('@/lib/pushNotification', async (orig) => ({ ...(await orig<Record<string, unknown>>()), sendPushToUser: vi.fn(async (user: string, payload: Record<string, string>, opts: unknown) => { h.pushes.push({ user, payload, opts }); }) }));
vi.mock('@/lib/email', async (orig) => ({ ...(await orig<Record<string, unknown>>()), sendObjectFoundEmail: vi.fn(async (to: { email: string }, obj: Record<string, unknown>) => { h.emails.push({ to: to.email, obj }); }) }));

const SQL_ESQUEMA = `
CREATE TABLE IF NOT EXISTS users (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text, email text, is_legacy boolean DEFAULT false, is_system_account boolean DEFAULT false);
CREATE TABLE IF NOT EXISTS objects (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid, title text, status text, category text, source text, qr_code text, is_legacy boolean DEFAULT false,
  found_pending_confirmation boolean DEFAULT false, found_pending_since timestamptz, updated_at timestamptz DEFAULT now());
ALTER TABLE objects ALTER COLUMN found_pending_confirmation SET DEFAULT false;
CREATE TABLE IF NOT EXISTS notifications (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid, title text, message text, type text, url text, read boolean DEFAULT false, created_at timestamp DEFAULT now());
CREATE TABLE IF NOT EXISTS object_events (id serial PRIMARY KEY, object_id uuid, type text, title text, description text, source text, actor_type text, actor_id text, user_id text, metadata jsonb, created_at timestamptz DEFAULT now());
CREATE TABLE IF NOT EXISTS user_lifecycle_events (id serial PRIMARY KEY, user_id uuid, object_id uuid, event_type text, created_at timestamptz DEFAULT now());
`;
const SQL_MIGRACAO = readFileSync(path.join(__dirname, '../src/db/migrations/025_conversas.sql'), 'utf8');

describe.skipIf(!TEST_DB)('área de mensagens (banco real)', () => {
  let pool: Pool; let jwt: typeof import('@/lib/jwt');
  const R: Record<string, any> = {};
  const U: Record<string, string> = {};   // nome -> id
  const tok = (n: string) => jwt.createAccessToken(U[n], `${n}@teste.local`);
  const call = async (fn: (r: NextRequest, c: any) => Promise<Response>, quem: string | null, url: string, o: { method?: string; body?: unknown; id?: string } = {}) => {
    const req = new NextRequest(`http://localhost${url}`, { method: o.method ?? 'POST', headers: { 'content-type': 'application/json', ...(quem ? { authorization: `Bearer ${tok(quem)}` } : {}) }, body: o.body !== undefined ? JSON.stringify(o.body) : undefined });
    const res = await fn(req, { params: { id: o.id ?? '', code: o.id ?? '' } });
    let json: any = null; try { json = await res.clone().json(); } catch { /* sem corpo */ }
    return { status: res.status, json };
  };
  const q = async (sql: string, p: unknown[] = []) => (await pool.query(sql, p)).rows;
  const reset = async () => {
    await new Promise((r) => setTimeout(r, 40));                                                                  // deixa terminar os eventos gravados «sem esperar»
    await pool.query(SQL_ESQUEMA); await pool.query(SQL_MIGRACAO);
    await pool.query('TRUNCATE users, objects, notifications, object_events, user_lifecycle_events, conversas, mensagens_conversa RESTART IDENTITY CASCADE');
    for (const [n, legado] of [['dono', false], ['achador', false], ['achador2', false], ['intruso', false], ['legado', true], ['achadorlegado', true]] as [string, boolean][]) {
      U[n] = (await q(`INSERT INTO users (name, email, is_legacy) VALUES ($1, $2, $3) RETURNING id`, [n, `${n}@teste.local`, legado]))[0].id;
    }
    await pool.query(`INSERT INTO objects (user_id, title, status, category, source, qr_code, is_legacy) VALUES
      ($1,'Mochila vermelha','lost','bag',NULL,'OBJ00001',false),
      ($2,'Carteira do legado','lost','wallet','webjetos','LEG00001',true),
      ($1,'Sinal público de teste','found','wallet','public_signal','SIG00001',false),
      ($1,'Chaves do dono','lost','keys',NULL,'OBJ00002',false)`, [U.dono, U.legado]);
    h.pushes.length = 0; h.emails.length = 0;
  };
  const aviso = (quem: string, codigo = 'OBJ00001', mensagem = 'Achei perto da estação.') => call(R.criar.POST, quem, '/api/v1/conversas', { body: { codigo, mensagem } });
  const obj = async (codigo = 'OBJ00001') => (await q(`SELECT found_pending_confirmation fp, found_pending_since fs, status FROM objects WHERE qr_code = $1`, [codigo]))[0];
  const A = (rota: 'aceitar' | 'recusar' | 'eOMeu' | 'enviar' | 'encerrar' | 'cancelar' | 'lida' | 'detalhe') => R[rota];
  const agir = (rota: Parameters<typeof A>[0], quem: string | null, id: string, body?: unknown) =>
    call(A(rota).fn, quem, `/api/v1/conversas/${id}/x`, { id, method: rota === 'detalhe' ? 'GET' : 'POST', body: rota === 'detalhe' ? undefined : body });
  const novaConversa = async (estado: string, extra: Record<string, unknown> = {}, codigo = 'OBJ00001', achador = 'achador') => {
    const id = (await q(`INSERT INTO conversas (object_id, objeto_titulo, achador_id, dono_id, estado, primeira_mensagem) SELECT id, title, $1, $2, $3, 'oi' FROM objects WHERE qr_code = $4 RETURNING id`, [U[achador], U.dono, estado, codigo]))[0].id as string;
    if (estado === 'aberta') await q(`UPDATE conversas SET aceita_em = now() WHERE id = $1`, [id]);
    for (const [k, v] of Object.entries(extra)) await q(`UPDATE conversas SET ${k} = $2 WHERE id = $1`, [id, v]);
    return id;
  };

  beforeAll(async () => {
    process.env.MENSAGENS_ATIVO = '1';
    const admin = new Pool({ connectionString: TEST_DB });
    const existe = await admin.query(`SELECT 1 FROM pg_database WHERE datname = 'backfindr_conv_test'`);
    if (existe.rows.length === 0) await admin.query('CREATE DATABASE backfindr_conv_test');
    await admin.end();
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
    jwt = await import('@/lib/jwt');
    R.criar = await import('@/app/api/v1/conversas/route');
    R.config = await import('@/app/api/v1/conversas/config/route');
    R.resumo = await import('@/app/api/v1/conversas/resumo/route');
    const d = async (p: string) => (await import(/* @vite-ignore */ `@/app/api/v1/conversas/[id]/${p}/route`));
    R.aceitar = { fn: (await d('aceitar')).POST }; R.recusar = { fn: (await d('recusar')).POST }; R.eOMeu = { fn: (await d('e-o-meu')).POST };
    R.enviar = { fn: (await d('enviar')).POST }; R.encerrar = { fn: (await d('encerrar')).POST }; R.cancelar = { fn: (await d('cancelar')).POST };
    R.lida = { fn: (await d('lida')).POST };
    R.detalhe = { fn: (await import('@/app/api/v1/conversas/[id]/route')).GET };
    R.notify = await import('@/app/api/v1/objects/scan/[code]/notify/route');
    R.cron = await import('@/app/api/v1/cron/found-pending-reminders/route');
    R.estado = await import('@/lib/conversas');
  });
  beforeEach(reset);
  afterAll(async () => { await pool?.end(); delete process.env.MENSAGENS_ATIVO; });

  describe('fluxo completo achador → dono', () => {
    it('avisar, aceitar, conversar, «É o meu», confirmar devolução e encerrar; o objeto só muda no «É o meu»', async () => {
      const novo = await aviso('achador'); expect(novo.status).toBe(201);
      const id = novo.json.conversa_id as string;
      expect(await obj()).toMatchObject({ fp: false, fs: null, status: 'lost' });                                 // aviso NÃO muda o objeto
      const c1 = (await q(`SELECT estado, primeira_mensagem, retencao_ate FROM conversas WHERE id = $1`, [id]))[0];
      expect(c1).toMatchObject({ estado: 'aguardando', primeira_mensagem: 'Achei perto da estação.', retencao_ate: null });
      // dono (não legado) é avisado: sino, push de texto FIXO e e-mail com link da conversa
      expect((await q(`SELECT type, url, message FROM notifications WHERE user_id = $1`, [U.dono]))[0]).toMatchObject({ type: 'conversa_aviso', url: `/dashboard/mensagens/${id}`, message: 'Alguém avisou que pode ter encontrado "Mochila vermelha". Veja o aviso e decida se quer conversar.' });
      expect(h.pushes.length).toBe(1); expect(h.pushes[0].user).toBe(U.dono); expect(JSON.stringify(h.pushes[0].payload)).not.toContain('perto da estação');
      expect(h.emails.length).toBe(1); expect(h.emails[0].obj.conversaId).toBe(id);

      expect((await agir('aceitar', 'dono', id)).status).toBe(200);
      expect(await obj()).toMatchObject({ fp: false });                                                           // aceitar NÃO muda o objeto
      expect((await agir('enviar', 'dono', id, { texto: 'Obrigado! Como era o fecho?' })).status).toBe(201);
      expect((await agir('enviar', 'achador', id, { texto: 'Tinha um chaveiro azul.' })).status).toBe(201);
      expect(h.pushes.slice(-1)[0].payload.body).toBe('Você tem uma nova mensagem no Backfindr.');              // texto fixo, sem a mensagem
      expect(h.pushes.slice(-1)[0].opts).toEqual({ event: 'chat_message' });

      expect((await agir('eOMeu', 'achador', id)).status).toBe(409);                                              // só o dono
      expect((await agir('eOMeu', 'dono', id)).status).toBe(200);
      expect(await obj()).toMatchObject({ fp: true });                                                           // AGORA o objeto vira «achado pendente»
      expect((await agir('encerrar', 'achador', id, { motivo: 'devolvido' })).status).toBe(409);                  // achador não confirma devolução
      // «Confirmar devolução»: o caminho de sempre (rota do objeto) e depois encerrar
      await q(`UPDATE objects SET status = 'returned', found_pending_confirmation = false WHERE qr_code = 'OBJ00001'`);
      expect((await agir('encerrar', 'dono', id, { motivo: 'devolvido' })).status).toBe(200);
      const fim = (await q(`SELECT estado, motivo, encerrada_em, retencao_ate, (retencao_ate > now() + interval '11 months' AND retencao_ate < now() + interval '13 months') AS doze FROM conversas WHERE id = $1`, [id]))[0];
      expect(fim).toMatchObject({ estado: 'encerrada', motivo: 'devolvido', doze: true });
      expect((await agir('enviar', 'dono', id, { texto: 'mais uma' })).status).toBe(409);                         // encerrada: ninguém escreve
      const msgs = (await agir('detalhe', 'dono', id)).json.mensagens as { autor: string; texto: string }[];
      expect(msgs.map((m) => m.autor)).toEqual(['outro', 'sistema', 'eu', 'outro', 'sistema', 'sistema']);
      expect(JSON.stringify((await agir('detalhe', 'achador', id)).json)).not.toMatch(/dono@teste|achador@teste|"autor_id"|"achador_id"|"dono_id"/);
    });
    it('«Não é meu»: conversa recusada, quem achou recebe o texto oficial e nada muda no objeto', async () => {
      const id = (await aviso('achador')).json.conversa_id; h.pushes.length = 0;
      expect((await agir('recusar', 'dono', id)).status).toBe(200);
      expect(await obj()).toMatchObject({ fp: false, status: 'lost' });
      const c = (await q(`SELECT estado, motivo, retencao_ate IS NOT NULL AS ret FROM conversas WHERE id = $1`, [id]))[0]; expect(c).toMatchObject({ estado: 'recusada', motivo: 'recusada', ret: true });
      expect((await q(`SELECT message FROM notifications WHERE user_id = $1 AND type = 'conversa_recusada'`, [U.achador]))[0].message).toBe('A pessoa informou que este objeto não é dela.');
      expect(h.pushes[0].payload.body).toBe('A pessoa informou que este objeto não é dela.');
    });
    it('o achador cancela o aviso enquanto aguarda; o objeto não muda', async () => {
      const id = (await aviso('achador')).json.conversa_id;
      expect((await agir('cancelar', 'dono', id)).status).toBe(409); expect((await agir('cancelar', 'achador', id)).status).toBe(200);
      expect((await q(`SELECT estado, motivo FROM conversas WHERE id = $1`, [id]))[0]).toMatchObject({ estado: 'cancelada', motivo: 'cancelado_achador' });
      expect(await obj()).toMatchObject({ fp: false });
    });
    it('«desisti» encerra sem mexer no objeto; depois de «É o meu» o dono não pode mais «Não é meu»', async () => {
      const id = await novaConversa('aberta');
      expect((await agir('encerrar', 'achador', id, { motivo: 'desisti' })).status).toBe(200); expect(await obj()).toMatchObject({ fp: false });
      const id2 = await novaConversa('aberta', { confirmado_dono_em: new Date().toISOString() }, 'OBJ00002');
      expect((await agir('recusar', 'dono', id2)).status).toBe(409);
      expect((await agir('encerrar', 'dono', id2, { motivo: 'qualquer' })).status).toBe(400);
    });
  });

  describe('matriz estado × ator (rota × tabela escrita à mão)', () => {
    // 200/201 = permitido; 409 = estado não permite. Linhas: [estado, confirmado?], colunas por papel.
    const casos: [string, boolean, Record<string, [number, number]>][] = [
      // ação:            [dono, achador]
      ['aguardando', false, { aceitar: [200, 409], recusar: [200, 409], eOMeu: [409, 409], enviar: [409, 409], desisti: [409, 409], cancelar: [409, 200] }],
      ['aberta', false,     { aceitar: [409, 409], recusar: [200, 409], eOMeu: [200, 409], enviar: [201, 201], desisti: [200, 200], cancelar: [409, 409] }],
      ['aberta', true,      { aceitar: [409, 409], recusar: [409, 409], eOMeu: [409, 409], enviar: [201, 201], desisti: [200, 200], cancelar: [409, 409] }],
      ['recusada', false,   { aceitar: [409, 409], recusar: [409, 409], eOMeu: [409, 409], enviar: [409, 409], desisti: [409, 409], cancelar: [409, 409] }],
      ['encerrada', false,  { aceitar: [409, 409], recusar: [409, 409], eOMeu: [409, 409], enviar: [409, 409], desisti: [409, 409], cancelar: [409, 409] }],
      ['cancelada', false,  { aceitar: [409, 409], recusar: [409, 409], eOMeu: [409, 409], enviar: [409, 409], desisti: [409, 409], cancelar: [409, 409] }],
      ['arquivada', false,  { aceitar: [409, 409], recusar: [409, 409], eOMeu: [409, 409], enviar: [409, 409], desisti: [409, 409], cancelar: [409, 409] }],
    ];
    for (const [estado, conf, acoes] of casos) for (const [acao, [dono, achador]] of Object.entries(acoes)) for (const [papel, esperado] of [['dono', dono], ['achador', achador]] as const) {
      it(`${estado}${conf ? ' + É o meu' : ''} · ${acao} · ${papel} → ${esperado}`, async () => {
        const id = await novaConversa(estado, conf ? { confirmado_dono_em: new Date().toISOString() } : {});
        const quem = papel === 'dono' ? 'dono' : 'achador';
        const r = acao === 'enviar' ? await agir('enviar', quem, id, { texto: 'oi' }) : acao === 'desisti' ? await agir('encerrar', quem, id, { motivo: 'desisti' }) : await agir(acao as 'aceitar', quem, id);
        expect(r.status).toBe(esperado);
      });
    }
    it('a função podeFazer (fonte única) concorda com a tabela acima', () => {
      const { podeFazer } = R.estado;
      for (const [estado, conf, acoes] of casos) for (const [acao, [dono, achador]] of Object.entries(acoes)) for (const [papel, esperado] of [['dono', dono], ['achador', achador]] as const) {
        const nome = acao === 'eOMeu' ? 'e_o_meu' : acao === 'desisti' ? 'encerrar_desisti' : acao;
        expect(podeFazer({ estado, confirmado_dono_em: conf ? 'x' : null }, papel, nome), `${estado}/${acao}/${papel}`).toBe(esperado < 300);
      }
    });
  });

  describe('IDOR: quem não é parte não vê nem mexe', () => {
    it('terceiro recebe 404 em tudo (igual a «não existe»); sem login 401; id malformado 404', async () => {
      const id = await novaConversa('aberta');
      for (const rota of ['detalhe', 'aceitar', 'recusar', 'eOMeu', 'enviar', 'encerrar', 'cancelar', 'lida'] as const) {
        expect((await agir(rota, 'intruso', id, { texto: 'x', motivo: 'desisti' })).status, `${rota} terceiro`).toBe(404);
        expect((await agir(rota, null, id, { texto: 'x', motivo: 'desisti' })).status, `${rota} sem login`).toBe(401);
        expect((await agir(rota, 'dono', 'nao-e-uuid', { texto: 'x', motivo: 'desisti' })).status, `${rota} id ruim`).toBe(404);
        expect((await agir(rota, 'dono', '00000000-0000-0000-0000-000000000000', { texto: 'x', motivo: 'desisti' })).status, `${rota} inexistente`).toBe(404);
      }
      expect((await q(`SELECT estado FROM conversas WHERE id = $1`, [id]))[0].estado).toBe('aberta');
      expect((await q(`SELECT count(*)::int n FROM mensagens_conversa WHERE conversa_id = $1`, [id]))[0].n).toBe(0);
    });
    it('a lista e o resumo só trazem as conversas do próprio usuário', async () => {
      await novaConversa('aguardando');
      const lista = async (quem: string) => (await call(R.criar.GET, quem, '/api/v1/conversas', { method: 'GET' })).json.conversas as { id: string; papel: string; object_id: string | null }[];
      expect((await lista('dono')).length).toBe(1); expect((await lista('achador')).length).toBe(1); expect((await lista('intruso')).length).toBe(0);
      expect((await lista('achador'))[0].object_id).toBeNull();      // quem achou não recebe o id do objeto alheio
      expect((await call(R.resumo.GET, 'dono', '/api/v1/conversas/resumo', { method: 'GET' })).json).toMatchObject({ aguardando_voce: 1 });
      expect((await call(R.resumo.GET, 'intruso', '/api/v1/conversas/resumo', { method: 'GET' })).json).toMatchObject({ aguardando_voce: 0, total: 0 });
    });
    it('filtros da lista', async () => {
      await novaConversa('aguardando'); await novaConversa('aberta', {}, 'OBJ00002'); await novaConversa('encerrada');
      const f = async (quem: string, filtro: string) => (await call(R.criar.GET, quem, `/api/v1/conversas?filtro=${filtro}`, { method: 'GET' })).json.conversas.length;
      expect(await f('dono', 'aguardando_voce')).toBe(1); expect(await f('achador', 'aguardando_voce')).toBe(0); expect(await f('achador', 'aguardando_dono')).toBe(1);
      expect(await f('dono', 'abertas')).toBe(1); expect(await f('dono', 'encerradas')).toBe(1);
      expect((await call(R.criar.GET, 'dono', '/api/v1/conversas?filtro=hack', { method: 'GET' })).status).toBe(400);
    });
  });

  describe('legado e sinal público', () => {
    it('dono legado: o aviso fica guardado em «aguardando»; nada é enviado; nenhuma linha do legado muda', async () => {
      const antes = (await q(`SELECT md5(string_agg(o::text, ',' ORDER BY o.id)) h FROM objects o`))[0].h; const usuariosAntes = (await q(`SELECT md5(string_agg(u::text, ',' ORDER BY u.id)) h FROM users u`))[0].h;
      const r = await aviso('achador', 'LEG00001'); expect(r.status).toBe(201);
      expect((await q(`SELECT estado FROM conversas WHERE id = $1`, [r.json.conversa_id]))[0].estado).toBe('aguardando');
      expect(h.pushes.length).toBe(0); expect(h.emails.length).toBe(0); expect((await q(`SELECT count(*)::int n FROM notifications`))[0].n).toBe(0);
      expect((await q(`SELECT md5(string_agg(o::text, ',' ORDER BY o.id)) h FROM objects o`))[0].h).toBe(antes);
      expect((await q(`SELECT md5(string_agg(u::text, ',' ORDER BY u.id)) h FROM users u`))[0].h).toBe(usuariosAntes);
    });
    it('legado que atualiza a conta e volta vê o aviso e aceita como qualquer dono', async () => {
      const id = (await aviso('achador', 'LEG00001')).json.conversa_id;
      await q(`UPDATE users SET is_legacy = false WHERE id = $1`, [U.legado]);
      const lista = (await call(R.criar.GET, 'legado', '/api/v1/conversas?filtro=aguardando_voce', { method: 'GET' })).json.conversas; expect(lista.length).toBe(1);
      expect((await call(R.resumo.GET, 'legado', '/x', { method: 'GET' })).json.aguardando_voce).toBe(1);
      expect((await agir('aceitar', 'legado', id)).status).toBe(200);
    });
    it('«É o meu» num objeto legado NÃO altera o objeto (nenhuma escrita em linha legada)', async () => {
      const id = (await aviso('achador', 'LEG00001')).json.conversa_id; await q(`UPDATE users SET is_legacy = false WHERE id = $1`, [U.legado]);
      await agir('aceitar', 'legado', id); const r = await agir('eOMeu', 'legado', id);
      expect(r.status).toBe(200); expect(r.json.objeto_marcado).toBe(false); expect(await obj('LEG00001')).toMatchObject({ fp: false });
    });
    it('achador legado (somente leitura) não avisa: 403 e nada gravado', async () => {
      const r = await aviso('achadorlegado'); expect(r.status).toBe(403); expect((await q(`SELECT count(*)::int n FROM conversas`))[0].n).toBe(0);
    });
    it('sinal público continua com 409 e a mesma mensagem; nada é gravado', async () => {
      const r = await aviso('achador', 'SIG00001'); expect(r.status).toBe(409);
      expect(r.json.detail).toBe('Este registro foi extraído de uma notícia pública e não tem dono cadastrado no Backfindr. Para tentar contato, procure a fonte original.');
      expect((await q(`SELECT count(*)::int n FROM conversas`))[0].n).toBe(0); expect((await q(`SELECT count(*)::int n FROM object_events`))[0].n).toBe(0);
    });
    it('o dono não avisa sobre o próprio objeto; código inexistente 404; sem login 401', async () => {
      expect((await aviso('dono')).status).toBe(409); expect((await aviso('achador', 'NAOEXISTE')).status).toBe(404); expect((await call(R.criar.POST, null, '/api/v1/conversas', { body: { codigo: 'OBJ00001', mensagem: 'x' } })).status).toBe(401);
    });
  });

  describe('limites', () => {
    it('1 aviso ativo por achador e objeto; mensagem de até 280 caracteres; vazio recusado', async () => {
      expect((await aviso('achador', 'OBJ00001', 'a'.repeat(281))).status).toBe(400); expect((await aviso('achador', 'OBJ00001', '   ')).status).toBe(400); expect((await aviso('achador', 'OBJ00001', 'a'.repeat(280))).status).toBe(201);
      await q(`UPDATE conversas SET criada_em = now() - interval '1 hour'`);                                       // fora da pausa por objeto
      const r = await aviso('achador'); expect(r.status).toBe(409); expect(r.json.conversa_id).toBeTruthy();
      expect((await q(`SELECT count(*)::int n FROM conversas`))[0].n).toBe(1);
    });
    it('pausa por objeto (15 min), mesmo entre achadores diferentes', async () => {
      expect((await aviso('achador')).status).toBe(201); expect((await aviso('achador2')).status).toBe(429);
      await q(`UPDATE conversas SET criada_em = now() - interval '20 minutes'`); expect((await aviso('achador2')).status).toBe(201);
    });
    it('5 avisos novos por achador por dia; o 6º é recusado', async () => {
      for (let i = 0; i < 5; i++) {
        const o = (await q(`INSERT INTO objects (user_id, title, status, category, qr_code) VALUES ($1, $2, 'lost', 'other', $3) RETURNING qr_code`, [U.dono, `Objeto ${i}`, `LIM0000${i}`]))[0].qr_code;
        expect((await aviso('achador', o)).status, `aviso ${i + 1}`).toBe(201);
      }
      const o6 = (await q(`INSERT INTO objects (user_id, title, status, category, qr_code) VALUES ($1, 'Objeto 6', 'lost', 'other', 'LIM00009') RETURNING qr_code`, [U.dono]))[0].qr_code;
      expect((await aviso('achador', o6)).status).toBe(429);
    });
    it('mensagem de até 2.000 caracteres e 20 por minuto', async () => {
      const id = await novaConversa('aberta');
      expect((await agir('enviar', 'dono', id, { texto: 'a'.repeat(2001) })).status).toBe(400); expect((await agir('enviar', 'dono', id, { texto: '  ' })).status).toBe(400);
      expect((await agir('enviar', 'dono', id, { texto: 'a'.repeat(2000) })).status).toBe(201);
      for (let i = 0; i < 19; i++) expect((await agir('enviar', 'dono', id, { texto: `m${i}` })).status).toBe(201);
      expect((await agir('enviar', 'dono', id, { texto: 'a mais' })).status).toBe(429);
      expect((await agir('enviar', 'achador', id, { texto: 'o outro lado tem a sua própria cota' })).status).toBe(201);
    });
  });

  describe('prazos e derivados', () => {
    it('sem resposta após 30 dias (derivado); o dono aceita até 12 meses e depois não', async () => {
      const { estadoVisivel, donoAindaPodeAceitar } = R.estado;
      const dia = (n: number) => new Date(Date.now() - n * 86400000).toISOString();
      expect(estadoVisivel({ estado: 'aguardando', criada_em: dia(29) })).toBe('aguardando'); expect(estadoVisivel({ estado: 'aguardando', criada_em: dia(31) })).toBe('sem_resposta');
      expect(estadoVisivel({ estado: 'aberta', criada_em: dia(90) })).toBe('aberta');
      expect(donoAindaPodeAceitar({ criada_em: dia(360) })).toBe(true); expect(donoAindaPodeAceitar({ criada_em: dia(400) })).toBe(false);
      const velha = await novaConversa('aguardando', { criada_em: dia(400) }); expect((await agir('aceitar', 'dono', velha)).status).toBe(410);
      const meio = await novaConversa('aguardando', { criada_em: dia(100) }, 'OBJ00002');
      expect((await agir('aceitar', 'dono', meio)).status).toBe(200);
    });
  });

  describe('notify (rota antiga): com a função ligada exige conta e não marca o objeto; desligada, igual a antes', () => {
    it('ligada: sem login 401; com login cria a conversa e NÃO marca o objeto; sinal público 409', async () => {
      const sem = await call(R.notify.POST, null, '/api/v1/objects/scan/OBJ00001/notify', { id: 'OBJ00001', body: {} }); expect(sem.status).toBe(401); expect(sem.json.login_necessario).toBe(true);
      const com = await call(R.notify.POST, 'achador', '/api/v1/objects/scan/OBJ00001/notify', { id: 'OBJ00001', body: { mensagem: 'Achei.' } }); expect(com.status).toBe(201);
      expect(com.json.conversa_id).toBeTruthy(); expect(await obj()).toMatchObject({ fp: false });
      expect((await call(R.notify.POST, 'achador', '/api/v1/objects/scan/SIG00001/notify', { id: 'SIG00001', body: { mensagem: 'x' } })).status).toBe(409);
      expect((await q(`SELECT type FROM object_events ORDER BY id`)).map((e) => e.type)).toEqual(expect.arrayContaining(['qr_scanned', 'owner_notified', 'conversa_aviso']));
    });
    it('desligada (sem MENSAGENS_ATIVO): rota antiga como sempre — aviso anônimo e marca do objeto; as rotas novas respondem 404', async () => {
      delete process.env.MENSAGENS_ATIVO;
      try {
        const r = await call(R.notify.POST, null, '/api/v1/objects/scan/OBJ00001/notify', { id: 'OBJ00001' });
        expect(r.status).toBe(200); expect(await obj()).toMatchObject({ fp: true });
        expect((await call(R.criar.POST, 'achador', '/api/v1/conversas', { body: { codigo: 'OBJ00001', mensagem: 'x' } })).status).toBe(404);
        expect((await call(R.config.GET, null, '/api/v1/conversas/config', { method: 'GET' })).json).toEqual({ ativo: false });
        expect((await call(R.resumo.GET, 'dono', '/api/v1/conversas/resumo', { method: 'GET' })).status).toBe(404);
      } finally { process.env.MENSAGENS_ATIVO = '1'; }
    });
    it('config ligada responde ativo:true', async () => { expect((await call(R.config.GET, null, '/api/v1/conversas/config', { method: 'GET' })).json).toEqual({ ativo: true }); });
  });

  describe('exclusão de conta: autor anonimizado, nada em cascata', () => {
    it('apagar o achador deixa a conversa e as mensagens, com o autor anulado', async () => {
      const id = (await aviso('achador')).json.conversa_id; await agir('aceitar', 'dono', id); await agir('enviar', 'achador', id, { texto: 'oi' });
      await q(`DELETE FROM users WHERE id = $1`, [U.achador]);
      expect((await q(`SELECT achador_id, estado FROM conversas WHERE id = $1`, [id]))[0]).toEqual({ achador_id: null, estado: 'aberta' });
      const m = await q(`SELECT autor_id FROM mensagens_conversa WHERE conversa_id = $1`, [id]); expect(m.length).toBe(3); expect(m.every((x) => x.autor_id === null || x.autor_id === U.dono)).toBe(true);
      expect(m.some((x) => x.autor_id === U.achador)).toBe(false);
    });
    it('apagar o objeto não apaga a conversa (guarda o título)', async () => {
      const id = (await aviso('achador')).json.conversa_id; await q(`DELETE FROM objects WHERE qr_code = 'OBJ00001'`);
      expect((await q(`SELECT object_id, objeto_titulo FROM conversas WHERE id = $1`, [id]))[0]).toEqual({ object_id: null, objeto_titulo: 'Mochila vermelha' });
    });
  });

  describe('RLS (política só para as duas partes, com WITH CHECK)', () => {
    it('com o esquema auth do Supabase simulado: terceiro não lê nem escreve; parte lê; WITH CHECK barra autor falso e conversa alheia', async () => {
      await pool.query(`DROP SCHEMA IF EXISTS auth CASCADE; CREATE SCHEMA auth; CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid $$;`);
      await pool.query(SQL_MIGRACAO);                                                                              // recria as políticas agora que auth.uid() existe
      await pool.query(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_rls_teste') THEN CREATE ROLE app_rls_teste NOLOGIN; END IF; END $$;
        GRANT USAGE ON SCHEMA public, auth TO app_rls_teste; GRANT SELECT, INSERT, UPDATE, DELETE ON conversas, mensagens_conversa TO app_rls_teste; GRANT SELECT ON users, objects TO app_rls_teste;`);
      expect((await q(`SELECT count(*)::int n FROM pg_policies WHERE tablename IN ('conversas','mensagens_conversa')`))[0].n).toBe(2);
      const id = await novaConversa('aberta'); await q(`INSERT INTO mensagens_conversa (conversa_id, autor_id, texto) VALUES ($1, $2, 'segredo')`, [id, U.dono]);
      const como = async (uid: string | null, sql: string, p: unknown[] = []) => {
        const c = await pool.connect();
        try { await c.query('BEGIN'); await c.query('SET LOCAL ROLE app_rls_teste'); await c.query(`SELECT set_config('request.jwt.claim.sub', $1, true)`, [uid ?? '']); return await c.query(sql, p); }
        finally { await c.query('ROLLBACK').catch(() => {}); c.release(); }
      };
      expect((await como(U.dono, `SELECT count(*)::int n FROM conversas`)).rows[0].n).toBe(1); expect((await como(U.achador, `SELECT count(*)::int n FROM mensagens_conversa`)).rows[0].n).toBe(1);
      expect((await como(U.intruso, `SELECT count(*)::int n FROM conversas`)).rows[0].n).toBe(0); expect((await como(U.intruso, `SELECT count(*)::int n FROM mensagens_conversa`)).rows[0].n).toBe(0);
      expect((await como(null, `SELECT count(*)::int n FROM conversas`)).rows[0].n).toBe(0);
      expect((await como(U.intruso, `UPDATE conversas SET estado = 'encerrada'`)).rowCount).toBe(0);
      // WITH CHECK: terceiro não insere; parte não insere com autor falso; parte insere como ela mesma
      await expect(como(U.intruso, `INSERT INTO mensagens_conversa (conversa_id, autor_id, texto) VALUES ($1, $2, 'x')`, [id, U.intruso])).rejects.toThrow(/row-level security/);
      await expect(como(U.achador, `INSERT INTO mensagens_conversa (conversa_id, autor_id, texto) VALUES ($1, $2, 'x')`, [id, U.dono])).rejects.toThrow(/row-level security/);
      expect((await como(U.achador, `INSERT INTO mensagens_conversa (conversa_id, autor_id, texto) VALUES ($1, $2, 'ok') RETURNING id`, [id, U.achador])).rows.length).toBe(1);
      await expect(como(U.intruso, `INSERT INTO conversas (achador_id, dono_id, primeira_mensagem) VALUES ($1, $2, 'x')`, [U.dono, U.achador])).rejects.toThrow(/row-level security/);
      await pool.query(`DROP SCHEMA auth CASCADE`);
    });
    it('as tabelas têm RLS ligado', async () => {
      expect((await q(`SELECT relname, relrowsecurity FROM pg_class WHERE relname IN ('conversas','mensagens_conversa') ORDER BY 1`))).toEqual([{ relname: 'conversas', relrowsecurity: true }, { relname: 'mensagens_conversa', relrowsecurity: true }]);
    });
    it('a migração é idempotente e reversível', async () => {
      await pool.query(SQL_MIGRACAO); await pool.query(SQL_MIGRACAO);
      await pool.query(`DROP TABLE IF EXISTS mensagens_conversa; DROP TABLE IF EXISTS conversas;`);
      expect((await q(`SELECT count(*)::int n FROM pg_class WHERE relname IN ('conversas','mensagens_conversa')`))[0].n).toBe(0);
    });
  });

  describe('notificações no sino (texto fixo, sem a mensagem, sem inflar o contador)', () => {
    const sino = (quem: string, tipo?: string) => q(`SELECT type, title, message, url, read FROM notifications WHERE user_id = $1${tipo ? ' AND type = $2' : ''} ORDER BY created_at, id`, tipo ? [U[quem], tipo] : [U[quem]]);
    const lida = (id: string, quem: string) => agir('lida', quem, id);
    it('cada passo cria a linha certa para a outra parte; nenhuma leva o conteúdo da mensagem', async () => {
      const id = (await aviso('achador', 'OBJ00001', 'Mensagem secreta do achador 123')).json.conversa_id;
      expect((await sino('dono')).map((n) => n.type)).toEqual(['conversa_aviso']);
      await agir('aceitar', 'dono', id);
      expect((await sino('achador')).map((n) => n.type)).toEqual(['conversa_aceita']); expect((await sino('dono', 'conversa_aviso'))[0].read).toBe(true);   // o aviso tratado sai do contador
      await agir('enviar', 'dono', id, { texto: 'Texto privado do dono 456' });
      expect((await sino('achador', 'conversa_mensagem')).map((n) => [n.title, n.message])).toEqual([['💬 Nova mensagem', 'Você tem uma nova mensagem no Backfindr.']]);
      await agir('eOMeu', 'dono', id);
      expect((await sino('achador', 'conversa_e_o_meu'))[0]).toMatchObject({ title: 'O dono respondeu ao seu aviso', message: 'O dono confirmou que o objeto é dele.', url: `/dashboard/mensagens/${id}` });
      await agir('encerrar', 'dono', id, { motivo: 'devolvido' });
      expect((await sino('achador', 'conversa_encerrada'))[0].message).toBe('O dono confirmou a devolução. Conversa encerrada.');
      // Procura o CONTEÚDO das mensagens (as frases inteiras e as palavras que as marcam), não dígitos soltos: as linhas do sino levam o id da conversa na `url`,
    // e um UUID aleatório pode conter «123» ou «456» (cerca de 1,3% das rodadas), o que fazia este teste falhar sem haver vazamento.
    const todas = JSON.stringify([...(await sino('dono')), ...(await sino('achador'))]);
    expect(todas).not.toMatch(/secreta|privado/); expect(todas).not.toContain('Mensagem secreta do achador 123'); expect(todas).not.toContain('Texto privado do dono 456');
    });
    it('«Não é meu» e cancelamento: a linha certa; o dono é avisado do cancelamento e o aviso antigo dele sai do contador', async () => {
      const a = (await aviso('achador')).json.conversa_id; await agir('recusar', 'dono', a);
      expect((await sino('achador', 'conversa_recusada'))[0].message).toBe('A pessoa informou que este objeto não é dela.');
      await q(`UPDATE conversas SET criada_em = now() - interval '1 hour'`);
      const b = (await aviso('achador2')).json.conversa_id; expect((await sino('dono', 'conversa_aviso')).filter((n) => !n.read).length).toBe(1);
      await agir('cancelar', 'achador2', b);
      expect((await sino('dono', 'conversa_cancelada'))[0].message).toBe('Quem avisou cancelou o aviso sobre "Mochila vermelha".');
      expect((await sino('dono', 'conversa_aviso')).filter((n) => !n.read).length).toBe(0);
    });
    it('várias mensagens seguidas = UMA linha não lida (push continua um por mensagem); abrir a conversa zera; a próxima mensagem cria outra', async () => {
      const id = await novaConversa('aberta'); h.pushes.length = 0;
      for (let i = 0; i < 4; i++) await agir('enviar', 'dono', id, { texto: `m${i}` });
      expect((await sino('achador', 'conversa_mensagem')).filter((n) => !n.read).length).toBe(1); expect(h.pushes.length).toBe(4);
      await lida(id, 'achador'); expect((await sino('achador', 'conversa_mensagem')).filter((n) => !n.read).length).toBe(0);
      await agir('enviar', 'dono', id, { texto: 'depois' }); expect((await sino('achador', 'conversa_mensagem')).filter((n) => !n.read).length).toBe(1);
      expect((await sino('dono', 'conversa_mensagem')).length).toBe(0);                                              // quem escreve não recebe a própria
    });
    it('dono legado: nenhuma linha no sino em nenhum passo (nem cancelamento); e-mail e push também não', async () => {
      const id = (await aviso('achador', 'LEG00001')).json.conversa_id; await agir('cancelar', 'achador', id);
      expect((await q(`SELECT count(*)::int n FROM notifications`))[0].n).toBe(0); expect(h.pushes.length).toBe(0); expect(h.emails.length).toBe(0);
    });
    it('«É o meu» não dispara push novo (só o registro no sino)', async () => {
      const id = await novaConversa('aberta'); h.pushes.length = 0; await agir('eOMeu', 'dono', id); expect(h.pushes.length).toBe(0);
    });
  });

  describe('títulos com espaço no fim: textos limpos, título gravado do objeto intacto', () => {
    it('aviso, push, e-mail, sino e conversa usam o título sem espaços; objects.title não muda', async () => {
      await q(`UPDATE objects SET title = 'Gatinho doméstico ' WHERE qr_code = 'OBJ00001'`);
      const id = (await aviso('achador')).json.conversa_id;
      const n = (await q(`SELECT message FROM notifications WHERE user_id = $1`, [U.dono]))[0].message; expect(n).toBe('Alguém avisou que pode ter encontrado "Gatinho doméstico". Veja o aviso e decida se quer conversar.');
      expect(h.pushes[0].payload.body).toBe(n); expect(h.emails[0].obj.title).toBe('Gatinho doméstico');
      expect((await q(`SELECT objeto_titulo FROM conversas WHERE id = $1`, [id]))[0].objeto_titulo).toBe('Gatinho doméstico');
      expect((await q(`SELECT title FROM objects WHERE qr_code = 'OBJ00001'`))[0].title).toBe('Gatinho doméstico ');   // banco intacto
      await agir('cancelar', 'achador', id); expect((await q(`SELECT message FROM notifications WHERE type = 'conversa_cancelada'`))[0].message).toBe('Quem avisou cancelou o aviso sobre "Gatinho doméstico".');
    });
    it('conversa antiga com título sujo no banco: lista e detalhe devolvem o dado; a tela limpa (testado na tela); lembrete do cron usa o título limpo', async () => {
      const id = await novaConversa('aguardando', { objeto_titulo: 'Gatinho doméstico  ' }); await q(`UPDATE conversas SET criada_em = now() - interval '1 day 2 hours' WHERE id = $1`, [id]);
      h.pushes.length = 0; await R.cron.GET(new NextRequest('http://localhost/x', { headers: { authorization: 'Bearer cron-teste' } }));
      expect(h.pushes[0].payload.body).toBe('Alguém avisou que pode ter encontrado "Gatinho doméstico". Veja o aviso e decida se quer conversar.');
    });
  });

  describe('cron: lembretes, arquivamento e descarte que não pode apagar o que não deve', () => {
    const rodar = () => R.cron.GET(new NextRequest('http://localhost/api/v1/cron/found-pending-reminders', { headers: { authorization: 'Bearer cron-teste' } })).then((r: Response) => r.json());
    it('lembretes D+1/3/7 só para dono não legado, uma vez só; nada altera o objeto', async () => {
      const a = await novaConversa('aguardando'); await q(`UPDATE conversas SET criada_em = now() - interval '1 day 2 hours' WHERE id = $1`, [a]);
      const l = (await aviso('achador', 'LEG00001')).json.conversa_id; await q(`UPDATE conversas SET criada_em = now() - interval '1 day 2 hours' WHERE id = $1`, [l]);
      h.pushes.length = 0; await rodar();
      expect(h.pushes.length).toBe(1); expect(h.pushes[0].user).toBe(U.dono); expect(h.pushes[0].payload.url).toBe(`/dashboard/mensagens/${a}`);
      h.pushes.length = 0; await rodar(); expect(h.pushes.length).toBe(0);                                          // dedup
      expect(await obj()).toMatchObject({ fp: false });
    });
    it('dono com CONTA legada (objeto não marcado como legado) também não recebe lembrete', async () => {
      await q(`INSERT INTO objects (user_id, title, status, category, qr_code, is_legacy) VALUES ($1, 'Objeto da conta legada', 'lost', 'other', 'CTA00001', false)`, [U.legado]);
      const id = (await q(`INSERT INTO conversas (object_id, objeto_titulo, achador_id, dono_id, estado, primeira_mensagem, criada_em) SELECT id, title, $1, $2, 'aguardando', 'oi', now() - interval '1 day 2 hours' FROM objects WHERE qr_code = 'CTA00001' RETURNING id`, [U.achador, U.legado]))[0].id;
      h.pushes.length = 0; await rodar(); expect(h.pushes.length).toBe(0);
      expect((await q(`SELECT estado FROM conversas WHERE id = $1`, [id]))[0].estado).toBe('aguardando');
    });
    it('lembrete de «É o meu» aguardando devolução conta do «É o meu», não do aviso', async () => {
      const id = await novaConversa('aberta', { confirmado_dono_em: new Date(Date.now() - 3.5 * 86400000).toISOString(), criada_em: new Date(Date.now() - 40 * 86400000).toISOString() });
      await q(`UPDATE conversas SET ultima_atividade = now() WHERE id = $1`, [id]); h.pushes.length = 0; await rodar();
      expect(h.pushes.filter((p) => p.payload.tag.includes('e_o_meu')).length).toBe(1);
    });
    it('conversa aberta parada há 30 dias é arquivada; a recente e a encerrada ficam como estão', async () => {
      const velha = await novaConversa('aberta', { ultima_atividade: new Date(Date.now() - 31 * 86400000).toISOString() });
      const nova = await novaConversa('aberta', {}, 'OBJ00002');
      const r = await rodar(); expect(r.conversas_arquivadas).toBe(1);
      expect((await q(`SELECT estado, motivo, retencao_ate IS NOT NULL AS ret FROM conversas WHERE id = $1`, [velha]))[0]).toEqual({ estado: 'arquivada', motivo: 'inatividade', ret: true });
      expect((await q(`SELECT estado FROM conversas WHERE id = $1`, [nova]))[0].estado).toBe('aberta');
    });
    it('descarte D+14: NÃO apaga a marca de um objeto com «É o meu»; apaga só marca antiga sem conversa (como antes)', async () => {
      await q(`UPDATE objects SET found_pending_confirmation = true, found_pending_since = now() - interval '20 days' WHERE qr_code IN ('OBJ00001','OBJ00002')`);
      await novaConversa('aberta', { confirmado_dono_em: new Date(Date.now() - 20 * 86400000).toISOString() });   // OBJ00001 tem «É o meu»
      await rodar();
      expect(await obj('OBJ00001')).toMatchObject({ fp: true });                                                 // o dono disse que é dele: nada descarta
      expect(await obj('OBJ00002')).toMatchObject({ fp: false });                                                // marca antiga, sem conversa: descartada como antes
    });
    it('sem a função ligada o cron faz só o que sempre fez (nada de conversas)', async () => {
      delete process.env.MENSAGENS_ATIVO;
      try {
        await q(`UPDATE objects SET found_pending_confirmation = true, found_pending_since = now() - interval '20 days' WHERE qr_code = 'OBJ00001'`);
        const r = await rodar(); expect(r.conversas_arquivadas).toBeUndefined(); expect(await obj('OBJ00001')).toMatchObject({ fp: false });
      } finally { process.env.MENSAGENS_ATIVO = '1'; }
    });
    it('sem CRON_SECRET correto: 401', async () => {
      expect((await R.cron.GET(new NextRequest('http://localhost/x', { headers: { authorization: 'Bearer errado' } }))).status).toBe(401);
    });
  });
});
