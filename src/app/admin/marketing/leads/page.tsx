'use client';
export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback } from 'react';
import {
  RefreshCw, Plus, Filter, ExternalLink, CheckCircle2, XCircle, Trash2,
  MessageSquare, MapPin, Zap, ChevronDown, ChevronUp, Play,
  AlertCircle, Loader2, Target, Users,
} from 'lucide-react';

// ─── Tipos ────────────────────────────────────────────────────────────────────
interface Lead {
  id: number;
  rede: string;
  keyword: string;
  texto: string;
  link: string;
  usuario: string;
  data_post: string;
  comentarios: number;
  cidade: string;
  tipo_item: string;
  score: number;
  prioridade: 'alta' | 'media' | 'baixa';
  status: string;
  origem: string;
  source_url: string;
  comment_link: string;
  resposta: string;
  resolvido: boolean;
  created_at: string;
}

interface ApifyConfig {
  id: number;
  actor_id: string;
  keyword: string;
  rede: string;
  max_results: number;
  ativo: boolean;
  last_run_at: string | null;
  last_run_id: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const PLATFORM_CONFIG: Record<string, { icon: string; bg: string; textColor: string }> = {
  facebook:  { icon: 'f',  bg: '#1877F215', textColor: '#60A5FA' },
  instagram: { icon: 'ig', bg: '#E1306C15', textColor: '#F472B6' },
  twitter:   { icon: 'X',  bg: '#1DA1F215', textColor: '#38BDF8' },
  reddit:    { icon: 'r',  bg: '#FF451215', textColor: '#FB923C' },
  tiktok:    { icon: 'tt', bg: '#69C9D015', textColor: '#2DD4BF' },
};

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  novo:       { label: 'Novo',       color: '#60A5FA', bg: '#60A5FA15' },
  abordado:   { label: 'Abordado',   color: '#FBBF24', bg: '#FBBF2415' },
  respondeu:  { label: 'Respondeu',  color: '#A78BFA', bg: '#A78BFA15' },
  convertido: { label: 'Convertido', color: '#34D399', bg: '#34D39915' },
  descartado: { label: 'Descartado', color: '#F87171', bg: '#F8717115' },
};

