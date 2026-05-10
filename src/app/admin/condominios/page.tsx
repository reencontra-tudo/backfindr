'use client';

import { useState, useEffect } from 'react';
import {
  Building2, Plus, Search, CheckCircle2, XCircle,
  Loader2, ExternalLink, Package, Users, Copy
} from 'lucide-react';
import { toast } from 'sonner';
import { api, parseApiError } from '@/lib/api';
import Cookies from 'js-cookie';

interface Condominio {
  id: string; nome: string; slug: string; cidade: string; estado: string;
  total_unidades: number; active: boolean; created_at: string;
  parceiro_nome: string | null;
}

interface NovoCondominio {
  nome: string; slug: string; endereco: string; cidade: string;
  estado: string; cep: string; total_unidades: string;
}

const ESTADOS_BR = [
  'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS',
  'MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO',
];

function slugify(str: string) {
  return str
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

export default function AdminCondominiosPage() {
  const [condominios, setCondominios] = useState<Condominio[]>([]);
  const [loading, setLoading]         = useState(true);
  const [search, setSearch]           = useState('');
  const [total, setTotal]             = useState(0);
  const [showForm, setShowForm]       = useState(false);
  const [saving, setSaving]           = useState(false);

  const [form, setForm] = useState<NovoCondominio>({
    nome: '', slug: '', endereco: '', cidade: '', estado: 'SP',
    cep: '', total_unidades: '0',
  });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://backfindr.com';

  const fetchCondominios = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/portaria/condominios?search=${encodeURIComponent(search)}&size=50`);
      setCondominios(res.data.items);
      setTotal(res.data.total);
    } catch (e) {
      toast.error(parseApiError(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchCondominios(); }, [search]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nome || !form.slug || !form.endereco || !form.cidade) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }
    setSaving(true);
    try {
      await api.post('/portaria/condominios', {
        ...form,
        total_unidades: parseInt(form.total_unidades) || 0,
      });
      toast.success('Condomínio criado com sucesso!');
      setShowForm(false);
      setForm({ nome: '', slug: '', endereco: '', cidade: '', estado: 'SP', cep: '', total_unidades: '0' });
      fetchCondominios();
    } catch (e) {
      toast.error(parseApiError(e));
    } finally {
      setSaving(false);
    }
  };

  const copyLink = async (slug: string) => {
    await navigator.clipboard.writeText(`${appUrl}/condominio/${slug}`);
    toast.success('Link copiado!');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-white text-2xl font-bold">Condomínios</h1>
          <p className="text-white/40 text-sm">{total} registrado{total !== 1 ? 's' : ''}</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-teal-500 hover:bg-teal-400 rounded-xl text-white text-sm font-bold transition-colors"
        >
          <Plus className="w-4 h-4" /> Novo condomínio
        </button>
      </div>

      {/* Busca */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por nome ou cidade…"
          className="w-full pl-10 pr-4 py-3 bg-white/[0.04] border border-white/[0.08] rounded-xl text-white placeholder-white/20 text-sm focus:outline-none focus:border-teal-500/40"
        />
      </div>

      {/* Modal de criação */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowForm(false)} />
          <div className="relative w-full max-w-lg bg-[#0f1318] border border-white/[0.08] rounded-2xl overflow-hidden shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-[#0f1318] px-6 py-4 border-b border-white/[0.06] flex items-center justify-between">
              <h2 className="text-white font-bold">Novo condomínio</h2>
              <button onClick={() => setShowForm(false)} className="text-white/40 hover:text-white/70 text-sm">✕</button>
            </div>
            <form onSubmit={handleCreate} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="text-white/50 text-xs mb-1.5 block">Nome *</label>
                  <input
                    value={form.nome}
                    onChange={e => setForm(f => ({ ...f, nome: e.target.value, slug: slugify(e.target.value) }))}
                    placeholder="Edifício Parque das Águas"
                    className="w-full px-3 py-2.5 bg-white/[0.04] border border-white/[0.08] rounded-xl text-white text-sm placeholder-white/20 focus:outline-none focus:border-teal-500/40"
                  />
                </div>
                <div className="col-span-2">
                  <label className="text-white/50 text-xs mb-1.5 block">Slug (URL) *</label>
                  <input
                    value={form.slug}
                    onChange={e => setForm(f => ({ ...f, slug: slugify(e.target.value) }))}
                    placeholder="edificio-parque-das-aguas"
                    className="w-full px-3 py-2.5 bg-white/[0.04] border border-white/[0.08] rounded-xl text-white text-sm placeholder-white/20 focus:outline-none focus:border-teal-500/40 font-mono"
                  />
                  {form.slug && (
                    <p className="text-white/30 text-xs mt-1">→ {appUrl}/condominio/{form.slug}</p>
                  )}
                </div>
                <div className="col-span-2">
                  <label className="text-white/50 text-xs mb-1.5 block">Endereço *</label>
                  <input
                    value={form.endereco}
                    onChange={e => setForm(f => ({ ...f, endereco: e.target.value }))}
                    placeholder="Rua das Flores, 123"
                    className="w-full px-3 py-2.5 bg-white/[0.04] border border-white/[0.08] rounded-xl text-white text-sm placeholder-white/20 focus:outline-none focus:border-teal-500/40"
                  />
                </div>
                <div>
                  <label className="text-white/50 text-xs mb-1.5 block">Cidade *</label>
                  <input
                    value={form.cidade}
                    onChange={e => setForm(f => ({ ...f, cidade: e.target.value }))}
                    placeholder="São Paulo"
                    className="w-full px-3 py-2.5 bg-white/[0.04] border border-white/[0.08] rounded-xl text-white text-sm placeholder-white/20 focus:outline-none focus:border-teal-500/40"
                  />
                </div>
                <div>
                  <label className="text-white/50 text-xs mb-1.5 block">Estado *</label>
                  <select
                    value={form.estado}
                    onChange={e => setForm(f => ({ ...f, estado: e.target.value }))}
                    className="w-full px-3 py-2.5 bg-white/[0.04] border border-white/[0.08] rounded-xl text-white text-sm focus:outline-none focus:border-teal-500/40"
                  >
                    {ESTADOS_BR.map(e => <option key={e} value={e}>{e}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-white/50 text-xs mb-1.5 block">CEP</label>
                  <input
                    value={form.cep}
                    onChange={e => setForm(f => ({ ...f, cep: e.target.value }))}
                    placeholder="00000-000"
                    className="w-full px-3 py-2.5 bg-white/[0.04] border border-white/[0.08] rounded-xl text-white text-sm placeholder-white/20 focus:outline-none focus:border-teal-500/40"
                  />
                </div>
                <div>
                  <label className="text-white/50 text-xs mb-1.5 block">Total de unidades</label>
                  <input
                    type="number" min="0"
                    value={form.total_unidades}
                    onChange={e => setForm(f => ({ ...f, total_unidades: e.target.value }))}
                    className="w-full px-3 py-2.5 bg-white/[0.04] border border-white/[0.08] rounded-xl text-white text-sm focus:outline-none focus:border-teal-500/40"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setShowForm(false)}
                  className="flex-1 py-3 border border-white/[0.10] rounded-xl text-white/60 text-sm font-semibold hover:border-white/20 transition-colors">
                  Cancelar
                </button>
                <button type="submit" disabled={saving}
                  className="flex-1 py-3 bg-teal-500 hover:bg-teal-400 disabled:bg-teal-500/50 rounded-xl text-white text-sm font-bold transition-colors flex items-center justify-center gap-2">
                  {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Criando…</> : 'Criar condomínio'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Lista */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 text-teal-400 animate-spin" />
        </div>
      ) : condominios.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
          <Building2 className="w-10 h-10 text-white/20" />
          <div>
            <p className="text-white font-semibold">Nenhum condomínio cadastrado</p>
            <p className="text-white/40 text-sm mt-1">Crie o primeiro condomínio para começar.</p>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {condominios.map(c => (
            <div key={c.id} className="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-teal-500/10 flex items-center justify-center flex-shrink-0">
                  <Building2 className="w-5 h-5 text-teal-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-white font-bold text-sm">{c.nome}</h3>
                    {c.active
                      ? <CheckCircle2 className="w-3.5 h-3.5 text-teal-400" />
                      : <XCircle className="w-3.5 h-3.5 text-red-400" />}
                    {c.parceiro_nome && (
                      <span className="text-xs px-2 py-0.5 bg-white/[0.05] rounded-full text-white/40">
                        {c.parceiro_nome}
                      </span>
                    )}
                  </div>
                  <p className="text-white/40 text-xs mt-0.5">{c.cidade}, {c.estado} · {c.total_unidades} unidades</p>

                  <div className="flex items-center gap-3 mt-2.5 flex-wrap">
                    <button onClick={() => copyLink(c.slug)}
                      className="flex items-center gap-1.5 text-xs text-teal-400 hover:text-teal-300 transition-colors">
                      <Copy className="w-3 h-3" /> Copiar link
                    </button>
                    <a href={`/portaria/${c.id}`} target="_blank"
                      className="flex items-center gap-1.5 text-xs text-white/30 hover:text-white/60 transition-colors">
                      <ExternalLink className="w-3 h-3" /> PWA porteiro
                    </a>
                    <a href={`/condominio/${c.slug}`} target="_blank"
                      className="flex items-center gap-1.5 text-xs text-white/30 hover:text-white/60 transition-colors">
                      <Users className="w-3 h-3" /> Pág. morador
                    </a>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
