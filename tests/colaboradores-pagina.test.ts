// Programa de Colaboradores, E2: regras da página `/@nome`, feed da página e sitemap. Postgres REAL (sem TEST_DATABASE_URL a suíte é pulada).
// Usa o esquema mínimo do Feed (tests/fixtures/feed-schema.sql) + a migration 026. ATENÇÃO: recria as tabelas do banco de teste.
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { Pool } from 'pg';
import { randomUUID } from 'crypto';
import { readFileSync } from 'fs';
import path from 'path';

const TEST_DB = process.env.TEST_DATABASE_URL;
if (TEST_DB) process.env.DATABASE_URL = TEST_DB;
const SCHEMA = readFileSync(path.join(__dirname, 'fixtures/feed-schema.sql'), 'utf8');
const MIGRATION = readFileSync(path.join(__dirname, '../src/db/migrations/026_colaboradores.sql'), 'utf8');

import { carregarColaborador, paginaIndexavel, urlSegura, linksDeCadastro, caminhoPagina } from '@/lib/colaboradores/pagina';
import { feedDoColaborador, COLAB_FEED_MAX, regiaoValida } from '@/lib/colaboradores/feed';

describe('regras puras da página', () => {
  it('urlSegura aceita só https sem credenciais', () => {
    expect(urlSegura('https://www.facebook.com/groups/abc')).toBe('https://www.facebook.com/groups/abc');
    for (const ruim of ['http://exemplo.com', 'javascript:alert(1)', 'data:text/html,x', 'https://user:pw@exemplo.com', 'ftp://x.com', '//exemplo.com', 'exemplo.com', '', null, undefined, 5]) expect(urlSegura(ruim as unknown), String(ruim)).toBeNull();
  });
  it('indexação: só ativa + verificada + com ocorrência cadastrada com o código (PC-03)', () => {
    expect(paginaIndexavel({ estado: 'ativo', verificado: true }, 1)).toBe(true);
    expect(paginaIndexavel({ estado: 'ativo', verificado: true }, 0)).toBe(false);          // sem conteúdo
    expect(paginaIndexavel({ estado: 'ativo', verificado: false }, 7)).toBe(false);         // NÃO verificada, mesmo com conteúdo
    expect(paginaIndexavel({ estado: 'suspenso', verificado: true }, 7)).toBe(false);
    expect(paginaIndexavel({ estado: 'saiu', verificado: true }, 7)).toBe(false);
    expect(paginaIndexavel({ estado: 'excluido', verificado: true }, 7)).toBe(false);
  });
  it('endereço canônico e links de cadastro com o código na URL (?colab=)', () => {
    expect(caminhoPagina('BackFindr')).toBe('/@backfindr');
    expect(linksDeCadastro('HX7R')).toEqual({ perdi: '/flow/lost?colab=HX7R', achei: '/flow/found?colab=HX7R', roubado: '/flow/stolen?colab=HX7R' });
  });
  it('região válida exige lat, lng e raio', () => {
    expect(regiaoValida({ lat: -23.5, lng: -46.6, raioKm: 20 })).toBe(true);
    for (const r of [{ lat: null, lng: -46, raioKm: 20 }, { lat: -23, lng: null, raioKm: 20 }, { lat: -23, lng: -46, raioKm: null }, { lat: 91, lng: 0, raioKm: 5 }, { lat: 0, lng: 181, raioKm: 5 }, { lat: 0, lng: 0, raioKm: 0 }]) expect(regiaoValida(r)).toBe(false);
  });
});

