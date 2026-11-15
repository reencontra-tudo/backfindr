#!/usr/bin/env node
// Navegador: chat de match. Com match confirmado mostra o nome de quem escreve (não «?») e o texto novo; com match pendente mostra o aviso e não lê mensagens.
// APIs simuladas no navegador (nada vai a banco nem a produção). Chromium emulando.
//   node tools/chat-match-check.mjs <baseUrl>
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
const BASE = process.argv[2]; let fails = 0; const ok = (n, c, x = '') => { if (!c) fails++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}${x ? '  — ' + x : ''}`); };
const b = await chromium.launch(); const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const J = (o) => ({ status: 200, contentType: 'application/json', body: JSON.stringify(o) });
for (const W of [390, 1280]) for (const status of ['confirmed', 'pending']) {
  const ctx = await b.newContext({ viewport: { width: W, height: 844 }, isMobile: W < 1000, userAgent: W < 1000 ? UA : undefined });
  await ctx.addCookies([{ name: 'access_token', value: 'x', url: BASE }, { name: 'refresh_token', value: 'x', url: BASE }]);
  await ctx.addInitScript(() => localStorage.setItem('backfindr-auth', JSON.stringify({ state: { user: { id: 'eu', name: 'Eu Teste', email: 'eu@teste.local', role: 'user' }, isAuthenticated: true }, version: 0 })));
  await ctx.route(/google|clarity|facebook|mapbox|ipapi|posthog/, (r) => r.abort());
  let leituras = 0;
  await ctx.route('**/api/v1/**', (r) => { const u = new URL(r.request().url()).pathname;
    if (u.endsWith('/users/me')) return r.fulfill(J({ id: 'eu', name: 'Eu Teste', email: 'eu@teste.local', role: 'user' }));
    if (u.endsWith('/v1/matches')) return r.fulfill(J({ matches: [{ id: 'm1', lost_object_id: 'o1', found_object_id: 'o2', score: 0.9, status, created_at: new Date().toISOString() }] }));
    if (u.includes('/objects/o')) return r.fulfill(J({ id: 'o1', title: 'Objeto de teste', category: 'other' }));
    if (u.endsWith('/messages')) { leituras++; return r.fulfill(J({ messages: [{ id: 'a', sender_id: 'outro', sender_name: 'Ana Teste', content: 'Olá, achei seu objeto', created_at: new Date().toISOString(), is_system: false }] })); }
    return r.fulfill(J({ total: 0, by_match: {}, notifications: [], items: [] })); });
  const p = await ctx.newPage(); await p.goto(`${BASE}/dashboard/chat/m1`); await p.waitForTimeout(3500); const t = await p.locator('body').innerText();
  if (status === 'confirmed') {
    ok(`[${W}] match confirmado: nome «Ana Teste» (não «?») e texto novo`, t.includes('Ana Teste') && t.includes('Mensagens deste match. Não envie telefone, e-mail nem endereço.') && !/mediada|não são expostos/.test(t));
  } else {
    ok(`[${W}] match pendente: aviso «A conversa ainda não está aberta», nenhuma leitura de mensagens`, t.includes('A conversa ainda não está aberta') && leituras === 0 && !t.includes('Ana Teste'), `leituras=${leituras}`);
  }
  const larg = await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1); ok(`[${W}] ${status}: sem rolagem horizontal`, larg);
  await ctx.close();
}
console.log(fails ? fails + ' FALHA(S)' : 'TUDO OK'); await b.close(); process.exit(fails ? 1 : 0);
