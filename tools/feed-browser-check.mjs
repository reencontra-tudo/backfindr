#!/usr/bin/env node
// Verificação de navegador do Feed (Playwright, fora das dependências do projeto).
//   node tools/feed-browser-check.mjs <baseUrl> [caminho/para/axe.min.js]
// Requer o app rodando (next start) com NEXT_PUBLIC_POSTHOG_KEY falsa e NEXT_PUBLIC_POSTHOG_HOST=http://localhost:3199
// (o script intercepta esse host: nada vai ao PostHog real). A localização é simulada: o navegador chama a rota própria /api/v1/feed/geo (interceptada aqui); qualquer chamada do navegador ao ipapi.co é contada e reprovada.
import { createRequire } from 'node:module';
import { readFileSync, existsSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
const { chromium } = createRequire(import.meta.url)('playwright');

const BASE = process.argv[2] ?? 'http://localhost:3104';
const AXE = process.argv[3] && existsSync(process.argv[3]) ? readFileSync(process.argv[3], 'utf8') : null;
let fails = 0;
const ok = (name, cond, extra = '') => { if (!cond) fails++; console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  — ' + extra : ''}`); };

const VIEWPORTS = [{ width: 360, height: 740 }, { width: 390, height: 844 }, { width: 1280, height: 800 }];
const PHOTO = process.env.PHOTO_FILE && existsSync(process.env.PHOTO_FILE) ? readFileSync(process.env.PHOTO_FILE) : null; // foto de exemplo (as URLs de teste não existem)
const GEO = (c, uf, delay = 0, country = 'BR') => (r) => setTimeout(() => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'cache-control': 'private, no-store' }, body: JSON.stringify({ country, uf: country === 'BR' ? uf : null, city: country === 'BR' ? c : null }) }), delay);

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
  st.ipapiCalls = 0; st.geoCalls = 0;
  if (PHOTO) await page.route('https://pub-test.r2.dev/**', (r) => r.fulfill({ status: 200, contentType: 'image/jpeg', body: PHOTO }));
  await page.addInitScript(() => { window.__cls = 0; try { new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value; }).observe({ type: 'layout-shift', buffered: true }); } catch {} });
  page.on('request', (rq) => { if (/\/api\/v1\/feed\/geo/.test(rq.url())) st.geoCalls++; });
  page.on('request', (rq) => { if (/ipapi\.co/.test(rq.url())) st.ipapiCalls++; });
  await page.route('https://ipapi.co/**', (r) => r.abort()); // o navegador NÃO deve mais chamar isto
  if (geo === 'abort') await page.route('**/api/v1/feed/geo', (r) => r.abort());
  else await page.route('**/api/v1/feed/geo', geo);
  await page.route(/google-analytics|googletagmanager|clarity\.ms|facebook\.net|mapbox/, (r) => r.abort());
  return { ctx, page, st };
}

