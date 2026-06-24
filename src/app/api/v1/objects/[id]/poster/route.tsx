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

async function toDataUrl(imageUrl: string | null, timeoutMs = 4000): Promise<string | null> {
  if (!imageUrl) return null;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(imageUrl, { cache: 'no-store', signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return null;
    const buffer = await res.arrayBuffer();
    const base64 = Buffer.from(buffer).toString('base64');
    const ct = res.headers.get('content-type') || 'image/png';
    return `data:${ct};base64,${base64}`;
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
  return null; // mapa temporariamente desabilitado — position:absolute nao suportado no next/og
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
          const data = await toDataUrl(url, 3000);
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
      const accent = pd.statusColor;
      const teal   = '#14B8A6';

      const imageResponse = new ImageResponse(
        (
          <div style={{
            width: `${width}px`, height: `${height}px`,
            background: '#0d1117',
            display: 'flex', flexDirection: 'column',
            fontFamily: 'sans-serif', overflow: 'hidden',
            position: 'relative',
          }}>
            {/* ── Foto hero ocupa zona superior ── */}
            <div style={{
              position: 'absolute', top: 0, left: 0, right: 0, height: '620px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: '#111827', overflow: 'hidden',
            }}>
              {photo
                ? <img src={photo} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center' }} />
                : <span style={{ fontSize: '200px' }}>📦</span>
              }
              {/* Gradiente sobre foto */}
              <div style={{
                position: 'absolute', inset: 0,
                background: 'linear-gradient(to bottom, rgba(13,17,23,0.55) 0%, transparent 35%, transparent 50%, rgba(13,17,23,0.92) 100%)',
                display: 'flex',
              }} />
            </div>

            {/* ── Topo: Logo + Badge ── */}
            <div style={{
              position: 'absolute', top: 0, left: 0, right: 0,
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '36px 44px', zIndex: 10,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '44px', height: '44px', background: teal,
                  borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <span style={{ color: '#fff', fontSize: '24px', fontWeight: 900 }}>B</span>
                </div>
                <span style={{ color: 'rgba(255,255,255,0.9)', fontSize: '28px', fontWeight: 800, display: 'flex' }}>Backfindr</span>
              </div>
              <div style={{
                background: accent, borderRadius: '8px',
                padding: '10px 28px', display: 'flex',
              }}>
                <span style={{ color: '#fff', fontSize: '22px', fontWeight: 900, letterSpacing: '2px', display: 'flex' }}>
                  {pd.statusLabel}
                </span>
              </div>
            </div>

            {/* ── Zona inferior: conteúdo sobre overlay ── */}
            <div style={{
              position: 'absolute', bottom: 0, left: 0, right: 0,
              display: 'flex', flexDirection: 'column',
              padding: '0 44px 40px', zIndex: 10,
            }}>
              {/* Eyebrow + Headline */}
              <div style={{ display: 'flex', flexDirection: 'column', marginBottom: '20px' }}>
                <span style={{
                  color: accent, fontSize: '28px', fontWeight: 900,
                  letterSpacing: '3px', display: 'flex', marginBottom: '4px',
                }}>{pd.eyebrow}</span>
                <span style={{
                  color: '#ffffff', fontSize: '92px', fontWeight: 900,
                  letterSpacing: '-3px', lineHeight: 0.88, display: 'flex', flexWrap: 'wrap',
                }}>{pd.headline}</span>
              </div>

              {/* Subtítulo */}
              <span style={{
                color: 'rgba(255,255,255,0.85)', fontSize: '36px', fontWeight: 700,
                lineHeight: 1.2, display: 'flex', flexWrap: 'wrap', marginBottom: '16px',
              }}>{pd.subtitle}</span>

              {/* Descrição */}
              {pd.description && (
                <span style={{
                  color: 'rgba(255,255,255,0.6)', fontSize: '26px', lineHeight: 1.4,
                  display: 'flex', flexWrap: 'wrap', marginBottom: '20px',
                }}>{pd.description}</span>
              )}

              {/* Meta: data, local, recompensa */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '28px' }}>
                {pd.date && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '22px' }}>📅</span>
                    <span style={{ color: 'rgba(255,255,255,0.65)', fontSize: '24px', fontWeight: 600, display: 'flex' }}>{pd.date}</span>
                  </div>
                )}
                {pd.locationShort && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '22px', flexShrink: 0 }}>📍</span>
                    <span style={{ color: 'rgba(255,255,255,0.65)', fontSize: '24px', fontWeight: 600, display: 'flex', flexWrap: 'wrap' }}>{pd.locationShort}</span>
                  </div>
                )}
                {pd.reward && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '22px' }}>💰</span>
                    <span style={{ color: '#fbbf24', fontSize: '28px', fontWeight: 900, display: 'flex' }}>
                      RECOMPENSA: {pd.reward}
                    </span>
                  </div>
                )}
              </div>

              {/* Rodapé: QR + CTA + Mapa */}
              <div style={{
                display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '20px',
                background: 'rgba(20,184,166,0.12)',
                border: '1.5px solid rgba(20,184,166,0.35)',
                borderRadius: '16px', padding: '18px 22px',
              }}>
                {/* QR menor */}
                {qr && (
                  <div style={{
                    background: '#fff', borderRadius: '8px',
                    padding: '8px', display: 'flex', flexShrink: 0,
                  }}>
                    <img src={qr} style={{ width: `${qrSmall}px`, height: `${qrSmall}px` }} />
                  </div>
                )}
                {/* CTA */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 }}>
                  <span style={{ color: teal, fontSize: '30px', fontWeight: 900, display: 'flex', flexWrap: 'wrap' }}>
                    VOCÊ VIU? ESCANEIE
                  </span>
                  <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: '20px', display: 'flex', flexWrap: 'wrap' }}>
                    Avise o dono — backfindr.com
                  </span>
                </div>
                {/* Mini mapa */}
                {mapTiles.length > 0 && (
                  <div style={{
                    width: '140px', height: '100px',
                    overflow: 'hidden', borderRadius: '10px',
                    position: 'relative', flexShrink: 0, display: 'flex',
                    border: '1.5px solid rgba(255,255,255,0.15)',
                  }}>
                    {mapTiles.map(t => (
                      <img
                        key={`sq-${t.dx}-${t.dy}`}
                        src={t.data}
                        style={{
                          position: 'absolute',
                          left: `${((t.dx + 1) * TILE / (TILE * 3)) * 140}px`,
                          top: `${((t.dy + 1) * TILE / (TILE * 3)) * 100}px`,
                          width: `${(TILE / (TILE * 3)) * 140}px`,
                          height: `${(TILE / (TILE * 3)) * 100}px`,
                        }}
                      />
                    ))}
                    {/* Pin */}
                    <div style={{
                      position: 'absolute', left: '63px', top: '32px',
                      width: '14px', height: '14px',
                      background: '#ef4444', borderRadius: '50% 50% 50% 0',
                      transform: 'rotate(-45deg)', border: '2px solid #fff',
                      display: 'flex',
                    }} />
                  </div>
                )}
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
      const accent = pd.statusColor;
      const teal   = '#14B8A6';
      const pad    = 52;
      const photoH = 820;

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
              padding: `${pad}px ${pad}px 28px`, flexShrink: 0,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{
                  width: '52px', height: '52px', background: teal,
                  borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <span style={{ color: '#fff', fontSize: '28px', fontWeight: 900 }}>B</span>
                </div>
                <span style={{ color: 'rgba(255,255,255,0.9)', fontSize: '34px', fontWeight: 800, display: 'flex' }}>Backfindr</span>
              </div>
              <div style={{ background: accent, borderRadius: '8px', padding: '12px 32px', display: 'flex' }}>
                <span style={{ color: '#fff', fontSize: '26px', fontWeight: 900, letterSpacing: '2px', display: 'flex' }}>
                  {pd.statusLabel}
                </span>
              </div>
            </div>

            {/* ── Foto hero ── */}
            <div style={{
              margin: `0 ${pad}px`,
              height: `${photoH}px`,
              borderRadius: '20px', overflow: 'hidden',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: '#111827', flexShrink: 0,
              position: 'relative',
            }}>
              {photo
                ? <img src={photo} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center' }} />
                : <span style={{ fontSize: '200px' }}>📦</span>
              }
              {/* Overlay gradiente inferior */}
              <div style={{
                position: 'absolute', bottom: 0, left: 0, right: 0, height: '200px',
                background: 'linear-gradient(to top, rgba(13,17,23,0.85), transparent)',
                display: 'flex',
              }} />
            </div>

            {/* ── Linha de urgência ── */}
            <div style={{
              height: '4px', background: accent,
              margin: `28px ${pad}px 0`, flexShrink: 0,
            }} />

            {/* ── Headline ── */}
            <div style={{ padding: `20px ${pad}px 0`, flexShrink: 0 }}>
              <span style={{
                color: accent, fontSize: '46px', fontWeight: 900,
                letterSpacing: '2px', display: 'flex', marginBottom: '6px',
              }}>{pd.eyebrow}</span>
              <span style={{
                color: '#ffffff', fontSize: '84px', fontWeight: 900,
                letterSpacing: '-3px', lineHeight: 0.88, display: 'flex', flexWrap: 'wrap',
              }}>{pd.headline}</span>
            </div>

            {/* ── Subtítulo ── */}
            <div style={{ padding: `14px ${pad}px 0`, flexShrink: 0 }}>
              <span style={{
                color: 'rgba(255,255,255,0.87)', fontSize: '38px', fontWeight: 700,
                lineHeight: 1.2, display: 'flex', flexWrap: 'wrap',
              }}>{pd.subtitle}</span>
            </div>

            {/* ── Descrição ── */}
            {pd.description && (
              <div style={{ padding: `10px ${pad}px 0`, flexShrink: 0 }}>
                <span style={{
                  color: 'rgba(255,255,255,0.6)', fontSize: '28px', lineHeight: 1.5,
                  display: 'flex', flexWrap: 'wrap',
                }}>{pd.description}</span>
              </div>
            )}

            {/* ── Meta + Mapa ── */}
            <div style={{
              display: 'flex', flexDirection: 'row', gap: '24px',
              padding: `20px ${pad}px 0`, flexShrink: 0, alignItems: 'flex-start',
            }}>
              {/* Dados */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', flex: 1 }}>
                {pd.date && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ fontSize: '26px' }}>📅</span>
                    <span style={{ color: 'rgba(255,255,255,0.65)', fontSize: '26px', fontWeight: 600, display: 'flex' }}>{pd.date}</span>
                  </div>
                )}
                {pd.locationShort && (
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                    <span style={{ fontSize: '26px', flexShrink: 0 }}>📍</span>
                    <span style={{ color: 'rgba(255,255,255,0.65)', fontSize: '26px', fontWeight: 600, display: 'flex', flexWrap: 'wrap' }}>{pd.locationShort}</span>
                  </div>
                )}
                {pd.reward && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ fontSize: '26px' }}>💰</span>
                    <span style={{ color: '#fbbf24', fontSize: '30px', fontWeight: 900, display: 'flex' }}>
                      RECOMPENSA: {pd.reward}
                    </span>
                  </div>
                )}
              </div>

              {/* Mini mapa */}
              {mapTiles.length > 0 && (
                <div style={{
                  width: '280px', height: '180px',
                  overflow: 'hidden', borderRadius: '12px',
                  position: 'relative', flexShrink: 0, display: 'flex',
                  border: '1.5px solid rgba(255,255,255,0.15)',
                }}>
                  {mapTiles.map(t => (
                    <img
                      key={`vt-${t.dx}-${t.dy}`}
                      src={t.data}
                      style={{
                        position: 'absolute',
                        left: `${((t.dx + 1) * TILE / (TILE * 3)) * 280}px`,
                        top: `${((t.dy + 1) * TILE / (TILE * 3)) * 180}px`,
                        width: `${(TILE / (TILE * 3)) * 280}px`,
                        height: `${(TILE / (TILE * 3)) * 180}px`,
                      }}
                    />
                  ))}
                  <div style={{
                    position: 'absolute', left: '126px', top: '70px',
                    width: '16px', height: '16px',
                    background: '#ef4444', borderRadius: '50% 50% 50% 0',
                    transform: 'rotate(-45deg)', border: '2px solid #fff',
                    display: 'flex',
                  }} />
                </div>
              )}
            </div>

            {/* ── Rodapé QR ── */}
            <div style={{
              margin: `auto ${pad}px ${pad}px`,
              background: 'rgba(20,184,166,0.10)',
              border: '1.5px solid rgba(20,184,166,0.35)',
              borderRadius: '20px', padding: '24px 28px',
              display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '24px',
              flexShrink: 0,
            }}>
              {qr && (
                <div style={{ background: '#ffffff', borderRadius: '10px', padding: '10px', display: 'flex', flexShrink: 0 }}>
                  <img src={qr} style={{ width: `${qrSmall}px`, height: `${qrSmall}px` }} />
                </div>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
                <span style={{ color: teal, fontSize: '32px', fontWeight: 900, display: 'flex', flexWrap: 'wrap' }}>
                  VOCÊ VIU? ESCANEIE
                </span>
                <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: '24px', lineHeight: 1.4, display: 'flex', flexWrap: 'wrap' }}>
                  Avise o dono — ele recebe um alerta imediato
                </span>
                <span style={{ color: teal, fontSize: '20px', display: 'flex' }}>
                  backfindr.com
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
    return new Response('Erro ao gerar pôster', { status: 500 });
  }
}
