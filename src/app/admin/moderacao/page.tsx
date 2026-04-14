'use client';

import { useState } from 'react';
import { Shield, AlertTriangle, Eye, Trash2, UserX, CheckCircle2, Flag } from 'lucide-react';

const REPORTS = [
  { id: '1', type: 'spam',       object: 'iPhone 15 Pro Grátis!!!',     reporter: 'user_291', target_user: 'spam_bot_01', created_at: '14/04 10:22', status: 'pending' },
  { id: '2', type: 'fake',       object: 'Carteira Louis Vuitton perdida', reporter: 'user_445', target_user: 'user_112',   created_at: '14/04 09:15', status: 'pending' },
  { id: '3', type: 'suspicious', object: 'Documento RG encontrado',     reporter: 'user_78',  target_user: 'user_334',   created_at: '13/04 22:41', status: 'reviewed' },
  { id: '4', type: 'spam',       object: 'Ganhei um prêmio click aqui', reporter: 'user_92',  target_user: 'spam_bot_02', created_at: '13/04 18:30', status: 'resolved' },
  { id: '5', type: 'inappropriate', object: 'Conteúdo inadequado',      reporter: 'user_156', target_user: 'user_445',   created_at: '12/04 14:05', status: 'resolved' },
];

const TYPE_STYLE: Record<string, string> = {
  spam:         'text-red-400 bg-red-500/10 border-red-500/20',
  fake:         'text-orange-400 bg-orange-500/10 border-orange-500/20',
  suspicious:   'text-yellow-400 bg-yellow-500/10 border-yellow-500/20',
  inappropriate:'text-purple-400 bg-purple-500/10 border-purple-500/20',
};

const STATUS_STYLE: Record<string, string> = {
  pending:  'text-yellow-400',
  reviewed: 'text-blue-400',
  resolved: 'text-green-400',
};

const BLOCKED_USERS = [
  { id: 'b1', name: 'spam_bot_01', email: 'sp1@temp.com', reason: 'Spam sistemático', blocked_at: '14/04/2026' },
  { id: 'b2', name: 'spam_bot_02', email: 'sp2@temp.com', reason: 'Conteúdo falso',   blocked_at: '13/04/2026' },
];

export default function AdminModeracao() {
  const [tab, setTab] = useState('reports');

  const pending  = REPORTS.filter(r => r.status === 'pending').length;
  const resolved = REPORTS.filter(r => r.status === 'resolved').length;

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Moderação</h1>
          <p className="text-white/30 text-sm mt-0.5">Reports, bloqueios e conteúdo flagado</p>
        </div>
        {pending > 0 && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-500/10 border border-red-500/20">
            <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
            <span className="text-red-400 text-xs font-medium">{pending} pendente{pending > 1 ? 's' : ''}</span>
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Pendentes',  value: pending,  color: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20', icon: AlertTriangle },
          { label: 'Resolvidos', value: resolved, color: 'text-green-400 bg-green-500/10 border-green-500/20',   icon: CheckCircle2 },
          { label: 'Bloqueados', value: BLOCKED_USERS.length, color: 'text-red-400 bg-red-500/10 border-red-500/20', icon: UserX },
        ].map(({ label, value, color, icon: Icon }) => (
          <div key={label} className={`flex items-center gap-3 p-4 rounded-2xl border ${color} bg-opacity-50`}>
            <Icon className="w-5 h-5 flex-shrink-0" />
            <div>
              <p className="text-xl font-bold text-white">{value}</p>
              <p className="text-xs opacity-60">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {[{ value: 'reports', label: 'Reports' }, { value: 'blocked', label: 'Bloqueados' }].map(t => (
          <button key={t.value} onClick={() => setTab(t.value)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${tab === t.value ? 'bg-teal-500/15 text-teal-400 border border-teal-500/30' : 'text-white/40 hover:text-white'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'reports' && (
        <div className="space-y-3">
          {REPORTS.map(r => (
            <div key={r.id} className={`bg-white/[0.02] border rounded-2xl p-4 transition-all ${r.status === 'pending' ? 'border-yellow-500/20' : 'border-white/[0.07]'}`}>
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-xl bg-red-500/10 flex items-center justify-center flex-shrink-0">
                    <Flag className="w-4 h-4 text-red-400" />
                  </div>
                  <div>
                    <p className="text-white text-sm font-medium">{r.object}</p>
                    <div className="flex items-center gap-3 mt-1">
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${TYPE_STYLE[r.type]}`}>
                        {r.type}
                      </span>
                      <span className="text-white/20 text-xs">por {r.reporter}</span>
                      <span className="text-white/20 text-xs">{r.created_at}</span>
                    </div>
                  </div>
                </div>
                <span className={`text-xs font-medium capitalize ${STATUS_STYLE[r.status]}`}>{r.status}</span>
              </div>
              {r.status === 'pending' && (
                <div className="flex gap-2 pt-2 border-t border-white/[0.06]">
                  <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-white/50 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] transition-all">
                    <Eye className="w-3 h-3" /> Revisar
                  </button>
                  <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-red-400 bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 transition-all">
                    <Trash2 className="w-3 h-3" /> Remover objeto
                  </button>
                  <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-orange-400 bg-orange-500/10 border border-orange-500/20 hover:bg-orange-500/20 transition-all">
                    <UserX className="w-3 h-3" /> Bloquear usuário
                  </button>
                  <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-green-400 bg-green-500/10 border border-green-500/20 hover:bg-green-500/20 transition-all ml-auto">
                    <CheckCircle2 className="w-3 h-3" /> Ignorar
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {tab === 'blocked' && (
        <div className="space-y-3">
          {BLOCKED_USERS.map(u => (
            <div key={u.id} className="bg-white/[0.02] border border-red-500/10 rounded-2xl p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center">
                    <UserX className="w-4 h-4 text-red-400" />
                  </div>
                  <div>
                    <p className="text-white text-sm font-medium">{u.name}</p>
                    <p className="text-white/30 text-xs">{u.email} · {u.reason}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-white/20 text-xs">{u.blocked_at}</span>
                  <button className="px-3 py-1.5 rounded-lg text-xs text-white/40 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] transition-all">
                    Desbloquear
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
