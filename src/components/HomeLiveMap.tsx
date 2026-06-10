'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ShieldCheck, X, MapPin } from 'lucide-react';

interface MapObject {
  id: string;
  title: string;
  status: string;
  lat: number;
  lng: number;
}

const STATUS_COLOR: Record<string, string> = {
  lost: '#ef4444',
  found: '#22c55e',
  stolen: '#f97316',
  recovered: '#14b8a6',
};

// Haversine distance em km
function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Threshold: mínimo de objetos num raio de 30km para considerar região densa
const DENSITY_THRESHOLD = 15;
const DENSITY_RADIUS_KM = 30;

export default function HomeLiveMap() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const [city, setCity] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(false);
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [nearbyCount, setNearbyCount] = useState(0);
  const [isDense, setIsDense] = useState(false);
  const [showPopup, setShowPopup] = useState(false);

  // 1. Detectar coords — GPS como fonte primária, IP como fallback
  useEffect(() => {
    let cancelled = false;

    const fetchFromIP = () => {
      fetch('https://ipapi.co/json/')
        .then(r => r.json())
        .then(d => {
          if (cancelled) return;
          if (d?.city) setCity(d.city);
          if (d?.latitude && d?.longitude) {
            setUserCoords({ lat: d.latitude, lng: d.longitude });
          }
        })
        .catch(() => {});
    };

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        pos => {
          if (cancelled) return;
          setUserCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
          // Busca cidade via IP só para o nome (não para coords)
          fetch('https://ipapi.co/json/')
            .then(r => r.json())
            .then(d => { if (!cancelled && d?.city) setCity(d.city); })
            .catch(() => {});
        },
        () => {
          // GPS negado ou indisponível — usa IP
          if (!cancelled) fetchFromIP();
        },
        { timeout: 5000, maximumAge: 60000 }
      );
    } else {
      fetchFromIP();
    }

    return () => { cancelled = true; };
  }, []);

  // 2. Inicializar mapa Mapbox com pins reais
  useEffect(() => {
    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    if (!token || !containerRef.current) return;

    let cancelled = false;

    Promise.all([
      import('mapbox-gl'),
      fetch('/api/v1/objects/public?limit=80&status=all').then(r => r.json()),
    ])
      .then(([mapboxgl, data]) => {
        if (cancelled || !containerRef.current) return;

        const mbgl = (mapboxgl as any).default ?? mapboxgl;
        mbgl.accessToken = token;

        const objects: MapObject[] = (data?.items ?? [])
          .filter((o: any) => o.location?.lat && o.location?.lng)
          .map((o: any) => ({
            id: o.id,
            title: o.title,
            status: o.status,
            lat: o.location.lat,
            lng: o.location.lng,
          }));

        if (objects.length === 0) {
          setError(true);
          return;
        }

        // Calcular densidade na região do usuário (via IP coords)
        if (userCoords) {
          const count = objects.filter(o =>
            haversine(userCoords.lat, userCoords.lng, o.lat, o.lng) <= DENSITY_RADIUS_KM
          ).length;
          setNearbyCount(count);
          setIsDense(count >= DENSITY_THRESHOLD);
        }

        const avgLat = objects.reduce((s, o) => s + o.lat, 0) / objects.length;
        const avgLng = objects.reduce((s, o) => s + o.lng, 0) / objects.length;

        const map = new mbgl.Map({
          container: containerRef.current!,
          style: 'mapbox://styles/mapbox/dark-v11',
          center: [avgLng, avgLat],
          zoom: 10,
          interactive: false,
          attributionControl: false,
        });

        mapRef.current = map;

        map.on('load', () => {
          if (cancelled) return;

          objects.forEach(obj => {
            const el = document.createElement('div');
            el.style.cssText = `
              width: 10px;
              height: 10px;
              border-radius: 50%;
              background: ${STATUS_COLOR[obj.status] ?? '#14b8a6'};
              border: 2px solid rgba(255,255,255,0.3);
              box-shadow: 0 0 6px ${STATUS_COLOR[obj.status] ?? '#14b8a6'}88;
            `;
            new mbgl.Marker({ element: el })
              .setLngLat([obj.lng, obj.lat])
              .addTo(map);
          });

          setReady(true);

          // Popup aparece 3s após o mapa carregar
          setTimeout(() => setShowPopup(true), 3000);
        });

        map.on('error', () => setError(true));
      })
      .catch(() => setError(true));

    return () => {
      cancelled = true;
      if (mapRef.current) {
        try { mapRef.current.remove(); } catch (_) {}
        mapRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userCoords]);

  // Mensagem do popup baseada na densidade
  const popupMessage = isDense
    ? `Há ${nearbyCount} objeto${nearbyCount !== 1 ? 's' : ''} registrado${nearbyCount !== 1 ? 's' : ''} perto de você. Cada novo cadastro aumenta suas chances de recuperar o que perdeu.`
    : `Sua região ainda está crescendo. Seja o primeiro a registrar — quando alguém achar seu objeto, o Backfindr já estará aqui.`;

  const popupTitle = isDense
    ? `${nearbyCount} objetos na sua região`
    : 'Seja o primeiro na sua região';

  const ctaText = city
    ? `Isso acontece em ${city} — quero me proteger`
    : 'Quero me proteger também';

  return (
    <div className="relative overflow-hidden rounded-3xl border border-white/[0.08] bg-white/[0.03]" style={{ height: 340 }}>
      {/* Badge */}
      <div className="absolute left-4 top-4 z-10 rounded-full border border-teal-500/20 bg-[#08111f]/88 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-teal-300 backdrop-blur-sm">
        mapa público
      </div>

      {/* Container do mapa */}
      {!error ? (
        <div ref={containerRef} className="absolute inset-0 w-full h-full" />
      ) : (
        <img
          src="/branding/banner-brand.jpeg"
          alt="Mapa de ocorrências ao vivo"
          className="absolute inset-0 w-full h-full object-cover"
        />
      )}

      {/* Gradiente inferior */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#07090e] via-[#07090e]/20 to-transparent" />

      {/* Indicador de carregamento */}
      {!ready && !error && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="h-6 w-6 rounded-full border-2 border-teal-500/30 border-t-teal-400 animate-spin" />
        </div>
      )}

      {/* Popup de engajamento */}
      {showPopup && ready && (
        <div
          className="absolute left-4 right-4 z-20 rounded-2xl border border-white/[0.12] bg-[#08111f]/95 backdrop-blur-md p-4 shadow-2xl"
          style={{
            top: '50%',
            transform: 'translateY(-50%)',
            animation: 'fadeInScale 0.3s ease',
          }}
        >
          <style>{`
            @keyframes fadeInScale {
              from { opacity: 0; transform: translateY(-50%) scale(0.95); }
              to   { opacity: 1; transform: translateY(-50%) scale(1); }
            }
          `}</style>

          {/* Botão fechar */}
          <button
            onClick={() => setShowPopup(false)}
            className="absolute right-3 top-3 text-white/30 hover:text-white transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>

          {/* Ícone + título */}
          <div className="flex items-center gap-2 mb-2 pr-5">
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${
              isDense ? 'bg-teal-500/15' : 'bg-blue-500/15'
            }`}>
              <MapPin className={`w-3.5 h-3.5 ${isDense ? 'text-teal-400' : 'text-blue-400'}`} />
            </div>
            <p className="text-white text-sm font-bold leading-tight">{popupTitle}</p>
          </div>

          <p className="text-white/55 text-xs leading-relaxed mb-3">
            {popupMessage}
          </p>

          <div className="flex gap-2">
            <Link
              href="/auth/register"
              className={`flex-1 text-center py-2 rounded-xl text-xs font-bold text-white transition-all ${
                isDense
                  ? 'bg-teal-500 hover:bg-teal-400'
                  : 'bg-blue-500 hover:bg-blue-400'
              }`}
            >
              {isDense ? 'Cadastrar objeto' : 'Ser o primeiro'}
            </Link>
            <button
              onClick={() => setShowPopup(false)}
              className="px-3 py-2 rounded-xl text-xs text-white/40 hover:text-white/70 border border-white/[0.08] transition-colors"
            >
              Fechar
            </button>
          </div>
        </div>
      )}

      {/* CTA flutuante — só aparece quando popup está fechado */}
      {!showPopup && (
        <div className="absolute bottom-5 left-0 right-0 flex justify-center px-5 z-10">
          <Link
            href="/auth/register?intent=protect"
            className="inline-flex items-center gap-2 rounded-2xl bg-teal-500/90 backdrop-blur-sm px-6 py-3 text-sm font-bold text-white transition-all hover:bg-teal-400"
            style={{ boxShadow: '0 8px 32px rgba(20,184,166,0.35)' }}
          >
            <ShieldCheck className="h-4 w-4 flex-shrink-0" />
            <span className="line-clamp-1">{ctaText}</span>
          </Link>
        </div>
      )}
    </div>
  );
}
