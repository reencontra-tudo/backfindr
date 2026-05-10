'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { analytics } from '@/providers/PostHogProvider';
import { ArrowRight, Loader2, Search, CheckCircle2, MapPin, Clock, AlertCircle, Share2 } from 'lucide-react';
import FlowLayout from '@/components/flow/FlowLayout';
import FlowMatchCard, { MatchItem } from '@/components/flow/FlowMatchCard';

type WhenOption = 'agora' | 'hoje' | 'ontem' | 'outro';

interface Step1Data {
  what: string;
  where: string;
  when: WhenOption;
}

const WHEN_OPTIONS: { value: WhenOption; label: string }[] = [
  { value: 'agora', label: 'Agora' },
  { value: 'hoje', label: 'Hoje' },
  { value: 'ontem', label: 'Ontem' },
  { value: 'outro', label: 'Outro horário' },
];

export default function LostFlowClient() {
  const router = useRouter();
  const [step, setStep] = useState(1);

  // Rastrear entrada no fluxo
  useEffect(() => { analytics.flowStarted('lost'); }, []);

  // Rastrear abandono ao sair da página
  useEffect(() => {
    const handleUnload = () => analytics.flowAbandoned('lost', step);
    window.addEventListener('beforeunload', handleUnload);
    return () => window.removeEventListener('beforeunload', handleUnload);
  }, [step]);
  const [step1, setStep1] = useState<Step1Data>({ what: '', where: '', when: 'hoje' });
  const [matches, setMatches] = useState<MatchItem[]>([]);
  const [loadingMatches, setLoadingMatches] = useState(false);
  const [selectedMatch, setSelectedMatch] = useState<MatchItem | null>(null);

  // ─── Tela 1: Captura imediata ─────────────────────────────────────────────
  async function handleStep1Submit(e: React.FormEvent) {
    e.preventDefault();
    if (!step1.what.trim()) return;

    analytics.flowStep('lost', 2, 3);
    setStep(2);
    setLoadingMatches(true);

    try {
      const params = new URLSearchParams();
      params.set('status', 'found');
      params.set('keyword', step1.what.trim());
      params.set('size', '5');
      const res = await fetch(`/api/v1/objects/public?${params.toString()}`);
      const data = await res.json();
      setMatches(data.items || []);
    } catch {
      setMatches([]);
    } finally {
      setLoadingMatches(false);
    }
  }

  // ─── Tela 2: Matches encontrados ─────────────────────────────────────────
  function handleMatchSelect(item: MatchItem) {
    setSelectedMatch(item);
    if (item.unique_code) {
      analytics.flowMatchClicked('lost', item.unique_code);
      router.push(`/objeto/${item.unique_code}`);
    }
  }

  function handleContinueAnyway() {
    analytics.flowStep('lost', 3, 3);
    setStep(3);
  }

  // ─── Tela 3: Finalização — redireciona para registro com intent ───────────
  function handleFinalize() {
    analytics.flowCompleted('lost', matches.length > 0);
    const params = new URLSearchParams();
    params.set('intent', 'lost');
    if (step1.what) params.set('prefill_title', step1.what);
    if (step1.where) params.set('prefill_location', step1.where);
    router.push(`/auth/register?${params.toString()}`);
  }

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <>
      {/* ── TELA 1 ── */}
      {step === 1 && (
        <FlowLayout step={1} totalSteps={3}>
          <div className="pt-2">
            <div className="mb-7">
              <div className="inline-flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-full px-3 py-1 mb-4">
                <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
                <span className="text-red-400 text-xs font-medium">Quanto antes, maiores as chances</span>
              </div>
              <h1 className="text-2xl font-bold text-white leading-tight mb-2">
                Perdeu algo?<br />Vamos começar agora.
              </h1>
              <p className="text-white/40 text-sm leading-relaxed">
                Leva menos de 30 segundos. A rede já vai começar a procurar.
              </p>
            </div>

            <form onSubmit={handleStep1Submit} className="space-y-4">
              {/* O que perdeu */}
              <div>
                <label className="block text-sm text-white/60 font-medium mb-1.5">
                  O que você perdeu?
                </label>
                <input
                  type="text"
                  value={step1.what}
                  onChange={e => setStep1(s => ({ ...s, what: e.target.value }))}
                  placeholder="Ex: iPhone preto, mochila azul, carteira marrom..."
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3.5 text-white placeholder-white/20 text-sm outline-none focus:border-teal-500/60 focus:bg-white/[0.06] transition-all"
                  autoFocus
                  required
                />
              </div>

              {/* Onde */}
              <div>
                <label className="block text-sm text-white/60 font-medium mb-1.5 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-white/40" />
                  Onde foi?
                </label>
                <input
                  type="text"
                  value={step1.where}
                  onChange={e => setStep1(s => ({ ...s, where: e.target.value }))}
                  placeholder="Cidade, bairro ou local"
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3.5 text-white placeholder-white/20 text-sm outline-none focus:border-teal-500/60 focus:bg-white/[0.06] transition-all"
                />
              </div>

              {/* Quando */}
              <div>
                <label className="block text-sm text-white/60 font-medium mb-2 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-white/40" />
                  Quando aconteceu?
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {WHEN_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setStep1(s => ({ ...s, when: opt.value }))}
                      className={`py-2.5 rounded-xl text-sm font-medium border transition-all ${
                        step1.when === opt.value
                          ? 'bg-teal-500/20 border-teal-500/50 text-teal-300'
                          : 'bg-white/[0.03] border-white/[0.08] text-white/50 hover:border-white/20'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                disabled={!step1.what.trim()}
                className="w-full flex items-center justify-center gap-2 bg-teal-500 hover:bg-teal-400 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold py-4 rounded-xl transition-all text-base mt-2"
                style={{ boxShadow: '0 0 0 1px rgba(20,184,166,0.4),0 4px 20px rgba(20,184,166,0.15)' }}
              >
                <Search className="w-5 h-5" />
                Continuar
              </button>
            </form>
          </div>
        </FlowLayout>
      )}

      {/* ── TELA 2 ── */}
      {step === 2 && (
        <FlowLayout step={2} totalSteps={3}>
          <div className="pt-2">
            {loadingMatches ? (
              <div className="flex flex-col items-center py-16 gap-4">
                <div className="w-14 h-14 rounded-2xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center">
                  <Loader2 className="w-7 h-7 text-teal-400 animate-spin" />
                </div>
                <div className="text-center">
                  <p className="text-white font-semibold mb-1">Já estamos procurando por você.</p>
                  <p className="text-white/40 text-sm">Cruzando relatos na rede...</p>
                </div>
              </div>
            ) : (
              <>
                <div className="mb-6">
                  <h2 className="text-2xl font-bold text-white leading-tight mb-2">
                    {matches.length > 0
                      ? 'Encontramos publicações parecidas.'
                      : 'Nenhum resultado ainda.'}
                  </h2>
                  <p className="text-white/40 text-sm">
                    {matches.length > 0
                      ? `${matches.length} ${matches.length === 1 ? 'item encontrado' : 'itens encontrados'} na rede para "${step1.what}"`
                      : `Nenhum item encontrado para "${step1.what}" ainda — mas você pode publicar um alerta agora.`}
                  </p>
                </div>

                {matches.length > 0 && (
                  <div className="space-y-3 mb-6">
                    {matches.map(item => (
                      <FlowMatchCard
                        key={item.id}
                        item={item}
                        onSelect={handleMatchSelect}
                        label="É parecido com o meu"
                      />
                    ))}
                  </div>
                )}

                {matches.length === 0 && (
                  <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5 mb-6 flex gap-3">
                    <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-white/70 text-sm font-medium mb-1">A IA cruza relatos em tempo real.</p>
                      <p className="text-white/40 text-xs leading-relaxed">
                        Se alguém publicar algo parecido depois que você registrar, você será avisado imediatamente.
                      </p>
                    </div>
                  </div>
                )}

                <div className="space-y-3">
                  <button
                    onClick={handleContinueAnyway}
                    className="w-full flex items-center justify-center gap-2 bg-teal-500 hover:bg-teal-400 text-white font-bold py-4 rounded-xl transition-all text-base"
                    style={{ boxShadow: '0 0 0 1px rgba(20,184,166,0.4),0 4px 20px rgba(20,184,166,0.15)' }}
                  >
                    {matches.length > 0 ? 'Nenhum é o meu — continuar' : 'Publicar alerta agora'}
                    <ArrowRight className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => setStep(1)}
                    className="w-full py-3 text-white/40 hover:text-white/60 text-sm transition-colors"
                  >
                    Voltar e refinar a busca
                  </button>
                </div>
              </>
            )}
          </div>
        </FlowLayout>
      )}

      {/* ── TELA 3 ── */}
      {step === 3 && (
        <FlowLayout step={3} totalSteps={3}>
          <div className="pt-2">
            <div className="mb-7">
              <div className="inline-flex items-center gap-2 bg-teal-500/10 border border-teal-500/20 rounded-full px-3 py-1 mb-4">
                <CheckCircle2 className="w-3.5 h-3.5 text-teal-400" />
                <span className="text-teal-400 text-xs font-medium">Quase lá</span>
              </div>
              <h2 className="text-2xl font-bold text-white leading-tight mb-2">
                Finalize sua publicação.
              </h2>
              <p className="text-white/40 text-sm leading-relaxed">
                Crie sua conta gratuita para publicar o alerta. Se alguém achar, você recebe uma notificação na hora.
              </p>
            </div>

            {/* Resumo do que foi preenchido */}
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-4 mb-6 space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <span className="text-white/40 w-16 flex-shrink-0">Item:</span>
                <span className="text-white font-medium truncate">{step1.what}</span>
              </div>
              {step1.where && (
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-white/40 w-16 flex-shrink-0">Local:</span>
                  <span className="text-white/70 truncate">{step1.where}</span>
                </div>
              )}
              <div className="flex items-center gap-2 text-sm">
                <span className="text-white/40 w-16 flex-shrink-0">Quando:</span>
                <span className="text-white/70 capitalize">{step1.when}</span>
              </div>
            </div>

            <div className="space-y-3">
              <button
                onClick={handleFinalize}
                className="w-full flex items-center justify-center gap-2 bg-teal-500 hover:bg-teal-400 text-white font-bold py-4 rounded-xl transition-all text-base"
                style={{ boxShadow: '0 0 0 1px rgba(20,184,166,0.4),0 4px 20px rgba(20,184,166,0.15)' }}
              >
                Publicar alerta agora
                <ArrowRight className="w-5 h-5" />
              </button>
              <p className="text-center text-white/30 text-xs">
                Gratuito. Seu contato não fica exposto publicamente.
              </p>

              {/* Compartilhar — aumenta chances de encontrar */}
              <button
                onClick={() => {
                  const text = `🔍 Perdi ${step1.what}${step1.where ? ` em ${step1.where}` : ''}. Alguém viu? Backfindr conecta quem perdeu com quem achou: https://backfindr.com.br/flow/found`;
                  if (navigator.share) {
                    navigator.share({ title: `Perdi ${step1.what}`, text });
                  } else {
                    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
                  }
                }}
                className="w-full flex items-center justify-center gap-2 py-3 text-teal-400/70 hover:text-teal-400 border border-teal-500/20 hover:border-teal-500/40 rounded-xl text-sm font-medium transition-all"
              >
                <Share2 className="w-4 h-4" />
                Compartilhar no WhatsApp
              </button>

              <button
                onClick={() => setStep(2)}
                className="w-full py-3 text-white/40 hover:text-white/60 text-sm transition-colors"
              >
                Voltar
              </button>
            </div>
          </div>
        </FlowLayout>
      )}
    </>
  );
}
