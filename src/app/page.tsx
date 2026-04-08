'use client';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { Search, MapPin, QrCode, Shield, Zap, Globe, ArrowRight, ChevronDown, Star } from 'lucide-react';

function useCounter(target: number) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    const step = target / 120;
    let cur = 0;
    const t = setInterval(() => { cur = Math.min(cur + step, target); setCount(Math.floor(cur)); if (cur >= target) clearInterval(t); }, 16);
    return () => clearInterval(t);
  }, [target]);
  return count;
}

function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => { const h = () => setScrolled(window.scrollY > 20); window.addEventListener('scroll', h); return () => window.removeEventListener('scroll', h); }, []);
  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? 'glass shadow-lg' : 'bg-transparent'}`}>
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2"><div className="w-8 h-8 rounded-lg gradient-brand flex items-center justify-center glow-teal"><MapPin className="w-4 h-4 text-white" /></div><span className="font-display font-bold text-lg text-white">Backfindr</span></Link>
        <div className="hidden md:flex items-center gap-8"><a href="#como-funciona" className="text-slate-400 hover:text-white text-sm transition-colors">Como funciona</a><a href="#recursos" className="text-slate-400 hover:text-white text-sm transition-colors">Recursos</a></div>
        <div className="flex items-center gap-3"><Link href="/auth/login" className="text-sm text-slate-300 hover:text-white transition-colors px-3 py-1.5">Entrar</Link><Link href="/auth/register" className="text-sm bg-brand-500 hover:bg-brand-400 text-white font-medium px-4 py-2 rounded-lg transition-all duration-200 glow-teal">Começar grátis</Link></div>
      </div>
    </nav>
  );
}

export default function HomePage() {
  const c1 = useCounter(12847); const c2 = useCounter(3291); const c3 = useCounter(98);
  return (
    <div className="min-h-screen bg-surface">
      <Navbar />
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-16">
        <div className="absolute inset-0 opacity-20" style={{ backgroundImage:'linear-gradient(rgba(20,184,166,0.15) 1px,transparent 1px),linear-gradient(90deg,rgba(20,184,166,0.15) 1px,transparent 1px)', backgroundSize:'60px 60px' }} />
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-brand-500/10 rounded-full blur-[120px] pointer-events-none" />
        <div className="relative z-10 max-w-4xl mx-auto px-6 text-center">
          <div className="inline-flex items-center gap-2 glass rounded-full px-4 py-1.5 text-sm text-brand-300 mb-8 animate-fade-in"><span className="w-2 h-2 bg-brand-400 rounded-full animate-pulse-ring" />Lançamento em São Paulo — Primeiros parceiros com acesso gratuito</div>
          <h1 className="font-display text-5xl md:text-7xl font-extrabold text-white leading-[1.05] mb-6 animate-fade-up">Recupere o que<br /><span className="gradient-text">você perdeu.</span></h1>
          <p className="text-xl text-slate-400 max-w-2xl mx-auto mb-10 animate-fade-up">Plataforma global de objetos perdidos e achados com QR Code, IA de matching e notificação em tempo real.</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center animate-fade-up">
            <Link href="/auth/register" className="inline-flex items-center gap-2 bg-brand-500 hover:bg-brand-400 text-white font-semibold px-8 py-4 rounded-xl transition-all duration-200 glow-teal text-lg">Registrar objeto grátis<ArrowRight className="w-5 h-5" /></Link>
            <Link href="/map" className="inline-flex items-center gap-2 glass hover:bg-surface-card text-slate-300 hover:text-white font-medium px-8 py-4 rounded-xl transition-all duration-200 text-lg"><MapPin className="w-4 h-4" />Ver mapa público</Link>
          </div>
          <div className="grid grid-cols-3 gap-8 mt-20 pt-12 border-t border-surface-border">
            <div className="text-center"><p className="text-4xl font-display font-bold gradient-text">{c1.toLocaleString('pt-BR')}+</p><p className="text-slate-400 text-sm mt-1">Objetos registrados</p></div>
            <div className="text-center"><p className="text-4xl font-display font-bold gradient-text">{c2.toLocaleString('pt-BR')}+</p><p className="text-slate-400 text-sm mt-1">Recuperações confirmadas</p></div>
            <div className="text-center"><p className="text-4xl font-display font-bold gradient-text">{c3}%</p><p className="text-slate-400 text-sm mt-1">Taxa de retorno com QR</p></div>
          </div>
        </div>
      </section>

      <section id="como-funciona" className="py-24 px-6"><div className="max-w-5xl mx-auto"><div className="text-center mb-16"><p className="text-brand-400 font-medium text-sm uppercase tracking-widest mb-3">Simples assim</p><h2 className="font-display text-4xl font-bold text-white">Como funciona</h2></div><div className="grid md:grid-cols-3 gap-8">{[{n:'01',icon:<QrCode className="w-6 h-6" />,title:'Registre seu objeto',desc:'Adicione fotos, descrição e localização. Receba um QR Code exclusivo.'},{n:'02',icon:<MapPin className="w-6 h-6" />,title:'Rastreamento em tempo real',desc:'Qualquer pessoa que escanear o QR Code inicia o processo de devolução.'},{n:'03',icon:<Zap className="w-6 h-6" />,title:'Recuperação garantida',desc:'Notificação instantânea, chat seguro e confirmação de entrega.'}].map(s=><div key={s.n} className="glass rounded-2xl p-8 hover:border-brand-500/50 transition-all duration-300 group"><span className="font-display text-5xl font-extrabold text-surface-border group-hover:text-brand-500/40 transition-colors">{s.n}</span><div className="w-10 h-10 rounded-lg bg-brand-500/10 border border-brand-500/20 flex items-center justify-center text-brand-400 my-4">{s.icon}</div><h3 className="font-display font-bold text-white text-lg mb-2">{s.title}</h3><p className="text-slate-400 text-sm leading-relaxed">{s.desc}</p></div>)}</div></div></section>

      <section id="recursos" className="py-24 px-6 bg-surface-card/30"><div className="max-w-5xl mx-auto"><div className="text-center mb-16"><h2 className="font-display text-4xl font-bold text-white">Tecnologia a serviço da <span className="gradient-text">recuperação</span></h2></div><div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">{[{icon:<Shield className="w-5 h-5 text-brand-400" />,title:'Privacidade total',desc:'Seu contato nunca é exposto. Comunicação mediada.'},{icon:<Globe className="w-5 h-5 text-brand-400" />,title:'Cobertura global',desc:'Funciona em qualquer país. QR Codes são universais.'},{icon:<Search className="w-5 h-5 text-brand-400" />,title:'IA de matching',desc:'Cruza objetos perdidos com achados automaticamente.'},{icon:<QrCode className="w-5 h-5 text-brand-400" />,title:'QR Code eterno',desc:'Vinculado ao objeto para sempre.'}].map(f=><div key={f.title} className="glass rounded-xl p-6 hover:border-brand-500/40 transition-all duration-300"><div className="w-9 h-9 rounded-lg bg-brand-500/10 flex items-center justify-center mb-4">{f.icon}</div><h3 className="font-display font-semibold text-white mb-2">{f.title}</h3><p className="text-slate-400 text-sm leading-relaxed">{f.desc}</p></div>)}</div></div></section>

      <section className="py-24 px-6"><div className="max-w-3xl mx-auto"><div className="glass rounded-3xl p-12 text-center relative overflow-hidden"><div className="absolute inset-0 bg-gradient-to-br from-brand-500/10 to-transparent pointer-events-none" /><div className="relative z-10"><h2 className="font-display text-4xl font-bold text-white mb-4">Comece agora, é grátis.</h2><p className="text-slate-400 mb-8">Registre seus objetos mais valiosos em menos de 2 minutos.</p><Link href="/auth/register" className="inline-flex items-center gap-2 bg-brand-500 hover:bg-brand-400 text-white font-semibold px-10 py-4 rounded-xl transition-all glow-teal text-lg">Criar conta grátis<ArrowRight className="w-5 h-5" /></Link><p className="text-slate-600 text-xs mt-4">Sem cartão de crédito · Plano gratuito para sempre</p></div></div></div></section>

      <footer className="border-t border-surface-border py-8 px-6"><div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4"><div className="flex items-center gap-2"><div className="w-6 h-6 rounded-md gradient-brand flex items-center justify-center"><MapPin className="w-3 h-3 text-white" /></div><span className="font-display font-bold text-sm text-white">Backfindr</span></div><p className="text-slate-600 text-xs">© 2026 Backfindr. Todos os direitos reservados.</p><div className="flex gap-6 text-xs text-slate-500"><a href="/privacy" className="hover:text-white transition-colors">Privacidade</a><a href="/terms" className="hover:text-white transition-colors">Termos</a></div></div></footer>
    </div>
  );
}
