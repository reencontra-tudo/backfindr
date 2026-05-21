'use client';

import { MapPin } from 'lucide-react';

interface LocationMapProps {
  lat: number;
  lng: number;
  title?: string;
  address?: string;
}

export default function LocationMap({ lat, lng, title, address }: LocationMapProps) {
  const zoom = 15;
  const mapUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${lng - 0.005},${lat - 0.003},${lng + 0.005},${lat + 0.003}&layer=mapnik&marker=${lat},${lng}`;
  const linkUrl = `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=${zoom}/${lat}/${lng}`;

  return (
    <div className="rounded-xl overflow-hidden border border-white/10 bg-slate-900">
      <div className="relative w-full" style={{ height: '220px' }}>
        <iframe
          src={mapUrl}
          width="100%"
          height="100%"
          style={{ border: 'none', display: 'block' }}
          loading="lazy"
          title={title || 'Localização do objeto'}
          allowFullScreen
        />
      </div>
      {address && (
        <div className="flex items-start gap-2 px-3 py-2 bg-slate-800/60">
          <MapPin className="w-4 h-4 text-teal-400 mt-0.5 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-slate-300 truncate">{address}</p>
            <a
              href={linkUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-teal-400 hover:underline"
            >
              Ver no OpenStreetMap
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
