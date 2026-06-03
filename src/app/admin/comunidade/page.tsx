'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Plus, Edit2, Trash2, Eye, Heart, MessageSquare, Globe, FileText,
  Star, RefreshCw, Check, X, ChevronDown, ExternalLink, AlertCircle, StarIcon,
  Tag, Clock, Sparkles, Loader2, Search, ImageIcon,
} from 'lucide-react';

// ─── Tipos ────────────────────────────────────────────────────────────────────
interface Post {
  id: string;
  slug: string;
  title: string;
  category: string;
  status: 'draft' | 'published';
  featured: boolean;
  views: number;
  likes: number;
  pending_comments: number;
  published_at?: string;
  created_at: string;
  updated_at: string;
}

interface Comment {
  id: string;
  name: string;
  body: string;
  status: string;
  featured: boolean;
  created_at: string;
}

interface PostForm {
  slug: string;
  title: string;
  subtitle: string;
  body: string;
  category: string;
  cover_url: string;
  video_url: string;
  author_name: string;
  tags: string;
  status: string;
  featured: boolean;
  seo_title: string;
  seo_desc: string;
  debate_question: string;
}

const EMPTY_FORM: PostForm = {
  slug: '', title: '', subtitle: '', body: '',
  category: 'dica', cover_url: '', video_url: '', author_name: 'Equipe Backfindr',
  tags: '', status: 'draft', featured: false, seo_title: '', seo_desc: '', debate_question: '',
};

const CATEGORIES = [
  { key: 'dica',      label: '💡 Dica' },
  { key: 'caso',      label: '📍 Caso Real' },
  { key: 'guia',      label: '📖 Guia' },
  { key: 'debate',    label: '💬 Debate' },
  { key: 'novidade',  label: '🚀 Novidade' },
  { key: 'seguranca', label: '🔒 Segurança' },
];

const STATUS_COLORS: Record<string, string> = {
  published: 'bg-green-500/20 text-green-300 border-green-500/30',
  draft:     'bg-gray-500/20 text-gray-400 border-gray-500/30',
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
}

