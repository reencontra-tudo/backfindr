'use client';

import { useState } from 'react';
import { Plus, MoreHorizontal, CheckCircle2 } from 'lucide-react';

const MOCK_TEAM = [
  { id: '1', name: 'Carlos Mendes',  email: 'carlos@condovilla.com.br',  role: 'admin',    active: true,  joined: '01/03/2026' },
  { id: '2', name: 'Ana Ferreira',   email: 'ana@condovilla.com.br',     role: 'manager',  active: true,  joined: '05/03/2026' },
  { id: '3', name: 'Roberto Lima',   email: 'roberto@condovilla.com.br', role: 'operator', active: true,  joined: '10/03/2026' },
  { id: '4', name: 'Patrícia Souza', email: 'patricia@condovilla.com.br',role: 'operator', active: false, joined: '15/03/2026' },
];
const ROLE_LABEL: Record<string, string> = { admin: 'Administrador', manager: 'Gerente', operator: 'Operador' };
const ROLE_COLOR: Record<string, string> = {
  admin:    'text-purple-400 bg-purple-500/10 border-purple-500/20',
  manager:  'text-blue-400 bg-blue-500/10 border-blue-500/20',
  operator: 'text-teal-400 bg-teal-500/10 border-teal-500/20',
};

export default function ParceiroEquipeClient() {
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [sent, setSent] = useState(false);
  function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setSent(true);
    setTimeout(() => { setSent(false); setShowInvite(false); setInviteEmail(''); }, 2500);
  }
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-white">Equipe</h1>
          <p className="text-white/30 text-sm mt-0.5">{MOCK_TEAM.filter(m => m.active).length} membros ativos</p>
        </div>
        <button onClick={() => setShowInvite(true)} className="flex items-center gap-2 bg-teal-500 hover:bg-teal-400 text-white font-semibold px-4 py-2.5 rounded-xl text-sm transition-all">
          <Plus className="w-4 h-4" />Convidar membro
        </button>
      </div>
      {showInvite && (
        <div className="bg-white/[0.03] border border-teal-500/20 rounded-2xl p-5">
          <h3 className="text-white font-semibold mb-4">Convidar novo membro</h3>
          {sent ? (
            <div className="flex items-center gap-2 text-teal-400 text-sm"><CheckCircle2 className="w-4 h-4" />Convite enviado para {inviteEmail}!</div>
          ) : (
            <form onSubmit={handleInvite} className="space-y-3">
              <input type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} placeholder="email@empresa.com" required
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-white placeholder-white/20 text-sm outline-none focus:border-teal-500/40 transition-all" />
              <div className="flex gap-2">
                <button type="submit" className="flex-1 bg-teal-500 hover:bg-teal-400 text-white font-semibold py-2.5 rounded-xl text-sm transition-all">Enviar convite</button>
                <button type="button" onClick={() => setShowInvite(false)} className="px-4 py-2.5 text-white/40 hover:text-white/70 text-sm transition-colors">Cancelar</button>
              </div>
            </form>
          )}
        </div>
      )}
      <div className="space-y-2">
        {MOCK_TEAM.map(member => (
          <div key={member.id} className="bg-white/[0.02] border border-white/[0.07] rounded-2xl p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-teal-500/30 to-blue-500/30 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
              {member.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-0.5">
                <p className="text-white font-medium text-sm">{member.name}</p>
                <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full border ${ROLE_COLOR[member.role]}`}>{ROLE_LABEL[member.role]}</span>
                {!member.active && <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full border text-white/30 bg-white/[0.04] border-white/[0.08]">Inativo</span>}
              </div>
              <p className="text-white/30 text-xs">{member.email}</p>
              <p className="text-white/20 text-xs mt-0.5">desde {member.joined}</p>
            </div>
            <button className="w-8 h-8 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] flex items-center justify-center transition-all flex-shrink-0">
              <MoreHorizontal className="w-4 h-4 text-white/40" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
