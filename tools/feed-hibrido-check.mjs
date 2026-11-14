#!/usr/bin/env node
// Verificação de navegador do carregamento híbrido do Feed (Playwright, fora das dependências do projeto).
//   node tools/feed-hibrido-check.mjs <baseUrl> <pastaCapturas> [larguras, ex.: 390,1280]
// Precisa de um Feed com MUITOS cards (>= 60): use tests/fixtures/feed-grande-seed.sql (217 cards) num banco descartável.
// Só leitura (GET): rola de verdade, clica em «Ver mais» e confere o bloco de convite. Emula iPhone no Chromium (NÃO é o Safari).
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync, existsSync } from 'node:fs';
const { chromium } = createRequire(import.meta.url)('playwright');
const BASE = process.argv[2], OUT = process.argv[3] || '/tmp/feed-hibrido', WIDTHS = (process.argv[4] || '390,1280').split(',').map(Number);
mkdirSync(OUT, { recursive: true });
const PHOTO = existsSync('/tmp/claude-0/sample-photo.jpg') ? readFileSync('/tmp/claude-0/sample-photo.jpg') : null;
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
let fails = 0; const info = [];
const ok = (n, c, x = '') => { if (!c) fails++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}${x ? '  — ' + x : ''}`); };
const b = await chromium.launch();

const cards = (p) => p.evaluate(() => document.querySelectorAll('main article').length);
// «rolagem real»: leva a página ao fim e espera o carregamento automático (se houver); devolve quantas vezes foi preciso rolar
async function rolarAteEstabilizar(p, maxVezes = 40) {
  let vezes = 0, igual = 0, ult = await cards(p);
  while (vezes < maxVezes && igual < 3) {
    await p.evaluate(() => scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' })); vezes++;
    await p.waitForTimeout(700);
    const n = await cards(p); igual = n === ult ? igual + 1 : 0; ult = n;
  }
  return { vezes, cards: ult };
}

for (const W of WIDTHS) {
  const mobile = W < 1000; const L = `[${W}]`;
  const ctx = await b.newContext({ viewport: { width: W, height: mobile ? 844 : 800 }, deviceScaleFactor: 2, isMobile: mobile, hasTouch: mobile, userAgent: mobile ? UA : undefined });
  if (process.env.VIS) await ctx.addInitScript((v) => { try { localStorage.setItem('feed-visualizacao-v1', v); } catch { /* sem problema */ } }, process.env.VIS); // VIS=grade: abre na Grade
  const p = await ctx.newPage(); const eventos = [];
  await p.route(/localhost:3199|google|clarity|facebook|mapbox|ipapi/, (r) => r.abort());
  if (PHOTO) await p.route('https://pub-test.r2.dev/**', (r) => r.fulfill({ status: 200, contentType: 'image/jpeg', body: PHOTO }));
  p.on('request', (r) => { if (/\/api\/v1\/feed\?/.test(r.url())) eventos.push(r.url().replace(BASE, '')); });
  await p.goto(`${BASE}/feed`); await p.addStyleTag({ content: 'html{scroll-behavior:auto !important}' }); await p.waitForTimeout(2500);

  ok(`${L} abre com 12 cards, «Ver mais» real (link) e sem o bloco de convite`, (await cards(p)) === 12 && (await p.locator('a[href="/feed/pagina/2"]:has-text("Ver mais ocorrências")').count()) === 1 && (await p.locator('[data-feed-convite]').count()) === 0);
  // 1) rolagem real: o automático PARA no 3º lote (36 cards)
  const r1 = await rolarAteEstabilizar(p);
  ok(`${L} o carregamento automático PARA no 3º lote: 36 cards (12 do HTML + 2 lotes automáticos)`, r1.cards === 36, `cards=${r1.cards}, rolou ${r1.vezes}x`);
  await p.waitForTimeout(3000); for (let i = 0; i < 3; i++) { await p.evaluate(() => scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' })); await p.waitForTimeout(600); }
  ok(`${L} continua em 36 depois de rolar mais 3 vezes e esperar 3 s (não carrega sozinho)`, (await cards(p)) === 36, `cards=${await cards(p)}`);
  const lotes = eventos.length; info.push(`${L} pedidos ao /api/v1/feed pelo carregamento automático: ${lotes}`);
  ok(`${L} exatamente 2 pedidos automáticos ao /api/v1/feed`, lotes === 2, String(lotes));
  // 2) botão e bloco de convite visíveis sem rolar 18 vezes
  const botao = p.locator('a:has-text("Ver mais ocorrências")');
  ok(`${L} aparece o botão «Ver mais ocorrências» (link real para /feed/pagina/2)`, (await botao.isVisible()) && (await botao.getAttribute('href')) === '/feed/pagina/2');
  const convite = p.locator('aside[data-feed-convite]');
  ok(`${L} o bloco «Não encontrou o que procurava?» aparece, abaixo do botão, 1 vez`, (await convite.count()) === 1 && (await convite.locator('h2').textContent()) === 'Não encontrou o que procurava?' && await p.evaluate(() => { const b = [...document.querySelectorAll('a')].find((a) => /Ver mais ocorrências/.test(a.textContent)); const c = document.querySelector('aside[data-feed-convite]'); return !!(b && c && (b.compareDocumentPosition(c) & Node.DOCUMENT_POSITION_FOLLOWING)); }));
  ok(`${L} alcançável com ${r1.vezes} rolagens até o fim (antes seriam ~18 lotes)`, r1.vezes <= 8, `${r1.vezes} rolagens`);
  const hrefs = await convite.locator('a').evaluateAll((a) => a.map((x) => [x.textContent.trim(), x.getAttribute('href')]));
  ok(`${L} convite: «Perdi algo» → /flow/lost?ref=feed e «Encontrei algo» → /flow/found?ref=feed`, JSON.stringify(hrefs) === JSON.stringify([['Perdi algo', '/flow/lost?ref=feed'], ['Encontrei algo', '/flow/found?ref=feed']]), JSON.stringify(hrefs));
  const textoConvite = await convite.innerText();
  ok(`${L} convite sem contato protegido, segurança, SMS nem «gratuito»`, !/seguran|protegid|SMS|gratuit|gr[aá]tis|contato|expor/i.test(textoConvite), textoConvite.replace(/\s+/g, ' '));
  const altBtn = await convite.locator('a').evaluateAll((a) => a.map((x) => x.getBoundingClientRect().height));
  ok(`${L} botões do convite com ≥ 44 px`, altBtn.every((h) => h >= 43.5), altBtn.map(Math.round).join(','));
  ok(`${L} sem rolagem horizontal`, await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  if (W === 390) { await botao.evaluate((e) => e.scrollIntoView({ block: 'center', behavior: 'instant' })); await p.waitForTimeout(500); await p.screenshot({ path: `${OUT}/ver-mais-e-convite-390.png` }); }
  // 3) «Ver mais» carrega mais 12 por clique, pelo mesmo caminho
  const antes = lotes;
  await botao.click(); await p.waitForTimeout(1200);
  ok(`${L} clique em «Ver mais»: +12 cards (48), 1 pedido ao /api/v1/feed`, (await cards(p)) === 48 && eventos.length === antes + 1, `cards=${await cards(p)} pedidos=${eventos.length - antes}`);
  await p.locator('a:has-text("Ver mais ocorrências")').click(); await p.waitForTimeout(1200);
  ok(`${L} segundo clique: 60 cards, e o automático NÃO volta (sem pedidos extras ao rolar)`, (await cards(p)) === 60, `cards=${await cards(p)}`);
  await p.evaluate(() => scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' })); await p.waitForTimeout(2500);
  ok(`${L} depois de rolar até o fim de novo continuam 60 e o convite segue abaixo do botão`, (await cards(p)) === 60 && (await p.locator('aside[data-feed-convite]').count()) === 1);
  // 4) «Informar que encontrei»: só em perdido de usuário (HTML e lista carregada)
  const regras = await p.evaluate(() => [...document.querySelectorAll('main article')].map((a) => ({ rot: (a.querySelector('p span.font-semibold, span.absolute.rounded-full')?.textContent || '').trim(), orig: a.dataset.origin, inf: !![...a.querySelectorAll('a')].find((x) => /Informar que encontrei/.test(x.textContent)), ver: !![...a.querySelectorAll('a')].find((x) => x.textContent.trim() === 'Ver detalhes' || (x.getAttribute('aria-label') || '').startsWith('Ver detalhes: ')), comp: !![...a.querySelectorAll('button')].find((x) => /Compartilhar/.test(x.textContent)) })));
  const roubados = regras.filter((c) => c.rot === 'Roubado'), perdidosUsuario = regras.filter((c) => c.rot === 'Perdido' && c.orig === 'usuario');
  ok(`${L} nenhum card «Roubado» tem «Informar que encontrei» (${roubados.length} cards roubados na lista de 60)`, roubados.length > 0 && roubados.every((c) => !c.inf), `com botão: ${roubados.filter((c) => c.inf).length}`);
  ok(`${L} cards «Perdido» de usuário TÊM o botão (${perdidosUsuario.length})`, perdidosUsuario.length > 0 && perdidosUsuario.every((c) => c.inf));
  ok(`${L} achados e sinais públicos continuam sem o botão`, regras.filter((c) => c.rot === 'Achado' || c.orig === 'sinal_publico').every((c) => !c.inf));
  ok(`${L} «Ver detalhes» e «Compartilhar» em TODOS os cards, inclusive roubado`, regras.every((c) => c.ver && c.comp));
  // 5) chat e botão fixo (só no celular): o chat nunca cobre uma ação; o botão fixo nunca cobre texto/botão
  if (mobile) {
    const chat = await p.evaluate(async () => {
      const c = document.querySelector('button[aria-label="Abrir assistente"]'); if (!c) return { achou: false };
      const acao = (e) => /^(Ver detalhes|.*Compartilhar|Informar que encontrei|Ver mais ocorrências|Perdi algo|Encontrei algo)$/.test(e.textContent.trim().replace(/\s+/g, ' '));
      let col = 0, passos = 0; const alt = document.documentElement.scrollHeight - innerHeight;
      for (let y = 0; y <= alt; y += 40) { scrollTo({ top: y, behavior: 'instant' }); await new Promise((r) => requestAnimationFrame(() => r())); passos++; const q = c.getBoundingClientRect();
        for (const e of document.querySelectorAll('main a, main button')) { if (!acao(e)) continue; const r = e.getBoundingClientRect(); if (r.width && !(r.right <= q.left || q.right <= r.left || r.bottom <= q.top || q.bottom <= r.top)) col++; } }
      scrollTo({ top: 0, behavior: 'instant' }); return { achou: true, col, passos };
    });
    ok(`${L} o balão do chat NUNCA cobre uma ação (cards, «Ver mais», convite) em ${chat.passos} posições da rolagem`, chat.achou && chat.col === 0, `colisões=${chat.col}`);
  }
  await ctx.close();
}

// 6) sem JavaScript: 12 cards no HTML e «Ver mais» funciona como link real (vai para /feed/pagina/2 com os próximos 12)
{
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, javaScriptEnabled: false });
  const p = await ctx.newPage(); await p.goto(`${BASE}/feed`);
  ok('[sem JS] /feed traz 12 cards e o link «Ver mais», sem o bloco de convite', (await cards(p)) === 12 && (await p.locator('aside[data-feed-convite]').count()) === 0);
  await p.click('a:has-text("Ver mais ocorrências")'); await p.waitForURL('**/feed/pagina/2');
  ok('[sem JS] «Ver mais» leva a /feed/pagina/2 com 12 cards (e link para a página 3)', (await cards(p)) === 12 && (await p.locator('a[href="/feed/pagina/3"]').count()) === 1, p.url().replace(BASE, ''));
  await ctx.close();
}
await b.close();
console.log('\n' + info.join('\n'));
console.log(fails ? `\n${fails} VERIFICAÇÃO(ÕES) FALHOU/FALHARAM` : '\nTodas as verificações de navegador passaram');
process.exit(fails ? 1 : 0);
