/**
 * posterFormatter.ts
 *
 * Regra definitiva: os templates de pôster NUNCA usam objeto.title diretamente
 * em fonte grande. Toda comunicação visual é controlada por este módulo.
 *
 * título livre do usuário = informação
 * headline do cartaz      = comunicação visual controlada
 */

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

export interface PosterData {
  /** Ex: "CACHORRO PERDIDO" — máx 24 chars, sempre maiúsculo */
  headline: string
  /** Ex: "PERDI MEU" — prefixo acima da headline */
  eyebrow: string
  /** Ex: "Todynho, meu cachorro" — máx 40 chars */
  subtitle: string
  /** Ex: "Vira-lata, escapou na Rua Cônego Valadão, em Guarulhos." — máx 120 chars */
  description: string
  /** Ex: "Pet" */
  categoryLabel: string
  /** Ex: "PERDIDO" */
  statusLabel: string
  /** Ex: "PERDIDO" — cor do badge */
  statusColor: string
  /** Ex: "01/05/2026" */
  date: string
  /** Ex: "Rua Cônego Valadão, Guarulhos" — máx 60 chars, omitido se vazio */
  locationShort: string
  /** Recompensa formatada, ex: "R$ 200,00" — vazio se não houver */
  reward: string
  /** URL do QR Code */
  qrUrl: string
  /** URL da foto do objeto */
  photoUrl: string | null
}

// ---------------------------------------------------------------------------
// Mapeamentos controlados
// ---------------------------------------------------------------------------

const STATUS_MAP: Record<string, { eyebrow: string; label: string; color: string }> = {
  lost:               { eyebrow: 'PERDI',        label: 'PERDIDO',    color: '#e53e3e' },
  found:              { eyebrow: 'ENCONTREI',     label: 'ENCONTRADO', color: '#38a169' },
  stolen:             { eyebrow: 'ROUBARAM',      label: 'ROUBADO',    color: '#c53030' },
  stolen_pickpocket:  { eyebrow: 'FURTARAM',      label: 'FURTADO',    color: '#c53030' },
  in_possession:      { eyebrow: 'TENHO EM MÃO',  label: 'EM POSSE',   color: '#d69e2e' },
  returned:           { eyebrow: 'DEVOLVIDO',     label: 'DEVOLVIDO',  color: '#38a169' },
  protected:          { eyebrow: 'PROTEGIDO',     label: 'PROTEGIDO',  color: '#3182ce' },
}

/**
 * Mapeia categoria + status → headline curta controlada (máx 24 chars)
 * Fallback: usa CATEGORY_LABEL[category] + " " + STATUS_MAP[status].label
 */
