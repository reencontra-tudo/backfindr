'use client';

import { TrendingUp, Package, CheckCircle2, QrCode, Download } from 'lucide-react';

const MONTHLY = [
  { month: 'Jan', objects: 8,  returned: 6  },
  { month: 'Fev', objects: 11, returned: 9  },
  { month: 'Mar', objects: 15, returned: 12 },
  { month: 'Abr', objects: 23, returned: 18 },
];
const TOP_LOCATIONS = [
  { name: 'Recepção Principal', count: 9 },
  { name: 'Academia',           count: 6 },
  { name: 'Portaria 1',         count: 4 },
  { name: 'Salão de Festas',    count: 3 },
  { name: 'Piscina',            count: 1 },
];
const TOP_CATEGORIES = [
  { name: 'Chaves',   emoji: '🔑', count: 7 },
  { name: 'Celular',  emoji: '📱', count: 5 },
  { name: 'Carteira', emoji: '👛', count: 4 },
  { name: 'Mochila',  emoji: '🎒', count: 4 },
  { name: 'Outros',   emoji: '📦', count: 3 },
];
const maxObjects = Math.max(...MONTHLY.map(m => m.objects));

export default function ParceiroRelatoriosClient() {
  const totalObjects  = MONTHLY.reduce((a, m) => a + m.objects, 0);
  const totalReturned = MONTHLY.reduce((a, m) => a + m.returned, 0);
  const returnRate    = Math.round((totalReturned / totalObjects) * 100);
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-white">Relatórios</h1>
          <p className="text-white/30 text-sm mt-0.5">Janeiro — Abril 2026</p>
        </div>
        <button className="flex items-center gap-2 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-white/60 font-medium px-4 py-2.5 rounded-xl text-sm transition-all">
          <Download className="w-4 h-4" />Exportar PDF
        </button>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {[
          { icon: Package,      label: 'Total objetos',  value: totalObjects,     color: 'text-teal-400 bg-teal-500/10'     },
          { icon: CheckCircle2, label: 'Devolvidos',     value: totalReturned,    color: 'text-green-400 bg-green-500/10'   },
          { icon: TrendingUp,   label: 'Taxa devolução', value: `${returnRate}%`, color: 'text-blue-400 bg-blue-500/10'     },
          { icon: QrCode,       label: 'Scans QR',       value: 153,              color: 'text-purple-400 bg-purple-500/10' },
        ].map(({ icon: Icon, label, value, color }) => (
          <div key={label} className="bg-white/[0.02] border border-white/[0.07] rounded-2xl p-5">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 ${color}`}><Icon className="w-4 h-4" /></div>
            <p className="text-2xl font-bold text-white">{value}</p>
            <p className="text-white/40 text-xs mt-0.5">{label}</p>
          </div>
        ))}
      </div>
      <div className="bg-white/[0.02] border border-white/[0.07] rounded-2xl p-5">
        <p className="text-white font-semibold text-sm mb-4">Objetos por mês</p>
        <div className="flex items-end gap-4 h-32">
          {MONTHLY.map(m => (
            <div key={m.month} className="flex-1 flex flex-col items-center gap-1">
              <div className="w-full flex flex-col items-center" style={{ height: '100px', justifyContent: 'flex-end' }}>
                <div className="w-full bg-teal-500/70 rounded-t-md" style={{ height: `${(m.objects / maxObjects) * 80}px` }} />
              </div>
              <p className="text-white/30 text-xs">{m.month}</p>
              <p className="text-teal-400 text-xs font-semibold">{m.objects}</p>
            </div>
          ))}
        </div>
      </div>
      <div className="bg-white/[0.02] border border-white/[0.07] rounded-2xl p-5">
        <p className="text-white font-semibold text-sm mb-4">Top locais de achados</p>
        <div className="space-y-3">
          {TOP_LOCATIONS.map((loc, i) => (
            <div key={loc.name} className="flex items-center gap-3">
              <span className="text-white/20 text-xs w-4">{i + 1}</span>
              <div className="flex-1">
                <div className="flex justify-between mb-1">
                  <span className="text-white/70 text-xs">{loc.name}</span>
                  <span className="text-white/40 text-xs">{loc.count}</span>
                </div>
                <div className="w-full h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                  <div className="h-full bg-teal-500/60 rounded-full" style={{ width: `${(loc.count / TOP_LOCATIONS[0].count) * 100}%` }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="bg-white/[0.02] border border-white/[0.07] rounded-2xl p-5">
        <p className="text-white font-semibold text-sm mb-4">Categorias mais comuns</p>
        <div className="space-y-2">
          {TOP_CATEGORIES.map(cat => (
            <div key={cat.name} className="flex items-center gap-3">
              <span className="text-lg w-6">{cat.emoji}</span>
              <span className="text-white/70 text-sm flex-1">{cat.name}</span>
              <span className="text-white/40 text-sm">{cat.count}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
