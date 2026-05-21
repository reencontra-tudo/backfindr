
'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ChevronLeft, QrCode, MapPin, Calendar, Tag,
  Share2, Trash2, Edit2, Download, CheckCircle2,
  AlertTriangle, Clock, Package, ExternalLink, Copy, Gift, Zap, Star
} from 'lucide-react';
import RecoveredCelebration from '@/components/RecoveredCelebration';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { objectsApi, parseApiError } from '@/lib/api';
import { ImageLightbox, useLightbox } from '@/components/ImageLightbox';
import { RegisteredObject } from '@/types';
import Cookies from 'js-cookie';
import LocationMap from '@/components/LocationMap';
import BoostRenewalSuggestion from '@/components/BoostRenewalSuggestion';

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
  lost: { label: 'Perdido', icon: <AlertTriangle className="w-4 h-4" />, color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20' },
  found: { label: 'Achado', icon: <Package className="w-4 h-4" />, color: 'text-brand-400', bg: 'bg-brand-500/10 border-brand-500/20' },
  returned: { label: 'Recuperado', icon: <CheckCircle2 className="w-4 h-4" />, color: 'text-green-400', bg: 'bg-green-500/10 border-green-500/20' },
  stolen: { label: 'Roubado', icon: <Clock className="w-4 h-4" />, color: 'text-orange-400', bg: 'bg-orange-500/10 border-orange-500/20' },
};

// ─── QR Code component (uses qr-server API — no extra dep) ───────────────────

