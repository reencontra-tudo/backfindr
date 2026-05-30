'use client';
// src/app/comunidade/ComunidadeClient.tsx
// Client Component — filtros, paginação e busca interativos
// Recebe posts iniciais do Server Component (já indexados pelo Google)

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { MapPin, Clock, Eye, Heart, Share2, ArrowRight, Search, Tag } from 'lucide-react';

interface Post {
  id: string;
  slug: string;
  title: string;
  subtitle?: string;
  category: string;
  cover_url?: string;
  author_name: string;
  tags: string[];
  featured: boolean;
  views: number;
  likes: number;
  published_at: string;
  reading_time?: number;
}

const CATEGORIES = [
  { key: 'all',       label: 'Tudo',        emoji: '🌐' },
  { key: 'dica',      label: 'Dicas',       emoji: '💡' },
  { key: 'caso',      label: 'Casos Reais', emoji: '📍' },
  { key: 'guia',      label: 'Guias',       emoji: '📖' },
  { key: 'debate',    label: 'Debates',     emoji: '💬' },
  { key: 'novidade',  label: 'Novidades',   emoji: '🚀' },
  { key: 'seguranca', label: 'Segurança',   emoji: '🔒' },
];

const CATEGORY_COLORS: Record<string, string> = {
  dica:      'bg-teal-500/20 text-teal-300 border-teal-500/30',
  caso:      'bg-blue-500/20 text-blue-300 border-blue-500/30',
  guia:      'bg-purple-500/20 text-purple-300 border-purple-500/30',
  debate:    'bg-amber-500/20 text-amber-300 border-amber-500/30',
  novidade:  'bg-green-500/20 text-green-300 border-green-500/30',
  seguranca: 'bg-red-500/20 text-red-300 border-red-500/30',
};

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const d = Math.floor(diff / 86400000);
  if (d === 0) return 'hoje';
  if (d === 1) return 'ontem';
  if (d < 7) return `${d} dias atrás`;
  if (d < 30) return `${Math.floor(d / 7)} sem. atrás`;
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
}

