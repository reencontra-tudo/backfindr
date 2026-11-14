#!/usr/bin/env node
// Medidas do Feed (antes/depois de ajustes de acabamento). Só leitura. Playwright fora das dependências.
//   node tools/feed-medidas-check.mjs <baseUrl>
import { createRequire } from 'node:module';
import { readFileSync, existsSync } from 'node:fs';
const { chromium } = createRequire(import.meta.url)('playwright');
const BASE = process.argv[2];
const PHOTO = existsSync('/tmp/claude-0/sample-photo.jpg') ? readFileSync('/tmp/claude-0/sample-photo.jpg') : null;
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
// PROD=1: contra a produção (somente leitura) pelo proxy do ambiente; a analítica é bloqueada (eventos só se verificam pelo código e por captura local)
const PROD = process.env.PROD === '1';
const b = await chromium.launch(PROD ? { proxy: { server: process.env.HTTPS_PROXY } } : {});
async function abrir(W, H, vis) {
  const ctx = await b.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, userAgent: UA });
  if (vis === 'grade') await ctx.addInitScript(() => { try { localStorage.setItem('feed-visualizacao-v1', 'grade'); } catch {} });
  const p = await ctx.newPage();
  await p.route(/localhost:3199|google|clarity|facebook|mapbox|ipapi|posthog|vercel-insights|vitals/i, (r) => r.abort());
  if (PHOTO) await p.route(/^https:\/\/pub-[a-z0-9]+\.r2\.dev\//, (r) => r.fulfill({ status: 200, contentType: 'image/jpeg', body: PHOTO }));
  await p.goto(`${BASE}/feed`); await p.waitForSelector(`[data-vis="${vis}"] article`); await p.waitForTimeout(1500);
  return { ctx, p };
}
// 1) altura média do card sem foto na Grade (todos os sem foto, depois de carregar 36)
for (const W of [360, 390, 430]) {
  const { ctx, p } = await abrir(W, 844, 'grade');
  for (let i = 0; i < 8; i++) { await p.evaluate(() => scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' })); await p.waitForTimeout(600); }
  const r = await p.evaluate(() => { const a = [...document.querySelectorAll('main article[data-code]')]; const h = (x) => x.getBoundingClientRect().height;
    const sem = a.filter((x) => x.dataset.photo === 'nao').map(h), com = a.filter((x) => x.dataset.photo === 'sim').map(h);
    const m = (l) => l.length ? Math.round(l.reduce((s, v) => s + v, 0) / l.length) : null; return { n: a.length, sem: sem.length, semMedia: m(sem), com: com.length, comMedia: m(com) }; });
  console.log(`[grade ${W}] cards ${r.n}; sem foto ${r.sem}: altura média ${r.semMedia}px; com foto ${r.com}: ${r.comMedia}px`); await ctx.close();
}
// 2) hierarquia: distância do topo da página até o 1º card e quanto dele aparece na 1ª tela
for (const [W, H] of [[390, 844], [360, 740]]) for (const vis of ['publicacoes', 'grade']) {
  const { ctx, p } = await abrir(W, H, vis);
  const r = await p.evaluate(() => { const a = document.querySelector('main article[data-code]'); const t = a.getBoundingClientRect(); const h2 = a.querySelector('h2').getBoundingClientRect();
    return { topo: Math.round(t.top + scrollY), altura: Math.round(t.height), visivel: Math.round(Math.max(0, Math.min(t.bottom, innerHeight) - t.top)), tituloVisivel: h2.bottom <= innerHeight, h1: Math.round(document.querySelector('h1').getBoundingClientRect().height) }; });
  console.log(`[${W}x${H} ${vis}] 1º card começa a ${r.topo}px do topo; aparece ${r.visivel}px de ${r.altura}px na 1ª tela; título visível: ${r.tituloVisivel}`); await ctx.close();
}
// 3) botão fixo (390): em quantos pontos da rolagem ele fica «sobreposto» (cobriria conteúdo e por isso se esconde) e distância até a borda inferior
{ const { ctx, p } = await abrir(390, 844, 'publicacoes');
  for (let i = 0; i < 8; i++) { await p.evaluate(() => scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' })); await p.waitForTimeout(500); }
  const alt = await p.evaluate(() => document.documentElement.scrollHeight - innerHeight); let n = 0, sob = 0, vis = 0; // sobe do fim ao topo (ao rolar para cima o botão volta, se não cobrir nada)
  for (let y = alt; y >= 0; y -= 60) { await p.evaluate((y) => scrollTo({ top: y, behavior: 'instant' }), y); await p.waitForTimeout(320);
    const s = await p.evaluate(() => { const f = document.querySelector('[data-feed-register="fixed"]'); return { sob: f.dataset.sobreposto === 'true', esc: f.dataset.recolhido === 'true' }; }); n++; if (s.sob) sob++; if (!s.esc) vis++; }
  const geo = await p.evaluate(() => { const f = document.querySelector('[data-feed-register="fixed"] button').getBoundingClientRect(); return { distBorda: Math.round(innerHeight - f.bottom), h: Math.round(f.height) }; });
  console.log(`[botão fixo 390] ${n} pontos de rolagem; «sobreposto» em ${sob} (${Math.round(100 * sob / n)}%); visível em ${vis} (${Math.round(100 * vis / n)}%); distância da borda inferior ${geo.distBorda}px; altura ${geo.h}px`); await ctx.close(); }
await b.close();
