/**
 * lib/storage.ts
 * Abstração de armazenamento de objetos — Cloudflare R2 (S3-compatible)
 *
 * Variáveis de ambiente necessárias:
 *   R2_ACCOUNT_ID       = 14823c21203d8830e4bed1efcb94c91c
 *   R2_ACCESS_KEY_ID    = 3a3361dc7f089dd85b0a63cec7fb914b
 *   R2_SECRET_ACCESS_KEY= 301c69e6d9b4ee6bf17d3cd2d14a7fcb861eb9aac1af46af78c8acd85bc66106
 *   R2_BUCKET_NAME      = backfindr-media
 *   R2_PUBLIC_URL       = https://pub-<hash>.r2.dev  (ou domínio customizado)
 */

import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

// ─── Cliente R2 ───────────────────────────────────────────────────────────────

function getR2Client(): S3Client {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error('R2 credentials not configured. Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY.');
  }

  return new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });
}

const BUCKET = () => process.env.R2_BUCKET_NAME || 'backfindr-media';
const PUBLIC_URL = () => process.env.R2_PUBLIC_URL || '';

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface UploadResult {
  key: string;
  url: string;
}

export type ImageFolder = 'objects' | 'avatars' | 'partners' | 'misc';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Gera uma chave única para o arquivo no bucket.
 * Formato: {folder}/{objectId}/{timestamp}-{random}.{ext}
 */
export function generateKey(
  folder: ImageFolder,
  entityId: string,
  mimeType: string
): string {
  const ext = mimeType.split('/')[1]?.replace('jpeg', 'jpg') || 'jpg';
  const ts = Date.now();
  const rand = Math.random().toString(36).slice(2, 8);
  return `${folder}/${entityId}/${ts}-${rand}.${ext}`;
}

/**
 * Retorna a URL pública de um objeto no R2.
 * Se R2_PUBLIC_URL estiver configurado, usa ele.
 * Caso contrário, gera uma URL pré-assinada válida por 1 hora.
 */
export async function getPublicUrl(key: string): Promise<string> {
  const baseUrl = PUBLIC_URL();
  if (baseUrl) {
    return `${baseUrl.replace(/\/$/, '')}/${key}`;
  }

  // Fallback: URL pré-assinada (válida por 1h)
  const client = getR2Client();
  const command = new HeadObjectCommand({ Bucket: BUCKET(), Key: key });
  const signed = await getSignedUrl(client, command, { expiresIn: 3600 });
  return signed;
}

// ─── Upload ───────────────────────────────────────────────────────────────────

/**
 * Faz upload de um arquivo (Buffer ou Base64) para o R2.
 * Retorna a chave e a URL pública do arquivo.
 */
export async function uploadToR2(params: {
  folder: ImageFolder;
  entityId: string;
  data: Buffer | string; // Buffer ou Base64 string (com ou sem prefixo data:...)
  mimeType: string;
  metadata?: Record<string, string>;
}): Promise<UploadResult> {
  const { folder, entityId, data, mimeType, metadata } = params;

  // Converter Base64 para Buffer se necessário
  let buffer: Buffer;
  if (typeof data === 'string') {
    const base64 = data.includes(',') ? data.split(',')[1] : data;
    buffer = Buffer.from(base64, 'base64');
  } else {
    buffer = data;
  }

  const key = generateKey(folder, entityId, mimeType);
  const client = getR2Client();

  await client.send(
    new PutObjectCommand({
      Bucket: BUCKET(),
      Key: key,
      Body: buffer,
      ContentType: mimeType,
      CacheControl: 'public, max-age=31536000, immutable',
      Metadata: metadata,
    })
  );

  const url = await getPublicUrl(key);
  return { key, url };
}

/**
 * Faz upload de múltiplas imagens em paralelo.
 */
export async function uploadMultipleToR2(params: {
  folder: ImageFolder;
  entityId: string;
  images: Array<{ data: Buffer | string; mimeType: string }>;
}): Promise<UploadResult[]> {
  const { folder, entityId, images } = params;
  return Promise.all(
    images.map((img) =>
      uploadToR2({ folder, entityId, data: img.data, mimeType: img.mimeType })
    )
  );
}

// ─── Delete ───────────────────────────────────────────────────────────────────

/**
 * Remove um arquivo do R2 pela chave.
 */
export async function deleteFromR2(key: string): Promise<void> {
  const client = getR2Client();
  await client.send(
    new DeleteObjectCommand({ Bucket: BUCKET(), Key: key })
  );
}

/**
 * Remove múltiplos arquivos do R2 em paralelo.
 */
export async function deleteMultipleFromR2(keys: string[]): Promise<void> {
  await Promise.all(keys.map(deleteFromR2));
}

// ─── Migração ─────────────────────────────────────────────────────────────────

/**
 * Detecta se uma string é uma URL R2 (já migrada) ou ainda Base64.
 */
export function isR2Url(value: string): boolean {
  return value.startsWith('http://') || value.startsWith('https://');
}

/**
 * Detecta o mimeType de uma string Base64 com prefixo data:...
 */
export function detectMimeType(base64: string): string {
  if (base64.startsWith('data:')) {
    const match = base64.match(/^data:([^;]+);/);
    if (match) return match[1];
  }
  return 'image/jpeg';
}
