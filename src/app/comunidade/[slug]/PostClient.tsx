'use client';

import { useState } from 'react';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  MapPin, Clock, Eye, Heart, Share2, ArrowLeft, Tag,
  MessageSquare, Send, Copy, Check, Twitter, Facebook,
} from 'lucide-react';

// ─── Tipos ────────────────────────────────────────────────────────────────────
interface Post {
  id: string;
  slug: string;
  title: string;
  subtitle?: string;
  body: string;
  category: string;
  cover_url?: string;
  author_name: string;
  author_avatar?: string;
  tags: string[];
  featured: boolean;
  views: number;
  likes: number;
  published_at: string;
}

interface Comment {
  id: string;
  name: string;
  body: string;
  created_at: string;
}

interface RelatedPost {
  id: string;
  slug: string;
  title: string;
  subtitle?: string;
  category: string;
  cover_url?: string;
  published_at: string;
  views: number;
  likes: number;
}

const CATEGORY_COLORS: Record<string, string> = {
  dica:      'bg-teal-500/20 text-teal-300 border-teal-500/30',
  caso:      'bg-blue-500/20 text-blue-300 border-blue-500/30',
  guia:      'bg-purple-500/20 text-purple-300 border-purple-500/30',
  debate:    'bg-amber-500/20 text-amber-300 border-amber-500/30',
  novidade:  'bg-green-500/20 text-green-300 border-green-500/30',
  seguranca: 'bg-red-500/20 text-red-300 border-red-500/30',
};

const CATEGORY_LABELS: Record<string, string> = {
  dica: '💡 Dica', caso: '📍 Caso Real', guia: '📖 Guia',
  debate: '💬 Debate', novidade: '🚀 Novidade', seguranca: '🔒 Segurança',
};

// Calcula tempo de leitura estimado (200 palavras/min)
function readingTime(text: string): number {
  const words = text.replace(/<[^>]+>/g, '').trim().split(/\s+/).length;
  return Math.max(1, Math.round(words / 200));
}

function formatDate(iso: string | null | undefined) {
  if (!iso) return '-';
  const _d = new Date(iso); if (isNaN(_d.getTime())) return '-';
  return _d.toLocaleDateString('pt-BR', {
    day: '2-digit', month: 'long', year: 'numeric',
  });
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const d = Math.floor(diff / 86400000);
  if (d === 0) return 'hoje';
  if (d === 1) return 'ontem';
  if (d < 7) return `${d} dias atrás`;
  return formatDate(iso);
}

// ─── Componentes de renderização Markdown ────────────────────────────────────
// Mapeados para classes Tailwind compatíveis com o tema dark do Backfindr.
const markdownComponents = {
  h1: ({ children }: React.PropsWithChildren) => (
    <h1 className="text-3xl font-black text-white mt-8 mb-4 leading-tight">{children}</h1>
  ),
  h2: ({ children }: React.PropsWithChildren) => (
    <h2 className="text-2xl font-bold text-white mt-8 mb-3 leading-tight">{children}</h2>
  ),
  h3: ({ children }: React.PropsWithChildren) => (
    <h3 className="text-xl font-bold text-white mt-6 mb-2">{children}</h3>
  ),
  h4: ({ children }: React.PropsWithChildren) => (
    <h4 className="text-lg font-semibold text-white mt-4 mb-2">{children}</h4>
  ),
  p: ({ children }: React.PropsWithChildren) => (
    <p className="text-gray-300 leading-relaxed mb-4">{children}</p>
  ),
  a: ({ href, children }: React.PropsWithChildren<{ href?: string }>) => (
    <a
      href={href}
      target={href?.startsWith('http') ? '_blank' : undefined}
      rel={href?.startsWith('http') ? 'noopener noreferrer' : undefined}
      className="text-teal-400 hover:underline"
    >
      {children}
    </a>
  ),
  strong: ({ children }: React.PropsWithChildren) => (
    <strong className="font-bold text-white">{children}</strong>
  ),
  em: ({ children }: React.PropsWithChildren) => (
    <em className="italic text-gray-200">{children}</em>
  ),
  ul: ({ children }: React.PropsWithChildren) => (
    <ul className="list-disc list-inside space-y-1 text-gray-300 mb-4 pl-4">{children}</ul>
  ),
  ol: ({ children }: React.PropsWithChildren) => (
    <ol className="list-decimal list-inside space-y-1 text-gray-300 mb-4 pl-4">{children}</ol>
  ),
  li: ({ children }: React.PropsWithChildren) => (
    <li className="text-gray-300 leading-relaxed marker:text-teal-400">{children}</li>
  ),
  blockquote: ({ children }: React.PropsWithChildren) => (
    <blockquote className="border-l-4 border-teal-500 pl-4 my-4 text-gray-400 italic">
      {children}
    </blockquote>
  ),
  code: ({ inline, children }: React.PropsWithChildren<{ inline?: boolean }>) =>
    inline ? (
      <code className="bg-gray-800 text-teal-300 px-1.5 py-0.5 rounded text-sm font-mono">
        {children}
      </code>
    ) : (
      <pre className="bg-gray-900 border border-gray-700 rounded-xl p-4 overflow-x-auto my-4">
        <code className="text-teal-300 text-sm font-mono">{children}</code>
      </pre>
    ),
  hr: () => <hr className="border-gray-800 my-8" />,
  img: ({ src, alt }: React.ImgHTMLAttributes<HTMLImageElement>) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt ?? ''}
      className="rounded-xl w-full my-6 object-cover"
    />
  ),
  table: ({ children }: React.PropsWithChildren) => (
    <div className="overflow-x-auto my-6">
      <table className="w-full text-sm text-gray-300 border border-gray-700 rounded-xl overflow-hidden">
        {children}
      </table>
    </div>
  ),
  thead: ({ children }: React.PropsWithChildren) => (
    <thead className="bg-gray-800 text-white">{children}</thead>
  ),
  tbody: ({ children }: React.PropsWithChildren) => (
    <tbody className="divide-y divide-gray-800">{children}</tbody>
  ),
  tr: ({ children }: React.PropsWithChildren) => (
    <tr className="hover:bg-gray-800/50 transition-colors">{children}</tr>
  ),
  th: ({ children }: React.PropsWithChildren) => (
    <th className="px-4 py-2 text-left font-semibold">{children}</th>
  ),
  td: ({ children }: React.PropsWithChildren) => (
    <td className="px-4 py-2">{children}</td>
  ),
};

