'use client';
export const dynamic = 'force-dynamic';
import { useState, useEffect, useCallback } from 'react';
import {
  RefreshCw, ExternalLink, CheckCircle2, XCircle, Trash2,
  MessageSquare, MapPin, Zap, ChevronDown, ChevronUp,
  AlertCircle, Loader2, BarChart2, Webhook, Play, Copy, Check,
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
interface Stats {
  total: number;
  hoje: number;
  abordadosHoje: number;
  convertidos: number;
  descartados: number;
  quentes: number;
  taxa: number;
  funil: { captados: number; abordados: number; responderam: number; convertidos: number };
  porRede: { rede: string; count: number }[];
  topKeywords: { keyword: string; count: number }[];
  porTipoItem: { tipo: string; count: number }[];
  porCidade: { cidade: string; count: number }[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const PLATFORM: Record<string, { icon: string; bg: string; color: string }> = {
  facebook:  { icon: 'f',  bg: '#1877F215', color: '#60A5FA' },
  instagram: { icon: 'ig', bg: '#E1306C15', color: '#F472B6' },
  twitter:   { icon: 'X',  bg: '#1DA1F215', color: '#38BDF8' },
  reddit:    { icon: 'r',  bg: '#FF451215', color: '#FB923C' },
  tiktok:    { icon: 'tt', bg: '#69C9D015', color: '#2DD4BF' },
};
const STATUS: Record<string, { label: string; color: string; bg: string }> = {
  novo:       { label: 'Novo',        color: '#60A5FA', bg: '#60A5FA15' },
  quente:     { label: 'Quente 🔥',   color: '#F87171', bg: '#F8717115' },
  abordado:   { label: 'Abordado',    color: '#FBBF24', bg: '#FBBF2415' },
  respondeu:  { label: 'Respondeu',   color: '#A78BFA', bg: '#A78BFA15' },
  convertido: { label: 'Convertido',  color: '#34D399', bg: '#34D39915' },
  descartado: { label: 'Descartado',  color: '#F87171', bg: '#F8717115' },
};
function sc(s: number) {
  if (s >= 7) return '#F87171';
  if (s >= 5) return '#FBBF24';
  if (s >= 3) return '#60A5FA';
  return '#6B7280';
}
function ago(d: string) {
  const h = Math.floor((Date.now() - new Date(d).getTime()) / 3600000);
  if (h < 1) return `${Math.floor((Date.now() - new Date(d).getTime()) / 60000)}min`;
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

// ─── LeadCard ─────────────────────────────────────────────────────────────────
function LeadCard({ lead, onRefresh }: { lead: Lead; onRefresh: () => void }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [reply, setReply] = useState('');
  const [genBusy, setGenBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const p = PLATFORM[lead.rede] ?? PLATFORM.facebook;
  const st = STATUS[lead.status] ?? STATUS.novo;
  const score = sc(lead.score);

  const patch = async (body: object) => {
    setBusy(true);
    await fetch(`/api/v1/admin/marketing/leads/${lead.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    setBusy(false);
    onRefresh();
  };
  const del = async () => {
    if (!confirm('Excluir este lead permanentemente?')) return;
    await fetch(`/api/v1/admin/marketing/leads/${lead.id}`, { method: 'DELETE' });
    onRefresh();
  };
  const genReply = async () => {
    setGenBusy(true);
    const r = await fetch('/api/v1/admin/marketing/leads/generate-reply', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rede: lead.rede, texto: lead.texto, tipoItem: lead.tipo_item, cidade: lead.cidade }),
    });
    const d = await r.json() as { reply?: string };
    setReply(d.reply ?? '');
    setGenBusy(false);
  };

  return (
    <div style={{ background: 'oklch(0.1 0.015 240)', border: `1px solid ${lead.score >= 7 ? 'oklch(0.35 0.12 25 / 0.4)' : 'oklch(0.18 0.015 240)'}`, borderRadius: 10, padding: '12px 14px', marginBottom: 8 }}>
      <div className="flex items-start gap-3 mb-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold" style={{ color: p.color, background: p.bg }}>
              {p.icon} {lead.rede.toUpperCase()}
            </span>
            {lead.keyword && <span className="text-xs truncate" style={{ color: 'oklch(0.5 0.015 240)' }}>{lead.keyword}</span>}
            {(lead.origem === 'apify-import' || lead.origem === 'apify-facebook') && (
              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs font-semibold" style={{ background: 'oklch(0.18 0.08 280 / 0.35)', color: '#A78BFA', border: '1px solid oklch(0.35 0.1 280 / 0.3)' }}>✨ IA</span>
            )}
            <span className="text-xs ml-auto" style={{ color: 'oklch(0.4 0.015 240)' }}>{ago(lead.data_post || lead.created_at)}</span>
          </div>
          <p className="text-sm leading-relaxed" style={{ color: 'oklch(0.72 0.015 240)', display: '-webkit-box', WebkitLineClamp: open ? undefined : 2, WebkitBoxOrient: 'vertical' as const, overflow: open ? 'visible' : 'hidden' }}>
            {lead.texto}
          </p>
        </div>
        <div className="flex items-center justify-center w-9 h-9 rounded-full text-sm font-bold shrink-0" style={{ border: `2px solid ${score}50`, background: `${score}15`, color: score }}>
          {lead.score}
        </div>
      </div>

      <div className="flex items-center gap-3 flex-wrap mb-3">
        {lead.usuario && <span className="text-xs font-medium" style={{ color: 'oklch(0.52 0.015 240)' }}>{lead.usuario}</span>}
        {lead.comentarios > 0 && <span className="flex items-center gap-1 text-xs" style={{ color: 'oklch(0.45 0.015 240)' }}><MessageSquare size={11} /> {lead.comentarios}</span>}
        {lead.cidade && <span className="flex items-center gap-1 text-xs" style={{ color: 'oklch(0.45 0.015 240)' }}><MapPin size={11} /> {lead.cidade}</span>}
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ml-auto" style={{ color: st.color, background: st.bg }}>{st.label}</span>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <a href={lead.link} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium" style={{ background: 'oklch(0.13 0.06 255 / 0.3)', color: 'oklch(0.72 0.12 255)', border: '1px solid oklch(0.25 0.1 255 / 0.3)' }}>
          <ExternalLink size={11} /> Ver post
        </a>
        {!lead.resolvido && (
          <button onClick={() => patch({ resolvido: true })} disabled={busy} className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium" style={{ background: 'oklch(0.13 0.06 145 / 0.3)', color: 'oklch(0.68 0.14 145)', border: '1px solid oklch(0.25 0.1 145 / 0.35)' }}>
            <CheckCircle2 size={11} /> Resolver
          </button>
        )}
        {lead.status !== 'descartado' && (
          <button onClick={() => patch({ status: 'descartado' })} disabled={busy} className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium" style={{ background: 'oklch(0.13 0.06 25 / 0.25)', color: 'oklch(0.65 0.12 25)', border: '1px solid oklch(0.25 0.1 25 / 0.3)' }}>
            <XCircle size={11} /> Descartar
          </button>
        )}
        <button onClick={() => setOpen(!open)} className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ml-auto" style={{ background: 'oklch(0.13 0.015 240)', color: 'oklch(0.55 0.015 240)', border: '1px solid oklch(0.2 0.015 240)' }}>
          {open ? <ChevronUp size={11} /> : <ChevronDown size={11} />} {open ? 'Menos' : 'Mais'}
        </button>
      </div>

      {open && (
        <div className="mt-4 pt-4" style={{ borderTop: '1px solid oklch(0.18 0.015 240)' }}>
          <div className="flex items-center gap-2 flex-wrap mb-4">
            <span className="text-xs font-medium" style={{ color: 'oklch(0.5 0.015 240)' }}>Mudar status:</span>
            {Object.entries(STATUS).map(([s, cfg]) => (
              <button key={s} onClick={() => patch({ status: s })} disabled={busy || lead.status === s} className="px-2 py-0.5 rounded text-xs font-semibold transition-opacity" style={{ color: cfg.color, background: cfg.bg, opacity: lead.status === s ? 0.4 : 1 }}>
                {cfg.label}
              </button>
            ))}
          </div>
          <button onClick={genReply} disabled={genBusy} className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold w-full justify-center mb-2" style={{ background: 'oklch(0.18 0.06 255 / 0.4)', border: '1px solid oklch(0.3 0.1 255 / 0.3)', color: 'oklch(0.82 0.12 255)' }}>
            {genBusy ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
            {genBusy ? 'Gerando...' : 'Gerar resposta com IA'}
          </button>
          {reply && (
            <div className="mb-3">
              <div className="rounded-lg p-3 text-sm leading-relaxed mb-2" style={{ background: 'oklch(0.065 0.015 240)', border: '1px solid oklch(0.22 0.08 160 / 0.4)', color: 'oklch(0.82 0.015 240)' }}>{reply}</div>
              <button onClick={() => { navigator.clipboard.writeText(reply); setCopied(true); setTimeout(() => setCopied(false), 2000); }} className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold w-full justify-center" style={{ background: copied ? 'oklch(0.15 0.08 160 / 0.5)' : 'oklch(0.18 0.06 255 / 0.4)', border: `1px solid ${copied ? 'oklch(0.4 0.15 160 / 0.4)' : 'oklch(0.3 0.1 255 / 0.3)'}`, color: copied ? '#34D399' : 'oklch(0.82 0.12 255)' }}>
                {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? 'Copiado!' : 'Copiar resposta'}
              </button>
            </div>
          )}
          <button onClick={del} className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium" style={{ background: 'oklch(0.13 0.06 25 / 0.3)', color: 'oklch(0.68 0.14 25)', border: '1px solid oklch(0.25 0.1 25 / 0.35)' }}>
            <Trash2 size={11} /> Excluir permanentemente
          </button>
        </div>
      )}
    </div>
  );
}

// ─── FilaPanel ────────────────────────────────────────────────────────────────
function FilaPanel({ leads, loading, onRefresh, total }: { leads: Lead[]; loading: boolean; onRefresh: () => void; total: number }) {
  const [filterStatus, setFilterStatus] = useState('');
  const [filterRede, setFilterRede] = useState('');
  const [mostrarResolvidos, setMostrarResolvidos] = useState(false);
  const filtered = leads.filter((l) => {
    if (filterStatus && l.status !== filterStatus) return false;
    if (filterRede && l.rede !== filterRede) return false;
    if (!mostrarResolvidos && l.resolvido) return false;
    return true;
  });
  return (
    <div className="p-4">
      <div className="flex items-center gap-2 flex-wrap mb-4">
        {[
          <select key="s" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="px-2 py-1.5 rounded text-xs" style={{ background: 'oklch(0.1 0.015 240)', border: '1px solid oklch(0.2 0.015 240)', color: 'oklch(0.72 0.015 240)' }}>
            <option value="">Todos</option>
            {Object.entries(STATUS).map(([s, c]) => <option key={s} value={s}>{c.label}</option>)}
          </select>,
          <select key="r" value={filterRede} onChange={(e) => setFilterRede(e.target.value)} className="px-2 py-1.5 rounded text-xs" style={{ background: 'oklch(0.1 0.015 240)', border: '1px solid oklch(0.2 0.015 240)', color: 'oklch(0.72 0.015 240)' }}>
            <option value="">Todas redes</option>
            {['facebook','instagram','twitter','reddit','tiktok'].map((r) => <option key={r} value={r}>{r.charAt(0).toUpperCase()+r.slice(1)}</option>)}
          </select>,
        ]}
        <label className="flex items-center gap-1.5 text-xs cursor-pointer" style={{ color: 'oklch(0.55 0.015 240)' }}>
          <input type="checkbox" checked={mostrarResolvidos} onChange={(e) => setMostrarResolvidos(e.target.checked)} className="rounded" />
          Ver resolvidos
        </label>
        <span className="ml-auto text-xs" style={{ color: 'oklch(0.45 0.015 240)' }}>{filtered.length} de {total}</span>
      </div>
      {loading ? (
        <div className="flex items-center justify-center py-16"><Loader2 size={24} className="animate-spin" style={{ color: 'oklch(0.55 0.015 240)' }} /><span className="ml-2 text-sm" style={{ color: 'oklch(0.5 0.015 240)' }}>Carregando leads...</span></div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <div className="text-4xl">📭</div>
          <p className="text-sm font-medium" style={{ color: 'oklch(0.55 0.015 240)' }}>Nenhum lead encontrado</p>
          <p className="text-xs text-center" style={{ color: 'oklch(0.4 0.015 240)' }}>Configure a automação Apify ou envie leads via webhook.</p>
        </div>
      ) : filtered.map((lead) => <LeadCard key={lead.id} lead={lead} onRefresh={onRefresh} />)}
    </div>
  );
}

// ─── StatsPanel ───────────────────────────────────────────────────────────────
function StatsPanel() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    fetch('/api/v1/admin/marketing/stats').then((r) => r.json()).then((d) => { setStats(d as Stats); setLoading(false); }).catch(() => setLoading(false));
  }, []);
  if (loading) return <div className="flex items-center justify-center py-16"><Loader2 size={24} className="animate-spin" style={{ color: 'oklch(0.55 0.015 240)' }} /></div>;
  if (!stats) return null;
  const cards = [
    { label: 'Leads Hoje', value: stats.hoje, sub: `${stats.total} total`, color: '#60A5FA' },
    { label: 'Abordados Hoje', value: stats.abordadosHoje, sub: `${stats.funil.abordados} total`, color: '#FBBF24' },
    { label: 'Convertidos', value: stats.convertidos, sub: `${stats.funil.convertidos} total`, color: '#34D399' },
    { label: 'Taxa Geral', value: `${stats.taxa}%`, sub: '—', color: '#C084FC' },
  ];
  return (
    <div className="p-4 space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {cards.map((c) => (
          <div key={c.label} className="rounded-xl p-4" style={{ background: 'oklch(0.1 0.015 240)', border: '1px solid oklch(0.18 0.015 240)' }}>
            <p className="text-xs font-medium mb-2" style={{ color: 'oklch(0.5 0.015 240)' }}>{c.label}</p>
            <p className="text-3xl font-bold mb-1" style={{ color: c.color }}>{c.value}</p>
            <p className="text-xs" style={{ color: 'oklch(0.4 0.015 240)' }}>{c.sub}</p>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-xl p-4" style={{ background: 'oklch(0.1 0.015 240)', border: '1px solid oklch(0.18 0.015 240)' }}>
          <p className="text-xs font-semibold tracking-widest mb-4" style={{ color: 'oklch(0.45 0.015 240)' }}>FUNIL DE CONVERSÃO</p>
          {[
            { label: 'Leads captados', value: stats.funil.captados, color: '#60A5FA' },
            { label: 'Abordados', value: stats.funil.abordados, color: '#FBBF24' },
            { label: 'Responderam', value: stats.funil.responderam, color: '#A78BFA' },
            { label: 'Convertidos', value: stats.funil.convertidos, color: '#34D399' },
          ].map((f) => (
            <div key={f.label} className="flex items-center justify-between py-2.5" style={{ borderBottom: '1px solid oklch(0.15 0.015 240)' }}>
              <span className="text-sm" style={{ color: 'oklch(0.65 0.015 240)' }}>{f.label}</span>
              <span className="text-sm font-bold" style={{ color: f.color }}>{f.value}</span>
            </div>
          ))}
        </div>
        <div className="rounded-xl p-4" style={{ background: 'oklch(0.1 0.015 240)', border: '1px solid oklch(0.18 0.015 240)' }}>
          <p className="text-xs font-semibold tracking-widest mb-4" style={{ color: 'oklch(0.45 0.015 240)' }}>PERFORMANCE POR REDE</p>
          {stats.porRede.length === 0 ? <p className="text-sm text-center py-4" style={{ color: 'oklch(0.4 0.015 240)' }}>Sem dados ainda</p> : stats.porRede.map((r) => {
            const cfg = PLATFORM[r.rede] ?? PLATFORM.facebook;
            const pct = stats.total > 0 ? Math.round((r.count / stats.total) * 100) : 0;
            return (
              <div key={r.rede} className="mb-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium" style={{ color: cfg.color }}>{r.rede.charAt(0).toUpperCase()+r.rede.slice(1)}</span>
                  <span className="text-xs" style={{ color: 'oklch(0.5 0.015 240)' }}>{r.count} ({pct}%)</span>
                </div>
                <div className="h-1.5 rounded-full" style={{ background: 'oklch(0.15 0.015 240)' }}>
                  <div className="h-1.5 rounded-full" style={{ width: `${pct}%`, background: cfg.color }} />
                </div>
              </div>
            );
          })}
        </div>
        <div className="rounded-xl p-4" style={{ background: 'oklch(0.1 0.015 240)', border: '1px solid oklch(0.18 0.015 240)' }}>
          <p className="text-xs font-semibold tracking-widest mb-4" style={{ color: 'oklch(0.45 0.015 240)' }}>TOP PALAVRAS-CHAVE</p>
          {stats.topKeywords.length === 0 ? <p className="text-sm text-center py-4" style={{ color: 'oklch(0.4 0.015 240)' }}>Sem dados ainda</p> : stats.topKeywords.slice(0,8).map((k) => (
            <div key={k.keyword} className="flex items-center justify-between py-1.5" style={{ borderBottom: '1px solid oklch(0.13 0.015 240)' }}>
              <span className="text-xs" style={{ color: 'oklch(0.65 0.015 240)' }}>{k.keyword}</span>
              <span className="text-xs font-bold" style={{ color: '#60A5FA' }}>{k.count}</span>
            </div>
          ))}
        </div>
        <div className="rounded-xl p-4" style={{ background: 'oklch(0.1 0.015 240)', border: '1px solid oklch(0.18 0.015 240)' }}>
          <p className="text-xs font-semibold tracking-widest mb-4" style={{ color: 'oklch(0.45 0.015 240)' }}>PADRÃO POR TIPO DE ITEM</p>
          {stats.porTipoItem.length === 0 ? <p className="text-sm text-center py-4" style={{ color: 'oklch(0.4 0.015 240)' }}>Sem dados ainda</p> : stats.porTipoItem.slice(0,8).map((t) => (
            <div key={t.tipo} className="flex items-center justify-between py-1.5" style={{ borderBottom: '1px solid oklch(0.13 0.015 240)' }}>
              <span className="text-xs" style={{ color: 'oklch(0.65 0.015 240)' }}>{t.tipo}</span>
              <span className="text-xs font-bold" style={{ color: '#FBBF24' }}>{t.count}</span>
            </div>
          ))}
        </div>
      </div>
      {stats.porCidade.length > 0 && (
        <div className="rounded-xl p-4" style={{ background: 'oklch(0.1 0.015 240)', border: '1px solid oklch(0.18 0.015 240)' }}>
          <p className="text-xs font-semibold tracking-widest mb-4" style={{ color: 'oklch(0.45 0.015 240)' }}>HEATMAP GEOGRÁFICO — LEADS POR CIDADE</p>
          <div className="flex flex-wrap gap-2">
            {stats.porCidade.map((c) => {
              const max = stats.porCidade[0]?.count ?? 1;
              const i = c.count / max;
              return <div key={c.cidade} className="px-3 py-1.5 rounded-full text-xs font-medium" style={{ background: `rgba(96,165,250,${0.1+i*0.4})`, border: `1px solid rgba(96,165,250,${0.2+i*0.4})`, color: `rgba(96,165,250,${0.6+i*0.4})`, fontSize: `${10+i*4}px` }}>{c.cidade} ({c.count})</div>;
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── WebhookPanel ─────────────────────────────────────────────────────────────
function WebhookPanel() {
  const [copied, setCopied] = useState<string | null>(null);
  const base = 'https://backfindr.com';
  const token = 'backfindr-webhook-secret-2024';
  const endpoint = `${base}/api/v1/admin/marketing/webhook`;
  const copy = (text: string, key: string) => { navigator.clipboard.writeText(text); setCopied(key); setTimeout(() => setCopied(null), 2000); };
  const curl = `curl -X POST ${endpoint} \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer ${token}" \\
  -d '{
    "rede": "facebook",
    "texto": "Perdi meu celular ontem na Paulista...",
    "link": "https://facebook.com/post/123",
    "keyword": "perdi celular",
    "usuario": "João Silva",
    "cidade": "São Paulo",
    "tipoItem": "celular",
    "comentarios": 5,
    "dataPost": "${new Date().toISOString()}"
  }'`;
  const campos = [
    { campo: 'rede', tipo: 'string', req: true, val: 'facebook | instagram | twitter | reddit | tiktok' },
    { campo: 'texto', tipo: 'string', req: true, val: 'Texto completo do post' },
    { campo: 'link', tipo: 'string', req: true, val: 'URL do post original' },
    { campo: 'keyword', tipo: 'string', req: false, val: 'Palavra-chave usada na busca' },
    { campo: 'usuario', tipo: 'string', req: false, val: '@usuario ou nome' },
    { campo: 'cidade', tipo: 'string', req: false, val: 'Cidade do usuário' },
    { campo: 'tipoItem', tipo: 'string', req: false, val: 'celular | pet | documentos | carteira | chaves | mochila | notebook | outro' },
    { campo: 'comentarios', tipo: 'number', req: false, val: 'Número de comentários' },
    { campo: 'dataPost', tipo: 'ISO 8601', req: false, val: 'Data/hora do post' },
  ];
  return (
    <div className="p-4 max-w-3xl mx-auto">
      <h2 className="text-lg font-bold mb-1" style={{ color: 'oklch(0.88 0.015 240)' }}>Webhook de Leads</h2>
      <p className="text-sm mb-6" style={{ color: 'oklch(0.5 0.015 240)' }}>Receba leads automaticamente de ferramentas como TexAu, Make, Zapier ou qualquer fonte externa via HTTP POST.</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {[
          { label: 'ENDPOINT', text: `POST ${endpoint}`, key: 'ep', color: '#60A5FA', copy: endpoint },
          { label: 'TOKEN DE AUTENTICAÇÃO', text: `Bearer ${token}`, key: 'tk', color: '#A78BFA', copy: `Bearer ${token}` },
        ].map((item) => (
          <div key={item.key} className="rounded-xl p-4" style={{ background: 'oklch(0.1 0.015 240)', border: '1px solid oklch(0.18 0.015 240)' }}>
            <p className="text-xs font-semibold tracking-widest mb-3" style={{ color: 'oklch(0.45 0.015 240)' }}>{item.label}</p>
            <div className="flex items-center gap-2">
              <code className="text-xs flex-1 truncate" style={{ color: item.color }}>{item.text}</code>
              <button onClick={() => copy(item.copy, item.key)} className="shrink-0 p-1.5 rounded" style={{ background: 'oklch(0.15 0.015 240)' }}>
                {copied === item.key ? <Check size={12} style={{ color: '#34D399' }} /> : <Copy size={12} style={{ color: 'oklch(0.5 0.015 240)' }} />}
              </button>
            </div>
          </div>
        ))}
      </div>
      <div className="rounded-xl p-4 mb-6" style={{ background: 'oklch(0.1 0.015 240)', border: '1px solid oklch(0.18 0.015 240)' }}>
        <p className="text-xs font-semibold tracking-widest mb-4" style={{ color: 'oklch(0.45 0.015 240)' }}>CAMPOS ACEITOS</p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead><tr style={{ borderBottom: '1px solid oklch(0.18 0.015 240)' }}>{['Campo','Tipo','Obrigatório','Valores'].map((h) => <th key={h} className="text-left pb-2 pr-4 font-semibold" style={{ color: 'oklch(0.45 0.015 240)' }}>{h}</th>)}</tr></thead>
            <tbody>{campos.map((c) => (
              <tr key={c.campo} style={{ borderBottom: '1px solid oklch(0.13 0.015 240)' }}>
                <td className="py-2 pr-4 font-mono font-semibold" style={{ color: '#60A5FA' }}>{c.campo}</td>
                <td className="py-2 pr-4 font-mono" style={{ color: '#A78BFA' }}>{c.tipo}</td>
                <td className="py-2 pr-4">{c.req ? <span style={{ color: '#34D399' }}>✓</span> : <span style={{ color: 'oklch(0.4 0.015 240)' }}>—</span>}</td>
                <td className="py-2" style={{ color: 'oklch(0.6 0.015 240)' }}>{c.val}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </div>
      <div className="rounded-xl p-4" style={{ background: 'oklch(0.1 0.015 240)', border: '1px solid oklch(0.18 0.015 240)' }}>
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-semibold tracking-widest" style={{ color: 'oklch(0.45 0.015 240)' }}>EXEMPLO — CURL</p>
          <button onClick={() => copy(curl, 'curl')} className="flex items-center gap-1 px-2 py-1 rounded text-xs" style={{ background: 'oklch(0.15 0.015 240)', color: 'oklch(0.55 0.015 240)' }}>
            {copied === 'curl' ? <Check size={11} style={{ color: '#34D399' }} /> : <Copy size={11} />} {copied === 'curl' ? 'Copiado!' : 'Copiar'}
          </button>
        </div>
        <pre className="text-xs overflow-x-auto leading-relaxed" style={{ color: 'oklch(0.65 0.015 240)', fontFamily: 'monospace' }}>{curl}</pre>
      </div>
    </div>
  );
}

// ─── AutomacaoPanel ───────────────────────────────────────────────────────────
function AutomacaoPanel({ onLeadReceived }: { onLeadReceived: () => void }) {
  const [configs, setConfigs] = useState<ApifyConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState<number | null>(null);
  const [runMsg, setRunMsg] = useState<string | null>(null);
  const [form, setForm] = useState({ keyword: '', max_results: 100, rede: 'facebook', actor_id: 'powerai/facebook-post-search-scraper' });
  const [importRunId, setImportRunId] = useState('');
  const [importKeyword, setImportKeyword] = useState('');
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const [hasApify, setHasApify] = useState(true);

  const fetchConfigs = useCallback(async () => {
    const r = await fetch('/api/v1/admin/marketing/apify');
    if (r.ok) { const d = await r.json() as { configs: ApifyConfig[] }; setConfigs(d.configs ?? []); }
    setLoading(false);
  }, []);
  useEffect(() => { fetchConfigs(); }, [fetchConfigs]);

  const create = async () => {
    if (!form.keyword.trim()) return;
    await fetch('/api/v1/admin/marketing/apify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
    setForm({ keyword: '', max_results: 100, rede: 'facebook', actor_id: 'powerai/facebook-post-search-scraper' });
    fetchConfigs();
  };
  const del = async (id: number) => {
    if (!confirm('Excluir esta configuração?')) return;
    await fetch(`/api/v1/admin/marketing/apify?id=${id}`, { method: 'DELETE' });
    fetchConfigs();
  };
  const run = async (cfg: ApifyConfig) => {
    setRunning(cfg.id); setRunMsg(null);
    const r = await fetch('/api/v1/admin/marketing/apify/run', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ config_id: cfg.id }) });
    const d = await r.json() as { detail?: string; message?: string; saved?: number };
    if (!r.ok) { if (r.status === 503) setHasApify(false); setRunMsg(`❌ ${d.detail ?? 'Erro'}`); }
    else { setRunMsg(`✅ ${d.message ?? 'OK'} — ${d.saved ?? 0} leads salvos`); onLeadReceived(); }
    setRunning(null);
  };
  const importRun = async () => {
    if (!importRunId.trim()) return;
    setImporting(true); setImportMsg(null);
    const r = await fetch('/api/v1/admin/marketing/apify/run', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ run_id: importRunId, keyword: importKeyword }) });
    const d = await r.json() as { detail?: string; saved?: number };
    setImportMsg(r.ok ? `✅ ${d.saved ?? 0} leads importados` : `❌ ${d.detail ?? 'Erro'}`);
    setImporting(false);
    if (r.ok) onLeadReceived();
  };

  const SUGS = ['perdi','roubaram','perdido','sumiu','desapareceu','perdi meu celular','roubaram minha mochila','perdeu o cachorro','perdeu documento','achadoseperdidos'];

  return (
    <div className="p-4 max-w-3xl mx-auto">
      <div className="rounded-xl p-4 mb-5" style={{ background: 'oklch(0.1 0.015 240)', border: '1px solid oklch(0.18 0.015 240)' }}>
        <div className="flex items-center gap-2 mb-1"><Zap size={16} style={{ color: '#60A5FA' }} /><h3 className="text-sm font-bold" style={{ color: 'oklch(0.88 0.015 240)' }}>Buscas Automáticas no Facebook</h3></div>
        <p className="text-xs" style={{ color: 'oklch(0.5 0.015 240)' }}>Configure as palavras-chave e dispare buscas diretamente no Apify. Os leads chegam automaticamente via webhook.</p>
      </div>
      {!hasApify && (
        <div className="flex items-center gap-2 p-3 rounded-lg mb-4" style={{ background: 'oklch(0.15 0.08 50 / 0.3)', border: '1px solid oklch(0.3 0.1 50 / 0.4)' }}>
          <AlertCircle size={14} style={{ color: '#FBBF24' }} />
          <span className="text-xs" style={{ color: '#FBBF24' }}>Configure <code>APIFY_API_TOKEN</code> no Vercel para habilitar coleta automática.</span>
        </div>
      )}

      {/* Keywords */}
      <div className="mb-5">
        <p className="text-xs font-semibold tracking-widest mb-3" style={{ color: 'oklch(0.45 0.015 240)' }}>KEYWORDS CONFIGURADAS ({configs.length})</p>
        {loading ? <div className="flex justify-center py-4"><Loader2 size={18} className="animate-spin" style={{ color: 'oklch(0.5 0.015 240)' }} /></div>
          : configs.length === 0 ? <p className="text-xs text-center py-4" style={{ color: 'oklch(0.4 0.015 240)' }}>Nenhuma keyword configurada ainda.</p>
          : configs.map((cfg) => (
            <div key={cfg.id} className="flex items-center gap-3 p-3 rounded-lg mb-2" style={{ background: 'oklch(0.1 0.015 240)', border: '1px solid oklch(0.18 0.015 240)' }}>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold" style={{ color: 'oklch(0.82 0.015 240)' }}>{cfg.keyword}</p>
                <p className="text-xs" style={{ color: 'oklch(0.45 0.015 240)' }}>{cfg.rede} · max {cfg.max_results} · {cfg.last_run_at ? `último: ${ago(cfg.last_run_at)}` : 'nunca executado'}</p>
              </div>
              <button onClick={() => run(cfg)} disabled={running === cfg.id} className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold" style={{ background: 'oklch(0.18 0.08 255 / 0.4)', border: '1px solid oklch(0.3 0.1 255 / 0.3)', color: 'oklch(0.82 0.12 255)' }}>
                {running === cfg.id ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />} Disparar
              </button>
              <button onClick={() => del(cfg.id)} className="p-1.5 rounded" style={{ background: 'oklch(0.13 0.06 25 / 0.3)', color: 'oklch(0.65 0.12 25)' }}><Trash2 size={12} /></button>
            </div>
          ))}
        {runMsg && <div className="mt-2 p-2 rounded text-xs" style={{ background: 'oklch(0.1 0.015 240)', border: '1px solid oklch(0.2 0.015 240)', color: 'oklch(0.7 0.015 240)' }}>{runMsg}</div>}
      </div>

      {/* Adicionar keyword */}
      <div className="rounded-xl p-4 mb-5" style={{ background: 'oklch(0.1 0.015 240)', border: '1px solid oklch(0.18 0.015 240)' }}>
        <p className="text-xs font-semibold tracking-widest mb-3" style={{ color: 'oklch(0.45 0.015 240)' }}>ADICIONAR KEYWORD</p>
        <div className="flex gap-2 mb-3">
          <input type="text" value={form.keyword} onChange={(e) => setForm({ ...form, keyword: e.target.value })} placeholder="Ex: perdi meu celular" className="flex-1 px-3 py-2 rounded-lg text-sm" style={{ background: 'oklch(0.065 0.015 240)', border: '1px solid oklch(0.2 0.015 240)', color: 'oklch(0.85 0.015 240)' }} />
          <input type="number" value={form.max_results} onChange={(e) => setForm({ ...form, max_results: parseInt(e.target.value)||100 })} className="w-20 px-3 py-2 rounded-lg text-sm text-center" style={{ background: 'oklch(0.065 0.015 240)', border: '1px solid oklch(0.2 0.015 240)', color: 'oklch(0.85 0.015 240)' }} />
          <button onClick={create} disabled={!form.keyword.trim()} className="px-4 py-2 rounded-lg text-sm font-semibold" style={{ background: 'oklch(0.18 0.06 255 / 0.4)', border: '1px solid oklch(0.3 0.1 255 / 0.3)', color: 'oklch(0.82 0.12 255)' }}>+ Adicionar</button>
        </div>
        <select value={form.actor_id} onChange={(e) => setForm({ ...form, actor_id: e.target.value })} className="w-full px-3 py-2 rounded-lg text-sm mb-3" style={{ background: 'oklch(0.065 0.015 240)', border: '1px solid oklch(0.2 0.015 240)', color: 'oklch(0.85 0.015 240)' }}>
          <option value="powerai/facebook-post-search-scraper">Facebook Post Search (Recomendado)</option>
          <option value="apify/instagram-hashtag-scraper">Instagram Hashtag Scraper</option>
          <option value="trudax/reddit-scraper">Reddit Scraper</option>
        </select>
        <p className="text-xs mb-2" style={{ color: 'oklch(0.45 0.015 240)' }}>SUGESTÕES RÁPIDAS</p>
        <div className="flex flex-wrap gap-1.5">
          {SUGS.map((s) => <button key={s} onClick={() => setForm({ ...form, keyword: s })} className="px-2.5 py-1 rounded-full text-xs font-medium" style={{ background: 'oklch(0.13 0.06 255 / 0.3)', border: '1px solid oklch(0.25 0.1 255 / 0.3)', color: 'oklch(0.72 0.12 255)' }}>+ {s}</button>)}
        </div>
      </div>

      {/* Importar por Run ID */}
      <div className="rounded-xl p-4" style={{ background: 'oklch(0.1 0.015 240)', border: '1px solid oklch(0.18 0.015 240)' }}>
        <p className="text-xs font-semibold tracking-widest mb-2" style={{ color: 'oklch(0.45 0.015 240)' }}>IMPORTAR MANUALMENTE (RUN ID)</p>
        <p className="text-xs mb-3" style={{ color: 'oklch(0.45 0.015 240)' }}>Rodou o actor diretamente no Apify? Cole o Run ID abaixo para importar os posts sem precisar configurar webhook.</p>
        <div className="flex gap-2 mb-2">
          <input type="text" value={importRunId} onChange={(e) => setImportRunId(e.target.value)} placeholder="Run ID (ex: rVct0VjBkQBHhIGia)" className="flex-1 px-3 py-2 rounded-lg text-sm" style={{ background: 'oklch(0.065 0.015 240)', border: '1px solid oklch(0.2 0.015 240)', color: 'oklch(0.85 0.015 240)' }} />
          <input type="text" value={importKeyword} onChange={(e) => setImportKeyword(e.target.value)} placeholder="Keyword (opcional)" className="w-36 px-3 py-2 rounded-lg text-sm" style={{ background: 'oklch(0.065 0.015 240)', border: '1px solid oklch(0.2 0.015 240)', color: 'oklch(0.85 0.015 240)' }} />
          <button onClick={importRun} disabled={importing || !importRunId.trim()} className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold" style={{ background: 'oklch(0.18 0.06 255 / 0.4)', border: '1px solid oklch(0.3 0.1 255 / 0.3)', color: 'oklch(0.82 0.12 255)' }}>
            {importing && <Loader2 size={13} className="animate-spin" />} Importar
          </button>
        </div>
        <p className="text-xs" style={{ color: 'oklch(0.4 0.015 240)' }}>O Run ID aparece na URL do Apify: <code style={{ color: '#60A5FA' }}>console.apify.com/actors/.../runs/SEU_RUN_ID/output</code></p>
        {importMsg && <div className="mt-2 p-2 rounded text-xs" style={{ background: 'oklch(0.1 0.015 240)', border: '1px solid oklch(0.2 0.015 240)', color: 'oklch(0.7 0.015 240)' }}>{importMsg}</div>}
      </div>
    </div>
  );
}

// ─── Página Principal ─────────────────────────────────────────────────────────
export default function MarketingLeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'fila' | 'stats' | 'webhook' | 'automacao'>('fila');
  const [bar, setBar] = useState({ total: 0, quentes: 0, descartados: 0, abordados: 0, convertidos: 0, taxa: 0 });

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/v1/admin/marketing/leads?limit=200');
      if (r.ok) {
        const d = await r.json() as { leads: Lead[]; total: number };
        const ls = d.leads ?? [];
        setLeads(ls);
        setTotal(d.total ?? 0);
        const quentes = ls.filter((l) => l.score >= 6 && l.status !== 'descartado').length;
        const descartados = ls.filter((l) => l.status === 'descartado').length;
        const abordados = ls.filter((l) => ['abordado','respondeu','convertido'].includes(l.status)).length;
        const convertidos = ls.filter((l) => l.status === 'convertido').length;
        const taxa = ls.length > 0 ? Math.round((convertidos / ls.length) * 100) : 0;
        setBar({ total: d.total ?? 0, quentes, descartados, abordados, convertidos, taxa });
      }
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchLeads(); }, [fetchLeads]);

  const tabs = [
    { key: 'fila' as const,      label: 'Fila de Leads', icon: <MessageSquare size={14} /> },
    { key: 'stats' as const,     label: 'Stats',         icon: <BarChart2 size={14} /> },
    { key: 'webhook' as const,   label: 'Webhook',       icon: <Webhook size={14} /> },
    { key: 'automacao' as const, label: 'Automação',     icon: <Zap size={14} /> },
  ];

  const barItems = [
    { v: bar.total,       label: 'LEADS',       color: 'oklch(0.72 0.015 240)' },
    { v: bar.quentes,     label: 'QUENTES 🔥',  color: '#F87171' },
    { v: bar.descartados, label: 'DESCARTADOS', color: 'oklch(0.55 0.12 25)' },
    { v: bar.abordados,   label: 'ABORDADOS',   color: '#60A5FA' },
    { v: bar.convertidos, label: 'CONVERTIDOS', color: '#34D399' },
    { v: `${bar.taxa}%`,  label: 'TAXA',        color: '#C084FC' },
  ];

  return (
    <div className="flex flex-col min-h-screen" style={{ background: 'oklch(0.055 0.015 240)', color: 'oklch(0.88 0.015 240)' }}>
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 shrink-0" style={{ background: 'oklch(0.075 0.015 240)', borderBottom: '1px solid oklch(0.13 0.015 240)' }}>
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg text-white font-bold text-sm shrink-0" style={{ background: 'linear-gradient(135deg, oklch(0.55 0.22 255), oklch(0.45 0.22 270))' }}>S</div>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-white tracking-tight leading-tight truncate">Sistema de Captura Multi-Redes</div>
            <div className="text-[10px] tracking-widest hidden sm:block" style={{ color: 'oklch(0.45 0.015 240)' }}>LEAD OPS CENTER</div>
          </div>
        </div>
        {/* Desktop tabs */}
        <nav className="hidden md:flex gap-1">
          {tabs.map(({ key, label, icon }) => (
            <button key={key} onClick={() => setTab(key)} className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-all" style={{ background: tab === key ? 'oklch(0.18 0.06 255 / 0.5)' : 'transparent', color: tab === key ? 'oklch(0.82 0.12 255)' : 'oklch(0.55 0.015 240)', border: tab === key ? '1px solid oklch(0.3 0.1 255 / 0.3)' : '1px solid transparent' }}>
              {icon} {label}
            </button>
          ))}
        </nav>
        <button onClick={fetchLeads} className="p-2 rounded-lg" style={{ background: 'oklch(0.13 0.015 240)', color: 'oklch(0.55 0.015 240)' }}><RefreshCw size={14} /></button>
      </header>

      {/* Stats bar */}
      <div className="flex items-center gap-4 md:gap-6 px-3 md:px-4 py-2.5 overflow-x-auto shrink-0" style={{ background: 'oklch(0.075 0.015 240)', borderBottom: '1px solid oklch(0.13 0.015 240)' }}>
        {barItems.map((s) => (
          <div key={s.label} className="flex items-baseline gap-1.5 shrink-0">
            <span className="text-xl font-bold" style={{ color: s.color }}>{s.v}</span>
            <span className="text-[11px] font-medium tracking-wide" style={{ color: 'oklch(0.48 0.015 240)' }}>{s.label}</span>
          </div>
        ))}
        <div className="ml-auto flex items-center gap-1.5 shrink-0">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-[11px] font-medium text-emerald-400">AO VIVO</span>
        </div>
      </div>

      {/* Content */}
      <main className="flex-1 overflow-y-auto pb-16 md:pb-0">
        {tab === 'fila'      && <FilaPanel leads={leads} loading={loading} onRefresh={fetchLeads} total={total} />}
        {tab === 'stats'     && <StatsPanel />}
        {tab === 'webhook'   && <WebhookPanel />}
        {tab === 'automacao' && <AutomacaoPanel onLeadReceived={fetchLeads} />}
      </main>

      {/* Mobile bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 flex md:hidden" style={{ background: 'oklch(0.075 0.015 240)', borderTop: '1px solid oklch(0.18 0.015 240)' }}>
        {tabs.map(({ key, label, icon }) => (
          <button key={key} onClick={() => setTab(key)} className="flex-1 flex flex-col items-center justify-center gap-1 py-3 transition-all" style={{ color: tab === key ? 'oklch(0.82 0.12 255)' : 'oklch(0.5 0.015 240)' }}>
            {icon}
            <span className="text-[11px] font-medium">{label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
