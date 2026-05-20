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
       WHERE id::text = $1 OR qr_code = $1`,
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
            fontFamily: 'sans-serif',
          }}
        >
          {/* Background Decorativo - Círculos de Luz */}
          <div
            style={{
              position: 'absolute',
              top: '-200px',
              right: '-200px',
              width: '800px',
              height: '800px',
              borderRadius: '400px',
              background: `radial-gradient(circle, ${statusCfg.bg}15 0%, transparent 70%)`,
              display: 'flex',
            }}
          />
          <div
            style={{
              position: 'absolute',
              bottom: '-100px',
              left: '-100px',
              width: '600px',
              height: '600px',
              borderRadius: '300px',
              background: `radial-gradient(circle, #14B8A610 0%, transparent 70%)`,
              display: 'flex',
            }}
          />

          {/* Header com Glassmorphism */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '60px 80px 40px',
              position: 'relative',
              zIndex: 10,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
              <div
                style={{
                  width: '64px', height: '64px',
                  background: 'linear-gradient(135deg, #14B8A6 0%, #0D9488 100%)',
                  borderRadius: '18px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '32px',
                  boxShadow: '0 10px 20px rgba(20, 184, 166, 0.3)',
                }}
              >
                📍
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ color: '#ffffff', fontSize: '36px', fontWeight: 800, letterSpacing: '-1px' }}>
                  backfindr
                </span>
                <span style={{ color: '#ffffff60', fontSize: '18px', fontWeight: 500 }}>
                  Recuperação Inteligente
                </span>
              </div>
            </div>

            <div
              style={{
                background: statusCfg.bg,
                color: statusCfg.color,
                fontSize: '32px',
                fontWeight: 900,
                padding: '16px 48px',
                borderRadius: '20px',
                boxShadow: `0 15px 30px ${statusCfg.bg}44`,
                textTransform: 'uppercase',
                letterSpacing: '4px',
                display: 'flex',
              }}
            >
              {statusCfg.label}
            </div>
          </div>

          {/* Container da Foto com Moldura e Sombra */}
          <div
            style={{
              margin: '0 80px',
              height: `${photoH}px`,
              borderRadius: '40px',
              padding: '12px',
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              boxShadow: '0 30px 60px rgba(0, 0, 0, 0.5)',
              display: 'flex',
              position: 'relative',
              zIndex: 5,
            }}
          >
            {photoBase64 ? (
              <div
                style={{
                  width: '100%',
                  height: '100%',
                  borderRadius: '32px',
                  overflow: 'hidden',
                  display: 'flex',
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photoBase64}
                  alt={obj.title}
                  width={width - 184}
                  height={photoH - 24}
                  style={{
                    objectFit: 'cover',
                  }}
                />
              </div>
            ) : (
              <div
                style={{
                  width: '100%',
                  height: '100%',
                  borderRadius: '32px',
                  background: 'linear-gradient(135deg, #1a1f2a 0%, #0a0e14 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '180px',
                }}
              >
                {emoji}
              </div>
            )}
          </div>

          {/* Conteúdo Principal */}
          <div
            style={{
              display: 'flex',
              flexDirection: isVertical ? 'column' : 'row',
              flex: 1,
              padding: '60px 80px',
              gap: '60px',
              alignItems: isVertical ? 'center' : 'flex-start',
              position: 'relative',
              zIndex: 10,
            }}
          >
            {/* Bloco de Texto */}
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1, gap: '24px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <span style={{ fontSize: '48px' }}>{emoji}</span>
                  <span style={{ color: '#14B8A6', fontSize: '24px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '2px' }}>
                    {obj.category}
                  </span>
                </div>
                <h1
                  style={{
                    color: '#ffffff',
                    fontSize: isVertical ? '84px' : '72px',
                    fontWeight: 900,
                    lineHeight: 1,
                    margin: 0,
                    letterSpacing: '-2px',
                    display: 'flex',
                  }}
                >
                  {title}
                </h1>
              </div>

              {descTrunc && (
                <p
                  style={{
                    color: '#ffffffcc',
                    fontSize: isVertical ? '36px' : '30px',
                    lineHeight: 1.4,
                    margin: 0,
                    fontWeight: 400,
                    display: 'flex',
                  }}
                >
                  {descTrunc}
                </p>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {address && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px', background: 'rgba(255,255,255,0.03)', padding: '12px 20px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <span style={{ fontSize: '32px' }}>📍</span>
                    <span style={{ color: '#ffffff90', fontSize: '28px', fontWeight: 500 }}>{address}</span>
                  </div>
                )}

                {obj.reward_amount && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '20px',
                      background: 'linear-gradient(90deg, #F59E0B22 0%, #F59E0B11 100%)',
                      border: '2px solid #F59E0B44',
                      borderRadius: '24px',
                      padding: '24px 32px',
                      boxShadow: '0 10px 30px rgba(245, 158, 11, 0.1)',
                    }}
                  >
                    <span style={{ fontSize: '48px' }}>💰</span>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ color: '#F59E0B90', fontSize: '20px', fontWeight: 700, textTransform: 'uppercase' }}>Recompensa Oferecida</span>
                      <span style={{ color: '#F59E0B', fontSize: '42px', fontWeight: 900 }}>
                        R$ {Number(obj.reward_amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Bloco do QR Code com Call to Action */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '24px',
                background: 'rgba(255, 255, 255, 0.03)',
                padding: '40px',
                borderRadius: '40px',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                flexShrink: 0,
              }}
            >
              <div
                style={{
                  background: '#ffffff',
                  borderRadius: '30px',
                  padding: '24px',
                  display: 'flex',
                  boxShadow: '0 20px 40px rgba(0, 0, 0, 0.3)',
                }}
              >
                {qrBase64 && (
                  <img
                    src={qrBase64}
                    alt="QR Code"
                    width={isVertical ? 320 : 240}
                    height={isVertical ? 320 : 240}
                  />
                )}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                <span style={{ color: '#ffffff', fontSize: '28px', fontWeight: 700 }}>AJUDE A ENCONTRAR</span>
                <span style={{ color: '#ffffff60', fontSize: '20px', fontWeight: 500 }}>Escaneie o código acima</span>
              </div>
            </div>
          </div>

          {/* Footer Elegante */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '40px 80px 60px',
              background: 'rgba(0, 0, 0, 0.2)',
              borderTop: '1px solid rgba(255, 255, 255, 0.05)',
              position: 'relative',
              zIndex: 10,
            }}
          >
            <span style={{ color: '#ffffff30', fontSize: '24px', fontWeight: 500, letterSpacing: '1px' }}>
              {appUrl.replace('https://', '').toUpperCase()} · REDE GLOBAL DE RECUPERAÇÃO
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
