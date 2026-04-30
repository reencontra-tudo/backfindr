'use client';
 
import { useState } from 'react';
import { QrCode, Plus, Download, Copy, CheckCircle2 } from 'lucide-react';

const MOCK_QR = [
  { id: '1', name: 'Recepção Principal', code: 'BF-RC001', scans: 47, active: true,  created: '01/04/2026' },
  { id: '2', name: 'Portaria 1',         code: 'BF-PT001', scans: 31, active: true,  created: '01/04/2026' },
  { id: '3', name: 'Portaria 2',         code: 'BF-PT002', scans: 28, active: true,  created: '01/04/2026' },
  { id: '4', name: 'Academia',           code: 'BF-AC001', scans: 19, active: true,  created: '05/04/2026' },
  { id: '5', name: 'Salão de Festas',    code: 'BF-SF001', scans: 14, active: true,  created: '05/04/2026' },
  { id: '6', name: 'Piscina',            code: 'BF-PI001', scans: 11, active: true,  created: '10/04/2026' },
  { id: '7', name: 'Salão de Jogos',     code: 'BF-SJ001', scans:  3, active: false, created: '15/04/2026' },
];

export default function ParceiroQRCodesClient() {
  const [copied, setCopied] = useState<string | null>(null);
  function copyCode(code: string) {
    navigator.clipboard.writeText(`https://backfindr.com/scan/${code}`);
    setCopied(code);
    setTimeout(() => setCopied(null), 2000);
  }
  const total = MOCK_QR.reduce((acc, q) => acc + q.scans, 0);
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-white">QR Codes</h1>
          <p className="text-white/30 text-sm mt-0.5">{MOCK_QR.filter(q => q.active).length} ativos · {total} scans totais</p>
        </div>
        <button className="flex items-center gap-2 bg-teal-500 hover:bg-teal-400 text-white font-semibold px-4 py-2.5 rounded-xl text-sm transition-all">
          <Plus className="w-4 h-4" />Gerar QR Code
        </button>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'QR Ativos',    value: MOCK_QR.filter(q => q.active).length, color: 'text-teal-400' },
          { label: 'Scans totais', value: total,                                  color: 'text-blue-400' },
          { label: 'Este mês',     value: Math.floor(total * 0.6),               color: 'text-purple-400' },
        ].map(s => (
          <div key={s.label} className="bg-white/[0.02] border border-white/[0.07] rounded-2xl p-4 text-center">
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-white/30 text-xs mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>
      <div className="space-y-2">
        {MOCK_QR.map(qr => (
          <div key={qr.id} className="bg-white/[0.02] border border-white/[0.07] rounded-2xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center flex-shrink-0">
                <QrCode className="w-6 h-6 text-white/40" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <p className="text-white font-medium text-sm">{qr.name}</p>
                  <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full border ${qr.active ? 'text-teal-400 bg-teal-500/10 border-teal-500/20' : 'text-white/30 bg-white/[0.04] border-white/[0.08]'}`}>
                    {qr.active ? 'Ativo' : 'Inativo'}
                  </span>
                </div>
                <p className="text-white/30 text-xs font-mono">{qr.code}</p>
                <p className="text-white/20 text-xs mt-0.5">{qr.scans} scans · desde {qr.created}</p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button onClick={() => copyCode(qr.code)} className="w-8 h-8 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] flex items-center justify-center transition-all">
                  {copied === qr.code ? <CheckCircle2 className="w-4 h-4 text-teal-400" /> : <Copy className="w-4 h-4 text-white/40" />}
                </button>
                <button className="w-8 h-8 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] flex items-center justify-center transition-all">
                  <Download className="w-4 h-4 text-white/40" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
