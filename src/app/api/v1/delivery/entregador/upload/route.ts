import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/adminGuard';
import { uploadToR2, detectMimeType } from '@/lib/storage';

// POST /api/v1/delivery/entregador/upload
// Upload de documentos do entregador para R2
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ detail: 'Arquivo não encontrado' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const base64 = buffer.toString('base64');
    const mimeType = file.type || detectMimeType(base64);

    const result = await uploadToR2({
      folder: 'misc',
      entityId: auth.user.id,
      data: base64,
      mimeType,
    });

    return NextResponse.json({ url: result.url });
  } catch (e) {
    console.error('Upload error:', e);
    return NextResponse.json(
      { detail: 'Erro no upload. Verifique as credenciais R2.' },
      { status: 500 }
    );
  }
}