function generateSlug(title: string) {
  return title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

// ─── Unsplash Image Picker ────────────────────────────────────────────────────
interface UnsplashPhoto {
  id: string;
  urls: { small: string; regular: string };
  alt_description: string | null;
  user: { name: string };
}

function UnsplashPicker({
  query,
  onSelect,
  onClose,
}: {
  query: string;
  onSelect: (url: string) => void;
  onClose: () => void;
}) {
  const [search, setSearch] = useState(query);
  const [photos, setPhotos] = useState<UnsplashPhoto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searched, setSearched] = useState(false);

  const handleSearch = async (q?: string) => {
    const term = (q ?? search).trim();
    if (!term) return;
    setLoading(true);
    setError('');
    try {
      const r = await fetch(`/api/v1/admin/unsplash?q=${encodeURIComponent(term)}`);
      const data = await r.json() as { photos?: UnsplashPhoto[]; detail?: string };
      if (!r.ok) {
        setError(data.detail || 'Erro ao buscar imagens');
        return;
      }
      setPhotos(data.photos ?? []);
      setSearched(true);
    } catch {
      setError('Erro de conexão');
    } finally {
      setLoading(false);
    }
  };

  // Busca automática com o query inicial
  useEffect(() => {
    if (query) handleSearch(query);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="fixed inset-0 bg-black/80 z-[60] flex items-center justify-center p-4">
      <div className="bg-gray-900 rounded-2xl border border-gray-800 w-full max-w-2xl max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-800 shrink-0">
          <div className="flex items-center gap-2">
            <ImageIcon size={16} className="text-teal-400" />
            <h3 className="font-bold text-white text-sm">Buscar imagem — Unsplash</h3>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Busca */}
        <div className="p-4 border-b border-gray-800 shrink-0">
          <div className="flex gap-2">
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              placeholder="ex: lost wallet, missing dog, keys..."
              className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-teal-500"
            />
            <button
              onClick={() => handleSearch()}
              disabled={loading || !search.trim()}
              className="flex items-center gap-1.5 bg-teal-500 hover:bg-teal-400 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
            >
              {loading ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
              Buscar
            </button>
          </div>
          <p className="text-xs text-gray-600 mt-1.5">Fotos gratuitas via Unsplash. Crédito ao fotógrafo é exibido automaticamente.</p>
        </div>

        {/* Resultados */}
        <div className="overflow-y-auto flex-1 p-4">
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-red-400 text-sm mb-4">
              {error}
            </div>
          )}

          {loading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={24} className="animate-spin text-teal-400" />
            </div>
          )}

          {!loading && searched && photos.length === 0 && (
            <p className="text-gray-500 text-sm text-center py-8">Nenhuma foto encontrada. Tente outro termo.</p>
          )}

          {!loading && photos.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              {photos.map(photo => (
                <button
                  key={photo.id}
                  onClick={() => { onSelect(photo.urls.regular); onClose(); }}
                  className="group relative rounded-lg overflow-hidden aspect-video bg-gray-800 hover:ring-2 hover:ring-teal-500 transition-all"
                  title={`Foto por ${photo.user.name}`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={photo.urls.small}
                    alt={photo.alt_description || 'foto'}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                    <Check size={20} className="text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <p className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[10px] px-1.5 py-0.5 truncate opacity-0 group-hover:opacity-100 transition-opacity">
                    {photo.user.name}
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Modal de Geração com IA ──────────────────────────────────────────────────
function GenerateModal({
  onGenerated,
  onClose,
}: {
  onGenerated: (draft: PostForm) => void;
  onClose: () => void;
}) {
  const [category, setCategory] = useState<string>('dica');
  const [topic, setTopic] = useState('');
  const [useRealCases, setUseRealCases] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleGenerate = async () => {
    setLoading(true);
    setError('');
    try {
      const r = await fetch('/api/v1/admin/comunidade/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category, topic: topic.trim() || undefined, use_real_cases: useRealCases }),
      });
      const data = await r.json() as { draft?: PostForm & { tags: string[] }; detail?: string };
      if (!r.ok) {
        setError(data.detail || 'Erro ao gerar conteúdo');
        return;
      }
      if (!data.draft) {
        setError('Resposta inválida da API');
        return;
      }
      // Converter tags array para string para o formulário
      const draft: PostForm = {
        ...data.draft,
        tags: Array.isArray(data.draft.tags) ? data.draft.tags.join(', ') : '',
      };
      onGenerated(draft);
    } catch {
      setError('Erro de conexão. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
      <div className="bg-gray-900 rounded-2xl border border-gray-800 w-full max-w-lg">
        <div className="flex items-center justify-between p-5 border-b border-gray-800">
          <div className="flex items-center gap-2">
            <Sparkles size={18} className="text-teal-400" />
            <h3 className="font-bold text-white">Gerar post com IA</h3>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="bg-teal-500/10 border border-teal-500/20 rounded-lg p-3 text-sm text-teal-300">
            A IA vai gerar um rascunho completo com título, subtítulo, corpo e SEO. Você revisa antes de publicar.
            Você revisa antes de publicar.
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-400 mb-1.5 uppercase tracking-wide">Categoria *</label>
            <div className="relative">
              <select
                value={category}
                onChange={e => setCategory(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-teal-500 appearance-none"
              >
                {CATEGORIES.map(c => (
                  <option key={c.key} value={c.key}>{c.label}</option>
                ))}
              </select>
              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-400 mb-1.5 uppercase tracking-wide">
              Tema <span className="text-gray-600 normal-case font-normal">(opcional — deixe em branco para IA escolher)</span>
            </label>
            <input
              value={topic}
              onChange={e => setTopic(e.target.value)}
              placeholder={
                category === 'dica' ? 'ex: carteira perdida no metrô de SP' :
                category === 'caso' ? 'ex: celular devolvido após QR Code escaneado' :
                category === 'guia' ? 'ex: como recuperar documentos perdidos' :
                category === 'debate' ? 'ex: você devolveria um objeto com dinheiro dentro?' :
                category === 'novidade' ? 'ex: novo recurso de matching por imagem' :
                'ex: como proteger seus objetos antes de viajar'
              }
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-teal-500"
            />
          </div>

          <label className="flex items-center gap-3 cursor-pointer">
            <div
              onClick={() => setUseRealCases(v => !v)}
              className={`w-10 h-6 rounded-full transition-colors flex items-center px-1 ${useRealCases ? 'bg-teal-500' : 'bg-gray-700'}`}
            >
              <div className={`w-4 h-4 rounded-full bg-white transition-transform ${useRealCases ? 'translate-x-4' : ''}`} />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Usar casos reais da plataforma</p>
              <p className="text-xs text-gray-500">Enriquece o conteúdo com objetos reais cadastrados</p>
            </div>
          </label>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-red-400 text-sm flex items-center gap-2">
              <AlertCircle size={14} /> {error}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between px-5 py-4 border-t border-gray-800">
          <button onClick={onClose} className="text-sm text-gray-500 hover:text-white transition-colors">
            Cancelar
          </button>
          <button
            onClick={handleGenerate}
            disabled={loading}
            className="flex items-center gap-2 bg-teal-500 hover:bg-teal-400 text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Gerando...
              </>
            ) : (
              <>
                <Sparkles size={14} />
                Gerar rascunho
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Formulário de Post ───────────────────────────────────────────────────────
function PostForm({
  initial,
  onSave,
  onCancel,
  loading,
}: {
  initial: PostForm;
  onSave: (form: PostForm) => void;
  onCancel: () => void;
  loading: boolean;
}) {
  const [form, setForm] = useState<PostForm>(initial);
  const [tab, setTab] = useState<'content' | 'seo' | 'settings'>('content');
  const [showUnsplash, setShowUnsplash] = useState(false);

  const set = (k: keyof PostForm, v: string | boolean) =>
    setForm(f => ({ ...f, [k]: v }));

  const handleTitleChange = (v: string) => {
    set('title', v);
    if (!initial.id) set('slug', generateSlug(v));
  };

  return (
    <div className="bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden">
      {/* Tabs */}
      <div className="flex border-b border-gray-800">
        {(['content', 'seo', 'settings'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-5 py-3 text-sm font-medium transition-colors ${
              tab === t ? 'text-teal-400 border-b-2 border-teal-400' : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            {t === 'content' ? '✏️ Conteúdo' : t === 'seo' ? '🔍 SEO' : '⚙️ Configurações'}
          </button>
        ))}
      </div>

      <div className="p-6 space-y-5">
        {tab === 'content' && (
          <>
            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-1.5 uppercase tracking-wide">Título *</label>
              <input
                value={form.title}
                onChange={e => handleTitleChange(e.target.value)}
                placeholder="Título do post..."
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-teal-500 text-lg font-semibold"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-1.5 uppercase tracking-wide">Subtítulo / Resumo</label>
              <input
                value={form.subtitle}
                onChange={e => set('subtitle', e.target.value)}
                placeholder="Breve descrição para aparecer no feed..."
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-teal-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-1.5 uppercase tracking-wide">
                Conteúdo * <span className="text-gray-600 normal-case font-normal">(HTML ou texto simples)</span>
              </label>
              <textarea
                value={form.body}
                onChange={e => set('body', e.target.value)}
                placeholder="Escreva o conteúdo completo do post aqui...&#10;&#10;Você pode usar HTML básico: <h2>, <p>, <strong>, <ul>, <li>, <blockquote>, <a href='...'>"
                rows={16}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-teal-500 font-mono text-sm resize-y"
              />
              <p className="text-xs text-gray-600 mt-1">{form.body.length} caracteres</p>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-1.5 uppercase tracking-wide">URL da Imagem de Capa</label>
              <div className="flex gap-2">
                <input
                  value={form.cover_url}
                  onChange={e => set('cover_url', e.target.value)}
                  placeholder="https://... ou busque no Unsplash →"
                  className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-teal-500"
                />
                <button
                  type="button"
                  onClick={() => setShowUnsplash(true)}
                  className="flex items-center gap-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 hover:border-teal-500/40 text-gray-400 hover:text-teal-400 text-sm px-3 py-2.5 rounded-lg transition-colors shrink-0"
                  title="Buscar foto no Unsplash"
                >
                  <ImageIcon size={15} />
                  Unsplash
                </button>
              </div>
              {form.cover_url && (
                <div className="mt-2 rounded-lg overflow-hidden h-32">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={form.cover_url} alt="preview" className="w-full h-full object-cover" />
                </div>
              )}
              {showUnsplash && (
                <UnsplashPicker
                  query={form.title || ''}
                  onSelect={url => set('cover_url', url)}
                  onClose={() => setShowUnsplash(false)}
                />
              )}
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-1.5 uppercase tracking-wide">
                URL de Vídeo <span className="text-gray-600 normal-case font-normal">(YouTube ou Vimeo — opcional)</span>
              </label>
              <input
                value={form.video_url}
                onChange={e => set('video_url', e.target.value)}
                placeholder="https://www.youtube.com/watch?v=... ou https://vimeo.com/..."
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-teal-500"
              />
              {form.video_url && (
                <p className="text-xs text-teal-400 mt-1">✓ Vídeo será exibido após a imagem de capa no post</p>
              )}
            </div>

            {form.category === 'debate' && (
              <div>
                <label className="block text-xs font-semibold text-gray-400 mb-1.5 uppercase tracking-wide">
                  💭 Pergunta do Debate <span className="text-gray-600 normal-case font-normal">(opcional — aparece em destaque antes dos comentários)</span>
                </label>
                <textarea
                  value={form.debate_question}
                  onChange={e => set('debate_question', e.target.value)}
                  placeholder="Ex: Na sua visão, qual é a principal causa para tantos objetos encontrados nunca voltarem para seus donos?"
                  rows={2}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-teal-500 resize-none"
                />
              </div>
            )}
          </>
        )}

        {tab === 'seo' && (
          <>
            <div className="bg-blue-900/20 border border-blue-700/30 rounded-lg p-4 text-sm text-blue-300">
              <strong>Dica SEO:</strong> O título SEO ideal tem 50–60 caracteres. A descrição ideal tem 120–160 caracteres. Use palavras-chave que as pessoas buscam no Google.
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-1.5 uppercase tracking-wide">
                Título SEO <span className="text-gray-600 normal-case font-normal">({form.seo_title.length}/60)</span>
              </label>
              <input
                value={form.seo_title}
                onChange={e => set('seo_title', e.target.value)}
                placeholder={form.title || 'Título para Google e IA Search...'}
                maxLength={60}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-teal-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-1.5 uppercase tracking-wide">
                Descrição SEO <span className="text-gray-600 normal-case font-normal">({form.seo_desc.length}/160)</span>
              </label>
              <textarea
                value={form.seo_desc}
                onChange={e => set('seo_desc', e.target.value)}
                placeholder={form.subtitle || 'Descrição para aparecer no Google...'}
                maxLength={160}
                rows={3}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-teal-500 resize-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-1.5 uppercase tracking-wide">Tags (separadas por vírgula)</label>
              <input
                value={form.tags}
                onChange={e => set('tags', e.target.value)}
                placeholder="objetos perdidos, carteira, São Paulo..."
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-teal-500"
              />
              <p className="text-xs text-gray-600 mt-1">Tags ajudam na busca interna e no SEO</p>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-1.5 uppercase tracking-wide">Slug (URL)</label>
              <div className="flex items-center gap-2">
                <span className="text-gray-500 text-sm">/comunidade/</span>
                <input
                  value={form.slug}
                  onChange={e => set('slug', e.target.value)}
                  placeholder="meu-post-incrivel"
                  className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-teal-500 font-mono text-sm"
                />
              </div>
            </div>
          </>
        )}

        {tab === 'settings' && (
          <>
            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-1.5 uppercase tracking-wide">Categoria *</label>
              <div className="relative">
                <select
                  value={form.category}
                  onChange={e => set('category', e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-teal-500 appearance-none"
                >
                  {CATEGORIES.map(c => (
                    <option key={c.key} value={c.key}>{c.label}</option>
                  ))}
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-1.5 uppercase tracking-wide">Autor</label>
              <input
                value={form.author_name}
                onChange={e => set('author_name', e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-teal-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-1.5 uppercase tracking-wide">Status</label>
              <div className="flex gap-3">
                {['draft', 'published'].map(s => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => set('status', s)}
                    className={`flex-1 py-2.5 rounded-lg text-sm font-semibold border transition-all ${
                      form.status === s
                        ? s === 'published'
                          ? 'bg-green-500/20 text-green-300 border-green-500/40'
                          : 'bg-gray-700 text-white border-gray-600'
                        : 'bg-gray-800 text-gray-500 border-gray-700 hover:border-gray-600'
                    }`}
                  >
                    {s === 'published' ? '🌐 Publicar' : '📝 Rascunho'}
                  </button>
                ))}
              </div>
            </div>
            <label className="flex items-center gap-3 cursor-pointer">
              <div
                onClick={() => set('featured', !form.featured)}
                className={`w-10 h-6 rounded-full transition-colors flex items-center px-1 ${form.featured ? 'bg-teal-500' : 'bg-gray-700'}`}
              >
                <div className={`w-4 h-4 rounded-full bg-white transition-transform ${form.featured ? 'translate-x-4' : ''}`} />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">Post em Destaque</p>
                <p className="text-xs text-gray-500">Aparece primeiro no feed com destaque visual</p>
              </div>
            </label>
          </>
        )}
      </div>

      {/* Ações */}
      <div className="flex items-center justify-between px-6 py-4 border-t border-gray-800 bg-gray-900/50">
        <button onClick={onCancel} className="text-sm text-gray-500 hover:text-white transition-colors">
          Cancelar
        </button>
        <div className="flex gap-3">
          {form.slug && (
            <a
              href={`/comunidade/${form.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-white border border-gray-700 px-3 py-2 rounded-lg transition-colors"
            >
              <ExternalLink size={13} /> Ver
            </a>
          )}
          <button
            onClick={() => onSave(form)}
            disabled={loading || !form.title || !form.body || !form.slug}
            className="flex items-center gap-2 bg-teal-500 hover:bg-teal-400 text-white text-sm font-semibold px-5 py-2 rounded-lg transition-colors disabled:opacity-50"
          >
            {loading ? <RefreshCw size={14} className="animate-spin" /> : <Check size={14} />}
            {form.status === 'published' ? 'Publicar' : 'Salvar rascunho'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Painel de Comentários ────────────────────────────────────────────────────
function CommentsPanel({ postId, onClose }: { postId: string; onClose: () => void }) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch_ = useCallback(async () => {
    setLoading(true);
    const r = await fetch(`/api/v1/admin/comunidade/${postId}`);
    if (r.ok) {
      const d = await r.json() as { comments: Comment[] };
      setComments(d.comments);
    }
    setLoading(false);
  }, [postId]);

  useEffect(() => { fetch_(); }, [fetch_]);

  const moderate = async (commentId: string, action: string) => {
    await fetch(`/api/v1/admin/comunidade/${postId}/comments`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ comment_id: commentId, action }),
    });
    fetch_();
  };

  const statusColor = (s: string) =>
    s === 'approved' ? 'text-green-400' : s === 'rejected' ? 'text-red-400' : 'text-amber-400';

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
      <div className="bg-gray-900 rounded-2xl border border-gray-800 w-full max-w-2xl max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-gray-800">
          <h3 className="font-bold text-white">Moderar Comentários</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-white"><X size={18} /></button>
        </div>
        <div className="overflow-y-auto flex-1 p-5 space-y-3">
          {loading ? (
            <p className="text-gray-500 text-sm text-center py-8">Carregando...</p>
          ) : comments.length === 0 ? (
            <p className="text-gray-500 text-sm text-center py-8">Nenhum comentário ainda.</p>
          ) : (
            comments.map(c => (
              <div key={c.id} className="bg-gray-800 rounded-xl p-4 border border-gray-700">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-semibold text-white">{c.name}</span>
                      <span className={`text-xs ${statusColor(c.status)}`}>● {c.status}</span>
                      <span className="text-xs text-gray-600">{formatDate(c.created_at)}</span>
                    </div>
                    <p className="text-sm text-gray-300">{c.body}</p>
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    {c.status !== 'approved' && (
                      <button onClick={() => moderate(c.id, 'approve')} className="p-1.5 rounded-lg bg-green-500/10 text-green-400 hover:bg-green-500/20 border border-green-500/20 transition-colors" title="Aprovar">
                        <Check size={13} />
                      </button>
                    )}
                    {c.status !== 'rejected' && (
                      <button onClick={() => moderate(c.id, 'reject')} className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 border border-amber-500/20 transition-colors" title="Rejeitar">
                        <X size={13} />
                      </button>
                    )}
                    <button
                      onClick={() => moderate(c.id, c.featured ? 'unfeature' : 'feature')}
                      className={`p-1.5 rounded-lg border transition-colors ${c.featured ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' : 'bg-gray-700 text-gray-500 hover:text-yellow-400 border-gray-600'}`}
                      title={c.featured ? 'Remover destaque' : 'Destacar comentário'}
                    >
                      <Star size={13} />
                    </button>
                    <button onClick={() => moderate(c.id, 'delete')} className="p-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20 transition-colors" title="Excluir">
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Página Principal ─────────────────────────────────────────────────────────
export default function AdminComunidadePage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [total, setTotal] = useState(0);
  const [pendingComments, setPendingComments] = useState(0);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'list' | 'create' | 'edit'>('list');
  const [editingPost, setEditingPost] = useState<Post | null>(null);
  const [editForm, setEditForm] = useState<PostForm>(EMPTY_FORM);
  const [saveLoading, setSaveLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const [moderatingPostId, setModeratingPostId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [showGenerateModal, setShowGenerateModal] = useState(false);

  const fetchPosts = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: '50' });
      if (statusFilter) params.set('status', statusFilter);
      const r = await fetch(`/api/v1/admin/comunidade?${params}`);
      if (r.ok) {
        const d = await r.json() as { posts: Post[]; total: number; pending_comments: number };
        setPosts(d.posts);
        setTotal(d.total);
        setPendingComments(d.pending_comments);
      }
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => { fetchPosts(); }, [fetchPosts]);

  const handleCreate = () => {
    setEditingPost(null);
    setEditForm(EMPTY_FORM);
    setError('');
    setView('create');
  };

  const handleGenerateAccept = (draft: PostForm) => {
    setShowGenerateModal(false);
    setEditingPost(null);
    setEditForm(draft);
    setError('');
    setView('create');
  };

  const handleEdit = async (post: Post) => {
    setEditingPost(post);
    setError('');
    const r = await fetch(`/api/v1/admin/comunidade/${post.id}`);
    if (r.ok) {
      const d = await r.json() as { post: Record<string, unknown> };
      const p = d.post;
      setEditForm({
        slug: String(p.slug || ''),
        title: String(p.title || ''),
        subtitle: String(p.subtitle || ''),
        body: String(p.body || ''),
        category: String(p.category || 'dica'),
        cover_url: String(p.cover_url || ''),
        video_url: String(p.video_url || ''),
        author_name: String(p.author_name || 'Equipe Backfindr'),
        tags: Array.isArray(p.tags) ? (p.tags as string[]).join(', ') : '',
        status: String(p.status || 'draft'),
        featured: Boolean(p.featured),
        seo_title: String(p.seo_title || ''),
        debate_question: String(p.debate_question || ''),
        seo_desc: String(p.seo_desc || ''),
      });
    }
    setView('edit');
  };

  const handleSave = async (form: PostForm) => {
    setSaveLoading(true);
    setError('');
    try {
      const payload = {
        ...form,
        tags: form.tags ? form.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
      };

      const isEdit = view === 'edit' && editingPost;
      const url = isEdit
        ? `/api/v1/admin/comunidade/${editingPost.id}`
        : '/api/v1/admin/comunidade';
      const method = isEdit ? 'PATCH' : 'POST';

      const r = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!r.ok) {
        const err = await r.json() as { detail?: string };
        setError(err.detail || 'Erro ao salvar post');
        return;
      }

      setView('list');
      fetchPosts();
    } finally {
      setSaveLoading(false);
    }
  };

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`Excluir "${title}"? Esta ação não pode ser desfeita.`)) return;
    await fetch(`/api/v1/admin/comunidade/${id}`, { method: 'DELETE' });
    fetchPosts();
  };

  const toggleStatus = async (post: Post) => {
    const newStatus = post.status === 'published' ? 'draft' : 'published';
    await fetch(`/api/v1/admin/comunidade/${post.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    });
    fetchPosts();
  };

  const toggleFeatured = async (post: Post) => {
    await fetch(`/api/v1/admin/comunidade/${post.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ featured: !post.featured }),
    });
    fetchPosts();
  };

  // ── Formulário (criar/editar) ──
  if (view === 'create' || view === 'edit') {
    return (
      <div className="min-h-screen bg-gray-950 text-white p-4 md:p-8">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center gap-3 mb-6">
            <button onClick={() => setView('list')} className="text-gray-500 hover:text-white transition-colors text-sm">
              ← Voltar
            </button>
            <h1 className="text-xl font-bold text-white">
              {view === 'create' ? 'Novo Post' : `Editar: ${editingPost?.title}`}
            </h1>
          </div>
          {error && (
            <div className="mb-4 bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-red-400 text-sm flex items-center gap-2">
              <AlertCircle size={14} /> {error}
            </div>
          )}
          <PostForm
            initial={editForm}
            onSave={handleSave}
            onCancel={() => setView('list')}
            loading={saveLoading}
          />
        </div>
      </div>
    );
  }

  // ── Lista ──
  const published = posts.filter(p => p.status === 'published').length;
  const drafts = posts.filter(p => p.status === 'draft').length;
  const totalViews = posts.reduce((a, p) => a + p.views, 0);

  return (
    <div className="min-h-screen bg-gray-950 text-white p-4 md:p-8">
      {moderatingPostId && (
        <CommentsPanel postId={moderatingPostId} onClose={() => { setModeratingPostId(null); fetchPosts(); }} />
      )}

      {showGenerateModal && (
        <GenerateModal
          onGenerated={handleGenerateAccept}
          onClose={() => setShowGenerateModal(false)}
        />
      )}

      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-start justify-between mb-8 flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-black text-white">Comunidade</h1>
            <p className="text-gray-500 text-sm mt-1">Dicas, casos, guias e ocorrências reais.</p>
          </div>
          <div className="flex gap-3">
            <button onClick={fetchPosts} className="p-2.5 rounded-lg bg-gray-900 border border-gray-800 text-gray-400 hover:text-white transition-colors">
              <RefreshCw size={16} />
            </button>
            <a href="/comunidade" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-gray-400 hover:text-white border border-gray-700 px-4 py-2.5 rounded-lg transition-colors">
              <ExternalLink size={14} /> Ver página
            </a>
            <button
              onClick={() => setShowGenerateModal(true)}
              className="flex items-center gap-2 bg-purple-600 hover:bg-purple-500 text-white text-sm font-semibold px-4 py-2.5 rounded-lg transition-colors"
            >
              <Sparkles size={16} /> Gerar com IA
            </button>
            <button onClick={handleCreate} className="flex items-center gap-2 bg-teal-500 hover:bg-teal-400 text-white text-sm font-semibold px-4 py-2.5 rounded-lg transition-colors">
              <Plus size={16} /> Novo Post
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Total Posts', value: total, icon: FileText, color: 'text-teal-400' },
            { label: 'Publicados', value: published, icon: Globe, color: 'text-green-400' },
            { label: 'Rascunhos', value: drafts, icon: FileText, color: 'text-gray-400' },
            { label: 'Visualizações', value: totalViews.toLocaleString('pt-BR'), icon: Eye, color: 'text-blue-400' },
          ].map(s => (
            <div key={s.label} className="bg-gray-900 rounded-xl p-4 border border-gray-800">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-gray-500 uppercase tracking-wide">{s.label}</p>
                <s.icon size={16} className={s.color} />
              </div>
              <p className="text-2xl font-bold text-white">{s.value}</p>
            </div>
          ))}
        </div>

        {/* Alerta de comentários pendentes */}
        {pendingComments > 0 && (
          <div className="mb-6 bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 flex items-center gap-3">
            <AlertCircle size={18} className="text-amber-400 shrink-0" />
            <p className="text-sm text-amber-300">
              <strong>{pendingComments} comentário{pendingComments > 1 ? 's' : ''} aguardando moderação.</strong>{' '}
              Clique no ícone de comentário no post para moderar.
            </p>
          </div>
        )}

        {/* Filtros */}
        <div className="flex gap-2 mb-6">
          {[
            { key: '', label: 'Todos' },
            { key: 'published', label: '🌐 Publicados' },
            { key: 'draft', label: '📝 Rascunhos' },
          ].map(f => (
            <button
              key={f.key}
              onClick={() => setStatusFilter(f.key)}
              className={`text-sm px-3 py-1.5 rounded-full border transition-all ${
                statusFilter === f.key
                  ? 'bg-teal-500 text-white border-teal-500'
                  : 'border-gray-700 text-gray-400 hover:border-gray-500 hover:text-white'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Lista de posts */}
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-20 bg-gray-900 rounded-xl border border-gray-800 animate-pulse" />
            ))}
          </div>
        ) : posts.length === 0 ? (
          <div className="text-center py-20 text-gray-500">
            <FileText size={40} className="mx-auto mb-4 opacity-30" />
            <p>Nenhum post ainda.</p>
            <button onClick={handleCreate} className="mt-4 text-teal-400 hover:text-teal-300 text-sm underline">
              Criar o primeiro post
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {posts.map(post => (
              <div key={post.id} className="bg-gray-900 rounded-xl border border-gray-800 hover:border-gray-700 transition-colors">
                <div className="flex items-center gap-4 p-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className={`text-xs px-2 py-0.5 rounded-full border ${STATUS_COLORS[post.status]}`}>
                        {post.status === 'published' ? '🌐 Publicado' : '📝 Rascunho'}
                      </span>
                      {post.featured && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-teal-500/20 text-teal-300 border border-teal-500/30">
                          ⭐ Destaque
                        </span>
                      )}
                      <span className="text-xs text-gray-600">
                        {CATEGORIES.find(c => c.key === post.category)?.label || post.category}
                      </span>
                    </div>
                    <p className="font-semibold text-white truncate">{post.title}</p>
                    <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                      <span className="flex items-center gap-1"><Eye size={11} />{post.views}</span>
                      <span className="flex items-center gap-1"><Heart size={11} />{post.likes}</span>
                      {post.pending_comments > 0 && (
                        <span className="flex items-center gap-1 text-amber-400">
                          <MessageSquare size={11} />{post.pending_comments} pendente{post.pending_comments > 1 ? 's' : ''}
                        </span>
                      )}
                      <span className="flex items-center gap-1"><Clock size={11} />{formatDate(post.created_at)}</span>
                    </div>
                  </div>

                  {/* Ações */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => toggleFeatured(post)}
                      className={`p-2 rounded-lg border transition-colors ${
                        post.featured
                          ? 'bg-teal-500/20 text-teal-400 border-teal-500/30'
                          : 'bg-gray-800 text-gray-500 border-gray-700 hover:text-teal-400'
                      }`}
                      title={post.featured ? 'Remover destaque' : 'Destacar'}
                    >
                      <Star size={14} />
                    </button>
                    <button
                      onClick={() => toggleStatus(post)}
                      className={`p-2 rounded-lg border transition-colors ${
                        post.status === 'published'
                          ? 'bg-green-500/10 text-green-400 border-green-500/20 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/20'
                          : 'bg-gray-800 text-gray-500 border-gray-700 hover:bg-green-500/10 hover:text-green-400 hover:border-green-500/20'
                      }`}
                      title={post.status === 'published' ? 'Despublicar' : 'Publicar'}
                    >
                      <Globe size={14} />
                    </button>
                    <button
                      onClick={() => setModeratingPostId(post.id)}
                      className={`p-2 rounded-lg border transition-colors ${
                        post.pending_comments > 0
                          ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                          : 'bg-gray-800 text-gray-500 border-gray-700 hover:text-white'
                      }`}
                      title="Moderar comentários"
                    >
                      <MessageSquare size={14} />
                    </button>
                    {post.slug && (
                      <a
                        href={`/comunidade/${post.slug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 rounded-lg bg-gray-800 text-gray-500 border border-gray-700 hover:text-white transition-colors"
                        title={post.status === 'published' ? 'Ver post' : 'Pré-visualizar rascunho'}
                      >
                        <Eye size={14} />
                      </a>
                    )}
                    <button
                      onClick={() => handleEdit(post)}
                      className="p-2 rounded-lg bg-gray-800 text-gray-500 border border-gray-700 hover:text-white transition-colors"
                      title="Editar"
                    >
                      <Edit2 size={14} />
                    </button>
                    <button
                      onClick={() => handleDelete(post.id, post.title)}
                      className="p-2 rounded-lg bg-gray-800 text-red-500/60 border border-gray-700 hover:text-red-400 hover:border-red-500/30 transition-colors"
                      title="Excluir"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Dicas SEO */}
        <div className="mt-10 bg-gray-900 rounded-2xl border border-gray-800 p-6">
          <h3 className="font-bold text-white mb-4 flex items-center gap-2">
            <Tag size={16} className="text-teal-400" />
            Guia de Conteúdo para SEO
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            {[
              { emoji: '💡', title: 'Dicas', desc: 'Listas práticas: "5 coisas para fazer se perder a carteira". Ranqueia bem no Google.' },
              { emoji: '📍', title: 'Casos Reais', desc: 'Objetos encontrados com localização. Ótimo para SEO local e TikTok.' },
              { emoji: '📖', title: 'Guias', desc: 'Conteúdo longo e detalhado. Citado por IA Search (ChatGPT, Perplexity).' },
              { emoji: '💬', title: 'Debates', desc: '"Você devolveria?" Gera engajamento, comentários e tempo na página.' },
              { emoji: '🚀', title: 'Novidades', desc: 'Atualizações do Backfindr. Mantém o conteúdo fresco para o Google.' },
              { emoji: '🔒', title: 'Segurança', desc: 'Dicas de proteção. Alto volume de busca e compartilhamento.' },
            ].map(c => (
              <div key={c.title} className="bg-gray-800/50 rounded-lg p-3 border border-gray-700">
                <p className="font-semibold text-white mb-1">{c.emoji} {c.title}</p>
                <p className="text-gray-400 text-xs">{c.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
