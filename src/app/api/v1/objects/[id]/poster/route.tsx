import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { buildPosterData } from '@/lib/posterFormatter';
import sharp from 'sharp';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const FORMATS = {
  square:   { width: 1080, height: 1080 },
  vertical: { width: 1080, height: 1920 },
  a4:       { width: 2480, height: 3508 },
} as const;

type Format = keyof typeof FORMATS;

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

// ── Crop de imagem com Sharp (cover 1080×620 para o quadrado) ────────────────
async function cropToDataUrl(imageUrl: string | null, w: number, h: number): Promise<string | null> {
  if (!imageUrl) return null;
  try {
    let buffer: Buffer;
    if (imageUrl.startsWith('data:')) {
      const base64 = imageUrl.split(',')[1];
      buffer = Buffer.from(base64, 'base64');
    } else {
      const res = await fetch(imageUrl, { cache: 'no-store' });
      if (!res.ok) return null;
      buffer = Buffer.from(await res.arrayBuffer());
    }
    const cropped = await sharp(buffer)
      .resize(w, h, { fit: 'contain', background: { r: 17, g: 24, b: 39, alpha: 1 } })
      .jpeg({ quality: 85 })
      .toBuffer();
    return `data:image/jpeg;base64,${cropped.toString('base64')}`;
  } catch { return null; }
}

