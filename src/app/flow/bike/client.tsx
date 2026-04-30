'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { analytics } from '@/providers/PostHogProvider';
import { ArrowRight, Loader2, Search, CheckCircle2, MapPin, Clock, AlertCircle, Share2 } from 'lucide-react';
import FlowLayout from '@/components/flow/FlowLayout';
import FlowMatchCard, { MatchItem } from '@/components/flow/FlowMatchCard';

type WhenOption = 'agora' | 'hoje' | 'ontem' | 'outro';
type EventType = 'roubada' | 'perdida';

interface Step1Data {
  what: string;
  where: string;
  when: WhenOption;
  event: EventType;
}

const WHEN_OPTIONS: { value: WhenOption; label: string }[] = [
  { value: 'agora', label: 'Agora' },
  { value: 'hoje', label: 'Hoje' },
  { value: 'ontem', label: 'Ontem' },
  { value: 'outro', label: 'Outro horário' },
];

export default function BikeFlowClient() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [step1, setStep1] = useState<Step1Data>({ what: '', where: '', when: 'hoje', event: 'roubada' });
  const [matches, setMatches] = useState<MatchItem[]>([]);
  const [loadingMatches, setLoadingMatches] = useState(false);

  useEffect(() => { analytics.flowStarted('bike'); }, []);
  useEffect(() => {
    const handleUnload = () => analytics.flowAbandoned('bike', step);
    window.addEventListener('beforeunload', handleUnload);
    return () => window.removeEventListener('beforeunload', handleUnload);
  }, [step]);

  async function handleStep1Submit(e: React.FormEvent) {
    e.preventDefault();
    if (!step1.what.trim()) return;
    analytics.flowStep('bike', 2, 3);
    setStep(2);
    setLoadingMatches(true);
    try {
      const params = new URLSearchParams();
      params.set('status', 'found');
      params.set('category', 'bike');
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

  function handleMatchSelect(item: MatchItem) {
    if (item.unique_code) {
      analytics.flowMatchClicked('bike', item.unique_code);
      router.push(`/objeto/${item.unique_code}`);
    }
  }

  function handleFinalize() {
    analytics.flowCompleted('bike', matches.length > 0);
    const params = new URLSearchParams();
    params.set('intent', 'lost');
    params.set('prefill_category', 'bike');
    const title = [step1.event === 'roubada' ? 'Bike roubada' : 'Bike perdida', step1.what].filter(Boolean).join(' — ');
    params.set('prefill_title', title);
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
              <div className="inline-flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 rounded-full px-3 py-1 mb-4">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                <span className="text-blue-400 text-xs font-medium">Registre agora — a rede vigia por você</span>
              </div>
              <h1 className="text-2xl font-bold text-white leading-tight mb-2">
                🚲 Sua bike sumiu?<br />Vamos agir agora.
              </h1>
              <p className="text-white/40 text-sm leading-relaxed">
                Registre em 30 segundos. Se ela aparecer em qualquer canal, você é avisado.
              </p>
            </div>

            <form onSubmit={handleStep1Submit} className="space-y-4">
              {/* Roubada ou perdida */}
              <div>
                <label className="block text-sm text-white/60 font-medium mb-2">O que aconteceu?</label>
                <div className="grid grid-cols-2 gap-2">
                  {(['roubada', 'perdida'] as EventType[]).map(opt => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setStep1(s => ({ ...s, event: opt }))}
                      className={`py-2.5 rounded-xl text-sm font-medium border transition-all ${
                        step1.event === opt
                          ? 'bg-blue-500/20 border-blue-500/50 text-blue-300'
                          : 'bg-white/[0.03] border-white/[0.08] text-white/50 hover:border-white/20'
                      }`}
                    >
                      {opt === 'roubada' ? '🚨 Roubada' : '🔍 Perdida'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Descrição */}
              <div>
                <label className="block text-sm text-white/60 font-medium mb-1.5">
                  Descreva a bike
                </label>
                <input
                  type="text"
                  value={step1.what}
                  onChange={e => setStep1(s => ({ ...s, what: e.target.value }))}
                  placeholder="Ex: Caloi azul aro 29, Trek preta, Speed vermelha..."
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
                  placeholder="Bairro, ciclovia, estação de metrô..."
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
                Buscar na rede
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
                  <p className="text-white font-semibold mb-1">Procurando sua bike na rede...</p>
                  <p className="text-white/40 text-sm">Cruzando relatos em São Paulo.</p>
                </div>
              </div>
            ) : (
              <>
                <div className="mb-6">
                  <h2 className="text-2xl font-bold text-white leading-tight mb-2">
                    {matches.length > 0 ? 'Encontramos bikes parecidas.' : 'Nenhum resultado ainda.'}
                  </h2>
                  <p className="text-white/40 text-sm">
                    {matches.length > 0
                      ? `${matches.length} ${matches.length === 1 ? 'registro encontrado' : 'registros encontrados'} para "${step1.what}"`
                      : `Nenhuma bike encontrada para "${step1.what}" — mas você pode publicar um alerta agora.`}
                  </p>
                </div>

                {matches.length > 0 && (
                  <div className="space-y-3 mb-6">
                    {matches.map(item => (
                      <FlowMatchCard key={item.id} item={item} onSelect={handleMatchSelect} label="Pode ser a minha" />
                    ))}
                  </div>
                )}

                {matches.length === 0 && (
                  <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5 mb-6 flex gap-3">
                    <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-white/70 text-sm font-medium mb-1">A rede continua monitorando.</p>
                      <p className="text-white/40 text-xs leading-relaxed">
                        Quando alguém reportar uma bike parecida, você será avisado na hora.
                      </p>
                    </div>
                  </div>
                )}

                <div className="space-y-3">
                  <button
                    onClick={() => { analytics.flowStep('bike', 3, 3); setStep(3); }}
                    className="w-full flex items-center justify-center gap-2 bg-teal-500 hover:bg-teal-400 text-white font-bold py-4 rounded-xl transition-all text-base"
                    style={{ boxShadow: '0 0 0 1px rgba(20,184,166,0.4),0 4px 20px rgba(20,184,166,0.15)' }}
                  >
                    {matches.length > 0 ? 'Não é a minha — continuar' : 'Publicar alerta agora'}
                    <ArrowRight className="w-5 h-5" />
                  </button>
                  <button onClick={() => setStep(1)} className="w-full py-3 text-white/40 hover:text-white/60 text-sm transition-colors">
                    Voltar e refinar
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
              <h2 className="text-2xl font-bold text-white leading-tight mb-2">Publique o alerta.</h2>
              <p className="text-white/40 text-sm leading-relaxed">
                Conta gratuita em segundos. Se sua bike aparecer em qualquer canal, você recebe notificação na hora.
              </p>
            </div>

            <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-4 mb-6 space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <span className="text-white/40 w-20 flex-shrink-0">Categoria:</span>
                <span className="text-white font-medium">🚲 Bicicleta</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span className="text-white/40 w-20 flex-shrink-0">Descrição:</span>
                <span className="text-white font-medium truncate">{step1.what}</span>
              </div>
              {step1.where && (
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-white/40 w-20 flex-shrink-0">Local:</span>
                  <span className="text-white/70 truncate">{step1.where}</span>
                </div>
              )}
              <div className="flex items-center gap-2 text-sm">
                <span className="text-white/40 w-20 flex-shrink-0">Quando:</span>
                <span className="text-white/70 capitalize">{step1.when}</span>
              </div>
            </div>

            <div className="space-y-3">
              <button
                onClick={handleFinalize}
                className="w-full flex items-center justify-center gap-2 bg-teal-500 hover:bg-teal-400 text-white font-bold py-4 rounded-xl transition-all text-base"
                style={{ boxShadow: '0 0 0 1px rgba(20,184,166,0.4),0 4px 20px rgba(20,184,166,0.15)' }}
              >
                Publicar alerta agora <ArrowRight className="w-5 h-5" />
              </button>
              <p className="text-center text-white/30 text-xs">Gratuito. Seu contato não fica exposto publicamente.</p>
              <button
                onClick={() => {
                  const text = `🚲 ${step1.event === 'roubada' ? 'Roubaram' : 'Perdi'} minha bike${step1.what ? ` — ${step1.what}` : ''}${step1.where ? ` em ${step1.where}` : ''}. Alguém viu? backfindr.com/flow/bike`;
                  if (navigator.share) navigator.share({ title: 'Minha bike sumiu', text });
                  else window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
                }}
                className="w-full flex items-center justify-center gap-2 py-3 text-teal-400/70 hover:text-teal-400 border border-teal-500/20 hover:border-teal-500/40 rounded-xl text-sm font-medium transition-all"
              >
                <Share2 className="w-4 h-4" />
                Compartilhar no WhatsApp
              </button>
              <button onClick={() => setStep(2)} className="w-full py-3 text-white/40 hover:text-white/60 text-sm transition-colors">Voltar</button>
            </div>
          </div>
        </FlowLayout>
      )}
    </>
  );
}
