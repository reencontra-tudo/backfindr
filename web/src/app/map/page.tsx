'use client';
import { useEffect, useState, useRef, useCallback } from 'react';
import Link from 'next/link';
import { MapPin, Search, X, Package, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { objectsApi, parseApiError } from '@/lib/api';
import { RegisteredObject } from '@/types';

const EMOJI: Record<string,string> = { phone:'📱',wallet:'👛',keys:'🔑',bag:'🎒',pet:'🐾',bike:'🚲',document:'📄',jewelry:'💍',electronics:'💻',clothing:'👕',other:'📦' };
const STATUS_LABEL: Record<string,string> = { lost:'Perdido',found:'Achado',returned:'Recuperado',stolen:'Roubado' };
const STATUS_COLOR: Record<string,string> = { lost:'text-red-400',found:'text-brand-400',returned:'text-green-400',stolen:'text-orange-400' };

export default function MapPage() {
  const [objects, setObjects] = useState<RegisteredObject[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selected, setSelected] = useState<RegisteredObject | null>(null);
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
      const map = new mapboxgl.default.Map({ container: mapContainer.current!, style: 'mapbox://styles/mapbox/dark-v11', center: [-46.6333, -23.5505], zoom: 11 });
      map.on('load', () => {
        map.addSource('objects', { type:'geojson', data:{ type:'FeatureCollection', features:[] }, cluster:true, clusterMaxZoom:14, clusterRadius:50 });
        map.addLayer({ id:'clusters', type:'circle', source:'objects', filter:['has','point_count'], paint:{ 'circle-color':'#14b8a6', 'circle-radius':['step',['get','point_count'],20,10,30,50,40], 'circle-opacity':0.85 } });
        map.addLayer({ id:'cluster-count', type:'symbol', source:'objects', filter:['has','point_count'], layout:{ 'text-field':'{point_count_abbreviated}', 'text-size':12 }, paint:{ 'text-color':'#0f172a' } });
        map.addLayer({ id:'unclustered-point', type:'circle', source:'objects', filter:['!',['has','point_count']], paint:{ 'circle-color':['match',['get','status'],'lost','#ef4444','found','#14b8a6','returned','#22c55e','#f97316'], 'circle-radius':8, 'circle-stroke-width':2, 'circle-stroke-color':'#0f172a' } });
      });
      mapRef.current = map;
    });
  }, []);

  useEffect(() => {
    const map = mapRef.current as { getSource?: (id:string) => { setData?: (d:unknown)=>void }|undefined }|null;
    if (!map?.getSource) return;
    const source = map.getSource('objects');
    if (!source?.setData) return;
    const features = objects.filter(o => o.location?.lat && o.location?.lng).map(o => ({ type:'Feature' as const, geometry:{ type:'Point' as const, coordinates:[o.location!.lng, o.location!.lat] }, properties:{ id:o.id, title:o.title, status:o.status } }));
    source.setData({ type:'FeatureCollection', features });
  }, [objects]);

  const filtered = objects.filter(o => (search ? o.title.toLowerCase().includes(search.toLowerCase()) : true) && (statusFilter ? o.status === statusFilter : true));

  return (
    <div className="h-screen flex flex-col bg-surface">
      <nav className="glass border-b border-surface-border flex items-center gap-4 px-6 h-14 flex-shrink-0 z-10">
        <Link href="/" className="flex items-center gap-2 flex-shrink-0"><div className="w-7 h-7 rounded-lg gradient-brand flex items-center justify-center"><MapPin className="w-3.5 h-3.5 text-white" /></div><span className="font-display font-bold text-white text-sm">Backfindr</span></Link>
        <div className="relative flex-1 max-w-sm"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" /><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar objetos..." className="w-full bg-surface border border-surface-border rounded-lg pl-8 pr-3 py-1.5 text-slate-100 placeholder-slate-500 text-xs outline-none focus:border-brand-500 transition-colors" /></div>
        <div className="flex items-center gap-2 ml-auto">
          {(['','lost','found'] as const).map(s => <button key={s} onClick={() => setStatusFilter(s===statusFilter?'':s)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${statusFilter===s ? (s==='lost'?'bg-red-500/20 text-red-400 border border-red-500/30':s==='found'?'bg-brand-500/20 text-brand-400 border border-brand-500/30':'bg-surface text-white border border-surface-border') : 'glass text-slate-400 hover:text-white'}`}>{s===''?'Todos':s==='lost'?'🔴 Perdidos':'🟢 Achados'}</button>)}
          <Link href="/auth/register" className="ml-2 bg-brand-500 hover:bg-brand-400 text-white text-xs font-semibold px-4 py-1.5 rounded-lg transition-all glow-teal">Registrar objeto</Link>
        </div>
      </nav>
      <div className="flex flex-1 overflow-hidden">
        <aside className="w-72 flex-shrink-0 bg-surface-card border-r border-surface-border flex flex-col overflow-hidden">
          <div className="p-4 border-b border-surface-border flex items-center justify-between"><p className="text-white text-sm font-display font-semibold">{loading?'Carregando...':`${filtered.length} objeto${filtered.length!==1?'s':''}`}</p>{(search||statusFilter)&&<button onClick={()=>{setSearch('');setStatusFilter('');}} className="text-slate-500 hover:text-white transition-colors"><X className="w-3.5 h-3.5" /></button>}</div>
          <div className="flex-1 overflow-y-auto p-3 space-y-1">
            {loading ? Array.from({length:5}).map((_,i)=><div key={i} className="h-14 bg-surface-border rounded-xl animate-pulse" />) : filtered.map(obj => (
              <button key={obj.id} onClick={()=>setSelected(selected?.id===obj.id?null:obj)} className={`w-full flex items-center gap-3 p-3 rounded-xl text-left transition-all ${selected?.id===obj.id?'bg-brand-500/10 border border-brand-500/20':'hover:bg-surface border border-transparent'}`}>
                <div className="w-10 h-10 rounded-xl bg-surface flex items-center justify-center text-xl flex-shrink-0">{EMOJI[obj.category]??'📦'}</div>
                <div className="flex-1 min-w-0"><p className="text-white text-sm font-medium truncate">{obj.title}</p><p className={`text-xs ${STATUS_COLOR[obj.status]}`}>{STATUS_LABEL[obj.status]}</p></div>
                <ChevronRight className="w-3.5 h-3.5 text-slate-600 flex-shrink-0" />
              </button>
            ))}
          </div>
        </aside>
        <div className="flex-1 relative">
          <div ref={mapContainer} className="w-full h-full" />
          {!process.env.NEXT_PUBLIC_MAPBOX_TOKEN && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-surface-card/90 backdrop-blur-sm gap-3">
              <MapPin className="w-12 h-12 text-brand-500" />
              <p className="font-display font-bold text-white text-lg">Mapa Interativo</p>
              <p className="text-slate-400 text-sm text-center max-w-xs">Configure <code className="text-brand-400 bg-surface px-1.5 py-0.5 rounded text-xs">NEXT_PUBLIC_MAPBOX_TOKEN</code> no .env para ativar o mapa.</p>
            </div>
          )}
          {selected && (
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-80 glass rounded-2xl p-4 shadow-2xl">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-surface flex items-center justify-center text-xl flex-shrink-0">{EMOJI[selected.category]??'📦'}</div>
                <div className="flex-1 min-w-0"><p className="text-white font-display font-semibold text-sm">{selected.title}</p><p className={`text-xs ${STATUS_COLOR[selected.status]}`}>{STATUS_LABEL[selected.status]}</p><p className="text-slate-500 text-xs mt-1 line-clamp-2">{selected.description}</p></div>
                <button onClick={()=>setSelected(null)} className="text-slate-600 hover:text-white transition-colors flex-shrink-0"><X className="w-4 h-4" /></button>
              </div>
              <Link href={`/scan/${selected.unique_code}`} className="mt-3 flex items-center justify-center gap-2 w-full bg-brand-500 hover:bg-brand-400 text-white text-xs font-semibold py-2 rounded-lg transition-all"><Package className="w-3.5 h-3.5" />Ver detalhes / Contactar dono</Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
