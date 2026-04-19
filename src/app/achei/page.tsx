'use client';

import { useState, useCallback, Suspense } from 'react';
import Link from 'next/link';
import { MapPin, Search, ArrowRight, AlertTriangle, Package, Loader2 } from 'lucide-react';

interface ObjectItem {
  id: string;
  title: string;
  description: string;
  status: string;
  category: string;
  photos: string[];
  location: { lat: number; lng: number; address?: string } | null;
  color?: string;
  brand?: string;
  pet_breed?: string;
  created_at: string;
}

function AcheiPage() {
  const [keyword, setKeyword] = useState('');
  const [results, setResults] = useState<ObjectItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const doSearch = useCallback(async (kw: string) => {
    setLoading(true);
    setSearched(true);
    try {
      const params = new URLSearchParams();
      params.set('status', 'lost'); // quem achou quer ver objetos PERDIDOS (donos procurando)
      if (kw.trim()) params.set('keyword', kw.trim());
      params.set('size', '20');
      const res = await fetch(`/api/v1/objects/public?${params.toString()}`);
      const data = await res.json();
      setResults(data.items || []);
      setTotal(data.total || 0);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    doSearch(keyword);
  };

  return (
    <div className="min-h-screen bg-[#080b0f]">
      {/* Header */}
      <div className="border-b border-white/[0.06] px-5 py-4 flex items-center gap-3">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-teal-500 flex items-center justify-center">
            <MapPin className="w-3.5 h-3.5 text-white" strokeWidth={2.5} />
          </div>
          <span className="text-white font-semibold text-[15px]">Backfindr</span>
        </Link>
      </div>

      <div className="max-w-2xl mx-auto px-5 py-8">
        {/* Título */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white mb-2">Encontrou algo?</h1>
          <p className="text-white/50 text-sm leading-relaxed">
            Descreva o objeto que você encontrou e veja se o dono já está procurando na nossa rede.
          </p>
        </div>

        {/* Formulário de busca */}
        <form onSubmit={handleSearch} className="space-y-3 mb-8">
          <div>
            <label className="block text-sm text-white/70 font-medium mb-1.5">O que você encontrou?</label>
            <input
              type="text"
              value={keyword}
              onChange={e => setKeyword(e.target.value)}
              placeholder="Ex: carteira marrom, iPhone, cachorro labrador..."
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3.5 text-white placeholder-white/25 text-sm outline-none focus:border-teal-500/60 focus:bg-white/[0.06] transition-all"
              autoFocus
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-teal-500 hover:bg-teal-400 disabled:opacity-60 text-white font-bold py-4 rounded-xl transition-all text-base"
            style={{ boxShadow: '0 0 0 1px rgba(20,184,166,0.4),0 4px 20px rgba(20,184,166,0.15)' }}
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Search className="w-5 h-5" /><span>Ver se o dono está procurando</span></>}
          </button>
        </form>

        {/* Resultados */}
        {loading && (
          <div className="flex flex-col items-center py-16 gap-3">
            <Loader2 className="w-8 h-8 text-teal-400 animate-spin" />
            <p className="text-white/40 text-sm">Buscando na rede...</p>
          </div>
        )}

        {!loading && searched && (
          <>
            {results.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 rounded-2xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center mx-auto mb-4">
                  <Package className="w-7 h-7 text-white/20" />
                </div>
                <h3 className="text-white font-semibold mb-2">Nenhum dono encontrado ainda</h3>
                <p className="text-white/40 text-sm mb-6 leading-relaxed">
                  O dono pode ainda não ter cadastrado o objeto.<br />
                  Registre o que você achou — se ele procurar, a gente conecta vocês.
                </p>
                <Link
                  href="/auth/register?intent=found"
                  className="inline-flex items-center gap-2 bg-teal-500 hover:bg-teal-400 text-white font-bold px-6 py-3.5 rounded-xl transition-all text-sm"
                  style={{ boxShadow: '0 0 0 1px rgba(20,184,166,0.4),0 4px 20px rgba(20,184,166,0.15)' }}
                >
                  <span>Registrar o que achei</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-4">
                  <p className="text-white/50 text-sm">
                    <span className="text-teal-400 font-semibold">{total}</span> {total === 1 ? 'pessoa procurando' : 'pessoas procurando'} na rede
                  </p>
                </div>

                <div className="space-y-3 mb-8">
                  {results.map(item => (
                    <div key={item.id} className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-4 flex gap-4">
                      {/* Foto */}
                      <div className="w-16 h-16 rounded-xl bg-white/[0.05] border border-white/[0.06] flex-shrink-0 overflow-hidden">
                        {item.photos?.[0] ? (
                          <img src={item.photos[0]} alt={item.title} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Package className="w-6 h-6 text-white/20" />
                          </div>
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <h3 className="text-white font-semibold text-sm leading-tight truncate">{item.title}</h3>
                          <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border flex-shrink-0 text-red-400 bg-red-500/10 border-red-500/20">
                            <AlertTriangle className="w-3 h-3" />
                            Procurando
                          </span>
                        </div>
                        {item.description && (
                          <p className="text-white/40 text-xs line-clamp-2 mb-2">{item.description}</p>
                        )}
                        {item.location?.address && (
                          <p className="text-white/30 text-xs flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            {item.location.address}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* CTA para registrar o achado */}
                <div className="bg-teal-500/[0.08] border border-teal-500/20 rounded-2xl p-5 text-center">
                  <h3 className="text-white font-semibold mb-1">É um desses?</h3>
                  <p className="text-white/50 text-sm mb-4">
                    Crie uma conta gratuita para entrar em contato com o dono. O chat é mediado — sua privacidade está protegida.
                  </p>
                  <Link
                    href="/auth/register?intent=found"
                    className="inline-flex items-center gap-2 bg-teal-500 hover:bg-teal-400 text-white font-bold px-6 py-3 rounded-xl transition-all text-sm"
                  >
                    <span>Entrar em contato com o dono</span>
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              </>
            )}
          </>
        )}

      </div>
    </div>
  );
}

export default function AcheiPageWrapper() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#080b0f]" />}>
      <AcheiPage />
    </Suspense>
  );
}
