'use client';
import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { MapPin, Search, X, ChevronRight, SlidersHorizontal, LocateFixed, Gift } from 'lucide-react';
import { toast } from 'sonner';
import { objectsApi, parseApiError } from '@/lib/api';
import { RegisteredObject } from '@/types';

const EMOJI: Record<string, string> = {
  phone: '📱', wallet: '👛', keys: '🔑', bag: '🎒', pet: '🐾',
  bike: '🚲', document: '📄', jewelry: '💍', electronics: '💻',
  clothing: '👕', other: '📦',
};
const CATEGORY_LABEL: Record<string, string> = {
  phone: 'Celular', wallet: 'Carteira', keys: 'Chaves', bag: 'Bolsa/Mochila',
  pet: 'Pet', bike: 'Bicicleta', document: 'Documento', jewelry: 'Joia',
  electronics: 'Eletrônico', clothing: 'Roupa', other: 'Outro',
};
const STATUS_LABEL: Record<string, string> = {
  lost: 'Perdido', found: 'Achado', returned: 'Recuperado', stolen: 'Roubado',
};
const STATUS_COLOR: Record<string, string> = {
  lost: 'text-red-400 bg-red-500/10 border-red-500/20',
  found: 'text-teal-400 bg-teal-500/10 border-teal-500/20',
  returned: 'text-green-400 bg-green-500/10 border-green-500/20',
  stolen: 'text-orange-400 bg-orange-500/10 border-orange-500/20',
};

// Haversine distance in km
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

// Debounce hook — evita recalcular filtros a cada keystroke
function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

interface Filters {
  search: string;
  status: string;
  category: string;
  radiusKm: number;
  daysAgo: number;
}

// Número máximo de itens visíveis na lista lateral (virtualização simples)
const LIST_PAGE_SIZE = 40;

