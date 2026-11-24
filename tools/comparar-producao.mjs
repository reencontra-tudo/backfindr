#!/usr/bin/env node
// Comparação «antes × depois» da PRODUÇÃO. SOMENTE LEITURA: só pedidos GET públicos (os mesmos que um visitante faz). Não escreve nada, não usa login,
// não cria conta nem ocorrência, não envia formulário. Usado no lançamento controlado do Programa de Colaboradores (docs/programa-colaboradores/LANCAMENTO-CONTROLADO.md).
//
// Uso:
//   node tools/comparar-producao.mjs capturar <arquivo.json> [--base https://backfindr.com]     guarda um retrato das rotas
//   node tools/comparar-producao.mjs comparar <antes.json> <depois.json> [<antes2.json>]          compara; com um 2º «antes» mede a variação natural
//   node tools/comparar-producao.mjs impressao                                                     qual implantação está no ar (muda a cada deploy)
//   node tools/comparar-producao.mjs bundle                                                        procura trechos do programa no código da página de cadastro
//   node tools/comparar-producao.mjs cartazes <arquivo.json>                                       confere se os cartazes públicos guardados continuam idênticos
// (No ambiente com proxy, rodar com NODE_USE_ENV_PROXY=1.)
// Saída: uma linha por rota (OK / DIFERENTE / VARIAÇÃO NATURAL) e código de saída 0 (tudo igual) ou 1 (qualquer diferença).
//
// O que é comparado em cada rota: código de resposta, endereço final depois dos redirecionamentos, <title>, meta robots, canonical, h1,
// X-Robots-Tag e o TEXTO visível (hash). Páginas com dados vivos (Feed, mapa, home) mudam sozinhas: o texto delas é comparado por SIMILARIDADE
// (limiar 0,90) e, se foi capturado um 2º «antes», só é «DIFERENTE» se a diferença for maior que a variação natural entre os dois «antes».
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';

const ROTAS = [
  '/', '/feed', '/achei', '/perdi', '/map', '/pricing', '/auth/login', '/flow/found',
  '/@backfindr', '/colaborador/backfindr', '/robots.txt', '/sitemap.xml',
  '/api/v1/colaboradores/validar?codigo=HX7R',
];
/** Rotas com conteúdo que muda sozinho (dados vivos): o texto é comparado por similaridade, não por igualdade. */
const VIVAS = new Set(['/', '/feed', '/map', '/achei', '/sitemap.xml']);
const LIMIAR = 0.9;
const UA = 'Backfindr-ComparacaoProducao/1.0 (leitura; +https://backfindr.com)';

const sha = (t) => createHash('sha256').update(t).digest('hex').slice(0, 16);
const pega = (re, s) => { const m = re.exec(s); return m ? m[1].replace(/\s+/g, ' ').trim() : null; };

function textoVisivel(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ').trim();
}
const palavras = (t) => new Set(t.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((w) => w.length > 2));
function similaridade(a, b) {
  const A = palavras(a), B = palavras(b);
  if (A.size === 0 && B.size === 0) return 1;
  let inter = 0; for (const w of A) if (B.has(w)) inter++;
  return inter / (A.size + B.size - inter);
}

async function pegar(base, caminho) {
  const salto = [];
  let url = base + caminho;
  let resp = null;
  for (let i = 0; i < 6; i++) {
    resp = await fetch(url, { redirect: 'manual', headers: { 'user-agent': UA, accept: 'text/html,application/xml,application/json,*/*' }, signal: AbortSignal.timeout(30000) });
    if (resp.status >= 300 && resp.status < 400 && resp.headers.get('location')) {
      const prox = new URL(resp.headers.get('location'), url).toString();
      salto.push(`${resp.status} ${new URL(url).pathname}${new URL(url).search} -> ${prox.replace(base, '')}`);
      url = prox; continue;
    }
    break;
  }
  const corpo = await resp.text();
  const tipo = resp.headers.get('content-type') ?? '';
  const ehHtml = /html/i.test(tipo);
  const h1cru = ehHtml ? (/<h1[^>]*>([\s\S]*?)<\/h1>/i.exec(corpo)?.[1] ?? null) : null;
  const texto = ehHtml ? textoVisivel(corpo) : corpo.replace(/<lastmod>[^<]*<\/lastmod>/g, '').replace(/\s+/g, ' ').trim();
  return {
    status: resp.status,
    final: url.replace(base, '') || '/',
    saltos: salto,
    tipo: tipo.split(';')[0],
    titulo: ehHtml ? pega(/<title[^>]*>([\s\S]*?)<\/title>/i, corpo) : null,
    robots: ehHtml ? pega(/<meta\s+name="robots"\s+content="([^"]*)"/i, corpo) : null,
    canonica: ehHtml ? pega(/<link\s+rel="canonical"\s+href="([^"]*)"/i, corpo) : null,
    h1: ehHtml && h1cru ? textoVisivel(h1cru) : null,
    xRobots: resp.headers.get('x-robots-tag'),
    bytes: corpo.length,
    textoHash: sha(texto),
    texto: texto.slice(0, 60000),   // guardado para medir similaridade; só texto público
  };
}

