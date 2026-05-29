'use client';
export const dynamic = 'force-dynamic';
import { useState } from 'react';
import { Package, Plus, QrCode } from 'lucide-react';
const items = [
  { id:'1', descricao:'Chave reserva', dest:'Pedro Alves', status:'custodiado', qr:'CUST-A2B4-9F1E' },
  { id:'2', descricao:'Documentos', dest:'Lucia Ferreira', status:'retirado', qr:'CUST-B3C5-8E2D' },
  { id:'3', descricao:'Notebook Lenovo', dest:'João Silva', status:'aguardando', qr:'CUST-C4D6-7F3C' },
];
const ST: Record<string,{l:string;c:string}> = {
  custodiado:{l:'Custodiado',c:'bg-blue-500/10 text-blue-400 border border-blue-500/20'},
  retirado:{l:'Retirado',c:'bg-green-500/10 text-green-400 border border-green-500/20'},
  aguardando:{l:'Aguardando',c:'bg-white/5 text-white/40 border border-white/10'},
};
export default function CustodyPage() {
  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div><h1 className="text-2xl font-bold text-white">Custódia</h1><p className="text-white/40 text-sm mt-1">Itens sob guarda</p></div>
        <button className="flex items-center gap-2 px-4 py-2 bg-teal-500 text-white rounded-xl text-sm"><Plus className="w-4 h-4"/>Novo item</button>
      </div>
      <div className="grid grid-cols-3 gap-3 mb-6">
        {[['Total',items.length,'text-white'],['Custodiados',items.filter(i=>i.status==='custodiado').length,'text-blue-400'],['Retirados',items.filter(i=>i.status==='retirado').length,'text-green-400']].map(([l,v,c])=>(
          <div key={String(l)} className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4"><p className="text-white/30 text-xs mb-1">{l}</p><p className={`text-2xl font-bold ${c}`}>{v}</p></div>
        ))}
      </div>
      <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl overflow-hidden">
        {items.map((item,i)=>(
          <div key={item.id} className={`flex items-center gap-4 p-4 ${i<items.length-1?'border-b border-white/[0.05]':''}`}>
            <div className="w-10 h-10 rounded-xl bg-white/[0.04] flex items-center justify-center"><Package className="w-5 h-5 text-white/30"/></div>
            <div className="flex-1"><p className="text-white/80 text-sm font-medium">{item.descricao}</p><p className="text-white/30 text-xs mt-0.5">Destinatário: {item.dest}</p></div>
            <code className="text-white/20 text-xs font-mono hidden md:block">{item.qr}</code>
            <span className={`px-2 py-0.5 rounded-full text-xs ${ST[item.status].c}`}>{ST[item.status].l}</span>
            <QrCode className="w-4 h-4 text-white/20"/>
          </div>
        ))}
      </div>
    </div>
  );
}