function PostCard({ post, featured = false }: { post: Post; featured?: boolean }) {
  const catColor = CATEGORY_COLORS[post.category] || 'bg-gray-500/20 text-gray-300 border-gray-500/30';
  const catLabel = CATEGORIES.find(c => c.key === post.category);

  return (
    <Link
      href={`/comunidade/${post.slug}`}
      className={`group block rounded-2xl overflow-hidden border border-gray-800 bg-gray-900 hover:border-teal-500/40 transition-all duration-200 hover:shadow-lg hover:shadow-teal-500/5 ${featured ? 'md:col-span-2' : ''}`}
    >
      {post.cover_url && (
        <div className={`overflow-hidden ${featured ? 'h-56' : 'h-40'}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={post.cover_url}
            alt={post.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        </div>
      )}
      <div className="p-5">
        <div className="flex items-center gap-2 mb-3">
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${catColor}`}>
            {catLabel?.emoji} {catLabel?.label || post.category}
          </span>
          {post.featured && (
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-teal-500/20 text-teal-300 border border-teal-500/30">
              ⭐ Destaque
            </span>
          )}
        </div>
        <h2 className={`font-bold text-white mb-2 group-hover:text-teal-400 transition-colors line-clamp-2 ${featured ? 'text-xl' : 'text-base'}`}>
          {post.title}
        </h2>
        {post.subtitle && (
          <p className="text-gray-400 text-sm line-clamp-2 mb-3">{post.subtitle}</p>
        )}
        <div className="flex items-center justify-between text-xs text-gray-500 mt-auto">
          <div className="flex items-center gap-3">
            {post.reading_time && (
              <span className="flex items-center gap-1">
                <Clock size={12} />{post.reading_time} min
              </span>
            )}
            {post.views > 50 && (
              <span className="flex items-center gap-1"><Eye size={12} />{post.views}</span>
            )}
            {post.likes > 3 && (
              <span className="flex items-center gap-1"><Heart size={12} />{post.likes}</span>
            )}
          </div>
          <span>{timeAgo(post.published_at)}</span>
        </div>
      </div>
    </Link>
  );
}

export default function ComunidadeClient({
  initialPosts,
  initialTotal,
}: {
  initialPosts: Post[];
  initialTotal: number;
}) {
  const [posts, setPosts] = useState<Post[]>(initialPosts);
  const [total, setTotal] = useState(initialTotal);
  const [loading, setLoading] = useState(false);
  const [category, setCategory] = useState('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const LIMIT = 12;

  const fetchPosts = useCallback(async () => {
    // Página 0 + sem filtro: usa dados iniciais do SSR (sem nova requisição)
    if (page === 0 && category === 'all') return;

    setLoading(true);
    try {
      const params = new URLSearchParams({
        limit: String(LIMIT),
        offset: String(page * LIMIT),
      });
      if (category !== 'all') params.set('category', category);
      const r = await fetch(`/api/v1/comunidade/posts?${params}`);
      if (r.ok) {
        const d = await r.json() as { posts: Post[]; total: number };
        setPosts(d.posts);
        setTotal(d.total);
      }
    } finally {
      setLoading(false);
    }
  }, [category, page]);

  useEffect(() => { fetchPosts(); }, [fetchPosts]);
  useEffect(() => { setPage(0); }, [category]);

  // Busca client-side nos posts carregados
  const filtered = search
    ? posts.filter(p =>
        p.title.toLowerCase().includes(search.toLowerCase()) ||
        (p.subtitle || '').toLowerCase().includes(search.toLowerCase()) ||
        p.tags.some(t => t.toLowerCase().includes(search.toLowerCase()))
      )
    : posts;

  const featured = filtered.filter(p => p.featured);
  const regular  = filtered.filter(p => !p.featured);

  const handleShare = () => {
    const url = 'https://backfindr.com/comunidade';
    if (navigator.share) {
      navigator.share({ title: 'Comunidade Backfindr', url }).catch(() => {});
    } else {
      navigator.clipboard?.writeText(url);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-950/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icons/logo-backfindr-white.png" alt="Backfindr" className="w-7 h-7" />
            <span className="font-bold text-white">Backfindr</span>
          </Link>
          <nav className="hidden md:flex items-center gap-6 text-sm text-gray-400">
            <Link href="/buscar" className="hover:text-white transition-colors">Buscar</Link>
            <Link href="/perdi"  className="hover:text-white transition-colors">Perdi algo</Link>
            <Link href="/achei"  className="hover:text-white transition-colors">Achei algo</Link>
            <Link href="/comunidade" className="text-teal-400 font-semibold">Comunidade</Link>
          </nav>
          <Link href="/perdi" className="bg-teal-500 hover:bg-teal-400 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors">
            Registrar objeto
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-4 pt-12 pb-8">
        <div className="flex items-start justify-between gap-6 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <MapPin size={18} className="text-teal-400" />
              <span className="text-teal-400 text-sm font-semibold tracking-wide uppercase">Comunidade</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-black mb-3 leading-tight">
              Dicas, casos,<br />guias e ocorrências reais.
            </h1>
            <p className="text-gray-400 text-lg max-w-xl">
              Tudo que você precisa saber sobre objetos perdidos, segurança pessoal e como o Backfindr pode ajudar você e sua comunidade.
            </p>
          </div>
          <button
            onClick={handleShare}
            className="flex items-center gap-2 text-sm text-gray-400 hover:text-white border border-gray-700 hover:border-gray-500 px-4 py-2 rounded-lg transition-colors"
          >
            <Share2 size={14} />
            Compartilhar
          </button>
        </div>
      </section>

      {/* Filtros + Busca */}
      <section className="max-w-6xl mx-auto px-4 pb-6">
        <div className="flex flex-col md:flex-row gap-4 items-start md:items-center">
          <div className="flex gap-2 flex-wrap">
            {CATEGORIES.map(cat => (
              <button
                key={cat.key}
                onClick={() => setCategory(cat.key)}
                className={`text-sm px-3 py-1.5 rounded-full border transition-all ${
                  category === cat.key
                    ? 'bg-teal-500 text-white border-teal-500'
                    : 'border-gray-700 text-gray-400 hover:border-gray-500 hover:text-white'
                }`}
              >
                {cat.emoji} {cat.label}
              </button>
            ))}
          </div>
          <div className="relative ml-auto">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              type="text"
              placeholder="Buscar na comunidade..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="bg-gray-900 border border-gray-700 rounded-lg pl-9 pr-4 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-teal-500 w-64"
            />
          </div>
        </div>
      </section>

      {/* Feed */}
      <main className="max-w-6xl mx-auto px-4 pb-20">
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="rounded-2xl bg-gray-900 border border-gray-800 h-64 animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-gray-500">
            <Tag size={40} className="mx-auto mb-4 opacity-30" />
            <p className="text-lg">Nenhum post encontrado</p>
            <p className="text-sm mt-1">Tente outra categoria ou termo de busca</p>
          </div>
        ) : (
          <>
            {featured.length > 0 && (
              <div className="mb-8">
                <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Em Destaque</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {featured.map(p => <PostCard key={p.id} post={p} featured />)}
                </div>
              </div>
            )}
            {regular.length > 0 && (
              <div>
                {featured.length > 0 && (
                  <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Mais Recentes</h2>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {regular.map(p => <PostCard key={p.id} post={p} />)}
                </div>
              </div>
            )}

            {/* Paginação */}
            {total > LIMIT && (
              <div className="flex items-center justify-center gap-3 mt-10">
                <button
                  disabled={page === 0}
                  onClick={() => setPage(p => p - 1)}
                  className="px-4 py-2 rounded-lg border border-gray-700 text-sm text-gray-400 hover:text-white hover:border-gray-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  Anterior
                </button>
                <span className="text-sm text-gray-500">
                  Página {page + 1} de {Math.ceil(total / LIMIT)}
                </span>
                <button
                  disabled={(page + 1) * LIMIT >= total}
                  onClick={() => setPage(p => p + 1)}
                  className="px-4 py-2 rounded-lg border border-gray-700 text-sm text-gray-400 hover:text-white hover:border-gray-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  Próxima
                </button>
              </div>
            )}
          </>
        )}

        {/* CTA */}
        <div className="mt-16 rounded-2xl bg-gradient-to-r from-teal-900/40 to-blue-900/40 border border-teal-500/20 p-8 text-center">
          <h3 className="text-2xl font-bold mb-2">Perdeu ou achou algo?</h3>
          <p className="text-gray-400 mb-6">O Backfindr conecta quem perdeu com quem achou usando IA e QR Code.</p>
          <div className="flex gap-3 justify-center flex-wrap">
            <Link href="/perdi" className="bg-teal-500 hover:bg-teal-400 text-white font-semibold px-6 py-3 rounded-xl transition-colors flex items-center gap-2">
              Registrar objeto perdido <ArrowRight size={16} />
            </Link>
            <Link href="/achei" className="bg-gray-800 hover:bg-gray-700 text-white font-semibold px-6 py-3 rounded-xl transition-colors">
              Encontrei um objeto
            </Link>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-800 py-8 text-center text-gray-600 text-sm">
        <p>© {new Date().getFullYear()} Backfindr — Plataforma de recuperação de objetos perdidos</p>
        <div className="flex justify-center gap-4 mt-2">
          <Link href="/privacy" className="hover:text-gray-400 transition-colors">Privacidade</Link>
          <Link href="/faq"     className="hover:text-gray-400 transition-colors">FAQ</Link>
        </div>
      </footer>
    </div>
  );
}
