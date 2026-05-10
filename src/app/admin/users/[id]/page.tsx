'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Save, User, Package, Shield, CheckCircle, XCircle, Crown } from 'lucide-react';
import { api, parseApiError } from '@/lib/api';
import { toast } from 'sonner';

const PLAN_OPTIONS = [
  { value: 'free',     label: 'Free',     color: 'text-white/60' },
  { value: 'pro',      label: 'Pro',      color: 'text-yellow-400' },
  { value: 'business', label: 'Business', color: 'text-purple-400' },
];

interface UserObject {
  id: string; title: string; status: string; category: string; qr_code: string;
  created_at: string; updated_at: string;
}

interface UserDetail {
  id: string; email: string; name: string; phone: string;
  plan: string; is_verified: boolean; avatar_url: string | null;
  created_at: string; updated_at: string;
  objects: { items: UserObject[]; total: number };
}

const STATUS_COLORS: Record<string, string> = {
  lost: 'text-red-400', found: 'text-teal-400', returned: 'text-green-400',
  stolen: 'text-orange-400', archived: 'text-white/30',
};
const STATUS_LABELS: Record<string, string> = {
  lost: 'Perdido', found: 'Achado', returned: 'Recuperado', stolen: 'Roubado', archived: 'Arquivado',
};

export default function AdminUserDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [user, setUser] = useState<UserDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ plan: '', is_active: true });

  useEffect(() => {
    api.get(`/admin/users/${id}`)
      .then(r => {
        setUser(r.data);
        setForm({ plan: r.data.plan || 'free', is_active: r.data.is_active !== false });
      })
      .catch(() => toast.error('Erro ao carregar usuário'))
      .finally(() => setLoading(false));
  }, [id]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.patch(`/admin/users/${id}`, { plan: form.plan, is_active: form.is_active });
      toast.success('Usuário atualizado');
      router.push('/admin/users');
    } catch (e) { toast.error(parseApiError(e)); }
    finally { setSaving(false); }
  };

  if (loading) return (
    <div className="p-6 flex items-center justify-center min-h-[60vh]">
      <div className="w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (!user) return (
    <div className="p-6 text-center text-white/40">Usuário não encontrado</div>
  );

  const planColor = PLAN_OPTIONS.find(p => p.value === user.plan)?.color ?? 'text-white/60';

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="p-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] transition-all">
          <ArrowLeft className="w-4 h-4 text-white/60" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold text-white truncate">{user.name || 'Sem nome'}</h1>
          <p className="text-white/30 text-xs">{user.email}</p>
        </div>
        <span className={`text-xs font-semibold uppercase tracking-wider ${planColor}`}>
          {user.plan}
        </span>
      </div>

      {/* Avatar + info */}
      <div className="bg-white/[0.04] rounded-2xl p-4 flex items-center gap-4">
        {user.avatar_url ? (
          <img src={user.avatar_url} alt="" className="w-14 h-14 rounded-full object-cover bg-white/[0.06]" />
        ) : (
          <div className="w-14 h-14 rounded-full bg-teal-500/20 flex items-center justify-center flex-shrink-0">
            <User className="w-6 h-6 text-teal-400" />
          </div>
        )}
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center gap-2">
            <p className="text-white text-sm font-medium truncate">{user.name || 'Sem nome'}</p>
            {user.is_verified ? (
              <CheckCircle className="w-3.5 h-3.5 text-teal-400 flex-shrink-0" />
            ) : (
              <XCircle className="w-3.5 h-3.5 text-white/20 flex-shrink-0" />
            )}
          </div>
          <p className="text-white/40 text-xs truncate">{user.email}</p>
          {user.phone && <p className="text-white/40 text-xs">{user.phone}</p>}
        </div>
      </div>

      {/* Formulário de edição */}
      <div className="bg-white/[0.04] rounded-2xl p-4 space-y-4">
        <h2 className="text-white/60 text-xs font-semibold uppercase tracking-wider">Editar conta</h2>

        {/* Plano */}
        <div>
          <label className="text-white/40 text-xs mb-1.5 block flex items-center gap-1">
            <Crown className="w-3 h-3" /> Plano
          </label>
          <div className="flex flex-wrap gap-2">
            {PLAN_OPTIONS.map(p => (
              <button key={p.value} onClick={() => setForm(f => ({ ...f, plan: p.value }))}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all border ${
                  form.plan === p.value
                    ? 'border-teal-500 bg-teal-500/10 text-teal-400'
                    : 'border-white/[0.08] text-white/40 hover:text-white'
                }`}>
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Status da conta */}
        <div>
          <label className="text-white/40 text-xs mb-1.5 block flex items-center gap-1">
            <Shield className="w-3 h-3" /> Status da conta
          </label>
          <div className="flex gap-2">
            <button onClick={() => setForm(f => ({ ...f, is_active: true }))}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all border ${
                form.is_active
                  ? 'border-teal-500 bg-teal-500/10 text-teal-400'
                  : 'border-white/[0.08] text-white/40 hover:text-white'
              }`}>
              Ativa
            </button>
            <button onClick={() => setForm(f => ({ ...f, is_active: false }))}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all border ${
                !form.is_active
                  ? 'border-red-500 bg-red-500/10 text-red-400'
                  : 'border-white/[0.08] text-white/40 hover:text-white'
              }`}>
              Inativa
            </button>
          </div>
        </div>
      </div>

      {/* Objetos do usuário */}
      <div className="bg-white/[0.04] rounded-2xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-white/60 text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5">
            <Package className="w-3.5 h-3.5" /> Objetos ({user.objects.total})
          </h2>
        </div>
        {user.objects.items.length === 0 ? (
          <p className="text-white/20 text-xs text-center py-4">Nenhum objeto cadastrado</p>
        ) : (
          <div className="space-y-2">
            {user.objects.items.map(obj => (
              <div key={obj.id}
                onClick={() => router.push(`/admin/objects/${obj.id}`)}
                className="flex items-center gap-3 p-2.5 rounded-xl bg-white/[0.03] hover:bg-white/[0.06] cursor-pointer transition-all">
                <div className="flex-1 min-w-0">
                  <p className="text-white text-xs font-medium truncate">{obj.title}</p>
                  <p className="text-white/30 text-[10px] font-mono">{obj.qr_code}</p>
                </div>
                <span className={`text-[10px] font-medium ${STATUS_COLORS[obj.status] ?? 'text-white/40'}`}>
                  {STATUS_LABELS[obj.status] ?? obj.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Metadados */}
      <div className="bg-white/[0.04] rounded-2xl p-4 space-y-2">
        <h2 className="text-white/60 text-xs font-semibold uppercase tracking-wider mb-3">Metadados</h2>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div><span className="text-white/30">Criado:</span> <span className="text-white/60">{new Date(user.created_at).toLocaleDateString('pt-BR')}</span></div>
          <div><span className="text-white/30">Atualizado:</span> <span className="text-white/60">{new Date(user.updated_at).toLocaleDateString('pt-BR')}</span></div>
          <div><span className="text-white/30">Verificado:</span> <span className={user.is_verified ? 'text-teal-400' : 'text-white/30'}>{user.is_verified ? 'Sim' : 'Não'}</span></div>
          <div><span className="text-white/30">ID:</span> <span className="text-white/30 font-mono text-[10px]">{user.id.slice(0, 8)}…</span></div>
        </div>
      </div>

      {/* Ações */}
      <div className="pb-6">
        <button onClick={handleSave} disabled={saving}
          className="w-full flex items-center justify-center gap-2 bg-teal-500 hover:bg-teal-400 disabled:opacity-50 text-black font-semibold py-3 rounded-2xl transition-all text-sm">
          <Save className="w-4 h-4" />
          {saving ? 'Salvando...' : 'Salvar alterações'}
        </button>
      </div>
    </div>
  );
}
