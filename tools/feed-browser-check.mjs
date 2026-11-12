#!/usr/bin/env node
// Verificação de navegador do Feed (Playwright, fora das dependências do projeto).
//   node tools/feed-browser-check.mjs <baseUrl> [caminho/para/axe.min.js]
// Requer o app rodando (next start) com NEXT_PUBLIC_POSTHOG_KEY falsa e NEXT_PUBLIC_POSTHOG_HOST=http://localhost:3199
// (o script intercepta esse host: nada vai ao PostHog real). A localização por IP é simulada (ipapi.co interceptado).
import { createRequire } from 'node:module';
import { readFileSync, existsSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
const { chromium } = createRequire(import.meta.url)('playwright');

const BASE = process.argv[2] ?? 'http://localhost:3104';
const AXE = process.argv[3] && existsSync(process.argv[3]) ? readFileSync(process.argv[3], 'utf8') : null;
let fails = 0;
const ok = (name, cond, extra = '') => { if (!cond) fails++; console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  — ' + extra : ''}`); };

const VIEWPORTS = [{ width: 360, height: 740 }, { width: 390, height: 844 }];
const GEO = (c, uf, delay = 0) => (r) => setTimeout(() => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ city: c, region_code: uf }) }), delay);

async function newPage(browser, viewport, { geo = 'abort', js = true } = {}) {
  // user-agent comum: o PostHog descarta eventos de «HeadlessChrome» (filtro anti-bot da própria biblioteca)
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1, javaScriptEnabled: js, userAgent: 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36' });
  const page = await ctx.newPage();
  // O PostHog ignora navegadores que se declaram «headless» (user-agent, webdriver e userAgentData.brands). Só no teste:
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
    Object.defineProperty(navigator, 'userAgentData', { get: () => ({ brands: [{ brand: 'Chromium', version: '124' }], mobile: true, platform: 'Android' }) });
  });
  const st = { bad: [], nav: [], errors: [], events: [], reqs: [] };
  page.on('response', (r) => { const u = r.url(); if (u.startsWith(BASE) && r.status() >= 400) st.bad.push(`${r.status()} ${u.replace(BASE, '')}`); });
  page.on('framenavigated', (f) => { if (f === page.mainFrame()) st.nav.push(f.url().replace(BASE, '')); });
  page.on('pageerror', (e) => st.errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|ERR_|net::/.test(m.text())) st.errors.push(m.text()); });
  await page.route('http://localhost:3199/**', async (route) => {
    const req = route.request(); const u = req.url();
    if (/\/array\/[^/]+\/config\.js/.test(u)) return route.fulfill({ status: 200, contentType: 'application/javascript', body: "window._POSTHOG_REMOTE_CONFIG=window._POSTHOG_REMOTE_CONFIG||{};window._POSTHOG_REMOTE_CONFIG['phc_local_test_not_real']={config:{token:'phc_local_test_not_real',supportedCompression:['gzip-js','base64'],hasFeatureFlags:false,captureDeadClicks:false,capturePerformance:false,autocapture_opt_out:true,defaultIdentifiedOnly:true},siteApps:[]};" });
    if (/\/flags\/|\/decide|\/config\?/.test(u)) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ featureFlags: {}, featureFlagPayloads: {}, config: { enable_collect_everything: false }, supportedCompression: ['gzip-js', 'base64'], autocapture_opt_out: true }) });
    try {
      const buf = req.postDataBuffer();
      if (buf) {
        let txt; try { txt = gunzipSync(buf).toString('utf8'); } catch { txt = buf.toString('utf8'); }
        const m = txt.match(/^data=(.*)$/s); if (m) txt = Buffer.from(decodeURIComponent(m[1]), 'base64').toString('utf8');
        const j = JSON.parse(txt); (Array.isArray(j) ? j : [j]).forEach((e) => e?.event && st.events.push(e));
      }
    } catch { /* corpo ilegível: ignora */ }
    route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });
  if (geo === 'abort') await page.route('https://ipapi.co/**', (r) => r.abort());
  else await page.route('https://ipapi.co/**', geo);
  await page.route(/google-analytics|googletagmanager|clarity\.ms|facebook\.net|mapbox/, (r) => r.abort());
  return { ctx, page, st };
}

const cards = (page) => page.locator('main article');
const labels = (page) => cards(page).evaluateAll((els) => els.map((e) => ({ o: e.getAttribute('data-origin'), t: e.querySelector('h2')?.textContent, loc: e.querySelectorAll('p')[0]?.textContent, badge: e.querySelector('div.flex-wrap span')?.textContent, href: e.querySelector('h2 a')?.getAttribute('href') })));

