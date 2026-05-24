import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { buildPosterData } from '@/lib/posterFormatter';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const FORMATS = {
  square:   { width: 1080, height: 1080 },
  vertical: { width: 1080, height: 1920 },
  a4:       { width: 2480, height: 3508 },
} as const;

type Format = keyof typeof FORMATS;

const BRAND = {
  black: '#0B0F14',
  teal:  '#16C7B7',
  paper: '#FFFFFF',
};

// ── Utilitários de imagem ─────────────────────────────────────────────────────

function normalizeImages(value: unknown): string[] {
  try {
    if (Array.isArray(value)) return value.filter(Boolean) as string[];
    if (typeof value !== 'string') return [];
    const clean = value.trim();
    if (!clean) return [];
    if (clean.startsWith('[')) return JSON.parse(clean).filter(Boolean);
    if (clean.startsWith('{')) {
      const parsed = JSON.parse(clean);
      if (Array.isArray(parsed)) return parsed.filter(Boolean);
      if (parsed.url) return [parsed.url];
    }
    return [clean];
  } catch { return []; }
}

async function toDataUrl(imageUrl: string | null): Promise<string | null> {
  if (!imageUrl) return null;
  try {
    const res = await fetch(imageUrl, { cache: 'no-store' });
    if (!res.ok) return null;
    const buffer = await res.arrayBuffer();
    const base64 = Buffer.from(buffer).toString('base64');
    const ct = res.headers.get('content-type') || 'image/png';
    return `data:${ct};base64,${base64}`;
  } catch { return null; }
}

