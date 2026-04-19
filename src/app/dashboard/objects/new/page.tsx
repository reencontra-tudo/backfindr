'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import {
  ChevronLeft, ChevronRight, Loader2, Upload,
  MapPin, Package, Info, Check, Gift
} from 'lucide-react';
import axios from 'axios';
import { objectsApi, parseApiError } from '@/lib/api';
import { compressImages } from '@/lib/compressImage';
import { ObjectCategory, ObjectStatus } from '@/types';

// ─── Schema ──────────────────────────────────────────────────────────────────
const schema = z.object({
  title: z.string().min(3, 'Título muito curto').max(100),
  description: z.string().min(10, 'Descrição muito curta').max(2000),
  category: z.string().min(1, 'Selecione uma categoria'),
  status: z.string().min(1, 'Selecione o status'),
  lat: z.number().optional(),
  lng: z.number().optional(),
  address: z.string().optional(),
  pet_species: z.string().optional(),
  pet_breed: z.string().optional(),
  pet_microchip: z.string().optional(),
  pet_color: z.string().optional(),
  reward_amount: z.number().min(0).optional().nullable(),
  reward_description: z.string().max(500).optional().nullable(),
});

type FormData = z.infer<typeof schema>;

// ─── Options ─────────────────────────────────────────────────────────────────
const CATEGORIES: { value: ObjectCategory; label: string; emoji: string }[] = [
  { value: 'pet', label: 'Pet / Animal', emoji: '🐾' },
  { value: 'phone', label: 'Celular', emoji: '📱' },
  { value: 'wallet', label: 'Carteira', emoji: '👛' },
  { value: 'keys', label: 'Chaves', emoji: '🔑' },
  { value: 'bag', label: 'Bolsa / Mochila', emoji: '🎒' },
  { value: 'bike', label: 'Bicicleta', emoji: '🚲' },
  { value: 'document', label: 'Documento', emoji: '📄' },
  { value: 'jewelry', label: 'Joia / Relógio', emoji: '💍' },
  { value: 'electronics', label: 'Eletrônico', emoji: '💻' },
  { value: 'other', label: 'Outro', emoji: '📦' },
];

const STATUSES: { value: ObjectStatus; label: string; desc: string; color: string }[] = [
  { value: 'lost', label: 'Perdi', desc: 'Quero encontrá-lo', color: 'border-red-500/40 text-red-400 bg-red-500/5' },
  { value: 'found', label: 'Encontrei', desc: 'Quero devolver ao dono', color: 'border-brand-500/40 text-brand-400 bg-brand-500/5' },
  { value: 'stolen', label: 'Fui roubado', desc: 'Registrar como roubado', color: 'border-orange-500/40 text-orange-400 bg-orange-500/5' },
];

const STEPS = ['Categoria', 'Status', 'Detalhes', 'Localização'];

