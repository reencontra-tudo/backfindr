'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ShieldCheck } from 'lucide-react';

interface MapObject {
  id: string;
  title: string;
  status: string;
  lat: number;
  lng: number;
}

// Cores por status
const STATUS_COLOR: Record<string, string> = {
  lost: '#ef4444',
  found: '#22c55e',
  stolen: '#f97316',
  recovered: '#14b8a6',
};

export default function HomeLiveMap() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const [city, setCity] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(false);

  // 1. Detectar cidade por IP (sem pedir permissão ao usuário)
  useEffect(() => {
    fetch('https://ipapi.co/json/')
      .then(r => r.json())
      .then(d => {
        if (d?.city) setCity(d.city);
      })
      .catch(() => {
        // fallback silencioso — CTA genérico
      });
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

        const objects: MapObject[] = (data?.objects ?? [])
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

        // Centro no centroide dos objetos ou São Paulo como fallback
        const avgLat = objects.reduce((s, o) => s + o.lat, 0) / objects.length;
        const avgLng = objects.reduce((s, o) => s + o.lng, 0) / objects.length;

        const map = new mbgl.Map({
          container: containerRef.current!,
          style: 'mapbox://styles/mapbox/dark-v11',
          center: [avgLng, avgLat],
          zoom: 10,
          interactive: false, // mapa decorativo — sem drag/zoom
          attributionControl: false,
        });

        mapRef.current = map;

        map.on('load', () => {
          if (cancelled) return;

          // Adicionar pins
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
  }, []);

  const ctaText = city
    ? `Isso acontece em ${city} — quero me proteger`
    : 'Quero me proteger também';

  return (
    <div className="relative overflow-hidden rounded-3xl border border-white/[0.08] bg-white/[0.03]" style={{ height: 340 }}>
      {/* Badge "mapa público" */}
      <div className="absolute left-4 top-4 z-10 rounded-full border border-teal-500/20 bg-[#08111f]/88 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-teal-300 backdrop-blur-sm">
        mapa público
      </div>

      {/* Container do mapa */}
      {!error ? (
        <div ref={containerRef} className="absolute inset-0 w-full h-full" />
      ) : (
        // Fallback: imagem estática se Mapbox falhar
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

      {/* CTA flutuante com cidade dinâmica */}
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
    </div>
  );
}
