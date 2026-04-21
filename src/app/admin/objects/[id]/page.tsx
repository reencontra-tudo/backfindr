'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Save, Trash2, ExternalLink, Package, MapPin, User, QrCode } from 'lucide-react';
import { api, parseApiError } from '@/lib/api';
import { toast } from 'sonner';

const STATUS_OPTIONS = [
  { value: 'lost',     label: 'Perdido',     color: 'text-red-400' },
  { value: 'found',    label: 'Achado',      color: 'text-teal-400' },
  { value: 'returned', label: 'Recuperado',  color: 'text-green-400' },
  { value: 'stolen',   label: 'Roubado',     color: 'text-orange-400' },
  { value: 'archived', label: 'Arquivado',   color: 'text-white/30' },
];

const CATEGORY_OPTIONS = [
  'phone','wallet','keys','bag','pet','bike','document','jewelry','electronics','clothing','other'
];

interface ObjectDetail {
  id: string; title: string; description: string; status: string; category: string;
  qr_code: string; location: string; latitude: number | null; longitude: number | null;
  images: string[]; color: string; brand: string; breed: string;
  is_legacy: boolean; source: string;
  reward_amount: number | null; reward_description: string | null;
  created_at: string; updated_at: string;
  owner_name: string; owner_email: string;
}

