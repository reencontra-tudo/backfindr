'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Package, Users, QrCode, Settings, TrendingUp,
  Copy, CheckCircle2, Loader2, AlertCircle,
  Building2, ExternalLink, Bell
} from 'lucide-react';
import { toast } from 'sonner';
import { api, parseApiError } from '@/lib/api';
import { useAuthStore } from '@/hooks/useAuth';
import Link from 'next/link';
import { compartilharWhatsApp, msgConviteMorador, msgCircularPortaria } from '@/lib/whatsapp';

interface Condominio {
  id: string; nome: string; slug: string; cidade: string; estado: string;
  total_unidades: number; logo_url: string | null; active: boolean;
  whatsapp_notify: boolean; push_notify: boolean; email_notify: boolean;
  cor_primaria: string | null; cor_texto: string | null;
  banner_url: string | null; mensagem_boas_vindas: string | null;
}

interface Stats {
  encomendas_pendentes: number;
  encomendas_entregues_hoje: number;
  encomendas_recebidas_hoje: number;
  custodias_ativas: number;
}

interface Encomenda {
  id: string; remetente: string | null; status: string;
  registrado_em: string; unidade_numero: string | null;
  morador_nome: string | null;
}

function horaRelativa(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const min  = Math.floor(diff / 60000);
  if (min < 60) return `${Math.max(1, min)}min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h`;
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

function CopyButton({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success('Copiado!');
  };
  return (
    <button onClick={copy}
      className="flex items-center gap-1.5 text-xs text-teal-400 hover:text-teal-300 transition-colors">
      {copied ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
      {label ?? (copied ? 'Copiado!' : 'Copiar')}
    </button>
  );
}

export default function ParceiroportariaPage() {
  const { user } = useAuthStore();
  const router   = useRouter();
  const [cond, setCond]         = useState<Condominio | null>(null);
  const [stats, setStats]       = useState<Stats | null>(null);
  const [encomendas, setEncomendas] = useState<Encomenda[]>([]);
  const [loading, setLoading]   = useState(true);
  const [aba, setAba]           = useState<'visao' | 'encomendas' | 'kit' | 'identidade' | 'config'>('visao');

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://backfindr.com';
  const [brandSaving, setBrandSaving] = useState(false);
  const [brandForm, setBrandForm] = useState({
    cor_primaria: '#14B8A6',
    logo_url: '',
    mensagem_boas_vindas: '',
  });

  useEffect(() => {
    async function fetch() {
      try {
        // Buscar condomínio do parceiro autenticado via dashboard
        // A API retorna os dados do condomínio vinculado ao b2b_partner_id do usuário
        const res = await api.get('/portaria/condominios');
        const items = res.data.items as Condominio[];
        if (items.length > 0) {
          const c = items[0];
          setCond(c);
          setBrandForm({
            cor_primaria: c.cor_primaria ?? '#14B8A6',
            logo_url: c.logo_url ?? '',
            mensagem_boas_vindas: c.mensagem_boas_vindas ?? '',
          });
          // Buscar stats e encomendas
          const [dashRes, encRes] = await Promise.all([
            api.get(`/portaria/${c.id}/dashboard`),
            api.get(`/portaria/${c.id}/encomendas?status=pendente&size=20`),
          ]);
          setStats(dashRes.data.stats);
          setEncomendas(encRes.data.items);
        }
      } catch (e) {
        toast.error(parseApiError(e));
      } finally {
        setLoading(false);
      }
    }
    fetch();
  }, []);

  const handleSaveBranding = async () => {
    if (!cond) return;
    setBrandSaving(true);
    try {
      await api.patch(`/api/v1/portaria/condominios/branding?condominio_id=${cond.id}`, {
        cor_primaria: brandForm.cor_primaria || undefined,
        logo_url: brandForm.logo_url || null,
        mensagem_boas_vindas: brandForm.mensagem_boas_vindas || null,
      });
      toast.success('Identidade visual salva!');
      setCond(c => c ? {
        ...c,
        cor_primaria: brandForm.cor_primaria,
        logo_url: brandForm.logo_url || null,
        mensagem_boas_vindas: brandForm.mensagem_boas_vindas || null,
      } : c);
    } catch (e) {
      toast.error(parseApiError(e));
    } finally {
      setBrandSaving(false);
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="w-6 h-6 text-teal-400 animate-spin" />
    </div>
  );

  if (!cond) return (
    <div className="flex flex-col items-center justify-center h-64 gap-4 text-center">
      <AlertCircle className="w-10 h-10 text-white/20" />
      <div>
        <p className="text-white font-semibold mb-1">Nenhum condomínio configurado</p>
        <p className="text-white/40 text-sm">Entre em contato com o suporte Backfindr para ativar seu condomínio.</p>
      </div>
    </div>
  );

  const linkMorador  = `${appUrl}/condominio/${cond.slug}`;
  const linkPortaria = `${appUrl}/portaria/${cond.id}`;
  const pct = cond.total_unidades > 0
    ? Math.round(((stats?.encomendas_recebidas_hoje ?? 0) / cond.total_unidades) * 100)
    : 0;

  const msgWhatsApp = `🏢 *${cond.nome}*\n\nCaro condômino,\n\nCadatre-se no Backfindr para receber alertas de encomendas diretamente no seu celular:\n\n${linkMorador}\n\n_É gratuito e leva menos de 2 minutos._`;

  const msgCircular = `CIRCULAR — CADASTRO BACKFINDR\n\n${cond.nome} adotou o Backfindr, sistema inteligente de portaria e achados e perdidos.\n\nPara receber alertas de encomendas no celular, acesse:\n${linkMorador}\n\nDúvidas: fale com a administração.`;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center">
            <Building2 className="w-6 h-6 text-teal-400" />
          </div>
          <div>
            <h1 className="text-white text-xl font-bold">{cond.nome}</h1>
            <p className="text-white/40 text-sm">{cond.cidade}, {cond.estado}</p>
          </div>
        </div>
        <Link
          href={linkPortaria}
          target="_blank"
          className="flex items-center gap-1.5 text-xs text-white/40 hover:text-teal-400 transition-colors"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          PWA
        </Link>
      </div>

      {/* Abas */}
      <div className="flex gap-1 bg-white/[0.03] p-1 rounded-xl border border-white/[0.06]">
        {[
          { id: 'visao',     label: 'Visão geral' },
          { id: 'encomendas',label: 'Encomendas' },
          { id: 'kit',       label: 'Kit ativação' },
          { id: 'identidade',label: 'Identidade' },
        { id: 'config',    label: 'Config' },
        ].map(a => (
          <button key={a.id} onClick={() => setAba(a.id as typeof aba)}
            className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-colors ${
              aba === a.id
                ? 'bg-teal-500 text-white'
                : 'text-white/40 hover:text-white/70'
            }`}>
            {a.label}
          </button>
        ))}
      </div>

      {/* ── ABA: Visão geral ─────────────────────────────────────────────── */}
      {aba === 'visao' && stats && (
        <div className="space-y-4">
          {/* Cards de stats */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Encomendas pendentes', value: stats.encomendas_pendentes, icon: <Package className="w-5 h-5" />, color: 'text-yellow-400', bg: 'bg-yellow-400/10' },
              { label: 'Custódias ativas',     value: stats.custodias_ativas,     icon: <QrCode className="w-5 h-5" />,   color: 'text-purple-400', bg: 'bg-purple-400/10' },
              { label: 'Entregues hoje',        value: stats.encomendas_entregues_hoje, icon: <CheckCircle2 className="w-5 h-5" />, color: 'text-teal-400', bg: 'bg-teal-400/10' },
              { label: 'Recebidas hoje',        value: stats.encomendas_recebidas_hoje, icon: <TrendingUp className="w-5 h-5" />,  color: 'text-blue-400', bg: 'bg-blue-400/10' },
            ].map((s, i) => (
              <div key={i} className="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-4">
                <div className={`w-9 h-9 rounded-xl ${s.bg} flex items-center justify-center mb-3 ${s.color}`}>
                  {s.icon}
                </div>
                <p className={`text-2xl font-black ${s.color}`}>{s.value}</p>
                <p className="text-white/40 text-xs mt-1">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Acesso rápido ao PWA */}
          <div className="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-4">
            <p className="text-white/50 text-xs font-semibold uppercase tracking-wider mb-3">Acesso da portaria</p>
            <div className="flex items-center justify-between gap-3">
              <code className="text-teal-300 text-xs break-all flex-1">{linkPortaria}</code>
              <CopyButton text={linkPortaria} />
            </div>
            <p className="text-white/30 text-xs mt-2">Compartilhe este link com o porteiro. Não requer instalação.</p>
          </div>
        </div>
      )}

      {/* ── ABA: Encomendas ──────────────────────────────────────────────── */}
      {aba === 'encomendas' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-white/50 text-xs font-semibold uppercase tracking-wider">
              Pendentes — {encomendas.length}
            </p>
          </div>

          {encomendas.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
              <CheckCircle2 className="w-8 h-8 text-teal-400" />
              <p className="text-white/40 text-sm">Nenhuma encomenda pendente</p>
            </div>
          ) : (
            encomendas.map(enc => (
              <div key={enc.id} className="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-4">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-blue-400/10 flex items-center justify-center flex-shrink-0">
                    <Package className="w-4 h-4 text-blue-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="text-white font-semibold text-sm truncate">
                        Apto {enc.unidade_numero ?? '?'} — {enc.remetente ?? 'Sem remetente'}
                      </p>
                      <span className="text-white/30 text-xs ml-2 flex-shrink-0">{horaRelativa(enc.registrado_em)}</span>
                    </div>
                    {enc.morador_nome && (
                      <p className="text-white/40 text-xs mt-0.5">{enc.morador_nome}</p>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ── ABA: Kit de ativação ─────────────────────────────────────────── */}
      {aba === 'kit' && (
        <div className="space-y-4">
          <p className="text-white/50 text-xs">
            Use estes materiais para convidar moradores a se cadastrarem. Quanto mais moradores cadastrados, mais eficiente o sistema.
          </p>

          {/* Link personalizado */}
          <div className="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-4 space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-teal-500/10 flex items-center justify-center">
                <ExternalLink className="w-3.5 h-3.5 text-teal-400" />
              </div>
              <p className="text-white font-semibold text-sm">Link de cadastro</p>
            </div>
            <code className="block text-teal-300 text-sm break-all bg-white/[0.03] rounded-xl p-3">
              {linkMorador}
            </code>
            <div className="flex gap-2">
              <CopyButton text={linkMorador} label="Copiar link" />
              <Link href={linkMorador} target="_blank"
                className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white/70 transition-colors">
                <ExternalLink className="w-3.5 h-3.5" /> Ver página
              </Link>
            </div>
          </div>

          {/* Texto WhatsApp */}
          <div className="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-4 space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-green-500/10 flex items-center justify-center">
                <Bell className="w-3.5 h-3.5 text-green-400" />
              </div>
              <p className="text-white font-semibold text-sm">Texto para grupo do WhatsApp</p>
            </div>
            <pre className="text-white/60 text-xs bg-white/[0.03] rounded-xl p-3 whitespace-pre-wrap break-words font-sans">
              {msgWhatsApp}
            </pre>
            <div className="flex items-center gap-3">
              <CopyButton text={msgWhatsApp} label="Copiar mensagem" />
              <button
                onClick={() => compartilharWhatsApp(msgWhatsApp)}
                className="flex items-center gap-1.5 text-xs text-[#25D366] hover:text-[#1ebe5d] transition-colors font-semibold"
              >
                <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-[#25D366]"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                Enviar pelo WhatsApp
              </button>
            </div>
          </div>

          {/* Circular */}
          <div className="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-4 space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <Users className="w-3.5 h-3.5 text-blue-400" />
              </div>
              <p className="text-white font-semibold text-sm">Circular para impressão</p>
            </div>
            <pre className="text-white/60 text-xs bg-white/[0.03] rounded-xl p-3 whitespace-pre-wrap break-words font-sans">
              {msgCircular}
            </pre>
            <div className="flex items-center gap-3">
              <CopyButton text={msgCircular} label="Copiar circular" />
              <button
                onClick={() => compartilharWhatsApp(msgCircular)}
                className="flex items-center gap-1.5 text-xs text-[#25D366] hover:text-[#1ebe5d] transition-colors font-semibold"
              >
                <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-[#25D366]"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                Enviar pelo WhatsApp
              </button>
            </div>
          </div>

          {/* Dica */}
          <div className="bg-yellow-400/10 border border-yellow-400/20 rounded-2xl p-4">
            <p className="text-yellow-300 text-xs font-semibold mb-1">💡 Dica de conversão</p>
            <p className="text-yellow-200/70 text-xs leading-relaxed">
              Informe que moradores não cadastrados não receberão alertas de encomendas. Isso aumenta muito a adesão.
            </p>
          </div>
        </div>
      )}


      {/* ── ABA: Identidade visual ──────────────────────────────────────── */}
      {aba === 'identidade' && (
        <div className="space-y-5">

          {/* Preview ao vivo */}
          <div
            className="rounded-2xl p-5 text-center space-y-3 border border-white/[0.07]"
            style={{ background: `${brandForm.cor_primaria}18` }}
          >
            {brandForm.logo_url ? (
              <img
                src={brandForm.logo_url}
                alt="Logo"
                className="w-16 h-16 rounded-2xl object-contain mx-auto bg-white/10 p-2"
              />
            ) : (
              <div className="w-16 h-16 rounded-2xl bg-white/10 flex items-center justify-center mx-auto">
                <Building2 className="w-7 h-7 text-white/30" />
              </div>
            )}
            <p className="text-white font-bold">{cond?.nome}</p>
            <button
              className="px-5 py-2 rounded-xl text-sm font-bold mx-auto block"
              style={{ background: brandForm.cor_primaria, color: '#fff' }}
            >
              Exemplo de botão
            </button>
            <p className="text-white/30 text-xs">Prévia da identidade visual</p>
          </div>

          {/* Cor primária */}
          <div className="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-4 space-y-3">
            <p className="text-white/50 text-xs font-semibold uppercase tracking-wider">Cor principal</p>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={brandForm.cor_primaria}
                onChange={e => setBrandForm(f => ({ ...f, cor_primaria: e.target.value }))}
                className="w-12 h-12 rounded-xl cursor-pointer border-0 bg-transparent"
              />
              <div className="flex-1">
                <input
                  type="text"
                  value={brandForm.cor_primaria}
                  onChange={e => {
                    const v = e.target.value;
                    if (/^#[0-9A-Fa-f]{0,6}$/.test(v)) {
                      setBrandForm(f => ({ ...f, cor_primaria: v }));
                    }
                  }}
                  placeholder="#14B8A6"
                  className="w-full px-3 py-2.5 bg-white/[0.04] border border-white/[0.08] rounded-xl text-white text-sm font-mono focus:outline-none focus:border-teal-500/40"
                />
                <p className="text-white/25 text-xs mt-1">Usada em botões, destaques e barras de progresso</p>
              </div>
            </div>
          </div>

          {/* Logo URL */}
          <div className="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-4 space-y-3">
            <p className="text-white/50 text-xs font-semibold uppercase tracking-wider">Logo (URL da imagem)</p>
            <input
              type="url"
              value={brandForm.logo_url}
              onChange={e => setBrandForm(f => ({ ...f, logo_url: e.target.value }))}
              placeholder="https://exemplo.com/logo.png"
              className="w-full px-3 py-2.5 bg-white/[0.04] border border-white/[0.08] rounded-xl text-white text-sm placeholder-white/20 focus:outline-none focus:border-teal-500/40"
            />
            <p className="text-white/25 text-xs">PNG ou SVG com fundo transparente. Recomendado: 200×200px.</p>
          </div>

          {/* Mensagem de boas-vindas */}
          <div className="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-4 space-y-3">
            <p className="text-white/50 text-xs font-semibold uppercase tracking-wider">Mensagem de boas-vindas</p>
            <textarea
              value={brandForm.mensagem_boas_vindas}
              onChange={e => setBrandForm(f => ({ ...f, mensagem_boas_vindas: e.target.value }))}
              placeholder="Ex: Bem-vindo ao Edifício Parque das Águas! Cadastre-se para receber alertas de encomendas."
              rows={3}
              maxLength={300}
              className="w-full px-3 py-2.5 bg-white/[0.04] border border-white/[0.08] rounded-xl text-white text-sm placeholder-white/20 focus:outline-none focus:border-teal-500/40 resize-none"
            />
            <p className="text-white/25 text-xs">{brandForm.mensagem_boas_vindas.length}/300 — exibida na página de cadastro dos moradores</p>
          </div>

          <button
            onClick={handleSaveBranding}
            disabled={brandSaving}
            className="w-full py-3.5 bg-teal-500 hover:bg-teal-400 disabled:bg-teal-500/50 rounded-xl text-white font-bold text-sm transition-colors flex items-center justify-center gap-2"
          >
            {brandSaving ? <><Loader2 className="w-4 h-4 animate-spin" /> Salvando…</> : '✓ Salvar identidade visual'}
          </button>

          <p className="text-white/20 text-xs text-center">
            As alterações aparecem imediatamente na página de cadastro e no PWA da portaria.
          </p>
        </div>
      )}

      {/* ── ABA: Configurações ───────────────────────────────────────────── */}
      {aba === 'config' && (
        <div className="space-y-4">
          <div className="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-4 space-y-4">
            <p className="text-white/50 text-xs font-semibold uppercase tracking-wider">Notificações para moradores</p>
            {[
              { label: 'WhatsApp', desc: 'Envia mensagem no WhatsApp do morador', field: 'whatsapp_notify', value: cond.whatsapp_notify },
              { label: 'Push notification', desc: 'Notificação no app quando houver encomenda', field: 'push_notify', value: cond.push_notify },
              { label: 'E-mail', desc: 'E-mail de aviso de chegada', field: 'email_notify', value: cond.email_notify },
            ].map((n, i) => (
              <div key={i} className={`flex items-center justify-between gap-3 ${i > 0 ? 'pt-4 border-t border-white/[0.05]' : ''}`}>
                <div>
                  <p className="text-white text-sm font-semibold">{n.label}</p>
                  <p className="text-white/35 text-xs mt-0.5">{n.desc}</p>
                </div>
                <div className={`w-10 h-6 rounded-full transition-colors ${n.value ? 'bg-teal-500' : 'bg-white/[0.10]'} flex items-center`}>
                  <div className={`w-4 h-4 rounded-full bg-white shadow mx-1 transition-transform ${n.value ? 'translate-x-4' : ''}`} />
                </div>
              </div>
            ))}
            <p className="text-white/20 text-xs">Para alterar as configurações, entre em contato com o suporte Backfindr.</p>
          </div>

          <div className="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-4 space-y-3">
            <p className="text-white/50 text-xs font-semibold uppercase tracking-wider">Dados do condomínio</p>
            {[
              { label: 'Nome', value: cond.nome },
              { label: 'Slug / Link', value: cond.slug },
              { label: 'Total de unidades', value: cond.total_unidades.toString() },
              { label: 'Status', value: cond.active ? 'Ativo' : 'Inativo' },
            ].map((f, i) => (
              <div key={i} className={i > 0 ? 'pt-3 border-t border-white/[0.05]' : ''}>
                <p className="text-white/30 text-xs mb-0.5">{f.label}</p>
                <p className="text-white text-sm">{f.value}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