// ─── Component ────────────────────────────────────────────────────────────────
export default function NewObjectPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [photos, setPhotos] = useState<File[]>([]);
  const [compressing, setCompressing] = useState(false);
  const [offerReward, setOfferReward] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const category = watch('category');
  const status = watch('status');
  const isPet = category === 'pet';

  const nextStep = () => setStep((s) => Math.min(s + 1, STEPS.length - 1));
  const prevStep = () => setStep((s) => Math.max(s - 1, 0));

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []).slice(0, 5);
    if (files.length === 0) return;
    setCompressing(true);
    try {
      const compressed = await compressImages(files);
      setPhotos(compressed);
      const saved = files.reduce((acc, f) => acc + f.size, 0) - compressed.reduce((acc, f) => acc + f.size, 0);
      if (saved > 10_000) {
        toast.success(`Fotos otimizadas! Economia de ${(saved / 1024).toFixed(0)} KB`);
      }
    } catch {
      setPhotos(files);
    } finally {
      setCompressing(false);
    }
  };

  const onSubmit = async (data: FormData) => {
    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        title: data.title,
        description: data.description,
        category: data.category,
        status: data.status,
        latitude: data.lat || null,
        longitude: data.lng || null,
        location: data.address || null,
      };

      if (isPet) {
        if (data.pet_species) payload.pet_species = data.pet_species;
        if (data.pet_breed) payload.pet_breed = data.pet_breed;
        if (data.pet_microchip) payload.pet_microchip = data.pet_microchip;
        if (data.pet_color) payload.pet_color = data.pet_color;
      }

      if (offerReward && data.reward_amount) {
        payload.reward_amount = data.reward_amount;
        if (data.reward_description) payload.reward_description = data.reward_description;
      }

      // 1. Criar o objeto (sem imagens para evitar limite de payload)
      const res = await objectsApi.create(payload);
      const objectId = res.data.id;

      // 2. Upload de fotos em etapa separada (evita limite de 4MB do Vercel)
      if (photos.length > 0) {
        try {
          const photoUrls: string[] = [];
          for (const photo of photos) {
            const base64 = await new Promise<string>((resolve) => {
              const reader = new FileReader();
              reader.onload = (e) => resolve(e.target?.result as string);
              reader.readAsDataURL(photo);
            });
            photoUrls.push(base64);
          }
          await objectsApi.uploadImages(objectId, photoUrls);
          toast.success('Objeto registrado com fotos! 🎉');
        } catch {
          // Upload de fotos falhou, mas objeto foi criado
          toast.success('Objeto registrado! (fotos não puderam ser salvas)');
        }
      } else {
        toast.success('Objeto registrado com sucesso! 🎉');
      }

      router.push(`/dashboard/objects/${objectId}`);
    } catch (err) {
      // Tratar erro de limite de plano com redirecionamento para upgrade
      if (axios.isAxiosError(err) && err.response?.data?.error === 'limit_reached') {
        const msg = err.response.data.message ?? 'Limite de objetos atingido.';
        toast.error(msg, {
          action: {
            label: 'Ver planos',
            onClick: () => router.push('/pricing'),
          },
          duration: 8000,
        });
      } else {
        toast.error(parseApiError(err));
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-8 max-w-2xl">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <button
          onClick={() => router.back()}
          className="w-9 h-9 glass rounded-lg flex items-center justify-center text-slate-400 hover:text-white transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <div>
          <h1 className="font-display text-xl font-bold text-white">Registrar Objeto</h1>
          <p className="text-slate-400 text-sm">
            Passo {step + 1} de {STEPS.length} — {STEPS[step]}
          </p>
        </div>
      </div>

      {/* Progress */}
      <div className="flex gap-2 mb-8">
        {STEPS.map((s, i) => (
          <div key={s} className="flex-1 flex flex-col gap-1.5">
            <div
              className={`h-1 rounded-full transition-all duration-300 ${
                i <= step ? 'bg-brand-500' : 'bg-surface-border'
              }`}
            />
            <span
              className={`text-xs ${i === step ? 'text-brand-400' : i < step ? 'text-slate-400' : 'text-slate-600'}`}
            >
              {s}
            </span>
          </div>
        ))}
      </div>

      <form onSubmit={handleSubmit(onSubmit)}>
        {/* Step 0 — Category */}
        {step === 0 && (
          <div className="space-y-4">
            <h2 className="font-display font-semibold text-white text-lg">
              Que tipo de objeto é?
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.value}
                  type="button"
                  onClick={() => setValue('category', cat.value)}
                  className={`p-4 rounded-xl border text-left transition-all ${
                    category === cat.value
                      ? 'border-brand-500 bg-brand-500/10 text-white'
                      : 'border-surface-border glass text-slate-400 hover:text-white hover:border-slate-500'
                  }`}
                >
                  <div className="text-2xl mb-2">{cat.emoji}</div>
                  <div className="text-sm font-medium">{cat.label}</div>
                </button>
              ))}
            </div>
            {errors.category && (
              <p className="text-red-400 text-sm">{errors.category.message}</p>
            )}
          </div>
        )}

        {/* Step 1 — Status */}
        {step === 1 && (
          <div className="space-y-4">
            <h2 className="font-display font-semibold text-white text-lg">
              O que aconteceu?
            </h2>
            <div className="space-y-3">
              {STATUSES.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => setValue('status', s.value)}
                  className={`w-full p-4 rounded-xl border text-left transition-all flex items-center gap-4 ${
                    status === s.value ? s.color + ' border-opacity-80' : 'border-surface-border glass'
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                      status === s.value ? 'border-current' : 'border-slate-600'
                    }`}
                  >
                    {status === s.value && <Check className="w-3 h-3" />}
                  </div>
                  <div>
                    <p className="font-medium text-white">{s.label}</p>
                    <p className="text-slate-400 text-sm">{s.desc}</p>
                  </div>
                </button>
              ))}
            </div>
            {errors.status && (
              <p className="text-red-400 text-sm">{errors.status.message}</p>
            )}
          </div>
        )}

        {/* Step 2 — Details */}
        {step === 2 && (
          <div className="space-y-5">
            <h2 className="font-display font-semibold text-white text-lg flex items-center gap-2">
              <Info className="w-5 h-5 text-brand-400" />
              Detalhes do objeto
            </h2>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                Título *
              </label>
              <input
                {...register('title')}
                placeholder={isPet ? 'Ex: Labrador caramelo — Toby' : 'Ex: iPhone 15 Pro preto'}
                className={`w-full bg-surface border rounded-xl px-4 py-3 text-slate-100 placeholder-slate-500 text-sm outline-none focus:border-brand-500 transition-colors ${
                  errors.title ? 'border-red-500' : 'border-surface-border'
                }`}
              />
              {errors.title && <p className="text-red-400 text-xs mt-1">{errors.title.message}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                Descrição *
              </label>
              <textarea
                {...register('description')}
                rows={4}
                placeholder={
                  isPet
                    ? 'Descreva cor, porte, sinais característicos, coleira...'
                    : 'Descreva cor, marca, modelo, características únicas...'
                }
                className={`w-full bg-surface border rounded-xl px-4 py-3 text-slate-100 placeholder-slate-500 text-sm outline-none focus:border-brand-500 transition-colors resize-none ${
                  errors.description ? 'border-red-500' : 'border-surface-border'
                }`}
              />
              {errors.description && (
                <p className="text-red-400 text-xs mt-1">{errors.description.message}</p>
              )}
            </div>

            {/* Pet fields */}
            {isPet && (
              <div className="space-y-4 pt-2 border-t border-surface-border">
                <p className="text-brand-400 text-sm font-medium flex items-center gap-2">
                  🐾 Informações do Pet
                </p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Espécie</label>
                    <select
                      {...register('pet_species')}
                      className="w-full bg-surface border border-surface-border rounded-xl px-3 py-2.5 text-slate-100 text-sm outline-none focus:border-brand-500 transition-colors"
                    >
                      <option value="">Selecionar</option>
                      <option value="dog">Cachorro</option>
                      <option value="cat">Gato</option>
                      <option value="bird">Pássaro</option>
                      <option value="rabbit">Coelho</option>
                      <option value="other">Outro</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Raça</label>
                    <input
                      {...register('pet_breed')}
                      placeholder="Ex: Labrador"
                      className="w-full bg-surface border border-surface-border rounded-xl px-3 py-2.5 text-slate-100 placeholder-slate-500 text-sm outline-none focus:border-brand-500 transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Cor predominante</label>
                    <input
                      {...register('pet_color')}
                      placeholder="Ex: Caramelo e branco"
                      className="w-full bg-surface border border-surface-border rounded-xl px-3 py-2.5 text-slate-100 placeholder-slate-500 text-sm outline-none focus:border-brand-500 transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">
                      Microchip <span className="text-slate-600">(se houver)</span>
                    </label>
                    <input
                      {...register('pet_microchip')}
                      placeholder="Ex: 985141002876543"
                      className="w-full bg-surface border border-surface-border rounded-xl px-3 py-2.5 text-slate-100 placeholder-slate-500 text-sm outline-none focus:border-brand-500 transition-colors"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Reward section — apenas para status 'lost' */}
            {status === 'lost' && (
              <div className="pt-2 border-t border-surface-border">
                <button
                  type="button"
                  onClick={() => setOfferReward((v) => !v)}
                  className={`w-full p-4 rounded-xl border text-left transition-all flex items-center gap-4 ${
                    offerReward
                      ? 'border-yellow-500/50 bg-yellow-500/5 text-yellow-400'
                      : 'border-surface-border glass text-slate-400 hover:text-white hover:border-slate-500'
                  }`}
                >
                  <Gift className={`w-5 h-5 flex-shrink-0 ${offerReward ? 'text-yellow-400' : 'text-slate-500'}`} />
                  <div className="flex-1">
                    <p className="font-medium text-white text-sm">Oferecer recompensa</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Aumenta as chances de recuperação — quem encontrar verá o valor
                    </p>
                  </div>
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                    offerReward ? 'border-yellow-400 bg-yellow-400/20' : 'border-slate-600'
                  }`}>
                    {offerReward && <Check className="w-3 h-3 text-yellow-400" />}
                  </div>
                </button>

                {offerReward && (
                  <div className="mt-3 space-y-3 p-4 bg-yellow-500/5 border border-yellow-500/20 rounded-xl">
                    <div>
                      <label className="block text-xs text-slate-300 mb-1.5">
                        Valor da recompensa (R$) *
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">R$</span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          {...register('reward_amount', { valueAsNumber: true })}
                          placeholder="0,00"
                          className="w-full bg-surface border border-yellow-500/30 rounded-xl pl-9 pr-4 py-2.5 text-slate-100 placeholder-slate-500 text-sm outline-none focus:border-yellow-500 transition-colors"
                        />
                      </div>
                      {errors.reward_amount && (
                        <p className="text-red-400 text-xs mt-1">{errors.reward_amount.message}</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-xs text-slate-300 mb-1.5">
                        Mensagem para quem encontrar <span className="text-slate-500">(opcional)</span>
                      </label>
                      <textarea
                        {...register('reward_description')}
                        rows={2}
                        placeholder="Ex: Recompensa garantida para quem devolver. Entre em contato pelo app."
                        className="w-full bg-surface border border-yellow-500/30 rounded-xl px-4 py-2.5 text-slate-100 placeholder-slate-500 text-sm outline-none focus:border-yellow-500 transition-colors resize-none"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Photos */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                Fotos <span className="text-slate-500">(até 5)</span>
              </label>
              <label className={`flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-xl transition-colors ${
                compressing ? 'border-brand-500/50 cursor-wait' : 'border-surface-border cursor-pointer hover:border-brand-500/50'
              }`}>
                {compressing ? (
                  <>
                    <Loader2 className="w-6 h-6 text-brand-400 mb-2 animate-spin" />
                    <span className="text-brand-400 text-sm">Otimizando fotos...</span>
                  </>
                ) : (
                  <>
                    <Upload className="w-6 h-6 text-slate-500 mb-2" />
                    <span className="text-slate-500 text-sm">
                      {photos.length > 0
                        ? `${photos.length} foto(s) selecionada(s) ✓`
                        : 'Clique ou arraste as fotos aqui'}
                    </span>
                    <span className="text-slate-600 text-xs mt-1">Compressão automática aplicada</span>
                  </>
                )}
                <input type="file" multiple accept="image/*" onChange={handleFileChange} className="hidden" disabled={compressing} />
              </label>
            </div>
          </div>
        )}

        {/* Step 3 — Location */}
        {step === 3 && (
          <div className="space-y-5">
            <h2 className="font-display font-semibold text-white text-lg flex items-center gap-2">
              <MapPin className="w-5 h-5 text-brand-400" />
              Onde ocorreu?
            </h2>
            <p className="text-slate-400 text-sm">
              Informe o local aproximado — isso ajuda o algoritmo de matching a encontrar objetos na mesma região.
            </p>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                Endereço ou referência
              </label>
              <input
                {...register('address')}
                placeholder="Ex: Metrô Paulista, Av. Paulista, São Paulo"
                className="w-full bg-surface border border-surface-border rounded-xl px-4 py-3 text-slate-100 placeholder-slate-500 text-sm outline-none focus:border-brand-500 transition-colors"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Latitude (opcional)</label>
                <input
                  type="number"
                  step="any"
                  onChange={(e) => setValue('lat', parseFloat(e.target.value))}
                  placeholder="-23.5613"
                  className="w-full bg-surface border border-surface-border rounded-xl px-3 py-2.5 text-slate-100 placeholder-slate-500 text-sm outline-none focus:border-brand-500 transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Longitude (opcional)</label>
                <input
                  type="number"
                  step="any"
                  onChange={(e) => setValue('lng', parseFloat(e.target.value))}
                  placeholder="-46.6558"
                  className="w-full bg-surface border border-surface-border rounded-xl px-3 py-2.5 text-slate-100 placeholder-slate-500 text-sm outline-none focus:border-brand-500 transition-colors"
                />
              </div>
            </div>

            {/* Map placeholder */}
            <div className="w-full h-48 bg-surface-card border border-surface-border rounded-xl flex flex-col items-center justify-center text-slate-500 gap-2">
              <MapPin className="w-8 h-8" />
              <p className="text-sm">Mapa interativo — integração Mapbox</p>
              <p className="text-xs text-slate-600">Configure NEXT_PUBLIC_MAPBOX_TOKEN no .env</p>
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between mt-8 pt-6 border-t border-surface-border">
          <button
            type="button"
            onClick={prevStep}
            disabled={step === 0}
            className="flex items-center gap-2 px-5 py-2.5 glass rounded-xl text-slate-300 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all text-sm"
          >
            <ChevronLeft className="w-4 h-4" />
            Voltar
          </button>

          {step < STEPS.length - 1 ? (
            <button
              type="button"
              onClick={nextStep}
              disabled={step === 0 && !category}
              className="flex items-center gap-2 px-6 py-2.5 bg-brand-500 hover:bg-brand-400 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-all glow-teal text-sm"
            >
              Continuar
              <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={submitting}
              className="flex items-center gap-2 px-6 py-2.5 bg-brand-500 hover:bg-brand-400 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-all glow-teal text-sm"
            >
              {submitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <Package className="w-4 h-4" />
                  Registrar Objeto
                </>
              )}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
