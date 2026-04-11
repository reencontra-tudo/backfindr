'use client';

import Link from 'next/link';
import { useState, useEffect, useRef } from 'react';
import { ArrowRight, MapPin, QrCode, Zap, Shield, Globe, ChevronRight } from 'lucide-react';

function Counter({ target, suffix = '' }: { target: number; suffix?: string }) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const started = useRef(false);
  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !started.current) {
        started.current = true;
        const steps = 60;
        const increment = target / steps;
        let current = 0;
        const timer = setInterval(() => {
          current = Math.min(current + increment, target);
          setCount(Math.floor(current));
          if (current >= target) clearInterval(timer);
        }, 1800 / steps);
      }
    }, { threshold: 0.5 });
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [target]);
  return <span ref={ref} className="tabular-nums">{count.toLocaleString('pt-BR')}{suffix}</span>;
}

function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 8);
    window.addEventListener('scroll', h, { passive: true });
    return () => window.removeEventListener('scroll', h);
  }, []);
  return (
    <header className={`fixed top-0 inset-x-0 z-50 transition-all duration-500 ${scrolled ? 'bg-[#080b0f]/90 backdrop-blur-xl border-b border-white/[0.06]' : 'bg-transparent'}`}>
      <nav className="max-w-6xl mx-auto px-5 h-14 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-teal-500 flex items-center justify-center">
            <MapPin className="w-3.5 h-3.5 text-white" strokeWidth={2.5} />
          </div>
          <span className="text-white font-semibold tracking-tight text-[15px]">Backfindr</span>
        </Link>
        <div className="hidden md:flex items-center gap-7">
          {['Produto', 'Como funciona', 'Empresas'].map(item => (
            <a key={item} href="#" className="text-[13px] text-white/40 hover:text-white/80 transition-colors">{item}</a>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <Link href="/auth/login" className="text-[13px] text-white/50 hover:text-white transition-colors px-2">Entrar</Link>
          <Link href="/auth/register" className="flex items-center gap-1.5 text-[13px] font-medium bg-white text-black px-4 py-1.5 rounded-md hover:bg-white/90 transition-all">
            Começar grátis <ChevronRight className="w-3.5 h-3.5" strokeWidth={2.5} />
          </Link>
        </div>
      </nav>
    </header>
  );
}

export default function HomePage() {
  return (
    <div className="min-h-screen bg-[#080b0f] text-white selection:bg-teal-500/30">
      <Navbar />

      {/* Hero */}
      <section className="relative min-h-screen flex flex-col items-center justify-center px-5 pt-14 overflow-hidden">
        <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse 80% 50% at 50% -10%, rgba(20,184,166,0.12) 0%, transparent 70%)' }} />
        <div className="absolute inset-0 pointer-events-none opacity-[0.03]" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,1) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,1) 1px,transparent 1px)', backgroundSize: '72px 72px' }} />
        <div className="relative z-10 max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 mb-10 px-3 py-1.5 rounded-full border border-white/10 bg-white/[0.04]">
            <span className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-pulse" />
            <span className="text-[11px] text-white/50 tracking-wide uppercase font-medium">Lançamento · São Paulo 2026</span>
          </div>
          <h1 className="font-bold tracking-[-0.04em] leading-[0.92] mb-6" style={{ fontSize: 'clamp(52px, 10vw, 96px)' }}>
            <span className="text-white">Recupere o que</span><br />
            <span style={{ background: 'linear-gradient(135deg, #2dd4bf 0%, #14b8a6 40%, #0d9488 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
              você perdeu.
            </span>
          </h1>
          <p className="text-white/40 text-lg max-w-lg mx-auto leading-relaxed mb-10 font-light">
            Plataforma global de objetos perdidos com QR Code único, matching por IA e chat mediado para devolução segura.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link href="/auth/register" className="flex items-center gap-2 bg-teal-500 hover:bg-teal-400 text-white text-sm font-semibold px-6 py-3 rounded-lg transition-all duration-200 w-full sm:w-auto justify-center" style={{ boxShadow: '0 0 0 1px rgba(20,184,166,0.5),0 8px 32px rgba(20,184,166,0.2)' }}>
              Registrar objeto grátis <ArrowRight className="w-4 h-4" strokeWidth={2.5} />
            </Link>
            <Link href="/map" className="flex items-center gap-2 border border-white/10 hover:border-white/20 bg-white/[0.04] hover:bg-white/[0.07] text-white/70 hover:text-white text-sm px-6 py-3 rounded-lg transition-all duration-200 w-full sm:w-auto justify-center">
              <MapPin className="w-4 h-4" /> Ver mapa público
            </Link>
          </div>
          <div className="mt-20 pt-8 border-t border-white/[0.06] grid grid-cols-3 gap-8 max-w-lg mx-auto">
            {[{ value: 12847, suffix: '+', label: 'Objetos registrados' }, { value: 3291, suffix: '+', label: 'Recuperações' }, { value: 98, suffix: '%', label: 'Taxa com QR Code' }].map(s => (
              <div key={s.label} className="text-center">
                <p className="text-2xl font-bold text-white tracking-tight"><Counter target={s.value} suffix={s.suffix} /></p>
                <p className="text-[11px] text-white/30 mt-1 leading-tight">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="absolute bottom-0 inset-x-0 h-32 bg-gradient-to-t from-[#080b0f] to-transparent pointer-events-none" />
      </section>

      {/* How it works */}
      <section className="py-32 px-5">
        <div className="max-w-5xl mx-auto">
          <div className="mb-16">
            <p className="text-[11px] text-teal-500 uppercase tracking-[0.15em] font-semibold mb-4">Como funciona</p>
            <h2 className="text-4xl font-bold tracking-tight text-white max-w-sm leading-tight">Três passos.<br />Um objeto recuperado.</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-px bg-white/[0.06] rounded-2xl overflow-hidden">
            {[
              { step: '01', icon: <QrCode className="w-5 h-5 text-teal-400" />, title: 'Registre', desc: 'Adicione fotos e descrição. Receba um QR Code único e permanente vinculado ao objeto.' },
              { step: '02', icon: <Zap className="w-5 h-5 text-teal-400" />, title: 'Seja encontrado', desc: 'Quem achar escaneia o QR. Você recebe notificação instantânea com localização.' },
              { step: '03', icon: <Shield className="w-5 h-5 text-teal-400" />, title: 'Recupere', desc: 'Chat mediado para combinar entrega segura. Privacidade protegida em todo o processo.' },
            ].map(item => (
              <div key={item.step} className="bg-[#080b0f] p-8 hover:bg-white/[0.02] transition-colors">
                <div className="flex items-start justify-between mb-8">
                  <div className="w-9 h-9 rounded-lg border border-white/10 flex items-center justify-center bg-white/[0.04]">{item.icon}</div>
                  <span className="text-[11px] font-mono text-white/20">{item.step}</span>
                </div>
                <h3 className="text-white font-semibold mb-2 text-[15px]">{item.title}</h3>
                <p className="text-white/40 text-sm leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-16 px-5 border-t border-white/[0.06]">
        <div className="max-w-5xl mx-auto">
          <div className="grid md:grid-cols-2 gap-16 items-center">
            <div>
              <p className="text-[11px] text-teal-500 uppercase tracking-[0.15em] font-semibold mb-4">Plataforma global</p>
              <h2 className="text-3xl font-bold tracking-tight text-white leading-tight mb-6">Tecnologia de recuperação<br />para o mundo real.</h2>
              <p className="text-white/40 text-sm leading-relaxed mb-10">Do celular perdido no metrô ao pet desaparecido no parque — Backfindr funciona para qualquer objeto, em qualquer lugar do mundo.</p>
              <div className="space-y-6">
                {[
                  { icon: <Globe className="w-4 h-4" />, title: 'Cobertura global', desc: 'QR Codes funcionam sem app, em qualquer país.' },
                  { icon: <Shield className="w-4 h-4" />, title: 'Privacidade por design', desc: 'Seu contato nunca é exposto. Comunicação 100% mediada.' },
                  { icon: <Zap className="w-4 h-4" />, title: 'IA de matching', desc: 'Cruza objetos perdidos com achados automaticamente.' },
                ].map(f => (
                  <div key={f.title} className="flex gap-4 items-start">
                    <div className="w-8 h-8 rounded-md border border-white/10 bg-white/[0.04] flex items-center justify-center flex-shrink-0 mt-0.5 text-teal-400">{f.icon}</div>
                    <div>
                      <p className="text-white text-sm font-medium mb-0.5">{f.title}</p>
                      <p className="text-white/40 text-sm">{f.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="relative">
              <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-6 space-y-3" style={{ boxShadow: '0 0 80px rgba(20,184,166,0.05)' }}>
                <div className="flex items-center gap-3 p-3.5 rounded-xl border border-white/[0.08] bg-white/[0.04]">
                  <div className="w-8 h-8 rounded-full bg-teal-500/20 border border-teal-500/30 flex items-center justify-center flex-shrink-0"><MapPin className="w-4 h-4 text-teal-400" /></div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-[13px] font-medium">Objeto encontrado!</p>
                    <p className="text-white/40 text-xs">iPhone 15 Pro · Metrô Paulista · agora</p>
                  </div>
                  <div className="w-2 h-2 rounded-full bg-teal-400 flex-shrink-0" />
                </div>
                <div className="flex items-center gap-3 p-3.5 rounded-xl border border-white/[0.08] bg-white/[0.04]">
                  <div className="w-8 h-8 rounded-lg bg-white/[0.08] flex items-center justify-center flex-shrink-0"><QrCode className="w-4 h-4 text-white/60" /></div>
                  <div>
                    <p className="text-white text-[13px] font-medium">QR Code ativado</p>
                    <p className="text-white/40 text-xs">Escaneado 2x · São Paulo, BR</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3.5 rounded-xl border border-teal-500/20 bg-teal-500/[0.05]">
                  <div className="w-8 h-8 rounded-lg bg-teal-500/20 flex items-center justify-center flex-shrink-0"><Zap className="w-4 h-4 text-teal-400" /></div>
                  <div>
                    <p className="text-teal-300 text-[13px] font-medium">Match 96% — Carteira</p>
                    <p className="text-white/40 text-xs">IA identificou objeto compatível</p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 pt-1">
                  {[{ v: '2.4h', l: 'Tempo médio' }, { v: '98%', l: 'Com QR Code' }, { v: '47k+', l: 'Usuários' }].map(m => (
                    <div key={m.l} className="text-center p-2.5 rounded-lg border border-white/[0.06] bg-white/[0.02]">
                      <p className="text-white text-sm font-bold">{m.v}</p>
                      <p className="text-white/30 text-[10px] mt-0.5">{m.l}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-24 px-5 border-t border-white/[0.06]">
        <div className="max-w-4xl mx-auto">
          <p className="text-center text-[11px] text-white/30 uppercase tracking-[0.15em] mb-12">Histórias reais</p>
          <div className="grid md:grid-cols-3 gap-4">
            {[
              { text: 'Meu cachorro fugiu e em 2 horas alguém escaneou a placa e entrou em contato. Incrível.', name: 'Ana Paula R.', location: 'São Paulo, SP' },
              { text: 'Esqueci a carteira no metrô. No dia seguinte recebi uma notificação. Recuperei tudo.', name: 'Ricardo M.', location: 'Rio de Janeiro, RJ' },
              { text: 'Uso para registrar todos os equipamentos da empresa. Zero perda em 6 meses.', name: 'Carla S.', location: 'Belo Horizonte, MG' },
            ].map(t => (
              <div key={t.name} className="p-5 rounded-xl border border-white/[0.07] bg-white/[0.03]">
                <p className="text-white/60 text-sm leading-relaxed mb-5">"{t.text}"</p>
                <div>
                  <p className="text-white text-[13px] font-medium">{t.name}</p>
                  <p className="text-white/30 text-xs mt-0.5">{t.location}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-5 border-t border-white/[0.06]">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-4xl font-bold tracking-tight text-white mb-4">Pronto para começar?</h2>
          <p className="text-white/40 text-sm mb-8">Grátis para sempre. Sem cartão de crédito. Em menos de 2 minutos.</p>
          <Link href="/auth/register" className="inline-flex items-center gap-2 bg-teal-500 hover:bg-teal-400 text-white font-semibold px-8 py-3.5 rounded-lg transition-all text-sm" style={{ boxShadow: '0 0 0 1px rgba(20,184,166,0.5),0 8px 32px rgba(20,184,166,0.2)' }}>
            Criar conta grátis <ArrowRight className="w-4 h-4" strokeWidth={2.5} />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/[0.06] py-8 px-5">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-md bg-teal-500 flex items-center justify-center"><MapPin className="w-2.5 h-2.5 text-white" strokeWidth={2.5} /></div>
            <span className="text-white text-sm font-semibold">Backfindr</span>
          </div>
          <p className="text-white/20 text-xs">© 2026 Backfindr. Todos os direitos reservados.</p>
          <div className="flex gap-6 text-xs text-white/30">
            <a href="/privacy" className="hover:text-white transition-colors">Privacidade</a>
            <a href="/terms" className="hover:text-white transition-colors">Termos</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
