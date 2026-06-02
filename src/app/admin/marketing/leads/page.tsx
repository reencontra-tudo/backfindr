'use client';
export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  X, ExternalLink, Copy, Check, RefreshCw, RotateCcw, Zap, CheckCircle2, XCircle,
  MessageSquare, MapPin, Eye, EyeOff, Trash2, BarChart2, Webhook, Layers,
  Play, AlertCircle, Loader2, Plus, ChevronDown,
} from 'lucide-react';

import RadarPanel from '@/components/admin/marketing/RadarPanel';

// ─── Tipos ────────────────────────────────────────────────────────────────────
type Status = 'novo' | 'quente' | 'abordado' | 'respondeu' | 'convertido' | 'descartado';
type Rede = 'facebook' | 'instagram' | 'twitter' | 'reddit' | 'tiktok';

interface Lead {
  id: number;
  rede: Rede;
  keyword: string;
  texto: string;
  link: string;
  usuario: string;
  data_post: string;
  comentarios: number;
  cidade: string;
  tipo_item: string;
  score: number;
  prioridade: string;
  status: Status;
  origem: string;
  resolvido: boolean;
  comment_link?: string;
  resposta?: string;
  replica_sugerida?: string;
  comment_sugerido?: string;
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

// ─── Helpers / Config ─────────────────────────────────────────────────────────
const PLATFORM_CONFIG: Record<string, { icon: string; bg: string; textColor: string }> = {
  facebook:  { icon: 'f',  bg: '#1877F215', textColor: '#60A5FA' },
  instagram: { icon: 'ig', bg: '#E1306C15', textColor: '#F472B6' },
  twitter:   { icon: 'X',  bg: '#1DA1F215', textColor: '#38BDF8' },
  reddit:    { icon: 'r',  bg: '#FF451215', textColor: '#FB923C' },
  tiktok:    { icon: 'tt', bg: '#69C9D015', textColor: '#2DD4BF' },
};

const STATUS_CONFIG: Record<Status, { label: string; color: string; bg: string }> = {
  novo:       { label: 'Novo',        color: '#60A5FA', bg: '#60A5FA15' },
  quente:     { label: '🔥 Quente',   color: '#F87171', bg: '#F8717115' },
  abordado:   { label: 'Abordado',    color: '#FBBF24', bg: '#FBBF2415' },
  respondeu:  { label: 'Respondeu',   color: '#A78BFA', bg: '#A78BFA15' },
  convertido: { label: 'Convertido',  color: '#34D399', bg: '#34D39915' },
  descartado: { label: 'Descartado',  color: '#F87171', bg: '#F8717115' },
};

const TIPO_ITEM_LABELS: Record<string, string> = {
  celular: '📱 Celular', pet: '🐾 Pet', documentos: '📄 Documentos',
  carteira: '👛 Carteira', chaves: '🔑 Chaves', mochila: '🎒 Mochila',
  notebook: '💻 Notebook', outro: '📦 Outro',
};

function scoreColor(s: number) {
  if (s >= 7) return '#F87171';
  if (s >= 5) return '#FBBF24';
  if (s >= 3) return '#60A5FA';
  return '#6B7280';
}

function timeAgo(d: string) {
  const h = Math.floor((Date.now() - new Date(d).getTime()) / 3600000);
  if (h < 1) return `${Math.floor((Date.now() - new Date(d).getTime()) / 60000)}min`;
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

// ─── FilterPill ───────────────────────────────────────────────────────────────
function FilterPill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="px-3 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap min-h-[32px]"
      style={{
        background: active ? 'oklch(0.18 0.06 255 / 0.4)' : 'oklch(0.1 0.015 240)',
        color: active ? 'oklch(0.82 0.12 255)' : 'oklch(0.58 0.015 240)',
        border: active ? '1px solid oklch(0.3 0.1 255 / 0.3)' : '1px solid oklch(0.18 0.015 240)',
      }}
    >
      {children}
    </button>
  );
}

