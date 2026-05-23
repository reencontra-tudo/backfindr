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

const BRAND = {
  black:    '#0B0F14',
  teal:     '#16C7B7',
  paper:    '#FFFFFF',
};

const STATUS_CONFIG: Record<string, {
  label: string;
  accent: string;
  headlinePrefix: string;
  action: string;
  cta: string;
}> = {
  lost:              { label: 'PERDIDO',    accent: '#EF4444', headlinePrefix: 'PERDI MINHA',    action: 'ESCANEIE SE VOCÊ VIU',  cta: 'Você viu? Escaneie e avise o dono!' },
  found:             { label: 'ENCONTRADO', accent: '#16C7B7', headlinePrefix: 'ENCONTREI UMA',  action: 'ESCANEIE SE FOR SEU',   cta: 'É seu? Escaneie o QR Code e reivindique!' },
  stolen:            { label: 'ROUBADO',    accent: '#DC2626', headlinePrefix: 'ROUBARAM MINHA', action: 'ESCANEIE SE VOCÊ VIU',  cta: 'Viu este objeto? Escaneie e denuncie!' },
  stolen_pickpocket: { label: 'FURTADO',    accent: '#B91C1C', headlinePrefix: 'FURTARAM MINHA', action: 'ESCANEIE SE VOCÊ VIU',  cta: 'Viu este objeto? Escaneie e denuncie!' },
  in_possession:     { label: 'EM POSSE',   accent: '#F59E0B', headlinePrefix: 'ESTOU COM UMA',  action: 'ESCANEIE PARA AVISAR',  cta: 'Reconhece? Escaneie e entre em contato!' },
  returned:          { label: 'RECUPERADO', accent: '#22C55E', headlinePrefix: 'RECUPEREI MINHA',action: 'VEJA A HISTÓRIA',       cta: 'Objeto recuperado com sucesso via Backfindr' },
  protected:         { label: 'PROTEGIDO',  accent: '#3B82F6', headlinePrefix: 'OBJETO PROTEGIDO',action: 'ESCANEIE O QR CODE',   cta: 'Escaneie o QR Code para mais informações' },
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

// ── Utilitários ──────────────────────────────────────────────────────────────

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

function locationToText(value: unknown): string {
  try {
    if (!value) return '';
    if (typeof value === 'object' && value !== null && 'address' in value)
      return String((value as Record<string, unknown>).address ?? '');
    if (typeof value !== 'string') return '';
    const clean = value.trim();
    if (!clean) return '';
    if (clean.startsWith('{')) {
      const parsed = JSON.parse(clean);
      return String(parsed.address ?? parsed.label ?? '');
    }
    return clean;
  } catch { return ''; }
}

function clip(text: string | null | undefined, max: number): string {
  const value = (text ?? '').replace(/\s+/g, ' ').trim();
  return value.length > max ? `${value.slice(0, Math.max(0, max - 1))}…` : value;
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

function moneyBRL(value: number | null | undefined): string {
  if (!value || value <= 0) return '';
  return `R$ ${Number(value).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// ── Handler ───────────────────────────────────────────────────────────────────

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const url       = new URL(request.url);
    const formatParam = url.searchParams.get('format') as Format | null;
    const format: Format = formatParam && formatParam in FORMATS ? formatParam : 'vertical';
    const inkSaver  = url.searchParams.get('inkSaver') === '1' || url.searchParams.get('bw') === '1';
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

    const statusCfg  = STATUS_CONFIG[obj.status] ?? STATUS_CONFIG.lost;
    const catLabel   = CATEGORY_LABEL[obj.category] ?? 'Objeto';
    const emoji      = CATEGORY_EMOJI[obj.category] ?? '📦';
    const title      = clip(obj.title || catLabel, 52);
    const description = clip(obj.description, format === 'a4' ? 180 : 110);
    const address    = clip(locationToText(obj.location), format === 'a4' ? 70 : 48);
    const reward     = moneyBRL(obj.reward_amount);
    const createdAt  = obj.created_at
      ? new Date(obj.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
      : '';

    const appUrl  = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://backfindr.com').replace(/\/$/, '');
    const pageUrl = `${appUrl}/scan/${obj.qr_code}`;
    const qrSize  = format === 'a4' ? 520 : format === 'vertical' ? 260 : 230;
    const qrUrl   = `https://api.qrserver.com/v1/create-qr-code/?size=${qrSize}x${qrSize}&data=${encodeURIComponent(pageUrl)}&bgcolor=ffffff&color=111827&margin=10`;

    const [photo, qr] = await Promise.all([
      toDataUrl(normalizeImages(obj.images)[0] ?? null),
      toDataUrl(qrUrl),
    ]);

    const renderPhoto = (size: {
      width?: string; height?: string; fontSize: string;
      radius: string; border?: string; bg?: string; fit?: 'cover' | 'contain';
    }) => (
      <div style={{
        width: size.width ?? '100%', height: size.height ?? '100%',
        borderRadius: size.radius, overflow: 'hidden',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: size.bg ?? '#F3F4F6', border: size.border ?? 'none', flexShrink: 0,
      }}>
        {photo
          ? <img src={photo} style={{ width: '100%', height: '100%', objectFit: size.fit ?? 'cover' }} />
          : <span style={{ fontSize: size.fontSize }}>{emoji}</span>
        }
      </div>
    );

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
    // TEMPLATE A4 — MINIMAL CLEAN — 2480×3508
    // Fundo branco, header escuro, headline gigante, foto+bullets laterais,
    // QR grande com CTA, rodapé de compartilhamento
    // ─────────────────────────────────────────────────────────────────────────
    if (format === 'a4') {
      const black    = inkSaver ? '#FFFFFF' : BRAND.black;
      const topText  = inkSaver ? BRAND.black : '#FFFFFF';
      const border   = inkSaver ? '8px solid #0B0F14' : 'none';
      const headlineObject = title.toUpperCase();

      const imageResponse = new ImageResponse(
        (
          <div style={{
            width, height, background: BRAND.paper,
            display: 'flex', flexDirection: 'column',
            fontFamily: 'Arial, sans-serif', overflow: 'hidden', border,
          }}>
            {/* ── Header ── */}
            <div style={{
              height: 420, background: black, color: topText,
              display: 'flex', flexDirection: 'column',
              padding: '86px 120px 64px', flexShrink: 0,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
                  <div style={{
                    width: 84, height: 84, borderRadius: 22,
                    background: BRAND.teal, display: 'flex', alignItems: 'center',
                    justifyContent: 'center', fontSize: 48,
                  }}>⌖</div>
                  <span style={{ fontSize: 58, fontWeight: 900, letterSpacing: -2 }}>backfindr</span>
                </div>
                <div style={{
                  background: statusCfg.accent, color: '#fff',
                  borderRadius: 999, padding: '24px 64px',
                  fontSize: 52, fontWeight: 900, letterSpacing: 3,
                  display: 'flex',
                }}>{statusCfg.label}</div>
              </div>
            </div>

            {/* ── Headline ── */}
            <div style={{ padding: '58px 120px 0', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
              <div style={{
                color: statusCfg.accent, fontSize: 96, fontWeight: 950,
                lineHeight: 0.95, letterSpacing: -2, display: 'flex',
              }}>{statusCfg.headlinePrefix}</div>
              <div style={{
                color: BRAND.black,
                fontSize: headlineObject.length > 20 ? 136 : 166,
                fontWeight: 950, lineHeight: 0.92, letterSpacing: -5, display: 'flex',
              }}>{headlineObject}</div>
            </div>

            {/* ── Foto + Bullets laterais ── */}
            <div style={{
              display: 'flex', gap: 72, padding: '56px 120px 0',
              height: 1040, flexShrink: 0,
            }}>
              {/* Foto */}
              <div style={{
                width: 980, height: 980,
                border: `8px solid ${BRAND.teal}`,
                borderRadius: 48, padding: 20,
                display: 'flex', background: '#fff',
              }}>
                {renderPhoto({ height: '100%', fontSize: '300px', radius: '32px', bg: '#F8FAFC', fit: 'contain' })}
              </div>
              {/* Bullets */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 30, justifyContent: 'center' }}>
                <div style={{
                  background: BRAND.black, color: '#fff',
                  borderRadius: 34, padding: '42px 48px',
                  display: 'flex', flexDirection: 'column', gap: 18,
                }}>
                  <div style={{ fontSize: 42, color: BRAND.teal, fontWeight: 900, letterSpacing: 2, display: 'flex' }}>
                    RECONHECIMENTO RÁPIDO
                  </div>
                  <div style={{ fontSize: 52, lineHeight: 1.18, fontWeight: 850, display: 'flex' }}>
                    • {catLabel}
                  </div>
                  {description && (
                    <div style={{ fontSize: 42, lineHeight: 1.28, fontWeight: 700, color: '#E5E7EB', display: 'flex', flexWrap: 'wrap' }}>
                      • {description}
                    </div>
                  )}
                  {address && (
                    <div style={{ fontSize: 40, lineHeight: 1.25, fontWeight: 700, color: '#E5E7EB', display: 'flex', flexWrap: 'wrap' }}>
                      • Local: {address}
                    </div>
                  )}
                  {createdAt && (
                    <div style={{ fontSize: 40, lineHeight: 1.2, fontWeight: 700, color: '#E5E7EB', display: 'flex' }}>
                      • Data: {createdAt}
                    </div>
                  )}
                </div>
                {reward && (
                  <div style={{
                    background: '#FEF3C7', border: '6px solid #F59E0B',
                    borderRadius: 30, padding: '34px 44px',
                    color: '#92400E', fontSize: 58, fontWeight: 950, display: 'flex',
                  }}>RECOMPENSA: {reward}</div>
                )}
              </div>
            </div>

            {/* ── QR + CTA ── */}
            <div style={{
              margin: '62px 120px 0', background: BRAND.teal,
              borderRadius: 52, padding: '54px 62px',
              display: 'flex', alignItems: 'center', gap: 60, flexShrink: 0,
            }}>
              {renderQr(520, 26)}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14, flex: 1 }}>
                <div style={{ color: '#031B1A', fontSize: 92, fontWeight: 1000, lineHeight: 0.92, letterSpacing: -2, display: 'flex', flexWrap: 'wrap' }}>
                  {statusCfg.action}
                </div>
                <div style={{ color: '#053B38', fontSize: 44, fontWeight: 800, lineHeight: 1.22, display: 'flex', flexWrap: 'wrap' }}>
                  O QR Code abre a página do objeto no Backfindr. Ajude compartilhando ou avisando onde viu.
                </div>
                <div style={{ color: '#053B38', fontSize: 34, fontWeight: 700, display: 'flex' }}>
                  {appUrl.replace('https://', '')}/scan/{obj.qr_code}
                </div>
              </div>
            </div>

            {/* ── Rodapé ── */}
            <div style={{
              height: 220, flexShrink: 0,
              background: inkSaver ? '#fff' : BRAND.black,
              color: inkSaver ? BRAND.black : '#fff',
              borderTop: inkSaver ? '6px solid #0B0F14' : 'none',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: '0 120px', fontSize: 46, fontWeight: 900,
              textAlign: 'center',
            }}>
              CADA COMPARTILHAMENTO AUMENTA AS CHANCES DE RECUPERAÇÃO
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
      const headlineH = 240;
      const titleH    = 100;
      const descH     = 120;
      const metaH     = 120;
      const footerH   = 220;
      const gaps      = pad * 2 + 24 + 20 + 20 + 24 + 24;
      const photoH    = height - headerH - divH - headlineH - titleH - descH - metaH - footerH - gaps;

      const descTrunc = description;
      const addrShort = address;

      // headline split: "PERDI MINHA" / "MOCHILA"
      const hlParts   = statusCfg.headlinePrefix.split(' ');
      const hlLine1   = hlParts.slice(0, -1).join(' ');
      const hlLine2   = hlParts[hlParts.length - 1];

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
                background: statusCfg.accent, borderRadius: '100px',
                padding: '12px 32px', display: 'flex',
              }}>
                <span style={{ color: '#ffffff', fontSize: '28px', fontWeight: 800, letterSpacing: '1px' }}>
                  {statusCfg.label}
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
                : <span style={{ fontSize: '180px' }}>{emoji}</span>
              }
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
              }}>{hlLine1}</span>
              <span style={{
                color: '#ffffff', fontSize: '100px', fontWeight: 900,
                letterSpacing: '-3px', lineHeight: 0.92, display: 'flex', flexWrap: 'wrap',
              }}>{hlLine2} {title.toUpperCase()}</span>
            </div>

            {/* ── Título do objeto ── */}
            <div style={{
              padding: `0 ${pad}px`,
              height: `${titleH}px`, flexShrink: 0,
              display: 'flex', alignItems: 'center',
            }}>
              <span style={{
                color: 'rgba(255,255,255,0.87)', fontSize: '44px', fontWeight: 700,
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
                  color: 'rgba(255,255,255,0.6)', fontSize: '30px', lineHeight: 1.5,
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
                  <span style={{ color: 'rgba(255,255,255,0.67)', fontSize: '28px', fontWeight: 600 }}>{createdAt}</span>
                </div>
              )}
              {addrShort && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '26px', flexShrink: 0 }}>📍</span>
                  <span style={{ color: 'rgba(255,255,255,0.67)', fontSize: '28px', fontWeight: 600, display: 'flex', flexWrap: 'wrap' }}>{addrShort}</span>
                </div>
              )}
            </div>

            {/* ── Rodapé QR ── */}
            <div style={{
              margin: `24px ${pad}px ${pad}px`,
              background: 'rgba(20,184,166,0.10)',
              border: `2px solid rgba(20,184,166,0.33)`,
              borderRadius: '20px', padding: '24px 28px',
              display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '24px',
              flex: 1,
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
                  {statusCfg.cta}
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
    const teal      = '#14B8A6';
    const topH      = 340;
    const footH     = 240;
    const bodyH     = height - topH - footH;
    const pad       = 40;
    const photoW    = 420;

    const descShort = description;
    const addrShort = address;

    // headline split para quadrado
    const sqParts  = statusCfg.headlinePrefix.split(' ');
    const sqLine1  = sqParts.slice(0, -1).join(' ');
    const sqLine2  = sqParts[sqParts.length - 1];

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
            background: statusCfg.accent,
            display: 'flex', flexDirection: 'column',
            alignItems: 'flex-start', justifyContent: 'center',
            padding: `0 ${pad}px`, flexShrink: 0,
          }}>
            <span style={{
              color: '#ffffff', fontSize: '84px', fontWeight: 900,
              letterSpacing: '-2px', lineHeight: 1.0, display: 'flex',
            }}>{sqLine1}</span>
            <span style={{
              color: '#ffffff', fontSize: '104px', fontWeight: 900,
              letterSpacing: '-3px', lineHeight: 0.9, display: 'flex', flexWrap: 'wrap',
            }}>{sqLine2} {title.toUpperCase()}</span>
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
                : <span style={{ fontSize: '120px' }}>{emoji}</span>
              }
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
                      {reward}
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
