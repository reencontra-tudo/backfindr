'use server';
import { NextRequest } from 'next/server';
import { ImageResponse } from 'next/og';
import { query } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const FORMATS = {
  square:   { width: 1080, height: 1080 },
  vertical: { width: 1080, height: 1920 },
  a4:       { width: 2480, height: 3508 },
} as const;

type Format = keyof typeof FORMATS;

// Configuração completa por status
const STATUS_CONFIG: Record<string, {
  label: string; bg: string; color: string;
  headline: (cat: string) => string;
  cta: string;
  accentColor: string;
}> = {
  lost: {
    label: 'PERDIDO', bg: '#EF4444', color: '#ffffff', accentColor: '#EF4444',
    headline: (cat) => `PERDI MINHA\n${cat.toUpperCase()}`,
    cta: 'Você viu? Escaneie e avise o dono!',
  },
  found: {
    label: 'ENCONTRADO', bg: '#14B8A6', color: '#ffffff', accentColor: '#14B8A6',
    headline: (cat) => `ENCONTREI\nUMA ${cat.toUpperCase()}`,
    cta: 'É seu? Escaneie o QR Code e reivindique!',
  },
  stolen: {
    label: 'ROUBADO', bg: '#DC2626', color: '#ffffff', accentColor: '#DC2626',
    headline: (cat) => `ROUBARAM\nMINHA ${cat.toUpperCase()}`,
    cta: 'Viu este objeto? Escaneie e denuncie!',
  },
  stolen_pickpocket: {
    label: 'FURTADO', bg: '#B91C1C', color: '#ffffff', accentColor: '#B91C1C',
    headline: (cat) => `FURTARAM\nMINHA ${cat.toUpperCase()}`,
    cta: 'Viu este objeto? Escaneie e denuncie!',
  },
  in_possession: {
    label: 'EM POSSE', bg: '#F59E0B', color: '#ffffff', accentColor: '#F59E0B',
    headline: (cat) => `TENHO\nUMA ${cat.toUpperCase()}`,
    cta: 'Reconhece? Escaneie e entre em contato!',
  },
  returned: {
    label: 'RECUPERADO', bg: '#22C55E', color: '#ffffff', accentColor: '#22C55E',
    headline: (cat) => `RECUPEREI\nMINHA ${cat.toUpperCase()}`,
    cta: 'Objeto recuperado com sucesso via Backfindr',
  },
  protected: {
    label: 'PROTEGIDO', bg: '#3B82F6', color: '#ffffff', accentColor: '#3B82F6',
    headline: (cat) => `PROTEGENDO\nMINHA ${cat.toUpperCase()}`,
    cta: 'Escaneie o QR Code para mais informações',
  },
};

const CATEGORY_LABEL: Record<string, string> = {
  phone: 'Celular', wallet: 'Carteira', keys: 'Chaves',
  bag: 'Mochila', pet: 'Pet', bike: 'Bicicleta',
  vehicle: 'Veículo', document: 'Documento', jewelry: 'Joia',
  electronics: 'Eletrônico', clothing: 'Roupa', other: 'Objeto',
};

