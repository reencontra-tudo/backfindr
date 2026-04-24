'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { analytics } from '@/providers/PostHogProvider';
import { ArrowRight, Loader2, CheckCircle2, MapPin, AlertCircle, Dog, Cat, Bird, Share2 } from 'lucide-react';
import FlowLayout from '@/components/flow/FlowLayout';
import FlowMatchCard, { MatchItem } from '@/components/flow/FlowMatchCard';

type PetType = 'cachorro' | 'gato' | 'passaro' | 'outro';

const PET_OPTIONS: { value: PetType; label: string; icon: React.ReactNode }[] = [
  { value: 'cachorro', label: 'Cachorro', icon: <Dog className="w-5 h-5" /> },
  { value: 'gato', label: 'Gato', icon: <Cat className="w-5 h-5" /> },
  { value: 'passaro', label: 'Pássaro', icon: <Bird className="w-5 h-5" /> },
  { value: 'outro', label: 'Outro animal', icon: <span className="text-lg">🐾</span> },
];

interface Step1Data {
  petType: PetType;
  breed: string;
  color: string;
  name: string;
  where: string;
}

export default function PetFlowClient() {
  const router = useRouter();
  const [step, setStep] = useState(1);

  useEffect(() => { analytics.flowStarted('pet'); }, []);
  useEffect(() => {
    const handleUnload = () => analytics.flowAbandoned('pet', step);
    window.addEventListener('beforeunload', handleUnload);
    return () => window.removeEventListener('beforeunload', handleUnload);
  }, [step]);
  const [step1, setStep1] = useState<Step1Data>({
    petType: 'cachorro',
    breed: '',
    color: '',
    name: '',
    where: '',
  });
  const [matches, setMatches] = useState<MatchItem[]>([]);
  const [loadingMatches, setLoadingMatches] = useState(false);

  async function handleStep1Submit(e: React.FormEvent) {
    e.preventDefault();
    analytics.flowStep('pet', 2, 3);
    setStep(2);
    setLoadingMatches(true);

    try {
      const keyword = [
        step1.petType,
        step1.breed,
        step1.color,
        step1.name,
      ].filter(Boolean).join(' ');

      const params = new URLSearchParams();
      params.set('status', 'found');
      params.set('keyword', keyword);
      params.set('category', 'pet');
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
      analytics.flowMatchClicked('pet', item.unique_code);
      router.push(`/objeto/${item.unique_code}`);
    }
  }

  function handleFinalize() {
    analytics.flowCompleted('pet', matches.length > 0);
    const params = new URLSearchParams();
    params.set('intent', 'lost');
    params.set('prefill_category', 'pet');
    const title = [step1.name, step1.breed, step1.petType].filter(Boolean).join(' ');
    if (title) params.set('prefill_title', title);
    if (step1.where) params.set('prefill_location', step1.where);
    if (step1.breed) params.set('prefill_breed', step1.breed);
    if (step1.color) params.set('prefill_color', step1.color);
    router.push(`/auth/register?${params.toString()}`);
  }

  return (
    <>
      {/* ── TELA 1 ── */}
      {step === 1 && (
        <FlowLayout step={1} totalSteps={3}>
          <div className="pt-2">
            <div className="mb-7">
              <div className="inline-flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 rounded-full px-3 py-1 mb-4">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                <span className="text-amber-400 text-xs font-medium">Cada minuto conta</span>
              </div>
              <h1 className="text-2xl font-bold text-white leading-tight mb-2">
                Seu pet sumiu?<br />Vamos agir agora.
              </h1>
              <p className="text-white/40 text-sm leading-relaxed">
                Publique o alerta e a rede começa a procurar imediatamente.
              </p>
            </div>

            <form onSubmit={handleStep1Submit} className="space-y-4">
              {/* Tipo de pet */}
              <div>
                <label className="block text-sm text-white/60 font-medium mb-2">Que tipo de animal?</label>
                <div className="grid grid-cols-2 gap-2">
                  {PET_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setStep1(s => ({ ...s, petType: opt.value }))}
                      className={`flex items-center gap-2 py-3 px-4 rounded-xl text-sm font-medium border transition-all ${
                        step1.petType === opt.value
                          ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                          : 'bg-white/[0.03] border-white/[0.08] text-white/50 hover:border-white/20'
                      }`}
                    >
                      <span className={step1.petType === opt.value ? 'text-amber-400' : 'text-white/30'}>
                        {opt.icon}
                      </span>
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Nome do pet */}
              <div>
                <label className="block text-sm text-white/60 font-medium mb-1.5">Nome do pet</label>
                <input
                  type="text"
                  value={step1.name}
                  onChange={e => setStep1(s => ({ ...s, name: e.target.value }))}
                  placeholder="Ex: Rex, Mia, Bolinha..."
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3.5 text-white placeholder-white/20 text-sm outline-none focus:border-amber-500/60 focus:bg-white/[0.06] transition-all"
                  autoFocus
                />
              </div>

              {/* Raça e cor */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-white/60 font-medium mb-1.5">Raça</label>
                  <input
                    type="text"
                    value={step1.breed}
                    onChange={e => setStep1(s => ({ ...s, breed: e.target.value }))}
                    placeholder="Ex: Golden, SRD..."
                    className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3.5 text-white placeholder-white/20 text-sm outline-none focus:border-amber-500/60 focus:bg-white/[0.06] transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm text-white/60 font-medium mb-1.5">Cor</label>
                  <input
                    type="text"
                    value={step1.color}
                    onChange={e => setStep1(s => ({ ...s, color: e.target.value }))}
                    placeholder="Ex: caramelo, preto..."
                    className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3.5 text-white placeholder-white/20 text-sm outline-none focus:border-amber-500/60 focus:bg-white/[0.06] transition-all"
                  />
                </div>
              </div>

              {/* Onde sumiu */}
              <div>
                <label className="block text-sm text-white/60 font-medium mb-1.5 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-white/40" />
                  Onde sumiu?
                </label>
                <input
                  type="text"
                  value={step1.where}
                  onChange={e => setStep1(s => ({ ...s, where: e.target.value }))}
                  placeholder="Bairro ou cidade"
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3.5 text-white placeholder-white/20 text-sm outline-none focus:border-amber-500/60 focus:bg-white/[0.06] transition-all"
                />
              </div>

              <button
                type="submit"
                className="w-full flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 text-white font-bold py-4 rounded-xl transition-all text-base mt-2"
                style={{ boxShadow: '0 0 0 1px rgba(245,158,11,0.4),0 4px 20px rgba(245,158,11,0.15)' }}
              >
                Buscar na rede agora
                <ArrowRight className="w-5 h-5" />
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
                <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                  <Loader2 className="w-7 h-7 text-amber-400 animate-spin" />
                </div>
                <div className="text-center">
                  <p className="text-white font-semibold mb-1">Buscando na rede...</p>
                  <p className="text-white/40 text-sm">Verificando relatos de animais encontrados.</p>
                </div>
              </div>
            ) : (
              <>
                <div className="mb-6">
                  <h2 className="text-2xl font-bold text-white leading-tight mb-2">
                    {matches.length > 0
                      ? 'Encontramos relatos parecidos.'
                      : 'Nenhum relato ainda.'}
                  </h2>
                  <p className="text-white/40 text-sm">
                    {matches.length > 0
                      ? `${matches.length} ${matches.length === 1 ? 'relato encontrado' : 'relatos encontrados'} na rede`
                      : 'Publique o alerta agora — se alguém encontrar, você recebe uma notificação imediata.'}
                  </p>
                </div>

                {matches.length > 0 && (
                  <div className="space-y-3 mb-6">
                    {matches.map(item => (
                      <FlowMatchCard
                        key={item.id}
                        item={item}
                        onSelect={handleMatchSelect}
                        label="Pode ser o meu pet"
                      />
                    ))}
                  </div>
                )}

                {matches.length === 0 && (
                  <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5 mb-6 flex gap-3">
                    <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-white/70 text-sm font-medium mb-1">Publique o alerta agora.</p>
                      <p className="text-white/40 text-xs leading-relaxed">
                        Quando alguém encontrar um animal parecido, o sistema cruza automaticamente e te avisa na hora.
                      </p>
                    </div>
                  </div>
                )}

                <div className="space-y-3">
                  <button
                    onClick={() => setStep(3)}
                    className="w-full flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 text-white font-bold py-4 rounded-xl transition-all text-base"
                    style={{ boxShadow: '0 0 0 1px rgba(245,158,11,0.4),0 4px 20px rgba(245,158,11,0.15)' }}
                  >
                    {matches.length > 0 ? 'Nenhum é o meu — publicar alerta' : 'Publicar alerta agora'}
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
              <div className="inline-flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 rounded-full px-3 py-1 mb-4">
                <CheckCircle2 className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-amber-400 text-xs font-medium">Quase lá</span>
              </div>
              <h2 className="text-2xl font-bold text-white leading-tight mb-2">
                Publique o alerta<br />e a rede age.
              </h2>
              <p className="text-white/40 text-sm leading-relaxed">
                Crie sua conta gratuita para publicar. Se alguém encontrar seu pet, você recebe uma notificação imediata.
              </p>
            </div>

            {/* Resumo */}
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-4 mb-6 space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <span className="text-white/40 w-16 flex-shrink-0">Animal:</span>
                <span className="text-white font-medium capitalize">{step1.petType}</span>
              </div>
              {step1.name && (
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-white/40 w-16 flex-shrink-0">Nome:</span>
                  <span className="text-white/70">{step1.name}</span>
                </div>
              )}
              {step1.breed && (
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-white/40 w-16 flex-shrink-0">Raça:</span>
                  <span className="text-white/70">{step1.breed}</span>
                </div>
              )}
              {step1.where && (
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-white/40 w-16 flex-shrink-0">Local:</span>
                  <span className="text-white/70">{step1.where}</span>
                </div>
              )}
            </div>

            <div className="space-y-3">
              <button
                onClick={handleFinalize}
                className="w-full flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 text-white font-bold py-4 rounded-xl transition-all text-base"
                style={{ boxShadow: '0 0 0 1px rgba(245,158,11,0.4),0 4px 20px rgba(245,158,11,0.15)' }}
              >
                Publicar alerta do pet
                <ArrowRight className="w-5 h-5" />
              </button>
              <p className="text-center text-white/30 text-xs">
                Gratuito. Seu contato fica protegido.
              </p>

              {/* Compartilhar antes de publicar — aumenta viralização */}
              <button
                onClick={() => {
                  const petLabel = [step1.name, step1.breed, step1.petType].filter(Boolean).join(' ');
                  const text = `🐾 Alguém viu este pet? ${petLabel}${step1.where ? ` — ${step1.where}` : ''}. Ajude a encontrar! https://backfindr.com.br/flow/pet`;
                  if (navigator.share) {
                    navigator.share({ title: `Pet desaparecido: ${petLabel}`, text });
                  } else {
                    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
                  }
                }}
                className="w-full flex items-center justify-center gap-2 py-3 text-amber-400/70 hover:text-amber-400 border border-amber-500/20 hover:border-amber-500/40 rounded-xl text-sm font-medium transition-all"
              >
                <Share2 className="w-4 h-4" />
                Compartilhar no WhatsApp agora
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
