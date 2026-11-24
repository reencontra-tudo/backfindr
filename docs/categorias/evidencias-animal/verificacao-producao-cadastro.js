const { chromium } = require('playwright');
const user = { id: '00000000-0000-0000-0000-000000000000', name: 'Teste Local', email: 't@example.invalid', plan: 'free', role: 'user', created_at: '2026-01-01T00:00:00Z' };
const BASE = 'https://backfindr.com';
const CATS = [['Pet', 'pet'], ['Animal', 'animal'], ['Celular', 'phone'], ['Carteira', 'wallet'], ['Chaves', 'keys'], ['Bolsa / Mochila', 'bag'], ['Bicicleta', 'bike'], ['Veículo', 'vehicle'], ['Documento', 'document'], ['Joia / Relógio', 'jewelry'], ['Eletrônico', 'electronics'], ['Outro', 'other']];
async function novoCtx(b, vp) {
  const ctx = await b.newContext({ viewport: vp }); const vazados = [];
  await ctx.addCookies([{ name: 'access_token', value: 'fake', url: BASE }]);
  await ctx.addInitScript(([u]) => { try { localStorage.setItem('backfindr-auth', JSON.stringify({ state: { user: u, isAuthenticated: true }, version: 0 })); } catch {} }, [user]);
  await ctx.route(/mapbox|posthog|clarity|googletagmanager|facebook|doubleclick|google/, r => r.abort());
  // NENHUMA chamada /api/v1 sai para a produção: todas respondidas aqui (nada é criado)
  await ctx.route('**/api/v1/**', r => r.request().url().includes('/auth/me') ? r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(user) }) : r.fulfill({ status: 200, contentType: 'application/json', body: '{"data":{"total":0,"objects":[],"matches":[]},"total":0,"items":[]}' }));
  return ctx;
}
(async () => {
  const b = await chromium.launch();
  // 1) espera o deploy
  let ok = false;
  for (let i = 1; i <= 30 && !ok; i++) {
    const ctx = await novoCtx(b, { width: 375, height: 812 }); const p = await ctx.newPage();
    await p.goto(`${BASE}/dashboard/objects/new?intent=lost`, { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(3500);
    ok = (await p.locator('body').innerText()).includes('De criação ou trabalho'); console.log('tentativa', i, 'cartão Animal:', ok); await ctx.close();
    if (!ok) await new Promise(r => setTimeout(r, 20000));
  }
  const res = {};
  for (const [vpNome, vp] of [['375', { width: 375, height: 812 }], ['1280', { width: 1280, height: 900 }]]) {
    const ctx = await novoCtx(b, vp); const page = await ctx.newPage(); const erros = [];
    page.on('pageerror', e => erros.push(String(e).slice(0, 120)));
    await page.goto(`${BASE}/dashboard/objects/new?intent=lost`, { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(3500);
    const corpo = (await page.locator('body').innerText()).replace(/\s+/g, ' ');
    const o = { cartaoPet: corpo.includes('Animal de estimação: cachorro, gato, pássaro'), cartaoAnimal: corpo.includes('De criação ou trabalho: cavalo, boi, porco'), semCartaoAntigo: !corpo.includes('Pet / Animal') };
    o.cartoes = (corpo.match(/(Pet|Animal|Celular|Carteira|Chaves|Bolsa \/ Mochila|Bicicleta|Veículo|Documento|Joia \/ Relógio|Eletrônico|Outro)(?= )/g) || []).length;
    await ctx.close(); o.categorias = {};
    for (const [label, cat] of CATS) {
      const c2 = await novoCtx(b, vp); const pg = await c2.newPage();
      await pg.goto(`${BASE}/dashboard/objects/new?intent=lost`, { waitUntil: 'domcontentloaded' }); await pg.waitForTimeout(2500);
      await pg.locator('button').filter({ has: pg.getByText(label, { exact: true }) }).first().click(); await pg.waitForTimeout(500);
      const t = (await pg.locator('body').innerText()).replace(/\s+/g, ' ');
      const temCampos = await pg.locator('input, select, textarea').evaluateAll(es => es.filter(e => e.offsetParent !== null).length);
      const r = { noDetalhes: /Detalhes/.test(t) && /Título/i.test(t), camposVisiveis: temCampos };
      if (cat === 'animal') { r.espécie = t.includes('Espécie'); r.corPelagem = t.includes('Cor / pelagem'); r.opcionaisNoBotao = t.includes('Adicionar detalhes adicionais'); }
      o.categorias[cat] = r; await c2.close();
    }
    o.erros = erros; res[vpNome] = o;
  }
  console.log(JSON.stringify(res, null, 1)); await b.close();
})();