export default function AdminObjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [obj, setObj] = useState<ObjectDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ status: '', title: '', description: '', color: '', brand: '', breed: '', reward_amount: '', reward_description: '' });

  useEffect(() => {
    api.get(`/admin/objects/${id}`)
      .then(r => {
        setObj(r.data);
        setForm({
          status: r.data.status || '',
          title: r.data.title || '',
          description: r.data.description || '',
          color: r.data.color || '',
          brand: r.data.brand || '',
          breed: r.data.breed || '',
          reward_amount: r.data.reward_amount != null ? String(r.data.reward_amount) : '',
          reward_description: r.data.reward_description || '',
        });
      })
      .catch(() => toast.error('Erro ao carregar objeto'))
      .finally(() => setLoading(false));
  }, [id]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        status: form.status,
        title: form.title,
        description: form.description,
        color: form.color || null,
        brand: form.brand || null,
        breed: form.breed || null,
        reward_amount: form.reward_amount ? parseFloat(form.reward_amount) : null,
        reward_description: form.reward_description || null,
      };
      await api.patch(`/admin/objects/${id}`, payload);
      toast.success('Objeto atualizado');
      router.push('/admin/objects');
    } catch (e) { toast.error(parseApiError(e)); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!confirm('Remover este objeto permanentemente?')) return;
    try {
      await api.delete(`/admin/objects/${id}`);
      toast.success('Objeto removido');
      router.push('/admin/objects');
    } catch (e) { toast.error(parseApiError(e)); }
  };

  if (loading) return (
    <div className="p-6 flex items-center justify-center min-h-[60vh]">
      <div className="w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (!obj) return (
    <div className="p-6 text-center text-white/40">Objeto não encontrado</div>
  );

  const statusColor = STATUS_OPTIONS.find(s => s.value === obj.status)?.color ?? 'text-white/40';

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="p-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] transition-all">
          <ArrowLeft className="w-4 h-4 text-white/60" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold text-white truncate">{obj.title}</h1>
          <p className="text-white/30 text-xs font-mono">{obj.qr_code}</p>
        </div>
        <button onClick={() => window.open(`/objeto/${obj.qr_code}`, '_blank')}
          className="p-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] transition-all" title="Ver página pública">
          <ExternalLink className="w-4 h-4 text-white/60" />
        </button>
      </div>

      {/* Dono */}
      <div className="bg-white/[0.04] rounded-2xl p-4 flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-teal-500/20 flex items-center justify-center flex-shrink-0">
          <User className="w-4 h-4 text-teal-400" />
        </div>
        <div>
          <p className="text-white text-sm font-medium">{obj.owner_name || 'Sem nome'}</p>
          <p className="text-white/40 text-xs">{obj.owner_email}</p>
        </div>
        {obj.is_legacy && (
          <span className="ml-auto text-[10px] bg-purple-500/20 text-purple-400 px-2 py-0.5 rounded-full">Webjetos</span>
        )}
      </div>

      {/* Fotos */}
      {obj.images && obj.images.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {obj.images.map((img, i) => (
            <img key={i} src={img} alt="" className="w-20 h-20 rounded-xl object-cover flex-shrink-0 bg-white/[0.06]" />
          ))}
        </div>
      )}

      {/* Formulário de edição */}
      <div className="bg-white/[0.04] rounded-2xl p-4 space-y-4">
        <h2 className="text-white/60 text-xs font-semibold uppercase tracking-wider">Editar dados</h2>

        {/* Status */}
        <div>
          <label className="text-white/40 text-xs mb-1.5 block">Status</label>
          <div className="flex flex-wrap gap-2">
            {STATUS_OPTIONS.map(s => (
              <button key={s.value} onClick={() => setForm(f => ({ ...f, status: s.value }))}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all border ${
                  form.status === s.value
                    ? 'border-teal-500 bg-teal-500/10 text-teal-400'
                    : 'border-white/[0.08] text-white/40 hover:text-white'
                }`}>
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Título */}
        <div>
          <label className="text-white/40 text-xs mb-1.5 block">Título</label>
          <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            className="w-full bg-white/[0.06] border border-white/[0.08] rounded-xl px-3 py-2.5 text-white text-sm outline-none focus:border-teal-500/50 transition-all" />
        </div>

        {/* Descrição */}
        <div>
          <label className="text-white/40 text-xs mb-1.5 block">Descrição</label>
          <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            rows={3}
            className="w-full bg-white/[0.06] border border-white/[0.08] rounded-xl px-3 py-2.5 text-white text-sm outline-none focus:border-teal-500/50 transition-all resize-none" />
        </div>

        {/* Cor / Marca / Raça */}
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="text-white/40 text-xs mb-1.5 block">Cor</label>
            <input value={form.color} onChange={e => setForm(f => ({ ...f, color: e.target.value }))}
              placeholder="Ex: preto"
              className="w-full bg-white/[0.06] border border-white/[0.08] rounded-xl px-3 py-2.5 text-white text-sm outline-none focus:border-teal-500/50 transition-all" />
          </div>
          <div>
            <label className="text-white/40 text-xs mb-1.5 block">Marca</label>
            <input value={form.brand} onChange={e => setForm(f => ({ ...f, brand: e.target.value }))}
              placeholder="Ex: Samsung"
              className="w-full bg-white/[0.06] border border-white/[0.08] rounded-xl px-3 py-2.5 text-white text-sm outline-none focus:border-teal-500/50 transition-all" />
          </div>
          <div>
            <label className="text-white/40 text-xs mb-1.5 block">Raça/Tipo</label>
            <input value={form.breed} onChange={e => setForm(f => ({ ...f, breed: e.target.value }))}
              placeholder="Ex: Labrador"
              className="w-full bg-white/[0.06] border border-white/[0.08] rounded-xl px-3 py-2.5 text-white text-sm outline-none focus:border-teal-500/50 transition-all" />
          </div>
        </div>

        {/* Recompensa */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-white/40 text-xs mb-1.5 block">Recompensa (R$)</label>
            <input type="number" value={form.reward_amount} onChange={e => setForm(f => ({ ...f, reward_amount: e.target.value }))}
              placeholder="0.00"
              className="w-full bg-white/[0.06] border border-white/[0.08] rounded-xl px-3 py-2.5 text-white text-sm outline-none focus:border-teal-500/50 transition-all" />
          </div>
          <div>
            <label className="text-white/40 text-xs mb-1.5 block">Descrição da recompensa</label>
            <input value={form.reward_description} onChange={e => setForm(f => ({ ...f, reward_description: e.target.value }))}
              placeholder="Detalhes..."
              className="w-full bg-white/[0.06] border border-white/[0.08] rounded-xl px-3 py-2.5 text-white text-sm outline-none focus:border-teal-500/50 transition-all" />
          </div>
        </div>
      </div>

      {/* Localização */}
      {(obj.latitude || obj.location) && (
        <div className="bg-white/[0.04] rounded-2xl p-4 flex items-center gap-3">
          <MapPin className="w-4 h-4 text-white/30 flex-shrink-0" />
          <div>
            <p className="text-white/60 text-xs">{obj.location || `${obj.latitude}, ${obj.longitude}`}</p>
            {obj.latitude && obj.longitude && (
              <a href={`https://maps.google.com/?q=${obj.latitude},${obj.longitude}`} target="_blank" rel="noreferrer"
                className="text-teal-400 text-xs hover:underline">Ver no mapa →</a>
            )}
          </div>
        </div>
      )}

      {/* Metadados */}
      <div className="bg-white/[0.04] rounded-2xl p-4 space-y-2">
        <h2 className="text-white/60 text-xs font-semibold uppercase tracking-wider mb-3">Metadados</h2>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div><span className="text-white/30">Categoria:</span> <span className="text-white/60">{obj.category}</span></div>
          <div><span className="text-white/30">Origem:</span> <span className="text-white/60">{obj.source || 'backfindr'}</span></div>
          <div><span className="text-white/30">Criado:</span> <span className="text-white/60">{new Date(obj.created_at).toLocaleDateString('pt-BR')}</span></div>
          <div><span className="text-white/30">Atualizado:</span> <span className="text-white/60">{new Date(obj.updated_at).toLocaleDateString('pt-BR')}</span></div>
        </div>
      </div>

      {/* Ações */}
      <div className="flex gap-3 pb-6">
        <button onClick={handleSave} disabled={saving}
          className="flex-1 flex items-center justify-center gap-2 bg-teal-500 hover:bg-teal-400 disabled:opacity-50 text-black font-semibold py-3 rounded-2xl transition-all text-sm">
          <Save className="w-4 h-4" />
          {saving ? 'Salvando...' : 'Salvar alterações'}
        </button>
        <button onClick={handleDelete}
          className="px-4 flex items-center justify-center bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-2xl transition-all">
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
