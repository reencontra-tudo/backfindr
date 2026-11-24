const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const out = {};
  for (const [nb, port] of [['pr180', 3152]]) for (const [vpn, vp] of [['375', { width: 375, height: 812 }], ['1280', { width: 1280, height: 1000 }]]) {
    const ctx = await b.newContext({ viewport: vp }); const page = await ctx.newPage(); const erros = [];
    page.on('pageerror', e => erros.push(String(e).slice(0, 100)));
    page.on('console', m => { if (m.type() === 'error' && !/ERR_TUNNEL|ERR_FAILED|ERR_ABORTED/.test(m.text())) erros.push(m.text().slice(0, 100)); });
    await ctx.route(/mapbox|posthog|clarity|googletagmanager|facebook/, r => r.abort());
    await page.goto(`http://localhost:${port}/feed`, { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(3500);
    const o = { erros };
    const sel = page.locator('select').filter({ has: page.locator('option[value="pet"]') }).first();
    o.opcoes = await sel.locator('option').evaluateAll(os => os.map(x => x.textContent.trim()));
    o.cards = {};
    for (const v of ['pet', 'animal', 'phone', 'electronics']) if (await sel.locator(`option[value="${v}"]`).count()) { await sel.selectOption(v); await page.waitForTimeout(1800); o.cards[v] = await page.locator('article').count(); }
    await page.screenshot({ path: `/tmp/claude-0/-home-user/6258c76e-d9f1-5814-b4b2-307c5fd322e0/scratchpad/feed-${nb}-${vpn}.png` });
    const p2 = await ctx.newPage(); const e2 = [];
    p2.on('pageerror', e => e2.push(String(e).slice(0, 100)));
    const r = await p2.goto(`http://localhost:${port}/achei`, { waitUntil: 'domcontentloaded' }); await p2.waitForTimeout(2500);
    o.achei = { status: r.status(), erros: e2.length, texto: (await p2.locator('body').innerText()).replace(/\s+/g, ' ').slice(0, 80) };
    out[`${nb}/${vpn}`] = o; await ctx.close();
  }
  console.log(JSON.stringify(out, null, 1)); await b.close();
})();
