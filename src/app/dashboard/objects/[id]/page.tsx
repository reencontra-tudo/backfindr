'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ChevronLeft, QrCode, MapPin, Calendar, Tag,
  Share2, Trash2, Edit2, Download, CheckCircle2,
  AlertTriangle, Clock, Package, ExternalLink, Copy, Gift
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { objectsApi, parseApiError } from '@/lib/api';
import { RegisteredObject } from '@/types';

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORY_EMOJI: Record<string, string> = {
  phone: '📱', wallet: '👛', keys: '🔑', bag: '🎒', pet: '🐾',
  bike: '🚲', document: '📄', jewelry: '💍', electronics: '💻',
  clothing: '👕', other: '📦',
};

const CATEGORY_LABEL: Record<string, string> = {
  phone: 'Celular', wallet: 'Carteira', keys: 'Chaves', bag: 'Bolsa / Mochila',
  pet: 'Pet / Animal', bike: 'Bicicleta', document: 'Documento',
  jewelry: 'Joia / Relógio', electronics: 'Eletrônico', clothing: 'Roupa', other: 'Outro',
};

const STATUS_CONFIG: Record<string, { label: string; icon: React.ReactNode; color: string; bg: string }> = {
  lost:     { label: 'Perdido',     icon: <AlertTriangle className="w-4 h-4" />, color: 'text-red-400',    bg: 'bg-red-500/10 border-red-500/20' },
  found:    { label: 'Achado',      icon: <Package className="w-4 h-4" />,       color: 'text-brand-400',  bg: 'bg-brand-500/10 border-brand-500/20' },
  returned: { label: 'Recuperado',  icon: <CheckCircle2 className="w-4 h-4" />,  color: 'text-green-400',  bg: 'bg-green-500/10 border-green-500/20' },
  stolen:   { label: 'Roubado',     icon: <Clock className="w-4 h-4" />,         color: 'text-orange-400', bg: 'bg-orange-500/10 border-orange-500/20' },
};

// ─── QR Code component (uses qr-server API — no extra dep) ───────────────────