// ── Handler ───────────────────────────────────────────────────────────────────

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const url          = new URL(request.url);
    const formatParam  = url.searchParams.get('format') as Format | null;
    const format: Format = formatParam && formatParam in FORMATS ? formatParam : 'vertical';
    const inkSaver     = url.searchParams.get('inkSaver') === '1' || url.searchParams.get('bw') === '1';
    const { width, height } = FORMATS[format];

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
      images: unknown; location: unknown;
      reward_amount: number | null; created_at: string;
      has_active_boost: boolean;
    };

    const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://backfindr.com').replace(/\/$/, '');

    // ── buildPosterData: ÚNICA fonte de verdade para comunicação visual ────────
    const pd = buildPosterData({
      title:       obj.title,
      description: obj.description,
      category:    obj.category,
      status:      obj.status,
      created_at:  obj.created_at,
      location:    obj.location,
      reward:      obj.reward_amount,
      qr_code:     obj.qr_code,
      photo_url:   normalizeImages(obj.images)[0] ?? null,
    }, appUrl);

    // ── Imagens ───────────────────────────────────────────────────────────────
    const qrSize  = format === 'a4' ? 520 : format === 'vertical' ? 260 : 230;
    const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=${qrSize}x${qrSize}&data=${encodeURIComponent(pd.qrUrl)}&bgcolor=ffffff&color=111827&margin=10`;

    const [photo, qr] = await Promise.all([
      toDataUrl(pd.photoUrl),
      toDataUrl(qrApiUrl),
    ]);

    // ── Helpers de render ─────────────────────────────────────────────────────

    const renderQr = (sizePx: number, radius = 24) => (
      <div style={{
        background: '#fff', borderRadius: `${radius}px`,
        padding: `${Math.round(sizePx * 0.045)}px`, display: 'flex', flexShrink: 0,
      }}>
        {qr
          ? <img src={qr} style={{ width: `${sizePx}px`, height: `${sizePx}px` }} />
          : <span style={{ width: `${sizePx}px`, height: `${sizePx}px`, display: 'flex' }} />
        }
      </div>
    );

    // ─────────────────────────────────────────────────────────────────────────
    // TEMPLATE A4 — CARTAZ IMPRESSO — 2480×3508
    // Regra: fundo branco total, sem faixas chapadas, bordas finas,
    // conteúdo ocupa 95–98% da altura útil, sem área morta.
    // IMPORTANTE: next/og não suporta marginTop em filhos de container com padding.
    // Usar gap no container pai ou paddingTop no próprio elemento.
    // ─────────────────────────────────────────────────────────────────────────
    if (format === 'a4') {
      const tealA4   = BRAND.teal;
      const accentA4 = pd.statusColor;
      const bdr      = inkSaver ? '5px solid #0B0F14' : `5px solid ${tealA4}`;

      // Container principal usa gap para espaçar seções — sem marginTop em filhos
      const imageResponse = new ImageResponse(
        (
          <div style={{
            width, height, background: '#FFFFFF',
            display: 'flex', flexDirection: 'column',
            fontFamily: 'Arial, sans-serif', overflow: 'hidden',
            padding: '80px 120px',
            gap: 0,
          }}>

            {/* ── 1. Logo + Badge ── */}
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              height: 130, flexShrink: 0,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 22 }}>
                <div style={{
                  width: 76, height: 76, borderRadius: 18,
                  border: `5px solid ${tealA4}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 42, color: tealA4,
                }}>⌖</div>
                <span style={{ fontSize: 50, fontWeight: 900, color: '#111827', letterSpacing: -1, display: 'flex' }}>backfindr</span>
              </div>
              <div style={{
                border: `5px solid ${accentA4}`, color: accentA4,
                borderRadius: 999, padding: '16px 56px',
                fontSize: 50, fontWeight: 900, letterSpacing: 4, display: 'flex',
              }}>{pd.statusLabel}</div>
            </div>

            {/* ── 2. Divisória teal (paddingTop para espaçar) ── */}
            <div style={{ height: 4, background: tealA4, flexShrink: 0, paddingTop: 0 }} />

            {/* ── 3. Headline + Subtítulo (paddingTop no container) ── */}
            <div style={{
              display: 'flex', flexDirection: 'column',
              paddingTop: 32, flexShrink: 0,
            }}>
              <span style={{
                color: accentA4, fontSize: 84, fontWeight: 900,
                lineHeight: 1.0, letterSpacing: -1, display: 'flex',
              }}>{pd.eyebrow}</span>
              <span style={{
                color: '#111827',
                fontSize: pd.headline.length > 18 ? 144 : 172,
                fontWeight: 950, lineHeight: 0.9, letterSpacing: -6, display: 'flex',
              }}>{pd.headline}</span>
              <span style={{
                color: '#374151', fontSize: 76, fontWeight: 700,
                lineHeight: 1.1, paddingTop: 16, display: 'flex', flexWrap: 'wrap',
              }}>{pd.subtitle}</span>
            </div>

            {/* ── 4. Foto grande (paddingTop no container) ── */}
            <div style={{
              height: 1220, flexShrink: 0, paddingTop: 40,
              display: 'flex',
            }}>
              <div style={{
                width: '100%', height: '100%',
                border: bdr, borderRadius: 28, overflow: 'hidden',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: '#F9FAFB',
              }}>
                {photo
                  ? <img src={photo} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                  : <span style={{ fontSize: '300px' }}>📦</span>
                }
              </div>
            </div>

            {/* ── 5. Divisória + Label RECONHECIMENTO RÁPIDO ── */}
            <div style={{
              paddingTop: 44, display: 'flex', flexDirection: 'column', flexShrink: 0,
            }}>
              <div style={{ height: 3, background: '#E5E7EB' }} />
              <span style={{
                color: tealA4, fontSize: 50, fontWeight: 900,
                letterSpacing: 3, paddingTop: 22, display: 'flex',
              }}>RECONHECIMENTO RÁPIDO</span>
            </div>

            {/* ── 6. Bullets ── */}
            <div style={{
              display: 'flex', flexDirection: 'column', gap: 14,
              paddingTop: 18, flexShrink: 0,
            }}>
              <span style={{ color: '#111827', fontSize: 64, fontWeight: 800, lineHeight: 1.1, display: 'flex', flexWrap: 'wrap' }}>
                • {pd.categoryLabel}: {pd.subtitle}
              </span>
              {pd.description && (
                <span style={{ color: '#374151', fontSize: 58, fontWeight: 600, lineHeight: 1.2, display: 'flex', flexWrap: 'wrap' }}>
                  • {pd.description}
                </span>
              )}
              {pd.locationShort && (
                <span style={{ color: '#374151', fontSize: 58, fontWeight: 600, lineHeight: 1.2, display: 'flex', flexWrap: 'wrap' }}>
                  • Local: {pd.locationShort}
                </span>
              )}
              {pd.date && (
                <span style={{ color: '#374151', fontSize: 58, fontWeight: 600, lineHeight: 1.2, display: 'flex' }}>
                  • Data: {pd.date}
                </span>
              )}
              {pd.reward && (
                <span style={{ color: '#92400E', fontSize: 62, fontWeight: 800, lineHeight: 1.2, display: 'flex' }}>
                  • Recompensa: {pd.reward}
                </span>
              )}
            </div>

            {/* ── 7. Divisória fina ── */}
            <div style={{ height: 3, background: '#E5E7EB', flexShrink: 0, paddingTop: 40 }} />

            {/* ── 8. QR + CTA ── */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 56,
              paddingTop: 40, flexShrink: 0,
            }}>
              <div style={{
                border: bdr, borderRadius: 22,
                padding: 14, display: 'flex', flexShrink: 0, background: '#fff',
              }}>
                {qr
                  ? <img src={qr} style={{ width: 520, height: 520 }} />
                  : <span style={{ width: 520, height: 520, display: 'flex' }} />
                }
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 18, flex: 1 }}>
                <span style={{
                  color: '#111827', fontSize: 84, fontWeight: 950,
                  lineHeight: 0.92, letterSpacing: -2, display: 'flex', flexWrap: 'wrap',
                }}>ESCANEIE SE VOCÊ VIU</span>
                <span style={{ color: '#374151', fontSize: 54, fontWeight: 600, lineHeight: 1.3, display: 'flex', flexWrap: 'wrap' }}>
                  O QR Code abre a página do objeto. Ajude compartilhando ou avisando onde viu.
                </span>
                <span style={{ color: tealA4, fontSize: 44, fontWeight: 700, display: 'flex' }}>
                  {appUrl.replace('https://', '')}/scan/{obj.qr_code}
                </span>
              </div>
            </div>

            {/* ── 9. Rodapé mínimo ── */}
            <div style={{ height: 3, background: '#E5E7EB', flexShrink: 0, paddingTop: 40 }} />
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              paddingTop: 24, flexShrink: 0,
            }}>
              <span style={{ color: '#9CA3AF', fontSize: 42, fontWeight: 600, display: 'flex', flexWrap: 'wrap' }}>
                Cada compartilhamento aumenta as chances de recuperação.
              </span>
              <span style={{ color: tealA4, fontSize: 42, fontWeight: 800, display: 'flex' }}>backfindr.com</span>
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
    // TEMPLATE VERTICAL — URGENT DARK — 1080×1920
    // ─────────────────────────────────────────────────────────────────────────
    if (format === 'vertical') {
      const teal      = '#14B8A6';
      const pad       = 52;
      const headerH   = 100;
      const divH      = 3;
      const headlineH = 200;
      const subtitleH = 80;
      const descH     = 110;
      const metaH     = 120;
      const footerH   = 220;
      const gaps      = pad * 2 + 24 + 20 + 20 + 24 + 24;
      const photoH    = height - headerH - divH - headlineH - subtitleH - descH - metaH - footerH - gaps;

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
                  background: teal, display: 'flex', alignItems: 'center',
                  justifyContent: 'center', fontSize: '28px',
                }}>📍</div>
                <span style={{ color: '#ffffff', fontSize: '36px', fontWeight: 800 }}>backfindr</span>
              </div>
              <div style={{
                background: pd.statusColor, borderRadius: '100px',
                padding: '12px 32px', display: 'flex',
              }}>
                <span style={{ color: '#ffffff', fontSize: '28px', fontWeight: 800, letterSpacing: '1px' }}>
                  {pd.statusLabel}
                </span>
              </div>
            </div>

            {/* ── Foto hero ── */}
            <div style={{
              margin: `0 ${pad}px`,
              height: `${photoH}px`,
              border: `3px solid ${teal}`,
              borderRadius: '20px', overflow: 'hidden',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: '#1a2030', flexShrink: 0,
            }}>
              {photo
                ? <img src={photo} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : <span style={{ fontSize: '180px' }}>📦</span>
              }
            </div>

            {/* ── Linha divisória ── */}
            <div style={{
              margin: `24px ${pad}px 0`,
              height: `${divH}px`, background: '#EF4444', display: 'flex', flexShrink: 0,
            }} />

            {/* ── Headline controlada (máx 24 chars) ── */}
            <div style={{
              padding: `20px ${pad}px 0`,
              display: 'flex', flexDirection: 'column',
              height: `${headlineH}px`, flexShrink: 0,
            }}>
              <span style={{
                color: '#EF4444', fontSize: '52px', fontWeight: 900,
                letterSpacing: '-1px', lineHeight: 1.0, display: 'flex',
              }}>{pd.eyebrow}</span>
              <span style={{
                color: '#ffffff', fontSize: '80px', fontWeight: 900,
                letterSpacing: '-3px', lineHeight: 0.92, display: 'flex', flexWrap: 'wrap',
              }}>{pd.headline}</span>
            </div>

            {/* ── Subtítulo: título truncado do usuário (máx 40 chars) ── */}
            <div style={{
              padding: `0 ${pad}px`,
              height: `${subtitleH}px`, flexShrink: 0,
              display: 'flex', alignItems: 'center',
            }}>
              <span style={{
                color: 'rgba(255,255,255,0.87)', fontSize: '38px', fontWeight: 700,
                lineHeight: 1.1, display: 'flex', flexWrap: 'wrap',
              }}>{pd.subtitle}</span>
            </div>

            {/* ── Descrição (máx 120 chars) ── */}
            {pd.description && (
              <div style={{
                padding: `0 ${pad}px`,
                height: `${descH}px`, flexShrink: 0,
                display: 'flex', alignItems: 'flex-start',
              }}>
                <span style={{
                  color: 'rgba(255,255,255,0.6)', fontSize: '30px', lineHeight: 1.5,
                  display: 'flex', flexWrap: 'wrap',
                }}>{pd.description}</span>
              </div>
            )}

            {/* ── Data + Local ── */}
            <div style={{
              padding: `20px ${pad}px 0`,
              display: 'flex', flexDirection: 'column', gap: '12px',
              height: `${metaH}px`, flexShrink: 0,
            }}>
              {pd.date && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '26px' }}>📅</span>
                  <span style={{ color: 'rgba(255,255,255,0.67)', fontSize: '28px', fontWeight: 600 }}>{pd.date}</span>
                </div>
              )}
              {pd.locationShort && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '26px', flexShrink: 0 }}>📍</span>
                  <span style={{ color: 'rgba(255,255,255,0.67)', fontSize: '28px', fontWeight: 600, display: 'flex', flexWrap: 'wrap' }}>{pd.locationShort}</span>
                </div>
              )}
            </div>

            {/* ── Rodapé QR ── */}
            <div style={{
              margin: `24px ${pad}px ${pad}px`,
              background: 'rgba(20,184,166,0.10)',
              border: '2px solid rgba(20,184,166,0.33)',
              borderRadius: '20px', padding: '24px 28px',
              display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '24px',
              height: `${footerH}px`, flexShrink: 0,
            }}>
              {qr && (
                <div style={{ background: '#ffffff', borderRadius: '12px', padding: '10px', display: 'flex', flexShrink: 0 }}>
                  <img src={qr} style={{ width: `${qrSize}px`, height: `${qrSize}px` }} />
                </div>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
                <span style={{ color: teal, fontSize: '34px', fontWeight: 900, display: 'flex', flexWrap: 'wrap' }}>
                  AJUDE A ENCONTRAR
                </span>
                <span style={{ color: 'rgba(255,255,255,0.8)', fontSize: '26px', lineHeight: 1.4, display: 'flex', flexWrap: 'wrap' }}>
                  Você viu? Escaneie e avise o dono!
                </span>
                <span style={{ color: teal, fontSize: '22px', display: 'flex' }}>
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
    // TEMPLATE QUADRADO — BOLD IMPACT — 1080×1080
    // ─────────────────────────────────────────────────────────────────────────
    const teal   = '#14B8A6';
    const topH   = 300;
    const footH  = 240;
    const bodyH  = height - topH - footH;
    const pad    = 40;
    const photoW = 420;

    const imageResponse = new ImageResponse(
      (
        <div style={{
          width: `${width}px`, height: `${height}px`,
          background: '#ffffff',
          display: 'flex', flexDirection: 'column',
          fontFamily: 'sans-serif', overflow: 'hidden',
        }}>
          {/* ── Faixa colorida com headline controlada ── */}
          <div style={{
            width: '100%', height: `${topH}px`,
            background: pd.statusColor,
            display: 'flex', flexDirection: 'column',
            alignItems: 'flex-start', justifyContent: 'center',
            padding: `0 ${pad}px`, flexShrink: 0,
          }}>
            <span style={{
              color: '#ffffff', fontSize: '64px', fontWeight: 900,
              letterSpacing: '-1px', lineHeight: 1.0, display: 'flex',
            }}>{pd.eyebrow}</span>
            {/* headline: máx 24 chars — nunca transborda */}
            <span style={{
              color: '#ffffff', fontSize: '88px', fontWeight: 900,
              letterSpacing: '-3px', lineHeight: 0.9, display: 'flex',
            }}>{pd.headline}</span>
          </div>

          {/* ── Corpo: foto (esq) + dados (dir) ── */}
          <div style={{
            display: 'flex', flexDirection: 'row',
            height: `${bodyH}px`, padding: `${pad}px`, gap: `${pad}px`,
            flexShrink: 0,
          }}>
            {/* Foto */}
            <div style={{
              width: `${photoW}px`, height: '100%',
              border: '2px solid #e5e7eb', borderRadius: '16px',
              overflow: 'hidden', display: 'flex',
              alignItems: 'center', justifyContent: 'center',
              background: '#f9fafb', flexShrink: 0,
            }}>
              {photo
                ? <img src={photo} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : <span style={{ fontSize: '120px' }}>📦</span>
              }
            </div>

            {/* Dados */}
            <div style={{
              display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
              flex: 1, overflow: 'hidden',
            }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <span style={{
                  color: teal, fontSize: '24px', fontWeight: 700,
                  letterSpacing: '2px', textTransform: 'uppercase', display: 'flex',
                }}>{pd.categoryLabel}</span>
                {/* Subtítulo: título truncado (máx 40 chars) */}
                <span style={{
                  color: '#111827', fontSize: '40px', fontWeight: 800,
                  lineHeight: 1.1, display: 'flex', flexWrap: 'wrap',
                }}>{pd.subtitle}</span>
                {pd.description && (
                  <span style={{
                    color: '#6b7280', fontSize: '26px', lineHeight: 1.4,
                    display: 'flex', flexWrap: 'wrap',
                  }}>{pd.description}</span>
                )}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {pd.date && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '26px' }}>📅</span>
                    <span style={{ color: '#374151', fontSize: '28px', fontWeight: 700 }}>{pd.date}</span>
                  </div>
                )}
                {pd.locationShort && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '26px', flexShrink: 0 }}>📍</span>
                    <span style={{ color: '#374151', fontSize: '26px', fontWeight: 700, display: 'flex', flexWrap: 'wrap' }}>{pd.locationShort}</span>
                  </div>
                )}
                {pd.reward && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '26px' }}>🏆</span>
                    <span style={{ color: '#b45309', fontSize: '28px', fontWeight: 800 }}>
                      {pd.reward}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── Rodapé teal ── */}
          <div style={{
            flex: 1, background: teal,
            display: 'flex', flexDirection: 'row', alignItems: 'center',
            padding: `0 ${pad}px`, gap: '24px',
          }}>
            {qr && (
              <div style={{ background: '#ffffff', borderRadius: '12px', padding: '8px', display: 'flex', flexShrink: 0 }}>
                <img src={qr} style={{ width: `${qrSize}px`, height: `${qrSize}px` }} />
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
              <span style={{
                color: '#ffffff', fontSize: '42px', fontWeight: 900,
                letterSpacing: '-1px', display: 'flex', flexWrap: 'wrap',
              }}>AJUDE A ENCONTRAR</span>
              <span style={{ color: 'rgba(255,255,255,0.87)', fontSize: '24px', display: 'flex', flexWrap: 'wrap' }}>
                Você viu? Escaneie e avise o dono!
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
              <span style={{ color: 'rgba(255,255,255,0.8)', fontSize: '18px', fontWeight: 700 }}>backfindr</span>
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
