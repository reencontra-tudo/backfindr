'use client';

import { useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import { Search, MapPin, Loader2, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { objectsApi, parseApiError } from '@/lib/api';
import { RegisteredObject } from '@/types';

const CATEGORIES = [
  { value: '', label: 'Todas', highlight: false },
  { value: 'phone', label: '📱 Celular', highlight: true },
  { value: 'pet', label: '🐾 Pet', highlight: true },
  { value: 'vehicle', label: '🚗 Veículo', highlight: true },
  { value: 'wallet', label: '👛 Carteira', highlight: false },
  { value: 'keys', label: '🔑 Chaves', highlight: false },
  { value: 'bag', label: '🎒 Bolsa', highlight: false },
  { value: 'bike', label: '🚲 Bicicleta', highlight: false },
  { value: 'document', label: '📄 Documento', highlight: false },
  { value: 'electronics', label: '💻 Eletrônico', highlight: false },
  { value: 'other', label: '📦 Outro', highlight: false },
];

const EMOJI: Record<string, string> = {
  phone: '📱', wallet: '👛', keys: '🔑', bag: '🎒', pet: '🐾',
  bike: '🚲', vehicle: '🚗', document: '📄', jewelry: '💍',
  electronics: '💻', clothing: '👕', other: '📦', animal: '🐾',
};

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  lost:     { label: 'Perdido',    color: 'text-red-400 bg-red-500/10 border-red-500/20' },
  found:    { label: 'Achado',     color: 'text-teal-400 bg-teal-500/10 border-teal-500/20' },
  stolen:   { label: 'Roubado',   color: 'text-orange-400 bg-orange-500/10 border-orange-500/20' },
  returned: { label: 'Recuperado', color: 'text-green-400 bg-green-500/10 border-green-500/20' },
};

export default function SearchPage() {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const [results, setResults] = useState<RegisteredObject[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  // Controla se a busca foi disparada ao menos uma vez
  const didFirstSearch = useRef(false);

  const doSearch = useCallback(async (overrideCategory?: string) => {
    const cat = overrideCategory !== undefined ? overrideCategory : category;
    setLoading(true);
    try {
      const params: Record<string, unknown> = {
        // Busca todos os status relevantes — a plataforma ainda tem poucos achados
        status: 'all',
        size: 100,
      };
      if (cat) params.category = cat;
      if (query.trim()) params.q = query.trim();

      const { data } = await objectsApi.listPublic(params);
      const allItems: RegisteredObject[] = data?.items ?? [];

      // Filtrar: excluir legados com categorias de pessoas desaparecidas
      // (registros webjetos com category='pet' mas título de desaparecimento humano)
      const filtered = allItems.filter(obj => {
        // Excluir todos os legados — dados antigos do webjetos são inconsistentes
        if (obj.is_legacy) return false;
        return true;
      });

      setResults(filtered);
      setHasSearched(true);
      didFirstSearch.current = true;
    } catch (e) {
      toast.error(parseApiError(e));
    } finally {
      setLoading(false);
    }
  }, [query, category]);

  const handleCategoryClick = (val: string) => {
    setCategory(val);
    doSearch(val);
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') doSearch();
  };

  const catLabel = CATEGORIES.find(c => c.value === category)?.label ?? '';

  return (
    <div className="p-6 md:p-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold text-white">Buscar ocorrências</h1>
        <p className="text-white/40 text-sm mt-0.5">
          Pesquise objetos perdidos, achados ou roubados registrados na plataforma.
        </p>
      </div>

      {/* Search bar */}
      <div className="flex gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Ex: iPhone preto, carteira de couro, labrador caramelo..."
            className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl pl-10 pr-4 py-3 text-white placeholder-white/20 text-sm outline-none focus:border-teal-500/50 transition-all"
          />
        </div>
        <button
          onClick={() => doSearch()}
          disabled={loading}
          className="flex items-center gap-2 bg-teal-500 hover:bg-teal-400 disabled:opacity-60 text-white font-semibold px-5 py-3 rounded-xl transition-all text-sm flex-shrink-0"
          style={{ boxShadow: '0 0 0 1px rgba(20,184,166,0.4)' }}
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          Buscar
        </button>
      </div>

      {/* Category filter */}
      <div className="flex gap-2 flex-wrap mb-8">
        {CATEGORIES.map(cat => (
          <button
            key={cat.value}
            onClick={() => handleCategoryClick(cat.value)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              category === cat.value
                ? 'bg-teal-500/15 text-teal-400 border border-teal-500/30'
                : cat.highlight
                  ? 'bg-amber-500/8 text-amber-300/70 border border-amber-500/20 hover:text-amber-300'
                  : 'bg-white/[0.04] text-white/40 border border-white/[0.07] hover:text-white/70'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Loading skeleton */}
      {loading && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1,2,3,4,5,6].map(i => (
            <div key={i} className="bg-white/[0.03] border border-white/[0.07] rounded-2xl overflow-hidden animate-pulse">
              <div className="w-full h-36 bg-white/[0.04]" />
              <div className="p-4 space-y-2">
                <div className="h-3 bg-white/[0.06] rounded w-3/4" />
                <div className="h-3 bg-white/[0.04] rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Estado inicial — nenhuma busca feita ainda */}
      {!loading && !hasSearched && (
        <div className="text-center py-20">
          <div className="w-16 h-16 rounded-2xl bg-white/[0.04] border border-white/[0.07] flex items-center justify-center mx-auto mb-5">
            <Search className="w-7 h-7 text-white/20" />
          </div>
          <p className="text-white/40 text-sm font-medium mb-1">
            Digite palavras-chave ou selecione uma categoria
          </p>
          <p className="text-white/20 text-xs">
            Pesquise por cor, marca, modelo, raça ou tipo do objeto.
          </p>
        </div>
      )}

      {/* Sem resultados após busca */}
      {!loading && hasSearched && results.length === 0 && (
        <div className="text-center py-16">
          <div className="text-4xl mb-4">🔍</div>
          <p className="text-white font-display font-semibold text-lg mb-2">
            Nenhuma ocorrência encontrada
          </p>
          <p className="text-white/40 text-sm max-w-sm mx-auto mb-6">
            {category
              ? `Não há registros de ${catLabel} na plataforma ainda. Seja o primeiro a registrar!`
              : 'Nenhum resultado para essa busca. Cadastre seu objeto para ser alertado quando aparecer.'}
          </p>
          <Link
            href="/dashboard/objects/new"
            className="inline-flex items-center gap-2 bg-teal-500 hover:bg-teal-400 text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition-all"
          >
            <Plus className="w-4 h-4" />
            Registrar objeto
          </Link>
        </div>
      )}

      {/* Resultados */}
      {!loading && results.length > 0 && (
        <div>
          <p className="text-white/30 text-xs mb-4 uppercase tracking-wider">
            {results.length} ocorrência{results.length !== 1 ? 's' : ''}
            {category ? ` em ${catLabel}` : ''}
            {query.trim() ? ` para "${query.trim()}"` : ''}
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {results.map(obj => {
              const sc = STATUS_CONFIG[obj.status] ?? STATUS_CONFIG['lost'];
              return (
                <Link
                  key={obj.id}
                  href={`/objeto/${obj.unique_code}`}
                  target="_blank"
                  className="group bg-white/[0.03] border border-white/[0.07] hover:border-teal-500/30 rounded-2xl overflow-hidden transition-all"
                >
                  {obj.photos?.[0] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={obj.photos[0]}
                      alt={obj.title}
                      className="w-full h-36 object-cover border-b border-white/[0.06]"
                    />
                  ) : (
                    <div className="w-full h-36 bg-white/[0.04] border-b border-white/[0.06] flex items-center justify-center text-4xl">
                      {EMOJI[obj.category] ?? '📦'}
                    </div>
                  )}
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <p className="text-white font-medium text-sm leading-tight group-hover:text-teal-300 transition-colors line-clamp-2">
                        {obj.title}
                      </p>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full border flex-shrink-0 ${sc.color}`}>
                        {sc.label}
                      </span>
                    </div>
                    <p className="text-white/40 text-xs line-clamp-2 mb-3">{obj.description}</p>
                    <div className="flex items-center justify-between">
                      {obj.location?.address && (
                        <div className="flex items-center gap-1 text-white/30 text-xs">
                          <MapPin className="w-3 h-3" />
                          <span className="truncate max-w-[120px]">{obj.location.address}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-1 text-white/20 text-xs ml-auto">
                        {formatDistanceToNow(new Date(obj.created_at), { addSuffix: true, locale: ptBR })}
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>

          {/* CTA para registrar */}
          <div className="mt-8 p-4 bg-white/[0.02] border border-white/[0.06] rounded-xl flex items-center justify-between gap-4">
            <div>
              <p className="text-white/60 text-sm font-medium">Não encontrou o que procura?</p>
              <p className="text-white/30 text-xs mt-0.5">Registre seu objeto e seja notificado quando aparecer.</p>
            </div>
            <Link
              href="/dashboard/objects/new"
              className="flex items-center gap-1.5 bg-teal-500/10 hover:bg-teal-500/20 border border-teal-500/20 text-teal-400 text-xs font-semibold px-3 py-2 rounded-lg transition-all flex-shrink-0"
            >
              <Plus className="w-3.5 h-3.5" /> Registrar
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