async function capturar(arquivo, base) {
  const r = { capturadoEm: new Date().toISOString(), base, rotas: {} };
  for (const c of ROTAS) {
    try { r.rotas[c] = await pegar(base, c); }
    catch (e) { r.rotas[c] = { erro: String(e?.message ?? e).slice(0, 160) }; }
    const x = r.rotas[c];
    console.log(`${(x.status ?? 'ERRO').toString().padEnd(4)} ${c}${x.final && x.final !== c ? '  -> ' + x.final : ''}`);
  }
  writeFileSync(arquivo, JSON.stringify(r, null, 1));
  console.log(`\nSalvo em ${arquivo} (${Object.keys(r.rotas).length} rotas, ${r.capturadoEm})`);
}

const CAMPOS_FIXOS = ['status', 'final', 'tipo', 'titulo', 'robots', 'canonica', 'h1', 'xRobots'];

function compararRota(c, a, d, a2) {
  if (a.erro || d.erro) return { estado: 'DIFERENTE', motivos: [`erro de captura: antes=${a.erro ?? 'ok'} depois=${d.erro ?? 'ok'}`] };
  const motivos = [];
  for (const k of CAMPOS_FIXOS) if ((a[k] ?? null) !== (d[k] ?? null)) motivos.push(`${k}: «${a[k]}» -> «${d[k]}»`);
  if (JSON.stringify(a.saltos) !== JSON.stringify(d.saltos)) motivos.push(`redirecionamentos: ${JSON.stringify(a.saltos)} -> ${JSON.stringify(d.saltos)}`);
  const sim = similaridade(a.texto ?? '', d.texto ?? '');
  const igualTexto = a.textoHash === d.textoHash;
  let nota = '';
  if (!igualTexto) {
    if (VIVAS.has(c)) {
      const naturalSim = a2 ? similaridade(a.texto ?? '', a2.texto ?? '') : 1;
      const minimo = Math.min(LIMIAR, naturalSim - 0.02);
      if (sim < minimo) motivos.push(`texto (dados vivos) muito diferente: similaridade ${sim.toFixed(3)} < ${minimo.toFixed(3)}`);
      else nota = `texto mudou sozinho (dados vivos), similaridade ${sim.toFixed(3)}`;
    } else motivos.push(`texto diferente (hash ${a.textoHash} -> ${d.textoHash}, similaridade ${sim.toFixed(3)})`);
  }
  if (motivos.length) return { estado: 'DIFERENTE', motivos };
  return { estado: nota ? 'VARIAÇÃO NATURAL' : 'OK', motivos: nota ? [nota] : [] };
}

function comparar(arqAntes, arqDepois, arqAntes2) {
  const A = JSON.parse(readFileSync(arqAntes, 'utf8')), D = JSON.parse(readFileSync(arqDepois, 'utf8'));
  const A2 = arqAntes2 ? JSON.parse(readFileSync(arqAntes2, 'utf8')) : null;
  console.log(`ANTES : ${A.capturadoEm}\nDEPOIS: ${D.capturadoEm}\n`);
  let dif = 0;
  for (const c of ROTAS) {
    const r = compararRota(c, A.rotas[c] ?? { erro: 'ausente' }, D.rotas[c] ?? { erro: 'ausente' }, A2?.rotas?.[c]);
    if (r.estado === 'DIFERENTE') dif++;
    console.log(`${r.estado.padEnd(17)} ${c}`);
    for (const m of r.motivos) console.log(`                   · ${m}`);
  }
  console.log(`\n${dif === 0 ? 'RESULTADO: tudo igual (ou só variação natural de dados vivos).' : `RESULTADO: ${dif} rota(s) DIFERENTE(S). PARAR e reportar.`}`);
  process.exit(dif === 0 ? 0 : 1);
}

