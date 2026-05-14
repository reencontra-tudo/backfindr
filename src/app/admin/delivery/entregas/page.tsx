'use client';
export const dynamic = 'force-dynamic';
import { useState } from 'react';
import { Truck } from 'lucide-react';
const entregas = [
  {id:'1',origem:'Farmácia São João',destino:'Unidade 204 — Ana Souza',status:'a_caminho',tempo:'12min atrás'},
  {id:'2',origem:'Supermercado Extra',destino:'Unidade 110 — Carlos Lima',status:'a_caminho',tempo:'28min atrás'},
  {id:'3',origem:'Farmácia São João',destino:'Unidade 307 — Mariana Reis',status:'aguardando',tempo:'Aguardando coleta'},
  {id:'4',origem:'Supermercado Extra',destino:'Unidade 502',status:'entregue',tempo:'Hoje 11:43'},
  {id:'5',origem:'Farmácia São João',destino:'Unidade 301',status:'entregue',tempo:'Hoje 10:22'},
];
const ST: Record<string,{l:string;c:string}> = {
  a_caminho:{l:'A caminho',c:'bg-amber-500/10 text-amber-400 border-amber-500/20'},
  aguardando:{l:'Aguardando',c:'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'},
  entregue:{l:'Entregue',c:'bg-green-500/10 text-green-400 border-green-500/20'},
};
export default function EntregasPage() {
  const [tab, setTab] = useState('ativas');
  const lista = tab==='ativas' ? entregas.filter(e=>e.status!=='entregue') : entregas.filter(e=>e.status==='entregue');
  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto">
      <div className="mb-8"><h1 className="text-2xl font-bold text-white">Entregas</h1><p className="text-white/40 text-sm mt-1">Em andamento e histórico</p></div>
      <div className="flex gap-1 mb-6 bg-white/[0.03] p-1 rounded-xl w-fit">
        {[['ativas','Em andamento (3)'],['historico','Histórico']].map(([k,l])=>(
          <button key={k} onClick={()=>setTab(k)} className={`px-4 py-1.5 rounded-lg text-sm transition-all ${tab===k?'bg-white/[0.08] text-white':'text-white/40'}`}>{l}</button>
        ))}
      </div>
      <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl overflow-hidden">
        {lista.map((e,i)=>(
          <div key={e.id} className={`flex items-center gap-4 p-4 ${i<lista.length-1?'border-b border-white/[0.05]':''}`}>
            <div className="w-10 h-10 rounded-xl bg-white/[0.04] flex items-center justify-center"><Truck className="w-5 h-5 text-white/30"/></div>
            <div className="flex-1"><p className="text-white/80 text-sm font-medium">{e.origem} → {e.destino}</p><p className="text-white/30 text-xs mt-0.5">{e.tempo}</p></div>
            <span className={`px-2 py-0.5 rounded-full text-xs border ${ST[e.status].c}`}>{ST[e.status].l}</span>
          </div>
        ))}
      </div>
    </div>
  );
}