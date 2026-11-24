const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const out = {};
  for (const [nb, port] of [['base', 3151], ['novo', 3152]]) for (const [vpn, vp] of [['375', { width: 375, height: 812 }], ['1280', { width: 1280, height: 1000 }]]) {
    const ctx = await b.newContext({ viewport: vp }); const page = await ctx.newPage(); const erros = [];
    page.on('pageerror', e => erros.push(String(e).slice(0, 100)));
    await ctx.route(/mapbox|posthog|clarity|googletagmanager|facebook/, r => r.abort());
    await page.goto(`http://localhost:${port}/feed`, { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(3500);
    const o = { texto: (await page.locator('body').innerText()).replace(/\s+/g, ' '), erros };
    const sel = page.locator('select').filter({ has: page.locator('option[value="pet"]') }).first();
    o.opcoes = await sel.locator('option').evaluateAll(os => os.map(x => x.textContent.trim()));
    const contar = async () => await page.locator('article').count();
    o.cards = {};
    for (const v of ['pet', 'animal', 'phone', 'electronics']) { if (await sel.locator(`option[value="${v}"]`).count()) { await sel.selectOption(v); await page.waitForTimeout(1500); o.cards[v] = await contar(); } }
    out[`${nb}/${vpn}`] = o; await ctx.close();
  }
  console.log(JSON.stringify(Object.fromEntries(Object.entries(out).map(([k, v]) => [k, { opcoes: v.opcoes, cards: v.cards, erros: v.erros.length }])), null, 1));
  const a = out['base/1280'].texto.split(' '), n = out['novo/1280'].texto.split(' ');
  const set = new Set(a); console.log('palavras só no novo (sem filtro):', n.filter(x => !set.has(x)).slice(0, 10)); b.close();
})();
