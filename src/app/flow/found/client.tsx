'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { analytics } from '@/providers/PostHogProvider';
import { ArrowRight, Loader2, CheckCircle2, MapPin, Package, Sparkles, AlertCircle } from 'lucide-react';
import FlowLayout from '@/components/flow/FlowLayout';
import FlowMatchCard, { MatchItem } from '@/components/flow/FlowMatchCard';

type WhereOption = 'rua' | 'transporte' | 'comercio' | 'outro';

interface Step1Data {
  what: string;
  where: string;
  whereType: WhereOption;
}

const WHERE_OPTIONS: { value: WhereOption; label: string; emoji: string }[] = [
  { value: 'rua', label: 'Rua / calçada', emoji: '🏙️' },
  { value: 'transporte', label: 'Transporte público', emoji: '🚌' },
  { value: 'comercio', label: 'Comércio / restaurante', emoji: '🏪' },
  { value: 'outro', label: 'Outro lugar', emoji: '📍' },
];

export default function FoundFlowClient() {
  const router = useRouter();
  const [step, setStep] = useState(1);

  useEffect(() => { analytics.flowStarted('found'); }, []);
  useEffect(() => {
    const handleUnload = () => analytics.flowAbandoned('found', step);
    window.addEventListener('beforeunload', handleUnload);
    return () => window.removeEventListener('beforeunload', handleUnload);
  }, [step]);
  const [step1, setStep1] = useState<Step1Data>({ what: '', where: '', whereType: 'rua' });
  const [matches, setMatches] = useState<MatchItem[]>([]);
  const [loadingMatches, setLoadingMatches] = useState(false);

  // ─── Tela 1: Captura do que foi encontrado ────────────────────────────────
  async function handleStep1Submit(e: React.FormEvent) {
    e.preventDefault();
    if (!step1.what.trim()) return;

    analytics.flowStep('found', 2, 3);
    setStep(2);
    setLoadingMatches(true);

    try {
      const params = new URLSearchParams();
      params.set('status', 'lost');
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

  // ─── Tela 2: Matches — alguém perdeu isso? ───────────────────────────────
  function handleMatchSelect(item: MatchItem) {
    if (item.unique_code) {
      analytics.flowMatchClicked('found', item.unique_code);
      router.push(`/objeto/${item.unique_code}`);
    }
  }

  function handleContinueAnyway() {
    analytics.flowStep('found', 3, 3);
    setStep(3);
  }

  // ─── Tela 3: Finalização — redireciona para registro com intent
  function handleFinalize() {
    analytics.flowCompleted('found', matches.length > 0);
    const params = new URLSearchParams();
    params.set('intent', 'found');
    if (step1.what) params.set('prefill_title', step1.what);
    if (step1.where) params.set('prefill_location', step1.where);
    router.push(`/auth/register?${params.toString()}`);
  }

  return (
    <>
      {/* ── TELA 1 ── */}
      {step === 1 && (
        <FlowLayout step={1} totalSteps={3}>
          <div className="pt-2">
            <div className="mb-7">
              <div className="inline-flex items-center gap-2 bg-teal-500/10 border border-teal-500/20 rounded-full px-3 py-1 mb-4">
                <Sparkles className="w-3.5 h-3.5 text-teal-400" />
                <span className="text-teal-400 text-xs font-medium">Boa ação — você pode mudar o dia de alguém</span>
              </div>
              <h1 className="text-2xl font-bold text-white leading-tight mb-2">
                Encontrou algo?<br />Vamos devolver.
              </h1>
              <p className="text-white/40 text-sm leading-relaxed">
                Em menos de 30 segundos você publica o achado e o dono recebe uma notificação.
              </p>
            </div>

            <form onSubmit={handleStep1Submit} className="space-y-4">
              {/* O que encontrou */}
              <div>
                <label className="block text-sm text-white/60 font-medium mb-1.5">
                  O que você encontrou?
                </label>
                <input
                  type="text"
                  value={step1.what}
                  onChange={e => setStep1(s => ({ ...s, what: e.target.value }))}
                  placeholder="Ex: carteira preta, celular Samsung, chaves..."
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3.5 text-white placeholder-white/20 text-sm outline-none focus:border-teal-500/60 focus:bg-white/[0.06] transition-all"
                  autoFocus
                  required
                />
              </div>

              {/* Onde encontrou */}
              <div>
                <label className="block text-sm text-white/60 font-medium mb-2 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-white/40" />
                  Onde você encontrou?
                </label>
                <div className="grid grid-cols-2 gap-2 mb-3">
                  {WHERE_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setStep1(s => ({ ...s, whereType: opt.value }))}
                      className={`flex items-center gap-2 py-2.5 px-3 rounded-xl text-sm font-medium border transition-all ${
                        step1.whereType === opt.value
                          ? 'bg-teal-500/20 border-teal-500/50 text-teal-300'
                          : 'bg-white/[0.03] border-white/[0.08] text-white/50 hover:border-white/20'
                      }`}
                    >
                      <span>{opt.emoji}</span>
                      <span className="text-xs">{opt.label}</span>
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  value={step1.where}
                  onChange={e => setStep1(s => ({ ...s, where: e.target.value }))}
                  placeholder="Cidade ou bairro (opcional)"
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-white placeholder-white/20 text-sm outline-none focus:border-teal-500/60 focus:bg-white/[0.06] transition-all"
                />
              </div>

              <button
                type="submit"
                disabled={!step1.what.trim()}
                className="w-full flex items-center justify-center gap-2 bg-teal-500 hover:bg-teal-400 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold py-4 rounded-xl transition-all text-base mt-2"
                style={{ boxShadow: '0 0 0 1px rgba(20,184,166,0.4),0 4px 20px rgba(20,184,166,0.15)' }}
              >
                <Package className="w-5 h-5" />
                Verificar se alguém perdeu isso
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
                  <p className="text-white font-semibold mb-1">Verificando a rede...</p>
                  <p className="text-white/40 text-sm">Buscando quem perdeu algo parecido.</p>
                </div>
              </div>
            ) : (
              <>
                <div className="mb-6">
                  <h2 className="text-2xl font-bold text-white leading-tight mb-2">
                    {matches.length > 0
                      ? 'Alguém pode estar procurando isso.'
                      : 'Nenhum alerta correspondente ainda.'}
                  </h2>
                  <p className="text-white/40 text-sm">
                    {matches.length > 0
                      ? `${matches.length} ${matches.length === 1 ? 'alerta encontrado' : 'alertas encontrados'} para "${step1.what}"`
                      : `Nenhum alerta de perda para "${step1.what}" — mas publique o achado e o dono pode aparecer.`}
                  </p>
                </div>

                {matches.length > 0 && (
                  <div className="space-y-3 mb-6">
                    {matches.map(item => (
                      <FlowMatchCard
                        key={item.id}
                        item={item}
                        onSelect={handleMatchSelect}
                        label="Pode ser o dono"
                      />
                    ))}
                  </div>
                )}

                {matches.length === 0 && (
                  <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5 mb-6 flex gap-3">
                    <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-white/70 text-sm font-medium mb-1">Publique o achado agora.</p>
                      <p className="text-white/40 text-xs leading-relaxed">
                        Quando o dono registrar o alerta de perda, o sistema cruza automaticamente e notifica os dois.
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
                    {matches.length > 0 ? 'Nenhum é o dono — publicar achado' : 'Publicar o achado agora'}
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
                Publique o achado agora.
              </h2>
              <p className="text-white/40 text-sm leading-relaxed">
                Seu contato fica protegido. O dono entra em contato pelo sistema — você não precisa expor nada.
              </p>
            </div>

            {/* Resumo */}
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-4 mb-6 space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <span className="text-white/40 w-20 flex-shrink-0">Item:</span>
                <span className="text-white font-medium truncate">{step1.what}</span>
              </div>
              {step1.where && (
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-white/40 w-20 flex-shrink-0">Local:</span>
                  <span className="text-white/70 truncate">{step1.where}</span>
                </div>
              )}
              <div className="flex items-center gap-2 text-sm">
                <span className="text-white/40 w-20 flex-shrink-0">Onde:</span>
                <span className="text-white/70 capitalize">
                  {WHERE_OPTIONS.find(o => o.value === step1.whereType)?.label}
                </span>
              </div>
            </div>

            <div className="space-y-3">
              <button
                onClick={handleFinalize}
                className="w-full flex items-center justify-center gap-2 bg-teal-500 hover:bg-teal-400 text-white font-bold py-4 rounded-xl transition-all text-base"
                style={{ boxShadow: '0 0 0 1px rgba(20,184,166,0.4),0 4px 20px rgba(20,184,166,0.15)' }}
              >
                Publicar achado agora
                <ArrowRight className="w-5 h-5" />
              </button>
              <p className="text-center text-white/30 text-xs">
                Gratuito. Seu contato não fica exposto publicamente.
              </p>
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
