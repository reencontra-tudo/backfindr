'use client';

import { useEffect, useRef } from 'react';
import { MapPin } from 'lucide-react';

interface LocationMapProps {
  lat: number;
  lng: number;
  title?: string;
  address?: string;
}

export default function LocationMap({ lat, lng, title, address }: LocationMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<unknown>(null);
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

  useEffect(() => {
    if (!token || !mapContainer.current || mapRef.current) return;

    import('mapbox-gl').then((mapboxgl) => {
      mapboxgl.default.accessToken = token;

      const map = new mapboxgl.default.Map({
        container: mapContainer.current!,
        style: 'mapbox://styles/mapbox/dark-v11',
        center: [lng, lat],
        zoom: 14,
        attributionControl: false,
        interactive: false,
      });

      // Marcador personalizado
      const el = document.createElement('div');
      el.style.cssText = `
        width: 32px; height: 32px;
        background: #14b8a6;
        border: 3px solid white;
        border-radius: 50% 50% 50% 0;
        transform: rotate(-45deg);
        box-shadow: 0 2px 8px rgba(0,0,0,0.4);
      `;

      new mapboxgl.default.Marker({ element: el, anchor: 'bottom' })
        .setLngLat([lng, lat])
        .addTo(map);

      mapRef.current = map;
    });

    return () => {
      if (mapRef.current) {
        (mapRef.current as { remove: () => void }).remove();
        mapRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lat, lng, token]);

  if (!token) {
    return (
      <div className="rounded-xl overflow-hidden border border-white/10 bg-slate-900 h-48 flex flex-col items-center justify-center gap-2 text-slate-500">
        <MapPin className="w-8 h-8" />
        <p className="text-sm">Mapa indisponível</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl overflow-hidden border border-white/10 bg-slate-900">
      <div ref={mapContainer} style={{ width: '100%', height: '220px' }} />
      {address && (
        <div className="flex items-start gap-2 px-3 py-2 bg-slate-800/60">
          <MapPin className="w-4 h-4 text-teal-400 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-slate-300 truncate">{address}</p>
        </div>
      )}
    </div>
  );
}
