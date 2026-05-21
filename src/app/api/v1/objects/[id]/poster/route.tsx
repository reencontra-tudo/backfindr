import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';
import { query } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Formatos suportados
const FORMATS = {
  square:   { width: 1080, height: 1080 },
  vertical: { width: 1080, height: 1920 },
  a4:       { width: 2480, height: 3508 }, // A4 retrato a 300dpi — ideal para impressão
} as const;

type Format = keyof typeof FORMATS;

const STATUS_CONFIG: Record<string, { label: string; bg: string; color: string }> = {
  lost:      { label: 'PERDIDO',    bg: '#EF4444', color: '#ffffff' },
  found:     { label: 'ACHADO',     bg: '#14B8A6', color: '#ffffff' },
  stolen:    { label: 'ROUBADO',    bg: '#F97316', color: '#ffffff' },
  returned:  { label: 'RECUPERADO', bg: '#22C55E', color: '#ffffff' },
  protected: { label: 'PROTEGIDO',  bg: '#3B82F6', color: '#ffffff' },
};

const CATEGORY_LABEL: Record<string, string> = {
  phone: 'Celular / Smartphone', wallet: 'Carteira / Bolsa', keys: 'Chaves',
  bag: 'Bolsa / Mochila', pet: 'Animal de Estimação', bike: 'Bicicleta',
  vehicle: 'Veículo', document: 'Documento', jewelry: 'Joia / Acessório',
  electronics: 'Eletrônico', clothing: 'Roupa / Vestuário', other: 'Outro',
};

const CATEGORY_EMOJI: Record<string, string> = {
  phone: '📱', wallet: '👛', keys: '🔑', bag: '🎒', pet: '🐾',
  bike: '🚲', vehicle: '🚗', document: '📄', jewelry: '💍',
  electronics: '💻', clothing: '👕', other: '📦',
};