// ─── Componente Principal ─────────────────────────────────────────────────────
export default function PostClient({
  initialPost,
  initialComments,
  related,
  slug,
}: {
  initialPost: Record<string, unknown>;
  initialComments: Record<string, unknown>[];
  related: Record<string, unknown>[];
  slug: string;
}) {
  const post = initialPost as unknown as Post;
  const comments = initialComments as unknown as Comment[];
  const relatedPosts = related as unknown as RelatedPost[];

  const [likes, setLikes] = useState(post.likes);
  const [liked, setLiked] = useState(false);
  const [copied, setCopied] = useState(false);
  const [commentName, setCommentName] = useState('');
  const [commentBody, setCommentBody] = useState('');
  const [commentSent, setCommentSent] = useState(false);
  const [commentLoading, setCommentLoading] = useState(false);
  const [localComments, setLocalComments] = useState<Comment[]>(comments);

  const pageUrl = `https://backfindr.com/comunidade/${slug}`;
  const catColor = CATEGORY_COLORS[post.category] || 'bg-gray-500/20 text-gray-300 border-gray-500/30';
  const catLabel = CATEGORY_LABELS[post.category] || post.category;

  const handleLike = async () => {
    if (liked) return;
    setLiked(true);
    setLikes(l => l + 1);
    await fetch(`/api/v1/comunidade/posts/${slug}/like`, { method: 'POST' }).catch(() => {});
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(pageUrl).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async (platform?: string) => {
    if (platform === 'twitter') {
      window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(post.title)}&url=${encodeURIComponent(pageUrl)}`, '_blank');
    } else if (platform === 'facebook') {
      window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(pageUrl)}`, '_blank');
    } else if (platform === 'whatsapp') {
      window.open(`https://wa.me/?text=${encodeURIComponent(`${post.title} — ${pageUrl}`)}`, '_blank');
    } else {
      try {
        await navigator.share({ title: post.title, url: pageUrl });
      } catch {
        handleCopy();
      }
    }
  };

  const handleComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentName.trim() || !commentBody.trim()) return;
    setCommentLoading(true);
    try {
      const r = await fetch(`/api/v1/comunidade/posts/${slug}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: commentName, body: commentBody }),
      });
      if (r.ok) {
        setCommentSent(true);
        setCommentName('');
        setCommentBody('');
      }
    } finally {
      setCommentLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* ── Header ── */}
      <header className="border-b border-gray-800 bg-gray-950/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/comunidade" className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors text-sm">
            <ArrowLeft size={16} />
            Comunidade
          </Link>
          <Link href="/" className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icons/logo-backfindr-white.png" alt="Backfindr" className="w-6 h-6" />
            <span className="font-bold text-white text-sm">Backfindr</span>
          </Link>
          <button
            onClick={() => handleShare()}
            className="flex items-center gap-2 text-sm text-gray-400 hover:text-white border border-gray-700 hover:border-gray-500 px-3 py-1.5 rounded-lg transition-colors"
          >
            <Share2 size={14} />
            Compartilhar
          </button>
        </div>
      </header>

      <article className="max-w-4xl mx-auto px-4 py-10">
        {/* ── Meta ── */}
        <div className="flex items-center gap-3 mb-6 flex-wrap">
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${catColor}`}>
            {catLabel}
          </span>
          <span className="text-gray-500 text-sm flex items-center gap-1">
            <Clock size={13} /> {formatDate(post.published_at)}
          </span>
          <span className="text-gray-500 text-sm flex items-center gap-1">
            <Clock size={13} /> {readingTime(post.body)} min de leitura
          </span>
          {(post.views + 1) > 50 && (
            <span className="text-gray-500 text-sm flex items-center gap-1">
              <Eye size={13} /> {post.views + 1} visualizações
            </span>
          )}
        </div>

        {/* ── Título ── */}
        <h1 className="text-3xl md:text-4xl font-black leading-tight mb-4">{post.title}</h1>
        {post.subtitle && (
          <p className="text-xl text-gray-400 mb-8 leading-relaxed">{post.subtitle}</p>
        )}

        {/* ── Autor ── */}
        <div className="flex items-center gap-3 mb-8 pb-8 border-b border-gray-800">
          <div className="w-10 h-10 rounded-full bg-teal-500/20 border border-teal-500/30 flex items-center justify-center text-teal-400 font-bold text-sm">
            {post.author_name.charAt(0)}
          </div>
          <div>
            <p className="text-sm font-semibold text-white">{post.author_name}</p>
            <p className="text-xs text-gray-500">Equipe Backfindr · {timeAgo(post.published_at)}</p>
          </div>
        </div>

        {/* ── Imagem de capa ── */}
        {post.cover_url && (
          <div className="rounded-2xl overflow-hidden mb-10">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={post.cover_url} alt={post.title} className="w-full max-h-96 object-cover" />
          </div>
        )}

        {/* ── Conteúdo — Markdown renderizado ── */}
        <div className="min-w-0">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={markdownComponents}
          >
            {post.body}
          </ReactMarkdown>
        </div>

        {/* ── Tags ── */}
        {post.tags?.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-10 pt-8 border-t border-gray-800">
            <Tag size={14} className="text-gray-500 mt-0.5" />
            {post.tags.map(tag => (
              <Link
                key={tag}
                href={`/comunidade?search=${encodeURIComponent(tag)}`}
                className="text-xs px-2.5 py-1 rounded-full bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white border border-gray-700 transition-colors"
              >
                #{tag}
              </Link>
            ))}
          </div>
        )}

        {/* ── Curtir + Compartilhar ── */}
        <div className="flex items-center justify-between mt-10 pt-8 border-t border-gray-800 flex-wrap gap-4">
          <button
            onClick={handleLike}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm transition-all ${
              liked
                ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                : 'bg-gray-800 text-gray-400 border border-gray-700 hover:border-red-500/40 hover:text-red-400'
            }`}
          >
            <Heart size={16} className={liked ? 'fill-current' : ''} />
            {likes > 3 ? `${likes} ${likes === 1 ? 'curtida' : 'curtidas'}` : 'Curtir'}
          </button>

          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">Compartilhar:</span>
            <button onClick={() => handleShare('whatsapp')} className="p-2 rounded-lg bg-green-500/10 text-green-400 hover:bg-green-500/20 border border-green-500/20 transition-colors" title="WhatsApp">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
            </button>
            <button onClick={() => handleShare('twitter')} className="p-2 rounded-lg bg-gray-800 text-gray-400 hover:bg-gray-700 border border-gray-700 transition-colors" title="Twitter/X">
              <Twitter size={16} />
            </button>
            <button onClick={() => handleShare('facebook')} className="p-2 rounded-lg bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 border border-blue-500/20 transition-colors" title="Facebook">
              <Facebook size={16} />
            </button>
            <button onClick={handleCopy} className="p-2 rounded-lg bg-gray-800 text-gray-400 hover:bg-gray-700 border border-gray-700 transition-colors" title="Copiar link">
              {copied ? <Check size={16} className="text-green-400" /> : <Copy size={16} />}
            </button>
          </div>
        </div>

        {/* ── CTA ── */}
        <div className="mt-10 rounded-2xl bg-gradient-to-r from-teal-900/40 to-blue-900/40 border border-teal-500/20 p-6">
          <div className="flex items-start gap-4 flex-wrap">
            <div className="flex-1">
              <h3 className="font-bold text-lg mb-1">Perdeu ou achou algo?</h3>
              <p className="text-gray-400 text-sm">O Backfindr conecta quem perdeu com quem achou usando IA e QR Code. Grátis para começar.</p>
            </div>
            <div className="flex gap-2 flex-wrap">
              <Link href="/perdi" className="bg-teal-500 hover:bg-teal-400 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors">
                Registrar objeto
              </Link>
              <Link href="/achei" className="bg-gray-800 hover:bg-gray-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors">
                Achei algo
              </Link>
            </div>
          </div>
        </div>

        {/* ── Comentários ── */}
        <section className="mt-12">
          <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
            <MessageSquare size={20} className="text-teal-400" />
            {post.category === 'debate' ? 'Participe da Discussão' : `Comentários (${localComments.length})`}
          </h2>

          {localComments.length > 0 ? (
            <div className="space-y-4 mb-8">
              {localComments.map(c => (
                <div key={c.id} className="bg-gray-900 rounded-xl p-4 border border-gray-800">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 rounded-full bg-teal-500/20 flex items-center justify-center text-teal-400 text-xs font-bold">
                      {c.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white">{c.name}</p>
                      <p className="text-xs text-gray-500">{timeAgo(c.created_at)}</p>
                    </div>
                  </div>
                  <p className="text-gray-300 text-sm leading-relaxed">{c.body}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-sm mb-8">Seja o primeiro a comentar.</p>
          )}

          {commentSent ? (
            <div className="bg-teal-500/10 border border-teal-500/30 rounded-xl p-4 text-teal-300 text-sm">
              ✅ Comentário enviado! Ele aparecerá após moderação.
            </div>
          ) : (
            <form onSubmit={handleComment} className="bg-gray-900 rounded-xl p-5 border border-gray-800 space-y-4">
              <h3 className="font-semibold text-gray-200 text-sm">Deixe seu comentário</h3>
              <input
                type="text"
                placeholder="Seu nome"
                value={commentName}
                onChange={e => setCommentName(e.target.value)}
                maxLength={100}
                required
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-teal-500"
              />
              <textarea
                placeholder="Escreva seu comentário..."
                value={commentBody}
                onChange={e => setCommentBody(e.target.value)}
                maxLength={2000}
                required
                rows={4}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-teal-500 resize-none"
              />
              <div className="flex items-center justify-between">
                <p className="text-xs text-gray-500">Comentários passam por moderação antes de aparecer.</p>
                <button
                  type="submit"
                  disabled={commentLoading}
                  className="flex items-center gap-2 bg-teal-500 hover:bg-teal-400 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
                >
                  <Send size={14} />
                  {commentLoading ? 'Enviando...' : 'Enviar'}
                </button>
              </div>
            </form>
          )}
        </section>

        {/* ── Posts Relacionados ── */}
        {relatedPosts.length > 0 && (
          <section className="mt-14">
            <h2 className="text-xl font-bold mb-6">Leia também</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {relatedPosts.map(r => (
                <Link
                  key={r.id}
                  href={`/comunidade/${r.slug}`}
                  className="group block bg-gray-900 rounded-xl border border-gray-800 hover:border-teal-500/40 p-4 transition-all"
                >
                  {r.cover_url && (
                    <div className="rounded-lg overflow-hidden mb-3 h-28">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={r.cover_url} alt={r.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                    </div>
                  )}
                  <p className="text-sm font-semibold text-white group-hover:text-teal-400 transition-colors line-clamp-2">{r.title}</p>
                  <p className="text-xs text-gray-500 mt-1 flex items-center gap-2">
                    {r.views > 0 && <><Eye size={11} />{r.views} · </>}<Clock size={11} />{timeAgo(r.published_at)}
                  </p>
                </Link>
              ))}
            </div>
          </section>
        )}
      </article>

      {/* ── Footer ── */}
      <footer className="border-t border-gray-800 py-8 text-center text-gray-600 text-sm mt-10">
        <p>© {new Date().getFullYear()} Backfindr — Plataforma de recuperação de objetos perdidos</p>
        <div className="flex justify-center gap-4 mt-2">
          <Link href="/privacy" className="hover:text-gray-400 transition-colors">Privacidade</Link>
          <Link href="/faq" className="hover:text-gray-400 transition-colors">FAQ</Link>
          <Link href="/comunidade" className="hover:text-gray-400 transition-colors">Comunidade</Link>
        </div>
      </footer>
    </div>
  );
}