const CATEGORY_EMOJI: Record<string, string> = {
  phone: '📱', wallet: '👛', keys: '🔑', bag: '🎒', pet: '🐾',
  bike: '🚲', vehicle: '🚗', document: '📄', jewelry: '💍',
  electronics: '💻', clothing: '👕', other: '📦',
};

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const url      = new URL(request.url);
    const format   = (url.searchParams.get('format') ?? 'vertical') as Format;
    const template = (url.searchParams.get('template') ?? 'simple') as 'simple' | 'rich';
    const { width, height } = FORMATS[format] ?? FORMATS.vertical;

    const result = await query(
      `SELECT 
        o.id, o.title, o.description, o.status, o.category, o.qr_code, o.images,
        o.location, o.reward_amount, o.created_at,
        CASE 
          WHEN b.id IS NOT NULL AND b.status = 'active' AND b.expires_at > NOW() 
          THEN true ELSE false 
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
      id: string; title: string; description: string | null;
      status: string; category: string; qr_code: string;
      images: string | string[]; location: string | null;
      reward_amount: number | null; created_at: string;
      has_active_boost: boolean; boost_type: string | null;
    };

    const effectiveTemplate = obj.has_active_boost ? 'rich' : template;
    const isRich = effectiveTemplate === 'rich';
    const isA4   = format === 'a4';
    const isPrint = isA4;

    // Foto
    let photos: string[] = [];
    try {
      if (Array.isArray(obj.images)) photos = obj.images;
      else if (typeof obj.images === 'string') {
        if (obj.images.startsWith('[') || obj.images.startsWith('{')) photos = JSON.parse(obj.images);
        else if (obj.images.trim()) photos = [obj.images.trim()];
      }
    } catch { photos = []; }
    const photoUrl = photos[0] ?? null;

    const statusCfg  = STATUS_CONFIG[obj.status] ?? STATUS_CONFIG.lost;
    const emoji      = CATEGORY_EMOJI[obj.category] ?? '📦';
    const catLabel   = CATEGORY_LABEL[obj.category] ?? 'Objeto';
    const catFull    = `${CATEGORY_LABEL[obj.category] ?? obj.category}`;
    const headlineRaw = statusCfg.headline(catLabel);
    const headlineParts = headlineRaw.split('\n');

    const appUrl  = process.env.NEXT_PUBLIC_APP_URL ?? 'https://backfindr.com';
    const pageUrl = `${appUrl}/scan/${obj.qr_code}`;
    const qrSize  = isA4 ? 400 : 280;
    const qrUrl   = `https://api.qrserver.com/v1/create-qr-code/?size=${qrSize}x${qrSize}&data=${encodeURIComponent(pageUrl)}&bgcolor=ffffff&color=111827&margin=10`;

    const getBase64 = async (imageUrl: string) => {
      try {
        const res = await fetch(imageUrl);
        if (!res.ok) return null;
        const buffer = await res.arrayBuffer();
        const base64 = Buffer.from(buffer).toString('base64');
        const contentType = res.headers.get('content-type') || 'image/png';
        return `data:${contentType};base64,${base64}`;
      } catch { return null; }
    };

    const [photoBase64, qrBase64] = await Promise.all([
      photoUrl ? getBase64(photoUrl) : Promise.resolve(null),
      getBase64(qrUrl),
    ]);

    const maxDesc  = isA4 ? 320 : 160;
    const desc     = obj.description ?? '';
    const descTrunc = desc.length > maxDesc ? desc.slice(0, maxDesc - 3) + '…' : desc;

    let address = '';
    try {
      if (obj.location) {
        const loc = typeof obj.location === 'string' ? JSON.parse(obj.location) : obj.location;
        address = loc.address ?? '';
      }
    } catch { address = ''; }

    const createdAt = obj.created_at
      ? new Date(obj.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
      : '';

    const scale = isA4 ? 2.3 : 1;
    const accent = statusCfg.accentColor;

    // Paleta
    const bg           = isPrint ? '#ffffff' : (isRich ? 'linear-gradient(135deg, #0a0e14 0%, #1a1f2a 100%)' : '#0a0e14');
    const textPrimary  = isPrint ? '#111827' : '#ffffff';
    const textSec      = isPrint ? '#6b7280' : '#ffffffaa';
    const cardBg       = isPrint ? '#f9fafb' : 'rgba(255,255,255,0.05)';
    const cardBorder   = isPrint ? '#e5e7eb' : 'rgba(255,255,255,0.1)';
    const photoBg      = isPrint ? '#f3f4f6' : 'rgba(255,255,255,0.06)';
    const photoBorder  = isPrint ? '#e5e7eb' : 'rgba(255,255,255,0.12)';
    const richAccent   = '#FFD700';
    const richGlow     = 'rgba(255,215,0,0.3)';

    // ─── A4: layout duas colunas ─────────────────────────────────────────────
    if (isA4) {
      const pad    = 160;
      const colGap = 80;
      const colW   = (width - pad * 2 - colGap) / 2;
      const headH  = 320;
      const photoH = 1200;
      const footH  = 280;
      const contentH = height - headH - footH;

      const imageResponse = new ImageResponse(
        (
          <div style={{
            width: `${width}px`, height: `${height}px`,
            background: '#ffffff',
            display: 'flex', flexDirection: 'column',
            fontFamily: 'sans-serif', overflow: 'hidden',
          }}>
            {/* Faixa de status no topo */}
            <div style={{
              width: '100%', height: `${headH}px`,
              background: accent,
              display: 'flex', alignItems: 'center',
              padding: `0 ${pad}px`,
              gap: '60px',
            }}>
              {/* Logo */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '24px', flexShrink: 0 }}>
                <div style={{
                  width: '96px', height: '96px', borderRadius: '24px',
                  background: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '52px',
                }}>📍</div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ color: '#ffffff', fontSize: '48px', fontWeight: 800, letterSpacing: '-1px' }}>backfindr</span>
                  <span style={{ color: '#ffffff99', fontSize: '26px', fontWeight: 500 }}>Recuperação Inteligente</span>
                </div>
              </div>
              {/* Headline */}
              <div style={{ display: 'flex', flexDirection: 'column', marginLeft: 'auto' }}>
                {headlineParts.map((line, i) => (
                  <span key={i} style={{
                    color: '#ffffff',
                    fontSize: i === 0 ? '72px' : '96px',
                    fontWeight: 900,
                    lineHeight: 1.0,
                    letterSpacing: '-2px',
                    textAlign: 'right',
                    display: 'flex',
                  }}>{line}</span>
                ))}
              </div>
            </div>

            {/* Corpo: duas colunas */}
            <div style={{
              display: 'flex', flexDirection: 'row',
              padding: `${pad}px ${pad}px`,
              gap: `${colGap}px`,
              flex: 1,
            }}>
              {/* Coluna esquerda: foto + dados */}
              <div style={{
                width: `${colW}px`, display: 'flex', flexDirection: 'column', gap: '48px',
              }}>
                {/* Foto */}
                <div style={{
                  width: '100%', height: `${photoH}px`,
                  borderRadius: '32px',
                  background: photoBg,
                  border: `3px solid ${photoBorder}`,
                  overflow: 'hidden',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {photoBase64 ? (
                    <img src={photoBase64} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                  ) : (
                    <span style={{ fontSize: '160px' }}>{emoji}</span>
                  )}
                </div>

                {/* Dados da ocorrência */}
                <div style={{
                  display: 'flex', flexDirection: 'column', gap: '24px',
                  background: cardBg, border: `2px solid ${cardBorder}`,
                  borderRadius: '24px', padding: '48px',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                    <span style={{ fontSize: '36px' }}>🏷️</span>
                    <span style={{ color: textSec, fontSize: '32px', fontWeight: 600 }}>Categoria</span>
                    <span style={{ color: textPrimary, fontSize: '32px', fontWeight: 700, marginLeft: 'auto' }}>{catFull}</span>
                  </div>
                  {createdAt && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                      <span style={{ fontSize: '36px' }}>📅</span>
                      <span style={{ color: textSec, fontSize: '32px', fontWeight: 600 }}>Registrado em</span>
                      <span style={{ color: textPrimary, fontSize: '32px', fontWeight: 700, marginLeft: 'auto' }}>{createdAt}</span>
                    </div>
                  )}
                  {address && (
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '20px' }}>
                      <span style={{ fontSize: '36px', flexShrink: 0 }}>📍</span>
                      <span style={{ color: textSec, fontSize: '32px', fontWeight: 600, flexShrink: 0 }}>Local</span>
                      <span style={{ color: textPrimary, fontSize: '30px', fontWeight: 500, marginLeft: 'auto', textAlign: 'right' }}>{address}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Coluna direita: título + descrição + QR */}
              <div style={{
                width: `${colW}px`, display: 'flex', flexDirection: 'column', gap: '48px',
              }}>
                {/* Categoria + título */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <span style={{ fontSize: '48px' }}>{emoji}</span>
                    <span style={{ color: accent, fontSize: '32px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '3px' }}>{catFull}</span>
                  </div>
                  <h1 style={{
                    color: '#111827', fontSize: '88px', fontWeight: 900,
                    lineHeight: 1.0, margin: 0, letterSpacing: '-2px', display: 'flex', flexWrap: 'wrap',
                  }}>{obj.title}</h1>
                </div>

                {/* Descrição */}
                {descTrunc && (
                  <div style={{
                    background: cardBg, border: `2px solid ${cardBorder}`,
                    borderRadius: '24px', padding: '48px', display: 'flex',
                  }}>
                    <p style={{
                      color: '#374151', fontSize: '36px', lineHeight: 1.6,
                      margin: 0, fontWeight: 400, display: 'flex',
                    }}>{descTrunc}</p>
                  </div>
                )}

                {/* Recompensa */}
                {obj.reward_amount && obj.reward_amount > 0 && (
                  <div style={{
                    background: isRich ? `linear-gradient(135deg, ${richAccent}22, ${richAccent}11)` : `${accent}15`,
                    border: `3px solid ${isRich ? richAccent : accent}66`,
                    borderRadius: '24px', padding: '40px 48px',
                    display: 'flex', alignItems: 'center', gap: '24px',
                  }}>
                    <span style={{ fontSize: '56px' }}>🏆</span>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ color: textSec, fontSize: '28px', fontWeight: 600 }}>Recompensa</span>
                      <span style={{ color: isRich ? richAccent : accent, fontSize: '56px', fontWeight: 900 }}>
                        R$ {obj.reward_amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                )}

                {/* QR Code + CTA */}
                <div style={{
                  marginTop: 'auto',
                  background: `${accent}10`,
                  border: `3px solid ${accent}44`,
                  borderRadius: '32px', padding: '48px',
                  display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '48px',
                }}>
                  {qrBase64 && (
                    <div style={{
                      background: '#ffffff', borderRadius: '16px',
                      padding: '16px', display: 'flex', flexShrink: 0,
                    }}>
                      <img src={qrBase64} style={{ width: '280px', height: '280px' }} />
                    </div>
                  )}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <span style={{ color: accent, fontSize: '40px', fontWeight: 900, lineHeight: 1.1, display: 'flex', flexWrap: 'wrap' }}>
                      AJUDE A ENCONTRAR
                    </span>
                    <span style={{ color: '#374151', fontSize: '30px', fontWeight: 500, lineHeight: 1.4, display: 'flex', flexWrap: 'wrap' }}>
                      {statusCfg.cta}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div style={{
              height: `${footH}px`,
              background: accent,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              gap: '32px',
            }}>
              <span style={{ color: '#ffffff', fontSize: '36px' }}>🌐</span>
              <span style={{ color: '#ffffff', fontSize: '36px', fontWeight: 700, letterSpacing: '2px' }}>
                {appUrl.replace('https://', '').toUpperCase()} · REDE GLOBAL DE RECUPERAÇÃO
              </span>
            </div>
          </div>
        ),
        { width, height }
      );

      return new Response(imageResponse.body, {
        headers: {
          'Content-Type': 'image/png',
          'Cache-Control': 'public, max-age=3600',
        },
      });
    }

    // ─── VERTICAL & SQUARE ───────────────────────────────────────────────────
    const sidePad   = Math.round(60  * scale);
    const photoH    = format === 'vertical' ? 520 : 440;
    const headlineFS = format === 'vertical' ? 88 : 72;
    const sublineFS  = format === 'vertical' ? 56 : 48;

    const imageResponse = new ImageResponse(
      (
        <div style={{
          width: `${width}px`, height: `${height}px`,
          background: isRich ? 'linear-gradient(135deg, #0a0e14 0%, #1a1f2a 100%)' : '#0a0e14',
          display: 'flex', flexDirection: 'column',
          fontFamily: 'sans-serif', overflow: 'hidden', position: 'relative',
        }}>
          {/* Círculo decorativo de fundo */}
          <div style={{
            position: 'absolute', top: '-150px', right: '-150px',
            width: '700px', height: '700px', borderRadius: '50%',
            background: `radial-gradient(circle, ${accent}20 0%, transparent 70%)`,
            display: 'flex',
          }} />

          {/* Faixa de cor no topo */}
          <div style={{
            width: '100%', height: '12px',
            background: accent,
            display: 'flex',
          }} />

          {/* Header: logo + badge */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: `40px ${sidePad}px 24px`,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{
                width: '56px', height: '56px', borderRadius: '14px',
                background: accent, display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '28px',
              }}>📍</div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ color: '#ffffff', fontSize: '28px', fontWeight: 800 }}>backfindr</span>
                <span style={{ color: '#ffffff60', fontSize: '16px' }}>Recuperação Inteligente</span>
              </div>
            </div>
            <div style={{
              background: statusCfg.bg, borderRadius: '100px',
              padding: '10px 24px', display: 'flex',
            }}>
              <span style={{ color: statusCfg.color, fontSize: '22px', fontWeight: 800, letterSpacing: '1px' }}>
                {statusCfg.label}
              </span>
            </div>
          </div>

          {/* Headline grande */}
          <div style={{
            padding: `16px ${sidePad}px 24px`,
            display: 'flex', flexDirection: 'column', gap: '4px',
          }}>
            <span style={{
              color: accent, fontSize: `${sublineFS}px`, fontWeight: 900,
              letterSpacing: '-1px', lineHeight: 1.0, display: 'flex',
            }}>{headlineParts[0]}</span>
            <span style={{
              color: '#ffffff', fontSize: `${headlineFS}px`, fontWeight: 900,
              letterSpacing: '-2px', lineHeight: 0.95, display: 'flex', flexWrap: 'wrap',
            }}>{headlineParts[1] ?? ''}</span>
          </div>

          {/* Foto */}
          <div style={{
            margin: `0 ${sidePad}px`,
            height: `${photoH}px`,
            borderRadius: '24px',
            background: photoBg,
            border: `1px solid ${photoBorder}`,
            overflow: 'hidden',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            {photoBase64 ? (
              <img src={photoBase64} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
            ) : (
              <span style={{ fontSize: '120px' }}>{emoji}</span>
            )}
          </div>

          {/* Descrição + dados (apenas vertical) */}
          {format === 'vertical' && descTrunc && (
            <div style={{
              margin: `24px ${sidePad}px 0`,
              background: cardBg, border: `1px solid ${cardBorder}`,
              borderRadius: '16px', padding: '24px 28px', display: 'flex',
            }}>
              <p style={{
                color: '#ffffffcc', fontSize: '28px', lineHeight: 1.5,
                margin: 0, fontWeight: 400, display: 'flex',
              }}>{descTrunc}</p>
            </div>
          )}

          {/* Linha de dados rápidos */}
          {format === 'vertical' && (
            <div style={{
              margin: `16px ${sidePad}px 0`,
              display: 'flex', flexDirection: 'row', gap: '12px',
            }}>
              {createdAt && (
                <div style={{
                  background: cardBg, border: `1px solid ${cardBorder}`,
                  borderRadius: '12px', padding: '12px 20px',
                  display: 'flex', alignItems: 'center', gap: '8px',
                }}>
                  <span style={{ fontSize: '20px' }}>📅</span>
                  <span style={{ color: '#ffffffaa', fontSize: '22px' }}>{createdAt}</span>
                </div>
              )}
              {address && (
                <div style={{
                  background: cardBg, border: `1px solid ${cardBorder}`,
                  borderRadius: '12px', padding: '12px 20px',
                  display: 'flex', alignItems: 'center', gap: '8px', flex: 1, overflow: 'hidden',
                }}>
                  <span style={{ fontSize: '20px', flexShrink: 0 }}>📍</span>
                  <span style={{ color: '#ffffffaa', fontSize: '22px', overflow: 'hidden' }}>
                    {address.length > 50 ? address.slice(0, 47) + '…' : address}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Spacer */}
          <div style={{ flex: 1, display: 'flex' }} />

          {/* Footer: QR + CTA */}
          <div style={{
            margin: `0 ${sidePad}px`,
            marginBottom: '40px',
            background: isRich
              ? `linear-gradient(135deg, ${richAccent}15, ${richAccent}08)`
              : `${accent}15`,
            border: `2px solid ${isRich ? richAccent : accent}44`,
            borderRadius: '24px',
            padding: '28px 32px',
            display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '28px',
          }}>
            {qrBase64 && (
              <div style={{
                background: '#ffffff', borderRadius: '12px',
                padding: '10px', display: 'flex', flexShrink: 0,
              }}>
                <img src={qrBase64} style={{ width: '180px', height: '180px' }} />
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
              <span style={{
                color: isRich ? richAccent : accent,
                fontSize: '28px', fontWeight: 900, display: 'flex', flexWrap: 'wrap',
              }}>AJUDE A ENCONTRAR</span>
              <span style={{ color: '#ffffffcc', fontSize: '22px', lineHeight: 1.4, display: 'flex', flexWrap: 'wrap' }}>
                {statusCfg.cta}
              </span>
              <span style={{ color: '#ffffff40', fontSize: '18px', marginTop: '4px' }}>
                {appUrl.replace('https://', '')} · Rede Global
              </span>
            </div>
          </div>
        </div>
      ),
      { width, height }
    );

    return new Response(imageResponse.body, {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=3600',
      },
    });

  } catch (err) {
    console.error('[poster]', err);
    return new Response('Erro ao gerar pôster', { status: 500 });
  }
}
