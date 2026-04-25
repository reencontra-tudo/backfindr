'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { analytics } from '@/providers/PostHogProvider';
import { ArrowRight, CheckCircle2, Shield, QrCode, Smartphone, Wallet, Key, Briefcase, Dog, Car, Bike } from 'lucide-react';
import FlowLayout from '@/components/flow/FlowLayout';

type ItemType = 'celular' | 'carteira' | 'chaves' | 'mochila' | 'pet' | 'veiculo' | 'bicicleta' | 'outro';

interface ItemOption {
  value: ItemType;
  label: string;
  icon: React.ReactNode;
}

const ITEM_OPTIONS: ItemOption[] = [
  { value: 'celular', label: 'Celular', icon: <Smartphone className="w-5 h-5" /> },
  { value: 'pet', label: 'Pet', icon: <Dog className="w-5 h-5" /> },
  { value: 'veiculo', label: 'Veículo', icon: <Car className="w-5 h-5" /> },
  { value: 'carteira', label: 'Carteira', icon: <Wallet className="w-5 h-5" /> },
  { value: 'chaves', label: 'Chaves', icon: <Key className="w-5 h-5" /> },
  { value: 'bicicleta', label: 'Bicicleta', icon: <Bike className="w-5 h-5" /> },
  { value: 'mochila', label: 'Mochila / Bolsa', icon: <Briefcase className="w-5 h-5" /> },
  { value: 'outro', label: 'Outro item', icon: <Shield className="w-5 h-5" /> },
];