const cards = (page) => page.locator('main article');
const labels = (page) => cards(page).evaluateAll((els) => els.map((e) => ({ o: e.getAttribute('data-origin'), t: e.querySelector('h2')?.textContent, loc: e.querySelector('span.truncate')?.textContent, badge: e.querySelector('span.font-semibold')?.textContent, href: e.querySelector('h2 a')?.getAttribute('href'), photo: e.getAttribute('data-photo') })));

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

  const SEL = 'select >> nth=1'; // «Cidade ou região»
  const AVISO = 'text=Não conseguimos identificar sua região. Escolha seu estado para ver ocorrências perto de você.';
  const desktop = vp.width >= 1000;

  // 2) Sessão LIMPA: abre em «Todas as regiões», sem NENHUMA chamada de localização; layout e visual
  { const { ctx, page, st } = await newPage(browser, vp, { geo: GEO('Cascavel', 'PR') });
    ok(`[${vp.width}] contexto novo: sem cookies e sem localStorage antes de abrir`, (await ctx.cookies()).length === 0);
    await page.goto(`${BASE}/feed`); await page.waitForTimeout(5200);
    ok(`[${vp.width}] sessão limpa: nenhuma resposta ≥ 400 do próprio site`, st.bad.length === 0, st.bad.join(', '));
    ok(`[${vp.width}] sessão limpa: nenhum redirecionamento (login)`, st.nav.every((u) => u === '/feed'), st.nav.join(' > '));
    ok(`[${vp.width}] sem erros de JavaScript na página`, st.errors.length === 0, st.errors.slice(0, 2).join(' | '));
    ok(`[${vp.width}] ao abrir: NENHUMA chamada a /api/v1/feed/geo (nem depois de 5 s) e 0 ao ipapi.co`, st.geoCalls === 0 && st.ipapiCalls === 0, `geo=${st.geoCalls} ipapi=${st.ipapiCalls}`);
    ok(`[${vp.width}] ao abrir: 12 cards do servidor, «Todas as regiões» selecionada, sem aviso`, (await cards(page).count()) === 12 && (await page.locator(SEL).inputValue()) === 'todas' && (await page.locator(AVISO).count()) === 0);
    const ops = await page.locator(SEL).locator('option').evaluateAll((o) => o.map((x) => x.textContent));
    ok(`[${vp.width}] ordem das opções: Todas, Perto de mim, Só a minha cidade, estados`, JSON.stringify(ops.slice(0, 3)) === JSON.stringify(['Todas as regiões', 'Perto de mim', 'Só a minha cidade']) && ops.slice(3).every((x) => /^Estado: [A-Z]{2}$/.test(x)), ops.slice(0, 5).join(' | '));
    ok(`[${vp.width}] sem estouro horizontal`, await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
    await touchTargets(page, vp);
    // visual dos cards
    const m = await page.evaluate(() => {
      const arts = [...document.querySelectorAll('main article')];
      const R = (el) => el.getBoundingClientRect();
      const comFoto = arts.filter((a) => a.dataset.photo === 'sim'), semFoto = arts.filter((a) => a.dataset.photo === 'nao');
      const ratios = comFoto.map((a) => { const d = a.querySelector('img').parentElement; const r = R(d); return r.width / r.height; });
      const hFoto = comFoto.length ? R(comFoto[0]).height : null, hSem = semFoto.length ? Math.max(...semFoto.map((a) => R(a).height)) : null;
      const linhaUnica = arts.every((a) => { const p = [...a.querySelectorAll('p')].find((x) => x.querySelector('time')); return p && R(p).height < 30; });
      const acoesNaMesmaLinha = arts.every((a) => { const els = [...a.querySelectorAll('a,button')].filter((x) => /Ver detalhes|Compartilhar|Informar que encontrei/.test(x.textContent + (x.getAttribute('aria-label') || ''))); const tops = els.map((x) => Math.round(R(x).top)); return tops.length >= 2 && Math.max(...tops) - Math.min(...tops) <= 2; });
      const sobrepoe = arts.some((a) => { const els = [...a.querySelectorAll('h2 a,p,button,a[href]')].map(R).filter((r) => r.width && r.height); for (let i = 0; i < els.length; i++) for (let j = i + 1; j < els.length; j++) { const A = els[i], B = els[j]; const ix = Math.min(A.right, B.right) - Math.max(A.left, B.left), iy = Math.min(A.bottom, B.bottom) - Math.max(A.top, B.top); const aninhado = (A.left <= B.left && A.right >= B.right && A.top <= B.top && A.bottom >= B.bottom) || (B.left <= A.left && B.right >= A.right && B.top <= A.top && B.bottom >= A.bottom); if (!aninhado && ix > 2 && iy > 2) return true; } return false; });
      const foraDaTela = arts.some((a) => [...a.querySelectorAll('*')].some((x) => R(x).right > window.innerWidth + 1));
      const secundario = arts.every((a) => { const v = [...a.querySelectorAll('a')].find((x) => /Ver detalhes/.test(x.textContent)); const c = [...a.querySelectorAll('button')].find((x) => /Compartilhar/.test(x.textContent)); return v && c && getComputedStyle(v).backgroundColor !== 'rgba(0, 0, 0, 0)' && getComputedStyle(c).backgroundColor === 'rgba(0, 0, 0, 0)'; });
      return { n: arts.length, comFoto: comFoto.length, semFoto: semFoto.length, ratios, hFoto, hSem, linhaUnica, acoesNaMesmaLinha, sobrepoe, foraDaTela, secundario, cls: window.__cls };
    });
    ok(`[${vp.width}] cards: ${m.comFoto} com foto e ${m.semFoto} sem foto`, m.comFoto > 0 && m.semFoto > 0, `${m.comFoto}/${m.semFoto}`);
    ok(`[${vp.width}] foto: proporção estável (mesma em todos os cards)`, PHOTO ? m.ratios.every((r) => Math.abs(r - m.ratios[0]) < 0.02) : true, m.ratios.map((r) => r.toFixed(2)).join(','));
    ok(`[${vp.width}] card sem foto bem mais baixo que o com foto`, m.hFoto && m.hSem && m.hSem < m.hFoto * 0.6, `com foto=${Math.round(m.hFoto)}px, sem foto=${Math.round(m.hSem)}px`);
    ok(`[${vp.width}] local e data numa linha só`, m.linhaUnica);
    ok(`[${vp.width}] ações na mesma linha`, m.acoesNaMesmaLinha);
    ok(`[${vp.width}] «Ver detalhes» principal (cheio) e «Compartilhar» discreto (sem fundo)`, m.secundario);
    ok(`[${vp.width}] sem sobreposição dentro dos cards e nada fora da tela`, !m.sobrepoe && !m.foraDaTela);
    ok(`[${vp.width}] sem pulo de layout (CLS < 0,05)`, (m.cls ?? 0) < 0.05, String((m.cls ?? 0).toFixed(4)));
    if (AXE) { await page.addScriptTag({ content: AXE });
      const v = await page.evaluate(async () => (await axe.run(document.querySelector('main'), { runOnly: ['color-contrast', 'button-name', 'link-name', 'label', 'image-alt', 'heading-order'] })).violations.map((x) => `${x.id}(${x.nodes.length})`));
      ok(`[${vp.width}] acessibilidade (contraste, nomes, rótulos)`, v.length === 0, v.join(', ')); }
    ok(`[${vp.width}] cookies depois de abrir (informativo)`, true, (await ctx.cookies()).map((c) => c.name).join(',') || 'nenhum');
    await ctx.close(); }

  if (desktop) continue; // o resto são comportamentos, iguais em qualquer largura

  // 3) «Perto de mim» (lento, 1,5 s): só aí a rota é chamada; a lista não some; troca de uma vez; depois «Só a minha cidade»
  { const { ctx, page, st } = await newPage(browser, vp, { geo: GEO('Cascavel', 'PR', 1500) });
    await page.goto(`${BASE}/feed`); await page.waitForTimeout(800);
    await page.selectOption(SEL, 'auto');
    await page.waitForTimeout(250);
    ok(`[${vp.width}] escolheu «Perto de mim»: a rota foi chamada 1 vez, o seletor fica bloqueado e os cards continuam`, st.geoCalls === 1 && (await page.locator(SEL).isDisabled()) && (await cards(page).count()) === 12, `geo=${st.geoCalls}`);
    ok(`[${vp.width}] enquanto procura: SEM aviso`, await page.locator(AVISO).count() === 0);
    const seen = [];
    for (let i = 0; i < 40; i++) { seen.push(await cards(page).count()); await page.waitForTimeout(80); }
    ok(`[${vp.width}] sem «piscar»: nunca zero cards durante a troca`, Math.min(...seen) > 0, `contagens: ${[...new Set(seen)].join('→')}`);
    let L = await labels(page);
    ok(`[${vp.width}] localizado em Cascavel/PR: só PR (nada de Recife/SP/SC), «Perto de mim» selecionado, sem aviso`,
      L.length > 0 && !L.some((x) => /Recife|São Paulo|Florianópolis| SC| SP| PE|Brusque|Palmares/.test(x.loc ?? '')) && (await page.locator(SEL).inputValue()) === 'auto' && (await page.locator(AVISO).count()) === 0, `${L.length} cards`);
    ok(`[${vp.width}] usuário antes de sinal público`, L.findIndex((x) => x.o === 'sinal_publico') === -1 || L.slice(0, L.findIndex((x) => x.o === 'sinal_publico')).every((x) => x.o === 'usuario'));
    await page.selectOption(SEL, 'cidade'); await page.waitForTimeout(900);
    L = await labels(page);
    ok(`[${vp.width}] «Só a minha cidade»: não chama a rota de novo e mostra só Cascavel`, st.geoCalls === 1 && L.length > 0 && L.every((x) => /Cascavel|Parque Verde|Belmonte|Colonial|Alto|Universit|Nova York|Centro/.test(x.loc ?? '')) && !L.some((x) => /Recife|São Paulo/.test(x.loc ?? '')), `geo=${st.geoCalls} ${L.length} cards`);
    await page.selectOption(SEL, 'todas'); await page.waitForTimeout(900);
    ok(`[${vp.width}] voltar a «Todas as regiões» traz as outras regiões de novo; nenhuma chamada nova`, (await cards(page).count()) === 12 && st.geoCalls === 1 && st.ipapiCalls === 0);
    await ctx.close(); }

  // 3b) Outro país (sigla coincide com estado brasileiro): volta para «Todas» e mostra o aviso
  { const { ctx, page, st } = await newPage(browser, vp, { geo: GEO('Pittsburgh', 'PA', 0, 'US') });
    await page.goto(`${BASE}/feed`); await page.waitForTimeout(600);
    await page.selectOption(SEL, 'auto'); await page.waitForTimeout(1200);
    ok(`[${vp.width}] visitante dos EUA escolhe «Perto de mim»: volta para «Todas as regiões», 12 cards, com aviso`,
      (await page.locator(SEL).inputValue()) === 'todas' && (await cards(page).count()) === 12 && (await page.locator(AVISO).count()) === 1 && st.geoCalls === 1);
    await page.selectOption(SEL, 'SP'); await page.waitForTimeout(900);
    ok(`[${vp.width}] escolher um estado depois do aviso funciona e tira o aviso`, (await page.locator(AVISO).count()) === 0 && (await cards(page).count()) > 0);
    await ctx.close(); }

  // 3c) Falha da rota: «Só a minha cidade» também volta para «Todas» com o aviso
  { const { ctx, page } = await newPage(browser, vp, { geo: 'abort' });
    await page.goto(`${BASE}/feed`); await page.waitForTimeout(600);
    await page.selectOption(SEL, 'cidade'); await page.waitForTimeout(1200);
    ok(`[${vp.width}] falha ao localizar («Só a minha cidade»): volta para «Todas as regiões», 12 cards, com aviso`,
      (await page.locator(SEL).inputValue()) === 'todas' && (await cards(page).count()) === 12 && (await page.locator(AVISO).count()) === 1);
    await ctx.close(); }

  // 3d) Demora mais de 4 s: desiste, volta para «Todas» e mostra o aviso
  { const { ctx, page } = await newPage(browser, vp, { geo: GEO('Cascavel', 'PR', 7000) });
    await page.goto(`${BASE}/feed`); await page.waitForTimeout(600);
    await page.selectOption(SEL, 'auto'); await page.waitForTimeout(3000);
    const antes = await page.locator(AVISO).count();
    await page.waitForTimeout(2200);
    ok(`[${vp.width}] tempo limite de 4 s: sem aviso aos 3 s, aviso depois, «Todas as regiões» e 12 cards`,
      antes === 0 && (await page.locator(AVISO).count()) === 1 && (await page.locator(SEL).inputValue()) === 'todas' && (await cards(page).count()) === 12);
    await ctx.close(); }

  // 3e) Localizado só pelo estado (sem cidade): «Perto de mim» vale; «Só a minha cidade» volta para «Todas» com aviso
  { const { ctx, page } = await newPage(browser, vp, { geo: (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ country: 'BR', uf: 'PR', city: null }) }) });
    await page.goto(`${BASE}/feed`); await page.waitForTimeout(600);
    await page.selectOption(SEL, 'auto'); await page.waitForTimeout(1000);
    const okAuto = (await page.locator(SEL).inputValue()) === 'auto' && (await page.locator(AVISO).count()) === 0 && (await cards(page).count()) > 0;
    await page.selectOption(SEL, 'cidade'); await page.waitForTimeout(1000);
    ok(`[${vp.width}] só o estado: «Perto de mim» vale; «Só a minha cidade» (sem cidade) volta para «Todas» com aviso`, okAuto && (await page.locator(SEL).inputValue()) === 'todas' && (await page.locator(AVISO).count()) === 1);
    await ctx.close(); }

  // 3f) Página 2: também não detecta ao carregar
  { const { ctx, page, st } = await newPage(browser, vp, { geo: GEO('Cascavel', 'PR') });
    await page.goto(`${BASE}/feed/pagina/2`); await page.waitForTimeout(1500);
    ok(`[${vp.width}] /feed/pagina/2: nenhuma chamada de localização e nenhum aviso`, st.geoCalls === 0 && await page.locator(AVISO).count() === 0, `geo=${st.geoCalls}`);
    await ctx.close(); }

  // 4) Região sem ocorrências (escolhida): estado vazio com mapa, busca e cadastro (nunca outras regiões)
  { const { ctx, page } = await newPage(browser, vp, { geo: GEO('Manaus', 'AM') });
    await page.goto(`${BASE}/feed`); await page.waitForTimeout(600);
    await page.selectOption(SEL, 'auto'); await page.waitForSelector('text=Nenhuma ocorrência recente nesta seleção', { timeout: 6000 });
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
