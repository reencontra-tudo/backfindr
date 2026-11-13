// Medição do acabamento mobile do Feed (Playwright, fora das dependências do projeto).
//   node tools/feed-mobile-check.mjs <baseUrl> <rótulo> <pastaCapturas> [larguras separadas por vírgula, ex.: 320,360,390,430,1280]
// Só leitura (GET). Emula iPhone no Chromium (tela, toque, UA); NÃO testa o Safari/WebKit de verdade nem a área segura real do iPhone.
// Mede: texto dos botões sem quebra, alvos de 44 px, ícone de compartilhar, balão do chat nunca sobre uma ação de card (rolagem inteira),
// botão fixo que não cobre texto/botão ao parar de rolar, bloco explicativo (1 vez) e rolagem horizontal. Gera capturas de tela.
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync, existsSync } from 'node:fs';
const { chromium } = createRequire(import.meta.url)('playwright');
const BASE = process.argv[2], TAG = process.argv[3], OUT = process.argv[4];
const WIDTHS = (process.argv[5] || '320,360,390,430,1280').split(',').map(Number);
mkdirSync(OUT, { recursive: true });
const PHOTO = existsSync('/tmp/claude-0/sample-photo.jpg') ? readFileSync('/tmp/claude-0/sample-photo.jpg') : null;
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
let fails = 0; const info = [];
const ok = (n, c, x = '') => { if (!c) fails++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}${x ? '  — ' + x : ''}`); };
const browser = await chromium.launch();

for (const W of WIDTHS) {
  const mobile = W < 1000; const H = mobile ? 844 : 800;
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2, isMobile: mobile, hasTouch: mobile, userAgent: mobile ? UA : undefined });
  const p = await ctx.newPage();
  await p.route(/localhost:3199|google|clarity|facebook|mapbox|ipapi/, (r) => r.abort());
  if (PHOTO) await p.route('https://pub-test.r2.dev/**', (r) => r.fulfill({ status: 200, contentType: 'image/jpeg', body: PHOTO }));
  await p.goto(`${BASE}/feed`); await p.addStyleTag({ content: 'html{scroll-behavior:auto !important}' }); await p.waitForTimeout(2500); // só no teste: sem animação de rolagem programática
  const L = `[${W}]`;

  // ---------- A) ações dos cards ----------
  const cards = await p.evaluate(() => {
    const R = (e) => { const r = e.getBoundingClientRect(); return { l: r.left, r: r.right, t: r.top + scrollY, b: r.bottom + scrollY, w: r.width, h: r.height }; };
    const linhas = (e) => { const ys = new Set(); const w = document.createTreeWalker(e, NodeFilter.SHOW_TEXT); let n; while ((n = w.nextNode())) { if (!n.textContent.trim()) continue; const rg = document.createRange(); rg.selectNodeContents(n); for (const q of rg.getClientRects()) if (q.width > 2) ys.add(Math.round(q.top / 6)); } return ys.size; };
    return [...document.querySelectorAll('main article')].map((a) => {
      const ver = [...a.querySelectorAll('a')].find((x) => x.textContent.trim() === 'Ver detalhes');
      const sh = [...a.querySelectorAll('button')].find((x) => /Compartilhar/.test(x.textContent));
      const inf = [...a.querySelectorAll('a')].find((x) => /Informar que encontrei/.test(x.textContent));
      const svg = sh?.querySelector('svg');
      return { foto: a.dataset.photo, ver: ver && R(ver), sh: sh && R(sh), inf: inf && R(inf), infLinhas: inf ? linhas(inf) : 0, shLinhas: sh ? linhas(sh) : 0, verLinhas: ver ? linhas(ver) : 0, svg: svg && { w: svg.getBoundingClientRect().width, h: svg.getBoundingClientRect().height } };
    });
  });
  const comInf = cards.filter((c) => c.inf);
  ok(`${L} ${TAG}: texto de «Informar que encontrei» em UMA linha em todos os cards (${comInf.length} cards com o botão)`, comInf.length > 0 && comInf.every((c) => c.infLinhas === 1), `linhas: ${[...new Set(comInf.map((c) => c.infLinhas))].join(',')}`);
  ok(`${L} ${TAG}: «Ver detalhes» e «Compartilhar» sem quebra de linha`, cards.every((c) => c.verLinhas === 1 && c.shLinhas === 1), `ver=${[...new Set(cards.map((c) => c.verLinhas))]} share=${[...new Set(cards.map((c) => c.shLinhas))]}`);
  ok(`${L} ${TAG}: alvos de toque ≥ 44 px (altura de todas as ações)`, cards.every((c) => c.ver.h >= 43.5 && c.sh.h >= 43.5 && (!c.inf || c.inf.h >= 43.5)), `min altura=${Math.round(Math.min(...cards.flatMap((c) => [c.ver.h, c.sh.h, c.inf?.h ?? 99])))}`);
  ok(`${L} ${TAG}: ícone de compartilhar legível (≥ 16 px)`, cards.every((c) => c.svg && c.svg.w >= 16 && c.svg.h >= 16), `ícone=${[...new Set(cards.map((c) => c.svg ? Math.round(c.svg.w) + 'x' + Math.round(c.svg.h) : 'sem'))].join(',')}`);
  // a página carrega mais cards ao chegar perto do fim (rolagem infinita): carrega tudo antes de medir o resto
  await p.evaluate(async () => { let h = 0; for (let i = 0; i < 12; i++) { scrollTo(0, document.documentElement.scrollHeight); await new Promise((r) => setTimeout(r, 450)); const n = document.documentElement.scrollHeight; if (n === h) break; h = n; } scrollTo(0, 0); });
  await p.waitForTimeout(500);
  if (mobile) {
    ok(`${L} ${TAG}: duas linhas: «Ver detalhes»+«Compartilhar» na 1ª, «Informar que encontrei» na 2ª`, comInf.length > 0 && comInf.every((c) => Math.abs(c.ver.t - c.sh.t) < 6 && c.inf.t >= c.ver.b - 2), `exemplo: ver.t=${Math.round(comInf[0].ver.t)} share.t=${Math.round(comInf[0].sh.t)} inf.t=${Math.round(comInf[0].inf.t)}`);
    // zona do chat: medida real do botão
    const chat = await p.evaluate(() => { const c = document.querySelector('button[aria-label="Abrir assistente"]'); if (!c) return null; const r = c.getBoundingClientRect(); return { l: r.left, r: r.right, t: r.top, b: r.bottom, w: r.width, h: r.height }; });
    info.push(`${L} ${TAG}: balão do chat ${chat ? `${Math.round(chat.w)}x${Math.round(chat.h)} em x=${Math.round(chat.l)}..${Math.round(chat.r)}, y=${Math.round(chat.t)}..${Math.round(chat.b)}` : 'NÃO ENCONTRADO'}`);
    ok(`${L} ${TAG}: balão do chat encontrado na página`, !!chat);
    const direita = Math.max(...cards.flatMap((c) => [c.ver.r, c.sh.r, c.inf?.r ?? 0]));
    info.push(`${L} ${TAG}: borda direita mais à direita das ações dos cards = ${Math.round(direita)} px (zona do chat começa em ${chat ? Math.round(chat.l) : '?'})`);
    ok(`${L} ${TAG}: nenhuma ação de card chega à zona horizontal do chat (margem direita reservada)`, chat && direita <= chat.l - 4, `borda direita ${Math.round(direita)} ≤ ${chat ? Math.round(chat.l - 4) : '?'}`);

    // ---------- B) rolagem completa: balão x ações ----------
    const sweep = await p.evaluate(async () => {
      const chatEl = document.querySelector('button[aria-label="Abrir assistente"]');
      const acao = (e) => /^(Ver detalhes|.*Compartilhar|Informar que encontrei)$/.test(e.textContent.trim().replace(/\s+/g, ' '));
      let colisoes = 0, passos = 0; const exemplos = [];
      const alt = document.documentElement.scrollHeight - innerHeight;
      for (let y = 0; y <= alt; y += 30) {
        scrollTo(0, y); await new Promise((r) => requestAnimationFrame(() => r()));
        passos++;
        const c = chatEl.getBoundingClientRect();
        for (const e of document.querySelectorAll('main article a, main article button')) {
          if (!acao(e)) continue;
          const r = e.getBoundingClientRect();
          if (r.width && !(r.right <= c.left || c.right <= r.left || r.bottom <= c.top || c.bottom <= r.top)) { colisoes++; if (exemplos.length < 2) exemplos.push(e.textContent.trim().slice(0, 22) + '@' + y); }
        }
      }
      scrollTo(0, 0);
      return { colisoes, passos, exemplos };
    });
    ok(`${L} ${TAG}: balão do chat NUNCA cobre uma ação de card durante a rolagem inteira (${sweep.passos} posições)`, sweep.colisoes === 0, `colisões=${sweep.colisoes} ${sweep.exemplos.join('; ')}`);
  }
  ok(`${L} ${TAG}: sem rolagem horizontal`, await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth));

  // ---------- C) botão fixo: parando em muitas posições (descendo e subindo) ----------
  if (mobile) {
    const sondar = async (sentido) => p.evaluate(async (sentido) => {
      const fab = document.querySelector('[data-feed-register="fixed"]');
      const ok1 = (e) => { const s = getComputedStyle(e); return s.visibility !== 'hidden' && s.display !== 'none'; };
      // retângulos TIGHT de texto (Range) e caixas de botões/links, dentro de <main>, fora do próprio botão fixo
      const protegidos = () => {
        const out = [];
        for (const e of document.querySelectorAll('main h1, main h2, main h3, main p, main time, main label, main a, main button, main select')) {
          if (fab.contains(e) || !ok1(e)) continue;
          const bx = e.getBoundingClientRect(); if (bx.bottom < 0 || bx.top > innerHeight || !bx.width) continue;
          if (e.matches('a, button, select')) { out.push({ t: e.textContent.trim().slice(0, 24) || e.tagName, r: bx }); continue; }
          const rg = document.createRange(); rg.selectNodeContents(e);
          for (const q of rg.getClientRects()) if (q.width > 2 && q.height > 2) out.push({ t: (e.textContent || '').trim().slice(0, 24), r: q });
        }
        return out;
      };
      const alt = document.documentElement.scrollHeight - innerHeight;
      const pos = []; for (let y = 0; y <= alt; y += 70) pos.push(y); pos.push(alt);
      const seq = sentido === 'sobe' ? [...pos].reverse() : pos;
      let visiveis = 0, cobre = 0, total = 0; const ex = [];
      // chegar à ponta primeiro (descendo) para a regra «esconde ao descer / mostra ao subir» valer
      scrollTo(0, sentido === 'sobe' ? alt : 0); await new Promise((r) => setTimeout(r, 400));
      for (const y of seq) {
        scrollTo(0, y); await new Promise((r) => setTimeout(r, 520));
        total++;
        const btn = fab.querySelector('button'); const wr = fab.getBoundingClientRect(); const b = btn.getBoundingClientRect();
        const noVP = wr.top < innerHeight - 2 && wr.bottom > 0 && getComputedStyle(fab).transform !== 'none' ? wr.top < innerHeight - 10 : wr.top < innerHeight - 10;
        const tr = getComputedStyle(fab).transform; const ty = tr === 'none' ? 0 : parseFloat(tr.split(',')[5]);
        const visivel = fab.getAttribute('data-recolhido') !== 'true' && fab.getAttribute('data-sobreposto') !== 'true' && Math.abs(ty) < 1 && b.top < innerHeight - 10 && b.bottom > 0;
        if (!visivel) continue;
        visiveis++;
        const m = 2; // sobreposição real (px)
        const hit = protegidos().find((q) => !(q.r.right <= b.left + m || b.right - m <= q.r.left || q.r.bottom <= b.top + m || b.bottom - m <= q.r.top));
        if (hit) { cobre++; if (ex.length < 3) ex.push(`${hit.t}@${y}`); }
      }
      scrollTo(0, 0);
      return { total, visiveis, cobre, ex };
    }, sentido);
    const sobe = await sondar('sobe');
    info.push(`${L} ${TAG}: botão fixo ao PARAR depois de rolar para cima: visível em ${sobe.visiveis} de ${sobe.total} posições (${Math.round(100 * sobe.visiveis / sobe.total)}%); cobrindo texto/botão em ${sobe.cobre}`);
    ok(`${L} ${TAG}: botão fixo, quando visível ao parar de rolar para cima, NÃO cobre texto nem botão (${sobe.visiveis} posições visíveis de ${sobe.total})`, sobe.cobre === 0, `cobre=${sobe.cobre} ${sobe.ex.join('; ')}`);
    const desce = await sondar('desce');
    info.push(`${L} ${TAG}: botão fixo ao parar depois de rolar para baixo: visível em ${desce.visiveis} de ${desce.total}; cobrindo em ${desce.cobre}`);
    ok(`${L} ${TAG}: botão fixo continua escondido ao rolar para baixo (regra mantida), e quando aparece não cobre nada`, desce.cobre === 0, `visível em ${desce.visiveis}/${desce.total}`);
  }

  if (mobile) {
    // topo e fim da página: o botão deve estar visível e livre (estado estável)
    const estado = async (y) => p.evaluate(async (y) => {
      const fab = document.querySelector('[data-feed-register="fixed"]'); const btn = fab.querySelector('button');
      const leitura = () => { const tr = getComputedStyle(fab).transform; const ty = tr === 'none' ? 0 : parseFloat(tr.split(',')[5]); const b = btn.getBoundingClientRect();
        return { visivel: fab.dataset.recolhido !== 'true' && Math.abs(ty) < 1, cabe: b.bottom <= innerHeight && b.top >= 0, sobre: fab.dataset.sobreposto }; };
      const t0 = performance.now(); let ult = leitura();
      for (let i = 0; i < 20; i++) { // até ~3 s, mexendo a página até o fim real (a lista carrega mais cards ao chegar perto)
        scrollTo(0, y === 'fim' ? document.documentElement.scrollHeight : 0); await new Promise((r) => setTimeout(r, 150));
        ult = leitura(); if (ult.visivel && ult.cabe) break;
      }
      return { ...ult, apareceuEmMs: Math.round(performance.now() - t0) };
    }, y);
    const topo = await estado('topo'); const fim = await estado('fim');
    info.push(`${L} ${TAG}: botão fixo no topo: ${JSON.stringify(topo)}; no fim da página: ${JSON.stringify(fim)}`);
    ok(`${L} ${TAG}: no FIM da página o botão fixo aparece, dentro da tela, sobre o espaço reservado`, fim.visivel && fim.cabe && fim.sobre === 'false', JSON.stringify(fim));
    await p.evaluate(() => scrollTo(0, 0)); await p.waitForTimeout(300);
  }

  // ---------- D) bloco explicativo ----------
  const sobre = await p.evaluate(() => { const a = [...document.querySelectorAll('main article')], b = document.querySelectorAll('aside[data-feed-about]'); const antes = a.filter((x) => b[0] && (x.compareDocumentPosition(b[0]) & Node.DOCUMENT_POSITION_FOLLOWING)).length; return { n: b.length, antes, titulo: b[0]?.querySelector('h2')?.textContent }; });
  ok(`${L} ${TAG}: bloco explicativo aparece 1 vez, depois do 3º card, com o título certo`, sobre.n === 1 && sobre.antes === 3 && sobre.titulo === 'O Backfindr vai além das publicações', JSON.stringify(sobre));
  await p.goto(`${BASE}/feed/pagina/2`); await p.waitForTimeout(800);
  ok(`${L} ${TAG}: /feed/pagina/2 sem o bloco explicativo`, (await p.locator('aside[data-feed-about]').count()) === 0);
  await p.goto(`${BASE}/feed`); await p.waitForTimeout(2000);

  // ---------- E) capturas ----------
  if (W === 360 || W === 390) {
    const foto = p.locator('main article[data-photo="sim"]').first(), semFoto = p.locator('main article[data-photo="nao"]').first();
    const mostrar = async (loc, arquivo, alinhar = 'end') => {
      await loc.evaluate((el, alinhar) => { const r = el.getBoundingClientRect(); const alvo = alinhar === 'end' ? r.bottom + scrollY - innerHeight + 24 : r.top + scrollY - 90; scrollTo(0, Math.max(0, alvo)); }, alinhar);
      await p.waitForTimeout(700); await p.screenshot({ path: `${OUT}/${TAG}-${arquivo}-${W}.png` });
    };
    await mostrar(foto, 'card-com-foto-acoes', 'end');
    await mostrar(semFoto, 'card-sem-foto-acoes', 'end');
    await mostrar(p.locator('aside[data-feed-about]').first(), 'bloco-explicativo', 'top');
    // botão fixo: sobe um pouco e para
    await p.evaluate(() => { scrollTo(0, scrollY + 500); }); await p.waitForTimeout(500); await p.evaluate(() => { scrollTo(0, scrollY - 140); }); await p.waitForTimeout(700);
    await p.screenshot({ path: `${OUT}/${TAG}-botao-fixo-${W}.png` });
    await p.evaluate(() => scrollTo(0, 0)); await p.waitForTimeout(400);
    await p.screenshot({ path: `${OUT}/${TAG}-topo-${W}.png` });
  }
  await ctx.close();
}
await browser.close();
console.log('\n' + info.join('\n'));
console.log(fails ? `\n${fails} VERIFICAÇÃO(ÕES) FALHOU/FALHARAM` : '\nTudo certo');
process.exit(fails ? 1 : 0);