describe.skipIf(!TEST_DB)('página, feed do colaborador e sitemap (banco real)', () => {
  let pool: Pool;
  const ids: Record<string, string> = {};
  const consulta = (t: string, p?: unknown[]) => pool.query(t, p as never[]);

  const novoObjeto = async (o: { titulo: string; status?: string; lat?: number | null; lng?: number | null; colab?: string | null; publico?: boolean; legado?: boolean; source?: string | null; qr?: string | null; foto?: boolean; criado?: string; local?: string; categoria?: string }) => {
    const r = await pool.query(
      `INSERT INTO objects (user_id, title, status, category, type, location, latitude, longitude, qr_code, images, is_public, is_legacy, source, created_at, updated_at, colaborador_id, colaborador_codigo)
       VALUES ($1,$2,$3,$4,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$13,$14,$15) RETURNING id, qr_code`,
      [randomUUID(), o.titulo, o.status ?? 'lost', o.categoria ?? 'keys', o.local ?? 'Tatuapé, São Paulo - SP', o.lat ?? null, o.lng ?? null,
       o.qr === undefined ? randomUUID().slice(0, 8).toUpperCase() : o.qr, o.foto ? JSON.stringify(['https://exemplo.com/f.jpg']) : '[]',
       o.publico ?? true, o.legado ?? false, o.source ?? null, o.criado ?? new Date().toISOString(), o.colab ?? null, o.colab ? 'HX7R' : null]);
    return r.rows[0] as { id: string; qr_code: string };
  };

  beforeAll(async () => {
    pool = new Pool({ connectionString: TEST_DB });
    await pool.query(SCHEMA);
    await pool.query(MIGRATION);
  });
  afterAll(async () => { await pool?.end(); });

  beforeEach(async () => {
    await pool.query('DELETE FROM objects');
    await pool.query('ALTER TABLE colaboradores DISABLE TRIGGER trg_colaboradores_sem_delete');
    await pool.query('DELETE FROM colaboradores');
    await pool.query('ALTER TABLE colaboradores ENABLE TRIGGER trg_colaboradores_sem_delete');
    const mk = async (slug: string, curto: string, nome: string, estado: string, verificado: boolean, extra: { lat?: number; lng?: number; raio?: number; canal?: string; img?: string } = {}) => {
      const r = await pool.query(
        `INSERT INTO colaboradores (slug, codigo_curto, nome, estado, verificado_em, regiao_lat, regiao_lng, raio_km, canal_url, imagem_url, descricao)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'Descrição do grupo') RETURNING id`,
        [slug, curto, nome, estado, verificado ? new Date().toISOString() : null, extra.lat ?? null, extra.lng ?? null, extra.raio ?? null, extra.canal ?? null, extra.img ?? null]);
      ids[slug] = r.rows[0].id;
    };
    await mk('grupo-sp', 'HX7R', 'Grupo SP', 'ativo', true, { lat: -23.5505, lng: -46.6333, raio: 15, canal: 'https://www.facebook.com/groups/x' });
    await mk('sem-regiao', 'QQ2K', 'Sem região', 'ativo', true);
    await mk('nao-verif', 'NV3N', 'Não verificado', 'ativo', false);
    await mk('suspenso', 'SU5P', 'Suspenso', 'suspenso', true);
    await mk('saiu', 'SA6U', 'Saiu', 'saiu', true);
    await mk('excluido', 'EX7C', 'Excluído', 'excluido', true);
  });
  afterEach(() => { delete process.env.COLABORADORES_ATIVO; });

  describe('estados da página', () => {
    it('ativo → página com os dados; suspenso e saiu → 307; excluído → 308; inexistente → 404; sem diferenciar maiúscula', async () => {
      const a = await carregarColaborador(consulta, 'Grupo-SP');
      expect(a.tipo).toBe('pagina');
      if (a.tipo === 'pagina') { expect(a.colaborador.nome).toBe('Grupo SP'); expect(a.colaborador.codigoCurto).toBe('HX7R'); expect(a.colaborador.verificado).toBe(true); expect(a.colaborador.canalUrl).toBe('https://www.facebook.com/groups/x'); }
      expect(await carregarColaborador(consulta, 'suspenso')).toEqual({ tipo: 'redirecionar', permanente: false });
      expect(await carregarColaborador(consulta, 'saiu')).toEqual({ tipo: 'redirecionar', permanente: false }); // PC-13: «saiu» = 307 (volta possível)
      expect(await carregarColaborador(consulta, 'excluido')).toEqual({ tipo: 'redirecionar', permanente: true });
      expect(await carregarColaborador(consulta, 'nunca-existiu')).toEqual({ tipo: 'nao-existe' });
    });
    it('link e imagem que não são https são descartados', async () => {
      await pool.query(`UPDATE colaboradores SET canal_url = 'javascript:alert(1)', imagem_url = 'http://x.com/a.png' WHERE slug = 'sem-regiao'`);
      const r = await carregarColaborador(consulta, 'sem-regiao');
      expect(r.tipo === 'pagina' && r.colaborador.canalUrl === null && r.colaborador.imagemUrl === null).toBe(true);
    });
  });

  describe('feed da página', () => {
    it('primeiro as ocorrências com o código do colaborador (mais recentes primeiro); depois as da região dentro do raio', async () => {
      const dentro = await novoObjeto({ titulo: 'Dentro do raio, sem código', lat: -23.56, lng: -46.64, criado: '2026-11-10T10:00:00Z' });          // ~1,5 km
      const fora = await novoObjeto({ titulo: 'Fora do raio', lat: -22.9, lng: -43.2, criado: '2026-11-20T10:00:00Z' });                          // Rio, ~360 km
      const c1 = await novoObjeto({ titulo: 'Com código, antiga', colab: ids['grupo-sp'], lat: -22.9, lng: -43.2, criado: '2026-11-01T10:00:00Z' }); // fora do raio mas COM o código: entra
      const c2 = await novoObjeto({ titulo: 'Com código, recente', colab: ids['grupo-sp'], criado: '2026-11-05T10:00:00Z' });
      const f = await feedDoColaborador(consulta, ids['grupo-sp'], { lat: -23.5505, lng: -46.6333, raioKm: 15 });
      expect(f.itens.map((i) => i.code)).toEqual([c2.qr_code, c1.qr_code, dentro.qr_code]);
      expect(f.itens.map((i) => i.code)).not.toContain(fora.qr_code);
      expect(f.comCodigo).toBe(2);
    });

    it('sem região ou sem raio: só as ocorrências com o código', async () => {
      await novoObjeto({ titulo: 'Região sem código', lat: -23.56, lng: -46.64 });
      const c = await novoObjeto({ titulo: 'Com código', colab: ids['sem-regiao'] });
      for (const r of [{ lat: null, lng: null, raioKm: null }, { lat: -23.5, lng: -46.6, raioKm: null }]) {
        const f = await feedDoColaborador(consulta, ids['sem-regiao'], r);
        expect(f.itens.map((i) => i.code)).toEqual([c.qr_code]);
      }
    });

    it('mesma elegibilidade do Feed: sem legado, sem privado, sem status fora de perdido/achado/roubado, sem ocorrência sem código QR', async () => {
      const ok = await novoObjeto({ titulo: 'Elegível', colab: ids['grupo-sp'] });
      await novoObjeto({ titulo: 'Legado', colab: ids['grupo-sp'], legado: true });
      await novoObjeto({ titulo: 'Privado', colab: ids['grupo-sp'], publico: false });
      await novoObjeto({ titulo: 'Devolvido', colab: ids['grupo-sp'], status: 'returned' });
      await novoObjeto({ titulo: 'Protegido', colab: ids['grupo-sp'], status: 'protected' });
      await novoObjeto({ titulo: 'Sem QR', colab: ids['grupo-sp'], qr: null });
      const f = await feedDoColaborador(consulta, ids['grupo-sp'], { lat: null, lng: null, raioKm: null });
      expect(f.itens.map((i) => i.code)).toEqual([ok.qr_code]);
      expect(f.comCodigo).toBe(1);
    });

    it('ocorrência de OUTRO colaborador não aparece (a menos que esteja na região)', async () => {
      await novoObjeto({ titulo: 'De outro', colab: ids['sem-regiao'], lat: -22.9, lng: -43.2 });
      const f = await feedDoColaborador(consulta, ids['grupo-sp'], { lat: -23.5505, lng: -46.6333, raioKm: 15 });
      expect(f.itens).toEqual([]);
    });

    it('no máximo COLAB_FEED_MAX itens, e o grupo do código vem inteiro antes', async () => {
      for (let i = 0; i < COLAB_FEED_MAX + 6; i++) await novoObjeto({ titulo: `Com código ${i}`, colab: ids['grupo-sp'], criado: new Date(Date.UTC(2026, 10, 1, 0, i)).toISOString() });
      const f = await feedDoColaborador(consulta, ids['grupo-sp'], { lat: -23.5505, lng: -46.6333, raioKm: 15 });
      expect(f.itens.length).toBe(COLAB_FEED_MAX);
      expect(f.comCodigo).toBe(COLAB_FEED_MAX + 6);
    });

    it('só os campos públicos do Feed: nada de colaborador, código, dono ou coordenadas na saída', async () => {
      await novoObjeto({ titulo: 'Campos', colab: ids['grupo-sp'], lat: -23.56, lng: -46.64, foto: true });
      const f = await feedDoColaborador(consulta, ids['grupo-sp'], { lat: -23.5505, lng: -46.6333, raioKm: 15 });
      expect(Object.keys(f.itens[0]).sort()).toEqual(['can_report_found', 'category', 'category_label', 'code', 'created_at', 'has_photo', 'location_label', 'origin', 'photo_url', 'source_name', 'source_url', 'status', 'status_label', 'title'].sort());
      expect(JSON.stringify(f)).not.toMatch(/colaborador|HX7R|latitude|longitude|user_id/i);
    });

    it('PARIDADE com o Feed geral: o mesmo cartão (campos e valores) que o Feed mostra para a mesma ocorrência', async () => {
      const o = await novoObjeto({ titulo: 'Chaves do Zé Maria da Silva', colab: ids['grupo-sp'], foto: true, local: 'Rua das Flores, 100, Tatuapé, São Paulo - SP', lat: -23.54, lng: -46.57 });
      const f = await feedDoColaborador(consulta, ids['grupo-sp'], { lat: null, lng: null, raioKm: null });
      const q = await import('@/lib/feed/query'); q.resetFeedCache();
      const geral = await q.getRankedFeed({});
      const noGeral = geral.items.find((i) => i.code === o.qr_code);
      expect(noGeral).toBeTruthy();
      expect(f.itens[0]).toEqual(q.toPublicItem(noGeral!));
    });

    it('o Feed geral não muda por causa do código: a ocorrência com código aparece nele como qualquer outra', async () => {
      const a = await novoObjeto({ titulo: 'Com código', colab: ids['grupo-sp'] });
      const b = await novoObjeto({ titulo: 'Sem código' });
      const q = await import('@/lib/feed/query'); q.resetFeedCache();
      const geral = await q.getRankedFeed({});
      expect(geral.items.map((i) => i.code).sort()).toEqual([a.qr_code, b.qr_code].sort());
      expect(JSON.stringify(geral.items)).not.toMatch(/colaborador|HX7R/i);
    });
  });

  describe('sitemap', () => {
    it('DESLIGADO: devolve [] sem consultar o banco', async () => {
      const { paginasDeColaboradorParaSitemap } = await import('@/lib/colaboradores/sitemap');
      await novoObjeto({ titulo: 'x', colab: ids['grupo-sp'] });
      expect(await paginasDeColaboradorParaSitemap('https://backfindr.com')).toEqual([]);
    });
    it('LIGADO: só página ativa + verificada + com ocorrência elegível (PC-03)', async () => {
      process.env.COLABORADORES_ATIVO = '1';
      const { paginasDeColaboradorParaSitemap } = await import('@/lib/colaboradores/sitemap');
      await novoObjeto({ titulo: 'ok', colab: ids['grupo-sp'] });
      await novoObjeto({ titulo: 'não verificada', colab: ids['nao-verif'] });
      await novoObjeto({ titulo: 'suspensa', colab: ids['suspenso'] });
      await novoObjeto({ titulo: 'saiu', colab: ids['saiu'] });
      await novoObjeto({ titulo: 'legado (não conta)', colab: ids['sem-regiao'], legado: true });          // só tem ocorrência fora da elegibilidade
      const r = await paginasDeColaboradorParaSitemap('https://backfindr.com');
      expect(r.map((x) => x.url)).toEqual(['https://backfindr.com/@grupo-sp']);
    });
    it('LIGADO e sem nenhuma página elegível: vazio; falha do banco: vazio (nunca lança)', async () => {
      process.env.COLABORADORES_ATIVO = '1';
      const { paginasDeColaboradorParaSitemap } = await import('@/lib/colaboradores/sitemap');
      expect(await paginasDeColaboradorParaSitemap('https://backfindr.com')).toEqual([]);
    });
  });
});
