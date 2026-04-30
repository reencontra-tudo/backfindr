'use client';

import { useState } from 'react';
import { Package, Plus, Search, MapPin, Clock } from 'lucide-react';

const MOCK_OBJECTS = [
  { id: '1', title: 'Guarda-chuva preto', category: 'other',  location: 'Recepção Principal', status: 'found',    date: '30/04/2026' },
  { id: '2', title: 'Óculos de grau',     category: 'other',  location: 'Salão de Festas',    status: 'found',    date: '30/04/2026' },
  { id: '3', title: 'Chaves (4 cópias)',  category: 'keys',   location: 'Portaria 2',         status: 'returned', date: '29/04/2026' },
  { id: '4', title: 'Carteira marrom',    category: 'wallet', location: 'Academia',           status: 'found',    date: '29/04/2026' },
  { id: '5', title: 'iPhone com capa azul', category: 'phone', location: 'Piscina',          status: 'found',    date: '28/04/2026' },
  { id: '6', title: 'Mochila preta',      category: 'bag',    location: 'Salão de Jogos',    status: 'found',    date: '27/04/2026' },
  { id: '7', title: 'Cartão bancário',    category: 'wallet', location: 'Portaria 1',        status: 'returned', date: '26/04/2026' },
];

const STATUS_STYLE: Record<string, string> = {
  found:    'text-teal-400 bg-teal-500/10 border-teal-500/20',
  returned: 'text-green-400 bg-green-500/10 border-green-500/20',
};
const STATUS_LABEL: Record<string, string> = {
  found: 'Achado', returned: 'Devolvido',
};
const EMOJI: Record<string, string> = {
  phone: '📱', wallet: '👛', keys: '🔑', bag: '🎒', other: '📦',
};

export default function ParceiroObjetosClient() {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');

  const filtered = MOCK_OBJECTS.filter(o => {
    const matchSearch = o.title.toLowerCase().includes(search.toLowerCase()) || o.location.toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === 'all' || o.status === filter;
    return matchSearch && matchFilter;
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-white">Objetos</h1>
          <p className="text-white/30 text-sm mt-0.5">{MOCK_OBJECTS.length} objetos registrados este mês</p>
        </div>
        <button className="flex items-center gap-2 bg-teal-500 hover:bg-teal-400 text-white font-semibold px-4 py-2.5 rounded-xl text-sm transition-all">
          <Plus className="w-4 h-4" />Registrar objeto
        </button>
      </div>
      <div className="flex gap-2 flex-wrap">
        {[{value:'all',label:'Todos'},{value:'found',label:'Achados'},{value:'returned',label:'Devolvidos'}].map(f => (
          <button key={f.value} onClick={() => setFilter(f.value)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${filter === f.value ? 'bg-teal-500/20 border-teal-500/40 text-teal-300' : 'bg-white/[0.03] border-white/[0.08] text-white/40 hover:border-white/20'}`}>
            {f.label}
          </button>
        ))}
      </div>
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
        <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por nome ou local..."
          className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl pl-10 pr-4 py-3 text-white placeholder-white/20 text-sm outline-none focus:border-teal-500/40 transition-all" />
      </div>
      <div className="space-y-2">
        {filtered.map(obj => (
          <div key={obj.id} className="bg-white/[0.02] border border-white/[0.07] rounded-2xl p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-white/[0.04] flex items-center justify-center text-xl flex-shrink-0">{EMOJI[obj.category] ?? '📦'}</div>
            <div className="flex-1 min-w-0">
              <p className="text-white font-medium text-sm">{obj.title}</p>
              <div className="flex items-center gap-3 mt-1">
                <span className="flex items-center gap-1 text-white/30 text-xs"><MapPin className="w-3 h-3" />{obj.location}</span>
                <span className="flex items-center gap-1 text-white/30 text-xs"><Clock className="w-3 h-3" />{obj.date}</span>
              </div>
            </div>
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full border flex-shrink-0 ${STATUS_STYLE[obj.status]}`}>{STATUS_LABEL[obj.status]}</span>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="text-center py-12"><Package className="w-10 h-10 text-white/10 mx-auto mb-3" /><p className="text-white/30 text-sm">Nenhum objeto encontrado</p></div>
        )}
      </div>
    </div>
  );
}
