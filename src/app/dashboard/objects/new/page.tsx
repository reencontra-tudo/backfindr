'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import {
  ChevronLeft, ChevronRight, Loader2, Upload,
  MapPin, Package, Info, Check, Gift, X, Shield, Search
} from 'lucide-react';
import axios from 'axios';
import { objectsApi, parseApiError } from '@/lib/api';
import { compressImages } from '@/lib/compressImage';
import { ObjectCategory, ObjectStatus } from '@/types';
import { LocationPicker } from '@/components/ui/LocationPicker';
import { DynamicCategoryFields } from '@/components/ui/DynamicCategoryFields';
import { camposEspecificosParaEnvio, descricaoDoTitulo, faltasDoAnimal, passoAnterior, passoInicial, proximoPasso, resumirErros, statusDefinidoPeloIntent } from '@/lib/formularioOcorrencia';
import CampoCodigoColaborador from '@/components/colaboradores/CampoCodigoColaborador';
import { codigoInicial, colaboradoresAtivoNoCliente, limparCodigoGuardado } from '@/lib/colaboradores/cliente';

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
  document_type: z.string().optional(),
  document_owner_name: z.string().max(100).optional(),
  document_last4: z.string().max(4).optional(),
  reward_amount: z.number().min(0).optional().nullable(),
  reward_description: z.string().max(500).optional().nullable(),
  colaborador_codigo: z.string().max(40).optional(),
});

type FormData = z.infer<typeof schema>;

interface SimilarObject {
  id: string;
  title: string;
  description: string | null;
  status: string;
}

const SIMILAR_STATUS_LABEL: Record<string, string> = {
  lost: 'Perdido', found: 'Encontrado', stolen: 'Roubado', protected: 'Protegido', recovered: 'Recuperado',
};

// ─── Options ─────────────────────────────────────────────────────────────────
const CATEGORIES: { value: ObjectCategory; label: string; emoji: string; hint?: string }[] = [
  // «Pet» e «Animal» (decisão do fundador, 24/11/2026, MC-01): quem tem cachorro, gato, pássaro ou coelho escolhe Pet; cavalo, boi, porco etc. (criação ou trabalho), Animal.
  { value: 'pet', label: 'Pet', emoji: '🐾', hint: 'Animal de estimação: cachorro, gato, pássaro…' },
  { value: 'animal', label: 'Animal', emoji: '🐴', hint: 'De criação ou trabalho: cavalo, boi, porco…' },
  { value: 'phone', label: 'Celular', emoji: '📱' },
  { value: 'wallet', label: 'Carteira', emoji: '👛' },
  { value: 'keys', label: 'Chaves', emoji: '🔑' },
  { value: 'bag', label: 'Bolsa / Mochila', emoji: '🎒' },
  { value: 'bike', label: 'Bicicleta', emoji: '🚲' },
  { value: 'vehicle', label: 'Veículo', emoji: '🚗' },
  { value: 'document', label: 'Documento', emoji: '📄' },
  { value: 'jewelry', label: 'Joia / Relógio', emoji: '💍' },
  { value: 'electronics', label: 'Eletrônico', emoji: '💻' },
  { value: 'other', label: 'Outro', emoji: '📦' },
];

// STATUSES para o caso de REPORTAR ocorrência
const STATUSES_REPORT: { value: ObjectStatus; label: string; desc: string; color: string }[] = [
  { value: 'lost',   label: 'Perdi',       desc: 'Quero encontrá-lo',       color: 'border-red-500/40 text-red-400 bg-red-500/5' },
  { value: 'found',  label: 'Encontrei',   desc: 'Quero devolver ao dono',   color: 'border-brand-500/40 text-brand-400 bg-brand-500/5' },
  { value: 'stolen', label: 'Fui roubado', desc: 'Registrar como roubado',   color: 'border-orange-500/40 text-orange-400 bg-orange-500/5' },
];

const STEPS = ['Categoria', 'Status', 'Detalhes', 'Localização'];

