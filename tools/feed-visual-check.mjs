#!/usr/bin/env node
// Verificação de navegador do visual novo do Feed (faixa escura + folha clara; «Publicações» e «Grade»). Playwright (fora das dependências).
//   node tools/feed-visual-check.mjs <baseUrl> [pastaCapturas] [larguras, ex.: 320,360,375,390,430,768,1024,1440]
// Precisa de um Feed com muitos cards (tests/fixtures/feed-grande-seed.sql). Só leitura (GET). Emula celular/tablet/desktop no Chromium (NÃO é Safari/iPhone/Android reais).
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync, existsSync } from 'node:fs';
const { chromium } = createRequire(import.meta.url)('playwright');
const BASE = process.argv[2], OUT = process.argv[3] || '/tmp/feed-visual', WIDTHS = (process.argv[4] || '320,360,375,390,430,768,1024,1440').split(',').map(Number);
mkdirSync(OUT, { recursive: true });
const PHOTO = existsSync('/tmp/claude-0/sample-photo.jpg') ? readFileSync('/tmp/claude-0/sample-photo.jpg') : null;
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
let fails = 0;
const ok = (n, c, x = '') => { if (!c) fails++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}${x ? '  — ' + x : ''}`); };
// PROD=1: contra a produção (somente leitura) pelo proxy do ambiente; a analítica é bloqueada (eventos só se verificam pelo código e por captura local)
const PROD = process.env.PROD === '1';
const b = await chromium.launch(PROD ? { proxy: { server: process.env.HTTPS_PROXY } } : {});
const colunasEsperadas = (v, W) => (v === 'publicacoes' ? 1 : W >= 1024 ? 4 : W >= 560 ? 3 : 2);

async function abrir(W, v) {
  const mobile = W < 1000;
  const ctx = await b.newContext({ viewport: { width: W, height: mobile ? 844 : 800 }, deviceScaleFactor: 1, isMobile: mobile, hasTouch: mobile, userAgent: mobile ? UA : undefined });
  if (v === 'grade') await ctx.addInitScript(() => { try { localStorage.setItem('feed-visualizacao-v1', 'grade'); } catch { /* sem problema */ } });
  const p = await ctx.newPage(); const reqs = [];
  p.on('request', (r) => { if (r.url().includes('/api/v1/feed')) reqs.push(r.url()); });
  await p.route(/localhost:3199|google|clarity|facebook|mapbox|ipapi|posthog|vercel-insights|vitals/i, (r) => r.abort());
  if (PHOTO) await p.route(/^https:\/\/pub-[a-z0-9]+\.r2\.dev\//, (r) => r.fulfill({ status: 200, contentType: 'image/jpeg', body: PHOTO }));
  await p.goto(`${BASE}/feed`); await p.waitForSelector(`[data-vis="${v}"] article`); await p.waitForTimeout(1200);
  return { ctx, p, reqs };
}
const rolar = async (p) => { let ult = 0, igual = 0; for (let i = 0; i < 30 && igual < 3; i++) { await p.evaluate(() => scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' })); await p.waitForTimeout(600); const n = await p.evaluate(() => document.querySelectorAll('main article').length); igual = n === ult ? igual + 1 : 0; ult = n; } await p.evaluate(() => scrollTo({ top: 0, behavior: 'instant' })); await p.waitForTimeout(300); return ult; };

for (const W of WIDTHS) for (const v of ['publicacoes', 'grade']) {
  const L = `[${W} ${v}]`; const { ctx, p, reqs } = await abrir(W, v);
  const n = await rolar(p);
  ok(`${L} lista carregada (${n} cards)`, n >= 36);
  ok(`${L} sem rolagem horizontal`, await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  const cols = await p.evaluate(() => { const a = [...document.querySelectorAll('main article[data-code]')]; const t0 = Math.round(a[0].getBoundingClientRect().top + scrollY); return a.filter((x) => Math.round(x.getBoundingClientRect().top + scrollY) === t0).length; });
  ok(`${L} colunas = ${colunasEsperadas(v, W)}`, cols === colunasEsperadas(v, W), `achou ${cols}`);
  // altura: em cada linha da grade os cards têm a mesma altura; o bloco da foto (com foto e sem foto) tem a mesma altura
  if (v === 'grade') {
    const g = await p.evaluate(() => {
      const a = [...document.querySelectorAll('main article[data-code]')];
      const foto = a.map((x) => ({ f: x.dataset.photo, h: x.firstElementChild.getBoundingClientRect().height, w: x.getBoundingClientRect().width }));
      const com = foto.filter((x) => x.f === 'sim'), sem = foto.filter((x) => x.f === 'nao');
      const linhas = {}; a.forEach((x) => { const r = x.getBoundingClientRect(); (linhas[Math.round(r.top + scrollY)] ||= []).push(r.height); });
      return { com: com.length, sem: sem.length, hs: [...new Set(foto.map((x) => Math.round(x.h)))], ws: [...new Set(foto.map((x) => Math.round(x.w)))], linhasIguais: Object.values(linhas).every((l) => Math.max(...l) - Math.min(...l) < 1) };
    });
    { const semH = await p.evaluate(() => { const l = (f) => [...document.querySelectorAll(`main article[data-photo="${f}"]`)].map((x) => Math.round(x.firstElementChild.getBoundingClientRect().height)); return { sem: l('nao'), com: l('sim') }; });
      ok(`${L} card sem foto: faixa de mídia baixa (80 px), bem mais baixa que a foto (${Math.min(...semH.com)}–${Math.max(...semH.com)} px)`, semH.sem.length > 0 && semH.sem.every((h) => h === 80) && semH.com.every((h) => h > 80), JSON.stringify([...new Set(semH.sem)])); }
    ok(`${L} todos os cards da mesma linha têm a mesma altura`, g.linhasIguais);
    ok(`${L} cards com a mesma largura`, g.ws.length <= 2 && Math.max(...g.ws) - Math.min(...g.ws) <= 1, `larguras ${g.ws}`);
    const sobre = await p.evaluate(() => { const s = document.querySelector('[data-feed-about]'); const l = document.querySelector('main [data-vis]>div[aria-busy]'); if (!s || !l) return null; const a = s.getBoundingClientRect(), c = l.getBoundingClientRect(); return { cheio: Math.abs(a.width - c.width) < 1, antes: [...l.children].indexOf(s) }; });
    ok(`${L} bloco explicativo ocupa a linha inteira, depois do 3º card`, sobre && sobre.cheio && sobre.antes === 3, JSON.stringify(sobre));
  }
  // toques de 44 px
  const toques = await p.evaluate(() => {
    const seletores = ['[role=group][aria-label="Situação"] button', '[aria-label="Visualização"] button', '[data-feed-topo-cta] a', 'main article a[href^="/achei"]', 'main article button', 'main nav a'];
    const ruim = []; for (const s of seletores) for (const e of document.querySelectorAll(s)) { const r = e.getBoundingClientRect(); if (r.width && (r.height < 43.5 || (s.includes('button') && r.width < 43.5))) ruim.push(s + ' ' + Math.round(r.width) + 'x' + Math.round(r.height)); }
    return ruim.slice(0, 5);
  });
  ok(`${L} botões e links de ação com ≥ 44 px`, toques.length === 0, toques.join('; '));
  // botão fixo (só celular): não cobre texto/botão e não encosta no balão do chat
  if (W < 640) {
    const fx = await p.evaluate(async () => {
      const box = document.querySelector('[data-feed-register="fixed"]'); const chat = document.querySelector('button[aria-label="Abrir assistente"]'); if (!box || !chat) return { achou: false };
      let cobre = 0, chatCol = 0, visivel = 0; const alt = document.documentElement.scrollHeight - innerHeight;
      for (let y = 0; y <= alt; y += 60) { scrollTo({ top: y, behavior: 'instant' }); await new Promise((r) => setTimeout(r, 40));
        const bt = box.querySelector('button'); const vis = !box.className.includes('pointer-events-none'); if (!vis) continue; visivel++;
        const r = bt.getBoundingClientRect(), q = chat.getBoundingClientRect(); if (!(r.right <= q.left || q.right <= r.left || r.bottom <= q.top || q.bottom <= r.top)) chatCol++;
        for (const e of document.querySelectorAll('main article a, main article button, main article h2, main nav a, main select')) { if (box.contains(e)) continue; const c = e.getBoundingClientRect(); if (c.width && !(c.right <= r.left || r.right <= c.left || c.bottom <= r.top || r.bottom <= c.top)) cobre++; } }
      scrollTo({ top: 0, behavior: 'instant' }); return { achou: true, cobre, chatCol, visivel };
    });
    ok(`${L} botão fixo «Cadastrar ocorrência» não cobre ações nem o balão do chat`, fx.achou && fx.cobre === 0 && fx.chatCol === 0, JSON.stringify(fx));
  }
  await p.screenshot({ path: `${OUT}/${W}-${v}-topo.png` });
  ok(`${L} nenhuma chamada extra à API só por abrir e rolar até 36 cards (≤ 2 carregamentos automáticos)`, reqs.length <= 2, `${reqs.length}`);
  await ctx.close();
}

// Alternar: não chama a API, mantém filtros, cards carregados e posição; preferência sobrevive ao F5
for (const W of [390, 1280]) {
  const L = `[${W} alternar]`; const { ctx, p, reqs } = await abrir(W, 'publicacoes');
  await p.getByRole('button', { name: 'Perdidos', exact: true }).click(); await p.waitForTimeout(1500);
  await rolar(p);   // lista já completa (carregamento automático esgotado): assim o teste mede o ALTERNAR, não o carregamento ao rolar
  const cod = () => p.evaluate(() => [...document.querySelectorAll('main article[data-code]')].map((a) => a.dataset.code));
  const antes = await cod(); const reqsAntes = reqs.length;
  await p.evaluate(() => { const g = document.querySelector('[aria-label="Visualização"]'); scrollTo({ top: g.getBoundingClientRect().top + scrollY - 20, behavior: 'instant' }); }); await p.waitForTimeout(400); // seletor visível (a página não rola sozinha no clique)
  const ref = await p.evaluate(() => { const a = [...document.querySelectorAll('main article[data-code]')].find((x) => x.getBoundingClientRect().bottom > 8); return { code: a.dataset.code, top: a.getBoundingClientRect().top }; });
  await p.evaluate(() => document.querySelector('[data-vis-botao="grade"]').click()); await p.waitForTimeout(600);
  ok(`${L} Grade aplicada sem nova chamada à API`, reqs.length === reqsAntes && (await p.locator('[data-vis="grade"]').count()) > 0, `reqs ${reqsAntes}→${reqs.length}`);
  ok(`${L} mesmos cards e mesma ordem após alternar`, JSON.stringify(await cod()) === JSON.stringify(antes));
  ok(`${L} filtro «Perdidos» mantido`, (await p.getByRole('button', { name: 'Perdidos', exact: true }).getAttribute('aria-pressed')) === 'true');
  const depois = await p.evaluate((c) => { const a = document.querySelector(`main article[data-code="${c}"]`); return a ? a.getBoundingClientRect().top : null; }, ref.code);
  ok(`${L} posição acompanha o card em vista (${ref.code.slice(0, 8)}…)`, depois !== null && Math.abs(depois - Math.max(ref.top, 0)) <= 2, `top antes ${Math.round(ref.top)} depois ${depois === null ? '-' : Math.round(depois)}`);
  ok(`${L} preferência guardada («grade»)`, (await p.evaluate(() => localStorage.getItem('feed-visualizacao-v1'))) === 'grade');
  await p.reload(); await p.waitForSelector('[data-vis="grade"] article'); await p.waitForTimeout(800);
  ok(`${L} depois do F5 continua na Grade e o botão está marcado`, (await p.locator('[aria-label="Visualização"] [aria-pressed="true"]').getAttribute('data-vis-botao')) === 'grade');
  await p.evaluate(() => localStorage.setItem('feed-visualizacao-v1', 'lixo')); await p.reload(); await p.waitForSelector('[data-vis="publicacoes"] article');
  ok(`${L} valor inválido guardado = volta para Publicações e é apagado`, (await p.evaluate(() => localStorage.getItem('feed-visualizacao-v1'))) === null);
  await ctx.close();
}
// Sem JavaScript: HTML do servidor é Publicações, com os 12 cards e o seletor presente
{ const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, javaScriptEnabled: false }); const p = await ctx.newPage(); await p.goto(`${BASE}/feed`);
  ok('[sem JS] servidor desenha Publicações com 12 cards', (await p.locator('[data-vis="publicacoes"] article').count()) === 12 && (await p.locator('[data-vis="grade"]').count()) === 0); await ctx.close(); }
await b.close();
console.log(fails ? `\n${fails} VERIFICAÇÃO(ÕES) FALHOU/FALHARAM` : '\nTUDO CERTO');
process.exit(fails ? 1 : 0);
