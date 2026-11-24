const { chromium } = require('playwright');
const OUT = __dirname;
const PINS = Array.from({ length: 12 }, (_, i) => ({ id: 'p' + i, title: ['Celular preto', 'Chaves do carro', 'Carteira marrom', 'Cachorro caramelo', 'Bicicleta azul', 'Documento RG'][i % 6] + ' ' + i, status: ['lost', 'found', 'stolen'][i % 3], category: ['phone', 'keys', 'wallet', 'pet', 'bike', 'document'][i % 6], location: { lat: -23.55 + i * 0.01, lng: -46.63 + i * 0.01 } }));
(async () => {
  const b = await chromium.launch();
  const res = {};
  for (const port of [3101, 3102]) for (const [nome, vp] of [['375', { width: 375, height: 812 }], ['1280', { width: 1280, height: 900 }]]) {
    const ctx = await b.newContext({ viewport: vp });
    await ctx.route('**/api/v1/objects/map', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items: PINS, returned_total: 12 }) }));
    await ctx.route(/mapbox|posthog|clarity|googletagmanager|facebook/, r => r.abort());
    const page = await ctx.newPage();
    const erros = []; page.on('pageerror', e => erros.push(String(e).slice(0, 100)));
    await page.goto(`http://localhost:${port}/map`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2500);
    const out = {};
    const corpo = async () => (await page.locator('body').innerText()).replace(/\s+/g, ' ');
    const sem = (t) => t.replace(/Notícias recentes.*$/, '');
    out.inicial = sem(await corpo());
    await page.getByPlaceholder('Buscar objetos...').fill('celular');
    await page.waitForTimeout(700);
    out.busca_celular = sem(await corpo());
    await page.getByPlaceholder('Buscar objetos...').fill('');
    await page.waitForTimeout(500);
    const filtroBtn = page.getByRole('button', { name: /Filtros/ }).first();
    out.temBotaoFiltro = await filtroBtn.count();
    if (out.temBotaoFiltro) { await filtroBtn.click(); await page.waitForTimeout(500); out.filtrosAbertos = sem(await corpo()); const perdi = page.getByRole('button', { name: /Perdido|Perdi/ }).first(); if (await perdi.count()) { await perdi.click(); await page.waitForTimeout(500); out.filtro_perdido = sem(await corpo()); } }
    await page.screenshot({ path: `${OUT}/mapa-${port}-${nome}.png` });
    await page.reload({ waitUntil: 'domcontentloaded' }); await page.waitForTimeout(1500);
    const jornal = page.locator('button[title="Notícias relacionadas"]');
    out.temBotaoNoticias = await jornal.count();
    await jornal.click(); await page.waitForTimeout(6000);
    const itens = await page.locator('a[target="_blank"] p').allTextContents();
    out.noticias = itens; out.erros = erros;
    await page.screenshot({ path: `${OUT}/noticias-${port}-${nome}.png` });
    res[`${port}-${nome}`] = out; await ctx.close();
  }
  require('fs').writeFileSync(OUT + '/resultado.json', JSON.stringify(res, null, 1));
  for (const nome of ['375', '1280']) {
    const a = res['3101-' + nome], d = res['3102-' + nome];
    const iguais = ['inicial', 'busca_celular', 'filtrosAbertos', 'filtro_perdido', 'temBotaoFiltro', 'temBotaoNoticias'].map(k => `${k}:${JSON.stringify(a[k]) === JSON.stringify(d[k]) ? 'IGUAL' : 'DIFERENTE'}`);
    console.log(nome, iguais.join(' '), '| erros antes/depois:', a.erros.length, d.erros.length, '| notícias antes/depois:', a.noticias.length, d.noticias.length);
    console.log('  inicial(antes):', (a.inicial || '').slice(0, 220));
  }
  await b.close();
})();