// GET /api/v1/objects/[id]/poster?format=square|vertical|a4&template=simple|rich
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const url      = new URL(request.url);
    const format   = (url.searchParams.get('format') ?? 'vertical') as Format;
    const template = (url.searchParams.get('template') ?? 'simple') as 'simple' | 'rich';
    const { width, height } = FORMATS[format] ?? FORMATS.vertical;

    // Buscar objeto no banco — incluindo created_at
    const result = await query(
      `SELECT 
        o.id, o.title, o.description, o.status, o.category, o.qr_code, o.images,
        o.location, o.reward_amount, o.created_at,
        CASE 
          WHEN b.id IS NOT NULL AND b.status = 'active' AND b.expires_at > NOW() 
          THEN true 
          ELSE false 
        END as has_active_boost,
        b.type as boost_type
       FROM objects o
       LEFT JOIN boosts b ON o.id = b.object_id
       WHERE o.id::text = $1 OR o.qr_code = $1
       LIMIT 1`,
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
      created_at: string;
      has_active_boost: boolean;
      boost_type: string | null;
    };

    // Template automático se houver boost ativo
    const effectiveTemplate = obj.has_active_boost ? 'rich' : template;

    // Foto do objeto
    let photos: string[] = [];
    try {
      if (Array.isArray(obj.images)) {
        photos = obj.images;
      } else if (typeof obj.images === 'string') {
        if (obj.images.startsWith('[') || obj.images.startsWith('{')) {
          photos = JSON.parse(obj.images);
        } else if (obj.images.trim() !== '') {
          photos = [obj.images.trim()];
        }
      }
    } catch {
      photos = [];
    }
    const photoUrl = photos[0] ?? null;

    const statusCfg = STATUS_CONFIG[obj.status] ?? STATUS_CONFIG.lost;
    const emoji     = CATEGORY_EMOJI[obj.category] ?? '📦';
    const catLabel  = CATEGORY_LABEL[obj.category] ?? obj.category;

    const appUrl  = process.env.NEXT_PUBLIC_APP_URL ?? 'https://backfindr.com';
    const pageUrl = `${appUrl}/scan/${obj.qr_code}`;
    const qrSize  = format === 'a4' ? 400 : 280;
    const qrUrl   = `https://api.qrserver.com/v1/create-qr-code/?size=${qrSize}x${qrSize}&data=${encodeURIComponent(pageUrl)}&bgcolor=ffffff&color=0a0e14&margin=10`;

    // Converter imagens para Base64
    const getBase64 = async (imageUrl: string) => {
      try {
        const res = await fetch(imageUrl);
        if (!res.ok) return null;
        const buffer = await res.arrayBuffer();
        const base64 = Buffer.from(buffer).toString('base64');
        const contentType = res.headers.get('content-type') || 'image/png';
        return `data:${contentType};base64,${base64}`;
      } catch {
        return null;
      }
    };

    const [photoBase64, qrBase64] = await Promise.all([
      photoUrl ? getBase64(photoUrl) : Promise.resolve(null),
      getBase64(qrUrl)
    ]);

    // Textos truncados — A4 suporta mais texto
    const maxDesc  = format === 'a4' ? 300 : 180;
    const maxTitle = format === 'a4' ? 80  : 55;
    const desc     = obj.description ?? '';
    const descTrunc  = desc.length > maxDesc  ? desc.slice(0, maxDesc - 3) + '…'  : desc;
    const title      = obj.title.length > maxTitle ? obj.title.slice(0, maxTitle - 3) + '…' : obj.title;

    // Localização
    let address = '';
    try {
      if (obj.location) {
        const loc = typeof obj.location === 'string' ? JSON.parse(obj.location) : obj.location;
        address = loc.address ?? '';
      }
    } catch { address = ''; }

    // Data de registro
    const createdAt = obj.created_at
      ? new Date(obj.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
      : '';

    // Escala para A4 (tudo ~2.3x maior)
    const scale = format === 'a4' ? 2.3 : 1;
    const isA4  = format === 'a4';

    // Alturas proporcionais
    const headerPad  = Math.round(60  * scale);
    const sidePad    = Math.round(80  * scale);
    const photoH     = Math.round((format === 'vertical' ? 560 : format === 'a4' ? 900 : 460) * (isA4 ? 1 : 1));
    const gap        = Math.round(40  * scale);

    // Cores
    const richAccent = '#FFD700';
    const richGlow   = 'rgba(255, 215, 0, 0.3)';
    const isRich     = effectiveTemplate === 'rich';
    const isPrint    = isA4; // A4 usa tema claro para economizar tinta

    // Paleta dinâmica (escura para digital, clara para impressão)
    const bg         = isPrint ? '#ffffff' : (isRich ? 'linear-gradient(135deg, #0a0e14 0%, #1a1f2a 100%)' : '#0a0e14');
    const textPrimary   = isPrint ? '#111827' : '#ffffff';
    const textSecondary = isPrint ? '#6b7280' : '#ffffff60';
    const textMuted     = isPrint ? '#9ca3af' : '#ffffff30';
    const cardBg        = isPrint ? '#f9fafb' : 'rgba(255,255,255,0.04)';
    const cardBorder    = isPrint ? '#e5e7eb' : 'rgba(255,255,255,0.08)';
    const photoBg       = isPrint ? '#f3f4f6' : (isRich ? 'rgba(255,215,0,0.1)' : 'rgba(255,255,255,0.05)');
    const photoBorder   = isPrint ? '#e5e7eb' : (isRich ? `${richAccent}66` : 'rgba(255,255,255,0.1)');

    const imageResponse = new ImageResponse(
      (
        <div
          style={{
            width: `${width}px`,
            height: `${height}px`,
            background: bg,
            display: 'flex',
            flexDirection: 'column',
            position: 'relative',
            overflow: 'hidden',
            fontFamily: 'sans-serif',
          }}
        >
          {/* Círculos decorativos de fundo */}
          <div style={{
            position: 'absolute', top: '-200px', right: '-200px',
            width: `${800 * scale}px`, height: `${800 * scale}px`,
            borderRadius: '50%',
            background: isPrint ? 'transparent' : `radial-gradient(circle, ${statusCfg.bg}15 0%, transparent 70%)`,
            display: 'flex',
          }} />
          <div style={{
            position: 'absolute', bottom: '-100px', left: '-100px',
            width: `${600 * scale}px`, height: `${600 * scale}px`,
            borderRadius: '50%',
            background: isPrint ? 'transparent' : (isRich
              ? `radial-gradient(circle, ${richGlow} 0%, transparent 70%)`
              : `radial-gradient(circle, #14B8A610 0%, transparent 70%)`),
            display: 'flex',
          }} />

          {/* Badge Premium */}
          {isRich && (
            <div style={{
              position: 'absolute', top: `${40 * scale}px`, right: `${40 * scale}px`,
              background: `linear-gradient(135deg, ${richAccent} 0%, #FFA500 100%)`,
              color: '#0a0e14', padding: `${12 * scale}px ${32 * scale}px`,
              borderRadius: `${50 * scale}px`, fontSize: `${20 * scale}px`,
              fontWeight: 900, zIndex: 20,
              boxShadow: `0 10px 30px ${richGlow}`,
              textTransform: 'uppercase', letterSpacing: '2px',
              display: 'flex', alignItems: 'center', gap: `${8 * scale}px`,
            }}>
              ⭐ IMPULSIONADO
            </div>
          )}

          {/* Header */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: `${headerPad}px ${sidePad}px ${Math.round(40 * scale)}px`,
            position: 'relative', zIndex: 10,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: `${20 * scale}px` }}>
              <div style={{
                width: `${64 * scale}px`, height: `${64 * scale}px`,
                background: isRich
                  ? `linear-gradient(135deg, ${richAccent} 0%, #FFA500 100%)`
                  : 'linear-gradient(135deg, #14B8A6 0%, #0D9488 100%)',
                borderRadius: `${18 * scale}px`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: `${32 * scale}px`,
                boxShadow: isRich
                  ? `0 10px 20px ${richGlow}`
                  : '0 10px 20px rgba(20, 184, 166, 0.3)',
              }}>
                📍
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ color: textPrimary, fontSize: `${36 * scale}px`, fontWeight: 800, letterSpacing: '-1px' }}>
                  backfindr
                </span>
                <span style={{ color: textSecondary, fontSize: `${18 * scale}px`, fontWeight: 500 }}>
                  {isRich ? 'Recuperação Premium' : 'Recuperação Inteligente'}
                </span>
              </div>
            </div>
            <div style={{
              background: statusCfg.bg, color: statusCfg.color,
              fontSize: `${32 * scale}px`, fontWeight: 900,
              padding: `${16 * scale}px ${48 * scale}px`,
              borderRadius: `${20 * scale}px`,
              boxShadow: `0 15px 30px ${statusCfg.bg}44`,
              textTransform: 'uppercase', letterSpacing: '4px',
              display: 'flex',
            }}>
              {statusCfg.label}
            </div>
          </div>

          {/* Foto — object-fit: contain para não cortar */}
          <div style={{
            margin: `0 ${sidePad}px`,
            height: `${photoH}px`,
            borderRadius: `${40 * scale}px`,
            padding: `${12 * scale}px`,
            background: photoBg,
            border: `${isPrint ? 1 : (isRich ? 2 : 1) * scale}px solid ${photoBorder}`,
            boxShadow: isPrint ? '0 4px 12px rgba(0,0,0,0.08)' : (isRich
              ? `0 30px 60px ${richGlow}, inset 0 0 30px ${richGlow}`
              : '0 30px 60px rgba(0,0,0,0.5)'),
            display: 'flex',
            position: 'relative',
            zIndex: 5,
            overflow: 'hidden',
          }}>
            {photoBase64 ? (
              <div style={{
                width: '100%', height: '100%',
                borderRadius: `${32 * scale}px`,
                overflow: 'hidden',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: '#ffffff',
              }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photoBase64}
                  alt={obj.title}
                  width={width - sidePad * 2 - 24}
                  height={photoH - 24}
                  style={{
                    objectFit: 'contain',
                    objectPosition: 'center center',
                    maxWidth: '100%',
                    maxHeight: '100%',
                  }}
                />
              </div>
            ) : (
              <div style={{
                width: '100%', height: '100%',
                borderRadius: `${32 * scale}px`,
                background: isRich
                  ? 'linear-gradient(135deg, #2a2f3a 0%, #1a1f2a 100%)'
                  : 'linear-gradient(135deg, #1a1f2a 0%, #0a0e14 100%)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: `${180 * scale}px`,
              }}>
                {emoji}
              </div>
            )}
          </div>

          {/* Conteúdo Principal */}
          <div style={{
            display: 'flex',
            flexDirection: format === 'square' ? 'row' : 'column',
            flex: 1,
            padding: `${gap / 2}px ${sidePad}px ${gap}px`,
            gap: `${Math.round(gap * 0.6)}px`,
            alignItems: format === 'square' ? 'flex-start' : 'stretch',
            position: 'relative',
            zIndex: 10,
          }}>
            {/* Bloco de Texto */}
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1, gap: `${Math.round(14 * scale)}px` }}>

              {/* Título + categoria */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: `${8 * scale}px` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: `${12 * scale}px` }}>
                  <span style={{ fontSize: `${40 * scale}px` }}>{emoji}</span>
                  <span style={{
                    color: isPrint ? '#0D9488' : (isRich ? richAccent : '#14B8A6'),
                    fontSize: `${22 * scale}px`, fontWeight: 700,
                    textTransform: 'uppercase', letterSpacing: '2px',
                  }}>
                    {catLabel}
                  </span>
                </div>
                <h1 style={{
                  color: textPrimary,
                  fontSize: format === 'a4' ? `${60 * scale}px` : format === 'vertical' ? `${60 * scale}px` : `${56 * scale}px`,
                  fontWeight: 900, lineHeight: 1.05, margin: 0, letterSpacing: '-1px',
                  display: 'flex',
                }}>
                  {title}
                </h1>
              </div>

              {/* Descrição */}
              {descTrunc && (
                <div style={{
                  background: cardBg,
                  border: `1px solid ${cardBorder}`,
                  borderRadius: `${16 * scale}px`,
                  padding: `${16 * scale}px ${20 * scale}px`,
                  display: 'flex',
                }}>
                  <p style={{
                    color: isPrint ? '#374151' : '#ffffffcc',
                    fontSize: `${26 * scale}px`,
                    lineHeight: 1.5, margin: 0, fontWeight: 400,
                    display: 'flex',
                  }}>
                    {descTrunc}
                  </p>
                </div>
              )}

              {/* Dados da ocorrência */}
              <div style={{
                display: 'flex', flexDirection: 'column',
                gap: `${12 * scale}px`,
                background: cardBg,
                border: `1px solid ${cardBorder}`,
                borderRadius: `${16 * scale}px`,
                padding: `${16 * scale}px ${20 * scale}px`,
              }}>
                {createdAt && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: `${12 * scale}px` }}>
                    <span style={{ fontSize: `${22 * scale}px` }}>📅</span>
                    <span style={{ color: textSecondary, fontSize: `${22 * scale}px`, fontWeight: 600 }}>Registrado em</span>
                    <span style={{ color: textPrimary, fontSize: `${22 * scale}px`, fontWeight: 700, marginLeft: 'auto' }}>{createdAt}</span>
                  </div>
                )}
                {address && (
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: `${12 * scale}px` }}>
                    <span style={{ fontSize: `${22 * scale}px`, flexShrink: 0 }}>📍</span>
                    <span style={{ color: textSecondary, fontSize: `${22 * scale}px`, fontWeight: 600, flexShrink: 0 }}>Local</span>
                    <span style={{ color: textPrimary, fontSize: `${22 * scale}px`, fontWeight: 500, marginLeft: 'auto', textAlign: 'right' }}>{address}</span>
                  </div>
                )}
              </div>

              {/* Recompensa */}
              {obj.reward_amount && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: `${20 * scale}px`,
                  background: 'linear-gradient(90deg, #F59E0B22 0%, #F59E0B11 100%)',
                  border: `2px solid #F59E0B44`,
                  borderRadius: `${24 * scale}px`,
                  padding: `${20 * scale}px ${28 * scale}px`,
                }}>
                  <span style={{ fontSize: `${40 * scale}px` }}>💰</span>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ color: '#F59E0B90', fontSize: `${18 * scale}px`, fontWeight: 700, textTransform: 'uppercase' }}>Recompensa Oferecida</span>
                    <span style={{ color: '#F59E0B', fontSize: `${36 * scale}px`, fontWeight: 900 }}>
                      R$ {Number(obj.reward_amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* QR Code */}
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              gap: `${20 * scale}px`,
              background: isPrint ? '#f0fdfa' : (isRich
                ? `linear-gradient(135deg, rgba(255,215,0,0.08) 0%, rgba(255,165,0,0.04) 100%)`
                : 'rgba(255,255,255,0.03)'),
              padding: `${32 * scale}px`,
              borderRadius: `${32 * scale}px`,
              border: isPrint ? '2px solid #0D9488' : (isRich ? `1px solid ${richAccent}44` : '1px solid rgba(255,255,255,0.08)'),
              flexShrink: 0,
              alignSelf: format === 'square' ? 'flex-start' : 'center',
            }}>
              <div style={{
                background: '#ffffff', borderRadius: `${24 * scale}px`,
                padding: `${24 * scale}px`, display: 'flex',
                boxShadow: isRich ? `0 20px 40px ${richGlow}` : '0 20px 40px rgba(0,0,0,0.3)',
              }}>
                {qrBase64 && (
                  <img
                    src={qrBase64}
                    alt="QR Code"
                    width={isA4 ? 400 : format === 'vertical' ? 240 : 220}
                    height={isA4 ? 400 : format === 'vertical' ? 240 : 220}
                  />
                )}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: `${4 * scale}px` }}>
                <span style={{ color: isPrint ? '#0D9488' : '#ffffff', fontSize: `${24 * scale}px`, fontWeight: 700 }}>AJUDE A ENCONTRAR</span>
                <span style={{ color: isPrint ? '#6b7280' : '#ffffff60', fontSize: `${18 * scale}px`, fontWeight: 500 }}>Escaneie o código acima</span>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: `${Math.round(30 * scale)}px ${sidePad}px ${Math.round(50 * scale)}px`,
            background: isPrint ? '#f9fafb' : (isRich
              ? `linear-gradient(90deg, rgba(255,215,0,0.05) 0%, rgba(255,165,0,0.02) 100%)`
              : 'rgba(0,0,0,0.2)'),
            borderTop: isPrint ? '1px solid #e5e7eb' : (isRich ? `1px solid ${richAccent}22` : '1px solid rgba(255,255,255,0.05)'),
            position: 'relative', zIndex: 10,
          }}>
            <span style={{
              color: isPrint ? '#9ca3af' : (isRich ? richAccent : '#ffffff30'),
              fontSize: `${22 * scale}px`, fontWeight: 500, letterSpacing: '1px',
            }}>
              {appUrl.replace('https://', '').toUpperCase()} · REDE GLOBAL DE RECUPERAÇÃO
            </span>
          </div>
        </div>
      ),
      { width, height }
    );

    const headers = new Headers(imageResponse.headers);
    headers.set(
      'Content-Disposition',
      `attachment; filename="cartaz-${obj.qr_code}-${format}-${effectiveTemplate}.png"`
    );

    return new Response(imageResponse.body, {
      status: imageResponse.status,
      headers,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Erro desconhecido';
    console.error('[poster] erro:', msg);
    return new Response(`Erro ao gerar cartaz: ${msg}`, { status: 500 });
  }
}
