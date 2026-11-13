// Admin: contagem de cards elegíveis do Feed (somente leitura) e atalho «Feed» no menu.
// Rota GET /api/v1/admin/feed/stats com a guarda de admin REAL (jwt + papel lido do banco) e o banco SIMULADO.
// A comparação com o banco real (mesma regra do Feed) está em admin-feed-contagem.test.ts.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { readFileSync } from 'fs';
import path from 'path';

const h = vi.hoisted(() => {
  process.env.SECRET_KEY = 'segredo-de-teste-do-admin-feed';
  return { role: 'admin' as string | null, userExists: true, countRows: [] as unknown[], countFails: false, calls: [] as string[] };
});
vi.mock('@/lib/db', () => ({
  query: vi.fn(async (sql: string) => {
    h.calls.push(sql);
    if (sql.includes('FROM users WHERE id')) return h.userExists ? { rows: [{ id: 'u1', email: 'a@teste.local', name: 'A', plan: 'free', role: h.role, b2b_partner_id: null }] } : { rows: [] };
    if (sql.includes('GROUP BY')) { if (h.countFails) throw new Error('banco fora'); return { rows: h.countRows }; }
    return { rows: [] };
  }),
}));

import { GET } from '@/app/api/v1/admin/feed/stats/route';
import { createAccessToken } from '@/lib/jwt';
import { FEED_COUNT_SQL, montarContagem } from '@/lib/feed/stats';
import { FEED_ELIGIBILITY_WHERE, FEED_SQL } from '@/lib/feed/query';

const read = (rel: string) => readFileSync(path.join(__dirname, '..', rel), 'utf8');
const req = (token?: string) => new NextRequest('http://localhost/api/v1/admin/feed/stats', { headers: token ? { cookie: `access_token=${token}` } : {} });
const tok = () => createAccessToken('u1', 'a@teste.local');
// dados no formato de produção (levantamento anterior): 33 usuários, 184 sinais
const PRODUCAO = [
  { sinal: true, status: 'lost', n: 124 }, { sinal: true, status: 'found', n: 60 },
  { sinal: false, status: 'lost', n: 24 }, { sinal: false, status: 'found', n: 3 }, { sinal: false, status: 'stolen', n: 6 },
];

beforeEach(() => { h.role = 'admin'; h.userExists = true; h.countRows = PRODUCAO; h.countFails = false; h.calls.length = 0; });

describe('rota /api/v1/admin/feed/stats: acesso', () => {
  it('sem login → 401 (e nenhuma contagem é lida)', async () => {
    const r = await GET(req());
    expect(r.status).toBe(401); expect(h.calls.some((s) => s.includes('GROUP BY'))).toBe(false);
  });
  it('token inválido → 401', async () => { expect((await GET(req('lixo'))).status).toBe(401); });
  it('usuário comum → 403', async () => { h.role = 'user'; expect((await GET(req(tok()))).status).toBe(403); expect(h.calls.some((s) => s.includes('GROUP BY'))).toBe(false); });
  it('papel vazio (nulo) → 403; parceiro B2B (b2b_admin) → 403; usuário que não existe → 401', async () => {
    h.role = null; expect((await GET(req(tok()))).status).toBe(403);
    h.role = 'b2b_admin'; expect((await GET(req(tok()))).status).toBe(403);
    h.userExists = false; expect((await GET(req(tok()))).status).toBe(401);
  });
  it('admin e super_admin → 200', async () => {
    for (const role of ['admin', 'super_admin']) { h.role = role; expect((await GET(req(tok()))).status, role).toBe(200); }
  });
  it('erro no banco → 500 com mensagem genérica (sem vazar o erro)', async () => {
    h.countFails = true; const r = await GET(req(tok()));
    expect(r.status).toBe(500); expect(JSON.stringify(await r.json())).not.toMatch(/banco fora/);
  });
});