// ─── Intent map ────────────────────────────────────────────────────────────────
// 'protect' agora mapeia corretamente para status 'protected'
const INTENT_MAP: Record<string, { category?: string; status?: string; startStep?: number; mode?: 'protect' | 'report' }> = {
  lost:      { status: 'lost',      startStep: 1, mode: 'report' },
  found:     { status: 'found',     startStep: 1, mode: 'report' },
  stolen:    { status: 'stolen',    startStep: 1, mode: 'report' },
  protect:   { status: 'protected', startStep: 0, mode: 'protect' },
  pet:       { category: 'pet',     status: 'lost', startStep: 1, mode: 'report' },
};

// ─── Tela de escolha inicial ──────────────────────────────────────────────────
function ModeSelector({ onSelect }: { onSelect: (mode: 'protect' | 'report') => void }) {
  return (
    <div className="p-8 max-w-2xl">
      <div className="mb-8">
        <h1 className="font-display text-2xl font-bold text-white mb-2">O que você precisa fazer?</h1>
        <p className="text-slate-400 text-sm">Escolha para seguir o caminho certo.</p>
      </div>

      <div className="space-y-4">
        {/* Opção 1: Registrar ocorrência (função principal) */}
        <button
          type="button"
          onClick={() => onSelect('report')}
          className="w-full p-5 rounded-2xl border border-blue-500/30 bg-blue-500/5 hover:bg-blue-500/10 hover:border-blue-500/50 transition-all text-left group"
        >
          <div className="flex items-start gap-4">
            <div className="w-11 h-11 rounded-xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center flex-shrink-0 mt-0.5 group-hover:bg-blue-500/30 transition-colors">
              <Search className="w-5 h-5 text-blue-400" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-white text-base mb-1">🔍 Registrar uma ocorrência</p>
              <p className="text-slate-400 text-sm leading-relaxed">
                Perdi um objeto, fui roubado ou encontrei algo e quero devolver.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {['Perdi algo', 'Fui roubado', 'Encontrei algo'].map(item => (
                  <span key={item} className="text-xs text-blue-400/70 bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded-full">{item}</span>
                ))}
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-blue-400 flex-shrink-0 mt-3 group-hover:translate-x-0.5 transition-transform" />
          </div>
        </button>
        {/* Opção 2: Proteger preventivamente (QR, opcional) */}
        <button
          type="button"
          onClick={() => onSelect('protect')}
          className="w-full p-5 rounded-2xl border border-white/10 bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/20 transition-all text-left group"
        >
          <div className="flex items-start gap-4">
            <div className="w-11 h-11 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center flex-shrink-0 mt-0.5 group-hover:bg-white/10 transition-colors">
              <Shield className="w-5 h-5 text-slate-400" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-white text-base mb-1">🛡️ Proteger um objeto</p>
              <p className="text-slate-400 text-sm leading-relaxed">
                Se quiser se preparar antes, gere um QR Code para colar no objeto. Se alguém o escanear, você é avisado.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {['Celular', 'Carteira', 'Chaves', 'Mochila', 'Pet', 'Veículo'].map(item => (
                  <span key={item} className="text-xs text-slate-500 bg-white/5 border border-white/10 px-2 py-0.5 rounded-full">{item}</span>
                ))}
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-slate-500 flex-shrink-0 mt-3 group-hover:translate-x-0.5 transition-transform" />
          </div>
        </button>

      </div>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────
function NewObjectForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const intent = searchParams.get('intent') ?? '';
  const prefillTitle    = searchParams.get('prefill_title')    ?? '';
  const prefillCategory = searchParams.get('prefill_category') ?? '';
  const prefillLocation = searchParams.get('prefill_location') ?? '';
  const prefillBreed    = searchParams.get('prefill_breed')    ?? '';
  const prefillColor    = searchParams.get('prefill_color')    ?? '';
  const intentPreset = INTENT_MAP[intent] ?? {};

  // Modo: 'choose' = tela inicial de escolha, 'protect' ou 'report'
  // Se vier um intent definido, pula direto para o modo correto
  const initialMode = intentPreset.mode ?? 'choose';
  const [mode, setMode] = useState<'choose' | 'protect' | 'report'>(initialMode as 'choose' | 'protect' | 'report');

  // Intent found/lost/stolen/pet já define o status: o passo Status não é perguntado de novo (como no modo protect). Abre na Categoria ou, se o fluxo já
  // mandou a categoria (keys, wallet, vehicle, phone, bike, pet), direto em Detalhes. Sem intent (o «+»), nada muda.
  const statusDoIntent = statusDefinidoPeloIntent(intentPreset);
  const categoriaDoFluxo = CATEGORIES.some((c) => c.value === prefillCategory);
  const [step, setStep] = useState(passoInicial(intentPreset, categoriaDoFluxo));
  // Envio inválido nunca é silencioso: lista do que falta (e o passo/campo para onde levar a pessoa)
  const [faltando, setFaltando] = useState<string[] | null>(null);
  const [focoPendente, setFocoPendente] = useState<'title' | 'description' | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const colabAtivo = colaboradoresAtivoNoCliente();
  const [codigoColabRecusado, setCodigoColabRecusado] = useState(false);
  // Guarda síncrona contra duplo clique: o `disabled={submitting}` só vale depois do próximo render.
  const submittingRef = useRef(false);
  // Aviso de objeto parecido (409 SIMILAR_OBJECT_FOUND). O formulário continua montado por baixo do modal.
  const [similarObjects, setSimilarObjects] = useState<SimilarObject[] | null>(null);
  const pendingDataRef = useRef<FormData | null>(null);
  const [photos, setPhotos] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [compressing, setCompressing] = useState(false);

  const [offerReward, setOfferReward] = useState(false);
  const [locationVal, setLocationVal] = useState<{ address: string; lat?: number; lng?: number }>({ address: '' });

  useEffect(() => {
    if (photos.length === 0) { setPreviews([]); return; }
    const urls = photos.map(f => URL.createObjectURL(f));
    setPreviews(urls);
    return () => urls.forEach(u => URL.revokeObjectURL(u));
  }, [photos]);

  // Pré-selecionar categoria, status e campos com base no intent e prefill params
  useEffect(() => {
    if (intentPreset.category) setValue('category', intentPreset.category as ObjectCategory);
    if (intentPreset.status)   setValue('status',   intentPreset.status as ObjectStatus);
    // Prefill vindo dos fluxos (/flow/*)
    if (prefillTitle)    setValue('title',    prefillTitle);
    // Título vindo de um fluxo: a descrição começa igual (se tiver 10+ caracteres, o mínimo do formulário) para a pessoa poder editar
    if (intent && prefillTitle && descricaoDoTitulo(prefillTitle)) setValue('description', descricaoDoTitulo(prefillTitle));
    if (prefillCategory) setValue('category', prefillCategory as ObjectCategory);
    if (prefillLocation) {
      setValue('address', prefillLocation);
      setLocationVal(prev => ({ ...prev, address: prefillLocation }));
      // Geocodificar automaticamente o endereço pré-preenchido
      const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
      if (mapboxToken && prefillLocation.length >= 3) {
        fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(prefillLocation)}.json?access_token=${mapboxToken}&language=pt&limit=1&country=br`)
          .then(r => r.json())
          .then(data => {
            const coords = data.features?.[0]?.center;
            const placeName = data.features?.[0]?.place_name ?? prefillLocation;
            if (coords && coords.length === 2) {
              setValue('lng', coords[0]);
              setValue('lat', coords[1]);
              setValue('address', placeName);
              setLocationVal({ address: placeName, lat: coords[1], lng: coords[0] });
            }
          })
          .catch(() => { /* silencioso */ });
      }
    }
    if (prefillBreed)    setValue('pet_breed', prefillBreed);
    if (prefillColor)    setValue('pet_color', prefillColor);
    // Programa de Colaboradores: código vindo da URL (?colab=) ou guardado nesta aba. Desligado, codigoInicial devolve sempre null.
    const colab = codigoInicial(searchParams);
    if (colab) setValue('colaborador_codigo', colab);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Quando o usuário escolhe o modo na tela inicial, aplicar o status padrão
  const handleModeSelect = (selectedMode: 'protect' | 'report') => {
    setMode(selectedMode);
    setStep(0);
    if (selectedMode === 'protect') {
      setValue('status', 'protected' as ObjectStatus);
    }
    // Para 'report', o status será escolhido no step 1
  };

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    getValues,
    setFocus,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const category = watch('category');
  const status = watch('status');
  const isPet = category === 'pet';
  const isAnimal = category === 'animal';

  // Pré-preencher raça com SRD quando categoria for pet (se campo ainda estiver vazio)
  useEffect(() => {
    if (isPet) {
      const currentBreed = watch('pet_breed');
      if (!currentBreed || currentBreed.trim() === '') {
        setValue('pet_breed', 'SRD');
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPet]);

  // Os passos pulam o Status quando o modo é protect ou quando o intent já define o status
  const nextStep = () => setStep((s) => proximoPasso(s, mode, statusDoIntent));
  const prevStep = () => setStep((s) => passoAnterior(s, mode, statusDoIntent));

  const removePhoto = (index: number) => {
    setPhotos(prev => prev.filter((_, i) => i !== index));
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation();
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

  const submitObject = async (data: FormData, confirmDuplicate: boolean) => {
    if (submittingRef.current) return;
    submittingRef.current = true;
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
      if (confirmDuplicate) payload.confirm_duplicate = true;
      // Programa de Colaboradores: só vai no corpo se o programa estiver ligado e houver texto no campo (o servidor valida; nunca confiar neste valor).
      if (colabAtivo && data.colaborador_codigo?.trim()) payload.colaborador_codigo = data.colaborador_codigo.trim();

      // Campos específicos da categoria (marca, modelo, IMEI, placa, espécie, cor/pelagem…): TODOS os que o formulário mostra vão no corpo e o servidor os guarda em
      // category_fields. Antes de 24/11/2026 só os de pet iam; os das demais categorias se perdiam em silêncio. Documento tem envio próprio (abaixo).
      Object.assign(payload, camposEspecificosParaEnvio(data.category, getValues() as Record<string, unknown>));

      // Documento: nome do titular (público por escolha do dono), tipo e só os 4 últimos dígitos (o número inteiro nunca é pedido).
      if (data.category === 'document') {
        if (data.document_type) payload.document_type = data.document_type;
      }
      if (data.category === 'document' && data.status !== 'found') {
        if (data.document_owner_name?.trim()) payload.document_owner_name = data.document_owner_name.trim();
        const final4 = (data.document_last4 ?? '').replace(/\D/g, '').slice(-4);
        if (final4) payload.document_last4 = final4;
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

      limparCodigoGuardado(); // cada ocorrência depende do link ou código usado no cadastro dela
      router.push(`/dashboard/objects/${objectId}/sucesso`);
    } catch (err) {
      // Objeto parecido já existente: pede confirmação em vez de criar
      if (axios.isAxiosError(err) && err.response?.status === 409 && err.response.data?.error === 'SIMILAR_OBJECT_FOUND') {
        pendingDataRef.current = data;
        setSimilarObjects(err.response.data.similar_objects ?? []);
        return;
      }
      setSimilarObjects(null);
      // Código do colaborador recusado pelo servidor: nada foi criado; mostra o aviso no campo (último passo) e deixa apagar ou corrigir.
      if (axios.isAxiosError(err) && err.response?.data?.error === 'CODIGO_COLABORADOR_INVALIDO') {
        setCodigoColabRecusado(true);
        setStep(3);
        toast.error(err.response.data.detail ?? 'Código do colaborador inválido ou inativo.');
        return;
      }
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
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  // handleSubmit passa (data, event): não repassar o 2º argumento para confirmDuplicate.
  const onSubmit = (data: FormData) => {
    setFaltando(null);
    const faltasAnimal = faltasDoAnimal(data.category, getValues() as Record<string, unknown>); // só para `animal`; nas demais categorias é sempre null
    if (faltasAnimal) { onInvalid(faltasAnimal); return; }
    return submitObject(data, false);
  };
  // Validação falhou: leva ao primeiro passo com erro, diz o que falta e foca o campo (os campos de outros passos não estão na tela, então o botão parecia morto)
  const onInvalid = (erros: Record<string, { message?: string } | undefined>) => {
    const r = resumirErros(erros, mode, statusDoIntent);
    setStep(r.passo); setFaltando(r.mensagens); setFocoPendente(r.campoParaFocar);
  };
  useEffect(() => {
    if (!faltando) return;
    const t = setTimeout(() => {
      if (focoPendente) { try { setFocus(focoPendente); } catch { /* campo ainda não montado */ } setFocoPendente(null); }
      document.querySelector('[data-form-aviso]')?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }, 60);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [faltando, step]);
  // O aviso sai quando os erros foram corrigidos (só depois de o formulário ter mostrado os erros: o estado de erros chega um instante depois de onInvalid).
  // Calculado a cada renderização (o RHF muda `errors` no mesmo objeto, então um efeito com [errors] não rodaria).
  const viuErros = useRef(false);
  const totalErros = Object.keys(errors).length;
  if (!faltando) viuErros.current = false; else if (totalErros > 0) viuErros.current = true;
  const mostrarAviso = Boolean(faltando && faltando.length > 0 && (totalErros > 0 || !viuErros.current));
  useEffect(() => { if (faltando && !mostrarAviso) setFaltando(null); }, [faltando, mostrarAviso]);

  const confirmDuplicateSubmit = () => {
    if (pendingDataRef.current) submitObject(pendingDataRef.current, true);
  };

  const closeSimilarModal = () => {
    if (submittingRef.current) return;
    setSimilarObjects(null);
  };

  return (
    <>
      {/* ── Tela de escolha inicial ── */}
      {mode === 'choose' && (
        <ModeSelector onSelect={handleModeSelect} />
      )}

      {/* ── Formulário (protect ou report) ── */}
      {mode !== 'choose' && (
    <div className="p-8 max-w-2xl">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <button
          onClick={() => {
            // Se veio de um intent externo (flow/*), volta para a tela anterior
            // Caso contrário, volta para a tela de escolha
            if (intent) {
              router.back();
            } else {
              setMode('choose');
              setStep(0);
            }
          }}
          className="w-9 h-9 glass rounded-lg flex items-center justify-center text-slate-400 hover:text-white transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <div>
          <h1 className="font-display text-xl font-bold text-white">
            {mode === 'protect' ? '🛡️ Proteger Objeto' : '🔍 Registrar Ocorrência'}
          </h1>
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
                i <= step
                  ? mode === 'protect' ? 'bg-blue-500' : 'bg-brand-500'
                  : 'bg-surface-border'
              }`}
            />
            <span
              className={`text-xs flex items-center gap-1 ${
                i === step
                  ? mode === 'protect' ? 'text-blue-400 font-semibold' : 'text-brand-400 font-semibold'
                  : i < step ? 'text-slate-400' : 'text-slate-600'
              }`}
            >
              {s}
              {i === 3 && i === step && <span className={mode === 'protect' ? 'text-blue-400 animate-pulse' : 'text-brand-400 animate-pulse'}>📍</span>}
            </span>
          </div>
        ))}
      </div>

      <form
        onSubmit={handleSubmit(onSubmit, onInvalid)}
        onKeyDown={(e) => { if (e.key === 'Enter' && step < STEPS.length - 1) e.preventDefault(); }}
      >
        {/* Step 0 — Category */}
        {step === 0 && (
          <div className="space-y-4">
            {mode === 'protect' && (
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3 mb-4 flex items-center gap-2 text-blue-300 text-sm">
                <Shield className="w-4 h-4 flex-shrink-0" />
                <span>Você está criando um QR Code preventivo. Cole no objeto e ele ficará protegido.</span>
              </div>
            )}
            <h2 className="font-display font-semibold text-white text-lg">
              Que tipo de objeto é?
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.value}
                  type="button"
                  onClick={() => { setValue('category', cat.value); nextStep(); }}
                  className={`p-4 rounded-xl border text-left transition-all ${
                    category === cat.value
                      ? mode === 'protect'
                        ? 'border-blue-500 bg-blue-500/10 text-white'
                        : 'border-brand-500 bg-brand-500/10 text-white'
                      : 'border-surface-border glass text-slate-400 hover:text-white hover:border-slate-500'
                  }`}
                >
                  <div className="text-2xl mb-2">{cat.emoji}</div>
                  <div className="text-sm font-medium">{cat.label}</div>
                  {cat.hint && <div className="mt-1 text-[11px] leading-snug text-slate-500">{cat.hint}</div>}
                </button>
              ))}
            </div>
            {errors.category && (
              <p className="text-red-400 text-sm">{errors.category.message}</p>
            )}
          </div>
        )}

        {/* Step 1 — Status: só aparece no modo 'report'; no modo 'protect' é pulado */}
        {step === 1 && mode === 'report' && (
          <div className="space-y-4">
            <h2 className="font-display font-semibold text-white text-lg">
              O que aconteceu?
            </h2>
            <div className="space-y-3">
              {STATUSES_REPORT.map((s) => (
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
                placeholder={isPet ? 'Ex: Labrador caramelo — Toby' : isAnimal ? 'Ex: Égua alazã com estrela na testa' : 'Ex: iPhone 15 Pro preto'}
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
                    : isAnimal
                      ? 'Descreva a pelagem, o porte, marcas e sinais (ferro, cicatriz), onde ficava...'
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

            {/* Dynamic Category Fields */}
            {category && !['other', 'bag'].includes(category) && (
              <div className="pt-2 border-t border-surface-border">
                <DynamicCategoryFields
                  category={category}
                  values={watch()}
                  onChange={(fieldName, value) => setValue(fieldName as any, value)}
                  errors={errors as any}
                  // «Encontrei»: não se pede nem se avisa sobre o nome do titular nem os 4 dígitos (o que foi digitado fica guardado se o status voltar para «perdi»)
                  hideFields={category === 'document' && status === 'found' ? ['document_owner_name', 'document_last4'] : []}
                />
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

              {/* Thumbnails das fotos selecionadas */}
              {previews.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {previews.map((url, i) => (
                    <div key={i} className="relative w-16 h-16 rounded-lg overflow-hidden border border-surface-border group">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={url} alt={`Foto ${i + 1}`} className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => removePhoto(i)}
                        className="absolute top-0.5 right-0.5 w-5 h-5 bg-black/70 hover:bg-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all"
                      >
                        <X className="w-3 h-3 text-white" />
                      </button>
                      {i === 0 && (
                        <span className="absolute bottom-0 left-0 right-0 bg-brand-500/80 text-white text-[9px] text-center py-0.5 font-medium">Principal</span>
                      )}
                    </div>
                  ))}
                  {previews.length < 5 && (
                    <label className="w-16 h-16 rounded-lg border-2 border-dashed border-surface-border hover:border-brand-500/50 flex items-center justify-center cursor-pointer transition-colors">
                      <Upload className="w-4 h-4 text-slate-600" />
                      <input type="file" multiple accept="image/*" onChange={handleFileChange} className="hidden" />
                    </label>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Step 3 — Location */}
        {step === 3 && (
          <div className="space-y-5">
            <div className="bg-brand-500/10 border border-brand-500/30 rounded-xl p-4 mb-2">
              <h2 className="font-display font-semibold text-white text-lg flex items-center gap-2 mb-2">
                <MapPin className="w-5 h-5 text-brand-400" />
                📍 Onde ocorreu?
              </h2>
              <p className="text-slate-300 text-sm leading-relaxed">
                Defina a localização do objeto para que nosso algoritmo de matching encontre pessoas na mesma região que possam ajudar. Quanto mais preciso, melhor!
              </p>
            </div>
            <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-3 flex gap-2 text-xs text-blue-300">
              <span className="flex-shrink-0">💡</span>
              <span>Dica: Use a busca por bairro, rua ou referência (ex: "Metrô Paulista"). Você também pode clicar no mapa para marcar o ponto exato.</span>
            </div>
            <LocationPicker
              value={locationVal}
              onChange={(val) => {
                setLocationVal(val);
                setValue('address', val.address);
                setValue('lat', val.lat);
                setValue('lng', val.lng);
              }}
            />
            {colabAtivo && (
              <CampoCodigoColaborador
                valor={watch('colaborador_codigo') ?? ''}
                onChange={(v) => { setCodigoColabRecusado(false); setValue('colaborador_codigo', v); }}
                erroServidor={codigoColabRecusado}
              />
            )}
          </div>
        )}

        {mostrarAviso && faltando && (
          <div role="alert" data-form-aviso className="mt-6 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
            <p className="font-medium">Ainda não foi possível registrar:</p>
            <ul className="mt-1 list-disc pl-5">{faltando.map((m) => <li key={m}>{m}</li>)}</ul>
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

          {step === 0 ? (
            <span />
          ) : step < STEPS.length - 1 ? (
            // key distinto: sem ele o React reaproveita o mesmo <button> e troca type="button" por
            // type="submit" ainda dentro do clique, e o navegador envia o formulário ao entrar no último passo.
            // preventDefault é a segunda trava: avançar de passo nunca submete.
            <button
              key="next-step"
              type="button"
              onClick={(e) => { e.preventDefault(); nextStep(); }}
              data-widget-safe-zone
              className={`flex items-center gap-2 px-6 py-2.5 text-white font-semibold rounded-xl transition-all text-sm ${
                mode === 'protect'
                  ? 'bg-blue-500 hover:bg-blue-400'
                  : 'bg-brand-500 hover:bg-brand-400 glow-teal'
              }`}
            >
              Continuar
              <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              key="submit-form"
              type="submit"
              disabled={submitting}
              data-widget-safe-zone
              className={`flex items-center gap-2 px-6 py-2.5 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-all text-sm ${
                mode === 'protect'
                  ? 'bg-blue-500 hover:bg-blue-400'
                  : 'bg-brand-500 hover:bg-brand-400 glow-teal'
              }`}
            >
              {submitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : mode === 'protect' ? (
                <>
                  <Shield className="w-4 h-4" />
                  Gerar QR e Proteger
                </>
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
      )}

      {/* ── Aviso de objeto parecido ── */}
      {similarObjects && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="similar-object-title"
        >
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={closeSimilarModal} />
          <div className="relative w-full max-w-md bg-[#0f1623] border border-white/[0.08] rounded-2xl p-6 shadow-2xl z-10">
            <button
              type="button"
              onClick={closeSimilarModal}
              aria-label="Fechar"
              className="absolute top-4 right-4 text-white/30 hover:text-white/60 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                <Info className="w-5 h-5 text-amber-400" />
              </div>
              <h2 id="similar-object-title" className="text-white font-semibold text-sm">
                Você já tem um objeto parecido
              </h2>
            </div>

            <p className="text-white/50 text-xs mb-4 leading-relaxed">
              Encontramos um objeto seu com dados semelhantes. Quer ver o que já existe ou registrar mesmo assim?
            </p>

            <ul className="space-y-2 mb-5">
              {similarObjects.map((obj) => (
                <li key={obj.id}>
                  <Link
                    href={`/dashboard/objects/${obj.id}`}
                    className="block glass rounded-xl px-4 py-3 hover:bg-white/[0.06] transition-colors"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-white text-sm font-medium truncate">{obj.title}</span>
                      <span className="text-[11px] text-white/40 shrink-0">
                        {SIMILAR_STATUS_LABEL[obj.status] ?? obj.status}
                      </span>
                    </div>
                    {obj.description && (
                      <p className="text-white/40 text-xs mt-1 line-clamp-2">{obj.description}</p>
                    )}
                  </Link>
                </li>
              ))}
            </ul>

            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => similarObjects[0] && router.push(`/dashboard/objects/${similarObjects[0].id}`)}
                disabled={submitting || similarObjects.length === 0}
                className="w-full px-5 py-2.5 bg-brand-500 hover:bg-brand-400 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-all text-sm"
              >
                Ver objeto existente
              </button>
              <button
                type="button"
                onClick={confirmDuplicateSubmit}
                disabled={submitting}
                className="w-full flex items-center justify-center gap-2 px-5 py-2.5 glass rounded-xl text-slate-300 hover:text-white disabled:opacity-60 disabled:cursor-not-allowed transition-all text-sm"
              >
                {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                Registrar mesmo assim
              </button>
              <button
                type="button"
                onClick={closeSimilarModal}
                disabled={submitting}
                className="w-full px-5 py-2 text-white/40 hover:text-white/70 disabled:opacity-60 text-xs transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default function NewObjectPage() {
  return (
    <Suspense fallback={<div className="p-8 max-w-2xl" />}>
      <NewObjectForm />
    </Suspense>
  );
}
