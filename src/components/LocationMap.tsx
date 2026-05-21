'use client';

import { MapPin } from 'lucide-react';

interface LocationMapProps {
  lat: number;
  lng: number;
  title?: string;
  address?: string;
}

export default function LocationMap({ lat, lng, title, address }: LocationMapProps) {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

  if (!token) {
    return (
      <div className="rounded-xl overflow-hidden border border-white/10 bg-slate-900 h-48 flex flex-col items-center justify-center gap-2 text-slate-500">
        <MapPin className="w-8 h-8" />
        <p className="text-sm">Mapa indisponível</p>
      </div>
    );
  }

  // Mapbox Static Images API — marcador teal embutido na URL, sem JS
  // pin-l = pin grande, +14b8a6 = cor teal, (lng,lat) = posição
  const marker = `pin-l+14b8a6(${lng},${lat})`;
  const staticUrl = `https://api.mapbox.com/styles/v1/mapbox/dark-v11/static/${marker}/${lng},${lat},14,0/680x220@2x?access_token=${token}&attribution=false&logo=false`;

  return (
    <div className="rounded-xl overflow-hidden border border-white/10 bg-slate-900">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={staticUrl}
        alt={title ? `Mapa — ${title}` : 'Localização do objeto'}
        width={680}
        height={220}
        className="w-full object-cover"
        style={{ height: '220px' }}
      />
      {address && (
        <div className="flex items-start gap-2 px-3 py-2 bg-slate-800/60">
          <MapPin className="w-4 h-4 text-teal-400 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-slate-300 truncate">{address}</p>
        </div>
      )}
    </div>
  );
}