// ── Mapa OSM via tile interno ─────────────────────────────────────────────────
// Converte lat/lng para coordenadas de tile OSM no zoom desejado
function latLngToTile(lat: number, lng: number, zoom: number) {
  const n = Math.pow(2, zoom);
  const x = Math.floor((lng + 180) / 360 * n);
  const latRad = lat * Math.PI / 180;
  const y = Math.floor((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * n);
  return { x, y };
}

async function buildMapDataUrl(lat: number, lng: number, tileSize = 256): Promise<string | null> {
  try {
    const zoom = 15;
    const { x, y } = latLngToTile(lat, lng, zoom);
    // Busca tile central + 2x2 vizinhos para ter área suficiente (3x3 grid)
    const offsets = [-1, 0, 1];
    const tiles: { dx: number; dy: number; data: string }[] = [];

    await Promise.all(
      offsets.flatMap(dy =>
        offsets.map(async dx => {
          const url = `https://tile.openstreetmap.org/${zoom}/${x + dx}/${y + dy}.png`;
          const data = await toDataUrl(url);
          if (data) tiles.push({ dx, dy, data });
        })
      )
    );

    if (tiles.length === 0) return null;

    // Retorna apenas os dados dos tiles para composição no JSX
    return JSON.stringify({ tiles, tileSize, zoom, cx: x, cy: y, lat, lng });
  } catch { return null; }
}

// ── Extrai lat/lng do campo location ─────────────────────────────────────────
function extractLatLng(location: unknown, lat: unknown, lng: unknown): { lat: number; lng: number } | null {
  const latN = lat ? parseFloat(String(lat)) : null;
  const lngN = lng ? parseFloat(String(lng)) : null;
  if (latN && lngN && !isNaN(latN) && !isNaN(lngN)) return { lat: latN, lng: lngN };

  if (location && typeof location === 'string') {
    try {
      const p = JSON.parse(location);
      if (p.lat && p.lng) return { lat: parseFloat(p.lat), lng: parseFloat(p.lng) };
    } catch { /* ignorar */ }
  }
  if (location && typeof location === 'object') {
    const loc = location as Record<string, unknown>;
    if (loc.lat && loc.lng) return { lat: parseFloat(String(loc.lat)), lng: parseFloat(String(loc.lng)) };
  }
  return null;
}

// ── Handler ───────────────────────────────────────────────────────────────────

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const url         = new URL(request.url);
    const formatParam = url.searchParams.get('format') as Format | null;
    const format: Format = formatParam && formatParam in FORMATS ? formatParam : 'vertical';
    const { width, height } = FORMATS[format];

    const result = await query(
      `SELECT
        o.id, o.title, o.description, o.status, o.category, o.qr_code, o.images,
        o.location, o.latitude, o.longitude, o.reward_amount, o.created_at,
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
      latitude: unknown; longitude: unknown;
      reward_amount: number | null; created_at: string;
      has_active_boost: boolean;
    };

    const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://backfindr.com').replace(/\/$/, '');

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

    const coords = extractLatLng(obj.location, obj.latitude, obj.longitude);

    const qrSmall = 160; // QR menor — elemento funcional, não estrela
    const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=${qrSmall}x${qrSmall}&data=${encodeURIComponent(pd.qrUrl)}&bgcolor=ffffff&color=0d1117&margin=6`;

    // Para o quadrado, preparar versão cropada
    const photoCropped = format === 'square' ? await cropToDataUrl(pd.photoUrl, 1080, 580) : null;

    const [photo, qr, mapRaw] = await Promise.all([
      toDataUrl(pd.photoUrl),
      toDataUrl(qrApiUrl),
      coords ? buildMapDataUrl(coords.lat, coords.lng) : Promise.resolve(null),
    ]);

    // Parse dos dados do mapa
    type TileData = { dx: number; dy: number; data: string };
    let mapTiles: TileData[] = [];
    const TILE = 256;

    if (mapRaw) {
      try {
        const parsed = JSON.parse(mapRaw) as { tiles: TileData[] };
        mapTiles = parsed.tiles;
      } catch { /* ignorar */ }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // HELPER: Mini mapa composto por tiles OSM (3×3 grid, 256px cada)
    // Tamanho total renderizado: 3×256 = 768px → escalamos para o tamanho desejado
    // ─────────────────────────────────────────────────────────────────────────
    const renderMap = (sizePx: number) => {
      if (mapTiles.length === 0) {
        // Fallback sem mapa: mostra só o endereço
        return pd.locationShort ? (
          <div style={{
            width: `${sizePx}px`, height: `${Math.round(sizePx * 0.55)}px`,
            background: '#1a2535', borderRadius: '12px',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: `${Math.round(sizePx * 0.07)}px`, display: 'flex' }}>
              📍 {pd.locationShort}
            </span>
          </div>
        ) : null;
      }

      const mapH = Math.round(sizePx * 0.55);
      const gridPx = TILE * 3; // 768px virtual

      return (
        <div style={{
          width: `${sizePx}px`, height: `${mapH}px`,
          overflow: 'hidden', borderRadius: '12px',
          position: 'relative', flexShrink: 0,
          display: 'flex',
        }}>
          {/* Tiles */}
          {mapTiles.map(t => (
            <img
              key={`${t.dx}-${t.dy}`}
              src={t.data}
              style={{
                position: 'absolute',
                left: `${((t.dx + 1) * TILE / gridPx) * sizePx}px`,
                top: `${((t.dy + 1) * TILE / gridPx) * mapH}px`,
                width: `${(TILE / gridPx) * sizePx}px`,
                height: `${(TILE / gridPx) * mapH}px`,
              }}
            />
          ))}
          {/* Pin central */}
          <div style={{
            position: 'absolute',
            left: `${sizePx / 2 - 10}px`,
            top: `${mapH / 2 - 24}px`,
            display: 'flex', flexDirection: 'column', alignItems: 'center',
          }}>
            <div style={{
              width: '20px', height: '20px', background: '#ef4444',
              borderRadius: '50% 50% 50% 0', transform: 'rotate(-45deg)',
              border: '3px solid #fff', display: 'flex',
            }} />
          </div>
          {/* Overlay escuro nas bordas */}
          <div style={{
            position: 'absolute', inset: 0,
            background: 'linear-gradient(to bottom, rgba(13,17,23,0.2) 0%, transparent 30%, transparent 70%, rgba(13,17,23,0.5) 100%)',
            display: 'flex',
          }} />
        </div>
      );
    };

    // ─────────────────────────────────────────────────────────────────────────
    // TEMPLATE QUADRADO — 1080×1080
    // Layout: foto hero de fundo (60%), conteúdo sobre overlay escuro (40% inferior)
    // ─────────────────────────────────────────────────────────────────────────
    if (format === 'square') {
      const teal = '#14B8A6';
      const accent = pd.statusColor;

      const imageResponse = new ImageResponse(
        (
          <div style={{
            width: '1080px', height: '1080px',
            background: '#0d1117',
            display: 'flex', flexDirection: 'column',
            fontFamily: 'sans-serif',
          }}>

            {/* ZONA 1 — FOTO (580px) */}
            <div style={{
              width: '1080px', height: '580px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: '#111827', flexShrink: 0, position: 'relative',
            }}>
              {(photoCropped || photo)
                ? <img src={photoCropped ?? photo!} style={{ width: '1080px', height: '580px' }} />
                : <span style={{ fontSize: '180px' }}>📦</span>
              }
              {/* Badge status — canto superior direito */}
              <div style={{
                position: 'absolute', top: '28px', right: '32px',
                background: accent, borderRadius: '8px',
                padding: '10px 28px', display: 'flex',
              }}>
                <span style={{ color: '#fff', fontSize: '24px', fontWeight: 900, letterSpacing: '2px' }}>
                  {pd.statusLabel}
                </span>
              </div>
              {/* Logo — canto superior esquerdo */}
              <div style={{
                position: 'absolute', top: '28px', left: '32px',
                display: 'flex', alignItems: 'center', gap: '10px',
              }}>
                <div style={{
                  width: '40px', height: '40px', background: teal,
                  borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <span style={{ color: '#fff', fontSize: '22px', fontWeight: 900 }}>B</span>
                </div>
                <span style={{ color: 'rgba(255,255,255,0.9)', fontSize: '24px', fontWeight: 800, display: 'flex' }}>Backfindr</span>
              </div>
            </div>

            {/* DIVISÓRIA TEAL */}
            <div style={{ width: '1080px', height: '4px', background: teal, flexShrink: 0 }} />

            {/* ZONA 2 — CONTEÚDO (496px) */}
            <div style={{
              flex: 1, display: 'flex', flexDirection: 'column',
              padding: '28px 48px 24px',
              background: '#0d1117',
            }}>
              {/* Eyebrow */}
              <span style={{
                color: accent, fontSize: '24px', fontWeight: 800,
                letterSpacing: '3px', display: 'flex', marginBottom: '6px',
              }}>{pd.eyebrow}</span>

              {/* Título principal */}
              <span style={{
                color: '#ffffff', fontSize: '68px', fontWeight: 900,
                letterSpacing: '-2px', lineHeight: 0.92,
                display: 'flex', flexWrap: 'wrap', marginBottom: '12px',
              }}>{pd.headline}</span>

              {/* Subtítulo */}
              <span style={{
                color: 'rgba(255,255,255,0.8)', fontSize: '28px', fontWeight: 600,
                display: 'flex', flexWrap: 'wrap', marginBottom: '6px',
              }}>{pd.subtitle}</span>

              {/* Descrição */}
              {pd.description && (
                <span style={{
                  color: 'rgba(255,255,255,0.5)', fontSize: '22px',
                  display: 'flex', flexWrap: 'wrap', marginBottom: '12px',
                }}>{pd.description}</span>
              )}

              {/* Meta */}
              <div style={{ display: 'flex', gap: '28px', marginBottom: '16px' }}>
                {pd.date && (
                  <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '22px', display: 'flex' }}>
                    📅 {pd.date}
                  </span>
                )}
                {pd.locationShort && (
                  <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '22px', display: 'flex' }}>
                    📍 {pd.locationShort}
                  </span>
                )}
              </div>

              {/* Recompensa */}
              {pd.reward && (
                <div style={{
                  background: 'rgba(251,191,36,0.12)', border: '1.5px solid rgba(251,191,36,0.4)',
                  borderRadius: '10px', padding: '10px 20px',
                  display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px',
                }}>
                  <span style={{ fontSize: '24px' }}>💰</span>
                  <span style={{ color: '#fbbf24', fontSize: '26px', fontWeight: 900, display: 'flex' }}>
                    RECOMPENSA: {pd.reward}
                  </span>
                </div>
              )}

              {/* QR + CTA */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: '20px',
                background: 'rgba(20,184,166,0.08)',
                border: '1.5px solid rgba(20,184,166,0.3)',
                borderRadius: '14px', padding: '14px 20px',
                marginTop: 'auto',
              }}>
                {qr && (
                  <div style={{
                    background: '#fff', borderRadius: '8px',
                    padding: '6px', display: 'flex', flexShrink: 0,
                  }}>
                    <img src={qr} style={{ width: '100px', height: '100px' }} />
                  </div>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span style={{ color: teal, fontSize: '26px', fontWeight: 900, display: 'flex' }}>
                    VOCÊ VIU? ESCANEIE
                  </span>
                  <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '20px', display: 'flex' }}>
                    Avise o dono — backfindr.com
                  </span>
                </div>
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
    // TEMPLATE VERTICAL — 1080×1920
    // Layout: foto hero grande (topo), conteúdo completo (baixo), mapa lateral
    // ─────────────────────────────────────────────────────────────────────────
    if (format === 'vertical') {
      const qrSize = 260;
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
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: `${pad}px ${pad}px 24px`,
              height: `${headerH + pad}px`, flexShrink: 0,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <span style={{ color: '#14B8A6', fontSize: '36px', fontWeight: 900 }}>Backfindr</span>
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
            <div style={{
              margin: `0 ${pad}px`,
              height: `${photoH}px`,
              border: `3px solid ${teal}`,
              borderRadius: '20px', overflow: 'hidden',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: '#1a2030', flexShrink: 0,
            }}>
              {photo
                ? <img src={photo} style={{ maxHeight: '100%' }} />
                : <span style={{ fontSize: '180px' }}>📦</span>
              }
            </div>
            <div style={{
              margin: `24px ${pad}px 0`,
              height: `${divH}px`, background: pd.statusColor, display: 'flex', flexShrink: 0,
            }} />
            <div style={{
              padding: `20px ${pad}px 0`,
              display: 'flex', flexDirection: 'column',
              height: `${headlineH}px`, flexShrink: 0,
            }}>
              <span style={{
                color: pd.statusColor, fontSize: '52px', fontWeight: 900,
                letterSpacing: '-1px', lineHeight: 1.0, display: 'flex',
              }}>{pd.eyebrow}</span>
              <span style={{
                color: '#ffffff', fontSize: '80px', fontWeight: 900,
                letterSpacing: '-3px', lineHeight: 0.92, display: 'flex', flexWrap: 'wrap',
              }}>{pd.headline}</span>
            </div>
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
              {pd.reward && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '26px' }}>💰</span>
                  <span style={{ color: '#fbbf24', fontSize: '28px', fontWeight: 900, display: 'flex' }}>{pd.reward}</span>
                </div>
              )}
            </div>
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
    // TEMPLATE A4 — 2480×3508 — CARTAZ IMPRESSO
    // Fundo branco, conteúdo denso com mapa lateral
    // ─────────────────────────────────────────────────────────────────────────
    const tealA4   = '#14B8A6';
    const accentA4 = pd.statusColor;
    const pad4     = 120;

    const imageResponse = new ImageResponse(
      (
        <div style={{
          width, height, background: '#FFFFFF',
          display: 'flex', flexDirection: 'column',
          fontFamily: 'Arial, sans-serif', overflow: 'hidden',
          padding: `${pad4}px`,
        }}>

          {/* ── 1. Logo + Badge ── */}
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            marginBottom: '40px', flexShrink: 0,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
              <div style={{
                width: '90px', height: '90px', background: tealA4,
                borderRadius: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <span style={{ color: '#fff', fontSize: '52px', fontWeight: 900 }}>B</span>
              </div>
              <span style={{ fontSize: '52px', fontWeight: 900, color: '#111827', display: 'flex' }}>Backfindr</span>
            </div>
            <div style={{
              border: `5px solid ${accentA4}`, color: accentA4,
              borderRadius: '999px', padding: '18px 60px',
              fontSize: '52px', fontWeight: 900, letterSpacing: '4px', display: 'flex',
            }}>{pd.statusLabel}</div>
          </div>

          {/* ── 2. Divisória ── */}
          <div style={{ height: '5px', background: tealA4, marginBottom: '40px', flexShrink: 0 }} />

          {/* ── 3. Headline ── */}
          <div style={{ display: 'flex', flexDirection: 'column', marginBottom: '48px', flexShrink: 0 }}>
            <span style={{ color: accentA4, fontSize: '88px', fontWeight: 900, letterSpacing: '-2px', lineHeight: 1.0, display: 'flex' }}>
              {pd.eyebrow}
            </span>
            <span style={{
              color: '#111827',
              fontSize: pd.headline.length > 18 ? 148 : 180,
              fontWeight: 900, lineHeight: 0.88, letterSpacing: '-6px', display: 'flex',
            }}>{pd.headline}</span>
            <span style={{ color: '#374151', fontSize: '80px', fontWeight: 700, lineHeight: 1.1, marginTop: '20px', display: 'flex', flexWrap: 'wrap' }}>
              {pd.subtitle}
            </span>
          </div>

          {/* ── 4. Foto + Mapa lado a lado ── */}
          <div style={{ display: 'flex', flexDirection: 'row', gap: '48px', marginBottom: '48px', flexShrink: 0, height: '1100px' }}>
            {/* Foto */}
            <div style={{
              flex: 2, borderRadius: '24px', overflow: 'hidden',
              border: `4px solid ${tealA4}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: '#F9FAFB',
            }}>
              {photo
                ? <img src={photo} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                : <span style={{ fontSize: '300px' }}>📦</span>
              }
            </div>

            {/* Coluna direita: dados + mapa */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '32px' }}>

              {/* Dados */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                {pd.description && (
                  <span style={{ color: '#374151', fontSize: '56px', fontWeight: 600, lineHeight: 1.3, display: 'flex', flexWrap: 'wrap' }}>
                    {pd.description}
                  </span>
                )}
                {pd.date && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <span style={{ fontSize: '48px' }}>📅</span>
                    <span style={{ color: '#374151', fontSize: '52px', fontWeight: 700, display: 'flex' }}>{pd.date}</span>
                  </div>
                )}
                {pd.locationShort && (
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
                    <span style={{ fontSize: '48px', flexShrink: 0 }}>📍</span>
                    <span style={{ color: '#374151', fontSize: '52px', fontWeight: 700, display: 'flex', flexWrap: 'wrap' }}>{pd.locationShort}</span>
                  </div>
                )}
                {pd.reward && (
                  <div style={{
                    background: '#fef3c7', border: '3px solid #f59e0b',
                    borderRadius: '16px', padding: '24px 32px', display: 'flex', alignItems: 'center', gap: '16px',
                  }}>
                    <span style={{ fontSize: '52px' }}>💰</span>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ color: '#92400e', fontSize: '36px', fontWeight: 700, display: 'flex' }}>RECOMPENSA</span>
                      <span style={{ color: '#78350f', fontSize: '64px', fontWeight: 900, display: 'flex' }}>{pd.reward}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Mini mapa */}
              {mapTiles.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', flex: 1 }}>
                  <span style={{ color: tealA4, fontSize: '40px', fontWeight: 800, letterSpacing: '2px', display: 'flex' }}>
                    LOCAL DA OCORRÊNCIA
                  </span>
                  <div style={{
                    flex: 1, overflow: 'hidden', borderRadius: '16px',
                    position: 'relative', display: 'flex',
                    border: `3px solid ${tealA4}`,
                  }}>
                    {mapTiles.map(t => {
                      const mW = 500; const mH = 380;
                      return (
                        <img
                          key={`a4-${t.dx}-${t.dy}`}
                          src={t.data}
                          style={{
                            position: 'absolute',
                            left: `${((t.dx + 1) * TILE / (TILE * 3)) * mW}px`,
                            top: `${((t.dy + 1) * TILE / (TILE * 3)) * mH}px`,
                            width: `${(TILE / (TILE * 3)) * mW}px`,
                            height: `${(TILE / (TILE * 3)) * mH}px`,
                          }}
                        />
                      );
                    })}
                    <div style={{
                      position: 'absolute', left: '238px', top: '162px',
                      width: '24px', height: '24px',
                      background: '#ef4444', borderRadius: '50% 50% 50% 0',
                      transform: 'rotate(-45deg)', border: '4px solid #fff',
                      display: 'flex',
                    }} />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── 5. Divisória ── */}
          <div style={{ height: '3px', background: '#E5E7EB', marginBottom: '40px', flexShrink: 0 }} />

          {/* ── 6. QR + CTA ── */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '60px', flexShrink: 0 }}>
            {qr && (
              <div style={{
                border: `4px solid ${tealA4}`, borderRadius: '20px',
                padding: '16px', background: '#fff', display: 'flex', flexShrink: 0,
              }}>
                <img src={qr} style={{ width: '360px', height: '360px' }} />
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', flex: 1 }}>
              <span style={{ color: '#111827', fontSize: '88px', fontWeight: 900, lineHeight: 0.92, letterSpacing: '-2px', display: 'flex', flexWrap: 'wrap' }}>
                ESCANEIE SE VOCÊ VIU
              </span>
              <span style={{ color: '#374151', fontSize: '56px', fontWeight: 600, lineHeight: 1.3, display: 'flex', flexWrap: 'wrap' }}>
                O QR Code abre a página do objeto. Avise o dono — ele recebe um alerta imediato.
              </span>
              <span style={{ color: tealA4, fontSize: '48px', fontWeight: 700, display: 'flex' }}>
                backfindr.com/scan/{obj.qr_code}
              </span>
            </div>
          </div>

          {/* ── 7. Rodapé ── */}
          <div style={{ height: '3px', background: '#E5E7EB', marginTop: '40px', marginBottom: '28px', flexShrink: 0 }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
            <span style={{ color: '#9CA3AF', fontSize: '44px', fontWeight: 600, display: 'flex', flexWrap: 'wrap' }}>
              Cada compartilhamento aumenta as chances de recuperação.
            </span>
            <span style={{ color: tealA4, fontSize: '44px', fontWeight: 800, display: 'flex' }}>Backfindr.com</span>
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
    return new Response(`Erro: ${err instanceof Error ? err.message : String(err)}`, { status: 500 });
  }
}
