'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  CheckCircle2, Share2, ArrowRight, QrCode,
  Copy, MessageCircle, Bell, MapPin
} from 'lucide-react';
import { toast } from 'sonner';
import { objectsApi } from '@/lib/api';

interface ObjectData {
  id: string;
  title: string;
  status: string;
  category: string;
  unique_code?: string;
  photos?: string[];
}

const CATEGORY_EMOJI: Record<string, string> = {
  phone: '📱', wallet: '👛', keys: '🔑', bag: '🎒', pet: '🐾',
  bike: '🚲', vehicle: '🚗', document: '📄', jewelry: '💍', electronics: '💻',
  clothing: '👕', other: '📦',
};

const STATUS_MESSAGES: Record<string, { headline: string; sub: string }> = {
  lost:    { headline: 'Alerta publicado na rede!', sub: 'Você será notificado assim que alguém encontrar.' },
  found:   { headline: 'Achado registrado!', sub: 'Se o dono procurar, a gente conecta vocês automaticamente.' },
  stolen:  { headline: 'Registro de furto publicado!', sub: 'Sua ocorrência está visível para toda a rede.' },
};

export default function SucessoPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [obj, setObj] = useState<ObjectData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    objectsApi.get(id)
      .then(res => setObj(res.data))
      .catch(() => router.push(`/dashboard/objects/${id}`))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#080b0f] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!obj) return null;

  const msg = STATUS_MESSAGES[obj.status] ?? STATUS_MESSAGES.lost;
  const emoji = CATEGORY_EMOJI[obj.category] ?? '📦';
  const publicUrl = `https://www.backfindr.com/objeto/${obj.unique_code}`;
  const whatsappText = encodeURIComponent(
    obj.status === 'lost'
      ? `Perdi meu ${obj.title}. Se encontrar, acesse o link para me avisar: ${publicUrl}`
      : `Encontrei um objeto. Se for seu, acesse: ${publicUrl}`
  );
  const whatsappUrl = `https://wa.me/?text=${whatsappText}`;

  const copyLink = () => {
    navigator.clipboard.writeText(publicUrl);
    toast.success('Link copiado!');
  };

  return (
    <div className="min-h-screen bg-[#080b0f] flex items-center justify-center px-5">
      <div className="absolute inset-0 pointer-events-none" style={{
        background: 'radial-gradient(ellipse 60% 40% at 50% 0%, rgba(20,184,166,0.08) 0%, transparent 70%)'
      }} />

      <div className="w-full max-w-md relative z-10 text-center">
        {/* Ícone de sucesso */}
        <div className="flex justify-center mb-6">
          <div className="w-20 h-20 rounded-full bg-teal-500/15 border border-teal-500/30 flex items-center justify-center">
            <CheckCircle2 className="w-10 h-10 text-teal-400" />
          </div>
        </div>

        {/* Emoji do objeto */}
        <div className="text-5xl mb-4">{emoji}</div>

        {/* Headline */}
        <h1 className="text-2xl font-bold text-white mb-2">{msg.headline}</h1>
        <p className="text-white/50 text-sm mb-2">{obj.title}</p>
        <p className="text-white/40 text-sm mb-8 leading-relaxed">{msg.sub}</p>

        {/* Compartilhar via WhatsApp */}
        <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-5 mb-4">
          <div className="flex items-center gap-2 mb-3">
            <Share2 className="w-4 h-4 text-teal-400" />
            <p className="text-white font-semibold text-sm">Compartilhe para aumentar as chances</p>
          </div>
          <p className="text-white/40 text-xs mb-4 leading-relaxed">
            Quanto mais pessoas souberem, maior a chance de retorno. Compartilhe no WhatsApp, grupos e redes sociais.
          </p>

          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full flex items-center justify-center gap-2.5 bg-[#25D366] hover:bg-[#20c05a] text-white font-bold py-3.5 rounded-xl transition-all text-sm mb-3"
          >
            <MessageCircle className="w-5 h-5" />
            Compartilhar no WhatsApp
          </a>

          <button
            onClick={copyLink}
            className="w-full flex items-center justify-center gap-2 border border-white/[0.08] bg-white/[0.04] hover:bg-white/[0.07] text-white/70 hover:text-white text-sm py-3 rounded-xl transition-all"
          >
            <Copy className="w-4 h-4" />
            Copiar link do objeto
          </button>
        </div>

        {/* Próximos passos */}
        <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-5 mb-6 text-left">
          <p className="text-white/40 text-xs font-semibold uppercase tracking-wider mb-3">Próximos passos</p>
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-7 h-7 rounded-lg bg-teal-500/15 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Bell className="w-3.5 h-3.5 text-teal-400" />
              </div>
              <div>
                <p className="text-white text-sm font-medium">Ative as notificações</p>
                <p className="text-white/40 text-xs">Receba alerta imediato quando alguém encontrar.</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-7 h-7 rounded-lg bg-blue-500/15 flex items-center justify-center flex-shrink-0 mt-0.5">
                <QrCode className="w-3.5 h-3.5 text-blue-400" />
              </div>
              <div>
                <p className="text-white text-sm font-medium">Baixe o QR Code</p>
                <p className="text-white/40 text-xs">Cole na mochila, carteira, coleira ou documento.</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-7 h-7 rounded-lg bg-amber-500/15 flex items-center justify-center flex-shrink-0 mt-0.5">
                <MapPin className="w-3.5 h-3.5 text-amber-400" />
              </div>
              <div>
                <p className="text-white text-sm font-medium">Veja no mapa público</p>
                <p className="text-white/40 text-xs">Seu registro já está visível para toda a rede.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Botões de navegação */}
        <div className="flex flex-col gap-3">
          <Link
            href={`/dashboard/objects/${id}`}
            className="w-full flex items-center justify-center gap-2 bg-teal-500 hover:bg-teal-400 text-white font-bold py-4 rounded-xl transition-all text-base"
            style={{ boxShadow: '0 0 0 1px rgba(20,184,166,0.4),0 4px 20px rgba(20,184,166,0.15)' }}
          >
            <span>Ver detalhes do objeto</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            href="/dashboard"
            className="w-full flex items-center justify-center gap-2 border border-white/[0.08] bg-white/[0.04] hover:bg-white/[0.07] text-white/70 hover:text-white text-sm py-3.5 rounded-xl transition-all"
          >
            Ir para o painel
          </Link>
        </div>
      </div>
    </div>
  );
}
