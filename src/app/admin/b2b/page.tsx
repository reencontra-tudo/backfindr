'use client';
import { useEffect, useState } from 'react';
import {
  Building2, Users, MapPin, Mail, Phone,
  Plus, X, RefreshCw, Search
} from 'lucide-react';
import { api, parseApiError } from '@/lib/api';
import { toast } from 'sonner';

interface Partner {
  id: string; name: string; type: string; city: string;
  contact: string; email: string; phone?: string; notes?: string;
  status?: string; created_at: string;
}

const TYPE_LABEL: Record<string, string> = {
  hotel: 'Hotel', hospital: 'Hospital', airport: 'Aeroporto',
  shopping: 'Shopping', school: 'Escola', other: 'Outro',
};
const STATUS_STYLE: Record<string, string> = {
  active:      'text-green-400 bg-green-500/10 border-green-500/20',
  negotiating: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20',
  inactive:    'text-white/30 bg-white/[0.04] border-white/[0.08]',
};
const STATUS_LABEL: Record<string, string> = {
  active: 'Ativo', negotiating: 'Negociando', inactive: 'Inativo',
};

export default function AdminB2B() {
  const [partners, setPartners] = useState<Partner[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Partner | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', type: 'hotel', city: '', contact: '', email: '', phone: '', notes: '' });

  const load = async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = { page: 1, size: 50 };
      if (search) params.search = search;
      const { data } = await api.get('/admin/b2b', { params });
      setPartners(data.items ?? []);
      setTotal(data.total ?? 0);
    } catch {
      toast.error('Erro ao carregar parceiros');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [search]);

  const handleCreate = async () => {
    if (!form.name || !form.city || !form.contact || !form.email) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }
    setSaving(true);
    try {
      const { data } = await api.post('/admin/b2b', form);
      toast.success('Parceiro cadastrado');
      setShowForm(false);
      setForm({ name: '', type: 'hotel', city: '', contact: '', email: '', phone: '', notes: '' });
      load();
      setSelected(data);
    } catch (e) {
      toast.error(parseApiError(e));
    } finally {
      setSaving(false);
    }
  };

  const statusCounts = partners.reduce((acc, p) => {
    const s = p.status ?? 'inactive';
    acc[s] = (acc[s] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="p-5 md:p-7 max-w-7xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-white text-xl font-bold tracking-tight">B2B</h1>
          <p className="text-white/25 text-xs mt-0.5">{total} parceiros cadastrados</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} disabled={loading}
            className="w-9 h-9 flex items-center justify-center bg-white/[0.04] hover:bg-white/[0.07] border border-white/[0.07] rounded-xl text-white/40 hover:text-white transition-all disabled:opacity-40">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button onClick={() => setShowForm(true)}
            className="flex items-center gap-2 bg-teal-500 hover:bg-teal-400 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-all">
            <Plus className="w-4 h-4" /> Novo parceiro
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {[
          { key: 'active',      label: 'Ativos',     color: 'text-green-400 bg-green-500/10 border-green-500/15' },
          { key: 'negotiating', label: 'Negociando', color: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/15' },
          { key: 'inactive',    label: 'Inativos',   color: 'text-white/30 bg-white/[0.03] border-white/[0.07]' },
        ].map(s => (
          <div key={s.key} className={`p-3 rounded-2xl border text-center ${s.color}`}>
            <p className="text-xl font-bold">{statusCounts[s.key] ?? 0}</p>
            <p className="text-[10px] opacity-60 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/25" />
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Buscar parceiro, cidade, contato..."
          className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl pl-9 pr-4 py-2.5 text-white placeholder-white/20 text-sm outline-none focus:border-teal-500/40 transition-all" />
      </div>

      <div className="grid lg:grid-cols-[1fr_340px] gap-4">
        <div className="space-y-2">
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-20 bg-white/[0.02] rounded-2xl animate-pulse" />
            ))
          ) : partners.length === 0 ? (
            <div className="py-16 text-center bg-white/[0.02] border border-white/[0.06] rounded-2xl">
              <Building2 className="w-8 h-8 text-white/10 mx-auto mb-2" />
              <p className="text-white/20 text-sm">Nenhum parceiro encontrado</p>
              <button onClick={() => setShowForm(true)}
                className="mt-3 text-teal-400/60 hover:text-teal-400 text-xs underline transition-colors">
                Cadastrar primeiro parceiro
              </button>
            </div>
          ) : (
            partners.map(p => {
              const status = p.status ?? 'inactive';
              return (
                <button key={p.id} onClick={() => setSelected(p)}
                  className={`w-full text-left bg-white/[0.02] border rounded-2xl p-4 hover:border-white/[0.15] transition-all ${selected?.id === p.id ? 'border-teal-500/30 bg-teal-500/[0.04]' : 'border-white/[0.07]'}`}>
                  <div className="flex items-start justify-between mb-1.5">
                    <div className="min-w-0">
                      <p className="text-white/80 font-semibold text-sm truncate">{p.name}</p>
                      <p className="text-white/30 text-xs mt-0.5">{TYPE_LABEL[p.type] ?? p.type}</p>
                    </div>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border flex-shrink-0 ml-2 ${STATUS_STYLE[status]}`}>
                      {STATUS_LABEL[status] ?? status}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-white/25">
                    <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{p.city}</span>
                    <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{p.email}</span>
                  </div>
                </button>
              );
            })
          )}
        </div>

        {selected ? (
          <div className="bg-white/[0.02] border border-white/[0.07] rounded-2xl p-5 h-fit sticky top-6">
            <div className="flex items-start justify-between mb-4">
              <div className="min-w-0">
                <p className="text-white font-bold text-base truncate">{selected.name}</p>
                <p className="text-white/30 text-sm">{TYPE_LABEL[selected.type] ?? selected.type}</p>
              </div>
              <button onClick={() => setSelected(null)} className="text-white/20 hover:text-white transition-colors flex-shrink-0 ml-2">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-3 mb-5">
              {[
                { icon: Users,  label: 'Contato',  value: selected.contact },
                { icon: Mail,   label: 'E-mail',   value: selected.email },
                { icon: Phone,  label: 'Telefone', value: selected.phone ?? '—' },
                { icon: MapPin, label: 'Cidade',   value: selected.city },
              ].map(({ icon: Icon, label, value }) => (
                <div key={label} className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-lg bg-white/[0.04] flex items-center justify-center flex-shrink-0">
                    <Icon className="w-3.5 h-3.5 text-white/40" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-white/20 text-[10px] uppercase tracking-wider">{label}</p>
                    <p className="text-white/70 text-sm truncate">{value}</p>
                  </div>
                </div>
              ))}
              {selected.notes && (
                <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-3">
                  <p className="text-white/20 text-[10px] uppercase tracking-wider mb-1">Notas</p>
                  <p className="text-white/50 text-xs leading-relaxed">{selected.notes}</p>
                </div>
              )}
            </div>
            <a href={`mailto:${selected.email}`}
              className="w-full flex items-center justify-center gap-2 bg-teal-500/10 hover:bg-teal-500/20 border border-teal-500/20 text-teal-400 text-sm py-2.5 rounded-xl transition-all">
              <Mail className="w-4 h-4" /> Enviar e-mail
            </a>
          </div>
        ) : (
          <div className="bg-white/[0.02] border border-white/[0.07] rounded-2xl p-8 flex flex-col items-center justify-center text-center">
            <Building2 className="w-10 h-10 text-white/10 mb-3" />
            <p className="text-white/20 text-sm">Selecione um parceiro para ver detalhes</p>
          </div>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-[#0d1420] border border-white/[0.1] rounded-3xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-white font-bold text-base">Novo parceiro B2B</h3>
              <button onClick={() => setShowForm(false)} className="text-white/30 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="text-white/40 text-xs font-medium block mb-1.5">Nome da empresa *</label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Ex: Hospital São Lucas"
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2.5 text-white text-sm placeholder-white/20 outline-none focus:border-teal-500/40 transition-all" />
              </div>
              <div>
                <label className="text-white/40 text-xs font-medium block mb-1.5">Tipo *</label>
                <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2.5 text-white text-sm outline-none focus:border-teal-500/40 transition-all">
                  {Object.entries(TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div>
                <label className="text-white/40 text-xs font-medium block mb-1.5">Cidade *</label>
                <input value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))}
                  placeholder="São Paulo"
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2.5 text-white text-sm placeholder-white/20 outline-none focus:border-teal-500/40 transition-all" />
              </div>
              <div>
                <label className="text-white/40 text-xs font-medium block mb-1.5">Nome do contato *</label>
                <input value={form.contact} onChange={e => setForm(f => ({ ...f, contact: e.target.value }))}
                  placeholder="João Silva"
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2.5 text-white text-sm placeholder-white/20 outline-none focus:border-teal-500/40 transition-all" />
              </div>
              <div>
                <label className="text-white/40 text-xs font-medium block mb-1.5">E-mail *</label>
                <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  placeholder="contato@empresa.com"
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2.5 text-white text-sm placeholder-white/20 outline-none focus:border-teal-500/40 transition-all" />
              </div>
              <div>
                <label className="text-white/40 text-xs font-medium block mb-1.5">Telefone</label>
                <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                  placeholder="(11) 99999-9999"
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2.5 text-white text-sm placeholder-white/20 outline-none focus:border-teal-500/40 transition-all" />
              </div>
              <div className="col-span-2">
                <label className="text-white/40 text-xs font-medium block mb-1.5">Notas internas</label>
                <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  rows={3} placeholder="Observações sobre o parceiro..."
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2.5 text-white text-sm placeholder-white/20 outline-none focus:border-teal-500/40 transition-all resize-none" />
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <button onClick={() => setShowForm(false)}
                className="flex-1 py-2.5 bg-white/[0.04] hover:bg-white/[0.07] border border-white/[0.08] rounded-xl text-white/50 hover:text-white text-sm transition-all">
                Cancelar
              </button>
              <button onClick={handleCreate} disabled={saving}
                className="flex-1 py-2.5 bg-teal-500 hover:bg-teal-400 text-white text-sm font-semibold rounded-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                {saving ? 'Salvando...' : 'Cadastrar parceiro'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
