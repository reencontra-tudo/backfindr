#!/usr/bin/env node
// Navegador (390 e 1280 px): aba inicial da lista «Mensagens» e a bolha do assistente na tela da conversa. Banco local de teste; nada de produção.
//   node tools/mensagens-ajustes-check.mjs <baseLigada>
import { createRequire } from 'node:module';
const req = createRequire(import.meta.url); const { chromium } = req('playwright'); const jwt = req('jsonwebtoken'); const { Pool } = req('pg');
const BASE = process.argv[2]; let fails = 0; const ok = (n, c, x = '') => { if (!c) fails++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}${x ? '  — ' + x : ''}`); };
const pool = new Pool({ connectionString: process.env.DATABASE_URL }); const q = async (s, p = []) => (await pool.query(s, p)).rows;
const DONO = { id: '11111111-1111-4111-8111-111111111111', name: 'Dona Teste', email: 'dono@msg.local', role: 'user' };
const ACHADOR = { id: '22222222-2222-4222-8222-222222222222', name: 'Achador Teste', email: 'achador@msg.local', role: 'user' };
const token = (u) => jwt.sign({ sub: u.id, email: u.email }, process.env.SECRET_KEY, { algorithm: 'HS256', expiresIn: '1h' });
const J = (o) => ({ status: 200, contentType: 'application/json', body: JSON.stringify(o) });
const b = await chromium.launch(); const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
async function abrir(W, user) {
  const ctx = await b.newContext({ viewport: { width: W, height: 844 }, isMobile: W < 1000, userAgent: W < 1000 ? UA : undefined });
  await ctx.addCookies([{ name: 'access_token', value: token(user), url: BASE }, { name: 'refresh_token', value: token(user), url: BASE }]);
  await ctx.addInitScript((u) => { localStorage.setItem('backfindr-auth', JSON.stringify({ state: { user: u, isAuthenticated: true }, version: 0 })); localStorage.setItem('backfindr_welcome_shown', '1'); }, user);
  await ctx.route(/google|clarity|facebook|mapbox|ipapi|posthog/, (r) => r.abort());
  await ctx.route('**/api/v1/**', (r) => { const u = new URL(r.request().url()).pathname; if (/\/conversas/.test(u)) return r.continue();
    if (u.endsWith('/users/me')) return r.fulfill(J(user)); if (u.endsWith('/v1/objects')) return r.fulfill(J({ total: 1, objects: [] })); return r.fulfill(J({ total: 0, by_match: {}, notifications: [], items: [], matches: [] })); });
  return { ctx, p: await ctx.newPage() };
}
const semRolagem = (p) => p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
const objId = (await q(`SELECT id FROM objects WHERE qr_code = 'MSG00001'`))[0].id;
for (const W of [390, 1280]) { const L = `[${W}]`;
  await pool.query('TRUNCATE conversas, mensagens_conversa CASCADE');
  // 1) conversa aberta com mensagem NÃO lida do dono para o achador, título com espaço no fim
  const cid = (await q(`INSERT INTO conversas (object_id, objeto_titulo, achador_id, dono_id, estado, primeira_mensagem, aceita_em) VALUES ($1, 'Mochila de teste  ', $2, $3, 'aberta', 'Achei.', now()) RETURNING id`, [objId, ACHADOR.id, DONO.id]))[0].id;
  await pool.query(`INSERT INTO mensagens_conversa (conversa_id, autor_id, texto) VALUES ($1, $2, 'Achei.'), ($1, $3, 'Obrigada, já vou aí.')`, [cid, ACHADOR.id, DONO.id]);
  { const { ctx, p } = await abrir(W, ACHADOR); await p.goto(`${BASE}/dashboard/mensagens`, { waitUntil: 'networkidle' }); await p.waitForTimeout(1500);
    ok(`${L} achador com mensagem não lida: a lista abre em «Abertas»`, (await p.locator('[role=tab][aria-selected=true]').getAttribute('data-aba')) === 'abertas' && (await p.locator('[data-conversa]').count()) === 1);
    ok(`${L} título sem espaço sobrando na lista`, (await p.locator('[data-conversa]').first().innerText()).split('\n')[0] === 'Mochila de teste');
    await ctx.close(); }
  // 2) aviso esperando o dono → «Aguardando você»; nada novo → comportamento de sempre
  await pool.query('TRUNCATE conversas, mensagens_conversa CASCADE');
  await pool.query(`INSERT INTO conversas (object_id, objeto_titulo, achador_id, dono_id, estado, primeira_mensagem) VALUES ($1, 'Mochila de teste', $2, $3, 'aguardando', 'Achei.')`, [objId, ACHADOR.id, DONO.id]);
  { const { ctx, p } = await abrir(W, DONO); await p.goto(`${BASE}/dashboard/mensagens`, { waitUntil: 'networkidle' }); await p.waitForTimeout(1500);
    ok(`${L} dono com aviso pendente: abre em «Aguardando você»`, (await p.locator('[role=tab][aria-selected=true]').getAttribute('data-aba')) === 'aguardando_voce' && (await p.locator('[data-conversa]').count()) === 1); await ctx.close(); }
  { const { ctx, p } = await abrir(W, ACHADOR); await p.goto(`${BASE}/dashboard/mensagens`, { waitUntil: 'networkidle' }); await p.waitForTimeout(1500);
    ok(`${L} achador só com aviso aguardando (nada novo): fica como sempre («Aguardando você», vazia)`, (await p.locator('[role=tab][aria-selected=true]').getAttribute('data-aba')) === 'aguardando_voce' && (await p.locator('[data-mensagens-vazio]').count()) === 1); await ctx.close(); }
  // 3) conversa aberta: o botão de enviar não fica sob a bolha do assistente; sem rolagem horizontal
  await pool.query('TRUNCATE conversas, mensagens_conversa CASCADE');
  const c2 = (await q(`INSERT INTO conversas (object_id, objeto_titulo, achador_id, dono_id, estado, primeira_mensagem, aceita_em) VALUES ($1, 'Mochila de teste', $2, $3, 'aberta', 'Achei.', now()) RETURNING id`, [objId, ACHADOR.id, DONO.id]))[0].id;
  await pool.query(`INSERT INTO mensagens_conversa (conversa_id, autor_id, texto) VALUES ($1, $2, 'Achei.')`, [c2, ACHADOR.id]);
  { const { ctx, p } = await abrir(W, ACHADOR); await p.goto(`${BASE}/dashboard/mensagens/${c2}`, { waitUntil: 'networkidle' }); await p.waitForTimeout(1500);
    const g = await p.evaluate(() => { const s = document.querySelector('button[aria-label=Enviar]')?.getBoundingClientRect(); const f = document.querySelector('button[aria-label="Abrir assistente"]')?.getBoundingClientRect(); return s && f ? { sobreposto: Math.min(s.right, f.right) - Math.max(s.left, f.left) > 0 && Math.min(s.bottom, f.bottom) - Math.max(s.top, f.top) > 0, s: [Math.round(s.bottom), Math.round(f.top)] } : { ausente: !s ? 'enviar' : 'bolha' }; });
    ok(`${L} botão «Enviar» não fica sob a bolha do assistente`, g.sobreposto === false, JSON.stringify(g));
    ok(`${L} tela da conversa sem rolagem horizontal`, await semRolagem(p));
    if (W === 390) await p.screenshot({ path: '/tmp/claude-0/vis/msg-conversa-bolha-390.png' });
    await p.getByLabel('Mensagem').fill('teste'); await p.getByRole('button', { name: 'Enviar' }).click(); await p.waitForTimeout(1200);
    ok(`${L} enviar funciona (a mensagem aparece)`, (await p.locator('body').innerText()).includes('teste')); await ctx.close(); }
  // 4) bolha em outras páginas segue igual (CSS global intacto): a bolha existe e está no canto de sempre
  { const { ctx, p } = await abrir(W, ACHADOR); await p.goto(`${BASE}/dashboard/mensagens`, { waitUntil: 'networkidle' }); await p.waitForTimeout(800);
    const f = await p.evaluate(() => { const r = document.querySelector('button[aria-label="Abrir assistente"]')?.getBoundingClientRect(); return r ? { direita: Math.round(window.innerWidth - r.right), baixo: Math.round(window.innerHeight - r.bottom) } : null; });
    ok(`${L} bolha nas outras telas continua no canto de sempre (24 px)`, f && f.direita === 24 && f.baixo === 24, JSON.stringify(f)); await ctx.close(); }
}
console.log(fails ? fails + ' FALHA(S)' : 'TUDO OK'); await b.close(); await pool.end(); process.exit(fails ? 1 : 0);
