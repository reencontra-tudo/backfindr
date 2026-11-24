const { chromium } = require('playwright'); const fs = require('fs');
const BUILDS = { base: { port: 3131, pet: 'Pet' }, novo: { port: 3132, pet: 'Pet' } };
const CATS = ['Pet', 'Animal', 'Celular', 'Carteira', 'Chaves', 'Bolsa / Mochila', 'Bicicleta', 'Veículo', 'Documento', 'Joia / Relógio', 'Eletrônico', 'Outro'];
const user = { id: '0', name: 'T', email: 't@example.invalid', plan: 'free', role: 'user', created_at: '2026-01-01T00:00:00Z' };
(async () => {
  const b = await chromium.launch(); const out = {};
  for (const [nb, cfg] of Object.entries(BUILDS)) for (const [vpn, vp] of [['375', { width: 375, height: 812 }], ['1280', { width: 1280, height: 1400 }]]) for (const label of CATS) {
    const ctx = await b.newContext({ viewport: vp }); const posts = [];
    await ctx.addCookies([{ name: 'access_token', value: 'fake', url: `http://localhost:${cfg.port}` }]);
    await ctx.addInitScript(([u]) => { try { localStorage.setItem('backfindr-auth', JSON.stringify({ state: { user: u, isAuthenticated: true }, version: 0 })); } catch {} }, [user]);
    await ctx.route(/mapbox|posthog|clarity|googletagmanager|facebook/, r => r.abort());
    await ctx.route('**/api/v1/**', r => { const q = r.request(), u = q.url();
      if (q.method() === 'POST' && /\/api\/v1\/objects$/.test(u)) { posts.push(JSON.parse(q.postData() || '{}')); return r.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ id: 'teste', data: { id: 'teste' } }) }); }
      return u.includes('/auth/me') ? r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(user) }) : r.fulfill({ status: 200, contentType: 'application/json', body: '{"data":{"total":0,"objects":[],"matches":[]},"total":0,"items":[]}' }); });
    const page = await ctx.newPage(); const erros = []; page.on('pageerror', e => erros.push(String(e).slice(0, 100)));
    await page.goto(`http://localhost:${cfg.port}/dashboard/objects/new?intent=lost`, { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(2500);
    await page.locator('button').filter({ has: page.getByText(label, { exact: true }) }).first().click(); await page.waitForTimeout(500);
    const abre = page.getByRole('button', { name: /Adicionar detalhes adicionais/ }); if (await abre.count()) { await abre.first().click(); await page.waitForTimeout(300); }
    const o = {};
    o.detalhes = (await page.locator('body').innerText()).replace(/\s+/g, ' ').replace(/^.*?Passo \d de 4/, 'Passo');
    const ctrls = page.locator('form input:visible, form select:visible, form textarea:visible'); const total = await ctrls.count(); o.controles = total;
    for (let i = 0; i < total; i++) {
      const c = ctrls.nth(i); const tag = await c.evaluate(e => e.tagName); const type = await c.evaluate(e => e.type || '');
      try {
        if (tag === 'SELECT') { const vals = await c.locator('option').evaluateAll(os => os.map(x => x.value).filter(v => v)); if (vals.length) await c.selectOption(vals[0]); }
        else if (['checkbox', 'radio', 'file', 'hidden'].includes(type)) continue;
        else if (type === 'number') await c.fill('2020');
        else if (type === 'color') await c.fill('#ff0000');
        else { const ph = (await c.getAttribute('placeholder')) || ''; if (/^Ex: .*(Labrador|iPhone|Égua)/.test(ph) || /^Ex: iPhone|^Ex: Égua|^Ex: Labrador/.test(ph)) await c.fill('Teste de matriz de campos'); else await c.fill('valor-' + i); }
      } catch {}
    }
    await page.locator('textarea').first().fill('Descrição de teste com mais de dez letras').catch(() => {});
    await page.getByRole('button', { name: /^\s*Continuar/ }).first().click(); await page.waitForTimeout(600);
    const reg = page.getByRole('button', { name: /Registrar Objeto/ }).first(); o.ultimoPasso = (await reg.count()) > 0;
    if (o.ultimoPasso) { await reg.click(); await page.waitForTimeout(1500); }
    o.post = posts[0] || null; o.erros = erros; out[`${nb}/${vpn}/${label}`] = o; await ctx.close();
  }
  fs.writeFileSync(__dirname + '/comparar.json', JSON.stringify(out, null, 1)); await b.close(); console.log('ok', Object.keys(out).length);
})();