export default function ProtectFlowClient() {
  const router = useRouter();
  const [step, setStep] = useState(1);

  useEffect(() => { analytics.flowStarted('protect'); }, []);
  useEffect(() => {
    const handleUnload = () => analytics.flowAbandoned('protect', step);
    window.addEventListener('beforeunload', handleUnload);
    return () => window.removeEventListener('beforeunload', handleUnload);
  }, [step]);
  const [selectedItems, setSelectedItems] = useState<ItemType[]>([]);
  const [name, setName] = useState('');

  function toggleItem(val: ItemType) {
    setSelectedItems(prev =>
      prev.includes(val) ? prev.filter(v => v !== val) : [...prev, val]
    );
  }

  function handleStep1Next() {
    if (selectedItems.length === 0) return;
    analytics.flowStep('protect', 2, 3);
    setStep(2);
  }

  function handleFinalize() {
    analytics.flowCompleted('protect', false);
    const params = new URLSearchParams();
    params.set('intent', 'protect');
    if (selectedItems.length > 0) params.set('prefill_category', selectedItems[0]);
    if (name) params.set('prefill_name', name);
    router.push(`/auth/register?${params.toString()}`);
  }

  return (
    <>
      {/* ── TELA 1: Quais itens quer proteger? ── */}
      {step === 1 && (
        <FlowLayout step={1} totalSteps={3}>
          <div className="pt-2">
            <div className="mb-7">
              <div className="inline-flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 rounded-full px-3 py-1 mb-4">
                <Shield className="w-3.5 h-3.5 text-blue-400" />
                <span className="text-blue-400 text-xs font-medium">Prevenção é o melhor plano</span>
              </div>
              <h1 className="text-2xl font-bold text-white leading-tight mb-2">
                O que você quer<br />proteger?
              </h1>
              <p className="text-white/40 text-sm leading-relaxed">
                Selecione os itens. Vamos gerar um QR Code gratuito para cada um.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-6">
              {ITEM_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => toggleItem(opt.value)}
                  className={`flex items-center gap-3 p-4 rounded-2xl border transition-all text-left ${
                    selectedItems.includes(opt.value)
                      ? 'bg-blue-500/20 border-blue-500/50 text-blue-300'
                      : 'bg-white/[0.03] border-white/[0.08] text-white/60 hover:border-white/20 hover:text-white/80'
                  }`}
                >
                  <span className={selectedItems.includes(opt.value) ? 'text-blue-400' : 'text-white/30'}>
                    {opt.icon}
                  </span>
                  <span className="text-sm font-medium">{opt.label}</span>
                  {selectedItems.includes(opt.value) && (
                    <CheckCircle2 className="w-4 h-4 text-blue-400 ml-auto flex-shrink-0" />
                  )}
                </button>
              ))}
            </div>

            <button
              onClick={handleStep1Next}
              disabled={selectedItems.length === 0}
              className="w-full flex items-center justify-center gap-2 bg-blue-500 hover:bg-blue-400 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold py-4 rounded-xl transition-all text-base"
              style={{ boxShadow: '0 0 0 1px rgba(59,130,246,0.4),0 4px 20px rgba(59,130,246,0.15)' }}
            >
              Continuar
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        </FlowLayout>
      )}

      {/* ── TELA 2: Como funciona o QR ── */}
      {step === 2 && (
        <FlowLayout step={2} totalSteps={3}>
          <div className="pt-2">
            <div className="mb-7">
              <div className="inline-flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 rounded-full px-3 py-1 mb-4">
                <QrCode className="w-3.5 h-3.5 text-blue-400" />
                <span className="text-blue-400 text-xs font-medium">Como funciona</span>
              </div>
              <h2 className="text-2xl font-bold text-white leading-tight mb-2">
                Seu QR Code,<br />seu escudo.
              </h2>
              <p className="text-white/40 text-sm leading-relaxed">
                Você gera, cola no item e pronto. Se alguém encontrar, lê o QR e entra em contato — sem ver seu número.
              </p>
            </div>

            {/* 3 passos visuais */}
            <div className="space-y-3 mb-7">
              {[
                { n: '1', title: 'Gere o QR Code', desc: 'Gratuito, em segundos. Um QR único para cada item.' },
                { n: '2', title: 'Cole no item', desc: 'Adesivo, etiqueta ou capa. Onde quiser.' },
                { n: '3', title: 'Alguém encontra e lê', desc: 'Você recebe uma notificação. Seu número fica protegido.' },
              ].map(s => (
                <div key={s.n} className="flex gap-4 items-start bg-white/[0.03] border border-white/[0.06] rounded-2xl p-4">
                  <div className="w-8 h-8 rounded-full bg-blue-500/20 border border-blue-500/30 flex items-center justify-center flex-shrink-0">
                    <span className="text-blue-400 text-sm font-bold">{s.n}</span>
                  </div>
                  <div>
                    <p className="text-white font-semibold text-sm mb-0.5">{s.title}</p>
                    <p className="text-white/40 text-xs leading-relaxed">{s.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Itens selecionados */}
            <div className="bg-blue-500/[0.06] border border-blue-500/20 rounded-2xl p-4 mb-6">
              <p className="text-white/50 text-xs mb-2">Você vai proteger:</p>
              <div className="flex flex-wrap gap-2">
                {selectedItems.map(val => {
                  const opt = ITEM_OPTIONS.find(o => o.value === val);
                  return (
                    <span key={val} className="inline-flex items-center gap-1.5 bg-blue-500/20 border border-blue-500/30 text-blue-300 text-xs font-medium px-3 py-1.5 rounded-full">
                      {opt?.icon}
                      {opt?.label}
                    </span>
                  );
                })}
              </div>
            </div>

            <div className="space-y-3">
              <button
                onClick={() => setStep(3)}
                className="w-full flex items-center justify-center gap-2 bg-blue-500 hover:bg-blue-400 text-white font-bold py-4 rounded-xl transition-all text-base"
                style={{ boxShadow: '0 0 0 1px rgba(59,130,246,0.4),0 4px 20px rgba(59,130,246,0.15)' }}
              >
                Gerar meu QR agora
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

      {/* ── TELA 3: Finalização ── */}
      {step === 3 && (
        <FlowLayout step={3} totalSteps={3}>
          <div className="pt-2">
            <div className="mb-7">
              <div className="inline-flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 rounded-full px-3 py-1 mb-4">
                <CheckCircle2 className="w-3.5 h-3.5 text-blue-400" />
                <span className="text-blue-400 text-xs font-medium">Último passo</span>
              </div>
              <h2 className="text-2xl font-bold text-white leading-tight mb-2">
                Crie sua conta<br />e gere o QR.
              </h2>
              <p className="text-white/40 text-sm leading-relaxed">
                Gratuito. Você gerencia todos os seus itens protegidos em um só lugar.
              </p>
            </div>

            {/* Campo de nome (opcional, melhora personalização) */}
            <div className="mb-6">
              <label className="block text-sm text-white/60 font-medium mb-1.5">
                Seu nome (opcional)
              </label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Como quer ser chamado?"
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3.5 text-white placeholder-white/20 text-sm outline-none focus:border-blue-500/60 focus:bg-white/[0.06] transition-all"
              />
            </div>

            {/* Resumo */}
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-4 mb-6">
              <p className="text-white/40 text-xs mb-2">Itens a proteger:</p>
              <div className="flex flex-wrap gap-2">
                {selectedItems.map(val => {
                  const opt = ITEM_OPTIONS.find(o => o.value === val);
                  return (
                    <span key={val} className="inline-flex items-center gap-1.5 bg-blue-500/10 border border-blue-500/20 text-blue-300 text-xs font-medium px-3 py-1.5 rounded-full">
                      {opt?.label}
                    </span>
                  );
                })}
              </div>
            </div>

            <div className="space-y-3">
              <button
                onClick={handleFinalize}
                className="w-full flex items-center justify-center gap-2 bg-blue-500 hover:bg-blue-400 text-white font-bold py-4 rounded-xl transition-all text-base"
                style={{ boxShadow: '0 0 0 1px rgba(59,130,246,0.4),0 4px 20px rgba(59,130,246,0.15)' }}
              >
                Criar conta e gerar QR grátis
                <ArrowRight className="w-5 h-5" />
              </button>
              <p className="text-center text-white/30 text-xs">
                100% gratuito. Sem cartão de crédito.
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
