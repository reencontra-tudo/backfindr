'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { analytics } from '@/providers/PostHogProvider';
import { ArrowRight, Loader2, Search, CheckCircle2, MapPin, Clock, AlertCircle, Share2 } from 'lucide-react';
import FlowLayout from '@/components/flow/FlowLayout';
import FlowMatchCard, { MatchItem } from '@/components/flow/FlowMatchCard';

type WhenOption = 'agora' | 'hoje' | 'ontem' | 'outro';
interface Step1Data { what: string; where: string; when: WhenOption; hasDocuments: boolean; }
const WHEN_OPTIONS = [{ value: 'agora' as WhenOption, label: 'Agora' }, { value: 'hoje' as WhenOption, label: 'Hoje' }, { value: 'ontem' as WhenOption, label: 'Ontem' }, { value: 'outro' as WhenOption, label: 'Outro horário' }];

export default function WalletFlowClient() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [step1, setStep1] = useState<Step1Data>({ what: '', where: '', when: 'hoje', hasDocuments: false });
  const [matches, setMatches] = useState<MatchItem[]>([]);
  const [loadingMatches, setLoadingMatches] = useState(false);

  useEffect(() => { analytics.flowStarted('wallet'); }, []);
  useEffect(() => { const h = () => analytics.flowAbandoned('wallet', step); window.addEventListener('beforeunload', h); return () => window.removeEventListener('beforeunload', h); }, [step]);

  async function handleStep1Submit(e: React.FormEvent) {
    e.preventDefault();
    analytics.flowStep('wallet', 2, 3);
    setStep(2); setLoadingMatches(true);
    try {
      const keyword = [step1.what || 'carteira', step1.hasDocuments ? 'documentos' : ''].filter(Boolean).join(' ');
      const p = new URLSearchParams({ status: 'found', category: 'wallet', keyword, size: '5' });
      const res = await fetch(`/api/v1/objects/public?${p}`);
      const data = await res.json();
      setMatches(data.items || []);
    } catch { setMatches([]); }
    finally { setLoadingMatches(false); }
  }

  function handleFinalize() {
    analytics.flowCompleted('wallet', matches.length > 0);
    const p = new URLSearchParams({ intent: 'lost', prefill_category: 'wallet' });
    const title = ['Carteira perdida', step1.what, step1.hasDocuments ? 'com documentos' : ''].filter(Boolean).join(' ');
    p.set('prefill_title', title);
    if (step1.where) p.set('prefill_location', step1.where);
    router.push(`/auth/register?${p}`);
  }

  return (
    <>
      {step === 1 && (
        <FlowLayout step={1} totalSteps={3}>
          <div className="pt-2">
            <div className="mb-7">
              <div className="inline-flex items-center gap-2 bg-orange-500/10 border border-orange-500/20 rounded-full px-3 py-1 mb-4">
                <span className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse" />
                <span className="text-orange-400 text-xs font-medium">Aja rápido — carteiras são encontradas</span>
              </div>
              <h1 className="text-2xl font-bold text-white leading-tight mb-2">👛 Perdeu a carteira?<br />Alguém pode ter.</h1>
              <p className="text-white/40 text-sm leading-relaxed">Registre agora. Quem encontrou pode te devolver — com segurança e sem expor seu número.</p>
            </div>
            <form onSubmit={handleStep1Submit} className="space-y-4">
              {/* Tem documentos? */}
              <div>
                <label className="block text-sm text-white/60 font-medium mb-2">Tinha documentos dentro?</label>
                <div className="grid grid-cols-2 gap-2">
                  {[{ v: true, label: '📄 Sim, tinha documentos' }, { v: false, label: '💳 Só cartões/dinheiro' }].map(opt => (
                    <button key={String(opt.v)} type="button" onClick={() => setStep1(s => ({ ...s, hasDocuments: opt.v }))}
                      className={`py-2.5 px-3 rounded-xl text-xs font-medium border transition-all ${step1.hasDocuments === opt.v ? 'bg-teal-500/20 border-teal-500/50 text-teal-300' : 'bg-white/[0.03] border-white/[0.08] text-white/50 hover:border-white/20'}`}>
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm text-white/60 font-medium mb-1.5">Descreva a carteira (opcional)</label>
                <input type="text" value={step1.what} onChange={e => setStep1(s => ({ ...s, what: e.target.value }))}
                  placeholder="Ex: carteira preta de couro, porta-cédulas azul..."
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3.5 text-white placeholder-white/20 text-sm outline-none focus:border-teal-500/60 focus:bg-white/[0.06] transition-all"
                  autoFocus />
              </div>
              <div>
                <label className="block text-sm text-white/60 font-medium mb-1.5 flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5 text-white/40" />Onde foi?</label>
                <input type="text" value={step1.where} onChange={e => setStep1(s => ({ ...s, where: e.target.value }))}
                  placeholder="Restaurante, transporte, shopping, bairro..."
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3.5 text-white placeholder-white/20 text-sm outline-none focus:border-teal-500/60 focus:bg-white/[0.06] transition-all" />
              </div>
              <div>
                <label className="block text-sm text-white/60 font-medium mb-2 flex items-center gap-1.5"><Clock className="w-3.5 h-3.5 text-white/40" />Quando?</label>
                <div className="grid grid-cols-2 gap-2">
                  {WHEN_OPTIONS.map(opt => (
                    <button key={opt.value} type="button" onClick={() => setStep1(s => ({ ...s, when: opt.value }))}
                      className={`py-2.5 rounded-xl text-sm font-medium border transition-all ${step1.when === opt.value ? 'bg-teal-500/20 border-teal-500/50 text-teal-300' : 'bg-white/[0.03] border-white/[0.08] text-white/50 hover:border-white/20'}`}>
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              <button type="submit"
                className="w-full flex items-center justify-center gap-2 bg-teal-500 hover:bg-teal-400 text-white font-bold py-4 rounded-xl transition-all text-base mt-2"
                style={{ boxShadow: '0 0 0 1px rgba(20,184,166,0.4),0 4px 20px rgba(20,184,166,0.15)' }}>
                <Search className="w-5 h-5" />Buscar na rede
              </button>
            </form>
          </div>
        </FlowLayout>
      )}

      {step === 2 && (
        <FlowLayout step={2} totalSteps={3}>
          <div className="pt-2">
            {loadingMatches ? (
              <div className="flex flex-col items-center py-16 gap-4">
                <div className="w-14 h-14 rounded-2xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center"><Loader2 className="w-7 h-7 text-teal-400 animate-spin" /></div>
                <div className="text-center"><p className="text-white font-semibold mb-1">Procurando sua carteira...</p><p className="text-white/40 text-sm">Cruzando relatos na rede.</p></div>
              </div>
            ) : (
              <>
                <div className="mb-6">
                  <h2 className="text-2xl font-bold text-white leading-tight mb-2">{matches.length > 0 ? 'Encontramos carteiras parecidas.' : 'Nenhum resultado ainda.'}</h2>
                  <p className="text-white/40 text-sm">{matches.length > 0 ? `${matches.length} registro(s) encontrado(s)` : 'Nenhuma carteira encontrada — mas você pode publicar um alerta agora.'}</p>
                </div>
                {matches.length > 0 && <div className="space-y-3 mb-6">{matches.map(item => <FlowMatchCard key={item.id} item={item} onSelect={i => { analytics.flowMatchClicked('wallet', i.unique_code || ''); router.push(`/objeto/${i.unique_code}`); }} label="Pode ser a minha" />)}</div>}
                {matches.length === 0 && <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5 mb-6 flex gap-3"><AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" /><div><p className="text-white/70 text-sm font-medium mb-1">A rede fica de olho.</p><p className="text-white/40 text-xs leading-relaxed">Quando alguém reportar uma carteira parecida, você é avisado na hora.</p></div></div>}
                <div className="space-y-3">
                  <button onClick={() => { analytics.flowStep('wallet', 3, 3); setStep(3); }}
                    className="w-full flex items-center justify-center gap-2 bg-teal-500 hover:bg-teal-400 text-white font-bold py-4 rounded-xl transition-all text-base"
                    style={{ boxShadow: '0 0 0 1px rgba(20,184,166,0.4),0 4px 20px rgba(20,184,166,0.15)' }}>
                    {matches.length > 0 ? 'Não é a minha — continuar' : 'Publicar alerta agora'}<ArrowRight className="w-5 h-5" />
                  </button>
                  <button onClick={() => setStep(1)} className="w-full py-3 text-white/40 hover:text-white/60 text-sm transition-colors">Voltar</button>
                </div>
              </>
            )}
          </div>
        </FlowLayout>
      )}

      {step === 3 && (
        <FlowLayout step={3} totalSteps={3}>
          <div className="pt-2">
            <div className="mb-7">
              <div className="inline-flex items-center gap-2 bg-teal-500/10 border border-teal-500/20 rounded-full px-3 py-1 mb-4"><CheckCircle2 className="w-3.5 h-3.5 text-teal-400" /><span className="text-teal-400 text-xs font-medium">Quase lá</span></div>
              <h2 className="text-2xl font-bold text-white leading-tight mb-2">Publique o alerta.</h2>
              <p className="text-white/40 text-sm leading-relaxed">Conta gratuita em segundos. Quem encontrar sua carteira pode te devolver — seu número fica protegido.</p>
            </div>
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-4 mb-6 space-y-2">
              <div className="flex items-center gap-2 text-sm"><span className="text-white/40 w-24 flex-shrink-0">Categoria:</span><span className="text-white font-medium">👛 Carteira</span></div>
              <div className="flex items-center gap-2 text-sm"><span className="text-white/40 w-24 flex-shrink-0">Documentos:</span><span className="text-white font-medium">{step1.hasDocuments ? '✅ Sim' : '❌ Não'}</span></div>
              {step1.what && <div className="flex items-center gap-2 text-sm"><span className="text-white/40 w-24 flex-shrink-0">Descrição:</span><span className="text-white font-medium truncate">{step1.what}</span></div>}
              {step1.where && <div className="flex items-center gap-2 text-sm"><span className="text-white/40 w-24 flex-shrink-0">Local:</span><span className="text-white/70 truncate">{step1.where}</span></div>}
              <div className="flex items-center gap-2 text-sm"><span className="text-white/40 w-24 flex-shrink-0">Quando:</span><span className="text-white/70 capitalize">{step1.when}</span></div>
            </div>
            <div className="space-y-3">
              <button onClick={handleFinalize}
                className="w-full flex items-center justify-center gap-2 bg-teal-500 hover:bg-teal-400 text-white font-bold py-4 rounded-xl transition-all text-base"
                style={{ boxShadow: '0 0 0 1px rgba(20,184,166,0.4),0 4px 20px rgba(20,184,166,0.15)' }}>
                Publicar alerta agora<ArrowRight className="w-5 h-5" />
              </button>
              <p className="text-center text-white/30 text-xs">Gratuito. Seu contato não fica exposto publicamente.</p>
              <button onClick={() => { const text = `👛 Perdi minha carteira${step1.what ? ` — ${step1.what}` : ''}${step1.hasDocuments ? ' (com documentos)' : ''}${step1.where ? ` em ${step1.where}` : ''}. Alguém achou? backfindr.com/flow/wallet`; if (navigator.share) navigator.share({ title: 'Perdi minha carteira', text }); else window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank'); }}
                className="w-full flex items-center justify-center gap-2 py-3 text-teal-400/70 hover:text-teal-400 border border-teal-500/20 hover:border-teal-500/40 rounded-xl text-sm font-medium transition-all">
                <Share2 className="w-4 h-4" />Compartilhar no WhatsApp
              </button>
              <button onClick={() => setStep(2)} className="w-full py-3 text-white/40 hover:text-white/60 text-sm transition-colors">Voltar</button>
            </div>
          </div>
        </FlowLayout>
      )}
    </>
  );
}
