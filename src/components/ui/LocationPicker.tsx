'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { MapPin, Search, X, Loader2, Navigation } from 'lucide-react';

interface Suggestion {
  id: string;
  place_name: string;
  center: [number, number]; // [lng, lat]
}

interface LocationPickerProps {
  value: { address: string; lat?: number; lng?: number };
  onChange: (val: { address: string; lat: number; lng: number }) => void;
  placeholder?: string;
}

export function LocationPicker({ value, onChange, placeholder }: LocationPickerProps) {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<unknown>(null);
  const markerRef = useRef<unknown>(null);

  const [query, setQuery] = useState(value.address ?? '');
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Geocodificar endereço pré-preenchido (prefill_location) ────────────────
  // Quando o componente recebe um endereço sem coordenadas (vindo dos flows),
  // geocodifica automaticamente para obter lat/lng e posicionar o pin no mapa.
  useEffect(() => {
    if (!token || !value.address || value.lat || value.lng) return;
    const q = value.address;
    fetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(q)}.json?access_token=${token}&language=pt&limit=1&country=br`
    )
      .then((r) => r.json())
      .then((data) => {
        const feature = data.features?.[0];
        if (!feature) return;
        const [lng, lat] = feature.center as [number, number];
        onChange({ address: feature.place_name ?? q, lat, lng });
        setQuery(feature.place_name ?? q);
      })
      .catch(() => {/* silencioso — endereço fica como texto */});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Inicializar mapa ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!token || !mapContainer.current || mapRef.current) return;

    import('mapbox-gl').then((mapboxgl) => {
      mapboxgl.default.accessToken = token;

      const initialLng = value.lng ?? -46.6333;
      const initialLat = value.lat ?? -23.5505;
      const hasCoords  = !!(value.lat && value.lng);

      const map = new mapboxgl.default.Map({
        container: mapContainer.current!,
        style: 'mapbox://styles/mapbox/dark-v11',
        center: [initialLng, initialLat],
        zoom: hasCoords ? 14 : 11,
        attributionControl: false,
      });

      map.addControl(new mapboxgl.default.NavigationControl({ showCompass: false }), 'bottom-right');

      map.on('load', () => {
        setMapReady(true);

        // Se já tem coordenadas, colocar marcador
        if (hasCoords) {
          const el = createMarkerEl();
          const marker = new mapboxgl.default.Marker({ element: el, anchor: 'bottom' })
            .setLngLat([initialLng, initialLat])
            .addTo(map);
          markerRef.current = marker;
        }
      });

      // Clique no mapa → atualizar pin e reverter geocodificação
      map.on('click', async (e) => {
        const { lng, lat } = e.lngLat;
        updateMarker(map, mapboxgl, lng, lat);

        // Reverse geocoding
        if (token) {
          try {
            const res = await fetch(
              `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${token}&language=pt&limit=1`
            );
            const data = await res.json();
            const placeName = data.features?.[0]?.place_name ?? `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
            setQuery(placeName);
            onChange({ address: placeName, lat, lng });
          } catch {
            onChange({ address: `${lat.toFixed(5)}, ${lng.toFixed(5)}`, lat, lng });
          }
        }
      });

      mapRef.current = map;
    });

    return () => {
      if (mapRef.current) {
        (mapRef.current as { remove: () => void }).remove();
        mapRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // ── Mover pin quando coordenadas mudarem externamente (ex: geocodificação do prefill) ──
  useEffect(() => {
    if (!mapReady || !value.lat || !value.lng || !mapRef.current) return;
    import('mapbox-gl').then((mapboxgl) => {
      updateMarker(mapRef.current, mapboxgl, value.lng!, value.lat!);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value.lat, value.lng, mapReady]);

  // ── Criar elemento do marcador ──────────────────────────────────────────────
  function createMarkerEl() {
    const el = document.createElement('div');
    el.style.cssText = `
      width: 32px; height: 32px;
      background: #14b8a6;
      border: 3px solid white;
      border-radius: 50% 50% 50% 0;
      transform: rotate(-45deg);
      box-shadow: 0 2px 8px rgba(0,0,0,0.4);
      cursor: pointer;
    `;
    return el;
  }

  // ── Atualizar marcador no mapa ──────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function updateMarker(map: any, mapboxgl: any, lng: number, lat: number) {
    if (markerRef.current) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (markerRef.current as any).setLngLat([lng, lat]);
    } else {
      const el = createMarkerEl();
      const marker = new mapboxgl.default.Marker({ element: el, anchor: 'bottom' })
        .setLngLat([lng, lat])
        .addTo(map);
      markerRef.current = marker;
    }
    map.easeTo({ center: [lng, lat], zoom: 15, duration: 500 });
  }

  // ── Autocomplete ────────────────────────────────────────────────────────────
  const fetchSuggestions = useCallback(async (q: string) => {
    if (!token || q.length < 3) { setSuggestions([]); return; }
    setLoading(true);
    try {
      const res = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(q)}.json?access_token=${token}&language=pt&limit=5&country=br`
      );
      const data = await res.json();
      setSuggestions(data.features ?? []);
    } catch {
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  }, [token]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const q = e.target.value;
    setQuery(q);
    setShowSuggestions(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchSuggestions(q), 350);
  };

  const handleSelectSuggestion = (s: Suggestion) => {
    const [lng, lat] = s.center;
    setQuery(s.place_name);
    setSuggestions([]);
    setShowSuggestions(false);
    onChange({ address: s.place_name, lat, lng });
  };

  const handleClear = () => {
    setQuery('');
    setSuggestions([]);
    setShowSuggestions(false);
  };

  // ── Usar localização atual ──────────────────────────────────────────────────
  const handleGeolocate = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(async (pos) => {
      const { latitude: lat, longitude: lng } = pos.coords;

      if (token) {
        try {
          const res = await fetch(
            `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${token}&language=pt&limit=1`
          );
          const data = await res.json();
          const placeName = data.features?.[0]?.place_name ?? `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
          setQuery(placeName);
          onChange({ address: placeName, lat, lng });
        } catch {
          onChange({ address: `${lat.toFixed(5)}, ${lng.toFixed(5)}`, lat, lng });
        }
      }
    });
  };

  // ── Sem token configurado ───────────────────────────────────────────────────
  if (!token) {
    return (
      <div className="space-y-3">
        <div className="relative">
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              onChange({ address: e.target.value, lat: value.lat ?? 0, lng: value.lng ?? 0 });
            }}
            placeholder={placeholder ?? 'Ex: Metrô Paulista, Av. Paulista, São Paulo'}
            className="w-full bg-surface border border-surface-border rounded-xl px-4 py-3 text-slate-100 placeholder-slate-500 text-sm outline-none focus:border-brand-500 transition-colors"
          />
        </div>
        <p className="text-xs text-yellow-500/70">Configure NEXT_PUBLIC_MAPBOX_TOKEN para ativar o mapa interativo.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Campo de busca com autocomplete */}
      <div className="relative">
        <div className="relative flex items-center">
          <Search className="absolute left-3.5 w-4 h-4 text-slate-500 pointer-events-none" />
          <input
            value={query}
            onChange={handleInputChange}
            onFocus={() => query.length >= 3 && setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
            placeholder={placeholder ?? 'Buscar endereço, bairro ou referência...'}
            className="w-full bg-surface border border-surface-border rounded-xl pl-10 pr-20 py-3 text-slate-100 placeholder-slate-500 text-sm outline-none focus:border-brand-500 transition-colors"
          />
          <div className="absolute right-2 flex items-center gap-1">
            {loading && <Loader2 className="w-3.5 h-3.5 text-slate-500 animate-spin" />}
            {query && (
              <button type="button" onClick={handleClear} className="p-1 text-slate-500 hover:text-white transition-colors">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              type="button"
              onClick={handleGeolocate}
              title="Usar minha localização atual"
              className="p-1.5 text-slate-500 hover:text-brand-400 transition-colors"
            >
              <Navigation className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Dropdown de sugestões */}
        {showSuggestions && suggestions.length > 0 && (
          <div className="absolute z-50 w-full mt-1 bg-[#1a1f2e] border border-white/[0.08] rounded-xl shadow-2xl overflow-hidden">
            {suggestions.map((s) => (
              <button
                key={s.id}
                type="button"
                onMouseDown={() => handleSelectSuggestion(s)}
                className="w-full flex items-start gap-3 px-4 py-3 hover:bg-white/[0.05] transition-colors text-left"
              >
                <MapPin className="w-4 h-4 text-brand-400 flex-shrink-0 mt-0.5" />
                <span className="text-slate-200 text-sm leading-snug">{s.place_name}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Mini-mapa interativo */}
      <div className="relative w-full h-52 rounded-xl overflow-hidden border border-surface-border">
        <div ref={mapContainer} className="w-full h-full" />
        {!mapReady && (
          <div className="absolute inset-0 flex items-center justify-center bg-surface-card">
            <Loader2 className="w-6 h-6 text-brand-400 animate-spin" />
          </div>
        )}
        {mapReady && !value.lat && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-black/70 text-white/60 text-xs px-3 py-1.5 rounded-full pointer-events-none whitespace-nowrap">
            Clique no mapa ou busque um endereço para marcar o local
          </div>
        )}
      </div>

      {/* Coordenadas confirmadas */}
      {value.lat && value.lng && (
        <div className="flex items-center gap-2 text-xs text-brand-400/70">
          <MapPin className="w-3 h-3" />
          <span>
            {value.lat.toFixed(5)}, {value.lng.toFixed(5)}
          </span>
        </div>
      )}
    </div>
  );
}
