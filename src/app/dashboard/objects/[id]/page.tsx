'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ChevronLeft, QrCode, MapPin, Calendar, Tag,
  Share2, Trash2, Edit2, Download, CheckCircle2,
  AlertTriangle, Clock, Package, ExternalLink, Copy, Gift, Zap, Star, Info, Loader2
} from 'lucide-react';
import RecoveredCelebration from '@/components/RecoveredCelebration';
import LocationMap from '@/components/LocationMap';
import BoostRenewalSuggestion from '@/components/BoostRenewalSuggestion';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { objectsApi, parseApiError } from '@/lib/api';
import { ImageLightbox, useLightbox } from '@/components/ImageLightbox';
import { RegisteredObject } from '@/types';
import Cookies from 'js-cookie';

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORY_EMOJI: Record<string, string> = {
  phone: '📱', wallet: '👛', keys: '🔑', bag: '🎒', pet: '🐾',
  bike: '🚲', vehicle: '🚗', document: '📄', jewelry: '💍', electronics: '💻',
  clothing: '👕', other: '📦',
};

const CATEGORY_LABEL: Record<string, string> = {
  phone: 'Celular', wallet: 'Carteira', keys: 'Chaves', bag: 'Bolsa / Mochila',
  pet: 'Pet / Animal', bike: 'Bicicleta', vehicle: 'Veículo', document: 'Documento',
  jewelry: 'Joia / Relógio', electronics: 'Eletrônico', clothing: 'Roupa', other: 'Outro',
};

const STATUS_CONFIG: Record<string, { label: string; icon: React.ReactNode; color: string; bg: string }> = {
  lost:     { label: 'Perdido',     icon: <AlertTriangle className="w-4 h-4" />, color: 'text-red-400',    bg: 'bg-red-500/10 border-red-500/20' },
  found:    { label: 'Achado',      icon: <Package className="w-4 h-4" />,       color: 'text-brand-400',  bg: 'bg-brand-500/10 border-brand-500/20' },
  returned: { label: 'Recuperado',  icon: <CheckCircle2 className="w-4 h-4" />,  color: 'text-green-400',  bg: 'bg-green-500/10 border-green-500/20' },
  stolen:   { label: 'Roubado',     icon: <Clock className="w-4 h-4" />,         color: 'text-orange-400', bg: 'bg-orange-500/10 border-orange-500/20' },
};

// ─── QR Code component ────────────────────────────────────────────────────────

