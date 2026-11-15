#!/usr/bin/env node
// Verificação de navegador: as páginas que tinham «a conversa acontece pelo chat da plataforma» agora trazem o texto fiel e não estouram a largura. Só leitura.
//   node tools/frases-chat-check.mjs <baseUrl>
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
const BASE = process.argv[2]; let fails = 0; const ok = (n, c, x = '') => { if (!c) fails++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}${x ? '  — ' + x : ''}`); };
const b = await chromium.launch(); const NOVO = 'O aviso fica registrado na ocorrência; não há garantia de resposta';
const casos = [['/', NOVO], ['/flow/found', NOVO], ['/flow/lost', NOVO], ['/flow/pet', NOVO], ['/flow/wallet', null], ['/flow/keys', null], ['/encontrei', null], ['/faq', null]];
for (const W of [390, 1280]) for (const [u, frase] of casos) {
  const ctx = await b.newContext({ viewport: { width: W, height: 844 }, isMobile: W < 1000 }); await ctx.route(/google|clarity|facebook|mapbox|ipapi|posthog/, (r) => r.abort()); const p = await ctx.newPage();
  await p.goto(BASE + u, { waitUntil: 'networkidle' }); let t = await p.locator('body').innerText();
  if (u === '/faq') { for (const q of await p.locator('button').all()) { try { await q.click({ timeout: 300 }); } catch {} } t = await p.locator('body').innerText(); }
  const sem = !/pelo chat da plataforma/i.test(t); const tem = frase ? t.includes(frase) : (u === '/faq' ? t.includes('push e e-mail saem só quando o dono não é legado') : true);
  const larg = await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
  ok(`[${W}] ${u}: sem «pelo chat da plataforma», texto fiel presente, sem rolagem horizontal`, sem && tem && larg, `sem=${sem} tem=${tem} larg=${larg}`); await ctx.close();
}
console.log(fails ? fails + ' FALHA(S)' : 'TUDO OK'); await b.close(); process.exit(fails ? 1 : 0);
