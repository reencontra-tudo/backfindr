'use client';

import { useState } from 'react';
import {
  Smartphone, Wallet, Key, Backpack, PawPrint, Bike, Car,
  FileText, Gem, Laptop, Shirt, Package,
  type LucideIcon,
} from 'lucide-react';

export type ObjectThumbSize = 'sm' | 'md' | 'lg' | 'hero';

type CanonicalCategory =
  | 'phone' | 'wallet' | 'keys' | 'bag' | 'pet' | 'bike' | 'vehicle'
  | 'document' | 'jewelry' | 'electronics' | 'clothing' | 'other';

// Valores reais de objects.category fora do enum de src/types/index.ts
// ('animal' e 'book' vêm do legado; null aparece em registros sem categoria).
const CATEGORY_ALIASES: Record<string, CanonicalCategory> = {
  animal: 'pet',
  book: 'other',
};

const CANONICAL: ReadonlySet<string> = new Set<CanonicalCategory>([
  'phone', 'wallet', 'keys', 'bag', 'pet', 'bike', 'vehicle',
  'document', 'jewelry', 'electronics', 'clothing', 'other',
]);

export function normalizeCategory(category: string | null | undefined): CanonicalCategory {
  const key = (category ?? '').trim().toLowerCase();
  if (CANONICAL.has(key)) return key as CanonicalCategory;
  return CATEGORY_ALIASES[key] ?? 'other';
}

const ICONS: Record<CanonicalCategory, LucideIcon> = {
  phone: Smartphone,
  wallet: Wallet,
  keys: Key,
  bag: Backpack,
  pet: PawPrint,
  bike: Bike,
  vehicle: Car,
  document: FileText,
  jewelry: Gem,
  electronics: Laptop,
  clothing: Shirt,
  other: Package,
};

const LABELS: Record<CanonicalCategory, string> = {
  phone: 'Celular',
  wallet: 'Carteira',
  keys: 'Chaves',
  bag: 'Bolsa',
  pet: 'Animal de estimação',
  bike: 'Bicicleta',
  vehicle: 'Veículo',
  document: 'Documento',
  jewelry: 'Joia ou relógio',
  electronics: 'Eletrônico',
  clothing: 'Roupa',
  other: 'Objeto',
};

// Um gradiente por grupo de categoria. Classes completas (sem montar string) para o Tailwind enxergá-las.
const TONES = {
  tech:     { bg: 'bg-gradient-to-br from-sky-500/25 to-blue-700/10',        icon: 'text-sky-300' },
  personal: { bg: 'bg-gradient-to-br from-amber-500/25 to-orange-700/10',    icon: 'text-amber-300' },
  document: { bg: 'bg-gradient-to-br from-indigo-500/25 to-slate-700/10',    icon: 'text-indigo-300' },
  mobility: { bg: 'bg-gradient-to-br from-violet-500/25 to-purple-700/10',   icon: 'text-violet-300' },
  animal:   { bg: 'bg-gradient-to-br from-brand-500/25 to-emerald-700/10',   icon: 'text-brand-300' },
  other:    { bg: 'bg-gradient-to-br from-slate-500/25 to-slate-700/10',     icon: 'text-slate-300' },
} as const;

const TONE_BY_CATEGORY: Record<CanonicalCategory, keyof typeof TONES> = {
  phone: 'tech',
  electronics: 'tech',
  wallet: 'personal',
  keys: 'personal',
  bag: 'personal',
  jewelry: 'personal',
  clothing: 'personal',
  document: 'document',
  vehicle: 'mobility',
  bike: 'mobility',
  pet: 'animal',
  other: 'other',
};

const ICON_SIZE: Record<ObjectThumbSize, string> = {
  sm: 'w-5 h-5',
  md: 'w-7 h-7',
  lg: 'w-9 h-9',
  hero: 'w-14 h-14',
};

// Dimensões usadas só quando o chamador não passa className.
const DEFAULT_BOX: Record<ObjectThumbSize, string> = {
  sm: 'w-11 h-11 rounded-xl',
  md: 'w-16 h-16 rounded-xl',
  lg: 'w-full h-32 rounded-xl',
  hero: 'w-full h-56',
};

interface ObjectThumbProps {
  photoUrl?: string | null;
  category?: string | null;
  size?: ObjectThumbSize;
  /** Dimensões, borda e arredondamento do quadro. Sem ele, usa o padrão do size. */
  className?: string;
  alt?: string;
}

export default function ObjectThumb({
  photoUrl,
  category,
  size = 'md',
  className,
  alt = '',
}: ObjectThumbProps) {
  // Guarda a URL que falhou, não um booleano: se a foto mudar, tenta de novo.
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const showPhoto = !!photoUrl && failedUrl !== photoUrl;
  const box = `flex-shrink-0 overflow-hidden ${className ?? DEFAULT_BOX[size]}`;

  if (showPhoto) {
    return (
      <div className={box}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={photoUrl!}
          alt={alt}
          onError={() => setFailedUrl(photoUrl!)}
          className="w-full h-full object-cover"
        />
      </div>
    );
  }

  const key = normalizeCategory(category);
  const Icon = ICONS[key];
  const label = LABELS[key];
  const tone = TONES[TONE_BY_CATEGORY[key]];

  return (
    <div
      role="img"
      aria-label={label}
      className={`${box} ${tone.bg} bg-surface flex items-center justify-center`}
    >
      <div className="flex flex-col items-center gap-2">
        <Icon className={`${ICON_SIZE[size]} ${tone.icon}`} strokeWidth={1.75} aria-hidden="true" />
        {size === 'hero' && (
          <span className="text-slate-400 text-xs tracking-wide uppercase">Sem foto</span>
        )}
      </div>
    </div>
  );
}