function QRCodeDisplay({ code, title }: { code: string; title: string }) {
  const scanUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://backfindr.com.br'}/scan/${code}`;
  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(scanUrl)}&color=14b8a6&bgcolor=0f172a&margin=12`;

  const copyLink = () => {
    navigator.clipboard.writeText(scanUrl);
    toast.success('Link copiado!');
  };

  const downloadQR = () => {
    const link = document.createElement('a');
    link.href = qrImageUrl;
    link.download = `backfindr-qr-${code}.png`;
    link.click();
  };

  const printLabel = () => {
    const printWindow = window.open('', '_blank', 'width=400,height=600');
    if (!printWindow) return;
    printWindow.document.write(`
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8" />
        <title>Etiqueta — ${title}</title>
        <style>
          @page { size: 85mm 55mm; margin: 0; }
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body {
            font-family: 'Helvetica Neue', Arial, sans-serif;
            width: 85mm; height: 55mm;
            display: flex; align-items: center; justify-content: center;
            background: #fff;
          }
          .card {
            width: 83mm; height: 53mm;
            border: 1.5px solid #14b8a6;
            border-radius: 4mm;
            display: flex; align-items: center; gap: 3mm;
            padding: 3mm 4mm;
            overflow: hidden;
          }
          .qr img { width: 40mm; height: 40mm; display: block; }
          .info { flex: 1; overflow: hidden; }
          .brand { font-size: 7pt; font-weight: 700; color: #14b8a6; letter-spacing: 0.05em; text-transform: uppercase; }
          .title { font-size: 9pt; font-weight: 700; color: #0f172a; margin-top: 1mm; line-height: 1.2; word-break: break-word; }
          .code { font-size: 6.5pt; font-family: monospace; color: #64748b; margin-top: 2mm; letter-spacing: 0.08em; }
          .cta { font-size: 6pt; color: #475569; margin-top: 1.5mm; line-height: 1.3; }
          .url { font-size: 6pt; color: #14b8a6; font-weight: 600; word-break: break-all; }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="qr">
            <img src="${qrImageUrl}" alt="QR" />
          </div>
          <div class="info">
            <div class="brand">Backfindr</div>
            <div class="title">${title}</div>
            <div class="code">${code}</div>
            <div class="cta">Encontrou? Escaneie o QR Code ou acesse:</div>
            <div class="url">${scanUrl}</div>
          </div>
        </div>
      </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.onload = () => {
      printWindow.focus();
      printWindow.print();
    };
  };

  return (
    <div className="glass rounded-2xl p-6 flex flex-col items-center gap-4">
      <div className="flex items-center gap-2 self-start">
        <QrCode className="w-4 h-4 text-brand-400" />
        <h3 className="font-display font-semibold text-white text-sm">QR Code</h3>
      </div>

      {/* QR Image */}
      <div className="p-3 bg-surface rounded-xl border border-surface-border">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={qrImageUrl}
          alt={`QR Code — ${title}`}
          width={200}
          height={200}
          className="rounded-lg"
        />
      </div>

      {/* Code */}
      <div className="w-full bg-surface rounded-xl px-4 py-2.5 flex items-center justify-between gap-2 border border-surface-border">
        <span className="font-mono text-brand-400 text-sm tracking-widest">{code}</span>
        <button onClick={copyLink} className="text-slate-500 hover:text-white transition-colors">
          <Copy className="w-3.5 h-3.5" />
        </button>
      </div>

      <p className="text-slate-500 text-xs text-center leading-relaxed">
        Cole este QR Code no objeto físico. Qualquer pessoa que escanear iniciará o processo de devolução.
      </p>

      <div className="flex gap-2 w-full">
        <button
          onClick={downloadQR}
          className="flex-1 flex items-center justify-center gap-1.5 glass hover:bg-surface text-slate-300 hover:text-white text-xs font-medium py-2.5 rounded-lg transition-all"
        >
          <Download className="w-3.5 h-3.5" />
          Baixar PNG
        </button>
        <button
          onClick={copyLink}
          className="flex-1 flex items-center justify-center gap-1.5 glass hover:bg-surface text-slate-300 hover:text-white text-xs font-medium py-2.5 rounded-lg transition-all"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          Copiar link
        </button>
      </div>
      <button
        onClick={printLabel}
        className="w-full flex items-center justify-center gap-1.5 bg-brand-500/10 hover:bg-brand-500/20 border border-brand-500/20 text-brand-400 hover:text-brand-300 text-xs font-medium py-2.5 rounded-lg transition-all"
      >
        <Download className="w-3.5 h-3.5" />
        Imprimir etiqueta (85×55mm)
      </button>
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
  const [obj, setObj] = useState<RegisteredObject | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

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
      <div className="p-8 max-w-5xl">
        <div className="h-8 w-40 bg-surface-border rounded-xl animate-pulse mb-8" />
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 bg-surface-card rounded-2xl animate-pulse" />
            ))}
          </div>
          <div className="h-80 bg-surface-card rounded-2xl animate-pulse" />
        </div>
      </div>
    );
  }

  if (!obj) return null;

  const isPet = obj.category === 'pet';

  return (
    <div className="p-8 max-w-5xl">
      {/* Header */}
      <div className="flex items-start justify-between mb-8 gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/objects"
            className="w-9 h-9 glass rounded-lg flex items-center justify-center text-slate-400 hover:text-white transition-colors flex-shrink-0"
          >
            <ChevronLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-2xl">{CATEGORY_EMOJI[obj.category] ?? '📦'}</span>
              <h1 className="font-display text-xl font-bold text-white">{obj.title}</h1>
            </div>
            <StatusBadge status={obj.status} />
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
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

      {/* Body */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left — details */}
        <div className="lg:col-span-2 space-y-5">
          {/* Photos */}
          {obj.photos?.length > 0 && (
            <div className="glass rounded-2xl p-5">
              <h2 className="font-display font-semibold text-white text-sm mb-4">Fotos</h2>
              <div className="grid grid-cols-3 gap-3">
                {obj.photos.map((url, i) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={i}
                    src={url}
                    alt={`${obj.title} — foto ${i + 1}`}
                    className="w-full aspect-square object-cover rounded-xl border border-surface-border"
                  />
                ))}
              </div>
            </div>
          )}

          {/* Description */}
          <div className="glass rounded-2xl p-5">
            <h2 className="font-display font-semibold text-white text-sm mb-3">Descrição</h2>
            <p className="text-slate-300 text-sm leading-relaxed">{obj.description}</p>
          </div>

          {/* Pet details — F20 */}
          {isPet && (obj.pet_species || obj.pet_breed || obj.pet_color || obj.pet_microchip) && (
            <div className="glass rounded-2xl p-5">
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
                    <p className="text-slate-200 text-sm font-mono">{obj.pet_microchip}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Reward badge */}
          {obj.reward_amount && obj.reward_amount > 0 && (
            <div className="glass rounded-2xl p-5 border border-yellow-500/20 bg-yellow-500/5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center flex-shrink-0">
                  <Gift className="w-5 h-5 text-yellow-400" />
                </div>
                <div>
                  <p className="text-yellow-400 font-semibold text-sm">Recompensa oferecida</p>
                  <p className="text-white font-bold text-xl">
                    R$ {obj.reward_amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                  {obj.reward_description && (
                    <p className="text-slate-400 text-xs mt-1">{obj.reward_description}</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Meta */}
          <div className="glass rounded-2xl p-5">
            <h2 className="font-display font-semibold text-white text-sm mb-4">Informações</h2>
            <div className="space-y-3">
              <div className="flex items-center gap-3 text-sm">
                <Tag className="w-4 h-4 text-slate-500 flex-shrink-0" />
                <span className="text-slate-400">Categoria</span>
                <span className="text-slate-200 ml-auto">{CATEGORY_LABEL[obj.category] ?? obj.category}</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <Calendar className="w-4 h-4 text-slate-500 flex-shrink-0" />
                <span className="text-slate-400">Registrado em</span>
                <span className="text-slate-200 ml-auto">
                  {format(new Date(obj.created_at), "dd 'de' MMM 'de' yyyy", { locale: ptBR })}
                </span>
              </div>
              {obj.location?.address && (
                <div className="flex items-start gap-3 text-sm">
                  <MapPin className="w-4 h-4 text-slate-500 flex-shrink-0 mt-0.5" />
                  <span className="text-slate-400">Local</span>
                  <span className="text-slate-200 ml-auto text-right max-w-[60%]">{obj.location.address}</span>
                </div>
              )}
            </div>
          </div>

          {/* Location map placeholder */}
          {obj.location?.lat && (
            <div className="glass rounded-2xl overflow-hidden">
              <div className="h-48 bg-surface-card flex flex-col items-center justify-center text-slate-500 gap-2">
                <MapPin className="w-8 h-8" />
                <p className="text-sm">Mapa — lat {obj.location.lat.toFixed(4)}, lng {obj.location.lng.toFixed(4)}</p>
                <p className="text-xs text-slate-600">Configure NEXT_PUBLIC_MAPBOX_TOKEN para ativar</p>
              </div>
            </div>
          )}
        </div>

        {/* Right — QR Code + quick actions */}
        <div className="space-y-4">
          <QRCodeDisplay code={obj.unique_code} title={obj.title} />

          {/* Change status */}
          <div className="glass rounded-2xl p-5">
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
                        toast.success(`Status atualizado para ${cfg.label}`);
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
        </div>
      </div>
    </div>
  );
}