export default function MapPage() {
  const [objects, setObjects] = useState<RegisteredObject[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<Filters>({
    search: '', status: '', category: '', radiusKm: 0, daysAgo: 0,
  });
  const [showFilters, setShowFilters] = useState(false);
  const [showList, setShowList] = useState(false);
  const [selected, setSelected] = useState<RegisteredObject | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [listPage, setListPage] = useState(1);

  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<unknown>(null);

  // ─── Debounce da busca textual (300ms) ────────────────────────────────────
  const debouncedSearch = useDebounce(filters.search, 300);

  // ─── Carregar objetos (uma única vez) ─────────────────────────────────────
  useEffect(() => {
    objectsApi.listPublic({ size: 500 })
      .then(({ data }) => setObjects(data?.items ?? []))
      .catch(e => toast.error(parseApiError(e)))
      .finally(() => setLoading(false));
  }, []);

  // ─── Inicializar mapa (lazy import) ───────────────────────────────────────
  useEffect(() => {
    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    if (!token || !mapContainer.current || mapRef.current) return;

    import('mapbox-gl').then(mapboxgl => {
      mapboxgl.default.accessToken = token;
      const map = new mapboxgl.default.Map({
        container: mapContainer.current!,
        style: 'mapbox://styles/mapbox/dark-v11',
        center: [-46.6333, -23.5505],
        zoom: 11,
        // Otimizações de performance
        antialias: false,
        fadeDuration: 0,
        trackResize: true,
      });

      map.on('load', () => {
        map.addSource('objects', {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: [] },
          cluster: true,
          clusterMaxZoom: 14,
          clusterRadius: 50,
          // Buffer reduzido para menos cálculos fora do viewport
          buffer: 64,
          tolerance: 0.5,
        });

        map.addLayer({
          id: 'clusters',
          type: 'circle',
          source: 'objects',
          filter: ['has', 'point_count'],
          paint: {
            'circle-color': '#14b8a6',
            'circle-radius': ['step', ['get', 'point_count'], 20, 10, 30, 50, 40],
            'circle-opacity': 0.85,
          },
        });

        map.addLayer({
          id: 'cluster-count',
          type: 'symbol',
          source: 'objects',
          filter: ['has', 'point_count'],
          layout: { 'text-field': '{point_count_abbreviated}', 'text-size': 12 },
          paint: { 'text-color': '#0f172a' },
        });

        map.addLayer({
          id: 'unclustered-point',
          type: 'circle',
          source: 'objects',
          filter: ['!', ['has', 'point_count']],
          paint: {
            'circle-color': ['match', ['get', 'status'],
              'lost', '#ef4444', 'found', '#14b8a6',
              'returned', '#22c55e', '#f97316'],
            'circle-radius': 8,
            'circle-stroke-width': 2,
            'circle-stroke-color': '#080b0f',
          },
        });

        // Expandir cluster ao clicar
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        map.on('click', 'clusters', (e: any) => {
          const features = map.queryRenderedFeatures(e.point, { layers: ['clusters'] });
          if (!features.length) return;
          const clusterId = features[0].properties?.cluster_id;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (map.getSource('objects') as any).getClusterExpansionZoom(clusterId, (err: unknown, zoom: number) => {
            if (err) return;
            map.easeTo({ center: (features[0].geometry as GeoJSON.Point).coordinates as [number, number], zoom });
          });
        });

        // Abrir popup ao clicar em ponto individual
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        map.on('click', 'unclustered-point', (e: any) => {
          const id = e.features?.[0]?.properties?.id;
          if (id) {
            setObjects(prev => {
              const obj = prev.find(o => o.id === id);
              if (obj) setSelected(obj);
              return prev;
            });
          }
        });

        map.on('mouseenter', 'clusters', () => { (map as any).getCanvas().style.cursor = 'pointer'; });
        map.on('mouseleave', 'clusters', () => { (map as any).getCanvas().style.cursor = ''; });
        map.on('mouseenter', 'unclustered-point', () => { (map as any).getCanvas().style.cursor = 'pointer'; });
        map.on('mouseleave', 'unclustered-point', () => { (map as any).getCanvas().style.cursor = ''; });

        setMapLoaded(true);
      });

      mapRef.current = map;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Filtrar objetos com useMemo + debounce na busca ──────────────────────
  const filtered = useMemo(() => {
    const searchLower = debouncedSearch.toLowerCase();
    return objects.filter(o => {
      if (searchLower &&
        !o.title.toLowerCase().includes(searchLower) &&
        !o.description?.toLowerCase().includes(searchLower)) return false;
      if (filters.status && o.status !== filters.status) return false;
      if (filters.category && o.category !== filters.category) return false;
      if (filters.daysAgo > 0 && o.created_at) {
        const cutoff = Date.now() - filters.daysAgo * 24 * 60 * 60 * 1000;
        if (new Date(o.created_at).getTime() < cutoff) return false;
      }
      if (filters.radiusKm > 0 && userLocation && o.location?.lat && o.location?.lng) {
        const dist = haversine(userLocation.lat, userLocation.lng, o.location.lat, o.location.lng);
        if (dist > filters.radiusKm) return false;
      }
      return true;
    });
  }, [objects, debouncedSearch, filters.status, filters.category, filters.daysAgo, filters.radiusKm, userLocation]);

  // ─── Atualizar pontos no mapa (throttled via requestAnimationFrame) ────────
  const rafRef = useRef<number | null>(null);
  useEffect(() => {
    if (!mapLoaded) return;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      const map = mapRef.current as { getSource?: (id: string) => { setData?: (d: unknown) => void } | undefined } | null;
      if (!map?.getSource) return;
      const source = map.getSource('objects');
      if (!source?.setData) return;
      const features = filtered
        .filter(o => o.location?.lat && o.location?.lng)
        .map(o => ({
          type: 'Feature' as const,
          geometry: { type: 'Point' as const, coordinates: [o.location!.lng, o.location!.lat] },
          properties: { id: o.id, title: o.title, status: o.status },
        }));
      source.setData({ type: 'FeatureCollection', features });
    });
  }, [filtered, mapLoaded]);

  // ─── Geolocalização ───────────────────────────────────────────────────────
  const locateUser = useCallback(() => {
    if (!navigator.geolocation) {
      toast.error('Geolocalização não suportada neste browser');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      pos => {
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setUserLocation(loc);
        const map = mapRef.current as { flyTo?: (opts: unknown) => void } | null;
        map?.flyTo?.({ center: [loc.lng, loc.lat], zoom: 13, duration: 1500 });
        toast.success('Localização obtida!');
      },
      () => toast.error('Não foi possível obter sua localização'),
    );
  }, []);

  // ─── Resetar página da lista ao mudar filtros ─────────────────────────────
  useEffect(() => { setListPage(1); }, [filtered]);

  const hasActiveFilters = filters.status || filters.category || filters.radiusKm > 0 || filters.daysAgo > 0;
  const clearFilters = () => setFilters({ search: '', status: '', category: '', radiusKm: 0, daysAgo: 0 });

  // Lista paginada (virtualização simples)
  const listItems = useMemo(() => filtered.slice(0, listPage * LIST_PAGE_SIZE), [filtered, listPage]);

  return (
    <div className="h-screen flex flex-col bg-[#080b0f]">
      {/* Navbar */}
      <nav className="flex items-center gap-3 px-4 h-14 border-b border-white/[0.06] bg-[#080b0f]/90 backdrop-blur-xl flex-shrink-0 z-20">
        <Link href="/" className="flex items-center gap-2 flex-shrink-0">
          <div className="w-7 h-7 rounded-lg bg-teal-500 flex items-center justify-center">
            <MapPin className="w-3.5 h-3.5 text-white" strokeWidth={2.5} />
          </div>
          <span className="font-semibold text-white text-[15px] hidden sm:block">Backfindr</span>
        </Link>

        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" />
          <input
            value={filters.search}
            onChange={e => setFilters(f => ({ ...f, search: e.target.value }))}
            placeholder="Buscar objetos..."
            className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg pl-9 pr-3 py-2 text-white placeholder-white/20 text-sm outline-none focus:border-teal-500/50 transition-colors"
          />
          {filters.search && (
            <button onClick={() => setFilters(f => ({ ...f, search: '' }))} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Filtros avançados toggle */}
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`relative flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all flex-shrink-0 ${
            showFilters || hasActiveFilters
              ? 'bg-teal-500/10 text-teal-400 border border-teal-500/20'
              : 'bg-white/[0.04] text-white/50 border border-white/[0.08]'
          }`}
        >
          <SlidersHorizontal className="w-3.5 h-3.5" />
          <span className="hidden sm:block">Filtros</span>
          {hasActiveFilters && (
            <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-teal-500" />
          )}
        </button>

        {/* Lista toggle */}
        <button
          onClick={() => setShowList(!showList)}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all flex-shrink-0 ${
            showList
              ? 'bg-teal-500/10 text-teal-400 border border-teal-500/20'
              : 'bg-white/[0.04] text-white/50 border border-white/[0.08]'
          }`}
        >
          <span className="hidden sm:block">Lista</span>
          {filtered.length > 0 && (
            <span className="bg-teal-500 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
              {filtered.length > 99 ? '99+' : filtered.length}
            </span>
          )}
        </button>

        {/* Localização */}
        <button
          onClick={locateUser}
          className="p-2 rounded-lg bg-white/[0.04] text-white/50 border border-white/[0.08] hover:text-teal-400 hover:border-teal-500/20 transition-all flex-shrink-0"
          title="Minha localização"
        >
          <LocateFixed className="w-3.5 h-3.5" />
        </button>

        <Link href="/auth/register" className="bg-teal-500 hover:bg-teal-400 text-white text-xs font-semibold px-3 py-2 rounded-lg transition-all flex-shrink-0 hidden sm:block">
          Registrar
        </Link>
      </nav>

      {/* Filtros avançados — painel expansível */}
      {showFilters && (
        <div className="px-4 py-3 border-b border-white/[0.06] bg-[#0a0d12] flex-shrink-0">
          <div className="flex flex-wrap gap-3 items-end">
            {/* Status */}
            <div className="flex flex-col gap-1">
              <label className="text-white/40 text-[11px] font-medium uppercase tracking-wide">Status</label>
              <div className="flex gap-1.5">
                {[
                  { value: '', label: 'Todos' },
                  { value: 'lost', label: '🔴 Perdido' },
                  { value: 'found', label: '🟢 Achado' },
                  { value: 'stolen', label: '🟠 Roubado' },
                  { value: 'returned', label: '✅ Recuperado' },
                ].map(f => (
                  <button
                    key={f.value}
                    onClick={() => setFilters(prev => ({ ...prev, status: prev.status === f.value ? '' : f.value }))}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                      filters.status === f.value
                        ? 'bg-teal-500/15 text-teal-400 border border-teal-500/30'
                        : 'bg-white/[0.04] text-white/40 border border-white/[0.07] hover:border-white/20'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Categoria */}
            <div className="flex flex-col gap-1">
              <label className="text-white/40 text-[11px] font-medium uppercase tracking-wide">Categoria</label>
              <select
                value={filters.category}
                onChange={e => setFilters(f => ({ ...f, category: e.target.value }))}
                className="bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-1.5 text-white text-xs outline-none focus:border-teal-500/50 transition-colors"
              >
                <option value="">Todas</option>
                {Object.entries(CATEGORY_LABEL).map(([val, label]) => (
                  <option key={val} value={val}>{EMOJI[val]} {label}</option>
                ))}
              </select>
            </div>

            {/* Período */}
            <div className="flex flex-col gap-1">
              <label className="text-white/40 text-[11px] font-medium uppercase tracking-wide">Período</label>
              <select
                value={filters.daysAgo}
                onChange={e => setFilters(f => ({ ...f, daysAgo: Number(e.target.value) }))}
                className="bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-1.5 text-white text-xs outline-none focus:border-teal-500/50 transition-colors"
              >
                <option value={0}>Qualquer data</option>
                <option value={7}>Últimos 7 dias</option>
                <option value={30}>Últimos 30 dias</option>
                <option value={90}>Últimos 3 meses</option>
                <option value={365}>Último ano</option>
              </select>
            </div>

            {/* Raio */}
            <div className="flex flex-col gap-1">
              <label className="text-white/40 text-[11px] font-medium uppercase tracking-wide">
                Raio {filters.radiusKm > 0 ? `(${filters.radiusKm} km)` : ''}
              </label>
              <div className="flex items-center gap-2">
                <select
                  value={filters.radiusKm}
                  onChange={e => {
                    const val = Number(e.target.value);
                    setFilters(f => ({ ...f, radiusKm: val }));
                    if (val > 0 && !userLocation) locateUser();
                  }}
                  className="bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-1.5 text-white text-xs outline-none focus:border-teal-500/50 transition-colors"
                >
                  <option value={0}>Sem limite</option>
                  <option value={5}>5 km</option>
                  <option value={10}>10 km</option>
                  <option value={25}>25 km</option>
                  <option value={50}>50 km</option>
                  <option value={100}>100 km</option>
                </select>
                {filters.radiusKm > 0 && !userLocation && (
                  <span className="text-orange-400 text-[11px]">Ative a localização</span>
                )}
              </div>
            </div>

            {/* Limpar filtros */}
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-red-400 border border-red-500/20 bg-red-500/5 hover:bg-red-500/10 transition-all"
              >
                <X className="w-3 h-3" />
                Limpar filtros
              </button>
            )}
          </div>
        </div>
      )}

      {/* Status bar */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-white/[0.06] bg-[#080b0f] flex-shrink-0 overflow-x-auto">
        <span className="text-white/20 text-xs">
          {loading
            ? 'Carregando...'
            : `${filtered.length} objeto${filtered.length !== 1 ? 's' : ''} ${hasActiveFilters ? '(filtrado)' : ''}`}
        </span>
        {userLocation && (
          <span className="text-teal-400/60 text-xs ml-auto flex-shrink-0">
            📍 Localização ativa
          </span>
        )}
      </div>

      {/* Map + list layout */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">

        {/* Map */}
        <div className={`relative transition-all duration-300 ${showList ? 'h-[45vh] md:h-auto md:flex-1' : 'flex-1'}`}>
          <div ref={mapContainer} className="w-full h-full" />

          {!process.env.NEXT_PUBLIC_MAPBOX_TOKEN && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#080b0f]/95 gap-3 text-center px-6">
              <div className="w-14 h-14 rounded-2xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center">
                <MapPin className="w-7 h-7 text-teal-400" />
              </div>
              <p className="font-bold text-white text-lg">Mapa Interativo</p>
              <p className="text-white/40 text-sm max-w-xs">
                Adicione <code className="text-teal-400 bg-white/[0.06] px-1.5 py-0.5 rounded text-xs">NEXT_PUBLIC_MAPBOX_TOKEN</code> nas variáveis do Vercel para ativar.
              </p>
            </div>
          )}

          {/* Selected object popup */}
          {selected && (
            <div className="absolute bottom-4 left-4 right-4 bg-[#0d1117]/95 backdrop-blur-xl border border-white/[0.08] rounded-2xl p-4 shadow-2xl">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/[0.06] flex items-center justify-center text-xl flex-shrink-0">
                  {EMOJI[selected.category] ?? '📦'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-semibold text-sm">{selected.title}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${STATUS_COLOR[selected.status]}`}>
                      {STATUS_LABEL[selected.status]}
                    </span>
                    <span className="text-white/30 text-xs">{CATEGORY_LABEL[selected.category] ?? 'Outro'}</span>
                  </div>
                  <p className="text-white/40 text-xs mt-1 line-clamp-2">{selected.description}</p>
                </div>
                <button onClick={() => setSelected(null)} className="text-white/30 hover:text-white transition-colors flex-shrink-0">
                  <X className="w-4 h-4" />
                </button>
              </div>
              {selected.reward_amount && selected.reward_amount > 0 && (
                <div className="mt-3 flex items-center gap-2 bg-yellow-500/10 border border-yellow-500/20 rounded-xl px-3 py-2">
                  <Gift className="w-4 h-4 text-yellow-400 flex-shrink-0" />
                  <span className="text-yellow-400 text-xs font-semibold">
                    Recompensa: R$ {selected.reward_amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              )}
              <Link
                href={`/scan/${selected.unique_code}`}
                className="mt-3 flex items-center justify-center gap-2 w-full bg-teal-500 hover:bg-teal-400 text-white text-sm font-semibold py-2.5 rounded-xl transition-all"
              >
                Ver detalhes / Contactar dono
              </Link>
            </div>
          )}
        </div>

        {/* List — virtualização simples com load-more */}
        {showList && (
          <aside className="w-full md:w-72 md:flex-shrink-0 border-t md:border-t-0 md:border-l border-white/[0.06] bg-[#080b0f] flex flex-col overflow-hidden h-[55vh] md:h-auto">
            <div className="flex-1 overflow-y-auto p-3 space-y-1">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="h-14 bg-white/[0.04] rounded-xl animate-pulse" />
                ))
              ) : listItems.length === 0 ? (
                <div className="text-center py-10 text-white/30 text-sm">
                  Nenhum objeto encontrado
                  {hasActiveFilters && (
                    <button onClick={clearFilters} className="block mx-auto mt-2 text-teal-400 text-xs underline">
                      Limpar filtros
                    </button>
                  )}
                </div>
              ) : (
                <>
                  {listItems.map(obj => (
                    <button
                      key={obj.id}
                      onClick={() => setSelected(selected?.id === obj.id ? null : obj)}
                      className={`w-full flex items-center gap-3 p-3 rounded-xl text-left transition-all ${
                        selected?.id === obj.id
                          ? 'bg-teal-500/10 border border-teal-500/20'
                          : 'hover:bg-white/[0.04] border border-transparent'
                      }`}
                    >
                      <div className="w-9 h-9 rounded-xl bg-white/[0.06] flex items-center justify-center text-lg flex-shrink-0">
                        {EMOJI[obj.category] ?? '📦'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-sm font-medium truncate">{obj.title}</p>
                        <div className="flex items-center gap-1.5">
                          <p className={`text-xs ${STATUS_COLOR[obj.status].split(' ')[0]}`}>{STATUS_LABEL[obj.status]}</p>
                          <span className="text-white/20 text-xs">·</span>
                          <p className="text-white/30 text-xs truncate">{CATEGORY_LABEL[obj.category] ?? 'Outro'}</p>
                          {obj.reward_amount && obj.reward_amount > 0 && (
                            <Gift className="w-3 h-3 text-yellow-400 flex-shrink-0" />
                          )}
                        </div>
                      </div>
                      <ChevronRight className="w-3.5 h-3.5 text-white/20 flex-shrink-0" />
                    </button>
                  ))}
                  {/* Load more */}
                  {listItems.length < filtered.length && (
                    <button
                      onClick={() => setListPage(p => p + 1)}
                      className="w-full py-2.5 text-xs text-teal-400 hover:text-teal-300 transition-colors text-center"
                    >
                      Carregar mais ({filtered.length - listItems.length} restantes)
                    </button>
                  )}
                </>
              )}
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