function scoreColor(score: number): string {
  if (score >= 7) return '#F87171';
  if (score >= 5) return '#FBBF24';
  if (score >= 3) return '#60A5FA';
  return '#6B7280';
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const h = Math.floor(diff / 3600000);
  if (h < 1) return `${Math.floor(diff / 60000)}min`;
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

// ─── LeadCard ─────────────────────────────────────────────────────────────────
function LeadCard({
  lead,
  onStatusChange,
  onDelete,
}: {
  lead: Lead;
  onStatusChange: (id: number, status: string) => void;
  onDelete: (id: number) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);

  const platform = PLATFORM_CONFIG[lead.rede] ?? PLATFORM_CONFIG.facebook;
  const status = STATUS_CONFIG[lead.status] ?? STATUS_CONFIG.novo;
  const sc = scoreColor(lead.score);

  const handleStatus = async (newStatus: string) => {
    setLoading(true);
    try {
      await fetch(`/api/v1/admin/marketing/leads/${lead.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      onStatusChange(lead.id, newStatus);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Excluir este lead permanentemente?')) return;
    setLoading(true);
    try {
      await fetch(`/api/v1/admin/marketing/leads/${lead.id}`, { method: 'DELETE' });
      onDelete(lead.id);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="rounded-xl border transition-all"
      style={{
        background: 'oklch(0.09 0.015 240)',
        borderColor: lead.prioridade === 'alta'
          ? 'oklch(0.35 0.12 25 / 0.4)'
          : 'oklch(0.16 0.015 240)',
      }}
    >
      <div
        className="flex items-start gap-3 p-3 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        {/* Score */}
        <div
          className="flex items-center justify-center w-9 h-9 rounded-full text-sm font-bold shrink-0 mt-0.5"
          style={{ border: `2px solid ${sc}50`, background: `${sc}15`, color: sc }}
        >
          {lead.score}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold"
              style={{ color: platform.textColor, background: platform.bg }}
            >
              {platform.icon} {lead.rede.toUpperCase()}
            </span>
            {lead.keyword && (
              <span className="text-xs text-white/40 truncate max-w-[120px]">{lead.keyword}</span>
            )}
            {lead.prioridade === 'alta' && (
              <span className="text-xs font-semibold text-red-400">🔥 Alta</span>
            )}
            <span className="ml-auto text-xs text-white/30">{timeAgo(lead.data_post)}</span>
          </div>

          <p className="text-sm text-white/70 leading-relaxed line-clamp-2">{lead.texto}</p>

          <div className="flex items-center gap-3 mt-1.5 flex-wrap">
            {lead.usuario && (
              <span className="text-xs text-white/40">{lead.usuario}</span>
            )}
            {lead.comentarios > 0 && (
              <span className="flex items-center gap-1 text-xs text-white/30">
                <MessageSquare size={10} /> {lead.comentarios}
              </span>
            )}
            {lead.cidade && (
              <span className="flex items-center gap-1 text-xs text-white/30">
                <MapPin size={10} /> {lead.cidade}
              </span>
            )}
            <span
              className="ml-auto inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold"
              style={{ color: status.color, background: status.bg }}
            >
              {status.label}
            </span>
          </div>
        </div>

        <div className="shrink-0 text-white/20 mt-1">
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </div>
      </div>

      {expanded && (
        <div
          className="px-3 pb-3 border-t"
          style={{ borderColor: 'oklch(0.16 0.015 240)' }}
        >
          <p className="text-sm text-white/60 leading-relaxed mt-3 mb-3">{lead.texto}</p>

          {lead.link && (
            <a
              href={lead.link}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs text-teal-400 hover:text-teal-300 mb-3"
            >
              <ExternalLink size={11} /> Ver post original
            </a>
          )}

          <div className="flex items-center gap-2 flex-wrap">
            {lead.status !== 'abordado' && (
              <button
                onClick={() => handleStatus('abordado')}
                disabled={loading}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium"
                style={{ background: '#FBBF2415', color: '#FBBF24', border: '1px solid #FBBF2430' }}
              >
                <MessageSquare size={11} /> Abordado
              </button>
            )}
            {lead.status !== 'convertido' && (
              <button
                onClick={() => handleStatus('convertido')}
                disabled={loading}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium"
                style={{ background: '#34D39915', color: '#34D399', border: '1px solid #34D39930' }}
              >
                <CheckCircle2 size={11} /> Convertido
              </button>
            )}
            {lead.status !== 'descartado' && (
              <button
                onClick={() => handleStatus('descartado')}
                disabled={loading}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium"
                style={{ background: '#F8717115', color: '#F87171', border: '1px solid #F8717130' }}
              >
                <XCircle size={11} /> Descartar
              </button>
            )}
            <button
              onClick={handleDelete}
              disabled={loading}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium ml-auto"
              style={{ background: '#F8717108', color: '#F87171', border: '1px solid #F8717120' }}
            >
              <Trash2 size={11} /> Excluir
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── ApifyPanel ───────────────────────────────────────────────────────────────
function ApifyPanel({
  configs,
  onRefresh,
}: {
  configs: ApifyConfig[];
  onRefresh: () => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [running, setRunning] = useState<number | null>(null);
  const [runResult, setRunResult] = useState<string | null>(null);
  const [form, setForm] = useState({
    keyword: '',
    rede: 'facebook',
    max_results: 100,
    actor_id: 'powerai/facebook-post-search-scraper',
  });

  const handleCreate = async () => {
    if (!form.keyword.trim()) return;
    await fetch('/api/v1/admin/marketing/apify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    setShowForm(false);
    setForm({ keyword: '', rede: 'facebook', max_results: 100, actor_id: 'powerai/facebook-post-search-scraper' });
    onRefresh();
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Excluir esta configuração?')) return;
    await fetch(`/api/v1/admin/marketing/apify?id=${id}`, { method: 'DELETE' });
    onRefresh();
  };

  const handleRun = async (config: ApifyConfig) => {
    setRunning(config.id);
    setRunResult(null);
    try {
      const res = await fetch('/api/v1/admin/marketing/apify/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config_id: config.id }),
      });
      const data = await res.json() as { detail?: string; message?: string; saved?: number };
      if (!res.ok) {
        setRunResult(`Erro: ${data.detail ?? 'Falha ao disparar coleta'}`);
      } else {
        setRunResult(`Concluido: ${data.message ?? `${data.saved} leads importados`}`);
        onRefresh();
      }
    } catch {
      setRunResult('Erro de conexao');
    } finally {
      setRunning(null);
    }
  };

  return (
    <div className="space-y-3">
      <div
        className="flex items-start gap-3 p-3 rounded-xl"
        style={{ background: '#FBBF2408', border: '1px solid #FBBF2420' }}
      >
        <AlertCircle size={14} className="text-yellow-400 mt-0.5 shrink-0" />
        <div className="text-xs text-white/50">
          Configure <code className="text-yellow-300/70">APIFY_API_TOKEN</code> no Vercel para habilitar coleta automatica.
        </div>
      </div>

      {configs.map((cfg) => (
        <div
          key={cfg.id}
          className="flex items-center gap-3 p-3 rounded-xl"
          style={{ background: 'oklch(0.09 0.015 240)', border: '1px solid oklch(0.16 0.015 240)' }}
        >
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-sm font-medium text-white/80">{cfg.keyword}</span>
              <span className="text-xs text-white/30">{cfg.rede}</span>
              <span
                className="text-xs px-1.5 py-0.5 rounded"
                style={{
                  background: cfg.ativo ? '#34D39915' : '#F8717115',
                  color: cfg.ativo ? '#34D399' : '#F87171',
                }}
              >
                {cfg.ativo ? 'Ativo' : 'Inativo'}
              </span>
            </div>
            <div className="text-xs text-white/30">
              Max: {cfg.max_results} resultados
              {cfg.last_run_at ? ` · Ultimo run: ${timeAgo(cfg.last_run_at)}` : ''}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleRun(cfg)}
              disabled={running === cfg.id}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium"
              style={{ background: '#60A5FA15', color: '#60A5FA', border: '1px solid #60A5FA30' }}
            >
              {running === cfg.id ? (
                <Loader2 size={11} className="animate-spin" />
              ) : (
                <Play size={11} />
              )}
              {running === cfg.id ? 'Coletando...' : 'Disparar'}
            </button>
            <button
              onClick={() => handleDelete(cfg.id)}
              className="p-1.5 rounded-lg text-white/20 hover:text-red-400 transition-all"
            >
              <Trash2 size={13} />
            </button>
          </div>
        </div>
      ))}

      {runResult && (
        <div
          className="p-3 rounded-xl text-sm"
          style={{
            background: runResult.startsWith('Concluido') ? '#34D39910' : '#F8717110',
            border: `1px solid ${runResult.startsWith('Concluido') ? '#34D39930' : '#F8717130'}`,
            color: runResult.startsWith('Concluido') ? '#34D399' : '#F87171',
          }}
        >
          {runResult}
        </div>
      )}

      {showForm ? (
        <div
          className="p-3 rounded-xl space-y-3"
          style={{ background: 'oklch(0.09 0.015 240)', border: '1px solid oklch(0.16 0.015 240)' }}
        >
          <input
            type="text"
            placeholder="Palavra-chave (ex: perdi celular)"
            value={form.keyword}
            onChange={(e) => setForm({ ...form, keyword: e.target.value })}
            className="w-full px-3 py-2 rounded-lg text-sm bg-white/5 border border-white/10 text-white/80 placeholder-white/20 focus:outline-none focus:border-teal-500/50"
          />
          <div className="flex gap-2">
            <select
              value={form.rede}
              onChange={(e) => setForm({ ...form, rede: e.target.value })}
              className="flex-1 px-3 py-2 rounded-lg text-sm bg-white/5 border border-white/10 text-white/60 focus:outline-none"
            >
              <option value="facebook">Facebook</option>
              <option value="instagram">Instagram</option>
              <option value="twitter">Twitter/X</option>
              <option value="reddit">Reddit</option>
            </select>
            <input
              type="number"
              placeholder="Max"
              value={form.max_results}
              onChange={(e) => setForm({ ...form, max_results: parseInt(e.target.value) || 100 })}
              className="w-24 px-3 py-2 rounded-lg text-sm bg-white/5 border border-white/10 text-white/60 focus:outline-none"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleCreate}
              className="flex-1 py-2 rounded-lg text-sm font-medium text-teal-400"
              style={{ background: '#2DD4BF15', border: '1px solid #2DD4BF30' }}
            >
              Salvar configuracao
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="px-4 py-2 rounded-lg text-sm text-white/30 hover:text-white/60"
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowForm(true)}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm text-white/40 hover:text-white/60 transition-all"
          style={{ border: '1px dashed oklch(0.2 0.015 240)' }}
        >
          <Plus size={14} /> Nova configuracao de coleta
        </button>
      )}
    </div>
  );
}

// ─── Pagina principal ─────────────────────────────────────────────────────────
export default function MarketingLeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'fila' | 'apify'>('fila');
  const [configs, setConfigs] = useState<ApifyConfig[]>([]);

  const [filterStatus, setFilterStatus] = useState('');
  const [filterRede, setFilterRede] = useState('');
  const [filterPrioridade, setFilterPrioridade] = useState('');
  const [mostrarResolvidos, setMostrarResolvidos] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  const stats = {
    total,
    quentes: leads.filter((l) => l.score >= 6).length,
    convertidos: leads.filter((l) => l.status === 'convertido').length,
    novos: leads.filter((l) => l.status === 'novo').length,
  };

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterStatus) params.set('status', filterStatus);
      if (filterRede) params.set('rede', filterRede);
      if (filterPrioridade) params.set('prioridade', filterPrioridade);
      if (mostrarResolvidos) params.set('mostrarResolvidos', 'true');
      params.set('limit', '100');

      const res = await fetch(`/api/v1/admin/marketing/leads?${params.toString()}`);
      if (res.ok) {
        const data = await res.json() as { leads: Lead[]; total: number };
        setLeads(data.leads ?? []);
        setTotal(data.total ?? 0);
      }
    } finally {
      setLoading(false);
    }
  }, [filterStatus, filterRede, filterPrioridade, mostrarResolvidos]);

  const fetchConfigs = useCallback(async () => {
    const res = await fetch('/api/v1/admin/marketing/apify');
    if (res.ok) {
      const data = await res.json() as { configs: ApifyConfig[] };
      setConfigs(data.configs ?? []);
    }
  }, []);

  useEffect(() => { fetchLeads(); }, [fetchLeads]);
  useEffect(() => { fetchConfigs(); }, [fetchConfigs]);

  const handleStatusChange = (id: number, status: string) => {
    setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, status } : l)));
  };

  const handleDelete = (id: number) => {
    setLeads((prev) => prev.filter((l) => l.id !== id));
    setTotal((t) => t - 1);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-52px)] overflow-hidden">
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-2.5 border-b flex-shrink-0"
        style={{ background: '#060a12', borderColor: 'oklch(0.14 0.015 240)' }}
      >
        <div className="flex items-center gap-3">
          <span className="text-white/70 text-sm font-medium">Sistema de Captura Multi-Redes</span>
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium bg-teal-500/10 border border-teal-500/20 text-teal-400">
            <span className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-pulse" />
            nativo · Supabase
          </div>
        </div>
        <button
          onClick={() => { fetchLeads(); fetchConfigs(); }}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-white/30 hover:text-white/70 hover:bg-white/[0.04] text-xs transition-all"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Recarregar
        </button>
      </div>

      {/* Stats bar */}
      <div
        className="flex items-center gap-4 md:gap-6 px-4 py-2 overflow-x-auto flex-shrink-0"
        style={{ background: 'oklch(0.075 0.015 240)', borderBottom: '1px solid oklch(0.13 0.015 240)' }}
      >
        {[
          { v: total,             label: 'LEADS',       color: 'oklch(0.72 0.015 240)' },
          { v: stats.novos,       label: 'NOVOS',       color: '#60A5FA' },
          { v: stats.quentes,     label: 'QUENTES',     color: '#F87171' },
          { v: stats.convertidos, label: 'CONVERTIDOS', color: '#34D399' },
        ].map((s) => (
          <div key={s.label} className="flex items-baseline gap-1.5 shrink-0">
            <span className="text-xl font-bold" style={{ color: s.color }}>{s.v}</span>
            <span className="text-[11px] font-medium tracking-wide text-white/30">{s.label}</span>
          </div>
        ))}
        <div className="ml-auto flex items-center gap-1.5 shrink-0">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-[11px] font-medium text-emerald-400">AO VIVO</span>
        </div>
      </div>

      {/* Tabs */}
      <div
        className="flex items-center gap-1 px-4 py-2 border-b flex-shrink-0"
        style={{ borderColor: 'oklch(0.14 0.015 240)' }}
      >
        {[
          { key: 'fila',  label: 'Fila de Leads', icon: <Users size={13} /> },
          { key: 'apify', label: 'Coleta Apify',  icon: <Zap size={13} /> },
        ].map(({ key, label, icon }) => (
          <button
            key={key}
            onClick={() => setTab(key as 'fila' | 'apify')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
            style={{
              background: tab === key ? 'oklch(0.18 0.06 255 / 0.5)' : 'transparent',
              color: tab === key ? 'oklch(0.82 0.12 255)' : 'oklch(0.55 0.015 240)',
              border: tab === key ? '1px solid oklch(0.3 0.1 255 / 0.3)' : '1px solid transparent',
            }}
          >
            {icon} {label}
          </button>
        ))}

        {tab === 'fila' && (
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="ml-auto flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-white/40 hover:text-white/70 transition-all"
          >
            <Filter size={12} /> Filtros
          </button>
        )}
      </div>

      {/* Filtros */}
      {tab === 'fila' && showFilters && (
        <div
          className="flex items-center gap-2 px-4 py-2 flex-wrap flex-shrink-0"
          style={{ background: 'oklch(0.08 0.015 240)', borderBottom: '1px solid oklch(0.14 0.015 240)' }}
        >
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-2 py-1.5 rounded-lg text-xs bg-white/5 border border-white/10 text-white/60 focus:outline-none"
          >
            <option value="">Todos os status</option>
            {Object.entries(STATUS_CONFIG).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
          <select
            value={filterRede}
            onChange={(e) => setFilterRede(e.target.value)}
            className="px-2 py-1.5 rounded-lg text-xs bg-white/5 border border-white/10 text-white/60 focus:outline-none"
          >
            <option value="">Todas as redes</option>
            <option value="facebook">Facebook</option>
            <option value="instagram">Instagram</option>
            <option value="twitter">Twitter/X</option>
            <option value="reddit">Reddit</option>
          </select>
          <select
            value={filterPrioridade}
            onChange={(e) => setFilterPrioridade(e.target.value)}
            className="px-2 py-1.5 rounded-lg text-xs bg-white/5 border border-white/10 text-white/60 focus:outline-none"
          >
            <option value="">Todas as prioridades</option>
            <option value="alta">Alta</option>
            <option value="media">Media</option>
            <option value="baixa">Baixa</option>
          </select>
          <label className="flex items-center gap-1.5 text-xs text-white/40 cursor-pointer">
            <input
              type="checkbox"
              checked={mostrarResolvidos}
              onChange={(e) => setMostrarResolvidos(e.target.checked)}
              className="rounded"
            />
            Mostrar resolvidos
          </label>
        </div>
      )}

      {/* Conteudo */}
      <div className="flex-1 overflow-y-auto p-4">
        {tab === 'fila' && (
          <>
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 size={24} className="animate-spin text-white/20" />
              </div>
            ) : leads.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-4">
                <div
                  className="w-12 h-12 rounded-2xl flex items-center justify-center"
                  style={{ background: 'oklch(0.12 0.04 255 / 0.3)', border: '1px solid oklch(0.2 0.06 255 / 0.3)' }}
                >
                  <Target size={20} className="text-white/20" />
                </div>
                <div className="text-center">
                  <p className="text-white/40 font-medium">Nenhum lead encontrado</p>
                  <p className="text-white/20 text-sm mt-1">
                    Configure uma coleta Apify ou adicione leads manualmente
                  </p>
                </div>
                <button
                  onClick={() => setTab('apify')}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm text-teal-400 transition-all"
                  style={{ background: '#2DD4BF10', border: '1px solid #2DD4BF25' }}
                >
                  <Zap size={14} /> Configurar coleta Apify
                </button>
              </div>
            ) : (
              <div className="space-y-2 max-w-3xl mx-auto">
                {leads.map((lead) => (
                  <LeadCard
                    key={lead.id}
                    lead={lead}
                    onStatusChange={handleStatusChange}
                    onDelete={handleDelete}
                  />
                ))}
                {total > leads.length && (
                  <p className="text-center text-xs text-white/20 py-2">
                    Mostrando {leads.length} de {total} leads
                  </p>
                )}
              </div>
            )}
          </>
        )}

        {tab === 'apify' && (
          <div className="max-w-2xl mx-auto">
            <ApifyPanel configs={configs} onRefresh={fetchConfigs} />
          </div>
        )}
      </div>
    </div>
  );
}