function QRCodeDisplay({ code, title, status }: { code: string; title: string; status: string }) {
  const isLost = status === 'lost' || status === 'stolen';
  const scanUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://backfindr.com.br'}/scan/${code}`;
  const [theme, setTheme] = useState<'dark'|'light'|'teal'>('dark');
  const [size, setSize] = useState<'85x55'|'50x50'|'a4'>('85x55');
  const [showPrintOptions, setShowPrintOptions] = useState(false);

  const themes = {
    dark: { label: 'Escuro', fg: '14b8a6', bg: '0f172a', border: '#14b8a6', cardBg: '#0f172a', cardText: '#ffffff', cardSub: '#94a3b8', cardBrand: '#14b8a6' },
    light: { label: 'Claro', fg: '0f172a', bg: 'ffffff', border: '#0f172a', cardBg: '#ffffff', cardText: '#0f172a', cardSub: '#475569', cardBrand: '#0f172a' },
    teal: { label: 'Teal', fg: 'ffffff', bg: '14b8a6', border: '#0d9488', cardBg: '#14b8a6', cardText: '#ffffff', cardSub: '#ccfbf1', cardBrand: '#ffffff' },
  };

  const sizes = {
    '85x55': { label: 'Cartão (85x55mm)', w: 320, h: 200 },
    '50x50': { label: 'Quadrado (50x50mm)', w: 200, h: 200 },
    'a4': { label: 'Folha A4', w: 800, h: 1130 },
  };

  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(scanUrl)}&color=${themes[theme].fg}&bgcolor=${themes[theme].bg}&margin=10`;

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = qrUrl;
    link.download = `backfindr-qr-${code}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('QR Code baixado com sucesso!');
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-slate-400 text-sm">
          <QrCode className="w-4 h-4" />
          <span>QR Code</span>
        </div>
        <button 
          onClick={() => setShowPrintOptions(!showPrintOptions)}
          className="text-brand-400 text-xs font-medium hover:underline"
        >
          {showPrintOptions ? 'Fechar opções' : 'Opções de impressão'}
        </button>
      </div>

      <div className="relative group">
        <div className="absolute -inset-1 bg-gradient-to-r from-brand-500/20 to-brand-400/20 rounded-2xl blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200"></div>
        <div className="relative bg-slate-900/50 border border-slate-800 rounded-xl p-6 flex flex-col items-center gap-4">
          <div className="p-3 bg-white rounded-lg shadow-xl">
            <img src={qrUrl} alt="QR Code" className="w-40 h-40" />
          </div>
          <div className="text-center">
            <p className="text-slate-400 text-xs mb-1">Código único</p>
            <p className="text-white font-mono font-bold tracking-widest text-lg">{code}</p>
          </div>
        </div>
      </div>

      {showPrintOptions && (
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="grid grid-cols-3 gap-2">
            {(Object.keys(themes) as Array<keyof typeof themes>).map((t) => (
              <button
                key={t}
                onClick={() => setTheme(t as any)}
                className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                  theme === t 
                    ? 'bg-brand-500 text-white shadow-lg shadow-brand-500/20' 
                    : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                }`}
              >
                {themes[t as keyof typeof themes].label}
              </button>
            ))}
          </div>
          <button
            onClick={handleDownload}
            className="w-full flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-white py-2.5 rounded-lg text-sm font-medium transition-colors"
          >
            <Download className="w-4 h-4" />
            Baixar PNG
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Main Page Component ─────────────────────────────────────────────────────

export default function ObjectDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const [object, setObject] = useState<RegisteredObject | null>(null);
  const [loading, setLoading] = useState(true);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showRecoveredCelebration, setShowRecoveredCelebration] = useState(false);
  const { lightbox, openLightbox, closeLightbox } = useLightbox();

  const id = params.id as string;

  useEffect(() => {
    if (id) fetchObject();
  }, [id]);

  const fetchObject = async () => {
    try {
      setLoading(true);
      const data = await objectsApi.getById(id);
      setObject(data);
    } catch (error) {
      console.error('Erro ao buscar objeto:', error);
      toast.error(parseApiError(error));
      router.push('/dashboard');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!object || updatingStatus) return;
    
    try {
      setUpdatingStatus(true);
      await objectsApi.update(id, { status: newStatus });
      
      setObject({ ...object, status: newStatus });
      toast.success(`Status atualizado para ${STATUS_CONFIG[newStatus].label}`);
      
      if (newStatus === 'returned') {
        setShowRecoveredCelebration(true);
      }
    } catch (error) {
      toast.error(parseApiError(error));
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Tem certeza que deseja excluir este objeto? Esta ação não pode ser desfeita.')) return;
    
    try {
      setIsDeleting(true);
      await objectsApi.delete(id);
      toast.success('Objeto excluído com sucesso');
      router.push('/dashboard');
    } catch (error) {
      toast.error(parseApiError(error));
      setIsDeleting(false);
    }
  };

  const handleShare = () => {
    const url = `${window.location.origin}/scan/${object?.code}`;
    if (navigator.share) {
      navigator.share({
        title: `Objeto ${object?.status === 'lost' ? 'Perdido' : 'Achado'}: ${object?.title}`,
        text: object?.description,
        url: url,
      }).catch(console.error);
    } else {
      navigator.clipboard.writeText(url);
      toast.success('Link copiado para a área de transferência!');
    }
  };

  const handleBoost = async (type: string) => {
    try {
      const response = await fetch('/api/v1/boost', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ objectId: id, type }),
      });
      
      const data = await response.json();
      if (data.init_point) {
        window.location.href = data.init_point;
      } else {
        toast.error('Erro ao iniciar pagamento');
      }
    } catch (error) {
      toast.error('Erro ao processar solicitação');
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="w-12 h-12 border-4 border-brand-500/20 border-t-brand-500 rounded-full animate-spin"></div>
        <p className="text-slate-400 animate-pulse">Carregando detalhes...</p>
      </div>
    );
  }

  if (!object) return null;

  const status = STATUS_CONFIG[object.status] || STATUS_CONFIG.lost;
  const categoryEmoji = CATEGORY_EMOJI[object.category] || '📦';
  const categoryLabel = CATEGORY_LABEL[object.category] || 'Outro';

  return (
    <div className="max-w-2xl mx-auto pb-20 px-4 sm:px-0">
      {showRecoveredCelebration && (
        <RecoveredCelebration 
          objectName={object.title} 
          onClose={() => setShowRecoveredCelebration(false)} 
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-6 pt-4">
        <Link 
          href="/dashboard"
          className="p-2 -ml-2 text-slate-400 hover:text-white transition-colors"
        >
          <ChevronLeft className="w-6 h-6" />
        </Link>
        <div className="flex items-center gap-2">
          <button 
            onClick={handleShare}
            className="p-2 text-slate-400 hover:text-white transition-colors"
            title="Compartilhar"
          >
            <Share2 className="w-5 h-5" />
          </button>
          <Link 
            href={`/dashboard/objects/${id}/edit`}
            className="p-2 text-slate-400 hover:text-white transition-colors"
            title="Editar"
          >
            <Edit2 className="w-5 h-5" />
          </Link>
          <button 
            onClick={handleDelete}
            disabled={isDeleting}
            className="p-2 text-slate-400 hover:text-red-400 transition-colors disabled:opacity-50"
            title="Excluir"
          >
            <Trash2 className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Title & Status */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-3">
          <span className="text-4xl">{categoryEmoji}</span>
          <h1 className="text-2xl font-bold text-white leading-tight">{object.title}</h1>
        </div>
        <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-bold uppercase tracking-wider ${status.bg} ${status.color}`}>
          {status.icon}
          {status.label}
        </div>
      </div>

      {/* Sugestão de Renovação */}
      <BoostRenewalSuggestion objectId={id} />

      <div className="grid grid-cols-1 gap-6">
        {/* Photos */}
        {object.images && object.images.length > 0 && (
          <section className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
            <h2 className="text-sm font-semibold text-slate-400 mb-4 flex items-center gap-2">
              <Tag className="w-4 h-4" />
              Fotos
            </h2>
            <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
              {object.images.map((img, idx) => (
                <button 
                  key={idx}
                  onClick={() => openLightbox(object.images, idx)}
                  className="relative flex-shrink-0 w-32 h-32 rounded-xl overflow-hidden border border-slate-700 hover:border-brand-500 transition-colors group"
                >
                  <img 
                    src={img} 
                    alt={`Foto ${idx + 1}`} 
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                  />
                </button>
              ))}
            </div>
          </section>
        )}

        {/* Description */}
        <section className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
          <h2 className="text-sm font-semibold text-slate-400 mb-3 flex items-center gap-2">
            <Edit2 className="w-4 h-4" />
            Descrição
          </h2>
          <p className="text-slate-300 leading-relaxed whitespace-pre-wrap">
            {object.description || 'Nenhuma descrição fornecida.'}
          </p>
        </section>

        {/* Info Grid */}
        <section className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
          <h2 className="text-sm font-semibold text-slate-400 mb-4 flex items-center gap-2">
            <Package className="w-4 h-4" />
            Informações
          </h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between py-2 border-b border-slate-800/50">
              <div className="flex items-center gap-2 text-slate-400 text-sm">
                <Tag className="w-4 h-4" />
                <span>Categoria</span>
              </div>
              <span className="text-white text-sm font-medium">{categoryLabel}</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-slate-800/50">
              <div className="flex items-center gap-2 text-slate-400 text-sm">
                <Calendar className="w-4 h-4" />
                <span>Registrado em</span>
              </div>
              <span className="text-white text-sm font-medium">
                {format(new Date(object.createdAt), "dd 'de' MMM 'de' yyyy", { locale: ptBR })}
              </span>
            </div>
            <div className="flex flex-col gap-2 py-2">
              <div className="flex items-center gap-2 text-slate-400 text-sm">
                <MapPin className="w-4 h-4" />
                <span>Local</span>
              </div>
              <span className="text-white text-sm leading-relaxed">
                {object.locationAddress || 'Localização não informada'}
              </span>
            </div>
          </div>
        </section>

        {/* Map Section */}
        <section className="bg-slate-900/50 border border-slate-800 rounded-2xl overflow-hidden">
          <div className="p-6 pb-0">
            <h2 className="text-sm font-semibold text-slate-400 mb-4 flex items-center gap-2">
              <MapPin className="w-4 h-4" />
              Mapa
            </h2>
          </div>
          <div className="h-64 w-full">
            <LocationMap 
              lat={object.locationLat || -23.5505} 
              lng={object.locationLng || -46.6333} 
              title={object.title}
              address={object.locationAddress}
            />
          </div>
        </section>

        {/* QR Code Section */}
        <section className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
          <QRCodeDisplay code={object.code} title={object.title} status={object.status} />
        </section>

        {/* Download Poster Section */}
        <section className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
          <h2 className="text-sm font-semibold text-slate-400 mb-4 flex items-center gap-2">
            <Download className="w-4 h-4" />
            Baixar Pôster
          </h2>
          <p className="text-slate-400 text-xs mb-4">
            Imprima e compartilhe o pôster do seu objeto em locais públicos.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <a 
              href={`/api/v1/objects/${id}/poster?format=square`}
              target="_blank"
              className="flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-white py-3 rounded-xl text-sm font-medium transition-all border border-slate-700"
            >
              <Download className="w-4 h-4" />
              Quadrado (1080x1080)
            </a>
            <a 
              href={`/api/v1/objects/${id}/poster?format=vertical`}
              target="_blank"
              className="flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-white py-3 rounded-xl text-sm font-medium transition-all border border-slate-700"
            >
              <Download className="w-4 h-4" />
              Vertical (1080x1920)
            </a>
          </div>
        </section>

        {/* Status Update Section */}
        <section className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
          <h2 className="text-sm font-semibold text-slate-400 mb-4 flex items-center gap-2">
            <Clock className="w-4 h-4" />
            Atualizar status
          </h2>
          <div className="space-y-3">
            {(['lost', 'found', 'returned'] as const).map((s) => (
              <button
                key={s}
                onClick={() => handleStatusChange(s)}
                disabled={updatingStatus || object.status === s}
                className={`w-full flex items-center justify-between p-4 rounded-xl border transition-all ${
                  object.status === s 
                    ? `${STATUS_CONFIG[s].bg} ${STATUS_CONFIG[s].color} border-current` 
                    : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:bg-slate-800 hover:text-slate-300'
                }`}
              >
                <div className="flex items-center gap-3">
                  {STATUS_CONFIG[s].icon}
                  <span className="font-medium">{STATUS_CONFIG[s].label}</span>
                </div>
                {object.status === s && <CheckCircle2 className="w-4 h-4" />}
              </button>
            ))}
          </div>
        </section>

        {/* Boost Section - Redesigned */}
        <section className="relative overflow-hidden bg-slate-900/50 border border-slate-800 rounded-2xl p-6 group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <Zap className="w-24 h-24 text-amber-500" />
          </div>
          
          <div className="relative">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-1.5 bg-gradient-to-br from-amber-500 to-orange-600 rounded-lg">
                <Zap className="w-4 h-4 text-white" />
              </div>
              <h2 className="text-lg font-bold text-white">Impulsionar Visibilidade</h2>
            </div>
            <p className="text-slate-400 text-sm mb-6">
              Destaque seu objeto no mapa e no feed para que mais pessoas o vejam e ajudem na recuperação.
            </p>

            {object.isBoosted && (
              <div className="mb-6 p-3 bg-green-500/10 border border-green-500/20 rounded-xl flex items-center gap-3">
                <div className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                </div>
                <div className="flex flex-col">
                  <span className="text-green-400 text-sm font-bold flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    Boost Ativo
                  </span>
                  {object.boostExpiresAt && (
                    <span className="text-slate-500 text-[10px]">
                      Expira em: {format(new Date(object.boostExpiresAt), "dd/MM/yyyy HH:mm")}
                    </span>
                  )}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 gap-3">
              <button
                onClick={() => handleBoost('7d')}
                className="flex items-center justify-between p-4 rounded-xl bg-gradient-to-r from-slate-800 to-slate-900 border border-slate-700 hover:border-amber-500/50 transition-all group/btn"
              >
                <div className="flex flex-col items-start">
                  <span className="text-white font-bold flex items-center gap-2">
                    ⚡ Boost 7 dias
                  </span>
                  <span className="text-slate-500 text-xs">Destaque total por uma semana</span>
                </div>
                <span className="text-amber-500 font-bold">R$ 9,90</span>
              </button>

              <button
                onClick={() => handleBoost('30d')}
                className="flex items-center justify-between p-4 rounded-xl bg-gradient-to-r from-slate-800 to-slate-900 border border-slate-700 hover:border-orange-500/50 transition-all group/btn"
              >
                <div className="flex flex-col items-start">
                  <span className="text-white font-bold flex items-center gap-2">
                    ⭐ Boost 30 dias
                  </span>
                  <span className="text-slate-500 text-xs">Destaque mensal + notificações</span>
                </div>
                <span className="text-amber-500 font-bold">R$ 24,90</span>
              </button>

              <button
                onClick={() => handleBoost('alert')}
                className="flex items-center justify-between p-4 rounded-xl bg-gradient-to-r from-slate-800 to-slate-900 border border-slate-700 hover:border-brand-500/50 transition-all group/btn"
              >
                <div className="flex flex-col items-start">
                  <span className="text-white font-bold flex items-center gap-2">
                    🔔 Alerta de Área
                  </span>
                  <span className="text-slate-500 text-xs">Notificação para usuários próximos</span>
                </div>
                <span className="text-amber-500 font-bold">R$ 14,90</span>
              </button>
            </div>
          </div>
        </section>
      </div>

      {lightbox.isOpen && (
        <ImageLightbox 
          images={lightbox.images} 
          currentIndex={lightbox.currentIndex} 
          onClose={closeLightbox} 
        />
      )}
    </div>
  );
}
