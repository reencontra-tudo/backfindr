#!/usr/bin/env node
/**
 * Remoção de arquivos de ocorrências anonimizadas (job SEPARADO e DESLIGADO por padrão).
 * O banco só ENFILEIRA caminhos (audit.files_pending_removal); este job remove do armazenamento e registra na trilha
 * (audit.account_events: 'files_removed' com CAMINHO e data de cada arquivo — nunca o conteúdo).
 *
 * Liga somente com GOV_FILE_REMOVAL_ENABLED=true. Modos de armazenamento (GOV_STORAGE_MODE):
 *   local-test  → apaga arquivos em GOV_TEST_STORAGE_DIR/<caminho> (SÓ para testes em banco descartável);
 *   r2          → apaga no bucket R2 (R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME). NÃO testado contra o R2 real.
 * Arquivos do Supabase Storage ficam 'failed' (nao_suportado) até existir um adaptador revisado; nada é removido por engano.
 * Uso: DATABASE_URL=... GOV_FILE_REMOVAL_ENABLED=true GOV_STORAGE_MODE=local-test GOV_TEST_STORAGE_DIR=/tmp/x node docs/migrations/tools/gov-remove-pending-files.mjs
 */
import pg from 'pg';
import { rm } from 'node:fs/promises';
import { join, normalize, sep } from 'node:path';

if (process.env.GOV_FILE_REMOVAL_ENABLED !== 'true') {
  console.log('gov-remove-pending-files: DESLIGADO (defina GOV_FILE_REMOVAL_ENABLED=true para executar).');
  process.exit(0);
}
const mode = process.env.GOV_STORAGE_MODE || '';
const MAX_ATTEMPTS = 5;
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

async function removeLocalTest(path) {
  const base = normalize(process.env.GOV_TEST_STORAGE_DIR || '');
  if (!base || base === sep) throw new Error('GOV_TEST_STORAGE_DIR ausente');
  const alvo = normalize(join(base, path));
  if (!alvo.startsWith(base + sep)) throw new Error('caminho fora do diretório de teste');
  await rm(alvo, { force: true });
}
async function removeR2(path) {
  const { S3Client, DeleteObjectCommand } = await import('@aws-sdk/client-s3');
  const s3 = new S3Client({ region: 'auto', endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: process.env.R2_ACCESS_KEY_ID, secretAccessKey: process.env.R2_SECRET_ACCESS_KEY } });
  await s3.send(new DeleteObjectCommand({ Bucket: process.env.R2_BUCKET_NAME, Key: path }));
}
async function remove(row) {
  if (mode === 'local-test') return removeLocalTest(row.path);
  if (mode === 'r2' && row.storage === 'r2') return removeR2(row.path);
  throw new Error('nao_suportado');
}

const { rows } = await client.query(`SELECT id, object_id, storage, path, attempts FROM audit.files_pending_removal WHERE status = 'pending' ORDER BY id LIMIT 200`);
const porObjeto = new Map();
for (const row of rows) {
  try {
    await remove(row);
    const r = await client.query(`UPDATE audit.files_pending_removal SET status='removed', removed_at=now(), attempts=attempts+1, last_error=NULL WHERE id=$1 RETURNING removed_at`, [row.id]);
    (porObjeto.get(row.object_id) ?? porObjeto.set(row.object_id, { ok: [], falha: [] }).get(row.object_id)).ok.push({ path: row.path, removed_at: r.rows[0].removed_at });
  } catch (e) {
    const classe = String(e?.message || e).slice(0, 60);        // só a classe do erro, sem conteúdo
    const status = row.attempts + 1 >= MAX_ATTEMPTS || classe === 'nao_suportado' ? 'failed' : 'pending';
    await client.query(`UPDATE audit.files_pending_removal SET status=$2, attempts=attempts+1, last_error=$3 WHERE id=$1`, [row.id, status, classe]);
    (porObjeto.get(row.object_id) ?? porObjeto.set(row.object_id, { ok: [], falha: [] }).get(row.object_id)).falha.push({ path: row.path, erro: classe });
  }
}
for (const [objectId, r] of porObjeto) {
  if (r.ok.length) await client.query(`SELECT audit.log_event('files_removed', NULL, 'sistema', $1, 'docs/migrations/tools/gov-remove-pending-files', NULL, $2::jsonb)`, [objectId, JSON.stringify({ arquivos: r.ok })]);
  if (r.falha.length) await client.query(`SELECT audit.log_event('files_removal_failed', NULL, 'sistema', $1, 'docs/migrations/tools/gov-remove-pending-files', NULL, $2::jsonb)`, [objectId, JSON.stringify({ arquivos: r.falha })]);
}
console.log(`gov-remove-pending-files: ${rows.length} item(ns) processado(s) em modo ${mode || '(nenhum)'}.`);
await client.end();
