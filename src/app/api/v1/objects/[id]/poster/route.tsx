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
        o.location, o.reward_amount, o.created_at,
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
      reward_amount: number | null; created_at: string;
      has_active_boost: boolean;
    };

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
    const qrPx    = isA4 ? 360 : 240;
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

    let address = '';
    try {
      if (obj.location) {
        try {
          const loc = JSON.parse(obj.location as string);
          address = loc.address ?? '';
        } catch {
          address = obj.location as string;
        }
      }
    } catch { address = ''; }

    const createdAt = obj.created_at
      ? new Date(obj.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
      : '';

    const desc = obj.description ?? '';

    // ─────────────────────────────────────────────────────────────────────────
    // TEMPLATE 2 — MINIMAL CLEAN — A4 (2480×3508)
    // Layout: header (logo+badge) → headline → foto grande → info → rodapé QR
    // Sem espaços mortos: cada seção tem altura calculada para preencher o canvas
    // ─────────────────────────────────────────────────────────────────────────
    if (format === 'a4') {
      const pad    = 160;
      // Alturas fixas das seções não-foto
      const headerH   = 180;
      const headlineH = 380;
      const dividerH  = 4;
      const infoH     = 380;
      const footerH   = 600;
      const used = headerH + headlineH + dividerH + infoH + footerH + pad * 2 + 80 * 4;
      const photoH = height - used;

      const descTrunc = desc.length > 500 ? desc.slice(0, 497) + '…' : desc;
      const addrShort = address.length > 50 ? address.slice(0, 47) + '…' : address;

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
                <span style={{ color: '#111827', fontSize: '60px', fontWeight: 800, letterSpacing: '-1px' }}>
                  backfindr
                </span>
              </div>
              <div style={{
                background: accent, borderRadius: '100px',
                padding: '22px 64px', display: 'flex',
              }}>
                <span style={{ color: '#ffffff', fontSize: '48px', fontWeight: 800, letterSpacing: '3px' }}>
                  {statusCfg.label}
                </span>
              </div>
            </div>

            {/* ── Headline ── */}
            <div style={{
              display: 'flex', flexDirection: 'column',
              padding: `60px ${pad}px 0`,
              flexShrink: 0,
            }}>
              <span style={{
                color: '#9ca3af', fontSize: '130px', fontWeight: 300,
                letterSpacing: '-3px', lineHeight: 1.0, display: 'flex',
              }}>{headlineParts[0]}</span>
              <span style={{
                color: '#111827', fontSize: '180px', fontWeight: 900,
                letterSpacing: '-5px', lineHeight: 0.88, display: 'flex',
              }}>{headlineParts[1] ?? ''}</span>
            </div>

            {/* ── Foto ── */}
            <div style={{
              margin: `60px ${pad}px 0`,
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

            {/* ── Linha divisória ── */}
            <div style={{
              margin: `60px ${pad}px 0`,
              height: `${dividerH}px`, background: '#e5e7eb', display: 'flex', flexShrink: 0,
            }} />

            {/* ── Info: título + descrição (esq) | chips data/local (dir) ── */}
            <div style={{
              display: 'flex', flexDirection: 'row',
              padding: `60px ${pad}px 0`,
              gap: '80px',
              height: `${infoH}px`,
              flexShrink: 0,
            }}>
              {/* Esquerda */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', flex: 1 }}>
                <span style={{ color: teal, fontSize: '32px', fontWeight: 700, letterSpacing: '3px', display: 'flex' }}>
                  {catLabel.toUpperCase()}
                </span>
                <span style={{
                  color: '#111827', fontSize: '64px', fontWeight: 800,
                  lineHeight: 1.1, display: 'flex', flexWrap: 'wrap',
                }}>{obj.title}</span>
                {descTrunc && (
                  <span style={{
                    color: '#6b7280', fontSize: '38px', lineHeight: 1.5,
                    display: 'flex', flexWrap: 'wrap',
                  }}>{descTrunc}</span>
                )}
              </div>
              {/* Direita: chips */}
              <div style={{
                display: 'flex', flexDirection: 'column', gap: '28px',
                width: '900px', flexShrink: 0, justifyContent: 'center',
              }}>
                {createdAt && (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: '24px',
                    border: `2px solid ${teal}`, borderRadius: '20px', padding: '28px 40px',
                  }}>
                    <span style={{ fontSize: '48px' }}>📅</span>
                    <span style={{ color: '#111827', fontSize: '48px', fontWeight: 700 }}>{createdAt}</span>
                  </div>
                )}
                {addrShort && (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: '24px',
                    border: `2px solid ${teal}`, borderRadius: '20px', padding: '28px 40px',
                  }}>
                    <span style={{ fontSize: '48px', flexShrink: 0 }}>📍</span>
                    <span style={{ color: '#111827', fontSize: '44px', fontWeight: 700, display: 'flex', flexWrap: 'wrap' }}>{addrShort}</span>
                  </div>
                )}
                {obj.reward_amount && obj.reward_amount > 0 && (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: '24px',
                    border: '2px solid #F59E0B', borderRadius: '20px', padding: '28px 40px',
                    background: '#fffbeb',
                  }}>
                    <span style={{ fontSize: '48px' }}>🏆</span>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ color: '#92400e', fontSize: '28px', fontWeight: 600 }}>Recompensa</span>
                      <span style={{ color: '#b45309', fontSize: '52px', fontWeight: 900 }}>
                        R$ {obj.reward_amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* ── Rodapé QR ── */}
            <div style={{
              display: 'flex', flexDirection: 'row', alignItems: 'center',
              padding: `60px ${pad}px ${pad}px`,
              gap: '60px',
              flex: 1,
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
                <span style={{ color: accent, fontSize: '64px', fontWeight: 900, letterSpacing: '-1px', display: 'flex' }}>
                  AJUDE A ENCONTRAR
                </span>
                <span style={{ color: '#374151', fontSize: '44px', lineHeight: 1.4, display: 'flex', flexWrap: 'wrap' }}>
                  {statusCfg.cta}
                </span>
                <span style={{ color: '#9ca3af', fontSize: '36px' }}>
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
    // TEMPLATE 3 — URGENT DARK — VERTICAL (1080×1920)
    // Layout: header → foto hero GRANDE → linha vermelha → headline → título →
    //         descrição → data+local → rodapé QR (sem espaço morto)
    // ─────────────────────────────────────────────────────────────────────────
    if (format === 'vertical') {
      const pad    = 52;
      // Alturas fixas
      const headerH  = 100;
      const divH     = 3;
      const headlineH = 240;  // duas linhas
      const titleH   = 100;
      const descH    = 120;
      const metaH    = 120;
      const footerH  = 220;
      const gaps     = pad * 2 + 24 + 20 + 20 + 24 + 24; // espaçamentos entre seções
      const photoH   = height - headerH - divH - headlineH - titleH - descH - metaH - footerH - gaps;

      const descTrunc = desc.length > 140 ? desc.slice(0, 137) + '…' : desc;
      const addrShort = address.length > 45 ? address.slice(0, 42) + '…' : address;

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
              padding: `${pad}px ${pad}px 24px`,
              height: `${headerH + pad}px`, flexShrink: 0,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{
                  width: '52px', height: '52px', borderRadius: '50%',
                  background: teal, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '28px',
                }}>📍</div>
                <span style={{ color: '#ffffff', fontSize: '36px', fontWeight: 800 }}>backfindr</span>
              </div>
              <div style={{
                background: accent, borderRadius: '100px',
                padding: '12px 32px', display: 'flex',
              }}>
                <span style={{ color: '#ffffff', fontSize: '28px', fontWeight: 800, letterSpacing: '1px' }}>
                  {statusCfg.label}
                </span>
              </div>
            </div>

            {/* ── Foto hero com borda teal ── */}
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

            {/* ── Linha vermelha ── */}
            <div style={{
              margin: `24px ${pad}px 0`,
              height: `${divH}px`, background: '#EF4444', display: 'flex', flexShrink: 0,
            }} />

            {/* ── Headline ── */}
            <div style={{
              padding: `20px ${pad}px 0`,
              display: 'flex', flexDirection: 'column',
              height: `${headlineH}px`, flexShrink: 0,
            }}>
              <span style={{
                color: '#EF4444', fontSize: '68px', fontWeight: 900,
                letterSpacing: '-1px', lineHeight: 1.0, display: 'flex',
              }}>{headlineParts[0]}</span>
              <span style={{
                color: '#ffffff', fontSize: '100px', fontWeight: 900,
                letterSpacing: '-3px', lineHeight: 0.92, display: 'flex', flexWrap: 'wrap',
              }}>{headlineParts[1] ?? ''}</span>
            </div>

            {/* ── Título do objeto ── */}
            <div style={{
              padding: `0 ${pad}px`,
              height: `${titleH}px`, flexShrink: 0,
              display: 'flex', alignItems: 'center',
            }}>
              <span style={{
                color: '#ffffffdd', fontSize: '44px', fontWeight: 700,
                lineHeight: 1.1, display: 'flex', flexWrap: 'wrap',
              }}>{obj.title}</span>
            </div>

            {/* ── Descrição ── */}
            {descTrunc && (
              <div style={{
                padding: `0 ${pad}px`,
                height: `${descH}px`, flexShrink: 0,
                display: 'flex', alignItems: 'flex-start',
              }}>
                <span style={{
                  color: '#ffffff99', fontSize: '30px', lineHeight: 1.5,
                  display: 'flex', flexWrap: 'wrap',
                }}>{descTrunc}</span>
              </div>
            )}

            {/* ── Data + Local ── */}
            <div style={{
              padding: `20px ${pad}px 0`,
              display: 'flex', flexDirection: 'column', gap: '12px',
              height: `${metaH}px`, flexShrink: 0,
            }}>
              {createdAt && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '26px' }}>📅</span>
                  <span style={{ color: '#ffffffaa', fontSize: '28px', fontWeight: 600 }}>{createdAt}</span>
                </div>
              )}
              {addrShort && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '26px', flexShrink: 0 }}>📍</span>
                  <span style={{ color: '#ffffffaa', fontSize: '28px', fontWeight: 600, display: 'flex', flexWrap: 'wrap' }}>{addrShort}</span>
                </div>
              )}
            </div>

            {/* ── Rodapé QR ── */}
            <div style={{
              margin: `24px ${pad}px ${pad}px`,
              background: `rgba(20,184,166,0.10)`,
              border: `2px solid ${teal}55`,
              borderRadius: '20px',
              padding: '24px 28px',
              display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '24px',
              flex: 1,
            }}>
              {qrBase64 && (
                <div style={{
                  background: '#ffffff', borderRadius: '12px',
                  padding: '10px', display: 'flex', flexShrink: 0,
                }}>
                  <img src={qrBase64} style={{ width: `${qrPx}px`, height: `${qrPx}px` }} />
                </div>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
                <span style={{ color: teal, fontSize: '34px', fontWeight: 900, display: 'flex', flexWrap: 'wrap' }}>
                  AJUDE A ENCONTRAR
                </span>
                <span style={{ color: '#ffffffcc', fontSize: '26px', lineHeight: 1.4, display: 'flex', flexWrap: 'wrap' }}>
                  {statusCfg.cta}
                </span>
                <span style={{ color: teal, fontSize: '22px' }}>
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
    // TEMPLATE 1 — BOLD IMPACT — QUADRADO (1080×1080)
    // Layout: faixa colorida com headline (topo, ~35%) → corpo branco com
    //         foto grande (esq) + título+dados (dir) → rodapé teal com QR
    // ─────────────────────────────────────────────────────────────────────────
    const topH    = 340;   // faixa colorida
    const footH   = 240;   // rodapé teal
    const bodyH   = height - topH - footH;  // 500px para foto+dados
    const pad     = 40;
    const photoW  = 420;

    const descShort = desc.length > 100 ? desc.slice(0, 97) + '…' : desc;
    const addrShort = address.length > 45 ? address.slice(0, 42) + '…' : address;

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
              color: '#ffffff', fontSize: '84px', fontWeight: 900,
              letterSpacing: '-2px', lineHeight: 1.0, display: 'flex',
            }}>{headlineParts[0]}</span>
            <span style={{
              color: '#ffffff', fontSize: '104px', fontWeight: 900,
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
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <span style={{
                  color: teal, fontSize: '24px', fontWeight: 700,
                  letterSpacing: '2px', textTransform: 'uppercase', display: 'flex',
                }}>{catLabel}</span>
                <span style={{
                  color: '#111827', fontSize: '44px', fontWeight: 800,
                  lineHeight: 1.1, display: 'flex', flexWrap: 'wrap',
                }}>{obj.title}</span>
                {descShort && (
                  <span style={{
                    color: '#6b7280', fontSize: '26px', lineHeight: 1.4,
                    display: 'flex', flexWrap: 'wrap',
                  }}>{descShort}</span>
                )}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {createdAt && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '26px' }}>📅</span>
                    <span style={{ color: '#374151', fontSize: '30px', fontWeight: 700 }}>{createdAt}</span>
                  </div>
                )}
                {addrShort && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '26px', flexShrink: 0 }}>📍</span>
                    <span style={{ color: '#374151', fontSize: '28px', fontWeight: 700, display: 'flex', flexWrap: 'wrap' }}>{addrShort}</span>
                  </div>
                )}
                {obj.reward_amount && obj.reward_amount > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '26px' }}>🏆</span>
                    <span style={{ color: '#b45309', fontSize: '30px', fontWeight: 800 }}>
                      Recompensa: R$ {obj.reward_amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
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
            gap: '24px',
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
                color: '#ffffff', fontSize: '42px', fontWeight: 900,
                letterSpacing: '-1px', display: 'flex', flexWrap: 'wrap',
              }}>AJUDE A ENCONTRAR</span>
              <span style={{ color: '#ffffffdd', fontSize: '24px', display: 'flex', flexWrap: 'wrap' }}>
                {statusCfg.cta}
              </span>
            </div>
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              gap: '4px', flexShrink: 0,
            }}>
              <div style={{
                width: '44px', height: '44px', borderRadius: '50%',
                background: 'rgba(255,255,255,0.2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '24px',
              }}>📍</div>
              <span style={{ color: '#ffffffcc', fontSize: '18px', fontWeight: 700 }}>backfindr</span>
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
