const { chromium } = require('playwright');
const OUT = __dirname;
const BASE = 'https://backfindr.com';
const intents = process.argv[2] ? [process.argv[2]] : ['lost','found','stolen'];
(async () => {
  const b = await chromium.launch();
  const res = [];
  for (const intent of intents) for (const [nome, vp] of [['375',{width:375,height:812}],['desktop',{width:1280,height:900}]]) {
    const ctx = await b.newContext({ viewport: vp, deviceScaleFactor: 1 });
    const reqs = [], posts = [];
    const user = { id:'00000000-0000-0000-0000-000000000000', name:'Teste Local', email:'t@example.invalid', plan:'free', role:'user', created_at:'2026-01-01T00:00:00Z' };
    await ctx.addCookies([{ name:'access_token', value:'fake', url:BASE }]);
    await ctx.addInitScript(([u]) => { try { localStorage.setItem('backfindr-auth', JSON.stringify({ state:{ user:u, isAuthenticated:true }, version:0 })); } catch{} }, [user]);
    // NENHUMA chamada /api/v1 sai para a produção: todas respondidas aqui.
    await ctx.route('**/api/v1/**', r => {
      const u = r.request().url(), m = r.request().method();
      reqs.push(m+' '+u.replace(BASE,'')); if (m!=='GET') posts.push(m+' '+u);
      if (u.includes('/api/v1/colaboradores')) return r.fulfill({ status:404, body:'' });
      if (u.includes('/auth/me')) return r.fulfill({ status:200, contentType:'application/json', body:JSON.stringify(user) });
      return r.fulfill({ status:200, contentType:'application/json', body:'{"data":{"total":1,"objects":[],"matches":[]},"total":1}' });
    });
    const page = await ctx.newPage();
    const erros = []; page.on('pageerror', e => erros.push(String(e).slice(0,120)));
    page.on('request', q => { if (/colaboradores/.test(q.url())) reqs.push('REQ-COLAB '+q.url()); });
    await page.goto(`${BASE}/dashboard/objects/new?intent=${intent}&colab=teste123`, { waitUntil:'networkidle' });
    const log = [];
    log.push('url '+page.url().replace(BASE,''));
    // avança passos sem enviar
    const rot = { lost:'Perdi', found:'Encontrei', stolen:'Fui roubado' }[intent];
    for (let i=0;i<8;i++) {
      const t = (await page.locator('h2').first().textContent().catch(()=>'')) || '';
      log.push('h2: '+t.trim().slice(0,40));
      if (/Onde ocorreu/.test(t)) break;
      if (/Que tipo/.test(t)) { await page.getByRole('button',{name:/Chaves/}).first().click(); }
      else if (/O que aconteceu/.test(t)) { await page.getByRole('button',{name:new RegExp(rot)}).first().click(); }
      else {
        const tit = page.locator('input[placeholder^="Ex"]').first();
        if (await tit.count()) await tit.fill('Chaves de teste (nada será enviado)');
      }
      await page.waitForTimeout(400);
      const btn = page.getByRole('button',{name:/^\s*Continuar/}).first();
      if (await btn.count()) { await btn.click(); }
      await page.waitForTimeout(700);
    }
    await page.waitForTimeout(800);
    const campo = await page.getByText('Código do colaborador').count();
    const input = await page.locator('input[name="colaborador_codigo"], input[id*="colab" i]').count();
    const st = await page.evaluate(() => ({ ss: Object.keys(sessionStorage), ls: Object.keys(localStorage).filter(k=>/colab/i.test(k)), ck: document.cookie.split(';').map(s=>s.trim().split('=')[0]).filter(k=>/colab/i.test(k)) }));
    const colabReq = reqs.filter(r => /colaboradores/i.test(r));
    await page.screenshot({ path: `${OUT}/ultimo-passo-${intent}-${nome}.png`, fullPage: true });
    res.push({ intent, nome, ...{ campoTexto:campo, campoInput:input, sessionKeys:st.ss, colabLS:st.ls, colabCookie:st.ck, reqColab:colabReq, mutacoes:posts, erros, log } });
    await ctx.close();
  }
  console.log(JSON.stringify(res,null,1));
  await b.close();
})();