// ── Modo «impressao»: identifica qual implantação está no ar (hash dos arquivos .js/.css que a home carrega). Muda quando um deploy novo entra no ar.
async function impressao(base) {
  const r = await fetch(base + '/', { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(30000) });
  const html = await r.text();
  const arquivos = [...html.matchAll(/(?:src|href)="(\/_next\/static\/[^"]+)"/g)].map((m) => m[1]).sort();
  console.log(`impressao ${sha(arquivos.join('|'))}  (${arquivos.length} arquivos; status ${r.status})`);
}

// ── Modo «bundle»: com o programa DESLIGADO, nenhum trecho do programa pode estar no código que o navegador baixa na página de cadastro.
async function bundle(base) {
  const r = await fetch(base + '/dashboard/objects/new', { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(30000) });
  const html = await r.text();
  const js = [...new Set([...html.matchAll(/"(\/_next\/static\/[^"]+\.js)"/g)].map((m) => m[1]))];
  const PROCURAR = ['Código do colaborador', 'bf_colab', '/api/v1/colaboradores', 'colaborador_codigo'];
  const achou = {}; let lidos = 0;
  for (const f of js) {
    try { const t = await (await fetch(base + f, { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(30000) })).text(); lidos++; for (const k of PROCURAR) if (t.includes(k)) (achou[k] ??= []).push(f.split('/').pop()); } catch { /* ignora */ }
  }
  console.log(`bundle: página ${r.status}, ${lidos}/${js.length} arquivos .js lidos`);
  for (const k of PROCURAR) console.log(`${achou[k] ? 'PRESENTE' : 'ausente '}  «${k}»${achou[k] ? '  em ' + achou[k].join(', ') : ''}`);
  console.log(Object.keys(achou).length === 0 ? 'RESULTADO: nenhum trecho do programa no código do navegador (programa DESLIGADO).' : 'RESULTADO: há trecho do programa no código do navegador.');
}

// ── Modo «cartazes»: baixa os cartazes públicos guardados em <arquivo.json> e compara o hash (com o programa desligado, o cartaz tem de ser IDÊNTICO).
async function cartazes(base, arquivo) {
  const ref = JSON.parse(readFileSync(arquivo, 'utf8')); let dif = 0;
  for (const [chave, v] of Object.entries(ref.cartazes)) {
    const [cod, fmt] = chave.split('|');
    const r = await fetch(`${base}/api/v1/objects/${cod}/poster?format=${fmt}&publico=1`, { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(60000) });
    const b = Buffer.from(await r.arrayBuffer());
    const agora = `${r.status}:${b.length}:${createHash('sha256').update(b).digest('hex').slice(0, 24)}`;
    const igual = agora === v.pedido1; if (!igual) dif++;
    console.log(`${igual ? 'OK       ' : 'DIFERENTE'} ${chave}  ${igual ? '' : `${v.pedido1} -> ${agora}`}`);
  }
  console.log(dif === 0 ? 'RESULTADO: cartazes idênticos byte a byte.' : `RESULTADO: ${dif} cartaz(es) DIFERENTE(S). PARAR e reportar.`);
  process.exit(dif === 0 ? 0 : 1);
}

const [, , modo, a1, a2, a3] = process.argv;
const baseArg = process.argv.indexOf('--base');
const BASE = (baseArg > 0 ? process.argv[baseArg + 1] : 'https://backfindr.com').replace(/\/$/, '');
if (modo === 'capturar' && a1) await capturar(a1, BASE);
else if (modo === 'comparar' && a1 && a2) comparar(a1, a2, a3 && !a3.startsWith('--') ? a3 : null);
else if (modo === 'impressao') await impressao(BASE);
else if (modo === 'bundle') await bundle(BASE);
else if (modo === 'cartazes' && a1) await cartazes(BASE, a1);
else { console.error('Uso: capturar <arquivo.json> | comparar <antes.json> <depois.json> [<antes2.json>] | impressao | bundle | cartazes <arquivo.json>'); process.exit(2); }
