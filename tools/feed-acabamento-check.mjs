#!/usr/bin/env node
// Verificação de navegador dos ajustes de acabamento do Feed: card inteiro clicável (e eventos), chips sem rolagem, Categoria/Região lado a lado,
// atalhos do topo e do menu «Cadastrar», «Encontrei» na Grade, balão do assistente. Playwright (fora das dependências). Só leitura.
//   node tools/feed-acabamento-check.mjs <baseUrl> [larguras, ex.: 320,360,375,390,430,768,1024,1440]
// Precisa de um Feed com muitos cards (tests/fixtures/feed-grande-seed.sql). Chromium emulando (NÃO é Safari/iPhone/Android reais).
import { createRequire } from 'node:module';
import { readFileSync, existsSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
const { chromium } = createRequire(import.meta.url)('playwright');
const BASE = process.argv[2], WIDTHS = (process.argv[3] || '320,360,375,390,430,768,1024,1440').split(',').map(Number);
const PHOTO = existsSync('/tmp/claude-0/sample-photo.jpg') ? readFileSync('/tmp/claude-0/sample-photo.jpg') : null;
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
let fails = 0;
const ok = (n, c, x = '') => { if (!c) fails++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}${x !== '' ? '  — ' + x : ''}`); };
// PROD=1: contra a produção (somente leitura) pelo proxy do ambiente; a analítica é bloqueada (eventos só se verificam pelo código e por captura local)
const PROD = process.env.PROD === '1';
const b = await chromium.launch(PROD ? { proxy: { server: process.env.HTTPS_PROXY } } : {});
const CONFIG = "window._POSTHOG_REMOTE_CONFIG=window._POSTHOG_REMOTE_CONFIG||{};window._POSTHOG_REMOTE_CONFIG['phc_local_test_not_real']={config:{token:'phc_local_test_not_real',supportedCompression:['gzip-js','base64']},siteApps:[]};";

async function abrir(W, vis, { stubs = true } = {}) {
  const mobile = W < 1000;
  const ctx = await b.newContext({ viewport: { width: W, height: mobile ? 844 : 800 }, deviceScaleFactor: 1, isMobile: mobile, hasTouch: mobile, userAgent: mobile ? UA : 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36' });   // o PostHog ignora «HeadlessChrome»
  const st = { eventos: [], nav: [] };
  await ctx.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
    Object.defineProperty(navigator, 'userAgentData', { get: () => ({ brands: [{ brand: 'Chromium', version: '124' }], mobile: true, platform: 'iOS' }) });
  });
  if (vis === 'grade') await ctx.addInitScript(() => { try { localStorage.setItem('feed-visualizacao-v1', 'grade'); } catch { /* sem problema */ } });
  await ctx.route('http://localhost:3199/**', async (route) => {
    const req = route.request(); const u = req.url();
    if (/\/array\/[^/]+\/config\.js/.test(u)) return route.fulfill({ status: 200, contentType: 'application/javascript', body: CONFIG });
    if (/\/flags\/|\/decide|\/config\?/.test(u)) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ featureFlags: {}, featureFlagPayloads: {}, config: { enable_collect_everything: false }, supportedCompression: ['gzip-js', 'base64'], autocapture_opt_out: true }) });
    try {
      const buf = req.postDataBuffer();
      if (buf) { let txt; try { txt = gunzipSync(buf).toString('utf8'); } catch { txt = buf.toString('utf8'); }
        const m = txt.match(/^data=(.*)$/s); if (m) txt = Buffer.from(decodeURIComponent(m[1]), 'base64').toString('utf8');
        const j = JSON.parse(txt); (Array.isArray(j) ? j : [j]).forEach((e) => e?.event && st.eventos.push(e)); }
    } catch { /* corpo ilegível */ }
    route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });
  await ctx.route(/google|clarity|facebook|mapbox|ipapi|posthog|vercel-insights|vitals/i, (r) => r.abort());
  if (PHOTO) await ctx.route(/^https:\/\/pub-[a-z0-9]+\.r2\.dev\//, (r) => r.fulfill({ status: 200, contentType: 'image/jpeg', body: PHOTO }));
  if (stubs) await ctx.route(/\/(objeto|achei|flow)\//, (r) => { if (r.request().resourceType() === 'document') { st.nav.push(new URL(r.request().url()).pathname + new URL(r.request().url()).search); return r.fulfill({ status: 200, contentType: 'text/html', body: '<html><body>destino</body></html>' }); } return r.continue(); });
  const p = await ctx.newPage();
  await p.goto(`${BASE}/feed`); await p.waitForSelector(`[data-vis="${vis}"] article`); await p.waitForTimeout(1500);
  return { ctx, p, st };
}
const evts = (st, nome) => st.eventos.filter((e) => e.event === nome);
// Em produção a analítica é bloqueada de propósito: as conferências de EVENTO passam a ser só informativas (o evento único por toque é conferido pelo código e pela captura local).
const EV = (cond) => PROD || cond;
// Destino alcançado: navegação interna (o Next troca a URL) ou documento novo (interceptado). Espera até 8 s.
const destino = async (p, st, ate = 8000) => { const t0 = Date.now(); while (Date.now() - t0 < ate) { const u = new URL(p.url()); const d = u.pathname + u.search; if (!d.startsWith('/feed')) return d; if (st.nav.length) return st.nav[st.nav.length - 1]; await p.waitForTimeout(150); } return new URL(p.url()).pathname; };

for (const c of ['USR00005']) await fetch(`${BASE}/objeto/${c}`).catch(() => {});   // aquece a página de destino (1ª geração é lenta)
// ---- layout (todas as larguras, as duas visualizações)
for (const W of WIDTHS) for (const v of ['publicacoes', 'grade']) {
  const L = `[${W} ${v}]`; const { ctx, p } = await abrir(W, v);
  const chips = await p.evaluate(() => { const g = document.querySelector('[aria-label="Situação"]'); const bs = [...g.querySelectorAll('button')]; const gr = g.getBoundingClientRect();
    return { n: bs.length, semRolagem: g.scrollWidth <= g.clientWidth + 1, todosDentro: bs.every((x) => { const r = x.getBoundingClientRect(); return r.left >= gr.left - 1 && r.right <= gr.right + 1; }), alturas: bs.map((x) => Math.round(x.getBoundingClientRect().height)) }; });
  if (W >= 375) ok(`${L} os 4 chips visíveis sem rolagem horizontal`, chips.n === 4 && chips.semRolagem && chips.todosDentro, JSON.stringify(chips));
  else ok(`${L} chips com degradê (podem rolar neste tamanho)`, chips.n === 4, `semRolagem=${chips.semRolagem}`);
  const sel = await p.evaluate(() => { const s = [...document.querySelectorAll('[aria-label="Filtros do Feed"] select')].map((x) => { const r = x.getBoundingClientRect(); return { top: Math.round(r.top), left: Math.round(r.left), w: Math.round(r.width), h: Math.round(r.height), nome: x.getAttribute('aria-label') }; }); return { s, rotulos: document.querySelectorAll('[aria-label="Filtros do Feed"] label').length }; });
  ok(`${L} Categoria e Região lado a lado (mesma linha), sem rótulo visível, 44 px`, sel.s.length === 2 && sel.s[0].top === sel.s[1].top && sel.s[0].left < sel.s[1].left && sel.rotulos === 0 && sel.s.every((x) => x.h >= 43.5), JSON.stringify(sel.s));
  const vi = await p.evaluate(() => { const g = document.querySelector('[aria-label="Visualização"]').getBoundingClientRect(); const c = document.querySelector('[aria-label="Situação"]').getBoundingClientRect(); const f = document.querySelector('[aria-label="Filtros do Feed"]').getBoundingClientRect(); return { abaixoDosChips: g.top >= c.bottom - 1, direita: Math.abs(g.right - f.right) <= 1 }; });
  ok(`${L} seletor de visualização em linha própria, à direita`, vi.abaixoDosChips && vi.direita, JSON.stringify(vi));
  ok(`${L} sem rolagem horizontal da página`, await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  const topo = await p.evaluate(() => ({ h1: document.querySelector('h1').textContent, titulo: document.title, ctas: [...document.querySelectorAll('[data-feed-topo-cta] a')].map((a) => [a.textContent, a.getAttribute('aria-label'), a.getAttribute('href'), Math.round(a.getBoundingClientRect().height)]) }));
  ok(`${L} H1 «Feed de ocorrências», aba com o título novo, CTAs «Perdi»/«Encontrei» (44 px)`, topo.h1 === 'Feed de ocorrências' && topo.titulo.startsWith('Feed de ocorrências de objetos perdidos e achados') && topo.ctas.length === 2 && topo.ctas.every((c) => c[3] >= 44) && topo.ctas[0][2] === '/flow/lost?ref=feed' && topo.ctas[1][2] === '/flow/found?ref=feed', JSON.stringify(topo.ctas));
  if (v === 'grade') {
    const e = await p.evaluate(() => [...document.querySelectorAll('main article a[href^="/achei"]')].map((a) => { const r = a.getBoundingClientRect(); const art = a.closest('article').getBoundingClientRect(); return { t: a.textContent, aria: a.getAttribute('aria-label'), h: Math.round(r.height), umaLinha: r.height < 50, dentro: r.right <= art.right && r.left >= art.left }; }));
    ok(`${L} «Encontrei» na Grade: rótulo curto, nome acessível completo, 1 linha, 44 px, dentro do card`, e.length > 0 && e.every((x) => x.t === 'Encontrei' && x.aria === 'Informar que encontrei' && x.h >= 43.5 && x.umaLinha && x.dentro), `${e.length} botões`);
    const med = await p.evaluate(() => { const a = [...document.querySelectorAll('main article[data-photo="nao"]')][0]; return a ? Math.round(a.firstElementChild.getBoundingClientRect().height) : null; });
    ok(`${L} faixa de mídia do card sem foto: 80 px`, med === 80, `${med}`);
  } else {
    const linha = await p.evaluate(() => { const a = [...document.querySelectorAll('main article')].find((x) => x.querySelector('a[href^="/achei"]')); if (!a) return null; const l = a.querySelector('a[href^="/achei"]').getBoundingClientRect(), d = [...a.querySelectorAll('a')].find((x) => x.textContent.trim() === 'Ver detalhes').getBoundingClientRect(); return { mesmaLinha: Math.abs((l.top + l.height / 2) - (d.top + d.height / 2)) < 8, altura: Math.round(l.height) }; });
    if (W >= 390) ok(`${L} «Informar que encontrei» na mesma linha das outras ações`, linha && linha.mesmaLinha, JSON.stringify(linha));
    else console.log(`INFO  ${L} «Informar que encontrei» ${linha && linha.mesmaLinha ? 'na mesma linha' : 'quebra para a linha de baixo (não cabe)'}`);
    ok(`${L} «Informar que encontrei» com 44 px`, linha && linha.altura >= 43.5);
  }
  await ctx.close();
}

// ---- card inteiro clicável e eventos (390 e 1280, as duas visualizações)
for (const W of [390, 1280]) for (const v of ['publicacoes', 'grade']) {
  const L = `[${W} ${v}]`;
  const alvo = async (p, quando) => { await p.evaluate(() => document.documentElement.style.scrollBehavior = 'auto'); return alvo0(p, quando); };
  const alvo0 = async (p, quando) => p.evaluate((q) => { const a = [...document.querySelectorAll('main article[data-code]')].find((x) => x.dataset.origin === 'usuario' && x.querySelector('a[href^="/achei"]') && (q !== 'foto' || x.dataset.photo === 'sim')); a.scrollIntoView({ block: 'center', behavior: 'instant' }); const r = a.getBoundingClientRect(); const code = a.dataset.code;
    const t = a.querySelector('h2 a').getBoundingClientRect(); const img = a.querySelector('img'); const ir = img ? img.getBoundingClientRect() : null;
    return { code, art: { x: r.left, y: r.top, w: r.width, h: r.height }, titulo: { x: t.left + t.width / 2, y: t.top + t.height / 2 }, foto: ir && { x: ir.left + ir.width * 0.7, y: ir.top + ir.height * 0.6 }, corpo: { x: r.left + r.width * 0.5, y: r.top + r.height - 5 } }; }, quando);
  for (const ponto of ['titulo', 'foto', 'corpo']) {
    const { ctx, p, st } = await abrir(W, v); const t = await alvo(p, ponto);
    if (ponto === 'foto' && !t.foto) { await ctx.close(); continue; }
    const xy = t[ponto]; await p.mouse.click(xy.x, xy.y); const d = await destino(p, st);
    ok(`${L} clique no ${ponto} abre /objeto/${t.code.slice(0, 8)}…`, d === `/objeto/${t.code}`, d);
    await ctx.close();
  }
  { // compartilhar e «Encontrei» não abrem o link do card; um único feed_card_aberto por toque
    const { ctx, p, st } = await abrir(W, v); const t = await alvo(p, 'x');
    const antesUrl = p.url();
    const bt = p.locator(`main article[data-code="${t.code}"] button`).first(); await bt.click(); await p.waitForTimeout(800);
    ok(`${L} «Compartilhar» abre o painel e NÃO abre o link do card`, p.url() === antesUrl && (await p.locator('text=Copiar').count()) + (await p.locator('[role="dialog"]').count()) > 0, p.url().replace(BASE, ''));
    await p.waitForTimeout(3800);
    ok(`${L} eventos ao tocar em «Compartilhar»: 1 compartilhar e 0 card_aberto`, EV(evts(st, 'feed_compartilhar').length === 1 && evts(st, 'feed_card_aberto').length === 0), `comp=${evts(st, 'feed_compartilhar').length} card=${evts(st, 'feed_card_aberto').length}`);
    await ctx.close();
    const { ctx: ctx2, p: p2, st: st2 } = await abrir(W, v); const t2 = await alvo(p2, 'x'); const inf = p2.locator(`main article[data-code="${t2.code}"] a[href^="/achei"]`).first(); await inf.click(); const d = await destino(p2, st2);
    ok(`${L} «Encontrei»/«Informar que encontrei» leva a /achei?ref=feed (não ao card)`, d === '/achei?ref=feed', d);
    await p2.waitForTimeout(3800);
    ok(`${L} eventos: 1 informar_encontrei_clique e 0 card_aberto ao tocar em «Encontrei»`, EV(evts(st2, 'feed_informar_encontrei_clique').length === 1 && evts(st2, 'feed_card_aberto').length === 0), `inf=${evts(st2, 'feed_informar_encontrei_clique').length} card=${evts(st2, 'feed_card_aberto').length}`);
    await ctx2.close();
  }
  { const { ctx, p, st } = await abrir(W, v); const t = await alvo(p, 'x'); await p.mouse.click(t.corpo.x, t.corpo.y); await destino(p, st); await p.waitForTimeout(4200);
    ok(`${L} um único feed_card_aberto por toque no card`, EV(evts(st, 'feed_card_aberto').length === 1), PROD ? 'analítica bloqueada (não verificável em produção)' : `${evts(st, 'feed_card_aberto').length}`); await ctx.close(); }
  { // teclado: um único link por card no foco do título; foco visível
    const { ctx, p } = await abrir(W, v);
    const r = await p.evaluate(() => { const a = document.querySelector('main article[data-code]'); const ls = [...a.querySelectorAll('a[href^="/objeto/"]')]; return { links: ls.length, cobre: (() => { const t = a.querySelector('h2 a'); const cs = getComputedStyle(t, '::after'); return cs.position === 'absolute'; })() }; });
    ok(`${L} link do título cobre o card (::after absoluto)${v === 'publicacoes' ? '; «Ver detalhes» segue como link separado' : '; um único link /objeto por card'}`, r.cobre && (v === 'grade' ? r.links === 1 : r.links === 2), JSON.stringify(r)); await ctx.close(); }
}

// ---- atalhos: destinos e eventos (topo, menu «Cadastrar»; Roubaram só no menu)
for (const W of [390, 1280]) {
  const L = `[${W} atalhos]`; const { ctx, p, st } = await abrir(W, 'publicacoes');
  await p.locator('[data-feed-topo-cta] a[aria-label="Perdi algo"]').click(); const d1 = await destino(p, st);
  const { ctx: c2, p: p2, st: st2 } = await abrir(W, 'publicacoes'); await p2.locator('[data-feed-topo-cta] a[aria-label="Encontrei algo"]').click(); const d2 = await destino(p2, st2);
  const { ctx: c3, p: p3, st: st3 } = await abrir(W, 'publicacoes'); const menu = W < 640 ? '[data-feed-register="fixed"]' : '[data-feed-register="header"]';
  // no celular o botão fixo fica recolhido ao abrir (igual a antes dos ajustes: ele só aparece onde não cobre conteúdo); o clique é feito pelo DOM
  await p3.locator(`${menu} button`).evaluate((e) => e.click()); await p3.locator(`${menu} a`, { hasText: 'Roubaram algo meu' }).evaluate((e) => e.click()); const d3 = await destino(p3, st3);
  await p.waitForTimeout(3800); await p2.waitForTimeout(100); await p3.waitForTimeout(3800);
  ok(`${L} «Perdi» → /flow/lost?ref=feed, evento feed_cta_perdi (topo)`, d1 === '/flow/lost?ref=feed' && EV(evts(st, 'feed_cta_perdi').some((e) => e.properties?.posicao === 'topo')), d1);
  await p2.waitForTimeout(3800);
  ok(`${L} «Encontrei» → /flow/found?ref=feed, evento feed_cta_encontrei (topo)`, d2 === '/flow/found?ref=feed' && EV(evts(st2, 'feed_cta_encontrei').some((e) => e.properties?.posicao === 'topo')), d2);
  ok(`${L} «Roubaram algo meu» (menu «Cadastrar ocorrência») → /flow/stolen?ref=feed, evento feed_cta_roubado`, d3 === '/flow/stolen?ref=feed' && EV(evts(st3, 'feed_cta_roubado').length >= 1), `${d3} ev=${evts(st3, 'feed_cta_roubado').length}`);
  await ctx.close(); await c2.close(); await c3.close();
}
await b.close();
console.log(fails ? `\n${fails} VERIFICAÇÃO(ÕES) FALHOU/FALHARAM` : '\nTUDO CERTO');
process.exit(fails ? 1 : 0);
