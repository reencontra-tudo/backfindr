#!/usr/bin/env node
// Navegador: área de mensagens (aviso «encontrei» → conversa), a 390 e 1280 px, com DOIS usuários de teste e o servidor local com MENSAGENS_ATIVO=1
// (as rotas de conversas e o /objeto são os reais; só o «eu», o contador de objetos e o login/PATCH do objeto são simulados no navegador).
//   node tools/mensagens-check.mjs <baseLigada> <baseDesligada>        (banco local de teste; nada de produção)
import { createRequire } from 'node:module';
const req = createRequire(import.meta.url);
const { chromium } = req('playwright'); const jwt = req('jsonwebtoken'); const { Pool } = req('pg');
const [ON, OFF] = process.argv.slice(2); let fails = 0; const ok = (n, c, x = '') => { if (!c) fails++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}${x ? '  — ' + x : ''}`); };
const pool = new Pool({ connectionString: process.env.DATABASE_URL }); const q = async (s, p = []) => (await pool.query(s, p)).rows;
const DONO = { id: '11111111-1111-4111-8111-111111111111', name: 'Dona Teste', email: 'dono@msg.local', role: 'user' };
const ACHADOR = { id: '22222222-2222-4222-8222-222222222222', name: 'Achador Teste', email: 'achador@msg.local', role: 'user' };
const token = (u) => jwt.sign({ sub: u.id, email: u.email }, process.env.SECRET_KEY, { algorithm: 'HS256', expiresIn: '1h' });
const b = await chromium.launch(); const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const J = (o, status = 200) => ({ status, contentType: 'application/json', body: JSON.stringify(o) });
async function abrir(base, W, user) {
  const ctx = await b.newContext({ viewport: { width: W, height: 844 }, isMobile: W < 1000, userAgent: W < 1000 ? UA : undefined });
  if (user) {
    await ctx.addCookies([{ name: 'access_token', value: token(user), url: base }, { name: 'refresh_token', value: token(user), url: base }]);
    await ctx.addInitScript((u) => { localStorage.setItem('backfindr-auth', JSON.stringify({ state: { user: u, isAuthenticated: true }, version: 0 })); localStorage.setItem('backfindr_welcome_shown', '1'); }, user);
  }
  await ctx.route(/google|clarity|facebook|mapbox|ipapi|posthog/, (r) => r.abort());
  await ctx.route('**/api/v1/**', (r) => {
    const u = new URL(r.request().url()).pathname; const m = r.request().method();
    if (/\/conversas|\/objects\/scan\//.test(u)) return r.continue();
    if (u.endsWith('/users/me')) return r.fulfill(J(user ?? {}, user ? 200 : 401));
    if (u.endsWith('/v1/objects')) return r.fulfill(J({ total: 1, objects: [] }));
    if (m === 'PATCH' && /\/objects\//.test(u)) return r.fulfill(J({ ok: true }));
    if (u.endsWith('/auth/login')) return r.fulfill(J({ access_token: token(ACHADOR), refresh_token: token(ACHADOR), token_type: 'bearer' }));
    return r.fulfill(J({ total: 0, by_match: {}, notifications: [], items: [], matches: [] }));
  });
  return { ctx, p: await ctx.newPage() };
}
const semRolagem = (p) => p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
const menu = async (p, W) => { if (W < 1000) await p.locator('button:has(svg.lucide-menu)').first().click(); await p.waitForTimeout(300); };

for (const W of [390, 1280]) {
  const L = `[${W}]`;
  await pool.query('TRUNCATE conversas, mensagens_conversa CASCADE'); await pool.query(`UPDATE objects SET found_pending_confirmation = false, found_pending_since = NULL, status = 'lost' WHERE qr_code = 'MSG00001'`);
  const objetoId = (await q(`SELECT id FROM objects WHERE qr_code = 'MSG00001'`))[0].id;

  // A. visitante sem conta: precisa entrar; o login volta para o objeto
  { const { ctx, p } = await abrir(ON, W, null); await p.goto(`${ON}/objeto/MSG00001`, { waitUntil: 'networkidle' }); await p.waitForTimeout(600);
    const t = await p.locator('body').innerText();
    ok(`${L} visitante: botão «Entrar para avisar o dono», link «Criar conta gratuita», sem caixa de mensagem`, t.includes('Entrar para avisar o dono') && t.includes('Criar conta gratuita') && (await p.locator('[data-primeira-mensagem]').count()) === 0);
    const href = await p.locator('[data-criar-conta]').getAttribute('href'); ok(`${L} «Criar conta» leva ao cadastro com o retorno ao objeto`, href === '/auth/register?next=%2Fobjeto%2FMSG00001', href);
    await p.goto(`${ON}/auth/login?next=${encodeURIComponent('/objeto/MSG00001')}`); await p.locator('input[type=email]').fill('achador@msg.local'); await p.locator('input[type=password]').first().fill('SenhaTeste123'); await p.getByRole('button', { name: /^Entrar$/ }).click();
    await p.waitForURL(/\/objeto\/MSG00001/, { timeout: 20000 }).catch(() => {}); ok(`${L} depois do login volta ao objeto (retorno à página pretendida)`, new URL(p.url()).pathname === '/objeto/MSG00001', p.url().replace(ON, ''));
    const ruim = await (async () => { await p.evaluate(() => sessionStorage.clear()); await p.goto(`${ON}/auth/login?next=${encodeURIComponent('https://evil.example/x')}`); return p.evaluate(() => sessionStorage.getItem('bf_next')); })(); ok(`${L} destino externo é ignorado`, ruim === null);
    await ctx.close(); }

  // B. achador logado avisa
  { const { ctx, p } = await abrir(ON, W, ACHADOR); await p.goto(`${ON}/objeto/MSG00001`, { waitUntil: 'networkidle' }); await p.waitForTimeout(600);
    ok(`${L} achador logado vê a caixa de mensagem (até 280) e a orientação de prova de dono`, (await p.locator('[data-primeira-mensagem]').count()) === 1 && (await p.locator('body').innerText()).includes('Não conte o detalhe que só o dono saberia'));
    const botao = p.getByRole('button', { name: /Avisar o dono que encontrei/ }); ok(`${L} o botão só habilita com texto`, await botao.isDisabled());
    await p.locator('#primeira-mensagem').fill('Achei perto da estação, guardei comigo.'); await botao.click(); await p.waitForSelector('[data-aviso-registrado]', { timeout: 15000 });
    const t = await p.locator('body').innerText();
    ok(`${L} tela de aviso: «Seu aviso foi registrado. Não há garantia de resposta.» e «Ver em Mensagens»`, t.includes('Seu aviso foi registrado. Não há garantia de resposta.') && t.includes('Ver em Mensagens') && !/chat da plataforma|imediat/i.test(t));
    const c = (await q(`SELECT estado FROM conversas`)); ok(`${L} conversa criada em «aguardando»`, c.length === 1 && c[0].estado === 'aguardando');
    ok(`${L} o objeto NÃO mudou com o aviso`, (await q(`SELECT found_pending_confirmation fp FROM objects WHERE qr_code = 'MSG00001'`))[0].fp === false);
    ok(`${L} aviso enviado sem rolagem horizontal`, await semRolagem(p));
    await p.getByRole('link', { name: 'Ver em Mensagens' }).click(); await p.waitForURL(/\/dashboard\/mensagens\/[0-9a-f-]{36}/, { timeout: 15000 }); await p.waitForTimeout(800);
    const t2 = await p.locator('body').innerText();
    ok(`${L} achador: «Aguardando o dono», texto honesto, «Cancelar aviso» e a dica`, t2.includes('Aguardando o dono') && t2.includes('Seu aviso foi registrado. Não há garantia de resposta.') && t2.includes('Cancelar aviso') && t2.includes('Dica: não conte'));
    if (W === 390) await p.screenshot({ path: '/tmp/claude-0/vis/msg-achador-aguardando-390.png' });
    await ctx.close(); }

  // C. dono: menu com contador, lista, aceitar, conversar, É o meu, devolução
  { const { ctx, p } = await abrir(ON, W, DONO); await p.goto(`${ON}/dashboard`, { waitUntil: 'networkidle' }); await p.waitForTimeout(1500); await menu(p, W);
    const item = p.getByRole('link', { name: /Mensagens/ }).first(); ok(`${L} menu «Mensagens» existe${W < 1000 ? ' (menu do celular)' : ''}`, await item.isVisible());
    ok(`${L} contador de avisos aguardando = 1`, ((await item.innerText()).match(/\d+/) ?? [])[0] === '1', (await item.innerText()).replace(/\s+/g, ' '));
    if (W === 390) await p.screenshot({ path: '/tmp/claude-0/vis/msg-menu-390.png' });
    await item.click(); await p.waitForURL(/\/dashboard\/mensagens$/, { timeout: 15000 }); await p.waitForTimeout(800);
    ok(`${L} lista: filtro «Aguardando você» tem o aviso; os 4 filtros existem`, (await p.locator('[data-conversa]').count()) === 1 && (await p.locator('[role=tab]').count()) === 4);
    if (W === 390) await p.screenshot({ path: '/tmp/claude-0/vis/msg-lista-390.png' });
    await p.locator('[data-conversa]').first().click(); await p.waitForSelector('[data-aguardando-voce]', { timeout: 15000 });
    const t = await p.locator('body').innerText(); ok(`${L} dono vê o texto oficial do aviso, «Aceitar conversa» e «Não é meu»`, t.includes('Alguém avisou que pode ter encontrado “Mochila de teste”. Veja o aviso e decida se quer conversar.') && t.includes('Aceitar conversa') && t.includes('Não é meu') && t.includes('Ao aceitar, vocês trocam mensagens aqui, dentro do Backfindr. Não envie telefone, e-mail nem endereço.'));
    ok(`${L} conversa sem rolagem horizontal`, await semRolagem(p));
    if (W === 390) await p.screenshot({ path: '/tmp/claude-0/vis/msg-dono-decide-390.png' });
    await p.getByRole('button', { name: 'Aceitar conversa' }).click(); await p.waitForSelector('[data-acoes-aberta]', { timeout: 15000 });
    ok(`${L} aceitar: conversa aberta e o objeto continua sem marca`, (await q(`SELECT estado FROM conversas`))[0].estado === 'aberta' && (await q(`SELECT found_pending_confirmation fp FROM objects WHERE qr_code = 'MSG00001'`))[0].fp === false);
    await p.getByLabel('Mensagem').fill('Obrigada! Como era o fecho da mochila?'); await p.getByRole('button', { name: 'Enviar' }).click(); await p.waitForTimeout(1200);
    ok(`${L} mensagem enviada aparece`, (await p.locator('body').innerText()).includes('Como era o fecho da mochila?'));
    await p.getByRole('button', { name: 'É o meu' }).click(); await p.waitForTimeout(1200);
    ok(`${L} «É o meu»: agora o objeto vira «achado pendente»`, (await q(`SELECT found_pending_confirmation fp FROM objects WHERE qr_code = 'MSG00001'`))[0].fp === true);
    if (W === 390) await p.screenshot({ path: '/tmp/claude-0/vis/msg-dono-aberta-390.png' });
    await p.getByRole('button', { name: 'Confirmar devolução' }).click(); await p.waitForSelector('[data-conversa-fechada]', { timeout: 15000 });
    ok(`${L} «Confirmar devolução» encerra a conversa («Conversa encerrada.»)`, (await q(`SELECT estado, motivo FROM conversas`))[0].estado === 'encerrada' && (await p.locator('body').innerText()).includes('Conversa encerrada.'));
    await ctx.close(); }

  // D. achador vê a conversa encerrada; função desligada = como antes
  { const { ctx, p } = await abrir(ON, W, ACHADOR); const id = (await q(`SELECT id FROM conversas`))[0].id; await p.goto(`${ON}/dashboard/mensagens/${id}`, { waitUntil: 'networkidle' }); await p.waitForTimeout(800);
    const t = await p.locator('body').innerText(); ok(`${L} achador vê a conversa e o encerramento`, t.includes('Como era o fecho da mochila?') && t.includes('Conversa encerrada.')); await ctx.close(); }
  { const { ctx, p } = await abrir(OFF, W, DONO); await p.goto(`${OFF}/dashboard`, { waitUntil: 'networkidle' }); await p.waitForTimeout(1500); await menu(p, W);
    ok(`${L} função desligada: sem «Mensagens» no menu`, (await p.getByRole('link', { name: /^Mensagens/ }).count()) === 0);
    await p.goto(`${OFF}/objeto/MSG00001`, { waitUntil: 'networkidle' }); await p.waitForTimeout(600); const t = await p.locator('body').innerText();
    ok(`${L} função desligada: /objeto igual a antes (sem caixa de mensagem, botão de sempre)`, t.includes('Avisar o dono que encontrei') && (await p.locator('[data-primeira-mensagem]').count()) === 0 && !t.includes('Entrar para avisar'));
    await ctx.close(); }
}
console.log(fails ? fails + ' FALHA(S)' : 'TUDO OK'); await b.close(); await pool.end(); process.exit(fails ? 1 : 0);
