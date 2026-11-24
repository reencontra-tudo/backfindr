const { chromium } = require('playwright'); const fs = require('fs');
const BUILDS = { base: { port: 3121, pet: 'Pet / Animal' }, novo: { port: 3122, pet: 'Pet' } };
const CATS = [['animal-sem-essenciais','Animal'],['pet', null], ['phone', 'Celular'], ['wallet', 'Carteira'], ['keys', 'Chaves'], ['bag', 'Bolsa / Mochila'], ['bike', 'Bicicleta'], ['vehicle', 'Veículo'], ['document', 'Documento'], ['jewelry', 'Joia / Relógio'], ['electronics', 'Eletrônico'], ['other', 'Outro'], ['animal', 'Animal']];
const user = { id: '00000000-0000-0000-0000-000000000000', name: 'Teste Local', email: 't@example.invalid', plan: 'free', role: 'user', created_at: '2026-01-01T00:00:00Z' };
(async () => {
  const b = await chromium.launch(); const out = {};
  for (const [nomeBuild, cfg] of Object.entries(BUILDS)) for (const [vpNome, vp] of [['375', { width: 375, height: 812 }], ['1280', { width: 1280, height: 900 }]]) for (const [cat, label0] of CATS) {
    const label = cat === 'pet' ? cfg.pet : label0;
    if (nomeBuild === 'base' && cat.startsWith('animal')) continue;
    const ctx = await b.newContext({ viewport: vp }); const posts = [];
    await ctx.addCookies([{ name: 'access_token', value: 'fake', url: `http://localhost:${cfg.port}` }]);
    await ctx.addInitScript(([u]) => { try { localStorage.setItem('backfindr-auth', JSON.stringify({ state: { user: u, isAuthenticated: true }, version: 0 })); } catch {} }, [user]);
    await ctx.route(/mapbox|posthog|clarity|googletagmanager|facebook/, r => r.abort());
    await ctx.route('**/api/v1/**', r => {
      const q = r.request(), u = q.url();
      if (q.method() === 'POST' && /\/api\/v1\/objects$/.test(u)) { posts.push(JSON.parse(q.postData() || '{}')); return r.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ id: 'teste-id', qr_code: 'TESTQR', data: { id: 'teste-id' } }) }); }
      if (u.includes('/auth/me')) return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(user) });
      return r.fulfill({ status: 200, contentType: 'application/json', body: '{"data":{"total":0,"objects":[],"matches":[]},"total":0,"items":[]}' });
    });
    const page = await ctx.newPage(); const erros = []; page.on('pageerror', e => erros.push(String(e).slice(0, 100)));
    const o = {};
    await page.goto(`http://localhost:${cfg.port}/dashboard/objects/new?intent=lost`, { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(2500);
    o.cartoes = (await page.locator('form button, main button').allInnerTexts()).filter(t => t.length < 120).map(t => t.replace(/\s+/g, ' ').trim());
    await page.locator('button').filter({ has: page.getByText(label, { exact: true }) }).first().click(); await page.waitForTimeout(500);
    const txt = async () => (await page.locator('body').innerText()).replace(/\s+/g, ' ');
    o.detalhes = (await txt()).replace(/^.*?Registrar Ocorrência/, '');
    o.campos = await page.locator('input, select, textarea').evaluateAll(es => es.filter(e => e.offsetParent !== null).map(e => [e.tagName, e.getAttribute('placeholder') || '', e.getAttribute('name') || '']));
    await page.locator('input[placeholder^="Ex"]').first().fill('Teste de cadastro automatizado'); await page.locator('textarea').first().fill('Descrição de teste com mais de dez letras');
    if (cat === 'animal') {
      await page.locator('select').first().selectOption('horse'); await page.locator('input[placeholder^="Ex: alaz"]').fill('alazão com estrela');
      await page.getByRole('button', { name: /Adicionar detalhes adicionais/ }).click(); await page.waitForTimeout(300);
      await page.locator('input[placeholder^="Ex: Mangalarga"]').fill('Mangalarga'); await page.locator('textarea[placeholder^="Ex: ferro"]').fill('marca a fogo na anca');
    }
    await page.getByRole('button', { name: /^\s*Continuar/ }).first().click(); await page.waitForTimeout(700);
    if (cat === 'animal') {  // tenta registrar SEM os essenciais não é possível aqui (já preenchidos); registra
    }
    const reg = page.getByRole('button', { name: /Registrar Objeto/ }).first();
    o.chegouNoUltimoPasso = (await reg.count()) > 0;
    if (o.chegouNoUltimoPasso) { await reg.click(); await page.waitForTimeout(1500); }
    if (cat === 'animal-sem-essenciais') { o.aposRegistrar = (await txt()).replace(/\s+/g, ' ').slice(0, 600); }
    o.posts = posts; o.erros = erros; out[`${nomeBuild}/${vpNome}/${cat}`] = o; await ctx.close();
  }
  fs.writeFileSync(__dirname + '/resultado.json', JSON.stringify(out, null, 1)); await b.close();
  const keys = Object.keys(out); console.log('execuções:', keys.length);
})();
