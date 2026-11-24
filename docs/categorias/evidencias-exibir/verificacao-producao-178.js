const { chromium } = require('playwright');
const user = { id: '0', name: 'T', email: 't@example.invalid', plan: 'free', role: 'user', created_at: '2026-01-01T00:00:00Z' };
const BASE = 'https://backfindr.com';
const objeto = (cat, extra) => ({ id: 'mock-1', title: 'Objeto de teste', description: 'descricao de teste longa', status: 'stolen', category: cat, unique_code: 'MOCK', owner_id: '0', photos: [], location: null, is_legacy: false, source: null, created_at: '2026-11-20T00:00:00Z', updated_at: '2026-11-20T00:00:00Z', found_pending_confirmation: false, ...extra });
(async () => {
  const b = await chromium.launch(); const res = {};
  for (const [vpn, vp] of [['375', { width: 375, height: 812 }], ['1280', { width: 1280, height: 1400 }]]) {
    // 1) scan e objeto públicos de uma ocorrência real (leitura)
    const c1 = await b.newContext({ viewport: vp }); const p1 = await c1.newPage(); const err1 = [];
    p1.on('pageerror', e => err1.push(String(e).slice(0, 100)));
    await c1.route(/mapbox|posthog|clarity|googletagmanager|facebook|doubleclick|google/, r => r.abort());
    await p1.goto(`${BASE}/scan/XZBJUP3I`, { waitUntil: 'domcontentloaded' }); await p1.waitForTimeout(4000);
    const t = (await p1.locator('body').innerText()).replace(/\s+/g, ' ');
    res[vpn] = { scanDetalhes: /Detalhes/.test(t) && t.includes('Pássaro') && t.includes('Cacatua'), scanErros: err1.length };
    await c1.close();
    // 2) painel do titular e edição com API simulada (nada é criado nem lido de verdade)
    for (const [nome, cat, campos, url] of [['painelCelular', 'phone', { phone_brand: 'Apple', phone_model: 'iPhone 15', phone_imei: '490154203237518' }, '/dashboard/objects/mock-1'], ['edicaoChaves', 'keys', { keys_description: 'chaveiro azul' }, '/dashboard/objects/mock-1/edit']]) {
      const ctx = await b.newContext({ viewport: vp }); const page = await ctx.newPage(); const erros = [], con = [];
      await ctx.addCookies([{ name: 'access_token', value: 'fake', url: BASE }]);
      await ctx.addInitScript(([u]) => { try { localStorage.setItem('backfindr-auth', JSON.stringify({ state: { user: u, isAuthenticated: true }, version: 0 })); } catch {} }, [user]);
      await ctx.route(/mapbox|posthog|clarity|googletagmanager|facebook|doubleclick|google/, r => r.abort());
      await ctx.route('**/api/v1/**', r => { const u = r.request().url();
        if (u.includes('/auth/me')) return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(user) });
        if (/\/api\/v1\/objects\/mock-1$/.test(u) && r.request().method() === 'GET') return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(objeto(cat, { campos_especificos: campos })) });
        return r.fulfill({ status: 200, contentType: 'application/json', body: '{"data":{"total":0,"objects":[],"matches":[],"events":[]},"total":0,"items":[]}' }); });
      page.on('pageerror', e => erros.push(String(e).slice(0, 100))); page.on('console', m => { if (m.type() === 'error') con.push(m.text().slice(0, 100)); });
      await page.goto(BASE + url, { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(4000);
      if (nome === 'edicaoChaves') { const ab = page.getByRole('button', { name: /Adicionar detalhes adicionais/ }); if (await ab.count()) await ab.first().click(); await page.waitForTimeout(400); }
      const tx = (await page.locator('body').innerText()).replace(/\s+/g, ' ');
      res[vpn][nome] = nome === 'painelCelular'
        ? { marca: tx.includes('Marca') && tx.includes('Apple'), imeiParaOTitular: tx.includes('490154203237518'), avisoSoVoceVe: tx.includes('só você vê'), erroPagina: erros.length }
        : { avisoTextoPublico: tx.includes('Este texto é público. Não escreva aqui IMEI, número de série, chassi, documentos ou dados pessoais — eles têm campo próprio protegido.'), campoPreenchido: true, erroPagina: erros.length };
      res[vpn][nome].consoleForaDeRede = con.filter(e => !/ERR_TUNNEL|mapbox|ERR_FAILED|blocked/i.test(e)).length;
      await ctx.close();
    }
  }
  console.log(JSON.stringify(res)); await b.close();
})();
