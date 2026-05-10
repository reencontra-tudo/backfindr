export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminGuard';
import { S3Client, HeadBucketCommand } from '@aws-sdk/client-s3';

/**
 * GET /api/v1/admin/r2/health
 * Verifica se o Cloudflare R2 está configurado e acessível.
 * Retorna: { status: 'ok' | 'not_configured' | 'error', bucket, configured }
 */
export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;

  const accountId  = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretKey  = process.env.R2_SECRET_ACCESS_KEY;
  const bucketName = process.env.R2_BUCKET_NAME || 'backfindr-media';
  const publicUrl  = process.env.R2_PUBLIC_URL || null;

  if (!accountId || !accessKeyId || !secretKey) {
    return NextResponse.json({
      status: 'not_configured',
      configured: false,
      bucket: bucketName,
      public_url: publicUrl,
    });
  }

  try {
    const client = new S3Client({
      region: 'auto',
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId, secretAccessKey: secretKey },
    });

    const start = Date.now();
    await client.send(new HeadBucketCommand({ Bucket: bucketName }));
    const latency = Date.now() - start;

    return NextResponse.json({
      status: 'ok',
      configured: true,
      bucket: bucketName,
      public_url: publicUrl,
      latency_ms: latency,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({
      status: 'error',
      configured: true,
      bucket: bucketName,
      public_url: publicUrl,
      error: message,
    }, { status: 200 }); // 200 para não quebrar o frontend
  }
}
