'use client';

import { useState, useEffect, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  Plus, Edit2, Trash2, Eye, Heart, MessageSquare, Globe, FileText,
  Star, RefreshCw, Check, X, ChevronDown, ExternalLink, AlertCircle,
  Tag, Clock, Columns, Code, SplitSquareHorizontal,
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
  created_at: string;
}

interface PostForm {
  slug: string;
  title: string;
  subtitle: string;
  body: string;
  category: string;
  cover_url: string;
  author_name: string;
  tags: string;
  status: string;
  featured: boolean;
  seo_title: string;
  seo_desc: string;
}

const EMPTY_FORM: PostForm = {
  slug: '', title: '', subtitle: '', body: '',
  category: 'dica', cover_url: '', author_name: 'Equipe Backfindr',
  tags: '', status: 'draft', featured: false, seo_title: '', seo_desc: '',
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

// ─── Atalhos Markdown (barra de ferramentas) ──────────────────────────────────
const MD_SHORTCUTS = [
  { label: 'H2',    prefix: '## ',        suffix: '',   title: 'Título' },
  { label: 'H3',    prefix: '### ',       suffix: '',   title: 'Subtítulo' },
  { label: 'B',     prefix: '**',         suffix: '**', title: 'Negrito', bold: true },
  { label: 'I',     prefix: '_',          suffix: '_',  title: 'Itálico', italic: true },
  { label: '—',     prefix: '> ',         suffix: '',   title: 'Citação' },
  { label: '• ',    prefix: '- ',         suffix: '',   title: 'Lista' },
  { label: '1.',    prefix: '1. ',        suffix: '',   title: 'Lista numerada' },
  { label: '``,   prefix: '`',           suffix: '`',  title: 'Código inline' },
  { label: '---',   prefix: '\n---\n',    suffix: '',   title: 'Separador' },
];

function insertMarkdown(
  textarea: HTMLTextAreaElement,
  prefix: string,
  suffix: string,
  onChange: (v: string) => void,
) {
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const value = textarea.value;
  const selected = value.substring(start, end);
  const newValue = value.substring(0, start) + prefix + selected + suffix + value.substring(end);
  onChange(newValue);
  setTimeout(() => {
    textarea.focus();
    const newPos = start + prefix.length + selected.length + suffix.length;
    textarea.setSelectionRange(newPos, newPos);
  }, 0);
}

// ─── Preview Markdown (mesmo componente do PostClient) ────────────────────────
const markdownComponents = {
  h1: ({ children }: React.PropsWithChildren) => (
    <h1 className="text-2xl font-black text-white mt-6 mb-3">{children}</h1>
  ),
  h2: ({ children }: React.PropsWithChildren) => (
    <h2 className="text-xl font-bold text-white mt-6 mb-2 pb-1 border-b border-gray-700">{children}</h2>
  ),
  h3: ({ children }: React.PropsWithChildren) => (
    <h3 className="text-lg font-bold text-white mt-4 mb-2">{children}</h3>
  ),
  p: ({ children }: React.PropsWithChildren) => (
    <p className="text-gray-300 leading-relaxed mb-3 text-sm">{children}</p>
  ),
  a: ({ href, children }: React.PropsWithChildren<{ href?: string }>) => (
    <a href={href} className="text-teal-400 hover:underline">{children}</a>
  ),
  strong: ({ children }: React.PropsWithChildren) => (
    <strong className="font-bold text-white">{children}</strong>
  ),
  em: ({ children }: React.PropsWithChildren) => (
    <em className="italic text-gray-200">{children}</em>
  ),
  ul: ({ children }: React.PropsWithChildren) => (
    <ul className="list-disc list-inside space-y-1 text-gray-300 mb-3 pl-3 text-sm">{children}</ul>
  ),
  ol: ({ children }: React.PropsWithChildren) => (
    <ol className="list-decimal list-inside space-y-1 text-gray-300 mb-3 pl-3 text-sm">{children}</ol>
  ),
  li: ({ children }: React.PropsWithChildren) => (
    <li className="text-gray-300 marker:text-teal-400">{children}</li>
  ),
  blockquote: ({ children }: React.PropsWithChildren) => (
    <blockquote className="border-l-4 border-teal-500 pl-3 my-3 text-gray-400 italic text-sm">{children}</blockquote>
  ),
  code: ({ inline, children }: React.PropsWithChildren<{ inline?: boolean }>) =>
    inline ? (
      <code className="bg-gray-800 text-teal-300 px-1 py-0.5 rounded text-xs font-mono">{children}</code>
    ) : (
      <pre className="bg-gray-900 border border-gray-700 rounded-lg p-3 overflow-x-auto my-3">
        <code className="text-teal-300 text-xs font-mono">{children}</code>
      </pre>
    ),
  hr: () => <hr className="border-gray-700 my-5" />,
};

// ─── Editor Markdown com Preview ─────────────────────────────────────────────
function MarkdownEditor({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const [mode, setMode] = useState<'write' | 'preview' | 'split'>('write');
  const textareaRef = { current: null as HTMLTextAreaElement | null };

  const handleShortcut = (prefix: string, suffix: string) => {
    if (!textareaRef.current) return;
    insertMarkdown(textareaRef.current, prefix, suffix, onChange);
  };

  return (
    <div className="border border-gray-700 rounded-xl overflow-hidden bg-gray-900">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-2 bg-gray-800/60 border-b border-gray-700">
        {/* Atalhos de formatação */}
        <div className="flex items-center gap-0.5 flex-wrap">
          {MD_SHORTCUTS.map(s => (
            <button
              key={s.label}
              type="button"
              onClick={() => handleShortcut(s.prefix, s.suffix)}
              title={s.title}
              className={`px-2 py-1 text-xs rounded hover:bg-gray-700 text-gray-400 hover:text-white transition-colors font-mono ${
                s.bold ? 'font-bold' : s.italic ? 'italic' : ''
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
        {/* Modo de visualização */}
        <div className="flex items-center gap-1 ml-2 shrink-0">
          <button
            type="button"
            onClick={() => setMode('write')}
            title="Só editor"
            className={`p-1.5 rounded transition-colors ${mode === 'write' ? 'bg-teal-500/20 text-teal-400' : 'text-gray-500 hover:text-white'}`}
          >
            <Code size={13} />
          </button>
          <button
            type="button"
            onClick={() => setMode('split')}
            title="Editor + preview"
            className={`p-1.5 rounded transition-colors ${mode === 'split' ? 'bg-teal-500/20 text-teal-400' : 'text-gray-500 hover:text-white'}`}
          >
            <SplitSquareHorizontal size={13} />
          </button>
          <button
            type="button"
            onClick={() => setMode('preview')}
            title="Só preview"
            className={`p-1.5 rounded transition-colors ${mode === 'preview' ? 'bg-teal-500/20 text-teal-400' : 'text-gray-500 hover:text-white'}`}
          >
            <Eye size={13} />
          </button>
        </div>
      </div>

      {/* Corpo do editor */}
      <div className={`flex ${mode === 'split' ? 'divide-x divide-gray-700' : ''}`} style={{ minHeight: 360 }}>
        {/* Textarea */}
        {(mode === 'write' || mode === 'split') && (
          <textarea
            ref={el => { textareaRef.current = el; }}
            value={value}
            onChange={e => onChange(e.target.value)}
            placeholder={`Escreva em Markdown:\n\n## Introdução\n\nTexto do parágrafo...\n\n## Dica importante\n\n- Item da lista\n- Outro item\n\n> Citação ou destaque importante`}
            className={`bg-transparent text-white placeholder-gray-600 text-sm font-mono px-4 py-3 resize-none focus:outline-none leading-relaxed ${
              mode === 'split' ? 'w-1/2' : 'w-full'
            }`}
            style={{ minHeight: 360 }}
            spellCheck={false}
          />
        )}

        {/* Preview */}
        {(mode === 'preview' || mode === 'split') && (
          <div className={`overflow-y-auto px-5 py-4 ${mode === 'split' ? 'w-1/2' : 'w-full'}`} style={{ minHeight: 360 }}>
            {value.trim() ? (
              <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                {value}
              </ReactMarkdown>
            ) : (
              <p className="text-gray-600 text-sm italic">O preview aparece aqui enquanto você escreve.</p>
            )}
          </div>
        )}
      </div>

      {/* Rodapé com contagem e dica */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-gray-800/40 border-t border-gray-700">
        <span className="text-xs text-gray-600">Markdown suportado — negrito, listas, títulos, citações, código</span>
        <span className="text-xs text-gray-600">{value.length} chars</span>
      </div>
    </div>
  );
}

// ─── Formulário de Post ───────────────────────────────────────────────────────
function PostFormComponent({
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

  const set = (k: keyof PostForm, v: string | boolean) =>
    setForm(f => ({ ...f, [k]: v }));

  const handleTitleChange = (v: string) => {
    set('title', v);
    if (!(initial as PostForm & { id?: string }).id) set('slug', generateSlug(v));
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
                Conteúdo *
                <span className="text-gray-600 normal-case font-normal ml-1">— use Markdown para formatar</span>
              </label>
              <MarkdownEditor value={form.body} onChange={v => set('body', v)} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-1.5 uppercase tracking-wide">URL da Imagem de Capa</label>
              <input
                value={form.cover_url}
                onChange={e => set('cover_url', e.target.value)}
                placeholder="https://..."
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-teal-500"
              />
              {form.cover_url && (
                <div className="mt-2 rounded-lg overflow-hidden h-32">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={form.cover_url} alt="preview" className="w-full h-full object-cover" />
                </div>
              )}
            </div>
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
          {form.status === 'published' && form.slug && (
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
        author_name: String(p.author_name || 'Equipe Backfindr'),
        tags: Array.isArray(p.tags) ? (p.tags as string[]).join(', ') : '',
        status: String(p.status || 'draft'),
        featured: Boolean(p.featured),
        seo_title: String(p.seo_title || ''),
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
        <div className="max-w-4xl mx-auto">
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
          <PostFormComponent
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
                    {post.status === 'published' && (
                      <a
                        href={`/comunidade/${post.slug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 rounded-lg bg-gray-800 text-gray-500 border border-gray-700 hover:text-white transition-colors"
                        title="Ver post"
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
