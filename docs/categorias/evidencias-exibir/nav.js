const { chromium } = require('playwright'); const fs = require('fs');
const ids = Object.fromEntries(fs.readFileSync('ids.txt', 'utf8').trim().split(',').map(x => x.split('=')));
const token = fs.readFileSync('token.txt', 'utf8').trim();
const user = { id: '11111111-1111-1111-1111-111111111111', name: 'Dono Teste', email: 'dono@teste.invalid', plan: 'free', role: 'user', created_at: '2026-01-01T00:00:00Z' };
const BUILDS = { base: 3141, novo: 3142 };
async function novo(b, port, vp) {
  const ctx = await b.newContext({ viewport: vp });
  await ctx.addCookies([{ name: 'access_token', value: token, url: `http://localhost:${port}` }]);
  await ctx.addInitScript(([u]) => { try { localStorage.setItem('backfindr-auth', JSON.stringify({ state: { user: u, isAuthenticated: true }, version: 0 })); } catch {} }, [user]);
  await ctx.route(/mapbox|posthog|clarity|googletagmanager|facebook/, r => r.abort());
  await ctx.route('**/api/v1/auth/me', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(user) }));
  return ctx;
}
(async () => {
  const b = await chromium.launch(); const res = {};
  for (const [nb, port] of Object.entries(BUILDS)) for (const [vpn, vp] of [['375', { width: 375, height: 812 }], ['1280', { width: 1280, height: 1000 }]]) for (const code of ['PH1', 'VE1', 'VE2', 'PE1', 'AN1', 'WA1', 'NF1', 'BG1']) {
    const ctx = await novo(b, port, vp); const page = await ctx.newPage(); const o = {};
    // públicas
    for (const rota of ['objeto', 'scan']) { await page.goto(`http://localhost:${port}/${rota}/${code}`, { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(2500); o[rota] = (await page.locator('body').innerText()).replace(/\s+/g, ' '); if (vpn === '375' && nb === 'novo' && ['PH1', 'VE1', 'PE1'].includes(code)) await page.screenshot({ path: `${rota}-${code}-375.png`, fullPage: true }); }
    // painel do titular
    await page.goto(`http://localhost:${port}/dashboard/objects/${ids[code]}`, { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(3000);
    o.painel = (await page.locator('body').innerText()).replace(/\s+/g, ' ');
    if (vpn === '1280' && nb === 'novo' && ['PH1', 'VE1'].includes(code)) await page.screenshot({ path: `painel-${code}-1280.png`, fullPage: true });
    // edição: abre, salva SEM mexer e registra o corpo do PATCH
    const patches = []; await page.route('**/api/v1/objects/*', r => { const q = r.request(); if (q.method() === 'PATCH') patches.push(JSON.parse(q.postData() || '{}')); r.continue(); });
    await page.goto(`http://localhost:${port}/dashboard/objects/${ids[code]}/edit`, { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(3000);
    o.edicaoControles = await page.locator('input:visible, select:visible, textarea:visible').count();
    o.edicaoTemCamposEspecificos = await page.locator('[data-campos-especificos]').count();
    await page.getByRole('button', { name: /Salvar/ }).first().click().catch(() => {}); await page.waitForTimeout(1500);
    o.patchSemMexer = patches[0] || null;
    res[`${nb}/${vpn}/${code}`] = o; await ctx.close();
  }
  fs.writeFileSync('nav.json', JSON.stringify(res, null, 1)); await b.close(); console.log('ok', Object.keys(res).length);
})();
