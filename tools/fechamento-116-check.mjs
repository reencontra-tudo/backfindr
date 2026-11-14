#!/usr/bin/env node
// Verificação de navegador do fechamento do #116: /objeto sem rua/número/CEP (com API local e com a API de PRODUÇÃO, que é o que a prévia usa),
// pré-visualização do cartaz, texto da tela de aviso, «Ver detalhes» alinhado no /achei. Só leitura (GET e cliques na tela). Chromium emulando.
//   node tools/fechamento-116-check.mjs <baseLocal> <baseComApiDeProducao> [codigoReal]
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
const [LOCAL, PROD, REAL] = process.argv.slice(2);
let fails = 0; const ok = (n, c, x = '') => { if (!c) fails++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}${x !== '' ? '  — ' + x : ''}`); };
const b = await chromium.launch();
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const RUA = /\b(Travessa|Rua|Avenida|Av\.)\s+[A-ZÀ-Ú][a-zà-ú]+|(?<![\w.-])\d{5}-\d{3}(?![\w])|Palmeiras|Fictícia 55/;
async function abrir(W) {
  const ctx = await b.newContext({ viewport: { width: W, height: W < 1000 ? 844 : 800 }, isMobile: W < 1000, hasTouch: W < 1000, userAgent: W < 1000 ? UA : undefined });
  await ctx.route(/google|clarity|facebook|mapbox|ipapi|posthog|api\.qrserver|tile\.openstreetmap/, (r) => r.abort());
  return { ctx, p: await ctx.newPage() };
}
const ldDe = (html) => [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => m[1]).join(' ');
for (const W of [390, 1280]) {
  const L = `[${W}]`;
  for (const [nome, base, cod] of [['fictício com rua (API local)', LOCAL, 'USRRUA01'], ['fictício com rua em JSON (API local)', LOCAL, 'USRRUA03'], ...(REAL ? [['cadastro REAL (API de produção, como a prévia)', PROD, REAL]] : [])]) {
    const { ctx, p } = await abrir(W);
    // texto proibido extra: o logradouro que a API consultada devolve (comparado só por dentro; nada do texto é impresso)
    let proibido = null; if (nome.startsWith('cadastro REAL')) try { const j = await (await fetch(`${"http://localhost:3201"}/api/v1/objects/scan/${cod}`)).json(); const a = j?.location?.address ?? j?.data?.location?.address; if (typeof a === 'string' && a.includes(',')) proibido = a.split(',')[0].trim(); } catch {}
    const r = await p.goto(`${base}/objeto/${cod}`, { waitUntil: 'networkidle' }); const html = await r.text();
    const t = await p.locator('body').innerText();
    if (nome.startsWith('cadastro REAL')) ok(`${L} /objeto ${nome}: a página existe (200) e a API consultada devolveu endereço com rua`, r.status() === 200 && !!proibido && !/Perdido|Achado/.test('') , `status ${r.status()}; logradouro presente na API: ${!!proibido}`);
    if (proibido) { ok(`${L} /objeto ${nome}: o logradouro devolvido pela API não aparece em lugar nenhum da página (tela e HTML)`, !t.includes(proibido) && !html.includes(proibido)); }
    ok(`${L} /objeto ${nome}: tela sem rua, número nem CEP`, !RUA.test(t));
    ok(`${L} /objeto ${nome}: HTML inteiro (título, meta, JSON-LD, JSON do Next) sem rua/CEP`, !RUA.test(html));
    ok(`${L} /objeto ${nome}: og:image e twitter:image pedem a versão pública do cartaz`, (html.match(/poster\?format=vertical&(amp;)?publico=1/g) ?? []).length >= 2);
    const lat = html.match(/"latitude":(-?[\d.]+)/)?.[1];
    ok(`${L} /objeto ${nome}: coordenada do JSON-LD com no máximo 3 casas`, !lat || (lat.split('.')[1] ?? '').length <= 3, `lat=${lat ? 'ok' : 'n/a'}`);
    if (nome.startsWith('fictício com rua (')) ok(`${L} /objeto ${nome}: mostra «Vila Modelo, Guarulhos - SP»`, t.includes('Vila Modelo, Guarulhos - SP'));
    const ex = t.includes('Seu aviso fica registrado nesta ocorrência.');
    ok(`${L} /objeto ${nome}: bloco ao lado do botão com texto fiel (sem «chat da plataforma»/«dono recebe um aviso»)`, ex && !/chat da plataforma|O dono recebe um aviso/.test(t));
    if (W === 390 && nome.startsWith('fictício com rua (')) { await p.screenshot({ path: `/tmp/claude-0/vis/f116-objeto-${W}.png`, fullPage: false }); }
    await ctx.close();
  }
  { // legado: igual ao que a API devolve (endereço do legado intacto)
    const { ctx, p } = await abrir(W); await p.goto(`${LOCAL}/objeto/LEGRUA01`, { waitUntil: 'networkidle' }); const t = await p.locator('body').innerText();
    ok(`${L} /objeto legado: endereço do legado intacto`, t.includes('Rua do Legado, 55 - Centro, São Paulo')); await ctx.close(); }
  { // tela de aviso enviado (clique real no botão só no servidor local de teste)
    const { ctx, p } = await abrir(W); await p.route('**/api/v1/objects/scan/*/notify', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"success":true}' }));
    await p.goto(`${LOCAL}/objeto/USRRUA02`, { waitUntil: 'networkidle' }); await p.getByRole('button', { name: /Avisar o dono que encontrei/ }).click(); await p.waitForTimeout(800);
    const t = await p.locator('body').innerText();
    ok(`${L} tela de aviso enviado: texto fiel, sem chat/resposta prometidos`, t.includes('Seu aviso fica registrado') && t.includes('Push e e-mail saem só quando o dono não é legado') && t.includes('Não há garantia de resposta') && !/chat da plataforma|Dono entra em contato/.test(t));
    await ctx.close(); }
  { // /achei: «É este» e «Ver detalhes»
    const { ctx, p } = await abrir(W); await p.goto(`${LOCAL}/achei?ref=feed&de=USRRUA02`); await p.locator('[data-achei-contexto]').waitFor({ timeout: 20000 });
    await p.locator('input[type=text]').fill('carteira'); await p.getByRole('button', { name: /Ver se o dono/ }).click(); await p.waitForTimeout(2500);
    const m = await p.evaluate(() => [...document.querySelectorAll('[data-achei-selecionar]')].map((b) => { const w = b.parentElement; const a = w.querySelector('a[href^="/objeto/"]'); if (!a) return null; const rb = b.getBoundingClientRect(), ra = a.getBoundingClientRect(); return { mesmaLinha: Math.abs((rb.top + rb.height / 2) - (ra.top + ra.height / 2)) <= 2, gap: Math.round(ra.left - rb.right), abaixo: ra.top >= rb.bottom - 1, esquerdaIgual: Math.abs(ra.left - rb.left) <= 1, hb: Math.round(rb.height), ha: Math.round(ra.height) }; }).filter(Boolean));
    ok(`${L} /achei: «É este» + «Ver detalhes» (${m.length} cards): mesma linha com folga ≥ 12 px, ou o link desce alinhado à esquerda; toque ≥ 44 px`, m.length > 0 && m.every((x) => ((x.mesmaLinha && x.gap >= 12) || (x.abaixo && x.esquerdaIgual)) && x.hb >= 44 && x.ha >= 44), JSON.stringify(m[0]));
    if (W === 390) await p.locator('[data-achei-selecionar]').first().scrollIntoViewIfNeeded().then(() => p.screenshot({ path: '/tmp/claude-0/vis/f116-achei-390.png' }));
    await ctx.close(); }
}
console.log(`\n${fails === 0 ? 'TUDO OK' : fails + ' FALHA(S)'}`); await b.close(); process.exit(fails ? 1 : 0);