function QRCodeDisplay({ code, title, status }: { code: string; title: string; status: string }) {
  const isLost = status === 'lost' || status === 'stolen';
  const scanUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://backfindr.com.br'}/scan/${code}`;
  const [theme, setTheme] = useState<'dark'|'light'|'teal'>('dark');
  const [size, setSize] = useState<'85x55'|'50x50'|'a4'>('85x55');
  const [showPrintOptions, setShowPrintOptions] = useState(false);

  const themes = {
    dark:  { label: 'Escuro', fg: '14b8a6', bg: '0f172a', border: '#14b8a6', cardBg: '#0f172a', cardText: '#ffffff', cardSub: '#94a3b8', cardBrand: '#14b8a6' },
    light: { label: 'Claro',  fg: '0f172a', bg: 'ffffff', border: '#0f172a', cardBg: '#ffffff', cardText: '#0f172a', cardSub: '#475569', cardBrand: '#0f172a' },
    teal:  { label: 'Teal',   fg: 'ffffff', bg: '14b8a6', border: '#0d9488', cardBg: '#14b8a6', cardText: '#ffffff', cardSub: '#ccfbf1', cardBrand: '#ffffff' },
  };
  const sizes = {
    '85x55': { label: 'Cartao (85x55mm)', desc: 'Padrao cartao de visita' },
    '50x50': { label: 'Adesivo (50x50mm)', desc: 'Ideal para colar no objeto' },
    'a4':    { label: 'Folha A4 (4 etiquetas)', desc: 'Imprima 4 de uma vez' },
  };
  const t = themes[theme];
  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(scanUrl)}&color=${t.fg}&bgcolor=${t.bg}&margin=12`;

  const copyLink = () => { navigator.clipboard.writeText(scanUrl); toast.success('Link copiado!'); };
  const downloadQR = () => {
    const link = document.createElement('a');
    link.href = qrImageUrl;
    link.download = `backfindr-qr-${code}.png`;
    link.click();
  };
  const shareWhatsApp = () => {
    const msg = isLost
      ? `Perdi meu objeto e preciso de ajuda! Se voce viu ou encontrou, acesse: ${scanUrl}`
      : `Encontrei um objeto perdido. Se for seu, acesse: ${scanUrl}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
  };
  const shareTwitter = () => {
    const msg = isLost
      ? `Perdi meu objeto! Se alguem encontrou, acesse ${scanUrl} #Backfindr #AchouPerdeu`
      : `Encontrei um objeto perdido! Dono, acesse ${scanUrl} #Backfindr`;
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(msg)}`, '_blank');
  };
  const shareFacebook = () => {
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(scanUrl)}`, '_blank');
  };

  const buildPrintHTML = () => {
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(scanUrl)}&color=${t.fg}&bgcolor=${t.bg}&margin=10`;
    const baseStyles = `@page{size:85mm 55mm;margin:0}*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Helvetica Neue',Arial,sans-serif;width:85mm;height:55mm;display:flex;align-items:center;justify-content:center;background:${t.cardBg}}.card{width:83mm;height:53mm;border:1.5px solid ${t.border};border-radius:4mm;display:flex;align-items:center;gap:3mm;padding:3mm 4mm;overflow:hidden}.qr img{width:40mm;height:40mm;display:block}.info{flex:1;overflow:hidden}.brand{font-size:7pt;font-weight:700;color:${t.cardBrand};letter-spacing:.05em;text-transform:uppercase}.title{font-size:9pt;font-weight:700;color:${t.cardText};margin-top:1mm;line-height:1.2;word-break:break-word}.code{font-size:6.5pt;font-family:monospace;color:${t.cardSub};margin-top:2mm;letter-spacing:.08em}.cta{font-size:6pt;color:${t.cardSub};margin-top:1.5mm;line-height:1.3}.url{font-size:6pt;color:${t.cardBrand};font-weight:600;word-break:break-all}`;
    if (size === 'a4') {
      const cardHtml = `<div class="card" style="background:${t.cardBg};border-color:${t.border}"><div class="qr"><img src="${qrUrl}" alt="QR"/></div><div class="info"><div class="brand">Backfindr</div><div class="title">${title}</div><div class="code">${code}</div><div class="cta">Encontrou? Escaneie o QR Code ou acesse:</div><div class="url">${scanUrl}</div></div></div>`;
      return `<!DOCTYPE html><html><head><meta charset="UTF-8"/><style>@page{size:A4;margin:10mm}*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Helvetica Neue',Arial,sans-serif;display:grid;grid-template-columns:1fr 1fr;gap:8mm}.card{border:1.5px solid;border-radius:4mm;display:flex;align-items:center;gap:3mm;padding:3mm 4mm;overflow:hidden;height:55mm}.qr img{width:40mm;height:40mm;display:block}.info{flex:1;overflow:hidden}.brand{font-size:7pt;font-weight:700;letter-spacing:.05em;text-transform:uppercase}.title{font-size:9pt;font-weight:700;margin-top:1mm;line-height:1.2;word-break:break-word}.code{font-size:6.5pt;font-family:monospace;margin-top:2mm;letter-spacing:.08em}.cta{font-size:6pt;margin-top:1.5mm;line-height:1.3}.url{font-size:6pt;font-weight:600;word-break:break-all}</style></head><body>${cardHtml}${cardHtml}${cardHtml}${cardHtml}</body></html>`;
    }
    if (size === '50x50') {
      return `<!DOCTYPE html><html><head><meta charset="UTF-8"/><style>@page{size:50mm 50mm;margin:0}*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Helvetica Neue',Arial,sans-serif;width:50mm;height:50mm;display:flex;flex-direction:column;align-items:center;justify-content:center;background:${t.cardBg};padding:2mm}img{width:30mm;height:30mm;display:block;margin-bottom:1.5mm}.brand{font-size:6pt;font-weight:700;color:${t.cardBrand};letter-spacing:.05em;text-transform:uppercase}.code{font-size:6pt;font-family:monospace;color:${t.cardSub};letter-spacing:.08em}.url{font-size:5pt;color:${t.cardBrand};font-weight:600;word-break:break-all;text-align:center}</style></head><body><img src="${qrUrl}" alt="QR"/><div class="brand">Backfindr</div><div class="code">${code}</div><div class="url">${scanUrl}</div></body></html>`;
    }
    return `<!DOCTYPE html><html><head><meta charset="UTF-8"/><style>${baseStyles}</style></head><body><div class="card"><div class="qr"><img src="${qrUrl}" alt="QR"/></div><div class="info"><div class="brand">Backfindr</div><div class="title">${title}</div><div class="code">${code}</div><div class="cta">Encontrou? Escaneie o QR Code ou acesse:</div><div class="url">${scanUrl}</div></div></div></body></html>`;
  };

  const printLabel = () => {
    const printWindow = window.open('', '_blank', 'width=600,height=700');
    if (!printWindow) return;
    printWindow.document.write(buildPrintHTML());
    printWindow.document.close();
    printWindow.onload = () => { printWindow.focus(); printWindow.print(); };
  };

  return (
    <div className="glass rounded-2xl p-4 sm:p-6 flex flex-col items-center gap-4 w-full">
      <div className="flex items-center gap-2 self-start">
        <QrCode className="w-4 h-4 text-brand-400" />
        <h3 className="font-display font-semibold text-white text-sm">QR Code</h3>
      </div>

      {/* QR centralizado com tamanho responsivo */}
      <div className="p-3 bg-surface rounded-xl border border-surface-border">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={qrImageUrl} alt={`QR Code - ${title}`} width={180} height={180} className="rounded-lg w-[160px] h-[160px] sm:w-[180px] sm:h-[180px]" />
      </div>

      {/* Código com botão copiar — full width */}
      <div className="w-full bg-surface rounded-xl px-4 py-2.5 flex items-center justify-between gap-2 border border-surface-border min-w-0">
        <span className="font-mono text-brand-400 text-sm tracking-widest truncate">{code}</span>
        <button onClick={copyLink} className="text-slate-500 hover:text-white transition-colors flex-shrink-0">
          <Copy className="w-3.5 h-3.5" />
        </button>
      </div>

      <p className="text-slate-500 text-xs text-center leading-relaxed">
        {isLost
          ? 'Compartilhe este link ou QR Code com pessoas que possam ter visto o objeto.'
          : 'Cole este QR Code no objeto fisico. Quem escanear iniciara o processo de devolucao.'}
      </p>

      {/* Baixar + Copiar link */}
      <div className="flex gap-2 w-full">
        <button onClick={downloadQR} className="flex-1 flex items-center justify-center gap-1.5 glass hover:bg-surface text-slate-300 hover:text-white text-xs font-medium py-2.5 rounded-lg transition-all min-w-0">
          <Download className="w-3.5 h-3.5 flex-shrink-0" />
          <span className="truncate">Baixar PNG</span>
        </button>
        <button onClick={copyLink} className="flex-1 flex items-center justify-center gap-1.5 glass hover:bg-surface text-slate-300 hover:text-white text-xs font-medium py-2.5 rounded-lg transition-all min-w-0">
          <ExternalLink className="w-3.5 h-3.5 flex-shrink-0" />
          <span className="truncate">Copiar link</span>
        </button>
      </div>

      {/* Compartilhar nas redes — 3 botões em grid 3 colunas para não transbordar */}
      <div className="w-full">
        <p className="text-slate-500 text-xs mb-2 text-center">Compartilhar nas redes</p>
        <div className="grid grid-cols-3 gap-2">
          <button onClick={shareWhatsApp} className="flex flex-col items-center justify-center gap-1 bg-[#25D366]/10 hover:bg-[#25D366]/20 border border-[#25D366]/20 text-[#25D366] text-xs font-medium py-2.5 rounded-lg transition-all">
            <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current flex-shrink-0"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
            <span className="text-[10px]">WhatsApp</span>
          </button>
          <button onClick={shareTwitter} className="flex flex-col items-center justify-center gap-1 bg-black/20 hover:bg-black/40 border border-white/10 text-white/70 hover:text-white text-xs font-medium py-2.5 rounded-lg transition-all">
            <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current flex-shrink-0"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.73-8.835L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
            <span className="text-[10px]">Twitter/X</span>
          </button>
          <button onClick={shareFacebook} className="flex flex-col items-center justify-center gap-1 bg-[#1877F2]/10 hover:bg-[#1877F2]/20 border border-[#1877F2]/20 text-[#1877F2] text-xs font-medium py-2.5 rounded-lg transition-all">
            <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current flex-shrink-0"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
            <span className="text-[10px]">Facebook</span>
          </button>
        </div>
      </div>

      {/* Imprimir etiqueta */}
      <div className="w-full">
        <button
          onClick={() => setShowPrintOptions(!showPrintOptions)}
          className="w-full flex items-center justify-center gap-1.5 bg-brand-500/10 hover:bg-brand-500/20 border border-brand-500/20 text-brand-400 hover:text-brand-300 text-xs font-medium py-2.5 rounded-lg transition-all"
        >
          <Download className="w-3.5 h-3.5" />
          Imprimir etiqueta
        </button>
        {showPrintOptions && (
          <div className="mt-3 p-4 bg-surface rounded-xl border border-surface-border flex flex-col gap-3">
            <div>
              <p className="text-slate-400 text-xs mb-2 font-medium">Tema da etiqueta</p>
              <div className="flex gap-2">
                {(['dark', 'light', 'teal'] as const).map((k) => (
                  <button
                    key={k}
                    onClick={() => setTheme(k)}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition-all ${theme === k ? 'border-brand-400 text-brand-400 bg-brand-500/10' : 'border-white/10 text-slate-400 hover:text-white'}`}
                  >
                    {themes[k].label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-slate-400 text-xs mb-2 font-medium">Tamanho</p>
              <div className="flex flex-col gap-1.5">
                {(['85x55', '50x50', 'a4'] as const).map((k) => (
                  <button
                    key={k}
                    onClick={() => setSize(k)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs border transition-all ${size === k ? 'border-brand-400 text-brand-400 bg-brand-500/10' : 'border-white/10 text-slate-400 hover:text-white'}`}
                  >
                    <span className="font-medium">{sizes[k].label}</span>
                    <span className="text-slate-500">{sizes[k].desc}</span>
                  </button>
                ))}
              </div>
            </div>
            <button
              onClick={printLabel}
              className="w-full flex items-center justify-center gap-2 bg-brand-500 hover:bg-brand-600 text-white text-xs font-semibold py-2.5 rounded-lg transition-all"
            >
              <Download className="w-3.5 h-3.5" />
              Imprimir agora
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.lost;
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-sm font-medium ${cfg.color} ${cfg.bg}`}>
      {cfg.icon}
      {cfg.label}
    </span>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ObjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [showRecoveredModal, setShowRecoveredModal] = useState(false);
  const [obj, setObj] = useState<RegisteredObject | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [boostLoading, setBoostLoading] = useState<string | null>(null);
  const [posterLoading, setPosterLoading] = useState<'square' | 'vertical' | 'a4' | null>(null);
  const [activeBoost, setActiveBoost] = useState<{ id: string; type: string; expires_at: string } | null>(null);
  const { open: openLightbox, close: closeLightbox, lightbox } = useLightbox();

  // Buscar boost ativo do objeto
  useEffect(() => {
    if (!id) return;
    const token = Cookies.get('access_token');
    if (!token) return;
    fetch(`/api/v1/boost?object_id=${id}`, {
      headers: { 'Authorization': `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(data => { if (data.active_boost) setActiveBoost(data.active_boost); })
      .catch(() => {});
  }, [id]);

  const handleBoost = async (type: '7d' | '30d' | 'alert') => {
    const token = Cookies.get('access_token');
    if (!token) { window.location.href = '/auth/login'; return; }
    setBoostLoading(type);
    try {
      const res = await fetch('/api/v1/boost', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ object_id: id, type }),
      });
      const data = await res.json();
      if (data.boost) {
        setActiveBoost(data.boost);
        toast.success(data.test_mode ? '🚀 Boost ativado (modo teste)!' : '🚀 Boost ativado!');
      } else if (data.checkout_url) {
        window.location.href = data.checkout_url;
      } else if (data.detail || data.error) {
        toast.error(data.detail || data.error || 'Erro ao ativar boost.');
      } else {
        toast.error('Erro ao ativar boost. Tente novamente.');
      }
    } catch {
      toast.error('Erro ao ativar boost. Tente novamente.');
    } finally {
      setBoostLoading(null);
    }
  };

  useEffect(() => {
    objectsApi.get(id)
      .then(({ data }) => setObj(data))
      .catch((err) => {
        toast.error(parseApiError(err));
        router.push('/dashboard/objects');
      })
      .finally(() => setLoading(false));
  }, [id, router]);

  const handleDelete = async () => {
    if (!confirm('Tem certeza que deseja excluir este objeto? Esta ação não pode ser desfeita.')) return;
    setDeleting(true);
    try {
      await objectsApi.delete(id);
      toast.success('Objeto excluído.');
      router.push('/dashboard/objects');
    } catch (err) {
      toast.error(parseApiError(err));
      setDeleting(false);
    }
  };

  const handleShare = () => {
    const url = `${window.location.origin}/scan/${obj?.unique_code}`;
    if (navigator.share) {
      navigator.share({ title: obj?.title, url });
    } else {
      navigator.clipboard.writeText(url);
      toast.success('Link copiado!');
    }
  };

  // ── Loading skeleton ────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="p-4 sm:p-8 w-full max-w-5xl mx-auto">
        <div className="h-8 w-40 bg-surface-border rounded-xl animate-pulse mb-6" />
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 bg-surface-card rounded-2xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (!obj) return null;

  const isPet = obj.category === 'pet';

  return (
    <>
      {lightbox && <ImageLightbox images={lightbox.images} initialIndex={lightbox.index} onClose={closeLightbox} />}

      {/* Container principal — padding responsivo, sem overflow */}
      <div className="p-4 sm:p-6 lg:p-8 w-full max-w-5xl mx-auto overflow-x-hidden">

        {/* ── Header ── */}
        <div className="flex items-start justify-between mb-6 gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <Link
              href="/dashboard/objects"
              className="w-9 h-9 glass rounded-lg flex items-center justify-center text-slate-400 hover:text-white transition-colors flex-shrink-0 mt-0.5"
            >
              <ChevronLeft className="w-4 h-4" />
            </Link>
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className="text-xl sm:text-2xl flex-shrink-0">{CATEGORY_EMOJI[obj.category] ?? '📦'}</span>
                <h1 className="font-display text-lg sm:text-xl font-bold text-white leading-tight break-words">{obj.title}</h1>
              </div>
              <StatusBadge status={obj.status} />
            </div>
          </div>

          {/* Ações — sempre visíveis, sem overflow */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <button
              onClick={handleShare}
              className="w-9 h-9 glass rounded-lg flex items-center justify-center text-slate-400 hover:text-white transition-colors"
              title="Compartilhar"
            >
              <Share2 className="w-4 h-4" />
            </button>
            <Link
              href={`/dashboard/objects/${id}/edit`}
              className="w-9 h-9 glass rounded-lg flex items-center justify-center text-slate-400 hover:text-white transition-colors"
              title="Editar"
            >
              <Edit2 className="w-4 h-4" />
            </Link>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="w-9 h-9 glass rounded-lg flex items-center justify-center text-slate-400 hover:text-red-400 disabled:opacity-40 transition-colors"
              title="Excluir"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ── Body: coluna única no mobile, 3 colunas no desktop ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

          {/* ── Coluna esquerda — detalhes ── */}
          <div className="lg:col-span-2 space-y-4">

            {/* Fotos */}
            {obj.photos?.length > 0 && (
              <div className="glass rounded-2xl p-4 sm:p-5">
                <h2 className="font-display font-semibold text-white text-sm mb-4">Fotos</h2>
                <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-hide">
                  {obj.photos.map((url, i) => (
                    <button
                      key={i}
                      onClick={() => openLightbox(obj.photos, i)}
                      className="relative flex-shrink-0 w-32 h-32 rounded-xl overflow-hidden border border-surface-border hover:border-brand-500 transition-colors group"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={url}
                        alt={`${obj.title} — foto ${i + 1}`}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                      />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Descrição */}
            <div className="glass rounded-2xl p-4 sm:p-5">
              <h2 className="font-display font-semibold text-white text-sm mb-3">Descrição</h2>
              <p className="text-slate-300 text-sm leading-relaxed break-words">{obj.description}</p>
            </div>

            {/* Pet details */}
            {isPet && (obj.pet_species || obj.pet_breed || obj.pet_color || obj.pet_microchip) && (
              <div className="glass rounded-2xl p-4 sm:p-5">
                <h2 className="font-display font-semibold text-white text-sm mb-4 flex items-center gap-2">
                  🐾 Informações do Pet
                </h2>
                <div className="grid grid-cols-2 gap-4">
                  {obj.pet_species && (
                    <div>
                      <p className="text-slate-500 text-xs mb-0.5">Espécie</p>
                      <p className="text-slate-200 text-sm capitalize">{obj.pet_species}</p>
                    </div>
                  )}
                  {obj.pet_breed && (
                    <div>
                      <p className="text-slate-500 text-xs mb-0.5">Raça</p>
                      <p className="text-slate-200 text-sm">{obj.pet_breed}</p>
                    </div>
                  )}
                  {obj.pet_color && (
                    <div>
                      <p className="text-slate-500 text-xs mb-0.5">Cor</p>
                      <p className="text-slate-200 text-sm">{obj.pet_color}</p>
                    </div>
                  )}
                  {obj.pet_microchip && (
                    <div>
                      <p className="text-slate-500 text-xs mb-0.5">Microchip</p>
                      <p className="text-slate-200 text-sm font-mono break-all">{obj.pet_microchip}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Recompensa */}
            {obj.reward_amount && obj.reward_amount > 0 && (
              <div className="glass rounded-2xl p-4 sm:p-5 border border-yellow-500/20 bg-yellow-500/5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center flex-shrink-0">
                    <Gift className="w-5 h-5 text-yellow-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-yellow-400 font-semibold text-sm">Recompensa oferecida</p>
                    <p className="text-white font-bold text-xl">
                      R$ {obj.reward_amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                    {obj.reward_description && (
                      <p className="text-slate-400 text-xs mt-1 break-words">{obj.reward_description}</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Informações */}
            <div className="glass rounded-2xl p-4 sm:p-5">
              <h2 className="font-display font-semibold text-white text-sm mb-4">Informações</h2>
              <div className="space-y-3">
                <div className="flex items-center gap-3 text-sm">
                  <Tag className="w-4 h-4 text-slate-500 flex-shrink-0" />
                  <span className="text-slate-400 flex-shrink-0">Categoria</span>
                  <span className="text-slate-200 ml-auto text-right">{CATEGORY_LABEL[obj.category] ?? obj.category}</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <Calendar className="w-4 h-4 text-slate-500 flex-shrink-0" />
                  <span className="text-slate-400 flex-shrink-0">Registrado em</span>
                  <span className="text-slate-200 ml-auto text-right">
                    {format(new Date(obj.created_at), "dd/MM/yyyy", { locale: ptBR })}
                  </span>
                </div>
                {obj.location?.address && (
                  <div className="flex items-start gap-3 text-sm">
                    <MapPin className="w-4 h-4 text-slate-500 flex-shrink-0 mt-0.5" />
                    <span className="text-slate-400 flex-shrink-0">Local</span>
                    <span className="text-slate-200 ml-auto text-right break-words max-w-[55%]">{obj.location.address}</span>
                  </div>
                )}

                {/* Campos dinâmicos por categoria */}
                {obj.category_fields && Object.keys(obj.category_fields).length > 0 && (
                  <div className="pt-3 mt-3 border-t border-surface-border space-y-3">
                    {Object.entries(obj.category_fields).map(([key, value]) => {
                      if (!value) return null;
                      const label = key.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
                      return (
                        <div key={key} className="flex items-start gap-3 text-sm">
                          <Info className="w-4 h-4 text-brand-400 flex-shrink-0 mt-0.5" />
                          <span className="text-slate-400 flex-shrink-0">{label}</span>
                          <span className="text-slate-200 ml-auto text-right font-medium break-words max-w-[55%]">{String(value)}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Mapa */}
            {obj.location?.lat && obj.location?.lng && (
              <div className="glass rounded-2xl overflow-hidden">
                <LocationMap
                  lat={obj.location.lat}
                  lng={obj.location.lng}
                  title={obj.title}
                  address={obj.location.address}
                />
              </div>
            )}
          </div>

          {/* ── Coluna direita — Pôster + QR + ações ── */}
          <div className="space-y-4">
            {/* Baixar Pôster */}
            <div className="glass rounded-2xl p-4 sm:p-5">
              <div className="flex items-center gap-2 mb-3">
                <Download className="w-4 h-4 text-blue-400" />
                <h3 className="font-display font-semibold text-white text-sm">Baixar Pôster</h3>
              </div>
              <p className="text-slate-500 text-xs mb-4 leading-relaxed">
                Imprima e compartilhe o pôster do seu objeto em locais públicos.
              </p>
              <div className="flex flex-col gap-2">
                {/* Botão Quadrado */}
                <button
                  disabled={posterLoading !== null}
                  onClick={async () => {
                    setPosterLoading('square');
                    try {
                      const url = objectsApi.getPosterUrl(id, 'square');
                      const res = await fetch(url);
                      const blob = await res.blob();
                      const blobUrl = URL.createObjectURL(blob);
                      const link = document.createElement('a');
                      link.href = blobUrl;
                      link.download = `cartaz-${obj.unique_code}-square.png`;
                      link.style.display = 'none';
                      document.body.appendChild(link);
                      link.click();
                      document.body.removeChild(link);
                      URL.revokeObjectURL(blobUrl);
                      toast.success('Pôster quadrado baixado!');
                    } catch {
                      toast.error('Erro ao gerar pôster. Tente novamente.');
                    } finally {
                      setPosterLoading(null);
                    }
                  }}
                  className="w-full flex items-center justify-center gap-2 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 text-blue-400 hover:text-blue-300 text-xs font-medium py-2.5 rounded-lg transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {posterLoading === 'square'
                    ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Gerando pôster…</>
                    : <><Download className="w-3.5 h-3.5" /> Quadrado (1080×1080)</>}
                </button>

                {/* Botão Vertical */}
                <button
                  disabled={posterLoading !== null}
                  onClick={async () => {
                    setPosterLoading('vertical');
                    try {
                      const url = objectsApi.getPosterUrl(id, 'vertical');
                      const res = await fetch(url);
                      const blob = await res.blob();
                      const blobUrl = URL.createObjectURL(blob);
                      const link = document.createElement('a');
                      link.href = blobUrl;
                      link.download = `cartaz-${obj.unique_code}-vertical.png`;
                      link.style.display = 'none';
                      document.body.appendChild(link);
                      link.click();
                      document.body.removeChild(link);
                      URL.revokeObjectURL(blobUrl);
                      toast.success('Pôster vertical baixado!');
                    } catch {
                      toast.error('Erro ao gerar pôster. Tente novamente.');
                    } finally {
                      setPosterLoading(null);
                    }
                  }}
                  className="w-full flex items-center justify-center gap-2 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 text-blue-400 hover:text-blue-300 text-xs font-medium py-2.5 rounded-lg transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {posterLoading === 'vertical'
                    ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Gerando pôster…</>
                    : <><Download className="w-3.5 h-3.5" /> Vertical (1080×1920)</>}
                </button>

                {/* Botão A4 */}
                <button
                  disabled={posterLoading !== null}
                  onClick={async () => {
                    setPosterLoading('a4');
                    try {
                      const url = objectsApi.getPosterUrl(id, 'a4');
                      const res = await fetch(url);
                      const blob = await res.blob();
                      const blobUrl = URL.createObjectURL(blob);
                      const link = document.createElement('a');
                      link.href = blobUrl;
                      link.download = `cartaz-${obj.unique_code}-a4.png`;
                      link.style.display = 'none';
                      document.body.appendChild(link);
                      link.click();
                      document.body.removeChild(link);
                      URL.revokeObjectURL(blobUrl);
                      toast.success('Pôster A4 baixado!');
                    } catch {
                      toast.error('Erro ao gerar pôster. Tente novamente.');
                    } finally {
                      setPosterLoading(null);
                    }
                  }}
                  className="w-full flex items-center justify-center gap-2 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 text-blue-400 hover:text-blue-300 text-xs font-medium py-2.5 rounded-lg transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {posterLoading === 'a4'
                    ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Gerando pôster…</>
                    : <><Download className="w-3.5 h-3.5" /> A4 Retrato — Impressão</>}
                </button>
              </div>
            </div>

            <QRCodeDisplay code={obj.unique_code} title={obj.title} status={obj.status} />

            {/* Atualizar status */}
            <div className="glass rounded-2xl p-4 sm:p-5">
              <h3 className="font-display font-semibold text-white text-sm mb-3">Atualizar status</h3>
              <div className="space-y-2">
                {(['lost', 'found', 'returned'] as const).map((s) => {
                  const cfg = STATUS_CONFIG[s];
                  const active = obj.status === s;
                  return (
                    <button
                      key={s}
                      disabled={active}
                      onClick={async () => {
                        try {
                          await objectsApi.update(id, { status: s });
                          setObj((prev) => prev ? { ...prev, status: s } : prev);
                          if (s === 'returned') {
                            setShowRecoveredModal(true);
                          } else {
                            toast.success(`Status atualizado para ${cfg.label}`);
                          }
                        } catch (err) {
                          toast.error(parseApiError(err));
                        }
                      }}
                      className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm transition-all ${
                        active
                          ? `${cfg.color} ${cfg.bg} border cursor-default font-medium`
                          : 'text-slate-400 hover:text-white hover:bg-surface border border-transparent'
                      }`}
                    >
                      {cfg.icon}
                      {cfg.label}
                      {active && <CheckCircle2 className="w-3.5 h-3.5 ml-auto" />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Boost — apenas para perdidos/roubados */}
            {(obj.status === 'lost' || obj.status === 'stolen') && (
              <div className="relative overflow-hidden glass rounded-2xl p-4 sm:p-5 border border-amber-500/20 bg-amber-500/5 group">
                {/* Ícone decorativo de fundo */}
                <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity pointer-events-none">
                  <Zap className="w-20 h-20 text-amber-500" />
                </div>

                <div className="relative">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="p-1.5 bg-gradient-to-br from-amber-500 to-orange-600 rounded-lg flex-shrink-0">
                      <Zap className="w-3.5 h-3.5 text-white" />
                    </div>
                    <h3 className="font-display font-bold text-white text-sm">Impulsionar Visibilidade</h3>
                  </div>
                  <p className="text-slate-400 text-xs mb-4 leading-relaxed">
                    Destaque seu objeto no mapa e no feed para que mais pessoas o vejam.
                  </p>

                  {activeBoost && (
                    <div className="mb-4 px-3 py-2.5 bg-green-500/10 border border-green-500/20 rounded-xl flex items-center gap-3">
                      <div className="relative flex h-2.5 w-2.5 flex-shrink-0">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"></span>
                      </div>
                      <div>
                        <p className="text-green-400 text-xs font-bold">Boost Ativo</p>
                        <p className="text-slate-500 text-[10px]">
                          Expira em {new Date(activeBoost.expires_at).toLocaleDateString('pt-BR')}
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="space-y-2">
                    {([
                      { type: '7d'    as const, label: '⚡ Boost 7 dias',   price: 'R$ 9,90',  desc: 'Destaque total por uma semana' },
                      { type: '30d'   as const, label: '⭐ Boost 30 dias',  price: 'R$ 24,90', desc: 'Destaque mensal + notificações' },
                      { type: 'alert' as const, label: '🔔 Alerta de Área', price: 'R$ 14,90', desc: 'Notificação para usuários próximos' },
                    ]).map(b => (
                      <button
                        key={b.type}
                        onClick={() => handleBoost(b.type)}
                        disabled={boostLoading === b.type || !!activeBoost}
                        className="w-full flex items-center justify-between p-3 rounded-xl bg-gradient-to-r from-slate-800 to-slate-900 border border-slate-700 hover:border-amber-500/50 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                      >
                        <div className="text-left min-w-0">
                          <p className="text-white font-semibold text-xs">{b.label}</p>
                          <p className="text-slate-500 text-[10px] truncate">{b.desc}</p>
                        </div>
                        <span className="text-amber-400 font-bold text-xs flex-shrink-0 ml-2">
                          {boostLoading === b.type ? (
                            <div className="w-3.5 h-3.5 border border-amber-400/30 border-t-amber-400 rounded-full animate-spin" />
                          ) : b.price}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Banner de renovação de boost ── */}
        {activeBoost && (
          <BoostRenewalSuggestion
            objectId={id}
            activeBoost={activeBoost}
            onRenew={() => handleBoost(activeBoost.type as '7d' | '30d' | 'alert')}
          />
        )}

        {/* ── Modal de Celebração — Objeto Recuperado ── */}
        {showRecoveredModal && obj && (
          <RecoveredCelebration
            objectTitle={obj.title}
            objectEmoji={CATEGORY_EMOJI[obj.category] ?? '📦'}
            objectCode={obj.unique_code}
            mode="modal"
            onClose={() => setShowRecoveredModal(false)}
          />
        )}
      </div>
    </>
  );
}