// ─── LeadRow ──────────────────────────────────────────────────────────────────
function LeadRow({
  lead, selected, onClick, index, onMarcarResolvido, isResolvendo,
  onExcluir, isExcluindo, onDescartar, isDescartando,
}: {
  lead: Lead; selected: boolean; onClick: () => void; index?: number;
  onMarcarResolvido: (e: React.MouseEvent) => void; isResolvendo?: boolean;
  onExcluir?: (e: React.MouseEvent) => void; isExcluindo?: boolean;
  onDescartar?: (e: React.MouseEvent) => void; isDescartando?: boolean;
}) {
  const platform = PLATFORM_CONFIG[lead.rede] ?? PLATFORM_CONFIG.facebook;
  const status = STATUS_CONFIG[lead.status] ?? STATUS_CONFIG.novo;
  const sc = scoreColor(lead.score);

  return (
    <div
      onClick={onClick}
      className="px-4 py-4 cursor-pointer transition-all active:opacity-70"
      style={{
        borderBottom: '1px solid oklch(0.11 0.015 240)',
        borderLeft: selected ? '3px solid oklch(0.55 0.18 255)' : '3px solid transparent',
        background: selected ? 'oklch(0.1 0.02 255 / 0.3)' : lead.resolvido ? 'oklch(0.08 0.04 145 / 0.15)' : 'transparent',
        opacity: lead.resolvido ? 0.65 : 1,
      }}
    >
      {/* Row top */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 min-w-0">
          {index && <span className="text-xs font-bold shrink-0" style={{ color: 'oklch(0.38 0.015 240)', minWidth: '1.5rem', textAlign: 'right' }}>{index}</span>}
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold shrink-0" style={{ color: platform.textColor, background: platform.bg }}>
            {platform.icon} {lead.rede.toUpperCase()}
          </span>
          {lead.keyword && <span className="text-xs truncate" style={{ color: 'oklch(0.5 0.015 240)' }}>{lead.keyword}</span>}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs" style={{ color: 'oklch(0.48 0.015 240)' }}>{timeAgo(lead.data_post || lead.created_at)}</span>
          <div className="flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold shrink-0" style={{ border: `2px solid ${sc}50`, background: `${sc}15`, color: sc }}>
            {lead.score}
          </div>
        </div>
      </div>

      {/* Text preview */}
      <p className="text-sm leading-relaxed mb-2.5" style={{ color: 'oklch(0.75 0.015 240)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const, overflow: 'hidden' }}>
        {lead.texto}
      </p>

      {/* Row bottom */}
      <div className="flex items-center gap-3 flex-wrap">
        {lead.usuario && <span className="text-xs font-medium" style={{ color: 'oklch(0.52 0.015 240)' }}>{lead.usuario}</span>}
        {lead.comentarios > 0 && <span className="flex items-center gap-1 text-xs" style={{ color: 'oklch(0.48 0.015 240)' }}><MessageSquare size={11} /> {lead.comentarios}</span>}
        {lead.cidade && <span className="flex items-center gap-1 text-xs" style={{ color: 'oklch(0.48 0.015 240)' }}><MapPin size={11} /> {lead.cidade}</span>}
        {lead.resolvido && (
          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs font-semibold" style={{ background: 'oklch(0.18 0.08 145 / 0.35)', color: 'oklch(0.72 0.15 145)', border: '1px solid oklch(0.3 0.12 145 / 0.3)' }}>
            ✓ Resolvido
          </span>
        )}
        {(lead.origem === 'apify-import' || lead.origem === 'apify-facebook') && (
          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs font-semibold" style={{ background: 'oklch(0.18 0.08 280 / 0.35)', color: '#A78BFA', border: '1px solid oklch(0.35 0.1 280 / 0.3)' }}>
            ✨ IA
          </span>
        )}
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ml-auto" style={{ color: status.color, background: status.bg }}>
          {status.label}
        </span>
        <button onClick={onMarcarResolvido} disabled={isResolvendo} title="Marcar como resolvido"
          className="flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium transition-all min-h-[28px]"
          style={{ background: 'oklch(0.13 0.06 145 / 0.3)', color: 'oklch(0.68 0.14 145)', border: '1px solid oklch(0.25 0.1 145 / 0.35)', opacity: isResolvendo ? 0.5 : 1 }}>
          <CheckCircle2 size={11} /> Resolvido
        </button>
        {!lead.resolvido && onDescartar && (
          <button onClick={onDescartar} disabled={isDescartando} title="Descartar"
            className="flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium transition-all min-h-[28px]"
            style={{ background: 'oklch(0.13 0.06 25 / 0.25)', color: 'oklch(0.65 0.12 25)', border: '1px solid oklch(0.25 0.1 25 / 0.3)', opacity: isDescartando ? 0.5 : 1 }}>
            <XCircle size={11} /> Descartar
          </button>
        )}
        {onExcluir && (
          <button onClick={onExcluir} disabled={isExcluindo} title="Excluir permanentemente"
            className="flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium transition-all min-h-[28px]"
            style={{ background: 'oklch(0.13 0.06 25 / 0.3)', color: 'oklch(0.68 0.14 25)', border: '1px solid oklch(0.25 0.1 25 / 0.35)', opacity: isExcluindo ? 0.5 : 1 }}>
            <Trash2 size={11} /> Excluir
          </button>
        )}
      </div>
    </div>
  );
}

// ─── LeadDetail ───────────────────────────────────────────────────────────────
function LeadDetail({ lead, onClose, onStatusChange, onRefresh }: {
  lead: Lead; onClose: () => void;
  onStatusChange: (id: number, status: Status) => void;
  onRefresh: () => void;
}) {
  const [reply, setReply] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [commentLinkInput, setCommentLinkInput] = useState(lead.comment_link ?? '');
  const [respostaInput, setRespostaInput] = useState('');
  const [replicaSugerida, setReplicaSugerida] = useState<string | null>(lead.replica_sugerida ?? null);
  const [copiedReplica, setCopiedReplica] = useState(false);
  const [genBusy, setGenBusy] = useState(false);
  const [savingLink, setSavingLink] = useState(false);
  const [savingResposta, setSavingResposta] = useState(false);

  const platform = PLATFORM_CONFIG[lead.rede] ?? PLATFORM_CONFIG.facebook;
  const sc = scoreColor(lead.score);
  const hoursAgo = (Date.now() - new Date(lead.data_post).getTime()) / 3600000;
  const isRecent = hoursAgo < 24;
  const fewComments = lead.comentarios < 10;

  const patch = async (body: object) => {
    await fetch(`/api/v1/admin/marketing/leads/${lead.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    onRefresh();
  };

  const handleGenerate = async () => {
    setGenBusy(true);
    const r = await fetch('/api/v1/admin/marketing/leads/generate-reply', {
      method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rede: lead.rede, texto: lead.texto, tipoItem: lead.tipo_item, cidade: lead.cidade }),
    });
    const d = await r.json() as { reply?: string };
    setReply(d.reply ?? '');
    setGenBusy(false);
  };

  const handleCopy = () => {
    if (!reply) return;
    navigator.clipboard.writeText(reply);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleApproach = () => {
    const link = lead.link?.trim();
    if (link && link !== '' && link !== '#') {
      try {
        const win = window.open('', '_blank');
        if (win) win.location.href = link;
        else window.location.href = link;
      } catch { window.location.href = link; }
    }
    onStatusChange(lead.id, 'abordado');
  };

  const handleSaveCommentLink = async () => {
    setSavingLink(true);
    await patch({ comment_link: commentLinkInput });
    setSavingLink(false);
  };

  const handleRegistrarResposta = async () => {
    if (!respostaInput.trim()) return;
    setSavingResposta(true);
    await patch({ resposta: respostaInput, status: 'respondeu' });
    // Gerar réplica via IA
    const r = await fetch('/api/v1/admin/marketing/leads/generate-reply', {
      method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        rede: lead.rede,
        texto: `Contexto original: ${lead.texto}\n\nResposta recebida: ${respostaInput}`,
        tipoItem: lead.tipo_item, cidade: lead.cidade,
      }),
    });
    const d = await r.json() as { reply?: string };
    if (d.reply) setReplicaSugerida(d.reply);
    setSavingResposta(false);
  };

  const SectionLabel = ({ children }: { children: React.ReactNode }) => (
    <div className="text-[11px] font-semibold tracking-widest mb-3 uppercase" style={{ color: 'oklch(0.45 0.015 240)' }}>{children}</div>
  );

  const Card = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
    <div className={`rounded-xl p-4 ${className}`} style={{ background: 'oklch(0.09 0.015 240)', border: '1px solid oklch(0.16 0.015 240)' }}>
      {children}
    </div>
  );

  return (
    <div className="flex flex-col gap-4 p-4 fade-in-up w-full">
      {/* TOP ROW */}
      <div className="flex items-start justify-center gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex items-center justify-center w-14 h-14 rounded-full shrink-0 font-bold text-2xl"
            style={{ border: `2.5px solid ${sc}60`, background: `${sc}18`, color: sc }}>
            {lead.score}
          </div>
          <div className="min-w-0">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-sm font-semibold mb-1"
              style={{ color: platform.textColor, background: platform.bg }}>
              {platform.icon} {lead.rede.toUpperCase()}
            </span>
            <div className="text-xs font-medium" style={{ color: 'oklch(0.52 0.015 240)' }}>
              {lead.usuario} · {timeAgo(lead.data_post)} atrás
            </div>
          </div>
        </div>
        <div className="w-10 h-10 shrink-0" />
      </div>

      {/* ANÁLISE */}
      <Card>
        <SectionLabel>Análise do Lead</SectionLabel>
        <div className="grid grid-cols-2 gap-3">
          {[
            { l: 'Prioridade', v: lead.score >= 6 ? '🔴 ALTA' : lead.score >= 4 ? '🟡 MÉDIA' : '⚫ BAIXA', c: sc },
            { l: 'Item', v: TIPO_ITEM_LABELS[lead.tipo_item] || lead.tipo_item || '—', c: 'oklch(0.75 0.015 240)' },
            { l: 'Cidade', v: lead.cidade || '—', c: 'oklch(0.75 0.015 240)' },
            { l: 'Comentários', v: fewComments ? `${lead.comentarios} ✓` : `${lead.comentarios}`, c: fewComments ? '#34D399' : '#FBBF24' },
            { l: 'Recência', v: isRecent ? `${Math.round(hoursAgo)}h atrás ✓` : timeAgo(lead.data_post), c: isRecent ? '#34D399' : '#FBBF24' },
            { l: 'Score', v: `${lead.score}/10`, c: sc },
          ].map((item) => (
            <div key={item.l} className="flex flex-col gap-0.5">
              <span className="text-xs" style={{ color: 'oklch(0.48 0.015 240)' }}>{item.l}</span>
              <span className="text-sm font-semibold" style={{ color: item.c }}>{item.v}</span>
            </div>
          ))}
        </div>
      </Card>

      {/* POST ORIGINAL */}
      <Card>
        <SectionLabel>Post Original</SectionLabel>
        <p className="text-sm leading-relaxed mb-3" style={{ color: 'oklch(0.82 0.015 240)' }}>{lead.texto}</p>
        <a href={lead.link} target="_blank" rel="noreferrer"
          className="inline-flex items-center gap-1.5 text-sm font-medium transition-opacity hover:opacity-70"
          style={{ color: 'oklch(0.68 0.15 255)' }}>
          <ExternalLink size={14} /> Abrir post original
        </a>
      </Card>

      {/* RESPOSTA SUGERIDA */}
      <Card>
        <SectionLabel>Resposta Sugerida</SectionLabel>
        {!reply && !genBusy && (
          <button onClick={handleGenerate}
            className="w-full py-3.5 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition-opacity hover:opacity-80 min-h-[48px]"
            style={{ background: 'linear-gradient(135deg, oklch(0.2 0.08 255), oklch(0.25 0.1 265))', border: '1px solid oklch(0.3 0.1 255 / 0.4)', color: 'oklch(0.82 0.12 255)' }}>
            <Zap size={16} /> Gerar com IA
          </button>
        )}
        {genBusy && (
          <div className="text-center py-4 text-sm font-medium" style={{ color: 'oklch(0.52 0.015 240)' }}>
            <Loader2 size={16} className="animate-spin inline mr-2" />Gerando resposta...
          </div>
        )}
        {reply && !genBusy && (
          <>
            <div className="rounded-lg p-3.5 text-sm leading-relaxed mb-3 whitespace-pre-wrap"
              style={{ background: 'oklch(0.065 0.015 240)', border: '1px solid oklch(0.22 0.06 255 / 0.5)', color: 'oklch(0.85 0.015 240)' }}>
              {reply}
            </div>
            <div className="flex gap-2">
              <button onClick={handleCopy}
                className="flex-1 py-3 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition-all min-h-[48px]"
                style={{ background: copied ? 'oklch(0.15 0.08 160 / 0.5)' : 'oklch(0.18 0.06 255 / 0.4)', border: `1px solid ${copied ? 'oklch(0.4 0.15 160 / 0.4)' : 'oklch(0.3 0.1 255 / 0.3)'}`, color: copied ? '#34D399' : 'oklch(0.82 0.12 255)' }}>
                {copied ? <Check size={15} /> : <Copy size={15} />} {copied ? 'Copiado!' : 'Copiar resposta'}
              </button>
              <button onClick={handleGenerate}
                className="px-4 py-3 rounded-lg flex items-center justify-center transition-opacity hover:opacity-70 min-h-[48px] min-w-[48px]"
                style={{ background: 'oklch(0.14 0.015 240)', border: '1px solid oklch(0.18 0.015 240)', color: 'oklch(0.55 0.015 240)' }}>
                <RefreshCw size={15} />
              </button>
            </div>
          </>
        )}
      </Card>

      {/* STATUS */}
      <Card>
        <SectionLabel>Alterar Status</SectionLabel>
        <div className="grid grid-cols-2 gap-2">
          {(Object.entries(STATUS_CONFIG) as [Status, typeof STATUS_CONFIG[Status]][]).map(([key, cfg]) => (
            <button key={key} onClick={() => onStatusChange(lead.id, key)}
              className="px-3 py-2.5 rounded-lg text-sm font-semibold transition-all min-h-[44px]"
              style={{ background: lead.status === key ? cfg.bg : 'oklch(0.065 0.015 240)', color: lead.status === key ? cfg.color : 'oklch(0.52 0.015 240)', border: `1px solid ${lead.status === key ? cfg.color + '60' : 'oklch(0.16 0.015 240)'}` }}>
              {cfg.label}
            </button>
          ))}
        </div>
      </Card>

      {/* CTA */}
      <button onClick={handleApproach}
        className="w-full py-4 rounded-xl text-base font-bold flex items-center justify-center gap-2 transition-opacity hover:opacity-90 min-h-[56px]"
        style={{ background: 'linear-gradient(135deg, oklch(0.45 0.2 255), oklch(0.5 0.22 265))', color: 'white' }}>
        🚀 Abrir post e abordar
      </button>

      {/* FOLLOW-UP */}
      <Card>
        <SectionLabel>Follow-up</SectionLabel>
        <div className="flex flex-col gap-1.5 mb-4">
          <span className="text-xs" style={{ color: 'oklch(0.48 0.015 240)' }}>Link do seu comentário no Facebook</span>
          <div className="flex gap-2">
            <input type="text" value={commentLinkInput} onChange={(e) => setCommentLinkInput(e.target.value)}
              placeholder="Cole o link do seu comentário aqui"
              className="flex-1 px-3 py-2 rounded-lg text-sm"
              style={{ background: 'oklch(0.065 0.015 240)', border: '1px solid oklch(0.2 0.015 240)', color: 'oklch(0.85 0.015 240)' }} />
            <button onClick={handleSaveCommentLink} disabled={savingLink}
              className="px-3 py-2 rounded-lg text-xs font-semibold min-h-[40px]"
              style={{ background: 'oklch(0.18 0.06 255 / 0.4)', border: '1px solid oklch(0.3 0.1 255 / 0.3)', color: 'oklch(0.82 0.12 255)' }}>
              {savingLink ? <Loader2 size={12} className="animate-spin" /> : 'Salvar'}
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-1.5 mb-3">
          <span className="text-xs" style={{ color: 'oklch(0.48 0.015 240)' }}>
            {lead.resposta ? '✅ Resposta registrada' : 'Alguém respondeu seu comentário?'}
          </span>
          {lead.resposta && (
            <div className="rounded-lg p-3 text-sm leading-relaxed mb-2"
              style={{ background: 'oklch(0.065 0.015 240)', border: '1px solid oklch(0.22 0.08 160 / 0.4)', color: 'oklch(0.82 0.015 240)' }}>
              {lead.resposta}
            </div>
          )}
          <textarea value={respostaInput} onChange={(e) => setRespostaInput(e.target.value)}
            placeholder="Cole aqui o texto da resposta recebida no Facebook"
            rows={3} className="w-full px-3 py-2 rounded-lg text-sm resize-none"
            style={{ background: 'oklch(0.065 0.015 240)', border: '1px solid oklch(0.2 0.015 240)', color: 'oklch(0.85 0.015 240)' }} />
          <button onClick={handleRegistrarResposta} disabled={savingResposta || !respostaInput.trim()}
            className="w-full py-2.5 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 min-h-[44px] transition-opacity hover:opacity-80"
            style={{ background: 'oklch(0.18 0.08 160 / 0.3)', border: '1px solid oklch(0.35 0.12 160 / 0.4)', color: '#34D399' }}>
            {savingResposta ? <Loader2 size={14} className="animate-spin" /> : '💬'} Registrar resposta e gerar réplica
          </button>
        </div>

        {replicaSugerida && (
          <>
            <div className="rounded-lg p-3.5 text-sm leading-relaxed mb-3"
              style={{ background: 'oklch(0.065 0.015 240)', border: '1px solid oklch(0.22 0.08 160 / 0.4)', color: 'oklch(0.85 0.015 240)' }}>
              {replicaSugerida}
            </div>
            <button onClick={() => { navigator.clipboard.writeText(replicaSugerida); setCopiedReplica(true); setTimeout(() => setCopiedReplica(false), 2000); }}
              className="w-full py-3 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 min-h-[48px]"
              style={{ background: copiedReplica ? 'oklch(0.15 0.08 160 / 0.5)' : 'oklch(0.18 0.06 255 / 0.4)', border: `1px solid ${copiedReplica ? 'oklch(0.4 0.15 160 / 0.4)' : 'oklch(0.3 0.1 255 / 0.3)'}`, color: copiedReplica ? '#34D399' : 'oklch(0.82 0.12 255)' }}>
              {copiedReplica ? <Check size={15} /> : <Copy size={15} />} {copiedReplica ? 'Copiado!' : 'Copiar réplica'}
            </button>
          </>
        )}
      </Card>

      <div className="h-4" />
    </div>
  );
}

// ─── LeadQueue (Fila de Leads) ────────────────────────────────────────────────
const STATUS_FILTERS = [
  { key: 'todos', label: 'Todos' }, { key: 'novo', label: 'Novo' }, { key: 'quente', label: '🔥 Quente' },
  { key: 'abordado', label: 'Abordado' }, { key: 'respondeu', label: 'Respondeu' }, { key: 'convertido', label: 'Convertido' },
];
const REDE_FILTERS = [
  { key: 'todas', label: 'Todas' }, { key: 'facebook', label: 'Facebook' }, { key: 'instagram', label: 'Instagram' },
  { key: 'twitter', label: 'Twitter' }, { key: 'reddit', label: 'Reddit' }, { key: 'tiktok', label: 'TikTok' },
];

function LeadQueue({ leads, loading, onRefresh, total }: { leads: Lead[]; loading: boolean; onRefresh: () => void; total: number }) {
  const [statusF, setStatusF] = useState('todos');
  const [redeF, setRedeF] = useState('todas');
  const [mostrarResolvidos, setMostrarResolvidos] = useState(false);
  const [selected, setSelected] = useState<Lead | null>(null);
  const [descartadosLocais, setDescartadosLocais] = useState<Set<number>>(new Set());
  const [resolvendo, setResolvendo] = useState<number | null>(null);
  const [excluindo, setExcluindo] = useState<number | null>(null);
  const [descartando, setDescartando] = useState<number | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  const totalResolvidos = leads.filter((l) => l.resolvido).length;

  const visible = leads
    .filter((l) => !descartadosLocais.has(l.id))
    .filter((l) => (statusF === 'todos' ? l.status !== 'descartado' : l.status === statusF))
    .filter((l) => (redeF === 'todas' || l.rede === redeF))
    .filter((l) => mostrarResolvidos || !l.resolvido)
    .sort((a, b) => b.score - a.score || new Date(b.data_post).getTime() - new Date(a.data_post).getTime());

  const handleStatusChange = async (id: number, status: Status) => {
    await fetch(`/api/v1/admin/marketing/leads/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }),
    });
    if (selected?.id === id) setSelected((s) => s ? { ...s, status } : s);
    onRefresh();
  };

  const handleMarcarResolvido = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setResolvendo(id);
    await fetch(`/api/v1/admin/marketing/leads/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ resolvido: true }),
    });
    setResolvendo(null);
    setSelected(null);
    if (!mostrarResolvidos) {
      setDescartadosLocais((prev) => new Set([...prev, id]));
    }
    onRefresh();
  };

  const handleDescartar = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setDescartando(id);
    setDescartadosLocais((prev) => new Set([...prev, id]));
    await fetch(`/api/v1/admin/marketing/leads/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'descartado' }),
    });
    setDescartando(null);
    onRefresh();
  };

  const handleDelete = async (id: number) => {
    setExcluindo(id);
    await fetch(`/api/v1/admin/marketing/leads/${id}`, { method: 'DELETE' });
    setExcluindo(null);
    setSelected(null);
    setConfirmDeleteId(null);
    onRefresh();
  };

  const filterBar = (
    <div className="px-3 py-2.5 flex flex-col gap-2" style={{ background: 'oklch(0.075 0.015 240)', borderBottom: '1px solid oklch(0.13 0.015 240)' }}>
      <div className="flex gap-1.5 overflow-x-auto pb-0.5">
        {STATUS_FILTERS.map((f) => <FilterPill key={f.key} active={statusF === f.key} onClick={() => setStatusF(f.key)}>{f.label}</FilterPill>)}
      </div>
      <div className="flex gap-1.5 overflow-x-auto pb-0.5">
        {REDE_FILTERS.map((f) => <FilterPill key={f.key} active={redeF === f.key} onClick={() => setRedeF(f.key)}>{f.label}</FilterPill>)}
      </div>
      <div className="flex">
        <button onClick={() => setMostrarResolvidos((v) => !v)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap min-h-[32px]"
          style={{ background: mostrarResolvidos ? 'oklch(0.18 0.08 145 / 0.4)' : 'oklch(0.1 0.015 240)', color: mostrarResolvidos ? 'oklch(0.75 0.15 145)' : 'oklch(0.58 0.015 240)', border: mostrarResolvidos ? '1px solid oklch(0.3 0.12 145 / 0.4)' : '1px solid oklch(0.18 0.015 240)' }}>
          {mostrarResolvidos ? <EyeOff size={12} /> : <Eye size={12} />}
          {mostrarResolvidos ? 'Ocultar resolvidos' : totalResolvidos > 0 ? `Ver resolvidos (${totalResolvidos})` : 'Ver resolvidos'}
        </button>
      </div>
    </div>
  );

  return (
    <>
      <div className="flex relative" style={{ height: 'calc(100vh - 101px)' }}>
        {/* LIST PANEL */}
        <div className="flex flex-col" style={{ flex: selected ? '0 0 44%' : '1 1 100%', borderRight: selected ? '1px solid oklch(0.13 0.015 240)' : 'none', overflow: 'hidden', display: selected ? undefined : 'flex' }}>
          {filterBar}
          <div className="overflow-y-auto flex-1">
            {loading && (
              <div className="flex flex-col items-center justify-center h-48 gap-3">
                <div className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: 'oklch(0.55 0.18 255)', borderTopColor: 'transparent' }} />
                <span className="text-sm font-medium" style={{ color: 'oklch(0.45 0.015 240)' }}>Carregando leads...</span>
              </div>
            )}
            {!loading && visible.length === 0 && (
              <div className="flex flex-col items-center justify-center h-48 gap-3">
                <span className="text-4xl opacity-30">📭</span>
                <span className="text-sm font-medium" style={{ color: 'oklch(0.45 0.015 240)' }}>Nenhum lead encontrado</span>
              </div>
            )}
            {visible.map((lead, idx) => (
              <LeadRow
                key={lead.id} index={idx + 1} lead={lead}
                selected={selected?.id === lead.id}
                onClick={() => setSelected(lead)}
                onMarcarResolvido={(e) => handleMarcarResolvido(lead.id, e)}
                isResolvendo={resolvendo === lead.id}
                onExcluir={lead.resolvido ? (e) => { e.stopPropagation(); setConfirmDeleteId(lead.id); } : undefined}
                isExcluindo={excluindo === lead.id}
                onDescartar={(e) => handleDescartar(lead.id, e)}
                isDescartando={descartando === lead.id}
              />
            ))}
          </div>
        </div>

        {/* DESKTOP DETAIL PANEL */}
        {selected && (
          <div className="hidden md:flex flex-col flex-1" style={{ background: 'oklch(0.065 0.015 240)', overflow: 'hidden' }}>
            <div className="flex items-center justify-between px-4 py-2 shrink-0" style={{ borderBottom: '1px solid oklch(0.13 0.015 240)' }}>
              <span className="text-xs font-semibold text-white truncate">{selected.usuario || 'Lead'}</span>
              <button onClick={() => setSelected(null)} className="flex items-center justify-center w-8 h-8 rounded-full" style={{ background: 'oklch(0.13 0.015 240)', color: 'oklch(0.65 0.015 240)' }}><X size={16} /></button>
            </div>
            <div className="overflow-y-auto flex-1">
              <LeadDetail key={selected.id} lead={selected} onClose={() => setSelected(null)} onStatusChange={handleStatusChange} onRefresh={onRefresh} />
            </div>
          </div>
        )}

        {/* MOBILE DETAIL DRAWER */}
        {selected && (
          <div className="fixed inset-0 z-50 flex flex-col md:hidden" style={{ background: 'oklch(0.065 0.015 240)' }}>
            <div className="flex items-center justify-between px-4 py-3 shrink-0" style={{ borderBottom: '1px solid oklch(0.13 0.015 240)' }}>
              <span className="text-base font-semibold text-white">Detalhes do Lead</span>
              <div className="flex items-center gap-2">
                <button onClick={(e) => handleMarcarResolvido(selected.id, e)} disabled={resolvendo === selected.id}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium min-h-[40px]"
                  style={{ background: 'oklch(0.13 0.06 145 / 0.4)', color: 'oklch(0.72 0.15 145)', border: '1px solid oklch(0.25 0.1 145 / 0.4)' }}>
                  <CheckCircle2 size={14} /> Resolvido
                </button>
                <button onClick={() => setSelected(null)} className="flex items-center justify-center w-10 h-10 rounded-full" style={{ background: 'oklch(0.13 0.015 240)', color: 'oklch(0.65 0.015 240)' }}>
                  <X size={18} />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              <LeadDetail key={selected.id} lead={selected} onClose={() => setSelected(null)} onStatusChange={handleStatusChange} onRefresh={onRefresh} />
            </div>
          </div>
        )}
      </div>

      {/* Confirm Delete Dialog */}
      {confirmDeleteId !== null && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.7)' }}>
          <div className="rounded-xl p-6 max-w-sm w-full mx-4" style={{ background: 'oklch(0.1 0.015 240)', border: '1px solid oklch(0.2 0.015 240)' }}>
            <h3 className="text-base font-bold text-white mb-2">Excluir lead permanentemente?</h3>
            <p className="text-sm mb-5" style={{ color: 'oklch(0.55 0.015 240)' }}>Esta ação não pode ser desfeita. O lead será removido definitivamente do banco de dados.</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDeleteId(null)} className="flex-1 py-2.5 rounded-lg text-sm font-semibold" style={{ background: 'oklch(0.15 0.015 240)', color: 'oklch(0.65 0.015 240)', border: '1px solid oklch(0.22 0.015 240)' }}>Cancelar</button>
              <button onClick={() => handleDelete(confirmDeleteId)} disabled={excluindo === confirmDeleteId}
                className="flex-1 py-2.5 rounded-lg text-sm font-semibold" style={{ background: 'oklch(0.35 0.15 25)', color: 'white' }}>
                {excluindo === confirmDeleteId ? <Loader2 size={14} className="animate-spin inline" /> : 'Excluir'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ─── StatsPanel ───────────────────────────────────────────────────────────────
function StatsPanel() {
  const [stats, setStats] = useState<{
    total: number; hoje: number; convertidos: number; taxa: number; quentes: number;
    funil: { captados: number; abordados: number; responderam: number; convertidos: number };
    porRede: { rede: string; count: number }[];
    topKeywords: { keyword: string; count: number }[];
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/v1/admin/marketing/stats').then((r) => r.json()).then((d) => { setStats(d as typeof stats); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex items-center justify-center py-16"><Loader2 size={24} className="animate-spin" style={{ color: 'oklch(0.55 0.015 240)' }} /></div>;
  if (!stats) return <div className="text-center py-16 text-sm" style={{ color: 'oklch(0.45 0.015 240)' }}>Erro ao carregar stats</div>;

  return (
    <div className="p-4 max-w-3xl mx-auto">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {[
          { l: 'Total Leads', v: stats.total, c: 'oklch(0.72 0.015 240)' },
          { l: 'Hoje', v: stats.hoje, c: '#60A5FA' },
          { l: 'Convertidos', v: stats.convertidos, c: '#34D399' },
          { l: 'Taxa Conv.', v: `${stats.taxa}%`, c: '#C084FC' },
        ].map((s) => (
          <div key={s.l} className="rounded-xl p-4 text-center" style={{ background: 'oklch(0.1 0.015 240)', border: '1px solid oklch(0.18 0.015 240)' }}>
            <div className="text-2xl font-bold mb-1" style={{ color: s.c }}>{s.v}</div>
            <div className="text-xs" style={{ color: 'oklch(0.48 0.015 240)' }}>{s.l}</div>
          </div>
        ))}
      </div>
      {stats.porRede.length > 0 && (
        <div className="rounded-xl p-4 mb-4" style={{ background: 'oklch(0.1 0.015 240)', border: '1px solid oklch(0.18 0.015 240)' }}>
          <p className="text-xs font-semibold tracking-widest mb-3" style={{ color: 'oklch(0.45 0.015 240)' }}>POR REDE</p>
          {stats.porRede.map((r) => {
            const p = PLATFORM_CONFIG[r.rede] ?? PLATFORM_CONFIG.facebook;
            const pct = stats.total > 0 ? Math.round((r.count / stats.total) * 100) : 0;
            return (
              <div key={r.rede} className="flex items-center gap-3 mb-2">
                <span className="text-xs font-semibold w-20" style={{ color: p.textColor }}>{r.rede.toUpperCase()}</span>
                <div className="flex-1 h-2 rounded-full" style={{ background: 'oklch(0.15 0.015 240)' }}>
                  <div className="h-2 rounded-full" style={{ width: `${pct}%`, background: p.textColor }} />
                </div>
                <span className="text-xs w-8 text-right" style={{ color: 'oklch(0.55 0.015 240)' }}>{r.count}</span>
              </div>
            );
          })}
        </div>
      )}
      {stats.topKeywords.length > 0 && (
        <div className="rounded-xl p-4" style={{ background: 'oklch(0.1 0.015 240)', border: '1px solid oklch(0.18 0.015 240)' }}>
          <p className="text-xs font-semibold tracking-widest mb-3" style={{ color: 'oklch(0.45 0.015 240)' }}>TOP KEYWORDS</p>
          {stats.topKeywords.map((k) => (
            <div key={k.keyword} className="flex items-center justify-between py-1.5" style={{ borderBottom: '1px solid oklch(0.13 0.015 240)' }}>
              <span className="text-sm" style={{ color: 'oklch(0.72 0.015 240)' }}>{k.keyword}</span>
              <span className="text-xs font-semibold" style={{ color: '#60A5FA' }}>{k.count}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── WebhookPanel ─────────────────────────────────────────────────────────────
function WebhookPanel() {
  const [copied, setCopied] = useState<string | null>(null);
  const [logs, setLogs] = useState<Lead[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const WEBHOOK_TOKEN = 'backfindr-webhook-secret-2024';
  const baseUrl = 'https://backfindr.com';
  const endpoint = `${baseUrl}/api/v1/admin/marketing/webhook`;
  const curl = `curl -X POST ${endpoint} \\\n  -H "Content-Type: application/json" \\\n  -H "Authorization: Bearer ${WEBHOOK_TOKEN}" \\\n  -d '{\n    "rede": "facebook",\n    "texto": "Perdi meu celular ontem na Paulista, urgente!",\n    "link": "https://facebook.com/post/123",\n    "keyword": "perdi celular",\n    "usuario": "@joao_silva",\n    "cidade": "São Paulo",\n    "tipoItem": "celular",\n    "comentarios": 3\n  }'`;

  const copy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  const fetchLogs = async () => {
    setLoadingLogs(true);
    const r = await fetch('/api/v1/admin/marketing/leads?limit=10&offset=0');
    if (r.ok) { const d = await r.json() as { leads: Lead[] }; setLogs(d.leads ?? []); }
    setLoadingLogs(false);
  };

  useEffect(() => { fetchLogs(); }, []);

  return (
    <div className="p-4 max-w-3xl mx-auto">
      {/* Status */}
      <div className="rounded-xl p-4 mb-5" style={{ background: 'oklch(0.1 0.015 240)', border: '1px solid oklch(0.18 0.015 240)' }}>
        <p className="text-xs font-semibold tracking-widest mb-4" style={{ color: 'oklch(0.45 0.015 240)' }}>STATUS DA INTEGRAÇÃO</p>
        <div className="grid grid-cols-4 gap-3 mb-4">
          {[['Status', '● Online', 'green'], ['Recebidos', String(logs.length), 'neutral'], ['Sucesso', '—', 'neutral'], ['Taxa', '—', 'neutral']].map(([label, val, c]) => (
            <div key={label} className="text-center">
              <p className="text-xs mb-1" style={{ color: 'oklch(0.45 0.015 240)' }}>{label}</p>
              <p className="text-sm font-bold" style={{ color: c === 'green' ? '#34D399' : 'oklch(0.7 0.015 240)' }}>{val}</p>
            </div>
          ))}
        </div>
        <div className="mb-2">
          <p className="text-xs mb-1" style={{ color: 'oklch(0.45 0.015 240)' }}>Endpoint</p>
          <div className="flex items-center gap-2">
            <p className="text-xs font-mono flex-1" style={{ color: '#60A5FA' }}>{endpoint}</p>
            <button onClick={() => copy(endpoint, 'endpoint')} className="p-1.5 rounded" style={{ background: 'oklch(0.15 0.015 240)', color: 'oklch(0.55 0.015 240)' }}>
              {copied === 'endpoint' ? <Check size={12} style={{ color: '#34D399' }} /> : <Copy size={12} />}
            </button>
          </div>
        </div>
        <div>
          <p className="text-xs mb-1" style={{ color: 'oklch(0.45 0.015 240)' }}>Token de autenticação</p>
          <div className="flex items-center gap-2">
            <p className="text-xs font-mono flex-1" style={{ color: 'oklch(0.6 0.015 240)' }}>backfindr-we•••••••••••••</p>
            <button onClick={() => copy(WEBHOOK_TOKEN, 'token')} className="p-1.5 rounded" style={{ background: 'oklch(0.15 0.015 240)', color: 'oklch(0.55 0.015 240)' }}>
              {copied === 'token' ? <Check size={12} style={{ color: '#34D399' }} /> : <Copy size={12} />}
            </button>
          </div>
        </div>
      </div>

      {/* Guias */}
      <div className="rounded-xl p-4 mb-5" style={{ background: 'oklch(0.1 0.015 240)', border: '1px solid oklch(0.18 0.015 240)' }}>
        <p className="text-xs font-semibold tracking-widest mb-4" style={{ color: 'oklch(0.45 0.015 240)' }}>GUIAS DE INTEGRAÇÃO POR REDE</p>
        {[
          { label: 'Facebook — Apify (Recomendado)', badge: 'Principal', badgeColor: '#3B82F6' },
          { label: 'Facebook — Make + TexAu (Alternativa)', badge: 'Alternativa', badgeColor: '#8B5CF6' },
          { label: 'Instagram — Hashtags + Make', badge: 'Reforço', badgeColor: '#EC4899' },
          { label: 'Twitter/X — Busca Tempo Real + Make', badge: 'Baixo Volume', badgeColor: '#6B7280' },
          { label: 'Reddit — Comunidades + Make', badge: 'Confiança', badgeColor: '#F59E0B' },
        ].map((g) => (
          <div key={g.label} className="flex items-center justify-between py-3" style={{ borderBottom: '1px solid oklch(0.13 0.015 240)' }}>
            <div className="flex items-center gap-2">
              <ChevronDown size={14} style={{ color: 'oklch(0.4 0.015 240)' }} />
              <span className="text-sm" style={{ color: 'oklch(0.75 0.015 240)' }}>{g.label}</span>
            </div>
            <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: `${g.badgeColor}20`, color: g.badgeColor }}>{g.badge}</span>
          </div>
        ))}
      </div>

      {/* cURL */}
      <div className="rounded-xl p-4 mb-5" style={{ background: 'oklch(0.1 0.015 240)', border: '1px solid oklch(0.18 0.015 240)' }}>
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-semibold tracking-widest" style={{ color: 'oklch(0.45 0.015 240)' }}>EXEMPLO — CURL</p>
          <button onClick={() => copy(curl, 'curl')} className="flex items-center gap-1 px-2 py-1 rounded text-xs" style={{ background: 'oklch(0.15 0.015 240)', color: 'oklch(0.55 0.015 240)' }}>
            {copied === 'curl' ? <Check size={11} style={{ color: '#34D399' }} /> : <Copy size={11} />} {copied === 'curl' ? 'Copiado!' : 'Copiar'}
          </button>
        </div>
        <pre className="text-xs overflow-x-auto leading-relaxed" style={{ color: 'oklch(0.65 0.015 240)', fontFamily: 'monospace' }}>{curl}</pre>
      </div>

      {/* Logs */}
      <div className="rounded-xl p-4" style={{ background: 'oklch(0.1 0.015 240)', border: '1px solid oklch(0.18 0.015 240)' }}>
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-semibold tracking-widest" style={{ color: 'oklch(0.45 0.015 240)' }}>ÚLTIMOS LEADS RECEBIDOS</p>
          <button onClick={fetchLogs} disabled={loadingLogs} className="flex items-center gap-1 px-2 py-1 rounded text-xs" style={{ background: 'oklch(0.15 0.015 240)', color: 'oklch(0.55 0.015 240)', border: '1px solid oklch(0.22 0.015 240)' }}>
            {loadingLogs ? <Loader2 size={11} className="animate-spin" /> : <RefreshCw size={11} />} Atualizar
          </button>
        </div>
        {logs.length === 0 ? (
          <p className="text-xs text-center py-4" style={{ color: 'oklch(0.4 0.015 240)' }}>Nenhum lead recebido ainda</p>
        ) : (
          <div className="space-y-2">
            {logs.map((l) => {
              const p = PLATFORM_CONFIG[l.rede] ?? PLATFORM_CONFIG.facebook;
              return (
                <div key={l.id} className="flex items-center gap-3 p-2 rounded-lg" style={{ background: 'oklch(0.065 0.015 240)' }}>
                  <span className="text-xs font-mono px-1.5 py-0.5 rounded" style={{ background: p.bg, color: p.textColor }}>{l.rede}</span>
                  <span className="flex-1 text-xs truncate" style={{ color: 'oklch(0.65 0.015 240)' }}>{l.texto?.slice(0, 80)}...</span>
                  <span className="text-xs" style={{ color: scoreColor(l.score) }}>score {l.score}</span>
                  <span className="text-xs" style={{ color: 'oklch(0.4 0.015 240)' }}>{timeAgo(l.created_at)}</span>
                </div>
              );
            })}
          </div>
        )}
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
  const [testBusy, setTestBusy] = useState(false);
  const [testMsg, setTestMsg] = useState<string | null>(null);

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

  // Testar Automação: dispara um run de teste com keyword "perdi" e importa
  const testarAutomacao = async () => {
    setTestBusy(true); setTestMsg(null);
    // Usar o primeiro config ativo ou criar um temporário
    const cfg = configs.find((c) => c.ativo);
    if (!cfg) {
      // Criar config temporário
      const cr = await fetch('/api/v1/admin/marketing/apify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ keyword: 'perdi', max_results: 20, rede: 'facebook', actor_id: 'powerai/facebook-post-search-scraper' }) });
      if (!cr.ok) { setTestMsg('❌ Erro ao criar config de teste'); setTestBusy(false); return; }
      const cd = await cr.json() as { id?: number };
      if (!cd.id) { setTestMsg('❌ Erro ao criar config'); setTestBusy(false); return; }
      const rr = await fetch('/api/v1/admin/marketing/apify/run', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ config_id: cd.id }) });
      const rd = await rr.json() as { detail?: string; saved?: number; message?: string };
      setTestMsg(rr.ok ? `✅ Teste OK — ${rd.saved ?? 0} leads` : `❌ ${rd.detail ?? 'Erro'}`);
      if (rr.ok) onLeadReceived();
      await fetch(`/api/v1/admin/marketing/apify?id=${cd.id}`, { method: 'DELETE' });
    } else {
      const rr = await fetch('/api/v1/admin/marketing/apify/run', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ config_id: cfg.id }) });
      const rd = await rr.json() as { detail?: string; saved?: number; message?: string };
      setTestMsg(rr.ok ? `✅ Teste OK — ${rd.saved ?? 0} leads` : `❌ ${rd.detail ?? 'Erro'}`);
      if (rr.ok) onLeadReceived();
    }
    setTestBusy(false);
  };

  const SUGS = ['perdi', 'roubaram', 'perdido', 'sumiu', 'desapareceu', 'perdi meu celular', 'roubaram minha mochila', 'perdeu o cachorro', 'perdeu documento', 'achadoseperdidos'];

  return (
    <div className="p-4 max-w-3xl mx-auto">
      <RadarPanel />
      <div className="h-5" />
      {/* Como funciona */}
      <div className="rounded-xl p-4 mb-5" style={{ background: 'oklch(0.1 0.015 240)', border: '1px solid oklch(0.18 0.015 240)' }}>
        <div className="flex items-center gap-2 mb-1"><Zap size={16} style={{ color: '#60A5FA' }} /><h3 className="text-sm font-bold" style={{ color: 'oklch(0.88 0.015 240)' }}>Buscas Automáticas no Facebook</h3></div>
        <p className="text-xs mb-3" style={{ color: 'oklch(0.5 0.015 240)' }}>Configure as palavras-chave e dispare buscas diretamente no Apify. Os leads chegam automaticamente via webhook.</p>
        <p className="text-xs" style={{ color: 'oklch(0.38 0.015 240)' }}>Como funciona: Ao clicar em &quot;Disparar&quot;, o sistema inicia o actor no Apify com a keyword configurada. Quando o actor termina, ele envia os posts automaticamente via webhook e os leads aparecem na fila. O processo leva entre 1-5 minutos dependendo do volume.</p>
      </div>

      {!hasApify && (
        <div className="flex items-center gap-2 p-3 rounded-lg mb-4" style={{ background: 'oklch(0.15 0.08 50 / 0.3)', border: '1px solid oklch(0.3 0.1 50 / 0.4)' }}>
          <AlertCircle size={14} style={{ color: '#FBBF24' }} />
          <span className="text-xs" style={{ color: '#FBBF24' }}>Configure <code>APIFY_API_TOKEN</code> no Vercel para habilitar coleta automática.</span>
        </div>
      )}

      {/* Testar Automação */}
      <div className="rounded-xl p-4 mb-5" style={{ background: 'oklch(0.1 0.015 240)', border: '1px solid oklch(0.18 0.015 240)' }}>
        <p className="text-xs font-semibold tracking-widest mb-3" style={{ color: 'oklch(0.45 0.015 240)' }}>TESTAR AUTOMAÇÃO</p>
        <p className="text-xs mb-3" style={{ color: 'oklch(0.5 0.015 240)' }}>Clique para disparar um run de teste e verificar se a integração Apify → Leads está funcionando.</p>
        <button onClick={testarAutomacao} disabled={testBusy}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-opacity hover:opacity-80"
          style={{ background: 'linear-gradient(135deg, oklch(0.2 0.08 255), oklch(0.25 0.1 265))', border: '1px solid oklch(0.3 0.1 255 / 0.4)', color: 'oklch(0.82 0.12 255)' }}>
          {testBusy ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
          {testBusy ? 'Testando...' : 'Testar Automação'}
        </button>
        {testMsg && <div className="mt-2 p-2 rounded text-xs" style={{ background: 'oklch(0.1 0.015 240)', border: '1px solid oklch(0.2 0.015 240)', color: 'oklch(0.7 0.015 240)' }}>{testMsg}</div>}
      </div>

      {/* Keywords */}
      <div className="mb-5">
        <p className="text-xs font-semibold tracking-widest mb-3" style={{ color: 'oklch(0.45 0.015 240)' }}>KEYWORDS CONFIGURADAS ({configs.length})</p>
        {loading ? <div className="flex justify-center py-4"><Loader2 size={18} className="animate-spin" style={{ color: 'oklch(0.5 0.015 240)' }} /></div>
          : configs.length === 0 ? <p className="text-xs text-center py-4" style={{ color: 'oklch(0.4 0.015 240)' }}>Nenhuma keyword configurada ainda.</p>
          : configs.map((cfg) => (
            <div key={cfg.id} className="flex items-center gap-3 p-3 rounded-lg mb-2" style={{ background: 'oklch(0.1 0.015 240)', border: '1px solid oklch(0.18 0.015 240)' }}>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold" style={{ color: 'oklch(0.82 0.015 240)' }}>{cfg.keyword}</p>
                <p className="text-xs" style={{ color: 'oklch(0.45 0.015 240)' }}>{cfg.rede} · max {cfg.max_results} · {cfg.last_run_at ? `último: ${timeAgo(cfg.last_run_at)}` : 'nunca executado'}</p>
              </div>
              <button onClick={() => run(cfg)} disabled={running === cfg.id}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold"
                style={{ background: 'oklch(0.18 0.08 255 / 0.4)', border: '1px solid oklch(0.3 0.1 255 / 0.3)', color: 'oklch(0.82 0.12 255)' }}>
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
          <input type="text" value={form.keyword} onChange={(e) => setForm({ ...form, keyword: e.target.value })} placeholder="Ex: perdi meu celular"
            className="flex-1 px-3 py-2 rounded-lg text-sm" style={{ background: 'oklch(0.065 0.015 240)', border: '1px solid oklch(0.2 0.015 240)', color: 'oklch(0.85 0.015 240)' }} />
          <input type="number" value={form.max_results} onChange={(e) => setForm({ ...form, max_results: parseInt(e.target.value) || 100 })}
            className="w-20 px-3 py-2 rounded-lg text-sm text-center" style={{ background: 'oklch(0.065 0.015 240)', border: '1px solid oklch(0.2 0.015 240)', color: 'oklch(0.85 0.015 240)' }} />
          <button onClick={create} disabled={!form.keyword.trim()} className="px-4 py-2 rounded-lg text-sm font-semibold"
            style={{ background: 'oklch(0.18 0.06 255 / 0.4)', border: '1px solid oklch(0.3 0.1 255 / 0.3)', color: 'oklch(0.82 0.12 255)' }}>
            <Plus size={14} className="inline mr-1" /> Adicionar
          </button>
        </div>
        <select value={form.actor_id} onChange={(e) => setForm({ ...form, actor_id: e.target.value })}
          className="w-full px-3 py-2 rounded-lg text-sm mb-3" style={{ background: 'oklch(0.065 0.015 240)', border: '1px solid oklch(0.2 0.015 240)', color: 'oklch(0.85 0.015 240)' }}>
          <option value="powerai/facebook-post-search-scraper">Facebook Post Search (Recomendado)</option>
          <option value="apify/instagram-hashtag-scraper">Instagram Hashtag Scraper</option>
          <option value="trudax/reddit-scraper">Reddit Scraper</option>
        </select>
        <p className="text-xs mb-2" style={{ color: 'oklch(0.45 0.015 240)' }}>SUGESTÕES RÁPIDAS</p>
        <div className="flex flex-wrap gap-1.5">
          {SUGS.map((s) => (
            <button key={s} onClick={() => setForm({ ...form, keyword: s })}
              className="px-2.5 py-1 rounded-full text-xs font-medium"
              style={{ background: 'oklch(0.13 0.06 255 / 0.3)', border: '1px solid oklch(0.25 0.1 255 / 0.3)', color: 'oklch(0.72 0.12 255)' }}>
              + {s}
            </button>
          ))}
        </div>
      </div>

      {/* Importar por Run ID */}
      <div className="rounded-xl p-4" style={{ background: 'oklch(0.1 0.015 240)', border: '1px solid oklch(0.18 0.015 240)' }}>
        <p className="text-xs font-semibold tracking-widest mb-2" style={{ color: 'oklch(0.45 0.015 240)' }}>IMPORTAR MANUALMENTE (RUN ID)</p>
        <p className="text-xs mb-3" style={{ color: 'oklch(0.45 0.015 240)' }}>Rodou o actor diretamente no Apify? Cole o Run ID abaixo para importar os posts.</p>
        <div className="flex gap-2 mb-2">
          <input type="text" value={importRunId} onChange={(e) => setImportRunId(e.target.value)} placeholder="Run ID (ex: rVct0VjBkQBHhIGia)"
            className="flex-1 px-3 py-2 rounded-lg text-sm" style={{ background: 'oklch(0.065 0.015 240)', border: '1px solid oklch(0.2 0.015 240)', color: 'oklch(0.85 0.015 240)' }} />
          <input type="text" value={importKeyword} onChange={(e) => setImportKeyword(e.target.value)} placeholder="Keyword (opcional)"
            className="w-36 px-3 py-2 rounded-lg text-sm" style={{ background: 'oklch(0.065 0.015 240)', border: '1px solid oklch(0.2 0.015 240)', color: 'oklch(0.85 0.015 240)' }} />
          <button onClick={importRun} disabled={importing || !importRunId.trim()}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold"
            style={{ background: 'oklch(0.18 0.06 255 / 0.4)', border: '1px solid oklch(0.3 0.1 255 / 0.3)', color: 'oklch(0.82 0.12 255)' }}>
            {importing && <Loader2 size={13} className="animate-spin" />} Importar
          </button>
        </div>
        <p className="text-xs" style={{ color: 'oklch(0.4 0.015 240)' }}>O Run ID aparece na URL do Apify: <code style={{ color: '#60A5FA' }}>console.apify.com/actors/.../runs/SEU_RUN_ID</code></p>
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
  const [bar, setBar] = useState({ total: 0, quentes: 0, descartados: 0, abordados: 0, convertidos: 0, taxa: 0, resolvidos: 0 });

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    try {
      const [r, rResolvidos] = await Promise.all([
        fetch('/api/v1/admin/marketing/leads?limit=200'),
        fetch('/api/v1/admin/marketing/leads?limit=200&mostrarResolvidos=true'),
      ]);
      const totalResolvidos = rResolvidos.ok ? ((await rResolvidos.json() as { leads?: {resolvido:boolean}[] }).leads ?? []).filter((l) => l.resolvido).length : 0;
      const r2 = r;
      if (r.ok) {
        const d = await r2.json() as { leads: Lead[]; total: number };
        const ls = d.leads ?? [];
        setLeads(ls);
        setTotal(d.total ?? 0);
        const quentes = ls.filter((l) => l.score >= 6 && l.status !== 'descartado').length;
        const resolvidos = totalResolvidos;
        const descartados = ls.filter((l) => l.status === 'descartado').length;
        const abordados = ls.filter((l) => ['abordado', 'respondeu', 'convertido'].includes(l.status)).length;
        const convertidos = ls.filter((l) => l.status === 'convertido').length;
        const taxa = ls.length > 0 ? Math.round((convertidos / ls.length) * 100) : 0;
        setBar({ total: d.total ?? 0, quentes, descartados, abordados, convertidos, taxa, resolvidos });
      }
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchLeads(); }, [fetchLeads]);

  const tabs = [
    { key: 'fila' as const,      label: 'Fila de Leads', icon: <Layers size={16} /> },
    { key: 'stats' as const,     label: 'Stats',         icon: <BarChart2 size={16} /> },
    { key: 'webhook' as const,   label: 'Webhook',       icon: <Webhook size={16} /> },
    { key: 'automacao' as const, label: 'Automação',     icon: <Zap size={16} /> },
  ];

  return (
    <div className="flex flex-col min-h-screen" style={{ background: 'oklch(0.065 0.015 240)', color: 'oklch(0.88 0.015 240)' }}>
      {/* Header */}
      <header className="sticky top-0 z-50 flex items-center justify-between px-3 md:px-4 h-14 shrink-0"
        style={{ background: 'oklch(0.075 0.015 240)', borderBottom: '1px solid oklch(0.18 0.015 240)' }}>
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg text-white font-bold text-sm shrink-0"
            style={{ background: 'linear-gradient(135deg, oklch(0.55 0.22 255), oklch(0.45 0.22 270))' }}>S</div>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-white tracking-tight leading-tight truncate">Sistema de Captura Multi-Redes</div>
            <div className="text-[10px] tracking-widest hidden sm:block" style={{ color: 'oklch(0.45 0.015 240)' }}>LEAD OPS CENTER</div>
          </div>
        </div>
        <nav className="hidden md:flex gap-1">
          {tabs.map(({ key, label, icon }) => (
            <button key={key} onClick={() => setTab(key)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-all"
              style={{ background: tab === key ? 'oklch(0.18 0.06 255 / 0.5)' : 'transparent', color: tab === key ? 'oklch(0.82 0.12 255)' : 'oklch(0.55 0.015 240)', border: tab === key ? '1px solid oklch(0.3 0.1 255 / 0.3)' : '1px solid transparent' }}>
              {icon} {label}
            </button>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <button
            onClick={async () => {
              if (!confirm('Arquivar todos os leads ativos e iniciar novo ciclo?')) return;
              const r = await fetch('/api/v1/admin/marketing/leads/novo-ciclo', { method: 'POST' });
              const d = await r.json();
              if (r.ok) { alert(d.mensagem); fetchLeads(); }
              else alert('Erro ao iniciar novo ciclo');
            }}
            title="Arquivar leads atuais e iniciar novo ciclo"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all hover:opacity-80"
            style={{ background: 'oklch(0.18 0.08 280 / 0.4)', border: '1px solid oklch(0.3 0.1 280 / 0.3)', color: 'oklch(0.82 0.12 280)' }}
          >
            <RotateCcw size={13} /> Novo Ciclo
          </button>
          <button onClick={fetchLeads} className="p-2 rounded-lg" style={{ background: 'oklch(0.13 0.015 240)', color: 'oklch(0.55 0.015 240)' }}><RefreshCw size={14} /></button>
        </div>
      </header>

      {/* Stats bar */}
      <div className="flex items-center gap-4 md:gap-6 px-3 md:px-4 py-2.5 overflow-x-auto shrink-0"
        style={{ background: 'oklch(0.075 0.015 240)', borderBottom: '1px solid oklch(0.13 0.015 240)' }}>
        {[
          { v: bar.total,       label: 'LEADS',       color: 'oklch(0.72 0.015 240)' },
          { v: bar.quentes,     label: 'QUENTES 🔥',  color: '#F87171' },
          { v: bar.descartados, label: 'DESCARTADOS', color: 'oklch(0.55 0.12 25)' },
          { v: bar.abordados,   label: 'ABORDADOS',   color: '#60A5FA' },
          { v: bar.convertidos, label: 'CONVERTIDOS', color: '#34D399' },
          { v: `${bar.taxa}%`,  label: 'TAXA',        color: '#C084FC' },
          { v: bar.resolvidos,   label: 'RESOLVIDOS',  color: '#34D399' },
        ].map((s) => (
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
      <main className="flex-1 overflow-hidden pb-16 md:pb-0">
        {tab === 'fila'      && <LeadQueue leads={leads} loading={loading} onRefresh={fetchLeads} total={total} />}
        {tab === 'stats'     && <StatsPanel />}
        {tab === 'webhook'   && <WebhookPanel />}
        {tab === 'automacao' && <AutomacaoPanel onLeadReceived={fetchLeads} />}
      </main>

      {/* Mobile bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 flex md:hidden"
        style={{ background: 'oklch(0.075 0.015 240)', borderTop: '1px solid oklch(0.18 0.015 240)' }}>
        {tabs.map(({ key, label, icon }) => (
          <button key={key} onClick={() => setTab(key)}
            className="flex-1 flex flex-col items-center justify-center gap-1 py-3 transition-all"
            style={{ color: tab === key ? 'oklch(0.82 0.12 255)' : 'oklch(0.5 0.015 240)' }}>
            {icon}
            <span className="text-[11px] font-medium">{label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
