'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ChevronLeft, Save, Loader2, MapPin, Tag, FileText, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import { objectsApi } from '@/lib/api';
import { LocationPicker } from '@/components/ui/LocationPicker';
import type { RegisteredObject, ObjectCategory, ObjectStatus } from '@/types';

const CATEGORY_OPTIONS: { value: ObjectCategory; label: string; emoji: string }[] = [
  { value: 'phone',       label: 'Celular',        emoji: '📱' },
  { value: 'wallet',      label: 'Carteira',       emoji: '👛' },
  { value: 'keys',        label: 'Chaves',         emoji: '🔑' },
  { value: 'bag',         label: 'Bolsa / Mochila',emoji: '🎒' },
  { value: 'pet',         label: 'Pet',            emoji: '🐾' },
  { value: 'bike',        label: 'Bicicleta',      emoji: '🚲' },
  { value: 'vehicle',     label: 'Veículo',        emoji: '🚗' },
  { value: 'document',    label: 'Documento',      emoji: '📄' },
  { value: 'jewelry',     label: 'Joias',          emoji: '💍' },
  { value: 'electronics', label: 'Eletrônico',     emoji: '💻' },
  { value: 'clothing',    label: 'Roupa',          emoji: '👕' },
  { value: 'other',       label: 'Outro',          emoji: '📦' },
];

const STATUS_OPTIONS: { value: ObjectStatus; label: string; color: string }[] = [
  { value: 'lost',     label: 'Perdido',   color: 'text-red-400' },
  { value: 'found',    label: 'Achado',    color: 'text-green-400' },
  { value: 'returned', label: 'Devolvido', color: 'text-brand-400' },
  { value: 'stolen',   label: 'Roubado',   color: 'text-orange-400' },
];

