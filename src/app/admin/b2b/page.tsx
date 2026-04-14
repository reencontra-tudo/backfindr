'use client';

import { useState } from 'react';
import { Building2, Users, Package, TrendingUp, Plus, Mail, Phone, MapPin, ChevronRight, CheckCircle2, Clock, XCircle } from 'lucide-react';

interface Partner {
  id: string; name: string; type: string; city: string;
  contact: string; email: string; phone: string;
  status: 'active' | 'onboarding' | 'negotiating' | 'inactive';
  users: number; objects: number; since?: string;
}

const PARTNERS: Partner[] = [
  { id: '1', name: 'Condomínio Villa Verde',     type: 'condominio',  city: 'São Paulo, SP',      contact: 'João Silva',      email: 'adm@villaverde.com.br',   phone: '(11) 3344-5566', status: 'active',      users: 142, objects: 89,  since: 'Jan 2026' },
  { id: '2', name: 'Shopping Pátio Higienópolis', type: 'shopping',    city: 'São Paulo, SP',      contact: 'Marina Costa',    email: 'mkt@patiohigienopolis.com',phone: '(11) 3823-2400', status: 'active',      users: 67,  objects: 203, since: 'Feb 2026' },
  { id: '3', name: 'Hotel Unique São Paulo',      type: 'hotel',       city: 'São Paulo, SP',      contact: 'Carlos Andrade',  email: 'concierge@hotelunique.com', phone: '(11) 3055-4700', status: 'onboarding',  users: 0,   objects: 0 },
  { id: '4', name: 'CPTM — Linha 7 Rubi',        type: 'transporte',  city: 'São Paulo, SP',      contact: 'Diretoria Ops',   email: 'achados@cptm.sp.gov.br',   phone: '(11) 3111-2111', status: 'negotiating', users: 0,   objects: 0 },
  { id: '5', name: 'Clínica Einstein Morumbi',    type: 'saude',       city: 'São Paulo, SP',      contact: 'TI Institucional',email: 'ti@einstein.br',           phone: '(11) 2151-1233', status: 'negotiating', users: 0,   objects: 0 },
  { id: '6', name: 'Universidade Mackenzie',      type: 'educacao',    city: 'São Paulo, SP',      contact: 'Patrimônio',      email: 'patrimonio@mackenzie.br',  phone: '(11) 2114-8000', status: 'inactive',    users: 12,  objects: 7 },
];

const TYPE_LABEL: Record<string, string> = {
  condominio: '🏢 Condomínio', shopping: '🛍 Shopping', hotel: '🏨 Hotel',
  transporte: '🚇 Transporte', saude: '🏥 Saúde', educacao: '🎓 Educação',
};

const STATUS_STYLE: Record<string, string> = {
  active:      'text-green-400 bg-green-500/10 border-green-500/20',
  onboarding:  'text-teal-400 bg-teal-500/10 border-teal-500/20',
  negotiating: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20',
  inactive:    'text-white/30 bg-white/[0.04] border-white/[0.08]',
};
const STATUS_LABEL: Record<string, string> = {
  active: 'Ativo', onboarding: 'Onboarding', negotiating: 'Negociando', inactive: 'Inativo',
};
const STATUS_ICON: Record<string, React.ElementType> = {
  active: CheckCircle2, onboarding: Clock, negotiating: TrendingUp, inactive: XCircle,
};

