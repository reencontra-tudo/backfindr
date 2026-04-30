'use client';

import { useState } from 'react';
import { Building2, Bell, CheckCircle2 } from 'lucide-react';

export default function ParceiroConfiguracoesClient() {
  const [saved, setSaved] = useState(false);
  const [form, setForm] = useState({
    orgName:      'Condomínio Villa Verde',
    orgType:      'condominio',
    address:      'Rua das Flores, 100 — Jardim Paulista, São Paulo',
    email:        'achados@condovilla.com.br',
    phone:        '(11) 3456-7890',
    notifyNew:    true,
    notifyMatch:  true,
    notifyReturn: false,
  });

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white">Configurações</h1>
        <p className="text-white/30 text-sm mt-0.5">Gerencie as preferências do portal</p>
      </div>
      <form onSubmit={handleSave} className="space-y-6">
        <div className="bg-white/[0.02] border border-white/[0.07] rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <Building2 className="w-4 h-4 text-teal-400" />
            <h2 className="text-white font-semibold text-sm">Dados da organização</h2>
          </div>
          {[
            { key: 'orgName', label: 'Nome',            type: 'text',  placeholder: 'Nome da organização' },
            { key: 'address', label: 'Endereço',         type: 'text',  placeholder: 'Endereço completo'   },
            { key: 'email',   label: 'Email de contato', type: 'email', placeholder: 'email@empresa.com'   },
            { key: 'phone',   label: 'Telefone',         type: 'tel',   placeholder: '(11) 99999-9999'     },
          ].map(field => (
            <div key={field.key}>
              <label className="block text-white/40 text-xs mb-1.5">{field.label}</label>
              <input
                type={field.type}
                value={form[field.key as keyof typeof form] as string}
                onChange={e => setForm(f => ({ ...f, [field.key]: e.target.value }))}
                placeholder={field.placeholder}
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-teal-500/40 transition-all"
              />
            </div>
          ))}
          <div>
            <label className="block text-white/40 text-xs mb-1.5">Tipo</label>
            <select
              value={form.orgType}
              onChange={e => setForm(f => ({ ...f, orgType: e.target.value }))}
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-teal-500/40 transition-all"
            >
              <option value="condominio">Condomínio</option>
              <option value="empresa">Empresa</option>
              <option value="shopping">Shopping</option>
              <option value="hotel">Hotel</option>
              <option value="escola">Escola / Universidade</option>
              <option value="hospital">Hospital / Clínica</option>
              <option value="outro">Outro</option>
            </select>
          </div>
        </div>
        <div className="bg-white/[0.02] border border-white/[0.07] rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <Bell className="w-4 h-4 text-blue-400" />
            <h2 className="text-white font-semibold text-sm">Notificações</h2>
          </div>
          {[
            { key: 'notifyNew',    label: 'Novo objeto registrado'     },
            { key: 'notifyMatch',  label: 'Match identificado pela IA' },
            { key: 'notifyReturn', label: 'Objeto devolvido'           },
          ].map(({ key, label }) => (
            <div key={key} className="flex items-center justify-between">
              <span className="text-white/60 text-sm">{label}</span>
              <button
                type="button"
                onClick={() => setForm(f => ({ ...f, [key]: !f[key as keyof typeof f] }))}
                className={`w-11 h-6 rounded-full transition-all relative ${form[key as keyof typeof form] ? 'bg-teal-500' : 'bg-white/[0.1]'}`}
              >
                <span
                  className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all"
                  style={{ left: form[key as keyof typeof form] ? '22px' : '2px' }}
                />
              </button>
            </div>
          ))}
        </div>
        <button
          type="submit"
          className="w-full flex items-center justify-center gap-2 bg-teal-500 hover:bg-teal-400 text-white font-bold py-3.5 rounded-xl transition-all"
          style={{ boxShadow: '0 0 0 1px rgba(20,184,166,0.4),0 4px 20px rgba(20,184,166,0.15)' }}
        >
          {saved ? <><CheckCircle2 className="w-4 h-4" />Salvo!</> : 'Salvar configurações'}
        </button>
      </form>
    </div>
  );
}
