'use client';
export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback } from 'react';
import {
  Send, Settings2, RefreshCw, CheckCircle2, XCircle,
  Clock, SkipForward, AlertTriangle, Megaphone, MessageCircle,
  ExternalLink, Play, RotateCcw, ChevronDown, ChevronUp,
} from 'lucide-react';

// ─── Tipos ────────────────────────────────────────────────────────────────────
interface SocialPost {
  id: string;
  channel: string;
  status: string;
  post_text: string;
  post_url: string;
  image_url: string | null;
  sent_at: string | null;
  error_message: string | null;
  retry_count: number;
  scheduled_for: string;
  created_at: string;
  object_id: string;
  object_title: string;
  object_status: string;
  object_category: string;
  qr_code: string;
}

interface SocialSetting {
  key: string;
  value: string;
  description: string;
}

interface Stats {
  pending?: number;
  sent?: number;
  failed?: number;
  skipped?: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  pending:  { label: 'Pendente',  color: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20', icon: Clock },
  sent:     { label: 'Enviado',   color: 'text-green-400 bg-green-400/10 border-green-400/20',   icon: CheckCircle2 },
  failed:   { label: 'Falhou',    color: 'text-red-400 bg-red-400/10 border-red-400/20',         icon: XCircle },
  skipped:  { label: 'Ignorado',  color: 'text-zinc-400 bg-zinc-400/10 border-zinc-400/20',      icon: SkipForward },
};

const CHANNEL_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  telegram:      { label: 'Telegram',   color: 'text-sky-400',    icon: MessageCircle },
  whatsapp_link: { label: 'WhatsApp',   color: 'text-green-400',  icon: MessageCircle },
  twitter:       { label: 'X (Twitter)', color: 'text-zinc-300',  icon: Megaphone },
  facebook:      { label: 'Facebook',   color: 'text-blue-400',   icon: Megaphone },
};

function getToken() {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('token') ?? '';
}

