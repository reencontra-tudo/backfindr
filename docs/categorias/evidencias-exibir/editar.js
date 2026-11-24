const { chromium } = require('playwright'); const fs = require('fs');
const ids = Object.fromEntries(fs.readFileSync('ids.txt', 'utf8').trim().split(',').map(x => x.split('=')));
const token = fs.readFileSync('token.txt', 'utf8').trim(); const port = 3142;
const user = { id: '11111111-1111-1111-1111-111111111111', name: 'Dono Teste', email: 'dono@teste.invalid', plan: 'free', role: 'user', created_at: '2026-01-01T00:00:00Z' };
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1280, height: 1400 } });
  await ctx.addCookies([{ name: 'access_token', value: token, url: `http://localhost:${port}` }]);
  await ctx.addInitScript(([u]) => { localStorage.setItem('backfindr-auth', JSON.stringify({ state: { user: u, isAuthenticated: true }, version: 0 })); }, [user]);
  await ctx.route(/mapbox|posthog|clarity|googletagmanager|facebook/, r => r.abort()); await ctx.route('**/api/v1/auth/me', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(user) }));
  const page = await ctx.newPage(); const patches = []; await page.route('**/api/v1/objects/*', r => { if (r.request().method() === 'PATCH') patches.push(JSON.parse(r.request().postData() || '{}')); r.continue(); });
  await page.goto(`http://localhost:${port}/dashboard/objects/${ids.PH1}/edit`, { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(3000);
  await page.screenshot({ path: 'edicao-PH1-1280.png', fullPage: true });
  const inputs = page.locator('[data-campos-especificos] input'); const n = await inputs.count();
  // campos: marca, modelo, cor, armazenamento(opc?) — muda o modelo e apaga o IMEI
  const vals = []; for (let i = 0; i < n; i++) vals.push([await inputs.nth(i).getAttribute('placeholder'), await inputs.nth(i).inputValue()]);
  console.log('campos na edição:', JSON.stringify(vals));
  await page.getByRole('button', { name: /Adicionar detalhes adicionais/ }).first().click().catch(() => {}); await page.waitForTimeout(300);
  const mod = page.locator('[data-campos-especificos] input[placeholder*="iPhone"]').first(); await mod.fill('iPhone 16 Pro');
  const imei = page.locator('[data-campos-especificos] input[placeholder*="IMEI" i], [data-campos-especificos] input[placeholder*="15 dígitos" i]').first(); if (await imei.count()) await imei.fill('');
  await page.getByRole('button', { name: /Salvar/ }).first().click(); await page.waitForTimeout(2000);
  console.log('PATCH enviado:', JSON.stringify(patches[0]));
  await b.close();
})();
