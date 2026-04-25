'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import { Search, MapPin, Filter, Package, ArrowRight, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { objectsApi, parseApiError } from '@/lib/api';
import { RegisteredObject } from '@/types';

const CATEGORIES = [
  { value: '', label: 'Todas' },
  { value: 'phone', label: '📱 Celular' },
  { value: 'wallet', label: '👛 Carteira' },
  { value: 'keys', label: '🔑 Chaves' },
  { value: 'bag', label: '🎒 Bolsa' },
  { value: 'pet', label: '🐾 Pet' },
  { value: 'document', label: '📄 Documento' },
  { value: 'electronics', label: '💻 Eletrônico' },
  { value: 'other', label: '📦 Outro' },
];

const EMOJI: Record<string, string> = {
  phone: '📱', wallet: '👛', keys: '🔑', bag: '🎒', pet: '🐾',
  bike: '🚲', vehicle: '🚗', document: '📄', jewelry: '💍', electronics: '💻', clothing: '👕', other: '📦',
};

export default function SearchPage() {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const [results, setResults] = useState<RegisteredObject[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const search = useCallback(async () => {
    if (!query.trim() && !category) {
      toast.error('Digite algo para buscar ou selecione uma categoria.');
      return;
    }
    setLoading(true);
    try {
      const { data } = await objectsApi.listPublic({
        status: 'found',
        category: category || undefined,
        size: 50,
      });
      const items: RegisteredObject[] = data?.items ?? [];

      // Client-side text filter
      const filtered = query.trim()
        ? items.filter(o =>
            o.title.toLowerCase().includes(query.toLowerCase()) ||
            o.description.toLowerCase().includes(query.toLowerCase())
          )
        : items;

      setResults(filtered);
      setSearched(true);
    } catch (e) {
      toast.error(parseApiError(e));
    } finally {
      setLoading(false);
    }
  }, [query, category]);

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') search();
  };

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="font-display text-2xl font-bold text-white">Buscar Achados</h1>
        <p className="text-white/40 text-sm mt-0.5">
          Pesquise entre os objetos encontrados e registrados na plataforma.
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
          onClick={search}
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
            onClick={() => setCategory(cat.value)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              category === cat.value
                ? 'bg-teal-500/15 text-teal-400 border border-teal-500/30'
                : 'bg-white/[0.04] text-white/40 border border-white/[0.07] hover:text-white/70'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Results */}
      {!searched && !loading && (
        <div className="text-center py-20">
          <Search className="w-10 h-10 text-white/10 mx-auto mb-4" />
          <p className="text-white/30 text-sm">
            Busque por objetos encontrados próximos a você.
          </p>
          <p className="text-white/20 text-xs mt-2">
            Digite palavras-chave como cor, marca, modelo ou tipo do objeto.
          </p>
        </div>
      )}

      {searched && results.length === 0 && (
        <div className="text-center py-16">
          <div className="text-4xl mb-4">🔍</div>
          <p className="text-white font-display font-semibold text-lg mb-2">Nenhum resultado encontrado</p>
          <p className="text-white/40 text-sm max-w-sm mx-auto">
            Tente termos diferentes ou cadastre seu objeto como perdido para ser alertado quando aparecer.
          </p>
          <Link
            href="/dashboard/objects/new"
            className="inline-flex items-center gap-2 mt-6 bg-teal-500 hover:bg-teal-400 text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition-all"
          >
            Registrar objeto perdido
          </Link>
        </div>
      )}

      {results.length > 0 && (
        <div>
          <p className="text-white/30 text-xs mb-4 uppercase tracking-wider">
            {results.length} resultado{results.length !== 1 ? 's' : ''} encontrado{results.length !== 1 ? 's' : ''}
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {results.map(obj => (
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
                    <span className="text-xs text-teal-400 bg-teal-500/10 border border-teal-500/20 px-2 py-0.5 rounded-full flex-shrink-0">
                      Achado
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
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
