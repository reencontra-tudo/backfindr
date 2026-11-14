#!/usr/bin/env node
// Verificação de navegador: endereço público só com bairro e cidade, «Ver detalhes» nos resultados do /achei e as duas frases.
//   node tools/endereco-achei-check.mjs <baseUrl>
// Feed grande de teste (tests/fixtures/feed-grande-seed.sql). Só leitura (GET). Chromium emulando (NÃO é Safari/iPhone/Android reais).
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
const BASE = process.argv[2];
let fails = 0; const ok = (n, c, x = '') => { if (!c) fails++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}${x !== '' ? '  — ' + x : ''}`); };
const b = await chromium.launch();
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const RUA = /\b(Travessa|Rua|Avenida|Av\.)\b|\b\d{5}-?\d{3}\b|Cruzeiro 39|Paulista 1000/;
async function abrir(W) {
  const ctx = await b.newContext({ viewport: { width: W, height: W < 1000 ? 844 : 800 }, isMobile: W < 1000, hasTouch: W < 1000, userAgent: W < 1000 ? UA : undefined });
  await ctx.route(/localhost:3199|google|clarity|facebook|mapbox|ipapi|posthog/, (r) => r.abort());
  await ctx.route(/^https:\/\/pub-[a-z0-9]+\.r2\.dev\//, (r) => r.fulfill({ status: 200, contentType: 'image/png', body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64') }));
  return { ctx, p: await ctx.newPage() };
}
const buscar = async (p, q) => { await p.locator('input[type=text]').fill(q); await p.getByRole('button', { name: /Ver se o dono/ }).click(); await p.waitForTimeout(2500); };
for (const W of [390, 1280]) {
  const L = `[${W}]`;
  { const { ctx, p } = await abrir(W); await p.goto(`${BASE}/achei`); await p.waitForSelector('h1'); await buscar(p, 'carteira marrom');
    const cards = await p.evaluate(() => [...document.querySelectorAll('div.space-y-3 h3')].map((h) => { const c = h.closest('div.flex-1'); return { titulo: h.textContent.trim(), local: c.querySelector('p.text-white\\/30')?.textContent.trim() ?? null, link: c.querySelector('a[href^="/objeto/"]')?.getAttribute('href') ?? null }; }));
    ok(`${L} /achei: resultados trazem «Ver detalhes» levando a /objeto/<código>`, cards.length > 0 && cards.every((c) => c.link && /^\/objeto\/[A-Za-z0-9_%-]+$/.test(c.link)), `${cards.length} cards; ex.: ${cards[0]?.link}`);
    ok(`${L} /achei: nenhum endereço de resultado mostra logradouro, número ou CEP`, cards.every((c) => !c.local || !RUA.test(c.local)), JSON.stringify(cards.map((c) => c.local).filter(Boolean).slice(0, 3)));
    ok(`${L} /achei: o cadastro com rua, número e CEP aparece só como «Vila Modelo, Guarulhos - SP»`, cards.some((c) => c.titulo.includes('marrom') && c.local === 'Vila Modelo, Guarulhos - SP'), JSON.stringify(cards.map((c) => c.local)));
    const alvo = cards.find((c) => c.link && c.titulo.includes('marrom')) ?? cards.find((c) => c.link);
    await p.locator(`a[href="${alvo.link}"]`).first().click(); await p.waitForURL(/\/objeto\//, { timeout: 20000 });
    ok(`${L} «Ver detalhes» abre ${alvo.link}`, new URL(p.url()).pathname === alvo.link, p.url().replace(BASE, ''));
    const t = await p.locator('body').innerText();
    ok(`${L} /objeto (tela): sem logradouro, número nem CEP`, !RUA.test(t), '');
    await ctx.close(); }
  // foto abre o ampliador e «É este» não é afetado
  { const { ctx, p } = await abrir(W); await p.goto(`${BASE}/achei?ref=feed&de=USR00001`); await p.waitForSelector('[data-achei-contexto]', { timeout: 20000 }).catch(() => {});
    await p.goto(`${BASE}/achei?ref=feed&de=USR00002`); await p.locator('[data-achei-contexto]').waitFor({ timeout: 20000 }); await buscar(p, 'carteira marrom');
    const btn = await p.locator('[data-achei-selecionar]').count();
    ok(`${L} «É este» continua (botões nos resultados elegíveis)`, btn >= 1, `${btn}`);
    const antes = await p.evaluate(() => document.querySelectorAll('.fixed.inset-0').length);
    const img = p.locator('img.cursor-zoom-in').first();
    if (await img.count()) { await img.click(); await p.waitForTimeout(800); const depois = await p.evaluate(() => document.querySelectorAll('.fixed.inset-0').length); ok(`${L} tocar na foto continua abrindo o ampliador`, depois > antes, `${antes}→${depois}`); }
    else console.log(`INFO  ${L} nenhum resultado com foto nesta busca (ampliador conferido no código)`);
    await ctx.close(); }
  // resultado vazio
  { const { ctx, p } = await abrir(W); await p.goto(`${BASE}/achei`); await p.waitForSelector('h1'); await buscar(p, 'zzzqqqxxx');
    const t = await p.locator('body').innerText();
    ok(`${L} resultado vazio: sem «a gente conecta vocês»; texto novo presente`, !/a gente conecta|conecta vocês/i.test(t) && /Crie uma conta gratuita para registrar o que você encontrou\./.test(t), t.includes('Nenhum dono') ? 'bloco vazio exibido' : 'bloco vazio NÃO exibido');
    await ctx.close(); }
  // /buscar
  { const { ctx, p } = await abrir(W); await p.goto(`${BASE}/buscar`); await p.waitForSelector('h1', { timeout: 20000 }); await p.waitForTimeout(500);
    const inp = p.locator('input[type=text], input[type=search]').first(); await inp.fill('carteira'); await inp.press('Enter'); await p.waitForTimeout(3000);
    const t = await p.locator('body').innerText();
    ok(`${L} /buscar: sem logradouro, número nem CEP nos resultados`, !RUA.test(t), '');
    await ctx.close(); }
  // Feed: bloco depois do 3º card
  { const { ctx, p } = await abrir(W); await p.goto(`${BASE}/feed`); await p.waitForSelector('aside[data-feed-about]', { timeout: 25000 });
    const bloco = (await p.locator('aside[data-feed-about]').innerText()).replace(/\s+/g, ' ');
    ok(`${L} /feed: bloco sem «mais recentes», com «recorte» e «histórico está no mapa», link «Ver no mapa» mantido`, !/mais recentes/.test(bloco) && /A lista é um recorte das ocorrências de objetos, documentos e pets perdidos, achados ou roubados; o histórico está no mapa\./.test(bloco) && (await p.locator('aside[data-feed-about] a[href="/map"]').count()) === 1, bloco.slice(0, 120));
    const pos = await p.evaluate(() => { const a = [...document.querySelectorAll('main article')]; const i = document.querySelector('aside[data-feed-about]'); return a.indexOf(a.find((x) => i.compareDocumentPosition(x) & Node.DOCUMENT_POSITION_FOLLOWING)) ; });
    ok(`${L} /feed: o bloco continua depois do 3º card`, pos === 3, `${pos}`);
    await ctx.close(); }
}
await b.close();
console.log(fails ? `\n${fails} VERIFICAÇÃO(ÕES) FALHOU/FALHARAM` : '\nTUDO CERTO'); process.exit(fails ? 1 : 0);