const HEADLINE_MAP: Record<string, Record<string, string>> = {
  pet: {
    lost:              'ANIMAL PERDIDO',
    found:             'ANIMAL ENCONTRADO',
    stolen:            'ANIMAL ROUBADO',
    stolen_pickpocket: 'ANIMAL FURTADO',
    in_possession:     'ANIMAL EM POSSE',
    returned:          'ANIMAL DEVOLVIDO',
    protected:         'ANIMAL PROTEGIDO',
  },
  dog: {
    lost:              'CACHORRO PERDIDO',
    found:             'CACHORRO ENCONTRADO',
    stolen:            'CACHORRO ROUBADO',
    stolen_pickpocket: 'CACHORRO FURTADO',
    in_possession:     'CACHORRO EM POSSE',
    returned:          'CACHORRO DEVOLVIDO',
    protected:         'CACHORRO PROTEGIDO',
  },
  cat: {
    lost:              'GATO PERDIDO',
    found:             'GATO ENCONTRADO',
    stolen:            'GATO ROUBADO',
    stolen_pickpocket: 'GATO FURTADO',
    in_possession:     'GATO EM POSSE',
    returned:          'GATO DEVOLVIDO',
    protected:         'GATO PROTEGIDO',
  },
  phone: {
    lost:              'CELULAR PERDIDO',
    found:             'CELULAR ENCONTRADO',
    stolen:            'CELULAR ROUBADO',
    stolen_pickpocket: 'CELULAR FURTADO',
    in_possession:     'CELULAR EM POSSE',
    returned:          'CELULAR DEVOLVIDO',
    protected:         'CELULAR PROTEGIDO',
  },
  wallet: {
    lost:              'CARTEIRA PERDIDA',
    found:             'CARTEIRA ENCONTRADA',
    stolen:            'CARTEIRA ROUBADA',
    stolen_pickpocket: 'CARTEIRA FURTADA',
    in_possession:     'CARTEIRA EM POSSE',
    returned:          'CARTEIRA DEVOLVIDA',
    protected:         'CARTEIRA PROTEGIDA',
  },
  bag: {
    lost:              'BOLSA PERDIDA',
    found:             'BOLSA ENCONTRADA',
    stolen:            'BOLSA ROUBADA',
    stolen_pickpocket: 'BOLSA FURTADA',
    in_possession:     'BOLSA EM POSSE',
    returned:          'BOLSA DEVOLVIDA',
    protected:         'BOLSA PROTEGIDA',
  },
  backpack: {
    lost:              'MOCHILA PERDIDA',
    found:             'MOCHILA ENCONTRADA',
    stolen:            'MOCHILA ROUBADA',
    stolen_pickpocket: 'MOCHILA FURTADA',
    in_possession:     'MOCHILA EM POSSE',
    returned:          'MOCHILA DEVOLVIDA',
    protected:         'MOCHILA PROTEGIDA',
  },
  keys: {
    lost:              'CHAVES PERDIDAS',
    found:             'CHAVES ENCONTRADAS',
    stolen:            'CHAVES ROUBADAS',
    stolen_pickpocket: 'CHAVES FURTADAS',
    in_possession:     'CHAVES EM POSSE',
    returned:          'CHAVES DEVOLVIDAS',
    protected:         'CHAVES PROTEGIDAS',
  },
  document: {
    lost:              'DOCUMENTOS PERDIDOS',
    found:             'DOCUMENTOS ENCONTRADOS',
    stolen:            'DOCUMENTOS ROUBADOS',
    stolen_pickpocket: 'DOCUMENTOS FURTADOS',
    in_possession:     'DOCUMENTOS EM POSSE',
    returned:          'DOCUMENTOS DEVOLVIDOS',
    protected:         'DOCUMENTOS PROTEGIDOS',
  },
  vehicle: {
    lost:              'VEÍCULO PERDIDO',
    found:             'VEÍCULO ENCONTRADO',
    stolen:            'VEÍCULO ROUBADO',
    stolen_pickpocket: 'VEÍCULO FURTADO',
    in_possession:     'VEÍCULO EM POSSE',
    returned:          'VEÍCULO DEVOLVIDO',
    protected:         'VEÍCULO PROTEGIDO',
  },
  bike: {
    lost:              'BICICLETA PERDIDA',
    found:             'BICICLETA ENCONTRADA',
    stolen:            'BICICLETA ROUBADA',
    stolen_pickpocket: 'BICICLETA FURTADA',
    in_possession:     'BICICLETA EM POSSE',
    returned:          'BICICLETA DEVOLVIDA',
    protected:         'BICICLETA PROTEGIDA',
  },
  laptop: {
    lost:              'NOTEBOOK PERDIDO',
    found:             'NOTEBOOK ENCONTRADO',
    stolen:            'NOTEBOOK ROUBADO',
    stolen_pickpocket: 'NOTEBOOK FURTADO',
    in_possession:     'NOTEBOOK EM POSSE',
    returned:          'NOTEBOOK DEVOLVIDO',
    protected:         'NOTEBOOK PROTEGIDO',
  },
  watch: {
    lost:              'RELÓGIO PERDIDO',
    found:             'RELÓGIO ENCONTRADO',
    stolen:            'RELÓGIO ROUBADO',
    stolen_pickpocket: 'RELÓGIO FURTADO',
    in_possession:     'RELÓGIO EM POSSE',
    returned:          'RELÓGIO DEVOLVIDO',
    protected:         'RELÓGIO PROTEGIDO',
  },
  jewelry: {
    lost:              'JOIA PERDIDA',
    found:             'JOIA ENCONTRADA',
    stolen:            'JOIA ROUBADA',
    stolen_pickpocket: 'JOIA FURTADA',
    in_possession:     'JOIA EM POSSE',
    returned:          'JOIA DEVOLVIDA',
    protected:         'JOIA PROTEGIDA',
  },
  glasses: {
    lost:              'ÓCULOS PERDIDOS',
    found:             'ÓCULOS ENCONTRADOS',
    stolen:            'ÓCULOS ROUBADOS',
    stolen_pickpocket: 'ÓCULOS FURTADOS',
    in_possession:     'ÓCULOS EM POSSE',
    returned:          'ÓCULOS DEVOLVIDOS',
    protected:         'ÓCULOS PROTEGIDOS',
  },
  camera: {
    lost:              'CÂMERA PERDIDA',
    found:             'CÂMERA ENCONTRADA',
    stolen:            'CÂMERA ROUBADA',
    stolen_pickpocket: 'CÂMERA FURTADA',
    in_possession:     'CÂMERA EM POSSE',
    returned:          'CÂMERA DEVOLVIDA',
    protected:         'CÂMERA PROTEGIDA',
  },
  tablet: {
    lost:              'TABLET PERDIDO',
    found:             'TABLET ENCONTRADO',
    stolen:            'TABLET ROUBADO',
    stolen_pickpocket: 'TABLET FURTADO',
    in_possession:     'TABLET EM POSSE',
    returned:          'TABLET DEVOLVIDO',
    protected:         'TABLET PROTEGIDO',
  },
  card: {
    lost:              'CARTÃO PERDIDO',
    found:             'CARTÃO ENCONTRADO',
    stolen:            'CARTÃO ROUBADO',
    stolen_pickpocket: 'CARTÃO FURTADO',
    in_possession:     'CARTÃO EM POSSE',
    returned:          'CARTÃO DEVOLVIDO',
    protected:         'CARTÃO PROTEGIDO',
  },
}

