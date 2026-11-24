const { chromium } = require('playwright');
const user = { id: '0', name: 'T', email: 't@example.invalid', plan: 'free', role: 'user', created_at: '2026-01-01T00:00:00Z' };
const BASE = 'https://backfindr.com';
const CATS = [['Pet', 'pet'], ['Animal', 'animal'], ['Celular', 'phone'], ['Carteira', 'wallet'], ['Chaves', 'keys'], ['Bolsa / Mochila', 'bag'], ['Bicicleta', 'bike'], ['Veículo', 'vehicle'], ['Documento', 'document'], ['Joia / Relógio', 'jewelry'], ['Eletrônico', 'electronics'], ['Outro', 'other']];
(async () => {
  const b = await chromium.launch(); const out = {};
  for (const [label, cat] of CATS) {
    const ctx = await b.newContext({ viewport: { width: 1280, height: 1400 } }); const posts = []; let vazou = 0;
    await ctx.addCookies([{ name: 'access_token', value: 'fake', url: BASE }]);
    await ctx.addInitScript(([u]) => { try { localStorage.setItem('backfindr-auth', JSON.stringify({ state: { user: u, isAuthenticated: true }, version: 0 })); } catch {} }, [user]);
    await ctx.route(/mapbox|posthog|clarity|googletagmanager|facebook|doubleclick|google/, r => r.abort());
    await ctx.route('**/api/v1/**', r => { const q = r.request(), u = q.url();
      if (q.method() === 'POST' && /\/api\/v1\/objects$/.test(u)) { posts.push(JSON.parse(q.postData() || '{}')); return r.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ id: 'teste', data: { id: 'teste' } }) }); }
      return u.includes('/auth/me') ? r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(user) }) : r.fulfill({ status: 200, contentType: 'application/json', body: '{"data":{"total":0,"objects":[],"matches":[]},"total":0,"items":[]}' }); });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/dashboard/objects/new?intent=lost`, { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(3000);
    await page.locator('button').filter({ has: page.getByText(label, { exact: true }) }).first().click(); await page.waitForTimeout(500);
    const abre = page.getByRole('button', { name: /Adicionar detalhes adicionais/ }); if (await abre.count()) { await abre.first().click(); await page.waitForTimeout(300); }
    // preenche TODOS os controles visíveis do passo Detalhes
    const n = await page.evaluate(() => 0);
    const ctrls = page.locator('main input:visible, main select:visible, main textarea:visible, form input:visible, form select:visible, form textarea:visible');
    const total = await ctrls.count(); let preenchidos = 0;
    for (let i = 0; i < total; i++) {
      const c = ctrls.nth(i); const tag = await c.evaluate(e => e.tagName); const type = await c.evaluate(e => e.type || '');
      try {
        if (tag === 'SELECT') { const vals = await c.locator('option').evaluateAll(os => os.map(o => o.value).filter(v => v)); if (vals.length) { await c.selectOption(vals[0]); preenchidos++; } }
        else if (type === 'checkbox' || type === 'radio' || type === 'file' || type === 'hidden') continue;
        else if (type === 'number') { await c.fill('5'); preenchidos++; }
        else if (type === 'color') { await c.fill('#ff0000'); preenchidos++; }
        else if (type === 'date') { await c.fill('2026-11-20'); preenchidos++; }
        else { const ph = (await c.getAttribute('placeholder')) || ''; await c.fill(/Ex: .*(Labrador|iPhone|Égua)|título/i.test(ph) ? 'Teste de matriz de campos' : 'valor-teste'); preenchidos++; }
      } catch {}
    }
    await page.locator('textarea').first().fill('Descrição de teste com mais de dez letras').catch(() => {});
    await page.getByRole('button', { name: /^\s*Continuar/ }).first().click(); await page.waitForTimeout(600);
    const reg = page.getByRole('button', { name: /Registrar Objeto/ }).first();
    if (await reg.count()) { await reg.click(); await page.waitForTimeout(1500); }
    out[cat] = { controlesNoPasso: total, preenchidos, enviado: posts[0] ? Object.keys(posts[0]) : null };
    await ctx.close();
  }
  console.log(JSON.stringify(out)); await b.close();
})();
