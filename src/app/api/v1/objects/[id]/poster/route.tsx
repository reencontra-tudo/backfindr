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
    const url    = new URL(request.url);
    const format = (url.searchParams.get('format') ?? 'vertical') as Format;
    const { width, height } = FORMATS[format] ?? FORMATS.vertical;

    const result = await query(
      `SELECT 
        o.id, o.title, o.description, o.status, o.category, o.qr_code, o.images,
        o.location, o.latitude, o.longitude,
        o.color, o.brand, o.breed,
        o.reward_amount, o.reward_description, o.created_at,
        CASE 
          WHEN b.id IS NOT NULL AND b.status = 'active' AND b.expires_at > NOW() 
          THEN true ELSE false 
        END as has_active_boost
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
      latitude: string | null; longitude: string | null;
      color: string | null; brand: string | null; breed: string | null;
      reward_amount: number | null; reward_description: string | null;
      created_at: string; has_active_boost: boolean;
    };

    // ── Foto ──
    let photos: string[] = [];
    try {
      if (Array.isArray(obj.images)) photos = obj.images;
      else if (typeof obj.images === 'string') {
        if (obj.images.startsWith('[') || obj.images.startsWith('{')) photos = JSON.parse(obj.images);
        else if (obj.images.trim()) photos = [obj.images.trim()];
      }
    } catch { photos = []; }
    const photoUrl = photos[0] ?? null;

    // ── Endereço — replica normalizeObject do route.ts ──
    let address = '';
    try {
      const lat = obj.latitude ? parseFloat(obj.latitude) : null;
      const lng = obj.longitude ? parseFloat(obj.longitude) : null;
      if (lat && lng && !Number.isNaN(lat) && !Number.isNaN(lng)) {
        // latitude/longitude existem — address está em location como texto
        address = obj.location ?? '';
      } else if (obj.location && typeof obj.location === 'string') {
        try {
          const p = JSON.parse(obj.location);
          if (p.address) address = p.address;
          else if (p.lat && p.lng) address = ''; // JSON sem address textual
        } catch {
          // location é texto direto
          address = obj.location;
        }
      }
    } catch { address = ''; }

    // ── Características do objeto ──
    const charParts: string[] = [];
    if (obj.color) charParts.push(obj.color);
    if (obj.brand) charParts.push(obj.brand);
    if (obj.breed) charParts.push(obj.breed);
    const characteristics = charParts.join(' · ');

    const statusCfg     = STATUS_CONFIG[obj.status] ?? STATUS_CONFIG.lost;
    const emoji         = CATEGORY_EMOJI[obj.category] ?? '📦';
    const catLabel      = CATEGORY_LABEL[obj.category] ?? 'Objeto';
    const headlineRaw   = statusCfg.headline(catLabel);
    const headlineParts = headlineRaw.split('\n');
    const accent        = statusCfg.accentColor;
    const teal          = '#14B8A6';

    const appUrl  = process.env.NEXT_PUBLIC_APP_URL ?? 'https://backfindr.com';
    const pageUrl = `${appUrl}/scan/${obj.qr_code}`;
    const isA4    = format === 'a4';
    const qrPx    = isA4 ? 360 : 220;
    const qrUrl   = `https://api.qrserver.com/v1/create-qr-code/?size=${qrPx}x${qrPx}&data=${encodeURIComponent(pageUrl)}&bgcolor=ffffff&color=111827&margin=8`;

    const getBase64 = async (imageUrl: string) => {
      try {
        const res = await fetch(imageUrl);
        if (!res.ok) return null;
        const buffer = await res.arrayBuffer();
        const base64 = Buffer.from(buffer).toString('base64');
        const ct = res.headers.get('content-type') || 'image/png';
        return `data:${ct};base64,${base64}`;
      } catch { return null; }
    };

    const [photoBase64, qrBase64] = await Promise.all([
      photoUrl ? getBase64(photoUrl) : Promise.resolve(null),
      getBase64(qrUrl),
    ]);

    const createdAt = obj.created_at
      ? new Date(obj.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
      : '';

    const desc = obj.description ?? '';

    // ─────────────────────────────────────────────────────────────────────────
    // TEMPLATE A4 — MINIMAL CLEAN (2480×3508)
    // Hierarquia: header (logo+badge) → headline → foto grande →
    //   título + características + data + endereço (esq) | descrição (dir) →
    //   recompensa (se houver) → rodapé QR
    // ─────────────────────────────────────────────────────────────────────────
    if (format === 'a4') {
      const pad       = 160;
      const headerH   = 200;
      const headlineH = 420;
      const infoH     = 560;
      const rewardH   = (obj.reward_amount && obj.reward_amount > 0) ? 140 : 0;
      const footerH   = 500;
      const gaps      = 80 * 5; // 5 gaps entre seções
      const used      = headerH + headlineH + infoH + rewardH + footerH + gaps + pad * 2;
      const photoH    = Math.max(600, height - used);

      // Descrição: máx 3 linhas (~180 chars no A4)
      const descTrunc = desc.length > 180 ? desc.slice(0, 177) + '…' : desc;

      const imageResponse = new ImageResponse(
        (
          <div style={{
            width: `${width}px`, height: `${height}px`,
            background: '#ffffff',
            display: 'flex', flexDirection: 'column',
            fontFamily: 'sans-serif', overflow: 'hidden',
          }}>
            {/* ── Header ── */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: `${pad}px ${pad}px 0`,
              height: `${headerH + pad}px`, flexShrink: 0,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '28px' }}>
                <div style={{
                  width: '88px', height: '88px', borderRadius: '50%',
                  background: teal, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '48px',
                }}>📍</div>
                <span style={{ color: '#111827', fontSize: '64px', fontWeight: 800, letterSpacing: '-1px' }}>
                  backfindr
                </span>
              </div>
              <div style={{
                background: accent, borderRadius: '100px',
                padding: '24px 72px', display: 'flex',
              }}>
                <span style={{ color: '#ffffff', fontSize: '52px', fontWeight: 800, letterSpacing: '3px' }}>
                  {statusCfg.label}
                </span>
              </div>
            </div>

            {/* ── Headline ── */}
            <div style={{
              display: 'flex', flexDirection: 'column',
              padding: `80px ${pad}px 0`,
              flexShrink: 0,
            }}>
              <span style={{
                color: '#9ca3af', fontSize: '120px', fontWeight: 300,
                letterSpacing: '-2px', lineHeight: 1.0, display: 'flex',
              }}>{headlineParts[0]}</span>
              <span style={{
                color: '#111827', fontSize: '180px', fontWeight: 900,
                letterSpacing: '-5px', lineHeight: 0.88, display: 'flex',
              }}>{headlineParts[1] ?? ''}</span>
            </div>

            {/* ── Foto ── */}
            <div style={{
              margin: `80px ${pad}px 0`,
              height: `${photoH}px`,
              border: '3px solid #e5e7eb',
              borderRadius: '32px',
              overflow: 'hidden',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: '#f3f4f6',
              flexShrink: 0,
            }}>
              {photoBase64 ? (
                <img src={photoBase64} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <span style={{ fontSize: '260px' }}>{emoji}</span>
              )}
            </div>

            {/* ── Info: esq (título+características+data+endereço) | dir (descrição) ── */}
            <div style={{
              display: 'flex', flexDirection: 'row',
              padding: `80px ${pad}px 0`,
              gap: '80px',
              height: `${infoH}px`,
              flexShrink: 0,
            }}>
              {/* Coluna esquerda */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', flex: 1 }}>
                <span style={{ color: teal, fontSize: '36px', fontWeight: 700, letterSpacing: '3px', display: 'flex' }}>
                  {catLabel.toUpperCase()}
                </span>
                <span style={{
                  color: '#111827', fontSize: '72px', fontWeight: 800,
                  lineHeight: 1.05, display: 'flex', flexWrap: 'wrap',
                }}>{obj.title}</span>
                {characteristics && (
                  <span style={{
                    color: '#6b7280', fontSize: '40px', fontWeight: 500,
                    display: 'flex', flexWrap: 'wrap',
                  }}>{characteristics}</span>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: 'auto' }}>
                  {createdAt && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                      <span style={{ fontSize: '44px' }}>📅</span>
                      <span style={{ color: '#374151', fontSize: '44px', fontWeight: 700 }}>{createdAt}</span>
                    </div>
                  )}
                  {address && (
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '20px' }}>
                      <span style={{ fontSize: '44px', flexShrink: 0 }}>📍</span>
                      <span style={{ color: '#374151', fontSize: '40px', fontWeight: 700, display: 'flex', flexWrap: 'wrap', lineHeight: 1.3 }}>{address}</span>
                    </div>
                  )}
                </div>
              </div>
              {/* Coluna direita: descrição */}
              {descTrunc && (
                <div style={{
                  width: '900px', flexShrink: 0,
                  display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
                  paddingBottom: '8px',
                }}>
                  <span style={{ color: '#6b7280', fontSize: '36px', fontWeight: 600, letterSpacing: '2px', display: 'flex', marginBottom: '16px' }}>
                    DESCRIÇÃO
                  </span>
                  <span style={{
                    color: '#374151', fontSize: '42px', lineHeight: 1.6,
                    display: 'flex', flexWrap: 'wrap',
                  }}>{descTrunc}</span>
                </div>
              )}
            </div>

            {/* ── Recompensa (discreta, quando houver) ── */}
            {obj.reward_amount && obj.reward_amount > 0 && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: '24px',
                padding: `40px ${pad}px 0`,
                height: `${rewardH}px`,
                flexShrink: 0,
              }}>
                <span style={{ fontSize: '44px' }}>🏆</span>
                <span style={{ color: '#b45309', fontSize: '44px', fontWeight: 700 }}>
                  Recompensa: R$ {Number(obj.reward_amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
              </div>
            )}

            {/* ── Rodapé QR ── */}
            <div style={{
              display: 'flex', flexDirection: 'row', alignItems: 'center',
              padding: `80px ${pad}px ${pad}px`,
              gap: '60px',
              flexShrink: 0,
            }}>
              {qrBase64 && (
                <div style={{
                  background: '#ffffff', border: '3px solid #e5e7eb',
                  borderRadius: '24px', padding: '20px', display: 'flex', flexShrink: 0,
                }}>
                  <img src={qrBase64} style={{ width: `${qrPx}px`, height: `${qrPx}px` }} />
                </div>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <span style={{ color: accent, fontSize: '72px', fontWeight: 900, letterSpacing: '-1px', display: 'flex' }}>
                  AJUDE A ENCONTRAR
                </span>
                <span style={{ color: '#374151', fontSize: '48px', lineHeight: 1.4, display: 'flex', flexWrap: 'wrap' }}>
                  {statusCfg.cta}
                </span>
                <span style={{ color: '#9ca3af', fontSize: '40px' }}>
                  {appUrl.replace('https://', '')}
                </span>
              </div>
            </div>
          </div>
        ),
        { width, height }
      );

      return new Response(imageResponse.body, {
        headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=3600' },
      });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // TEMPLATE VERTICAL — URGENT DARK (1080×1920)
    // Hierarquia: header (logo+badge) → foto hero GRANDE →
    //   headline → título → características → data + endereço →
    //   descrição → recompensa (se houver) → rodapé QR
    // ─────────────────────────────────────────────────────────────────────────
    if (format === 'vertical') {
      const pad       = 48;
      const headerH   = 96;
      const headlineH = 220;
      const titleH    = 80;
      const charH     = characteristics ? 56 : 0;
      const metaH     = 64;
      const descH     = 100;
      const rewardH   = (obj.reward_amount && obj.reward_amount > 0) ? 56 : 0;
      const footerH   = 200;
      const gaps      = pad + 20 + 16 + 16 + 16 + 16 + 20;
      const photoH    = height - headerH - headlineH - titleH - charH - metaH - descH - rewardH - footerH - gaps - pad * 2;

      // Descrição: máx 2 linhas (~120 chars no vertical)
      const descTrunc = desc.length > 120 ? desc.slice(0, 117) + '…' : desc;

      const imageResponse = new ImageResponse(
        (
          <div style={{
            width: `${width}px`, height: `${height}px`,
            background: '#0d1117',
            display: 'flex', flexDirection: 'column',
            fontFamily: 'sans-serif', overflow: 'hidden',
          }}>
            {/* ── Header ── */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: `${pad}px ${pad}px 20px`,
              height: `${headerH + pad}px`, flexShrink: 0,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div style={{
                  width: '48px', height: '48px', borderRadius: '50%',
                  background: teal, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '26px',
                }}>📍</div>
                <span style={{ color: '#ffffff', fontSize: '34px', fontWeight: 800 }}>backfindr</span>
              </div>
              <div style={{
                background: accent, borderRadius: '100px',
                padding: '10px 28px', display: 'flex',
              }}>
                <span style={{ color: '#ffffff', fontSize: '26px', fontWeight: 800, letterSpacing: '1px' }}>
                  {statusCfg.label}
                </span>
              </div>
            </div>

            {/* ── Foto hero ── */}
            <div style={{
              margin: `0 ${pad}px`,
              height: `${photoH}px`,
              border: `3px solid ${teal}`,
              borderRadius: '20px',
              overflow: 'hidden',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: '#1a2030',
              flexShrink: 0,
            }}>
              {photoBase64 ? (
                <img src={photoBase64} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <span style={{ fontSize: '180px' }}>{emoji}</span>
              )}
            </div>

            {/* ── Headline ── */}
            <div style={{
              padding: `20px ${pad}px 0`,
              display: 'flex', flexDirection: 'column',
              flexShrink: 0,
            }}>
              <span style={{
                color: accent, fontSize: '60px', fontWeight: 900,
                letterSpacing: '-1px', lineHeight: 1.0, display: 'flex',
              }}>{headlineParts[0]}</span>
              <span style={{
                color: '#ffffff', fontSize: '96px', fontWeight: 900,
                letterSpacing: '-3px', lineHeight: 0.9, display: 'flex', flexWrap: 'wrap',
              }}>{headlineParts[1] ?? ''}</span>
            </div>

            {/* ── Título ── */}
            <div style={{
              padding: `16px ${pad}px 0`,
              flexShrink: 0,
              display: 'flex', alignItems: 'center',
            }}>
              <span style={{
                color: '#ffffffdd', fontSize: '40px', fontWeight: 700,
                lineHeight: 1.1, display: 'flex', flexWrap: 'wrap',
              }}>{obj.title}</span>
            </div>

            {/* ── Características ── */}
            {characteristics && (
              <div style={{
                padding: `10px ${pad}px 0`,
                flexShrink: 0,
              }}>
                <span style={{
                  color: teal, fontSize: '28px', fontWeight: 600,
                  display: 'flex', flexWrap: 'wrap',
                }}>{characteristics}</span>
              </div>
            )}

            {/* ── Data + Endereço ── */}
            <div style={{
              padding: `16px ${pad}px 0`,
              display: 'flex', flexDirection: 'column', gap: '8px',
              flexShrink: 0,
            }}>
              {createdAt && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '24px' }}>📅</span>
                  <span style={{ color: '#ffffffaa', fontSize: '26px', fontWeight: 600 }}>{createdAt}</span>
                </div>
              )}
              {address && (
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                  <span style={{ fontSize: '24px', flexShrink: 0, marginTop: '2px' }}>📍</span>
                  <span style={{ color: '#ffffffaa', fontSize: '26px', fontWeight: 600, display: 'flex', flexWrap: 'wrap', lineHeight: 1.3 }}>{address}</span>
                </div>
              )}
            </div>

            {/* ── Descrição ── */}
            {descTrunc && (
              <div style={{
                padding: `16px ${pad}px 0`,
                flexShrink: 0,
              }}>
                <span style={{
                  color: '#ffffff80', fontSize: '28px', lineHeight: 1.5,
                  display: 'flex', flexWrap: 'wrap',
                }}>{descTrunc}</span>
              </div>
            )}

            {/* ── Recompensa ── */}
            {obj.reward_amount && obj.reward_amount > 0 && (
              <div style={{
                padding: `12px ${pad}px 0`,
                display: 'flex', alignItems: 'center', gap: '10px',
                flexShrink: 0,
              }}>
                <span style={{ fontSize: '24px' }}>🏆</span>
                <span style={{ color: '#fbbf24', fontSize: '28px', fontWeight: 700 }}>
                  Recompensa: R$ {Number(obj.reward_amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
              </div>
            )}

            {/* ── Rodapé QR ── */}
            <div style={{
              margin: `20px ${pad}px ${pad}px`,
              background: 'rgba(20,184,166,0.10)',
              border: `2px solid ${teal}55`,
              borderRadius: '20px',
              padding: '20px 24px',
              display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '20px',
              flex: 1,
            }}>
              {qrBase64 && (
                <div style={{
                  background: '#ffffff', borderRadius: '12px',
                  padding: '8px', display: 'flex', flexShrink: 0,
                }}>
                  <img src={qrBase64} style={{ width: `${qrPx}px`, height: `${qrPx}px` }} />
                </div>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 }}>
                <span style={{ color: teal, fontSize: '30px', fontWeight: 900, display: 'flex', flexWrap: 'wrap' }}>
                  AJUDE A ENCONTRAR
                </span>
                <span style={{ color: '#ffffffcc', fontSize: '24px', lineHeight: 1.4, display: 'flex', flexWrap: 'wrap' }}>
                  {statusCfg.cta}
                </span>
                <span style={{ color: teal, fontSize: '20px' }}>
                  {appUrl.replace('https://', '')}
                </span>
              </div>
            </div>
          </div>
        ),
        { width, height }
      );

      return new Response(imageResponse.body, {
        headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=3600' },
      });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // TEMPLATE QUADRADO — BOLD IMPACT (1080×1080)
    // Hierarquia: faixa colorida (headline) → corpo branco:
    //   foto (esq, 420px) | título + características + data + endereço + descrição (dir)
    //   → rodapé teal com QR + CTA + logo
    // ─────────────────────────────────────────────────────────────────────────
    const topH   = 320;
    const footH  = 220;
    const bodyH  = height - topH - footH;
    const pad    = 36;
    const photoW = 400;

    // Descrição: máx 2 linhas (~80 chars no quadrado)
    const descShort = desc.length > 80 ? desc.slice(0, 77) + '…' : desc;

    const imageResponse = new ImageResponse(
      (
        <div style={{
          width: `${width}px`, height: `${height}px`,
          background: '#ffffff',
          display: 'flex', flexDirection: 'column',
          fontFamily: 'sans-serif', overflow: 'hidden',
        }}>
          {/* ── Faixa colorida com headline ── */}
          <div style={{
            width: '100%', height: `${topH}px`,
            background: accent,
            display: 'flex', flexDirection: 'column',
            alignItems: 'flex-start', justifyContent: 'center',
            padding: `0 ${pad}px`,
            flexShrink: 0,
          }}>
            <span style={{
              color: '#ffffff', fontSize: '80px', fontWeight: 900,
              letterSpacing: '-2px', lineHeight: 1.0, display: 'flex',
            }}>{headlineParts[0]}</span>
            <span style={{
              color: '#ffffff', fontSize: '100px', fontWeight: 900,
              letterSpacing: '-3px', lineHeight: 0.9, display: 'flex', flexWrap: 'wrap',
            }}>{headlineParts[1] ?? ''}</span>
          </div>

          {/* ── Corpo: foto (esq) + dados (dir) ── */}
          <div style={{
            display: 'flex', flexDirection: 'row',
            height: `${bodyH}px`,
            padding: `${pad}px`,
            gap: `${pad}px`,
            flexShrink: 0,
          }}>
            {/* Foto */}
            <div style={{
              width: `${photoW}px`, height: '100%',
              border: '2px solid #e5e7eb',
              borderRadius: '16px',
              overflow: 'hidden',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: '#f9fafb',
              flexShrink: 0,
            }}>
              {photoBase64 ? (
                <img src={photoBase64} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <span style={{ fontSize: '120px' }}>{emoji}</span>
              )}
            </div>

            {/* Dados */}
            <div style={{
              display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
              flex: 1, overflow: 'hidden',
            }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <span style={{
                  color: teal, fontSize: '22px', fontWeight: 700,
                  letterSpacing: '2px', textTransform: 'uppercase', display: 'flex',
                }}>{catLabel}</span>
                <span style={{
                  color: '#111827', fontSize: '40px', fontWeight: 800,
                  lineHeight: 1.1, display: 'flex', flexWrap: 'wrap',
                }}>{obj.title}</span>
                {characteristics && (
                  <span style={{
                    color: teal, fontSize: '22px', fontWeight: 600,
                    display: 'flex', flexWrap: 'wrap',
                  }}>{characteristics}</span>
                )}
                {descShort && (
                  <span style={{
                    color: '#6b7280', fontSize: '24px', lineHeight: 1.4,
                    display: 'flex', flexWrap: 'wrap',
                  }}>{descShort}</span>
                )}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {createdAt && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '22px' }}>📅</span>
                    <span style={{ color: '#374151', fontSize: '26px', fontWeight: 700 }}>{createdAt}</span>
                  </div>
                )}
                {address && (
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                    <span style={{ fontSize: '22px', flexShrink: 0 }}>📍</span>
                    <span style={{ color: '#374151', fontSize: '24px', fontWeight: 700, display: 'flex', flexWrap: 'wrap', lineHeight: 1.3 }}>{address}</span>
                  </div>
                )}
                {obj.reward_amount && obj.reward_amount > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '22px' }}>🏆</span>
                    <span style={{ color: '#b45309', fontSize: '26px', fontWeight: 700 }}>
                      Recompensa: R$ {Number(obj.reward_amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── Rodapé teal ── */}
          <div style={{
            flex: 1,
            background: teal,
            display: 'flex', flexDirection: 'row', alignItems: 'center',
            padding: `0 ${pad}px`,
            gap: '20px',
          }}>
            {qrBase64 && (
              <div style={{
                background: '#ffffff', borderRadius: '12px',
                padding: '8px', display: 'flex', flexShrink: 0,
              }}>
                <img src={qrBase64} style={{ width: `${qrPx}px`, height: `${qrPx}px` }} />
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
              <span style={{
                color: '#ffffff', fontSize: '38px', fontWeight: 900,
                letterSpacing: '-1px', display: 'flex', flexWrap: 'wrap',
              }}>AJUDE A ENCONTRAR</span>
              <span style={{ color: '#ffffffdd', fontSize: '22px', display: 'flex', flexWrap: 'wrap' }}>
                {statusCfg.cta}
              </span>
            </div>
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              gap: '4px', flexShrink: 0,
            }}>
              <div style={{
                width: '40px', height: '40px', borderRadius: '50%',
                background: 'rgba(255,255,255,0.2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '22px',
              }}>📍</div>
              <span style={{ color: '#ffffffcc', fontSize: '16px', fontWeight: 700 }}>backfindr</span>
            </div>
          </div>
        </div>
      ),
      { width, height }
    );

    return new Response(imageResponse.body, {
      headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=3600' },
    });

  } catch (err) {
    console.error('[poster]', err);
    return new Response('Erro ao gerar pôster', { status: 500 });
  }
}