function fmtDate(d: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function SocialPostsPage() {
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [stats, setStats] = useState<Stats>({});
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterChannel, setFilterChannel] = useState('');
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [tab, setTab] = useState<'posts' | 'settings'>('posts');

  // Settings
  const [settings, setSettings] = useState<SocialSetting[]>([]);
  const [settingsEdits, setSettingsEdits] = useState<Record<string, string>>({});
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsMsg, setSettingsMsg] = useState('');

  // Expandir texto do post
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchPosts = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), size: '20' });
      if (filterStatus) params.set('status', filterStatus);
      if (filterChannel) params.set('channel', filterChannel);
      const res = await fetch(`/api/v1/admin/social/posts?${params}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = await res.json();
      setPosts(data.items ?? []);
      setStats(data.stats ?? {});
      setTotal(data.total ?? 0);
      setPages(data.pages ?? 1);
    } catch { /* silencioso */ }
    setLoading(false);
  }, [page, filterStatus, filterChannel]);

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/admin/social/settings', {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = await res.json();
      setSettings(data.settings ?? []);
    } catch { /* silencioso */ }
  }, []);

  useEffect(() => { fetchPosts(); }, [fetchPosts]);
  useEffect(() => { if (tab === 'settings') fetchSettings(); }, [tab, fetchSettings]);

  async function processQueue() {
    setProcessing(true);
    try {
      await fetch('/api/v1/admin/social/posts', {
        method: 'POST',
        headers: { Authorization: `Bearer ${getToken()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'process_queue' }),
      });
      await fetchPosts();
    } catch { /* silencioso */ }
    setProcessing(false);
  }

  async function retryAllFailed() {
    setProcessing(true);
    try {
      await fetch('/api/v1/admin/social/posts', {
        method: 'POST',
        headers: { Authorization: `Bearer ${getToken()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'retry_all_failed' }),
      });
      await fetchPosts();
    } catch { /* silencioso */ }
    setProcessing(false);
  }

  async function postAction(postId: string, action: 'retry' | 'skip') {
    try {
      await fetch('/api/v1/admin/social/posts', {
        method: 'POST',
        headers: { Authorization: `Bearer ${getToken()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, post_id: postId }),
      });
      await fetchPosts();
    } catch { /* silencioso */ }
  }

  async function saveSettings() {
    setSavingSettings(true);
    setSettingsMsg('');
    try {
      const res = await fetch('/api/v1/admin/social/settings', {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${getToken()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates: settingsEdits }),
      });
      if (res.ok) {
        setSettingsMsg('Configurações salvas com sucesso.');
        setSettingsEdits({});
        await fetchSettings();
      } else {
        setSettingsMsg('Erro ao salvar configurações.');
      }
    } catch { setSettingsMsg('Erro de conexão.'); }
    setSavingSettings(false);
  }

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Send className="w-6 h-6 text-teal-400" />
            Automação Social
          </h1>
          <p className="text-zinc-400 text-sm mt-0.5">
            Publicações automáticas ao cadastrar objetos
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={fetchPosts}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm transition"
          >
            <RefreshCw className="w-4 h-4" />
            Atualizar
          </button>
          <button
            onClick={processQueue}
            disabled={processing}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-sm font-medium transition disabled:opacity-50"
          >
            <Play className="w-4 h-4" />
            {processing ? 'Processando...' : 'Processar fila'}
          </button>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { key: 'pending', label: 'Pendentes', color: 'text-yellow-400', bg: 'bg-yellow-400/10' },
          { key: 'sent',    label: 'Enviados',  color: 'text-green-400',  bg: 'bg-green-400/10' },
          { key: 'failed',  label: 'Falharam',  color: 'text-red-400',    bg: 'bg-red-400/10' },
          { key: 'skipped', label: 'Ignorados', color: 'text-zinc-400',   bg: 'bg-zinc-400/10' },
        ].map(({ key, label, color, bg }) => (
          <div key={key} className={`rounded-xl border border-zinc-700/50 p-4 ${bg}`}>
            <p className="text-xs text-zinc-400 uppercase tracking-wide">{label}</p>
            <p className={`text-3xl font-bold mt-1 ${color}`}>
              {stats[key as keyof Stats] ?? 0}
            </p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-zinc-900 rounded-xl p-1 w-fit">
        {(['posts', 'settings'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              tab === t ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:text-white'
            }`}
          >
            {t === 'posts' ? 'Fila de Posts' : 'Configurações'}
          </button>
        ))}
      </div>

      {/* ── TAB: Posts ─────────────────────────────────────────────────────── */}
      {tab === 'posts' && (
        <div className="space-y-4">
          {/* Filtros */}
          <div className="flex flex-wrap gap-3 items-center">
            <select
              value={filterStatus}
              onChange={(e) => { setFilterStatus(e.target.value); setPage(1); }}
              className="bg-zinc-800 border border-zinc-700 text-zinc-200 text-sm rounded-lg px-3 py-2"
            >
              <option value="">Todos os status</option>
              <option value="pending">Pendente</option>
              <option value="sent">Enviado</option>
              <option value="failed">Falhou</option>
              <option value="skipped">Ignorado</option>
            </select>
            <select
              value={filterChannel}
              onChange={(e) => { setFilterChannel(e.target.value); setPage(1); }}
              className="bg-zinc-800 border border-zinc-700 text-zinc-200 text-sm rounded-lg px-3 py-2"
            >
              <option value="">Todos os canais</option>
              <option value="telegram">Telegram</option>
              <option value="whatsapp_link">WhatsApp</option>
            </select>
            {(stats.failed ?? 0) > 0 && (
              <button
                onClick={retryAllFailed}
                disabled={processing}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-red-900/40 hover:bg-red-900/60 text-red-300 text-sm transition"
              >
                <RotateCcw className="w-4 h-4" />
                Retentar todos os falhados ({stats.failed})
              </button>
            )}
            <span className="text-zinc-500 text-sm ml-auto">{total} posts</span>
          </div>

          {/* Lista */}
          {loading ? (
            <div className="text-center py-12 text-zinc-500">Carregando...</div>
          ) : posts.length === 0 ? (
            <div className="text-center py-12 text-zinc-500">
              <Send className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p>Nenhum post encontrado.</p>
              <p className="text-xs mt-1">Os posts aparecem aqui ao cadastrar objetos com os canais ativos.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {posts.map((post) => {
                const sc = STATUS_CONFIG[post.status] ?? STATUS_CONFIG.pending;
                const cc = CHANNEL_CONFIG[post.channel] ?? CHANNEL_CONFIG.telegram;
                const StatusIcon = sc.icon;
                const ChannelIcon = cc.icon;
                const isExpanded = expandedId === post.id;

                return (
                  <div key={post.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-3">
                    {/* Row 1: canal + status + objeto */}
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="flex items-center gap-3">
                        <span className={`flex items-center gap-1.5 text-sm font-medium ${cc.color}`}>
                          <ChannelIcon className="w-4 h-4" />
                          {cc.label}
                        </span>
                        <span className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border ${sc.color}`}>
                          <StatusIcon className="w-3 h-3" />
                          {sc.label}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-zinc-500">
                        <span>{fmtDate(post.created_at)}</span>
                        {post.post_url && (
                          <a href={post.post_url} target="_blank" rel="noopener noreferrer"
                            className="text-teal-400 hover:underline flex items-center gap-0.5">
                            <ExternalLink className="w-3 h-3" />
                            Ver objeto
                          </a>
                        )}
                      </div>
                    </div>

                    {/* Objeto relacionado */}
                    <div className="text-sm text-zinc-300">
                      <span className="text-zinc-500">Objeto: </span>
                      <span className="font-medium">{post.object_title}</span>
                      <span className="text-zinc-600 ml-2 text-xs">{post.qr_code}</span>
                    </div>

                    {/* Texto do post (expansível) */}
                    <div className="bg-zinc-800/60 rounded-lg p-3">
                      <pre className={`text-xs text-zinc-300 whitespace-pre-wrap font-sans ${!isExpanded ? 'line-clamp-3' : ''}`}>
                        {post.post_text}
                      </pre>
                      {post.post_text.split('\n').length > 3 && (
                        <button
                          onClick={() => setExpandedId(isExpanded ? null : post.id)}
                          className="text-xs text-teal-400 mt-1 flex items-center gap-0.5 hover:underline"
                        >
                          {isExpanded ? <><ChevronUp className="w-3 h-3" />Recolher</> : <><ChevronDown className="w-3 h-3" />Ver completo</>}
                        </button>
                      )}
                    </div>

                    {/* Erro */}
                    {post.error_message && (
                      <div className="flex items-start gap-2 text-xs text-red-400 bg-red-900/20 rounded-lg p-2.5">
                        <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                        <span>{post.error_message}</span>
                      </div>
                    )}

                    {/* Ações */}
                    {(post.status === 'failed' || post.status === 'pending') && (
                      <div className="flex gap-2">
                        {post.status === 'failed' && (
                          <button
                            onClick={() => postAction(post.id, 'retry')}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-700 hover:bg-zinc-600 text-zinc-200 text-xs transition"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            Retentar
                          </button>
                        )}
                        <button
                          onClick={() => postAction(post.id, 'skip')}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 text-xs transition"
                        >
                          <SkipForward className="w-3.5 h-3.5" />
                          Ignorar
                        </button>
                      </div>
                    )}

                    {/* Retry count */}
                    {post.retry_count > 0 && (
                      <p className="text-xs text-zinc-600">Tentativas: {post.retry_count}/3</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Paginação */}
          {pages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1.5 rounded-lg bg-zinc-800 text-zinc-300 text-sm disabled:opacity-40"
              >
                Anterior
              </button>
              <span className="text-zinc-500 text-sm">{page} / {pages}</span>
              <button
                onClick={() => setPage(p => Math.min(pages, p + 1))}
                disabled={page === pages}
                className="px-3 py-1.5 rounded-lg bg-zinc-800 text-zinc-300 text-sm disabled:opacity-40"
              >
                Próxima
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── TAB: Configurações ─────────────────────────────────────────────── */}
      {tab === 'settings' && (
        <div className="space-y-4 max-w-2xl">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-4">
            <div className="flex items-center gap-2 text-white font-semibold">
              <Settings2 className="w-5 h-5 text-teal-400" />
              Configurações dos Canais
            </div>

            {settings.length === 0 ? (
              <div className="text-zinc-500 text-sm py-4 text-center">
                Tabela não encontrada. Execute a migration primeiro.
                <br />
                <code className="text-xs bg-zinc-800 px-2 py-1 rounded mt-2 inline-block">
                  POST /api/v1/admin/social/migrate
                </code>
              </div>
            ) : (
              settings.map((s) => (
                <div key={s.key} className="space-y-1">
                  <label className="text-xs text-zinc-400 font-medium uppercase tracking-wide">
                    {s.description}
                  </label>
                  {s.key === 'post_template' ? (
                    <textarea
                      rows={6}
                      defaultValue={s.value}
                      onChange={(e) => setSettingsEdits(prev => ({ ...prev, [s.key]: e.target.value }))}
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 font-mono resize-y"
                      placeholder={s.value}
                    />
                  ) : (
                    <input
                      type={s.key.includes('token') ? 'password' : 'text'}
                      defaultValue={s.value}
                      onChange={(e) => setSettingsEdits(prev => ({ ...prev, [s.key]: e.target.value }))}
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200"
                      placeholder={s.key.includes('enabled') ? 'true ou false' : s.description}
                    />
                  )}
                </div>
              ))
            )}

            {settingsMsg && (
              <p className={`text-sm ${settingsMsg.includes('sucesso') ? 'text-green-400' : 'text-red-400'}`}>
                {settingsMsg}
              </p>
            )}

            <div className="flex gap-3 pt-2">
              <button
                onClick={saveSettings}
                disabled={savingSettings || Object.keys(settingsEdits).length === 0}
                className="px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-sm font-medium transition disabled:opacity-40"
              >
                {savingSettings ? 'Salvando...' : 'Salvar configurações'}
              </button>
            </div>
          </div>

          {/* Guia de configuração do Telegram */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-3">
            <h3 className="text-white font-semibold flex items-center gap-2">
              <MessageCircle className="w-5 h-5 text-sky-400" />
              Como configurar o Telegram
            </h3>
            <ol className="text-sm text-zinc-400 space-y-2 list-decimal list-inside">
              <li>Abra o Telegram e busque por <strong className="text-zinc-200">@BotFather</strong></li>
              <li>Envie <code className="bg-zinc-800 px-1.5 py-0.5 rounded text-xs">/newbot</code> e siga as instruções</li>
              <li>Copie o token gerado e cole em <strong className="text-zinc-200">Token do bot Telegram</strong> acima</li>
              <li>Crie um canal público ou grupo no Telegram</li>
              <li>Adicione o bot como administrador do canal/grupo</li>
              <li>Obtenha o ID do canal com <strong className="text-zinc-200">@userinfobot</strong> ou via API</li>
              <li>Cole o ID em <strong className="text-zinc-200">ID do canal Telegram</strong> (ex: <code className="bg-zinc-800 px-1.5 py-0.5 rounded text-xs">-100123456789</code>)</li>
              <li>Defina <strong className="text-zinc-200">Publicar automaticamente no Telegram</strong> como <code className="bg-zinc-800 px-1.5 py-0.5 rounded text-xs">true</code></li>
            </ol>
          </div>

          {/* Variáveis do template */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-3">
            <h3 className="text-white font-semibold">Variáveis do template de post</h3>
            <div className="grid grid-cols-2 gap-2 text-xs">
              {[
                ['{title}', 'Título do objeto'],
                ['{status_emoji}', 'Status com emoji (ex: 🔴 Perdido)'],
                ['{category}', 'Categoria com emoji'],
                ['{location}', 'Endereço/localização'],
                ['{reward_line}', 'Linha de recompensa (omitida se vazia)'],
                ['{url}', 'Link público do objeto'],
              ].map(([v, d]) => (
                <div key={v} className="flex gap-2">
                  <code className="bg-zinc-800 px-1.5 py-0.5 rounded text-teal-300 shrink-0">{v}</code>
                  <span className="text-zinc-400">{d}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
