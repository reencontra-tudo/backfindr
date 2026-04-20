'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, CheckCircle2, AlertTriangle, MapPin, Clock, ShieldAlert, Info } from 'lucide-react';
import FlowLayout from '@/components/flow/FlowLayout';

type WhenOption = 'agora' | 'hoje' | 'ontem' | 'outro';
type HowOption = 'furto' | 'roubo' | 'assalto' | 'outro';

const WHEN_OPTIONS: { value: WhenOption; label: string }[] = [
  { value: 'agora', label: 'Agora' },
  { value: 'hoje', label: 'Hoje' },
  { value: 'ontem', label: 'Ontem' },
  { value: 'outro', label: 'Outro horário' },
];

const HOW_OPTIONS: { value: HowOption; label: string; desc: string }[] = [
  { value: 'furto', label: 'Furto', desc: 'Levaram sem confronto' },
  { value: 'roubo', label: 'Roubo', desc: 'Com ameaça ou força' },
  { value: 'assalto', label: 'Assalto a mão armada', desc: 'Com arma' },
  { value: 'outro', label: 'Outro', desc: 'Situação diferente' },
];

interface Step1Data {
  what: string;
  where: string;
  when: WhenOption;
  how: HowOption;
}

export default function StolenFlowClient() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [step1, setStep1] = useState<Step1Data>({
    what: '',
    where: '',
    when: 'hoje',
    how: 'furto',
  });

  function handleStep1Submit(e: React.FormEvent) {
    e.preventDefault();
    if (!step1.what.trim()) return;
    setStep(2);
  }

  function handleFinalize() {
    const params = new URLSearchParams();
    params.set('intent', 'stolen');
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
              <div className="inline-flex items-center gap-2 bg-orange-500/10 border border-orange-500/20 rounded-full px-3 py-1 mb-4">
                <ShieldAlert className="w-3.5 h-3.5 text-orange-400" />
                <span className="text-orange-400 text-xs font-medium">Registre agora — cada detalhe importa</span>
              </div>
              <h1 className="text-2xl font-bold text-white leading-tight mb-2">
                Foi roubado?<br />Registre o ocorrido.
              </h1>
              <p className="text-white/40 text-sm leading-relaxed">
                O registro na Backfindr não substitui o B.O., mas aumenta as chances de recuperação se o item aparecer na rede.
              </p>
            </div>

            <form onSubmit={handleStep1Submit} className="space-y-4">
              {/* O que foi levado */}
              <div>
                <label className="block text-sm text-white/60 font-medium mb-1.5">
                  O que foi levado?
                </label>
                <input
                  type="text"
                  value={step1.what}
                  onChange={e => setStep1(s => ({ ...s, what: e.target.value }))}
                  placeholder="Ex: iPhone 14 preto, mochila com notebook..."
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3.5 text-white placeholder-white/20 text-sm outline-none focus:border-orange-500/60 focus:bg-white/[0.06] transition-all"
                  autoFocus
                  required
                />
              </div>

              {/* Como aconteceu */}
              <div>
                <label className="block text-sm text-white/60 font-medium mb-2">Como aconteceu?</label>
                <div className="grid grid-cols-2 gap-2">
                  {HOW_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setStep1(s => ({ ...s, how: opt.value }))}
                      className={`flex flex-col items-start p-3 rounded-xl text-sm border transition-all ${
                        step1.how === opt.value
                          ? 'bg-orange-500/20 border-orange-500/50 text-orange-300'
                          : 'bg-white/[0.03] border-white/[0.08] text-white/50 hover:border-white/20'
                      }`}
                    >
                      <span className="font-semibold text-xs mb-0.5">{opt.label}</span>
                      <span className={`text-xs ${step1.how === opt.value ? 'text-orange-400/70' : 'text-white/30'}`}>
                        {opt.desc}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Onde */}
              <div>
                <label className="block text-sm text-white/60 font-medium mb-1.5 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-white/40" />
                  Onde aconteceu?
                </label>
                <input
                  type="text"
                  value={step1.where}
                  onChange={e => setStep1(s => ({ ...s, where: e.target.value }))}
                  placeholder="Bairro, rua ou cidade"
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3.5 text-white placeholder-white/20 text-sm outline-none focus:border-orange-500/60 focus:bg-white/[0.06] transition-all"
                />
              </div>

              {/* Quando */}
              <div>
                <label className="block text-sm text-white/60 font-medium mb-2 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-white/40" />
                  Quando?
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {WHEN_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setStep1(s => ({ ...s, when: opt.value }))}
                      className={`py-2.5 rounded-xl text-sm font-medium border transition-all ${
                        step1.when === opt.value
                          ? 'bg-orange-500/20 border-orange-500/50 text-orange-300'
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
                className="w-full flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-400 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold py-4 rounded-xl transition-all text-base mt-2"
                style={{ boxShadow: '0 0 0 1px rgba(249,115,22,0.4),0 4px 20px rgba(249,115,22,0.15)' }}
              >
                Continuar
                <ArrowRight className="w-5 h-5" />
              </button>
            </form>
          </div>
        </FlowLayout>
      )}

      {/* ── TELA 2: Orientações ── */}
      {step === 2 && (
        <FlowLayout step={2} totalSteps={3}>
          <div className="pt-2">
            <div className="mb-6">
              <div className="inline-flex items-center gap-2 bg-orange-500/10 border border-orange-500/20 rounded-full px-3 py-1 mb-4">
                <AlertTriangle className="w-3.5 h-3.5 text-orange-400" />
                <span className="text-orange-400 text-xs font-medium">Orientações importantes</span>
              </div>
              <h2 className="text-2xl font-bold text-white leading-tight mb-2">
                O que fazer agora.
              </h2>
              <p className="text-white/40 text-sm">
                Além de registrar na Backfindr, siga estes passos para maximizar as chances de recuperação.
              </p>
            </div>

            <div className="space-y-3 mb-7">
              {[
                {
                  icon: <ShieldAlert className="w-5 h-5 text-orange-400" />,
                  title: 'Registre o B.O.',
                  desc: 'Vá a uma delegacia ou use o site da Delegacia Eletrônica do seu estado. O B.O. é essencial para qualquer recuperação legal.',
                  urgent: true,
                },
                {
                  icon: <Info className="w-5 h-5 text-blue-400" />,
                  title: 'Bloqueie o aparelho',
                  desc: 'Se for celular, use "Encontrar meu iPhone" (Apple) ou "Encontrar meu dispositivo" (Google) para bloquear remotamente.',
                  urgent: false,
                },
                {
                  icon: <CheckCircle2 className="w-5 h-5 text-teal-400" />,
                  title: 'Registre na Backfindr',
                  desc: 'Se o item aparecer na rede — em um brechó, OLX ou com alguém que o encontrou — você será notificado.',
                  urgent: false,
                },
              ].map((item, i) => (
                <div
                  key={i}
                  className={`flex gap-4 items-start rounded-2xl p-4 border ${
                    item.urgent
                      ? 'bg-orange-500/[0.06] border-orange-500/20'
                      : 'bg-white/[0.03] border-white/[0.06]'
                  }`}
                >
                  <div className="flex-shrink-0 mt-0.5">{item.icon}</div>
                  <div>
                    <p className="text-white font-semibold text-sm mb-0.5">{item.title}</p>
                    <p className="text-white/40 text-xs leading-relaxed">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="space-y-3">
              <button
                onClick={() => setStep(3)}
                className="w-full flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-400 text-white font-bold py-4 rounded-xl transition-all text-base"
                style={{ boxShadow: '0 0 0 1px rgba(249,115,22,0.4),0 4px 20px rgba(249,115,22,0.15)' }}
              >
                Registrar na Backfindr agora
                <ArrowRight className="w-5 h-5" />
              </button>
              <button
                onClick={() => setStep(1)}
                className="w-full py-3 text-white/40 hover:text-white/60 text-sm transition-colors"
              >
                Voltar
              </button>
            </div>
          </div>
        </FlowLayout>
      )}

      {/* ── TELA 3 ── */}
      {step === 3 && (
        <FlowLayout step={3} totalSteps={3}>
          <div className="pt-2">
            <div className="mb-7">
              <div className="inline-flex items-center gap-2 bg-orange-500/10 border border-orange-500/20 rounded-full px-3 py-1 mb-4">
                <CheckCircle2 className="w-3.5 h-3.5 text-orange-400" />
                <span className="text-orange-400 text-xs font-medium">Último passo</span>
              </div>
              <h2 className="text-2xl font-bold text-white leading-tight mb-2">
                Finalize o registro.
              </h2>
              <p className="text-white/40 text-sm leading-relaxed">
                Crie sua conta gratuita. Se o item aparecer na rede, você recebe uma notificação imediata.
              </p>
            </div>

            {/* Resumo */}
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-4 mb-6 space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <span className="text-white/40 w-16 flex-shrink-0">Item:</span>
                <span className="text-white font-medium truncate">{step1.what}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span className="text-white/40 w-16 flex-shrink-0">Como:</span>
                <span className="text-white/70 capitalize">
                  {HOW_OPTIONS.find(o => o.value === step1.how)?.label}
                </span>
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
                className="w-full flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-400 text-white font-bold py-4 rounded-xl transition-all text-base"
                style={{ boxShadow: '0 0 0 1px rgba(249,115,22,0.4),0 4px 20px rgba(249,115,22,0.15)' }}
              >
                Registrar ocorrência agora
                <ArrowRight className="w-5 h-5" />
              </button>
              <p className="text-center text-white/30 text-xs">
                Gratuito. Você será notificado se o item aparecer na rede.
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
