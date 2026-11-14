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

async function abrir(W) {
  const mobile = W < 1000;
  const ctx = await b.newContext({ viewport: { width: W, height: mobile ? 844 : 800 }, deviceScaleFactor: 1, isMobile: mobile, hasTouch: mobile, userAgent: mobile ? UA_M : UA_D });
  const st = { eventos: [], ctxReqs: [] };
  await ctx.addInitScript(() => { Object.defineProperty(navigator, 'webdriver', { get: () => false }); Object.defineProperty(navigator, 'userAgentData', { get: () => ({ brands: [{ brand: 'Chromium', version: '124' }], mobile: true, platform: 'iOS' }) }); });
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
  const L = `[${W}]`;
  // 1) do Feed: toca em «Informar que encontrei» de um perdido de usuário
  { const { ctx, p, st } = await abrir(W); await p.goto(`${BASE}/feed`); await p.waitForSelector('main article'); await p.waitForTimeout(1500);
    const alvo = await p.evaluate(() => { const a = [...document.querySelectorAll('main article')].find((x) => x.dataset.origin === 'usuario' && [...x.querySelectorAll('a')].some((l) => /Informar que encontrei/.test(l.textContent))); const t = a.querySelector('h2').textContent.trim(); const l = [...a.querySelectorAll('a')].find((x) => /Informar que encontrei/.test(x.textContent)); return { code: a.querySelector('a[href^="/objeto/"]').getAttribute('href').split('/').pop(), titulo: t, href: l.getAttribute('href') }; });
    ok(`${L} o botão do card leva a /achei?ref=feed&de=<código>`, alvo.href === `/achei?ref=feed&de=${alvo.code}`, alvo.href);
    await p.locator(`main article:has(a[href="/objeto/${alvo.code}"]) a:has-text("Informar que encontrei")`).first().click(); await p.waitForURL(/\/achei/, { timeout: 20000 });
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
    await p.waitForTimeout(3800);
    const ev = st.eventos.filter((e) => e.event === 'achei_contexto_exibido');
    const props = ev[0]?.properties ?? {}; const chaves = Object.keys(props).filter((k) => !k.startsWith('$') && !['token', 'distinct_id', 'time', 'uuid'].includes(k)).sort();
    ok(`${L} evento achei_contexto_exibido (1x) só com categoria e situação — sem título nem código`, ev.length === 1 && JSON.stringify(chaves) === JSON.stringify(['categoria', 'situacao']) && !JSON.stringify(Object.fromEntries(Object.entries(props).filter(([k]) => !k.startsWith('$')))).includes(alvo.titulo) && !JSON.stringify(Object.fromEntries(Object.entries(props).filter(([k]) => !k.startsWith('$')))).includes(alvo.code), `${chaves.join(',')} (o PostHog acrescenta sozinho a URL da página em $current_url, como em todo evento)`);
    ok(`${L} evento feed_informar_encontrei_clique continua`, st.eventos.some((e) => e.event === 'feed_informar_encontrei_clique'));
    await ctx.close(); }
  // 2) /achei normal: idêntico a hoje (sem aviso, sem busca preenchida, sem pedido de contexto)
  for (const [nome, qs] of [['normal', ''], ['?ref=feed sem «de»', '?ref=feed'], ['«de» vazio', '?ref=feed&de='], ['«de» com marcação', '?ref=feed&de=%3Cscript%3Ealert(1)%3C%2Fscript%3E'], ['«de» longo demais', '?ref=feed&de=' + 'A'.repeat(300)], ['«de» repetido', '?de=USR00002&de=USR00004']]) {
    const { ctx, p, st } = await abrir(W); await p.goto(`${BASE}/achei${qs}`); await p.waitForSelector('h1'); await p.waitForTimeout(2000);
    const r = await p.evaluate(() => ({ banner: !!document.querySelector('[data-achei-contexto]'), valor: document.querySelector('input[type=text]').value, h1: document.querySelector('h1').textContent, script: !!document.querySelector('script[src*="alert"]') }));
    ok(`${L} /achei ${nome}: sem aviso, busca vazia, sem pedido de contexto`, !r.banner && r.valor === '' && r.h1 === 'Encontrou algo?' && st.ctxReqs.length === 0, `pedidos=${st.ctxReqs.length}`);
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