describe('rota: formato da resposta e números de produção', () => {
  it('formato: total, usuarios, sinais_publicos, por_status (cada um com total/lost/found/stolen), teto, acima_do_teto, gerado_em', async () => {
    const j = await (await GET(req(tok()))).json();
    expect(Object.keys(j).sort()).toEqual(['acima_do_teto', 'gerado_em', 'por_status', 'sinais_publicos', 'teto_do_feed', 'total', 'usuarios']);
    for (const k of ['usuarios', 'sinais_publicos', 'por_status']) expect(Object.keys(j[k]).sort()).toEqual(['found', 'lost', 'stolen', 'total']);
    expect(typeof j.gerado_em).toBe('string'); expect(j.teto_do_feed).toBe(1000); expect(j.acima_do_teto).toBe(false);
  });
  it('com os números do último levantamento: 217 = 33 usuários + 184 sinais; sinais 124 perdidos + 60 achados; usuários 24 perdidos + 3 achados + 6 roubados', async () => {
    const j = await (await GET(req(tok()))).json();
    expect(j.total).toBe(217);
    expect(j.usuarios).toEqual({ total: 33, lost: 24, found: 3, stolen: 6 });
    expect(j.sinais_publicos).toEqual({ total: 184, lost: 124, found: 60, stolen: 0 });
    expect(j.por_status).toEqual({ total: 217, lost: 148, found: 63, stolen: 6 });
  });
  it('as partes sempre somam o total', () => {
    const c = montarContagem(PRODUCAO);
    expect(c.usuarios.total + c.sinais_publicos.total).toBe(c.total);
    expect(c.por_status.lost + c.por_status.found + c.por_status.stolen).toBe(c.total);
  });
  it('montarContagem: origem nula conta como usuário (igual ao Feed), números em texto viram número, status fora do Feed é ignorado, acima do teto avisa', () => {
    const c = montarContagem([{ sinal: false, status: 'lost', n: '5' }, { sinal: false, status: 'returned', n: 9 }, { sinal: true, status: 'found', n: 1001 }]);
    expect(c.usuarios.lost).toBe(5); expect(c.total).toBe(1006); expect(c.acima_do_teto).toBe(true);
    expect(montarContagem([])).toMatchObject({ total: 0, acima_do_teto: false });
  });
});

describe('mesma regra de elegibilidade do Feed (fonte única) e somente leitura', () => {
  it('a contagem e a leitura do Feed usam EXATAMENTE o mesmo trecho de regra', () => {
    expect(FEED_COUNT_SQL).toContain(`WHERE ${FEED_ELIGIBILITY_WHERE}`);
    expect(FEED_SQL).toContain(`WHERE ${FEED_ELIGIBILITY_WHERE}`);
    for (const parte of ['o.is_public = true', 'o.is_legacy = false', "o.status IN ('lost', 'found', 'stolen')", 'o.qr_code IS NOT NULL']) expect(FEED_ELIGIBILITY_WHERE).toContain(parte);
  });
  it('a regra NÃO foi copiada: nenhum outro arquivo escreve as condições do Feed por conta própria', () => {
    for (const f of ['src/lib/feed/stats.ts', 'src/app/api/v1/admin/feed/stats/route.ts', 'src/app/admin/dashboard/FeedStatsCard.tsx']) {
      const t = read(f); expect(t, f).not.toMatch(/is_public\s*=\s*true/); expect(t, f).not.toMatch(/is_legacy\s*=\s*false/);
    }
  });
  it('a consulta do Feed ficou IDÊNTICA (mesmo texto SQL de antes da extração da regra)', () => {
    const ORIGINAL = `
  SELECT o.qr_code AS code, o.title, o.status, o.category, o.type,
         o.location AS location_text, o.latitude, o.longitude, o.source, o.created_at,
         (o.is_boosted = true AND (o.boost_expires_at IS NULL OR o.boost_expires_at > NOW())) AS boosted,
         CASE WHEN left(o.images->>0, 8) = 'https://' THEN o.images->>0 END AS photo_url,
         ev.source_url
    FROM objects o
    LEFT JOIN LATERAL (
      SELECT e.source_url FROM public_signal_evidence e
       WHERE o.source = 'public_signal' AND e.object_id = o.id AND e.status = 'approved'
         AND left(e.source_url, 4) = 'http'
       ORDER BY e.created_at DESC LIMIT 1
    ) ev ON true
   WHERE o.is_public = true
     AND o.is_legacy = false
     AND o.status IN ('lost', 'found', 'stolen')
     AND o.qr_code IS NOT NULL
   ORDER BY o.created_at DESC, o.id
   LIMIT $1`;
    expect(FEED_SQL).toBe(ORIGINAL);
  });
  it('só leitura: a contagem é um SELECT com GROUP BY, sem escrita, sem legado e sem tocar em mais nada', () => {
    expect(FEED_COUNT_SQL).toMatch(/^\s*SELECT/);
    expect(FEED_COUNT_SQL).not.toMatch(/\b(INSERT|UPDATE|DELETE|ALTER|DROP|TRUNCATE|CREATE)\b/i);
    expect(FEED_COUNT_SQL).not.toMatch(/JOIN/i);
    const r = read('src/app/api/v1/admin/feed/stats/route.ts');
    expect(r).toContain('requireAdmin'); expect(r).toContain("export const dynamic = 'force-dynamic'");
    expect(r).not.toMatch(/export (async )?function (POST|PUT|PATCH|DELETE)/);
  });
});

