const { chromium } = require('playwright'); const fs = require('fs');
const dados = { atual: fs.readFileSync('/tmp/map_prod.json', 'utf8'), pos_migracao: fs.readFileSync('/tmp/map_pos_migracao.json', 'utf8') };
(async () => {
  const b = await chromium.launch(); const res = {};
  for (const [nomeBuild, port] of [['ANTES (main)', 3111], ['DEPOIS (PR)', 3112]]) for (const [nomeDados, corpo] of Object.entries(dados)) {
    const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
    await ctx.route('**/api/v1/objects/map', r => r.fulfill({ status: 200, contentType: 'application/json', body: corpo }));
    await ctx.route(/mapbox|posthog|clarity|googletagmanager|facebook/, r => r.abort());
    const page = await ctx.newPage(); const erros = []; page.on('pageerror', e => erros.push(String(e).slice(0, 100)));
    await page.goto(`http://localhost:${port}/map`, { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(3000);
    const cont = async () => ((await page.locator('body').innerText()).replace(/\s+/g, ' ').match(/(\d[\d.]*) objetos?/) || [])[1];
    const o = { sem_filtro: await cont() };
    await page.getByRole('button', { name: /Filtros/ }).first().click(); await page.waitForTimeout(500);
    const sel = page.locator('select').filter({ has: page.locator('option[value="pet"]') }).first();
    const opcoes = await sel.locator('option').evaluateAll(os => os.map(x => [x.value, x.textContent]));
    o.opcoes = opcoes.map(x => x[1]).join(' | ');
    for (const [v, t] of opcoes) { if (!v) continue; await sel.selectOption(v); await page.waitForTimeout(400); o[t.replace(/^\S+\s/, '')] = await cont(); }
    await sel.selectOption('animal').catch(() => {}); 
    o.erros = erros; res[`${nomeBuild} / dados ${nomeDados}`] = o; await ctx.close();
  }
  console.log(JSON.stringify(res, null, 1)); await b.close();
})();
