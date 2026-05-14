'use client';
export const dynamic = 'force-dynamic';
import { useState } from 'react';
import { Scan, CheckCircle2, AlertCircle } from 'lucide-react';
export default function CustodyScanPage() {
  const [code, setCode] = useState('');
  const [status, setStatus] = useState('idle');
  return (
    <div className="p-6 md:p-8 max-w-lg mx-auto">
      <div className="mb-8"><h1 className="text-2xl font-bold text-white">Scanner QR</h1><p className="text-white/40 text-sm mt-1">Escanear ou inserir código</p></div>
      <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-8 text-center mb-6">
        <div className="w-48 h-48 border-2 border-dashed border-white/10 rounded-2xl mx-auto flex flex-col items-center justify-center gap-3 mb-6">
          <Scan className="w-12 h-12 text-white/20"/><p className="text-white/20 text-xs">Câmera ativa</p>
        </div>
        <p className="text-white/30 text-sm mb-4">Ou insira o código manualmente:</p>
        <div className="flex gap-2">
          <input value={code} onChange={e=>setCode(e.target.value)} placeholder="CUST-XXXX-XXXX" className="flex-1 bg-white/[0.04] border border-white/10 rounded-xl px-3 py-2 text-white text-sm font-mono placeholder-white/20 outline-none"/>
          <button onClick={()=>setStatus(code.startsWith('CUST-')?'found':'error')} className="px-4 py-2 bg-teal-500 text-white rounded-xl text-sm">Buscar</button>
        </div>
      </div>
      {status==='found' && <div className="bg-green-500/10 border border-green-500/20 rounded-2xl p-4 flex items-center gap-3"><CheckCircle2 className="w-5 h-5 text-green-400"/><div><p className="text-green-400 font-medium text-sm">Item encontrado</p><p className="text-white/40 text-xs mt-0.5">Chave reserva · Pedro Alves</p></div></div>}
      {status==='error' && <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 flex items-center gap-3"><AlertCircle className="w-5 h-5 text-red-400"/><div><p className="text-red-400 font-medium text-sm">Código não encontrado</p></div></div>}
    </div>
  );
}