describe('menu e dashboard do admin', () => {
  const layout = read('src/app/admin/layout.tsx');
  it('atalho «Feed» no grupo Visão Geral, para /feed, em nova aba e sem acesso ao opener', () => {
    const grupo = layout.slice(layout.indexOf("section: 'Visão Geral'"), layout.indexOf("section: 'P1"));
    expect(grupo).toMatch(/href: '\/feed'[^}]*label: 'Feed'[^}]*superOnly: false, external: true/);
    expect(layout).toContain('target="_blank" rel="noopener noreferrer"');
  });
  it('os demais itens do menu seguem iguais (mesmas rotas e rótulos, mesma ordem)', () => {
    const hrefs = [...layout.matchAll(/\{ href: '(\/[^']*)',\s*icon/g)].map((m) => m[1]);
    expect(hrefs).toEqual(['/admin/dashboard', '/admin/analytics', '/feed', '/admin/objects', '/admin/users', '/admin/matches', '/admin/publicacoes', '/admin/moderacao', '/admin/public-signals',
      '/admin/b2b', '/admin/b2b-portal', '/admin/condominios', '/admin/custody', '/admin/custody/scan', '/admin/delivery/parceiros', '/admin/delivery/entregas', '/admin/delivery/rastreio',
      '/admin/marketing/leads', '/admin/marketing/automacao', '/admin/marketing/reativacao', '/admin/social-posts', '/admin/emails', '/admin/marketing/brand', '/admin/comunidade',
      '/admin/financeiro', '/admin/planos', '/admin/relatorios', '/admin/sistema', '/admin/equipe']);
  });
  it('dashboard: o cartão entra uma única vez, sem mudar o resto da página', () => {
    const d = read('src/app/admin/dashboard/page.tsx');
    expect((d.match(/<FeedStatsCard \/>/g) ?? []).length).toBe(1);
    expect((d.match(/import FeedStatsCard from "\.\/FeedStatsCard";/g) ?? []).length).toBe(1);
    expect(d).toContain('fetch("/api/v1/admin/stats")');   // a busca de estatísticas de sempre continua
  });
  it('o cartão chama só a rota nova (leitura) e mostra os números pedidos', () => {
    const c = read('src/app/admin/dashboard/FeedStatsCard.tsx');
    expect(c).toContain('fetch("/api/v1/admin/feed/stats")');
    expect(c).not.toMatch(/method:\s*"(POST|PUT|PATCH|DELETE)"/);
    for (const t of ['Usuários', 'Sinais públicos', 'Perdidos', 'Achados', 'Roubados', 'Abrir o Feed']) expect(c).toContain(t);
    expect(c).toContain('target="_blank" rel="noopener noreferrer"');
  });
  it('nada do Feed público mudou: página, API, canonical, robots e cache', () => {
    const p = read('src/app/feed/[[...slug]]/page.tsx');
    expect(p).toContain('export const revalidate = 300');
    expect(p).toContain("alternates: { canonical: `${APP_URL}/feed` }");
    expect(read('src/app/api/v1/feed/route.ts')).toContain('getRankedFeed');
  });
});
