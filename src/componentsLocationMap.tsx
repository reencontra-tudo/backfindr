'use client';

import { useEffect, useRef, useState } from 'react';
import { MapPin, Loader2 } from 'lucide-react';

interface LocationMapProps {
  lat: number;
  lng: number;
  title?: string;
  address?: string;
}

export default function LocationMap({ lat, lng, title, address }: LocationMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!mapContainer.current || mapLoaded) return;

    // Tentar carregar Mapbox se token disponível
    const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

    if (mapboxToken) {
      loadMapbox();
    } else {
      loadOpenStreetMap();
    }
  }, [mapLoaded]);

  const loadMapbox = async () => {
    try {
      // Carregar scripts do Mapbox
      const link = document.createElement('link');
      link.href = 'https://api.mapbox.com/mapbox-gl-js/v2.15.0/mapbox-gl.css';
      document.head.appendChild(link);

      const script = document.createElement('script');
      script.src = 'https://api.mapbox.com/mapbox-gl-js/v2.15.0/mapbox-gl.js';
      script.async = true;
      script.onload = () => {
        if (window.mapboxgl && mapContainer.current) {
          window.mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!;
          const map = new window.mapboxgl.Map({
            container: mapContainer.current,
            style: 'mapbox://styles/mapbox/dark-v11',
            center: [lng, lat],
            zoom: 15,
            pitch: 0,
            bearing: 0,
          });

          new window.mapboxgl.Marker({ color: '#14b8a6' })
            .setLngLat([lng, lat])
            .setPopup(
              new window.mapboxgl.Popup({ offset: 25 }).setHTML(
                `<div class="text-sm font-semibold text-slate-900">${title || 'Localização'}</div>`
              )
            )
            .addTo(map);

          map.on('load', () => setMapLoaded(true));
        }
      };
      script.onerror = () => {
        loadOpenStreetMap();
      };
      document.head.appendChild(script);
    } catch (err) {
      console.error('Erro ao carregar Mapbox:', err);
      loadOpenStreetMap();
    }
  };

  const loadOpenStreetMap = async () => {
    try {
      // Carregar Leaflet
      const link = document.createElement('link');
      link.href = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css';
      document.head.appendChild(link);

      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js';
      script.async = true;
      script.onload = () => {
        if (window.L && mapContainer.current) {
          const map = window.L.map(mapContainer.current).setView([lat, lng], 15);

          window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors',
            maxZoom: 19,
          }).addTo(map);

          const marker = window.L.marker([lat, lng], {
            icon: window.L.icon({
              iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
              shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
              iconSize: [25, 41],
              iconAnchor: [12, 41],
              popupAnchor: [1, -34],
              shadowSize: [41, 41],
            }),
          }).addTo(map);

          marker.bindPopup(`<div class="text-sm font-semibold">${title || 'Localização'}</div>`);

          setMapLoaded(true);
        }
      };
      script.onerror = () => {
        setError('Não foi possível carregar o mapa');
        setMapLoaded(true);
      };
      document.head.appendChild(script);
    } catch (err) {
      console.error('Erro ao carregar OpenStreetMap:', err);
      setError('Erro ao carregar o mapa');
      setMapLoaded(true);
    }
  };

  if (error) {
    return (
      <div className="glass rounded-2xl overflow-hidden">
        <div className="h-64 bg-surface-card flex flex-col items-center justify-center text-slate-500 gap-3 p-4">
          <MapPin className="w-8 h-8 text-slate-600" />
          <div className="text-center">
            <p className="text-sm font-medium text-slate-400">{error}</p>
            <p className="text-xs text-slate-600 mt-1">
              Latitude: {lat.toFixed(4)}, Longitude: {lng.toFixed(4)}
            </p>
            {address && <p className="text-xs text-slate-600 mt-2">{address}</p>}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="glass rounded-2xl overflow-hidden">
      {!mapLoaded && (
        <div className="h-64 bg-surface-card flex flex-col items-center justify-center text-slate-500 gap-3">
          <Loader2 className="w-8 h-8 animate-spin" />
          <p className="text-sm">Carregando mapa...</p>
        </div>
      )}
      <div
        ref={mapContainer}
        className="h-64 w-full bg-surface-card"
        style={{ display: mapLoaded ? 'block' : 'none' }}
      />
    </div>
  );
}

// Extend window type for Mapbox and Leaflet
declare global {
  interface Window {
    mapboxgl?: any;
    L?: any;
  }
}
