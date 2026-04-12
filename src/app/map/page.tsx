'use client';
import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { MapPin, Search, X, ChevronRight, SlidersHorizontal } from 'lucide-react';
import { toast } from 'sonner';
import { objectsApi, parseApiError } from '@/lib/api';
import { RegisteredObject } from '@/types';

const EMOJI: Record<string,string> = { phone:'📱',wallet:'👛',keys:'🔑',bag:'🎒',pet:'🐾',bike:'🚲',document:'📄',jewelry:'💍',electronics:'💻',clothing:'👕',other:'📦' };
const STATUS_LABEL: Record<string,string> = { lost:'Perdido',found:'Achado',returned:'Recuperado',stolen:'Roubado' };
const STATUS_COLOR: Record<string,string> = { lost:'text-red-400 bg-red-500/10 border-red-500/20', found:'text-teal-400 bg-teal-500/10 border-teal-500/20', returned:'text-green-400 bg-green-500/10 border-green-500/20', stolen:'text-orange-400 bg-orange-500/10 border-orange-500/20' };

export default function MapPage() {
  const [objects, setObjects] = useState<RegisteredObject[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selected, setSelected] = useState<RegisteredObject | null>(null);
  const [showList, setShowList] = useState(false);
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<unknown>(null);

  useEffect(() => {
    objectsApi.listPublic({ size: 200 })
      .then(({ data }) => setObjects(data?.items ?? []))
      .catch(e => toast.error(parseApiError(e)))
      .finally(() => setLoading(false));
  }, []);

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
      });
      map.on('load', () => {
        map.addSource('objects', { type:'geojson', data:{ type:'FeatureCollection', features:[] }, cluster:true, clusterMaxZoom:14, clusterRadius:50 });
        map.addLayer({ id:'clusters', type:'circle', source:'objects', filter:['has','point_count'], paint:{ 'circle-color':'#14b8a6', 'circle-radius':['step',['get','point_count'],20,10,30,50,40], 'circle-opacity':0.85 } });
        map.addLayer({ id:'cluster-count', type:'symbol', source:'objects', filter:['has','point_count'], layout:{ 'text-field':'{point_count_abbreviated}', 'text-size':12 }, paint:{ 'text-color':'#0f172a' } });
        map.addLayer({ id:'unclustered-point', type:'circle', source:'objects', filter:['!',['has','point_count']], paint:{ 'circle-color':['match',['get','status'],'lost','#ef4444','found','#14b8a6','returned','#22c55e','#f97316'], 'circle-radius':8, 'circle-stroke-width':2, 'circle-stroke-color':'#080b0f' } });
      });
      mapRef.current = map;
    });
  }, []);

  useEffect(() => {
    const map = mapRef.current as { getSource?: (id:string) => { setData?: (d:unknown)=>void }|undefined }|null;
    if (!map?.getSource) return;
    const source = map.getSource('objects');
    if (!source?.setData) return;
    const features = objects
      .filter(o => o.location?.lat && o.location?.lng)
      .map(o => ({ type:'Feature' as const, geometry:{ type:'Point' as const, coordinates:[o.location!.lng, o.location!.lat] }, properties:{ id:o.id, title:o.title, status:o.status } }));
    source.setData({ type:'FeatureCollection', features });
  }, [objects]);

  const filtered = objects.filter(o =>
    (search ? o.title.toLowerCase().includes(search.toLowerCase()) : true) &&
    (statusFilter ? o.status === statusFilter : true)
  );

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
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar objetos..."
            className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg pl-9 pr-3 py-2 text-white placeholder-white/20 text-sm outline-none focus:border-teal-500/50 transition-colors"
          />
          {search && <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white"><X className="w-3.5 h-3.5" /></button>}
        </div>

        {/* Filter toggle */}
        <button
          onClick={() => setShowList(!showList)}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all flex-shrink-0 ${showList ? 'bg-teal-500/10 text-teal-400 border border-teal-500/20' : 'bg-white/[0.04] text-white/50 border border-white/[0.08]'}`}
        >
          <SlidersHorizontal className="w-3.5 h-3.5" />
          <span className="hidden sm:block">Lista</span>
          {filtered.length > 0 && <span className="bg-teal-500 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">{filtered.length}</span>}
        </button>

        <Link href="/auth/register" className="bg-teal-500 hover:bg-teal-400 text-white text-xs font-semibold px-3 py-2 rounded-lg transition-all flex-shrink-0 hidden sm:block">
          Registrar
        </Link>
      </nav>

      {/* Status filters */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-white/[0.06] bg-[#080b0f] flex-shrink-0 overflow-x-auto">
        {[
          { value: '',      label: 'Todos' },
          { value: 'lost',  label: '🔴 Perdidos' },
          { value: 'found', label: '🟢 Achados' },
        ].map(f => (
          <button
            key={f.value}
            onClick={() => setStatusFilter(statusFilter === f.value ? '' : f.value)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex-shrink-0 ${
              statusFilter === f.value
                ? 'bg-teal-500/15 text-teal-400 border border-teal-500/30'
                : 'bg-white/[0.04] text-white/40 border border-white/[0.07]'
            }`}
          >
            {f.label}
          </button>
        ))}
        <span className="text-white/20 text-xs ml-auto flex-shrink-0">
          {loading ? 'Carregando...' : `${filtered.length} objeto${filtered.length !== 1 ? 's' : ''}`}
        </span>
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
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full border inline-block mt-1 ${STATUS_COLOR[selected.status]}`}>
                    {STATUS_LABEL[selected.status]}
                  </span>
                  <p className="text-white/40 text-xs mt-1 line-clamp-2">{selected.description}</p>
                </div>
                <button onClick={() => setSelected(null)} className="text-white/30 hover:text-white transition-colors flex-shrink-0">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <Link href={`/scan/${selected.unique_code}`}
                className="mt-3 flex items-center justify-center gap-2 w-full bg-teal-500 hover:bg-teal-400 text-white text-sm font-semibold py-2.5 rounded-xl transition-all"
                style={{ boxShadow: '0 0 0 1px rgba(20,184,166,0.4)' }}>
                Ver detalhes / Contactar dono
              </Link>
            </div>
          )}
        </div>

        {/* List — shows below map on mobile when toggled, side on desktop */}
        {showList && (
          <aside className="w-full md:w-72 md:flex-shrink-0 border-t md:border-t-0 md:border-l border-white/[0.06] bg-[#080b0f] flex flex-col overflow-hidden h-[55vh] md:h-auto">
            <div className="flex-1 overflow-y-auto p-3 space-y-1">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="h-14 bg-white/[0.04] rounded-xl animate-pulse" />
                ))
              ) : filtered.length === 0 ? (
                <div className="text-center py-10 text-white/30 text-sm">
                  Nenhum objeto encontrado
                </div>
              ) : (
                filtered.map(obj => (
                  <button
                    key={obj.id}
                    onClick={() => { setSelected(selected?.id === obj.id ? null : obj); }}
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
                      <p className={`text-xs ${STATUS_COLOR[obj.status].split(' ')[0]}`}>{STATUS_LABEL[obj.status]}</p>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-white/20 flex-shrink-0" />
                  </button>
                ))
              )}
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