async function touchTargets(page, vp) {
  const bad = await page.evaluate(() => {
    const out = [];
    for (const el of document.querySelectorAll('main a, main button, main select')) {
      const r = el.getBoundingClientRect(); const cs = getComputedStyle(el);
      if (cs.visibility === 'hidden' || cs.display === 'none' || r.width === 0 || r.height === 0) continue;
      if (r.height < 43.5 || r.width < 43.5) out.push(`${el.tagName.toLowerCase()} "${(el.textContent || '').trim().slice(0, 30)}" ${Math.round(r.width)}x${Math.round(r.height)}`);
    }
    return out;
  });
  ok(`[${vp.width}] alvos de toque ≥ 44 px`, bad.length === 0, bad.slice(0, 6).join(' | '));
}

const browser = await chromium.launch();
for (const vp of VIEWPORTS) {
  console.log(`\n=== viewport ${vp.width}x${vp.height}`);

  // 1) SEM JavaScript: o HTML já tem os cards e os links
  { const { ctx, page } = await newPage(browser, vp, { js: false });
    await page.goto(`${BASE}/feed`);
    ok(`[${vp.width}] sem JS: 12 cards no HTML`, (await cards(page).count()) === 12);
    ok(`[${vp.width}] sem JS: 12 links /objeto com texto útil`, (await page.locator('main h2 a[href^="/objeto/"]').count()) === 12);
    await page.click('text=Ver mais ocorrências');
    ok(`[${vp.width}] sem JS: «Ver mais» leva a /feed/pagina/2 com os demais cards`, page.url().endsWith('/feed/pagina/2') && (await cards(page).count()) === 8, page.url().replace(BASE, ''));
    await ctx.close(); }

  // 2) Sessão LIMPA, localização falha: conteúdo do servidor permanece; sem 401; sem redirecionar ao login
  { const { ctx, page, st } = await newPage(browser, vp, { geo: 'abort' });
    ok(`[${vp.width}] contexto novo: sem cookies e sem localStorage antes de abrir`, (await ctx.cookies()).length === 0);
    await page.goto(`${BASE}/feed`); await page.waitForTimeout(2500);
    ok(`[${vp.width}] sessão limpa: nenhuma resposta ≥ 400 do próprio site`, st.bad.length === 0, st.bad.join(', '));
    ok(`[${vp.width}] sessão limpa: nenhum redirecionamento (login)`, st.nav.every((u) => u === '/feed'), st.nav.join(' > '));
    ok(`[${vp.width}] sem erros de JavaScript na página`, st.errors.length === 0, st.errors.slice(0, 2).join(' | '));
    ok(`[${vp.width}] localização falhou: os 12 cards do servidor continuam`, (await cards(page).count()) === 12);
    ok(`[${vp.width}] sem estouro horizontal`, await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
    await touchTargets(page, vp);
    if (AXE) { await page.addScriptTag({ content: AXE });
      const v = await page.evaluate(async () => (await axe.run(document.querySelector('main'), { runOnly: ['color-contrast', 'button-name', 'link-name', 'label', 'image-alt', 'heading-order'] })).violations.map((x) => `${x.id}(${x.nodes.length})`));
      ok(`[${vp.width}] acessibilidade (contraste, nomes, rótulos)`, v.length === 0, v.join(', ')); }
    ok(`[${vp.width}] cookies depois de abrir (informativo)`, true, (await ctx.cookies()).map((c) => c.name).join(',') || 'nenhum');
    await ctx.close(); }

  // 3) Localização lenta (1,5 s): o conteúdo NÃO some enquanto espera e a troca é de uma vez
  { const { ctx, page } = await newPage(browser, vp, { geo: GEO('Cascavel', 'PR', 1500) });
    await page.goto(`${BASE}/feed`);
    const seen = [];
    for (let i = 0; i < 50; i++) { seen.push(await cards(page).count()); await page.waitForTimeout(80); }
    ok(`[${vp.width}] sem «piscar»: nunca zero cards durante a troca`, Math.min(...seen) > 0, `contagens: ${[...new Set(seen)].join('→')}`);
    const L = await labels(page);
    ok(`[${vp.width}] visitante em Cascavel/PR: só PR (nada de Recife/SP/SC)`, L.length > 0 && !L.some((x) => /Recife|São Paulo|Florianópolis| SC| SP| PE|Brusque|Palmares/.test(x.loc ?? '')) && L.filter((x) => /PR/.test(x.loc ?? '')).length >= L.length - 1, `${L.length} cards`);
    ok(`[${vp.width}] visitante: usuário antes de sinal público`, L.findIndex((x) => x.o === 'sinal_publico') === -1 || L.slice(0, L.findIndex((x) => x.o === 'sinal_publico')).every((x) => x.o === 'usuario'));
    ok(`[${vp.width}] seletor mostra «Perto de mim»`, await page.locator('select option[value="auto"]').count() === 1);
    await ctx.close(); }

  // 4) Região sem ocorrências: estado vazio com mapa, busca e cadastro (nunca outras regiões)
  { const { ctx, page } = await newPage(browser, vp, { geo: GEO('Manaus', 'AM') });
    await page.goto(`${BASE}/feed`); await page.waitForSelector('text=Nenhuma ocorrência recente nesta seleção', { timeout: 6000 });
    ok(`[${vp.width}] estado vazio: zero cards`, (await cards(page).count()) === 0);
    const hrefs = await page.locator('main section a').evaluateAll((a) => a.map((x) => x.getAttribute('href')));
    ok(`[${vp.width}] estado vazio: mapa, busca e cadastro (?ref=feed)`, ['/map', '/buscar', '/auth/register?ref=feed'].every((h) => hrefs.includes(h)), hrefs.join(' '));
    await touchTargets(page, vp);
    await ctx.close(); }

  // 5) Filtros, carregar mais, compartilhar, informar que encontrei, eventos
  { const { ctx, page, st } = await newPage(browser, vp, { geo: 'abort' });
    await page.goto(`${BASE}/feed`); await page.waitForTimeout(1200);
    await page.evaluate(() => document.addEventListener('click', (e) => { if (e.target.closest('a')) e.preventDefault(); }, true)); // mantém a página para medir
    await page.click('button:has-text("Achados")'); await page.waitForTimeout(700);
    let L = await labels(page);
    ok(`[${vp.width}] filtro «Achados»: só achados`, L.length > 0 && L.every((x) => x.badge === 'Achado'), `${L.length} cards`);
    await page.click('button:has-text("Todos")'); await page.selectOption('select >> nth=0', 'pet'); await page.waitForTimeout(700);
    L = await labels(page);
    ok(`[${vp.width}] filtro categoria «Pet» (pet+animal agrupados)`, L.length >= 4, `${L.length} cards`);
    await page.selectOption('select >> nth=0', 'all'); await page.waitForTimeout(700);
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight)); await page.waitForTimeout(1500);
    ok(`[${vp.width}] rolagem carrega o resto (12 → 20)`, (await cards(page).count()) === 20, String(await cards(page).count()));
    ok(`[${vp.width}] sem cards repetidos`, new Set((await labels(page)).map((x) => x.href)).size === 20);
    const inf = page.locator('main article:not([data-origin="sinal_publico"]) a:has-text("Informar que encontrei")').first();
    await inf.scrollIntoViewIfNeeded(); await inf.click();
    await page.locator('main article').first().locator('a:has-text("Ver detalhes")').click();
    await page.locator('main article').first().locator('button:has-text("Compartilhar")').click(); await page.waitForTimeout(500);
    ok(`[${vp.width}] «Compartilhar» abre o compartilhamento existente (WhatsApp)`, await page.locator('text=WhatsApp').first().isVisible());
    await page.waitForTimeout(4500);
    const names = st.events.map((e) => e.event).filter((n) => n.startsWith('feed_'));
    for (const n of ['feed_aberto', 'feed_filtro_aplicado', 'feed_card_aberto', 'feed_informar_encontrei_clique', 'feed_compartilhar']) ok(`[${vp.width}] evento ${n}`, names.includes(n), `recebidos: ${[...new Set(names)].join(',')}`);
    const allowed = new Set(['origem', 'filtro', 'valor', 'origem_item']);
    const std = (k) => k.startsWith('$') || ['token', 'distinct_id', 'time', 'uuid'].includes(k);
    const custom = st.events.filter((e) => e.event.startsWith('feed_')).flatMap((e) => Object.keys(e.properties ?? {}).filter((k) => !std(k)));
    ok(`[${vp.width}] eventos só com propriedades permitidas (sem dado pessoal)`, custom.every((k) => allowed.has(k)), [...new Set(custom)].join(','));
    const vals = JSON.stringify(st.events.filter((e) => e.event.startsWith('feed_')).map((e) => [e.event, e.properties.origem, e.properties.filtro, e.properties.valor, e.properties.origem_item]));
    ok(`[${vp.width}] valores dos eventos (informativo)`, !/USR0|SIG0|@|Cascavel/.test(vals), vals.slice(0, 300));
    await ctx.close(); }
}
await browser.close();
console.log(fails ? `\n${fails} VERIFICAÇÃO(ÕES) FALHOU/FALHARAM` : '\nTodas as verificações de navegador passaram');
process.exit(fails ? 1 : 0);
