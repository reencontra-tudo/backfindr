#!/usr/bin/env node
// Verificação de afirmações públicas. SOMENTE AVISO: nunca falha o build (sempre sai com código 0).
//
// Avisa sobre:
//   R1  QR Code em título, descrição ou palavras-chave de metadados
//   R2  QR Code em <h1>
//   R3  QR Code em JSON-LD
//   R4  porcentagem, "mais chance", "garantido", "imediato", "adesivo" ou "parceiro" em texto público
//       sem linha correspondente no registro de afirmações (BACKFINDR.md, seção 9-B)
//
// Uso: node tools/check-public-claims.mjs [--all]   (sem --all, mostra no máximo 40 avisos)

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = process.cwd();
const SHOW_ALL = process.argv.includes('--all');

// Áreas que não são texto público
const EXCLUDED_DIRS = new Set(['admin', 'api', 'dashboard', 'parceiro', 'portaria', 'custody', 'delivery', 'condominio']);
const PUBLIC_FILE = /(page|layout|client)\.tsx$/;

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (dir === join(ROOT, 'src', 'app') && EXCLUDED_DIRS.has(name)) continue;
      if (name === 'node_modules') continue;
      walk(full, out);
    } else if (PUBLIC_FILE.test(name)) {
      out.push(full);
    }
  }
  return out;
}

function lineOf(text, index) {
  return text.slice(0, index).split('\n').length;
}

// ── Registro de afirmações ──────────────────────────────────────────────────
function loadRegistry() {
  const file = join(ROOT, 'BACKFINDR.md');
  if (!existsSync(file)) return [];
  const md = readFileSync(file, 'utf8');
  const m = md.match(/<!-- registro-afirmacoes:inicio -->([\s\S]*?)<!-- registro-afirmacoes:fim -->/);
  if (!m) return [];
  return m[1]
    .split('\n')
    .filter((l) => l.startsWith('|') && !/^\|\s*(Afirmação|---)/.test(l))
    .map((l) => l.split('|').slice(1, -1).map((c) => c.trim()))
    .filter((c) => c.length >= 2)
    .map(([claim, where]) => ({ claim: claim.toLowerCase(), where }));
}
const registry = loadRegistry();

function isRegistered(file, token) {
  const t = token.toLowerCase();
  return registry.some((r) => r.claim.includes(t) && r.where.includes(file));
}

// ── Coleta ──────────────────────────────────────────────────────────────────
const warnings = [];
const warn = (rule, file, line, msg) => warnings.push({ rule, file, line, msg });

const files = [];
const appDir = join(ROOT, 'src', 'app');
if (existsSync(appDir)) files.push(...walk(appDir));
const homeDir = join(ROOT, 'src', 'components', 'home');
if (existsSync(homeDir)) {
  for (const n of readdirSync(homeDir)) if (n.endsWith('.tsx')) files.push(join(homeDir, n));
}

const QR = /\bQR\b|qr ?code|qrcode/i;
const TERMS = [
  { re: /\d+\s?%/g, label: 'porcentagem' },
  { re: /mais chance/gi, label: '"mais chance"' },
  { re: /garantid[oa]s?/gi, label: '"garantido"' },
  { re: /imediat[oa]s?(?:mente)?/gi, label: '"imediato"' },
  { re: /adesivos?/gi, label: '"adesivo"' },
  { re: /parceir[oa]s?/gi, label: '"parceiro"' },
];

for (const abs of files) {
  const file = relative(ROOT, abs);
  const text = readFileSync(abs, 'utf8');

  // R1: metadados
  const metaBlocks = [];
  const mm = text.match(/export const metadata[\s\S]*?\n\};/);
  if (mm) metaBlocks.push({ block: mm[0], start: text.indexOf(mm[0]) });
  const gm = text.match(/export (?:async )?function generateMetadata[\s\S]*?\n\}\n/);
  if (gm) metaBlocks.push({ block: gm[0], start: text.indexOf(gm[0]) });
  for (const { block, start } of metaBlocks) {
    block.split('\n').forEach((l, i) => {
      if (/(title|description|keywords)\s*:/.test(l) && QR.test(l)) {
        warn('R1', file, lineOf(text, start) + i, 'QR Code em metadados: ' + l.trim().slice(0, 110));
      }
    });
  }

  // R2: H1
  for (const h of text.matchAll(/<h1[\s\S]*?<\/h1>/g)) {
    if (QR.test(h[0])) warn('R2', file, lineOf(text, h.index), 'QR Code em <h1>');
  }

  // R3: JSON-LD
  for (const j of text.matchAll(/ld\+json/g)) {
    const around = text.slice(j.index, j.index + 1200);
    if (QR.test(around)) warn('R3', file, lineOf(text, j.index), 'QR Code em JSON-LD');
  }

  // R4: termos sem registro (ignora linhas de comentário)
  text.split('\n').forEach((l, i) => {
    const t = l.trim();
    if (t.startsWith('//') || t.startsWith('*') || t.startsWith('/*') || t.startsWith('{/*')) return;
    // Percentuais de CSS (gradientes, estilos em linha, classes com colchetes) não são afirmações
    const css = l
      .replace(/(?:linear|radial|conic)-gradient\([^)]*\)/g, '')
      .replace(/style=\{\{[^}]*\}\}/g, '')
      .replace(/\[[^\]]*%[^\]]*\]/g, '');
    const looksLikeCss = /@keyframes|\b(?:border-radius|box-shadow|width|height|transform|opacity|backgroundImage|background)\b|gradient\(|translate[XY]?\(|^\s*\d+%\s*[,{]/.test(l);
    for (const { re, label } of TERMS) {
      if (label === 'porcentagem' && looksLikeCss) continue;
      re.lastIndex = 0;
      const hit = re.exec(label === 'porcentagem' ? css : l);
      if (hit && !isRegistered(file, hit[0])) {
        warn('R4', file, i + 1, `${label} sem entrada no registro de afirmações: ${t.slice(0, 100)}`);
      }
    }
  });
}

// ── Saída ───────────────────────────────────────────────────────────────────
const byRule = warnings.reduce((acc, w) => ((acc[w.rule] = (acc[w.rule] || 0) + 1), acc), {});
if (warnings.length === 0) {
  console.log('[afirmações] nenhum aviso.');
} else {
  console.log(`[afirmações] ${warnings.length} aviso(s) (somente aviso, o build não é afetado). ` +
    Object.entries(byRule).map(([k, v]) => `${k}: ${v}`).join(' | '));
  const list = SHOW_ALL ? warnings : warnings.slice(0, 40);
  for (const w of list) console.log(`  AVISO [${w.rule}] ${w.file}:${w.line}  ${w.msg}`);
  if (!SHOW_ALL && warnings.length > list.length) console.log(`  ... mais ${warnings.length - list.length} (use --all)`);
  console.log('  Registro de afirmações: BACKFINDR.md, seção 9-B.');
}
process.exit(0);