export default function AdminB2B() {
  const [filter, setFilter] = useState('all');
  const [selected, setSelected] = useState<Partner | null>(null);

  const filtered = filter === 'all' ? PARTNERS : PARTNERS.filter(p => p.status === filter);

  const stats = {
    active:      PARTNERS.filter(p => p.status === 'active').length,
    onboarding:  PARTNERS.filter(p => p.status === 'onboarding').length,
    negotiating: PARTNERS.filter(p => p.status === 'negotiating').length,
    totalUsers:  PARTNERS.reduce((a, p) => a + p.users, 0),
    totalObjects: PARTNERS.reduce((a, p) => a + p.objects, 0),
  };

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">B2B — Parceiros</h1>
          <p className="text-white/30 text-sm mt-0.5">Condomínios, shoppings, hotéis, transportes</p>
        </div>
        <button className="flex items-center gap-2 bg-teal-500 hover:bg-teal-400 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-all"
          style={{ boxShadow: '0 0 0 1px rgba(20,184,166,0.4)' }}>
          <Plus className="w-4 h-4" /> Novo parceiro
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {[
          { label: 'Ativos',       value: stats.active,       color: 'text-green-400' },
          { label: 'Onboarding',   value: stats.onboarding,   color: 'text-teal-400' },
          { label: 'Negociando',   value: stats.negotiating,  color: 'text-yellow-400' },
          { label: 'Usuários B2B', value: stats.totalUsers,   color: 'text-blue-400' },
          { label: 'Objetos B2B',  value: stats.totalObjects, color: 'text-purple-400' },
        ].map(s => (
          <div key={s.label} className="bg-white/[0.02] border border-white/[0.07] rounded-2xl p-4 text-center">
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-white/30 text-xs mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filter */}
      <div className="flex gap-2">
        {['all','active','onboarding','negotiating','inactive'].map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-3 py-2 rounded-xl text-xs font-medium transition-all ${filter === f ? 'bg-teal-500/15 text-teal-400 border border-teal-500/30' : 'bg-white/[0.03] text-white/40 border border-white/[0.07] hover:text-white'}`}>
            {f === 'all' ? 'Todos' : STATUS_LABEL[f]}
          </button>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {/* Partners list */}
        <div className="space-y-3">
          {filtered.map(partner => {
            const StatusIcon = STATUS_ICON[partner.status];
            return (
              <button key={partner.id} onClick={() => setSelected(partner)}
                className={`w-full text-left bg-white/[0.02] border rounded-2xl p-4 hover:border-white/[0.15] transition-all ${selected?.id === partner.id ? 'border-teal-500/30 bg-teal-500/[0.04]' : 'border-white/[0.07]'}`}>
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="text-white font-semibold text-sm">{partner.name}</p>
                    <p className="text-white/30 text-xs mt-0.5">{TYPE_LABEL[partner.type]}</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border flex items-center gap-1 ${STATUS_STYLE[partner.status]}`}>
                      <StatusIcon className="w-2.5 h-2.5" />
                      {STATUS_LABEL[partner.status]}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-xs text-white/30">
                  <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{partner.city}</span>
                  {partner.users > 0 && <span className="flex items-center gap-1"><Users className="w-3 h-3" />{partner.users} usuários</span>}
                  {partner.objects > 0 && <span className="flex items-center gap-1"><Package className="w-3 h-3" />{partner.objects} objetos</span>}
                </div>
              </button>
            );
          })}
        </div>

        {/* Detail panel */}
        {selected ? (
          <div className="bg-white/[0.02] border border-white/[0.07] rounded-2xl p-5 h-fit sticky top-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-white font-bold text-base">{selected.name}</p>
                <p className="text-white/30 text-sm">{TYPE_LABEL[selected.type]}</p>
              </div>
              <span className={`text-[10px] font-semibold px-2.5 py-1 rounded-full border ${STATUS_STYLE[selected.status]}`}>
                {STATUS_LABEL[selected.status]}
              </span>
            </div>

            <div className="space-y-3 mb-5">
              {[
                { icon: Users,   label: 'Contato',   value: selected.contact },
                { icon: Mail,    label: 'E-mail',    value: selected.email },
                { icon: Phone,   label: 'Telefone',  value: selected.phone },
                { icon: MapPin,  label: 'Cidade',    value: selected.city },
              ].map(({ icon: Icon, label, value }) => (
                <div key={label} className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-lg bg-white/[0.04] flex items-center justify-center flex-shrink-0">
                    <Icon className="w-3.5 h-3.5 text-white/40" />
                  </div>
                  <div>
                    <p className="text-white/20 text-[10px] uppercase tracking-wider">{label}</p>
                    <p className="text-white/70 text-sm">{value}</p>
                  </div>
                </div>
              ))}
            </div>

            {selected.status === 'active' && (
              <div className="grid grid-cols-2 gap-3 mb-5">
                <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-3 text-center">
                  <p className="text-xl font-bold text-white">{selected.users}</p>
                  <p className="text-white/30 text-xs">Usuários</p>
                </div>
                <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-3 text-center">
                  <p className="text-xl font-bold text-white">{selected.objects}</p>
                  <p className="text-white/30 text-xs">Objetos</p>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <button className="w-full flex items-center justify-center gap-2 bg-teal-500/10 hover:bg-teal-500/20 border border-teal-500/20 text-teal-400 text-sm py-2.5 rounded-xl transition-all">
                <Mail className="w-4 h-4" /> Enviar e-mail
              </button>
              <button className="w-full flex items-center justify-center gap-2 bg-white/[0.04] hover:bg-white/[0.07] border border-white/[0.08] text-white/60 hover:text-white text-sm py-2.5 rounded-xl transition-all">
                <ChevronRight className="w-4 h-4" /> Ver relatório completo
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-white/[0.02] border border-white/[0.07] rounded-2xl p-8 flex flex-col items-center justify-center text-center">
            <Building2 className="w-10 h-10 text-white/10 mb-3" />
            <p className="text-white/20 text-sm">Selecione um parceiro para ver detalhes</p>
          </div>
        )}
      </div>
    </div>
  );
}
