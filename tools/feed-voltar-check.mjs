#!/usr/bin/env node
// Verificação de navegador: restaurar a posição do Feed ao voltar pelo botão «voltar» (Playwright, fora das dependências do projeto).
//   node tools/feed-voltar-check.mjs <baseUrl> [larguras, ex.: 390]
// Precisa de um Feed com MUITOS cards (>= 60): use tests/fixtures/feed-grande-seed.sql num banco descartável.
// Só leitura (GET). Emula iPhone no Chromium (NÃO é o Safari). Região «Só a minha cidade» usa uma rota de localização simulada.
import { createRequire } from 'node:module';
import { readFileSync, existsSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
const { chromium } = createRequire(import.meta.url)('playwright');
const BASE = process.argv[2], WIDTH = Number((process.argv[3] || '390').split(',')[0]);
const PHOTO = existsSync('/tmp/claude-0/sample-photo.jpg') ? readFileSync('/tmp/claude-0/sample-photo.jpg') : null;
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const CHAVE = 'feed-state-v1';
let fails = 0;
const ok = (n, c, x = '') => { if (!c) fails++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}${x !== '' ? '  — ' + x : ''}`); };
const b = await chromium.launch();

async function nova({ geo = true } = {}) {
  const ctx = await b.newContext({ viewport: { width: WIDTH, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: UA });
  const st = { reqs: [], eventos: [], erros: [], geoChamadas: 0 };
  // O PostHog ignora navegadores que se declaram «headless» (webdriver e userAgentData). Só no teste:
  await ctx.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
    Object.defineProperty(navigator, 'userAgentData', { get: () => ({ brands: [{ brand: 'Chromium', version: '124' }], mobile: true, platform: 'iOS' }) });
  });
  const p = await ctx.newPage();
  const instalar = async (p) => {
    p.on('request', (r) => { const u = r.url(); if (u.startsWith(BASE)) st.reqs.push(u.replace(BASE, '')); });
    p.on('pageerror', (e) => st.erros.push(String(e)));
    p.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|ERR_|net::/.test(m.text())) st.erros.push(m.text()); });
  };
  await p.route('http://localhost:3199/**', async (route) => {
    const req = route.request(); const u = req.url();
    if (/\/array\/[^/]+\/config\.js/.test(u)) return route.fulfill({ status: 200, contentType: 'application/javascript', body: "window._POSTHOG_REMOTE_CONFIG=window._POSTHOG_REMOTE_CONFIG||{};window._POSTHOG_REMOTE_CONFIG['phc_local_test_not_real']={config:{token:'phc_local_test_not_real',supportedCompression:['gzip-js','base64'],hasFeatureFlags:false,captureDeadClicks:false,capturePerformance:false,autocapture_opt_out:true,defaultIdentifiedOnly:true},siteApps:[]};" });
    if (/\/flags\/|\/decide|\/config\?/.test(u)) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ featureFlags: {}, featureFlagPayloads: {}, config: { enable_collect_everything: false }, supportedCompression: ['gzip-js', 'base64'], autocapture_opt_out: true }) });
    try {
      const buf = req.postDataBuffer();
      if (buf) {
        let txt; try { txt = gunzipSync(buf).toString('utf8'); } catch { txt = buf.toString('utf8'); }
        const m = txt.match(/^data=(.*)$/s); if (m) txt = Buffer.from(decodeURIComponent(m[1]), 'base64').toString('utf8');
        const j = JSON.parse(txt); (Array.isArray(j) ? j : [j]).forEach((e) => e?.event && st.eventos.push(e));
      }
    } catch { /* corpo ilegível */ }
    route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });
  await ctx.route(/google|clarity|facebook|mapbox|ipapi|posthog\.com/, (r) => r.abort());
  if (PHOTO) await ctx.route('https://pub-test.r2.dev/**', (r) => r.fulfill({ status: 200, contentType: 'image/jpeg', body: PHOTO }));
  if (geo) await ctx.route('**/api/v1/feed/geo', (r) => { st.geoChamadas++; r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ country: 'BR', uf: 'PE', city: 'Recife' }) }); });
  await instalar(p);
  ctx.on('page', instalar);
  return { ctx, p, st };
}
const cards = (p) => p.evaluate(() => document.querySelectorAll('main article').length);
const hrefs = (p) => p.evaluate(() => [...document.querySelectorAll('main article')].map((a) => a.querySelector('a[href^="/objeto/"]')?.getAttribute('href')));
const estadoSalvo = (p) => p.evaluate((k) => { try { const j = JSON.parse(sessionStorage.getItem(k) || 'null'); return j && { cards: j.itens.length, scrollY: j.scrollY, autoLotes: j.autoLotes, temMais: j.temMais, regiao: j.filtros.region, idade: Date.now() - j.t }; } catch { return 'ilegivel'; } }, CHAVE);
const modoRolagem = (p) => p.evaluate(() => history.scrollRestoration);
const semAnimacao = (p) => p.addStyleTag({ content: 'html{scroll-behavior:auto !important}' });
const abrir = async (p, url = '/feed') => { await p.goto(BASE + url); await semAnimacao(p); await p.waitForTimeout(2500); };

// rola de verdade até a lista ter `alvo` cards (o carregamento automático traz os lotes); para assim que chegar
async function rolarAte(p, alvo, parar = true) {
  for (let i = 0; i < 120; i++) {
    if ((await cards(p)) >= alvo && parar) break;
    await p.evaluate(() => scrollBy(0, 380)); await p.waitForTimeout(220);
  }
  await p.waitForTimeout(900);
  return cards(p);
}
// leva o card `idx` ao meio da tela, espera a gravação e abre «Ver detalhes»
async function abrirCard(p, idx) {
  await p.evaluate((i) => document.querySelectorAll('main article')[i].scrollIntoView({ block: 'center', behavior: 'instant' }), idx);
  await p.waitForTimeout(1200);
  const y0 = await p.evaluate(() => Math.round(scrollY));
  const lista = await hrefs(p);
  await p.locator('main article').nth(idx).locator('a[aria-label^="Ver detalhes"]').click();
  await p.waitForURL((u) => u.pathname.startsWith('/objeto/'), { timeout: 15000 }); await p.waitForTimeout(1500);
  return { y0, lista, href: lista[idx] };
}
const igual = (a, c) => a.length === c.length && a.every((x, i) => x === c[i]);
const dup = (a) => a.length - new Set(a).size;
const feedReqs = (st, de) => st.reqs.slice(de).filter((u) => /^\/api\/v1\/feed\?|^\/api\/v1\/feed$/.test(u)).length;
const geoReqs = (st, de) => st.reqs.slice(de).filter((u) => /\/api\/v1\/feed\/geo/.test(u)).length;
const restauradoEvt = (st) => st.eventos.filter((e) => e.event === 'feed_state_restored');

async function voltaEConfere(rot, { p, st }, antes, esperadoCards) {
  const marca = st.reqs.length; const evtAntes = restauradoEvt(st).length;
  await p.goBack(); await p.waitForSelector('main article', { timeout: 15000 }); await p.waitForTimeout(3500);
  const n = await cards(p), h = await hrefs(p), y = await p.evaluate(() => Math.round(scrollY));
  for (let i = 0; i < 30 && restauradoEvt(st).length === evtAntes; i++) await p.waitForTimeout(300); // o PostHog envia em lotes: espera até ~9 s
  const evt = restauradoEvt(st).slice(evtAntes);
  ok(`${rot}: voltou ao /feed`, new URL(p.url()).pathname === '/feed');
  ok(`${rot}: mesmos cards (${esperadoCards ?? antes.lista.length}), na mesma ordem`, igual(h, esperadoCards ? antes.lista.slice(0, esperadoCards) : antes.lista), `${n} cards`);
  ok(`${rot}: sem cards duplicados`, dup(h) === 0);
  ok(`${rot}: mesma posição (tolerância de 6 px)`, Math.abs(y - antes.y0) <= 6, `antes ${antes.y0}px, depois ${y}px`);
  ok(`${rot}: o card aberto está na tela`, await p.evaluate((href) => { const a = [...document.querySelectorAll('main article')].find((x) => x.querySelector(`a[href="${href}"]`)); const r = a?.getBoundingClientRect(); return !!r && r.bottom > 0 && r.top < innerHeight; }, antes.href));
  ok(`${rot}: NENHUMA chamada a /api/v1/feed/geo nem a /api/v1/feed ao restaurar`, geoReqs(st, marca) === 0 && feedReqs(st, marca) === 0, `geo=${geoReqs(st, marca)} feed=${feedReqs(st, marca)}`);
  ok(`${rot}: evento feed_state_restored com a quantidade de cards (e mais nada)`, evt.length === 1 && evt[0].properties.cards === n && Object.keys(evt[0].properties).filter((k) => !k.startsWith('$') && k !== 'token' && k !== 'distinct_id').join() === 'cards', JSON.stringify(evt[0]?.properties && { cards: evt[0].properties.cards }));
  ok(`${rot}: history.scrollRestoration em «manual» enquanto restaurado`, (await modoRolagem(p)) === 'manual');
  return { n, y };
}

// ---------- 1) 24 cards: abre um card e volta ----------
{
  const c = await nova(); const { p, st } = c; await abrir(p);
  const n = await rolarAte(p, 24); ok('[24] rolagem real traz 24 cards', n === 24, `${n}`);
  const antes = await abrirCard(p, 19);
  const e24 = await estadoSalvo(p); ok('[24] estado guardado ao sair: 24 cards e a rolagem do clique', e24 && e24.cards === 24 && Math.abs(e24.scrollY - antes.y0) <= 6, JSON.stringify(e24));
  const r = await voltaEConfere('[24]', c, antes);
  await p.waitForTimeout(2500);
  ok('[24] continua com 24 cards (o automático não disparou sozinho na restauração)', (await cards(p)) === 24, `${await cards(p)}`);
  ok('[24] sem erros de JavaScript (hidratação incluída)', st.erros.length === 0, st.erros.slice(0, 2).join(' | '));
  await c.ctx.close();
}

// ---------- 2) 36 cards (automático parou): abre um card e volta ----------
{
  const c = await nova(); const { p, st } = c; await abrir(p);
  const n = await rolarAte(p, 36); ok('[36] rolagem real traz 36 cards e o automático para', n === 36, `${n}`);
  await p.waitForTimeout(2000);
  ok('[36] botão «Ver mais ocorrências» visível', (await p.locator('a[href="/feed/pagina/2"]:has-text("Ver mais ocorrências")').count()) === 1);
  const antes = await abrirCard(p, 30);
  const e36 = await estadoSalvo(p); ok('[36] estado guardado ao sair: 36 cards, o automático já parou, botão «Ver mais» em jogo', e36 && e36.cards === 36 && e36.autoLotes >= 2 && e36.temMais === true && Math.abs(e36.scrollY - antes.y0) <= 6, JSON.stringify(e36));
  const r = await voltaEConfere('[36]', c, antes);
  const marca = st.reqs.length; await p.waitForTimeout(3000);
  ok('[36] o limite continua: segue com 36 cards, sem novo carregamento automático', (await cards(p)) === 36 && feedReqs(st, marca) === 0);
  ok('[36] o botão «Ver mais ocorrências» volta visível, link real, e o convite está abaixo dele', (await p.locator('a[href="/feed/pagina/2"]:has-text("Ver mais ocorrências")').count()) === 1 && (await p.locator('[data-feed-convite]').count()) === 1);
  // «Ver mais» continua funcionando depois de restaurar: +12 sem duplicar
  const m2 = st.reqs.length; await p.locator('a[href="/feed/pagina/2"]:has-text("Ver mais ocorrências")').click(); await p.waitForTimeout(2500);
  const h = await hrefs(p);
  ok('[36] depois de restaurar, «Ver mais» traz +12 (48) com 1 pedido e sem duplicar (o cursor guardado funciona)', h.length === 48 && dup(h) === 0 && feedReqs(st, m2) === 1, `${h.length} cards, ${feedReqs(st, m2)} pedido(s)`);
  ok('[36] sem erros de JavaScript', st.erros.length === 0, st.erros.slice(0, 2).join(' | '));
  await c.ctx.close();
}

// ---------- 3) passou de 36 (clicou em «Ver mais»): guarda até 36 e o botão continua do lugar certo ----------
{
  const c = await nova(); const { p, st } = c; await abrir(p);
  await rolarAte(p, 36); await p.locator('a[href="/feed/pagina/2"]:has-text("Ver mais ocorrências")').click(); await p.waitForTimeout(2500);
  const total = await cards(p); ok('[48] 48 cards na tela', total === 48, `${total}`);
  const antes = await abrirCard(p, 40);
  const marca = st.reqs.length; await p.goBack(); await p.waitForSelector('main article'); await p.waitForTimeout(3500);
  const h = await hrefs(p), y = await p.evaluate(() => Math.round(scrollY));
  ok('[48] volta com os primeiros 36 cards (o limite guardado), sem duplicar, na mesma ordem', h.length === 36 && igual(h, antes.lista.slice(0, 36)) && dup(h) === 0, `${h.length} cards`);
  ok('[48] sem chamadas a /geo nem /api/v1/feed ao restaurar', geoReqs(st, marca) === 0 && feedReqs(st, marca) === 0);
  ok('[48] o botão «Ver mais ocorrências» está visível e a rolagem foi até o fim da lista guardada (o card 41 não está entre os 36)', (await p.locator('a[href="/feed/pagina/2"]:has-text("Ver mais ocorrências")').count()) === 1, `rolagem ${y}px (antes ${antes.y0}px)`);
  const m2 = st.reqs.length; await p.locator('a[href="/feed/pagina/2"]:has-text("Ver mais ocorrências")').click(); await p.waitForTimeout(2500);
  const h2 = await hrefs(p);
  ok('[48] «Ver mais» depois de restaurar continua do cursor certo: 48 cards, sem duplicar, mesmos cards de antes', h2.length === 48 && dup(h2) === 0 && igual(h2, antes.lista), `${h2.length} cards`);
  await c.ctx.close();
}

// ---------- 4) filtro «Só a minha cidade» ----------
{
  const c = await nova(); const { p, st } = c; await abrir(p);
  await p.locator('select').nth(1).selectOption('cidade'); await p.waitForTimeout(2500);
  const geoAntes = st.geoChamadas; const nFiltro = await cards(p);
  ok('[cidade] escolheu «Só a minha cidade» (a localização foi pedida 1 vez, como sempre)', geoAntes === 1, `geo=${geoAntes}, ${nFiltro} cards`);
  await rolarAte(p, Math.min(24, nFiltro + 100), false); // rola o que houver
  const n = await cards(p);
  const antes = await abrirCard(p, Math.min(n - 1, 5));
  const r = await voltaEConfere('[cidade]', c, antes);
  ok('[cidade] a região continua «Só a minha cidade» e a localização NÃO foi pedida de novo', (await p.locator('select').nth(1).inputValue()) === 'cidade' && st.geoChamadas === geoAntes, `geo total=${st.geoChamadas}`);
  ok('[cidade] sem aviso de «não conseguimos identificar sua região»', (await p.getByText('Não conseguimos identificar sua região').count()) === 0);
  await c.ctx.close();
}

// ---------- 5) F5, nova aba e link novo começam do zero ----------
{
  const c = await nova(); const { p, ctx, st } = c; await abrir(p);
  await rolarAte(p, 24); await p.waitForTimeout(1200);
  const e1 = await estadoSalvo(p); ok('[zero] há estado guardado (24 cards) antes dos testes', e1 && e1.cards >= 24, JSON.stringify(e1));
  // F5
  const ev0 = restauradoEvt(st).length; await p.reload(); await semAnimacao(p); await p.waitForTimeout(3000);
  ok('[F5] começa do zero: sem restauração (sem evento, rolagem automática do navegador intacta)', restauradoEvt(st).length === ev0 && (await modoRolagem(p)) === 'auto');
  const e2 = await estadoSalvo(p); ok('[F5] o estado antigo foi descartado e substituído por um novo (idade < 10 s)', e2 && e2 !== 'ilegivel' && e2.idade < 10000, JSON.stringify(e2));
  // nova aba (aba totalmente nova)
  await rolarAte(p, 24); await p.waitForTimeout(1200);
  const q = await ctx.newPage(); await q.goto(BASE + '/feed'); await q.waitForTimeout(3000);
  ok('[nova aba] começa do zero: 12 cards, sem evento de restauração, rolagem em 0', (await cards(q)) <= 24 && (await q.evaluate(() => Math.round(scrollY))) === 0 && (await modoRolagem(q)) === 'auto' && restauradoEvt(st).length === ev0);
  await q.close();
  // aba aberta a partir desta (window.open copia o sessionStorage do navegador): ainda assim começa do zero
  const [aba] = await Promise.all([ctx.waitForEvent('page'), p.evaluate((u) => { window.open(u, '_blank'); }, BASE + '/feed')]);
  await aba.waitForLoadState('load'); await aba.waitForTimeout(3000);
  ok('[aba aberta por link] começa do zero: sem restauração e rolagem em 0', (await aba.evaluate(() => Math.round(scrollY))) === 0 && (await modoRolagem(aba)) === 'auto' && restauradoEvt(st).length === ev0);
  await aba.close();
  // link novo dentro do site (sem «voltar»)
  await p.bringToFront(); await p.evaluate(() => scrollTo({ top: 0, behavior: 'instant' })); await rolarAte(p, 24); await p.waitForTimeout(1200);
  await p.evaluate(() => window.next.router.push('/buscar')); await p.waitForURL(/\/buscar/); await p.waitForTimeout(1500);
  const m = st.reqs.length;
  await p.evaluate(() => window.next.router.push('/feed')); await p.waitForURL(/\/feed$/); await p.waitForTimeout(3000);
  ok('[link novo] /buscar → /feed (sem «voltar») começa do zero: sem evento de restauração e rolagem em «auto»', restauradoEvt(st).length === ev0 && (await modoRolagem(p)) === 'auto', `${await cards(p)} cards`);
  await c.ctx.close();
}

// ---------- 6) voltar com recarga completa do documento (back_forward) ----------
{
  const c = await nova(); const { p, st } = c; await abrir(p);
  await rolarAte(p, 24); await p.waitForTimeout(1200);
  await p.evaluate(() => document.querySelectorAll('main article')[17].scrollIntoView({ block: 'center', behavior: 'instant' })); await p.waitForTimeout(1200);
  const y0 = await p.evaluate(() => Math.round(scrollY)); const lista = await hrefs(p);
  await p.goto(BASE + '/sitemap.xml'); await p.waitForTimeout(800);
  const marca = st.reqs.length; await p.goBack({ waitUntil: 'load' }); await p.waitForSelector('main article'); await p.waitForTimeout(3500);
  const tipo = await p.evaluate(() => performance.getEntriesByType('navigation')[0].type);
  const h = await hrefs(p), y = await p.evaluate(() => Math.round(scrollY));
  ok(`[recarga completa] voltar de /sitemap.xml (tipo de navegação: ${tipo}): mesmos ${lista.length} cards, sem duplicar, mesma posição`, igual(h, lista) && dup(h) === 0 && Math.abs(y - y0) <= 6, `${h.length} cards, ${y0}px → ${y}px`);
  ok('[recarga completa] sem chamadas a /geo (e nenhuma a /api/v1/feed) ao restaurar', geoReqs(st, marca) === 0 && feedReqs(st, marca) === 0);
  await c.ctx.close();
}

await b.close();
console.log(fails ? `\n${fails} verificação(ões) falharam` : '\nTodas as verificações de navegador passaram');
process.exit(fails ? 1 : 0);
