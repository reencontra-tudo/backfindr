import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';
import { query } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Formatos suportados
const FORMATS = {
  square:   { width: 1080, height: 1080 },
  vertical: { width: 1080, height: 1920 },
} as const;

type Format = keyof typeof FORMATS;

const STATUS_CONFIG: Record<string, { label: string; bg: string; color: string }> = {
  lost:      { label: 'PERDIDO',    bg: '#EF4444', color: '#ffffff' },
  found:     { label: 'ACHADO',     bg: '#14B8A6', color: '#ffffff' },
  stolen:    { label: 'ROUBADO',    bg: '#F97316', color: '#ffffff' },
  returned:  { label: 'RECUPERADO', bg: '#22C55E', color: '#ffffff' },
  protected: { label: 'PROTEGIDO',  bg: '#3B82F6', color: '#ffffff' },
};

const CATEGORY_EMOJI: Record<string, string> = {
  phone: '📱', wallet: '👛', keys: '🔑', bag: '🎒', pet: '🐾',
  bike: '🚲', vehicle: '🚗', document: '📄', jewelry: '💍',
  electronics: '💻', clothing: '👕', other: '📦',
};

// GET /api/v1/objects/[id]/poster?format=square|vertical
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const url    = new URL(request.url);
    const format = (url.searchParams.get('format') ?? 'square') as Format;
    const { width, height } = FORMATS[format] ?? FORMATS.square;

    // Buscar objeto no banco
    const result = await query(
      `SELECT id, title, description, status, category, qr_code, images,
              location, reward_amount
       FROM objects
       WHERE id = $1 OR qr_code = $1`,
      [params.id]
    );

    if (result.rows.length === 0) {
      return new Response('Objeto não encontrado', { status: 404 });
    }

    const obj = result.rows[0] as {
      id: string;
      title: string;
      description: string | null;
      status: string;
      category: string;
      qr_code: string;
      images: string | string[];
      location: string | null;
      reward_amount: number | null;
    };

    // Foto do objeto
    let photos: string[] = [];
    try {
      if (Array.isArray(obj.images)) {
        photos = obj.images;
      } else if (typeof obj.images === 'string') {
        if (obj.images.startsWith('[') || obj.images.startsWith('{')) {
          photos = JSON.parse(obj.images);
        } else if (obj.images.trim() !== '') {
          // Trata como uma única URL se não for JSON
          photos = [obj.images.trim()];
        }
      }
    } catch {
      photos = [];
    }
    const photoUrl = photos[0] ?? null;

    // Config de status
    const statusCfg = STATUS_CONFIG[obj.status] ?? STATUS_CONFIG.lost;
    const emoji     = CATEGORY_EMOJI[obj.category] ?? '📦';

    // URL da ocorrência e QR
    const appUrl    = process.env.NEXT_PUBLIC_APP_URL ?? 'https://backfindr.com';
    const pageUrl   = `${appUrl}/scan/${obj.qr_code}`;
    const qrUrl     = `https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=${encodeURIComponent(pageUrl)}&bgcolor=ffffff&color=0a0e14&margin=10`;

    // Tentar converter imagens para Base64 para evitar fetch externo no ImageResponse
    const getBase64 = async (imageUrl: string) => {
      try {
        const res = await fetch(imageUrl);
        if (!res.ok) return null;
        const buffer = await res.arrayBuffer();
        const base64 = Buffer.from(buffer).toString('base64');
        const contentType = res.headers.get('content-type') || 'image/png';
        return `data:${contentType};base64,${base64}`;
      } catch (e) {
        console.error('Erro ao converter imagem para base64:', e);
        return null;
      }
    };

    const [photoBase64, qrBase64] = await Promise.all([
      photoUrl ? getBase64(photoUrl) : Promise.resolve(null),
      getBase64(qrUrl)
    ]);

    // Truncar descrição
    const desc = obj.description ?? '';
    const descTrunc = desc.length > 160 ? desc.slice(0, 157) + '…' : desc;
    const title = obj.title.length > 50 ? obj.title.slice(0, 47) + '…' : obj.title;

    // Localização
    let address = '';
    try {
      if (obj.location) {
        const loc = JSON.parse(obj.location as string);
        address = loc.address ?? '';
      }
    } catch { address = ''; }

    const isVertical = format === 'vertical';
    const photoH     = isVertical ? 700 : 480;

    // ─── Layout do cartaz ────────────────────────────────────────────────────
    const imageResponse = new ImageResponse(
      (
        <div
          style={{
            width: `${width}px`,
            height: `${height}px`,
            background: '#0a0e14',
            display: 'flex',
            flexDirection: 'column',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {/* Gradiente decorativo no topo */}
          <div
            style={{
              position: 'absolute',
              top: 0, left: 0, right: 0, height: '400px',
              background: `linear-gradient(180deg, ${statusCfg.bg}22 0%, transparent 100%)`,
              display: 'flex',
            }}
          />

          {/* Header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '48px 64px 32px',
              position: 'relative',
              zIndex: 1,
            }}
          >
            {/* Logo Backfindr */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div
                style={{
                  width: '52px', height: '52px',
                  background: '#14B8A6',
                  borderRadius: '14px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '28px',
                }}
              >
                📍
              </div>
              <span style={{ color: '#ffffff', fontSize: '28px', fontWeight: 700 }}>
                backfindr
              </span>
            </div>

            {/* Badge de status */}
            <div
              style={{
                background: statusCfg.bg,
                color: statusCfg.color,
                fontSize: '30px',
                fontWeight: 900,
                padding: '12px 32px',
                borderRadius: '100px',
                letterSpacing: '3px',
                display: 'flex',
              }}
            >
              {statusCfg.label}
            </div>
          </div>

          {/* Foto do objeto */}
          {photoBase64 ? (
            <div
              style={{
                margin: '0 64px',
                height: `${photoH}px`,
                borderRadius: '24px',
                overflow: 'hidden',
                position: 'relative',
                display: 'flex',
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photoBase64}
                alt={obj.title}
                width={width - 128}
                height={photoH}
                style={{
                  objectFit: 'cover',
                }}
              />
            </div>
          ) : (
            /* Placeholder sem foto */
            <div
              style={{
                margin: '0 64px',
                height: `${photoH}px`,
                borderRadius: '24px',
                background: '#1a1f2a',
                border: '2px solid #ffffff10',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '140px',
              }}
            >
              {emoji}
            </div>
          )}

          {/* Conteúdo principal */}
          <div
            style={{
              display: 'flex',
              flexDirection: isVertical ? 'column' : 'row',
              flex: 1,
              padding: '40px 64px',
              gap: '40px',
              alignItems: isVertical ? 'stretch' : 'flex-start',
            }}
          >
            {/* Texto */}
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1, gap: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '36px' }}>{emoji}</span>
                <h1
                  style={{
                    color: '#ffffff',
                    fontSize: isVertical ? '64px' : '52px',
                    fontWeight: 900,
                    lineHeight: 1.1,
                    margin: 0,
                    display: 'flex',
                  }}
                >
                  {title}
                </h1>
              </div>

              {descTrunc && (
                <p
                  style={{
                    color: '#ffffff99',
                    fontSize: isVertical ? '32px' : '26px',
                    lineHeight: 1.5,
                    margin: 0,
                    display: 'flex',
                  }}
                >
                  {descTrunc}
                </p>
              )}

              {address && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '24px' }}>📍</span>
                  <span style={{ color: '#ffffff60', fontSize: '24px' }}>{address}</span>
                </div>
              )}

              {obj.reward_amount && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    background: '#F59E0B22',
                    border: '2px solid #F59E0B44',
                    borderRadius: '16px',
                    padding: '16px 24px',
                    marginTop: '8px',
                  }}
                >
                  <span style={{ fontSize: '28px' }}>🎁</span>
                  <span style={{ color: '#F59E0B', fontSize: '28px', fontWeight: 700 }}>
                    Recompensa: R$ {obj.reward_amount.toFixed(2).replace('.', ',')}
                  </span>
                </div>
              )}
            </div>

            {/* QR Code */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '16px',
                flexShrink: 0,
              }}
            >
              <div
                style={{
                  background: '#ffffff',
                  borderRadius: '20px',
                  padding: '16px',
                  display: 'flex',
                }}
              >
                {qrBase64 && (
                  <img
                    src={qrBase64}
                    alt="QR Code"
                    width={isVertical ? 260 : 200}
                    height={isVertical ? 260 : 200}
                  />
                )}
              </div>
              <span
                style={{
                  color: '#ffffff60',
                  fontSize: '20px',
                  textAlign: 'center',
                  display: 'flex',
                }}
              >
                Escaneie para ajudar
              </span>
            </div>
          </div>

          {/* Footer */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '24px 64px 40px',
              borderTop: '1px solid #ffffff10',
            }}
          >
            <span style={{ color: '#ffffff40', fontSize: '22px' }}>
              {appUrl.replace('https://', '')} · Plataforma de recuperação de objetos perdidos
            </span>
          </div>
        </div>
      ),
      {
        width,
        height,
      }
    );

    // Adicionar header de download
    const headers = new Headers(imageResponse.headers);
    headers.set(
      'Content-Disposition',
      `attachment; filename="cartaz-${obj.qr_code}-${format}.png"`
    );

    return new Response(imageResponse.body, {
      status: imageResponse.status,
      headers,
    });
  } catch (error: any) {
    console.error('[poster] erro:', error);
    return new Response(`Erro ao gerar cartaz: ${error?.message || 'Erro desconhecido'}`, { status: 500 });
  }
}
