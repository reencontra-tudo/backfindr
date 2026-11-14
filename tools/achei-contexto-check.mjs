#!/usr/bin/env node
// Verificação de navegador: «Informar que encontrei» (card do Feed) → /achei com o contexto do card → cadastro com título e categoria.
//   node tools/achei-contexto-check.mjs <baseUrl> [pastaCapturas]
// Precisa de um Feed com cards de usuário «perdido» (tests/fixtures/feed-grande-seed.sql). Só leitura (GET). Chromium emulando (NÃO é Safari/iPhone/Android reais).
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
const { chromium } = createRequire(import.meta.url)('playwright');
const BASE = process.argv[2], OUT = process.argv[3] || '/tmp/achei-contexto';
mkdirSync(OUT, { recursive: true });
const UA_M = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const UA_D = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
let fails = 0;
const ok = (n, c, x = '') => { if (!c) fails++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}${x !== '' ? '  — ' + x : ''}`); };
const b = await chromium.launch();
const CONFIG = "window._POSTHOG_REMOTE_CONFIG=window._POSTHOG_REMOTE_CONFIG||{};window._POSTHOG_REMOTE_CONFIG['phc_local_test_not_real']={config:{token:'phc_local_test_not_real',supportedCompression:['gzip-js','base64']},siteApps:[]};";

async function abrir(W, vis) {
  const mobile = W < 1000;
  const ctx = await b.newContext({ viewport: { width: W, height: mobile ? 844 : 800 }, deviceScaleFactor: 1, isMobile: mobile, hasTouch: mobile, userAgent: mobile ? UA_M : UA_D });
  const st = { eventos: [], ctxReqs: [] };
  await ctx.addInitScript(() => { Object.defineProperty(navigator, 'webdriver', { get: () => false }); Object.defineProperty(navigator, 'userAgentData', { get: () => ({ brands: [{ brand: 'Chromium', version: '124' }], mobile: true, platform: 'iOS' }) }); });
  if (vis === 'grade') await ctx.addInitScript(() => { try { localStorage.setItem('feed-visualizacao-v1', 'grade'); } catch { /* sem problema */ } });
  await ctx.route('http://localhost:3199/**', async (route) => {
    const req = route.request(); const u = req.url();
    if (/\/array\/[^/]+\/config\.js/.test(u)) return route.fulfill({ status: 200, contentType: 'application/javascript', body: CONFIG });
    if (/\/flags\/|\/decide|\/config\?/.test(u)) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ featureFlags: {}, featureFlagPayloads: {}, config: { enable_collect_everything: false }, supportedCompression: ['gzip-js', 'base64'], autocapture_opt_out: true }) });
    try { const buf = req.postDataBuffer(); if (buf) { let txt; try { txt = gunzipSync(buf).toString('utf8'); } catch { txt = buf.toString('utf8'); }
      const m = txt.match(/^data=(.*)$/s); if (m) txt = Buffer.from(decodeURIComponent(m[1]), 'base64').toString('utf8');
      const j = JSON.parse(txt); (Array.isArray(j) ? j : [j]).forEach((e) => e?.event && st.eventos.push(e)); } } catch { /* ilegível */ }
    route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });
  await ctx.route(/google|clarity|facebook|mapbox|ipapi|posthog\.com|pub-[a-z0-9]+\.r2\.dev/, (r) => r.abort());
  const p = await ctx.newPage();
  p.on('request', (r) => { if (r.url().includes('/api/v1/feed/contexto')) st.ctxReqs.push(new URL(r.url()).search); });
  return { ctx, p, st };
}
const banner = (p) => p.locator('[data-achei-contexto]');

for (const W of [390, 1280]) {
  const L0 = `[${W}]`;
  // 1) do Feed (nas duas visualizações): toca em «Informar que encontrei» / «Encontrei» de um perdido de usuário
  for (const vis of ['publicacoes', 'grade']) { const L = `[${W} ${vis}]`; const { ctx, p, st } = await abrir(W, vis); await p.goto(`${BASE}/feed`); await p.waitForSelector('main article'); await p.waitForTimeout(1500);
    const alvo = await p.evaluate(() => { const a = [...document.querySelectorAll('main article')].find((x) => x.dataset.origin === 'usuario' && [...x.querySelectorAll('a')].some((l) => /Informar que encontrei/.test(l.textContent + ' ' + (l.getAttribute('aria-label') || '')))); const t = a.querySelector('h2').textContent.trim(); const l = [...a.querySelectorAll('a')].find((x) => /Informar que encontrei/.test(x.textContent + ' ' + (x.getAttribute('aria-label') || ''))); return { code: a.querySelector('a[href^="/objeto/"]').getAttribute('href').split('/').pop(), titulo: t, href: l.getAttribute('href') }; });
    ok(`${L} o botão do card leva a /achei?ref=feed&de=<código>`, alvo.href === `/achei?ref=feed&de=${alvo.code}`, alvo.href);
    await p.locator(`main article:has(a[href="/objeto/${alvo.code}"]) a[href^="/achei"]`).first().click(); await p.waitForURL(/\/achei/, { timeout: 20000 });
    await banner(p).waitFor({ timeout: 15000 });
    const txt = (await banner(p).textContent()).replace(/\s+/g, ' ');
    ok(`${L} aviso «Você está informando sobre: <título>» + categoria`, txt.includes('Você está informando sobre: ' + alvo.titulo) && /Chaves|Relógio|Celular|Pet|Carteira|Bicicleta|Documento|Outros|Joia|Bolsa|Eletrônico|Veículo|Roupa/.test(txt), txt);
    const val = await p.locator('input[type=text]').inputValue();
    ok(`${L} busca pré-preenchida com palavras do título (e sem a palavra «perdido»)`, val.length > 0 && !/perdid/i.test(val) && alvo.titulo.toLowerCase().includes(val.split(' ')[0].toLowerCase()), `«${val}»`);
    await p.screenshot({ path: `${OUT}/${W}-1-achei-com-contexto.png` });
    await p.getByRole('button', { name: /Ver se o dono/ }).click(); await p.waitForTimeout(2500);
    const reg = await p.evaluate(() => [...document.querySelectorAll('a[href^="/auth/register?intent=found"]')].map((a) => a.getAttribute('href')));
    ok(`${L} links de cadastro levam intent=found, prefill_title e prefill_category`, reg.length > 0 && reg.every((h) => { const q = new URLSearchParams(h.split('?')[1]); return q.get('intent') === 'found' && q.get('prefill_title') === alvo.titulo && !!q.get('prefill_category'); }), reg[0]);
    await p.screenshot({ path: `${OUT}/${W}-2-achei-resultados.png` });
    const href0 = reg[0]; await p.locator(`a[href="${href0}"]`).first().click(); await p.waitForURL(/\/auth\/register/, { timeout: 20000 });
    const q = new URL(p.url()).searchParams;
    ok(`${L} cadastro abre com título e categoria`, q.get('intent') === 'found' && q.get('prefill_title') === alvo.titulo && !!q.get('prefill_category'), p.url().replace(BASE, ''));
    ok(`${L} cadastro leva o código do card (de=…)`, q.get('de') === alvo.code, q.get('de'));
    await p.locator('[data-cadastro-contexto]').waitFor({ timeout: 15000 });
    const bt = (await p.locator('[data-cadastro-contexto]').textContent()).replace(/\s+/g, ' ');
    ok(`${L} tela de cadastro mostra «Você está informando sobre: <título>» e a categoria`, bt.includes('Você está informando sobre: ' + alvo.titulo) && bt.length > ('Você está informando sobre: ' + alvo.titulo).length, bt);
    ok(`${L} tela de cadastro continua com o título «Criar sua conta grátis» e o formulário`, (await p.locator('h1').textContent()).trim() === 'Criar sua conta grátis' && (await p.locator('form input').count()) >= 3);
    await p.screenshot({ path: `${OUT}/${W}-${vis}-3-cadastro-com-contexto.png` });
    await p.waitForTimeout(3800);
    const ev = st.eventos.filter((e) => e.event === 'achei_contexto_exibido');
    const props = ev[0]?.properties ?? {}; const chaves = Object.keys(props).filter((k) => !k.startsWith('$') && !['token', 'distinct_id', 'time', 'uuid'].includes(k)).sort();
    ok(`${L} evento achei_contexto_exibido (1x) só com categoria e situação — sem título nem código`, ev.length === 1 && JSON.stringify(chaves) === JSON.stringify(['categoria', 'situacao']) && !JSON.stringify(Object.fromEntries(Object.entries(props).filter(([k]) => !k.startsWith('$')))).includes(alvo.titulo) && !JSON.stringify(Object.fromEntries(Object.entries(props).filter(([k]) => !k.startsWith('$')))).includes(alvo.code), `${chaves.join(',')} (o PostHog acrescenta sozinho a URL da página em $current_url, como em todo evento)`);
    ok(`${L} evento achei_contexto_cadastro_clique (1x) só com categoria e situação`, (() => { const e = st.eventos.filter((x) => x.event === 'achei_contexto_cadastro_clique'); const ch = Object.keys(e[0]?.properties ?? {}).filter((k) => !k.startsWith('$') && !['token', 'distinct_id', 'time', 'uuid'].includes(k)).sort().join(); return e.length === 1 && ch === 'categoria,situacao'; })());
    ok(`${L} evento feed_informar_encontrei_clique continua`, st.eventos.some((e) => e.event === 'feed_informar_encontrei_clique'));
    await ctx.close(); }
  const L = L0;
  // 2) /achei normal: idêntico a hoje (sem aviso, sem busca preenchida, sem pedido de contexto)
  for (const [nome, qs] of [['normal', ''], ['?ref=feed sem «de»', '?ref=feed'], ['«de» vazio', '?ref=feed&de='], ['«de» com marcação', '?ref=feed&de=%3Cscript%3Ealert(1)%3C%2Fscript%3E'], ['«de» longo demais', '?ref=feed&de=' + 'A'.repeat(300)], ['«de» repetido', '?de=USR00002&de=USR00004']]) {
    const { ctx, p, st } = await abrir(W); await p.goto(`${BASE}/achei${qs}`); await p.waitForSelector('h1'); await p.waitForTimeout(2000);
    const r = await p.evaluate(() => ({ banner: !!document.querySelector('[data-achei-contexto]'), valor: document.querySelector('input[type=text]').value, h1: document.querySelector('h1').textContent, script: !!document.querySelector('script[src*="alert"]') }));
    ok(`${L} /achei ${nome}: sem aviso, busca vazia, sem pedido de contexto`, !r.banner && r.valor === '' && r.h1 === 'Encontrou algo?' && st.ctxReqs.length === 0, `pedidos=${st.ctxReqs.length}`);
    await ctx.close();
  }
  // 2b) SEM contexto: da busca ao cadastro, o link é o de sempre e o cadastro não mostra aviso (também com «de» inválido, de objeto não elegível e com sessão de login simulada)
  for (const [nome, qs, logado] of [['/achei normal', '', false], ['«de» inválido', '?ref=feed&de=%3Cscript%3E', false], ['«de» de achado (não elegível)', '?ref=feed&de=USR00001', false], ['/achei normal, já com login', '', true]]) {
    const { ctx, p, st } = await abrir(W, 'publicacoes'); if (logado) await ctx.addCookies([{ name: 'access_token', value: 'token-de-teste-invalido', url: BASE }]);
    await p.goto(`${BASE}/achei${qs}`); await p.waitForSelector('h1'); await p.waitForTimeout(1500);
    await p.locator('input[type=text]').fill('carteira'); await p.getByRole('button', { name: /Ver se o dono/ }).click(); await p.waitForTimeout(2500);
    const hs = await p.evaluate(() => [...document.querySelectorAll('a[href^="/auth/register?intent=found"]')].map((a) => a.getAttribute('href')));
    if (nome === '/achei normal') { const t = await p.locator('body').innerText();
      ok(`${L} texto «É um desses?» sem «chat da plataforma» no /achei (resultados na tela)`, /É um desses\?/.test(t) && !/chat da plataforma|conversa acontece/i.test(t) && /Crie uma conta gratuita para registrar o que você encontrou e entrar em contato\./.test(t), /É um desses\?/.test(t) ? 'bloco presente, texto novo' : 'bloco «É um desses?» não apareceu'); }
    ok(`${L} ${nome}: links de cadastro idênticos aos de sempre`, hs.length > 0 && hs.every((h) => h === '/auth/register?intent=found'), hs.join(' | '));
    await p.locator(`a[href="/auth/register?intent=found"]`).first().click(); await p.waitForURL(/\/auth\/register/, { timeout: 20000 }); await p.waitForSelector('h1'); await p.waitForTimeout(1800);
    ok(`${L} ${nome}: cadastro sem aviso e sem pedido de contexto`, (await p.locator('[data-cadastro-contexto]').count()) === 0 && new URL(p.url()).search === '?intent=found' && st.ctxReqs.length <= 1, `${new URL(p.url()).search} pedidos=${st.ctxReqs.length}`);
    await ctx.close();
  }
  // 3) «de» bem formado mas NÃO elegível: o pedido é feito e nada aparece (sem pista)
  for (const [nome, code] of [['achado de usuário', 'USR00001'], ['inexistente', 'ZZZZ9999'], ['legado', 'LEG00001'], ['sinal público', 'SIG00004']]) {
    const { ctx, p, st } = await abrir(W); await p.goto(`${BASE}/achei?ref=feed&de=${code}`); await p.waitForSelector('h1'); await p.waitForTimeout(2500);
    const r = await p.evaluate(() => ({ banner: !!document.querySelector('[data-achei-contexto]'), valor: document.querySelector('input[type=text]').value }));
    ok(`${L} «de» não elegível (${nome}): sem aviso e busca vazia`, !r.banner && r.valor === '' && st.ctxReqs.length <= 1, `pedidos=${st.ctxReqs.length}`);
    await ctx.close();
  }
  // 4) piscada: quando o aviso aparece depois de carregar
  { const { ctx, p } = await abrir(W); await p.goto(`${BASE}/achei?ref=feed&de=USR00002`, { waitUntil: 'commit' });
    const t = await p.evaluate(() => new Promise((res) => { const t0 = performance.now(); const h = document.querySelector('h1'); const y0 = h ? h.getBoundingClientRect().top : null; const iv = setInterval(() => { const bn = document.querySelector('[data-achei-contexto]'); const hh = document.querySelector('h1'); if (bn) { clearInterval(iv); res({ ms: Math.round(performance.now() - t0), h1Antes: y0, h1Depois: hh.getBoundingClientRect().top }); } if (performance.now() - t0 > 15000) { clearInterval(iv); res(null); } }, 5); }));
    console.log(`INFO  ${L} aviso aparece ~${t?.ms} ms depois do primeiro desenho (o título «Encontrou algo?» desce ${t ? Math.round(t.h1Depois - (t.h1Antes ?? 0)) : '?'} px quando ele entra)`); await ctx.close(); }
}
await b.close();
console.log(fails ? `\n${fails} VERIFICAÇÃO(ÕES) FALHOU/FALHARAM` : '\nTUDO CERTO');
process.exit(fails ? 1 : 0);
