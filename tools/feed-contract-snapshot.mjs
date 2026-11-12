#!/usr/bin/env node
// Captura as respostas das rotas EXISTENTES para comparar "antes" e "depois" do Feed.
// Somente leitura (GET). Uso:
//   node tools/feed-contract-snapshot.mjs <baseUrl> <pastaDeSaida>
//   node tools/feed-contract-snapshot.mjs --diff <pastaAntes> <pastaDepois>
//
// O que é normalizado antes de comparar (e só isso): os caminhos /_next/static/... (hashes de build
// mudam a cada build) e o id de build. Todo o resto do corpo é comparado byte a byte.
import { mkdirSync, writeFileSync, readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const PATHS = [
  // Endpoints públicos existentes (e contagens públicas)
  '/api/v1/objects/public',
  '/api/v1/objects/public?status=lost&size=50',
  '/api/v1/objects/public?status=found&size=50',
  '/api/v1/objects/public?status=stolen&size=50',
  '/api/v1/objects/public?status=all&size=10&page=2',
  '/api/v1/objects/public?keyword=celular&size=20',
  '/api/v1/objects/public?category=pet&size=20',
  '/api/v1/objects/public?size=200&status=lost',
  '/api/v1/objects/map',
  '/api/v1/stats/public',
  '/api/v1/objects/scan/USR00001',
  // Telas que consomem esses endpoints
  '/', '/map', '/buscar', '/achei',
  '/flow/bike', '/flow/found', '/flow/keys', '/flow/lost', '/flow/pet', '/flow/phone',
  '/flow/protect', '/flow/stolen', '/flow/vehicle', '/flow/wallet',
  '/achados-perdidos', '/achados-perdidos/cascavel-pr', '/achados-perdidos/cascavel-pr/celular',
  '/objeto/USR00001', '/objeto/SIG00001',
  // Demais rotas públicas
  '/pricing', '/perdi', '/encontrei', '/roubado', '/pet', '/proteger', '/blog', '/terms', '/privacy',
  '/faq', '/robots.txt', '/sitemap.xml', '/achados-perdidos/sitemap.xml',
];

const slug = (p) => (p === '/' ? '_home' : p.replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_|_$/g, ''));
// Só nomes de arquivo com hash de build mudam a cada compilação: /_next/static/..., static/chunks/...-<hash>.js, id de build.
const normalize = (s) => s
  .replace(/\/_next\/static\/[^"'\s)\\]+/g, '/_next/static/X')
  .replace(/-[0-9a-f]{16}\.(js|css)\b/g, '-HASH.$1')
  .replace(/static\/css\/[0-9a-f]{16}\.css/g, 'static/css/HASH.css')
  .replace(/"b":"[^"]+"/g, '"b":"BUILD"')
  .replace(/buildId(\\*"):(\\*")[A-Za-z0-9_-]+/g, 'buildId$1:$2BUILD')
  // O webpack renumera/reordena chunks quando o conjunto de módulos do build muda (mesmo código, outro número).
  // Conferido byte a byte nos arquivos de chunk: mesmo conteúdo, só o id muda. Sai da comparação só a lista id+arquivo.
  .replace(/\\*"\d{3,6}\\*",\\*"static\/(?:chunks|css)\/[^"\\]+\\*",?/g, '');

async function snapshot(base, out) {
  mkdirSync(out, { recursive: true });
  const index = {};
  for (const p of PATHS) {
    let status = 0, body = '', ct = '';
    try {
      const res = await fetch(base + p, { redirect: 'manual', headers: { 'user-agent': 'contract-snapshot' } });
      status = res.status; ct = res.headers.get('content-type') ?? ''; body = await res.text();
    } catch (e) { status = -1; body = String(e); }
    const file = slug(p);
    writeFileSync(join(out, file + '.body'), normalize(body));
    index[p] = { status, contentType: ct, file };
  }
  writeFileSync(join(out, 'index.json'), JSON.stringify(index, null, 2));
  console.log(`snapshot: ${PATHS.length} rotas em ${out}`);
}

function diff(a, b) {
  const ia = JSON.parse(readFileSync(join(a, 'index.json'), 'utf8'));
  const ib = JSON.parse(readFileSync(join(b, 'index.json'), 'utf8'));
  let same = 0; const different = [];
  for (const p of Object.keys(ia)) {
    const x = ia[p], y = ib[p];
    const bx = normalize(readFileSync(join(a, x.file + '.body'), 'utf8'));
    const by = y && existsSync(join(b, y.file + '.body')) ? normalize(readFileSync(join(b, y.file + '.body'), 'utf8')) : null;
    if (y && x.status === y.status && x.contentType === y.contentType && bx === by) same++;
    else different.push({ path: p, statusAntes: x.status, statusDepois: y?.status, bytesAntes: bx.length, bytesDepois: by?.length });
  }
  console.log(`idênticas: ${same} de ${Object.keys(ia).length}`);
  if (different.length) { console.log('DIFERENTES:'); for (const d of different) console.log(' ', JSON.stringify(d)); }
  process.exit(different.length ? 1 : 0);
}

const [, , a, b, c] = process.argv;
if (a === '--diff') diff(b, c); else await snapshot(a, b);
