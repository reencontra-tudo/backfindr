'use client';
export const dynamic = 'force-dynamic';
import { Store, Plus, Truck } from 'lucide-react';
const parceiros = [
  {id:'1',nome:'Farmácia São João',end:'Av. Paulista, 1000',entregas:12,ativo:true},
  {id:'2',nome:'Supermercado Extra',end:'R. da Consolação, 200',entregas:5,ativo:true},
  {id:'3',nome:'Pet Shop Amigo Fiel',end:'R. Augusta, 500',entregas:0,ativo:false},
];
export default function ParceirosPage() {
  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div><h1 className="text-2xl font-bold text-white">Parceiros de delivery</h1><p className="text-white/40 text-sm mt-1">Estabelecimentos cadastrados</p></div>
        <button className="flex items-center gap-2 px-4 py-2 bg-teal-500 text-white rounded-xl text-sm"><Plus className="w-4 h-4"/>Novo parceiro</button>
      </div>
      <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl overflow-hidden">
        {parceiros.map((p,i)=>(
          <div key={p.id} className={`flex items-center gap-4 p-4 ${i<parceiros.length-1?'border-b border-white/[0.05]':''}`}>
            <div className="w-10 h-10 rounded-xl bg-white/[0.04] flex items-center justify-center"><Store className="w-5 h-5 text-white/30"/></div>
            <div className="flex-1"><p className="text-white/80 text-sm font-medium">{p.nome}</p><p className="text-white/30 text-xs mt-0.5">{p.end}</p></div>
            <div className="flex items-center gap-1 text-white/30 text-xs"><Truck className="w-3.5 h-3.5"/>{p.entregas} ativas</div>
            <span className={`px-2 py-0.5 rounded-full text-xs border ${p.ativo?'bg-green-500/10 text-green-400 border-green-500/20':'bg-white/5 text-white/30 border-white/10'}`}>{p.ativo?'Ativo':'Inativo'}</span>
          </div>
        ))}
      </div>
    </div>
  );
}