export default function EditObjectPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [obj, setObj] = useState<RegisteredObject | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  // Campos editáveis
  const [title, setTitle]               = useState('');
  const [description, setDescription]   = useState('');
  const [category, setCategory]         = useState<ObjectCategory>('other');
  const [status, setStatus]             = useState<ObjectStatus>('lost');
  const [rewardAmount, setRewardAmount] = useState('');
  const [rewardDesc, setRewardDesc]     = useState('');
  const [locationVal, setLocationVal]   = useState<{ address: string; lat?: number; lng?: number }>({ address: '' });

  // ── Carregar objeto ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!id) return;
    objectsApi.get(id)
      .then((res) => {
        const o = res.data as RegisteredObject;
        setObj(o);
        setTitle(o.title ?? '');
        setDescription(o.description ?? '');
        setCategory(o.category ?? 'other');
        setStatus(o.status ?? 'lost');
        setRewardAmount(o.reward_amount != null ? String(o.reward_amount) : '');
        setRewardDesc(o.reward_description ?? '');
        setLocationVal({
          address: o.location?.address ?? '',
          lat: o.location?.lat,
          lng: o.location?.lng,
        });
      })
      .catch(() => setError('Não foi possível carregar o objeto.'))
      .finally(() => setLoading(false));
  }, [id]);

  // ── Salvar ───────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!title.trim()) { setError('O título é obrigatório.'); return; }
    setSaving(true);
    setError('');
    try {
      await objectsApi.update(id, {
        title:              title.trim(),
        description:        description.trim(),
        category,
        status,
        location:           locationVal.address || undefined,
        latitude:           locationVal.lat ?? undefined,
        longitude:          locationVal.lng ?? undefined,
        reward_amount:      rewardAmount ? parseFloat(rewardAmount) : null,
        reward_description: rewardDesc.trim() || null,
      });
      setSuccess(true);
      setTimeout(() => router.push(`/dashboard/objects/${id}`), 1200);
    } catch {
      setError('Erro ao salvar. Tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-brand-400 animate-spin" />
      </div>
    );
  }

  if (!obj) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-6">
        <AlertCircle className="w-10 h-10 text-red-400" />
        <p className="text-slate-300 text-center">Objeto não encontrado ou sem permissão.</p>
        <Link href="/dashboard/objects" className="text-brand-400 text-sm underline">Voltar para meus objetos</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-24">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-background/80 backdrop-blur border-b border-surface-border px-4 py-3 flex items-center gap-3">
        <Link
          href={`/dashboard/objects/${id}`}
          className="w-9 h-9 glass rounded-lg flex items-center justify-center text-slate-400 hover:text-white transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
        </Link>
        <div className="flex-1">
          <h1 className="font-display font-bold text-white text-base leading-tight">Editar objeto</h1>
          <p className="text-slate-500 text-xs truncate">{obj.title}</p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving || success}
          className="flex items-center gap-2 px-4 py-2 bg-brand-500 hover:bg-brand-400 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {success ? 'Salvo!' : 'Salvar'}
        </button>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Erro */}
        {error && (
          <div className="flex items-center gap-3 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-red-400 text-sm">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        )}

        {/* Título */}
        <div className="glass rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <FileText className="w-4 h-4 text-brand-400" />
            <h2 className="font-display font-semibold text-white text-sm">Informações básicas</h2>
          </div>

          <div>
            <label className="block text-xs text-slate-400 font-medium mb-1.5">Título *</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: iPhone 14 Pro preto"
              className="w-full bg-surface border border-surface-border rounded-xl px-4 py-3 text-slate-100 placeholder-slate-500 text-sm outline-none focus:border-brand-500 transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs text-slate-400 font-medium mb-1.5">Descrição</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Detalhes que ajudam a identificar o objeto..."
              className="w-full bg-surface border border-surface-border rounded-xl px-4 py-3 text-slate-100 placeholder-slate-500 text-sm outline-none focus:border-brand-500 transition-colors resize-none"
            />
          </div>
        </div>

        {/* Categoria e Status */}
        <div className="glass rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <Tag className="w-4 h-4 text-brand-400" />
            <h2 className="font-display font-semibold text-white text-sm">Categoria e status</h2>
          </div>

          <div>
            <label className="block text-xs text-slate-400 font-medium mb-2">Categoria</label>
            <div className="grid grid-cols-3 gap-2">
              {CATEGORY_OPTIONS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setCategory(c.value)}
                  className={`flex flex-col items-center gap-1 py-2.5 px-2 rounded-xl border text-xs font-medium transition-all ${
                    category === c.value
                      ? 'border-brand-500 bg-brand-500/10 text-brand-400'
                      : 'border-surface-border text-slate-400 hover:text-white hover:border-white/20'
                  }`}
                >
                  <span className="text-lg">{c.emoji}</span>
                  <span>{c.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs text-slate-400 font-medium mb-2">Status</label>
            <div className="grid grid-cols-2 gap-2">
              {STATUS_OPTIONS.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => setStatus(s.value)}
                  className={`py-2.5 px-4 rounded-xl border text-sm font-medium transition-all ${
                    status === s.value
                      ? 'border-brand-500 bg-brand-500/10 text-brand-400'
                      : 'border-surface-border text-slate-400 hover:text-white hover:border-white/20'
                  }`}
                >
                  <span className={status === s.value ? 'text-brand-400' : s.color}>{s.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Localização */}
        <div className="glass rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <MapPin className="w-4 h-4 text-brand-400" />
            <h2 className="font-display font-semibold text-white text-sm">Localização</h2>
            <span className="text-xs text-slate-500 ml-auto">Onde ocorreu?</span>
          </div>
          <LocationPicker
            value={locationVal}
            onChange={(v) => setLocationVal(v)}
            placeholder="Buscar endereço, bairro ou ponto de referência..."
          />
        </div>

        {/* Recompensa */}
        <div className="glass rounded-2xl p-5 space-y-4">
          <h2 className="font-display font-semibold text-white text-sm">Recompensa (opcional)</h2>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-400 font-medium mb-1.5">Valor (R$)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={rewardAmount}
                onChange={(e) => setRewardAmount(e.target.value)}
                placeholder="0,00"
                className="w-full bg-surface border border-surface-border rounded-xl px-4 py-3 text-slate-100 placeholder-slate-500 text-sm outline-none focus:border-brand-500 transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 font-medium mb-1.5">Descrição</label>
              <input
                value={rewardDesc}
                onChange={(e) => setRewardDesc(e.target.value)}
                placeholder="Ex: Gratidão garantida"
                className="w-full bg-surface border border-surface-border rounded-xl px-4 py-3 text-slate-100 placeholder-slate-500 text-sm outline-none focus:border-brand-500 transition-colors"
              />
            </div>
          </div>
        </div>

        {/* Botão salvar (bottom) */}
        <button
          onClick={handleSave}
          disabled={saving || success}
          className="w-full flex items-center justify-center gap-2 py-4 bg-brand-500 hover:bg-brand-400 disabled:opacity-50 text-white font-semibold rounded-2xl transition-colors"
        >
          {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
          {success ? 'Salvo com sucesso!' : 'Salvar alterações'}
        </button>
      </div>
    </div>
  );
}