const CATEGORY_LABEL: Record<string, string> = {
  pet:        'Pet',
  dog:        'Cachorro',
  cat:        'Gato',
  phone:      'Celular',
  wallet:     'Carteira',
  bag:        'Bolsa',
  backpack:   'Mochila',
  keys:       'Chaves',
  document:   'Documento',
  vehicle:    'Veículo',
  bike:       'Bicicleta',
  laptop:     'Notebook',
  watch:      'Relógio',
  jewelry:    'Joia',
  glasses:    'Óculos',
  camera:     'Câmera',
  tablet:     'Tablet',
  card:       'Cartão',
  other:      'Objeto',
}

// ---------------------------------------------------------------------------
// Utilitários
// ---------------------------------------------------------------------------

/** Trunca texto com reticências se ultrapassar o limite */
function clip(text: string, max: number): string {
  if (!text) return ''
  const t = text.trim()
  return t.length <= max ? t : t.slice(0, max - 1).trimEnd() + '…'
}

/** Extrai endereço curto do campo location (JSON ou texto) */
function locationToText(location: unknown): string {
  if (!location) return ''
  if (typeof location === 'string') {
    try {
      const parsed = JSON.parse(location)
      return parsed?.address ?? location
    } catch {
      return location
    }
  }
  if (typeof location === 'object' && location !== null) {
    const loc = location as Record<string, unknown>
    return (loc.address as string) ?? ''
  }
  return ''
}

/** Formata recompensa em BRL */
function moneyBRL(value: number | null | undefined): string {
  if (!value || value <= 0) return ''
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}

// ---------------------------------------------------------------------------
// buildPosterData — função principal
// ---------------------------------------------------------------------------

export interface RawObject {
  title: string
  description?: string | null
  category?: string | null
  status?: string | null
  created_at?: string | null
  location?: unknown
  reward?: number | null
  qr_code?: string | null
  photo_url?: string | null
}

export function buildPosterData(obj: RawObject, appUrl: string): PosterData {
  const category = (obj.category ?? 'other').toLowerCase()
  const status   = (obj.status   ?? 'lost').toLowerCase()

  const statusInfo  = STATUS_MAP[status]   ?? STATUS_MAP['lost']
  const headlineRaw = HEADLINE_MAP[category]?.[status]
    ?? `${(CATEGORY_LABEL[category] ?? 'OBJETO').toUpperCase()} ${statusInfo.label}`

  // Headline: nunca mais de 24 chars — mas os valores do mapa já respeitam isso
  const headline = headlineRaw.toUpperCase()

  // Subtítulo: primeiros 40 chars do título livre do usuário
  const subtitle = clip(obj.title ?? '', 40)

  // Descrição: primeiros 120 chars
  const description = clip(obj.description ?? '', 120)

  // Endereço curto: primeiros 60 chars
  const locationFull = locationToText(obj.location)
  const locationShort = clip(locationFull, 60)

  // Data formatada
  const date = obj.created_at
    ? new Date(obj.created_at).toLocaleDateString('pt-BR')
    : ''

  // Recompensa
  const reward = moneyBRL(obj.reward)

  // QR URL
  const qrUrl = obj.qr_code
    ? `${appUrl}/scan/${obj.qr_code}`
    : appUrl

  return {
    headline,
    eyebrow:       statusInfo.eyebrow,
    subtitle,
    description,
    categoryLabel: CATEGORY_LABEL[category] ?? 'Objeto',
    statusLabel:   statusInfo.label,
    statusColor:   statusInfo.color,
    date,
    locationShort,
    reward,
    qrUrl,
    photoUrl:      obj.photo_url ?? null,
  }
}
