'use client';
export const dynamic = 'force-dynamic';
import { MapPin, Truck, CheckCircle2, Clock, Package } from 'lucide-react';
export default function RastreioPage() {
  return (
    <div className="p-6 md:p-8 max-w-3xl mx-auto">
      <div className="mb-8"><h1 className="text-2xl font-bold text-white">Rastreio em tempo real</h1><p className="text-white/40 text-sm mt-1">Farmácia São João → Unidade 204</p></div>
      <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6 mb-4 flex flex-col items-center justify-center gap-3 min-h-[160px]">
        <MapPin className="w-10 h-10 text-teal-400/50"/>
        <p className="text-white/40 text-sm">Mapa com geofencing ativo</p>
        <div className="flex items-center gap-2 px-3 py-1.5 bg-teal-500/10 border border-teal-500/20 rounded-full">
          <span className="w-2 h-2 rounded-full bg-teal-400 animate-pulse"/>
          <span className="text-teal-400 text-xs">Entregador a 800m · ~4 min</span>
        </div>
      </div>
      <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5 mb-4">
        <p className="text-white/30 text-xs font-mono uppercase tracking-wider mb-4">Histórico</p>
        <div className="space-y-4 pl-4 border-l border-white/[0.06]">
          {[
            {color:'text-green-400',label:'Pedido coletado no estabelecimento',sub:'14:20 · Farmácia São João'},
            {color:'text-blue-400',label:'Em rota de entrega',sub:'14:28 · Notificação enviada ao morador'},
            {color:'text-white/20',label:'Chegando ao condomínio',sub:'Previsão: 14:35'},
          ].map(({color,label,sub})=>(
            <div key={label} className="flex items-start gap-3">
              <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${color.replace('text-','bg-')}`}/>
              <div><p className={`text-sm font-medium ${color}`}>{label}</p><p className="text-white/30 text-xs mt-0.5">{sub}</p></div>
            </div>
          ))}
        </div>
      </div>
      <button className="w-full flex items-center justify-center gap-2 py-3 bg-teal-500 text-white rounded-2xl text-sm hover:bg-teal-600 transition-all">
        <CheckCircle2 className="w-4 h-4"/>Confirmar recebimento
      </button>
    </div>
  );
}