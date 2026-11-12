// Vista pública do objeto em /objeto/[code] (HTML que o Google lê).
//
// SINAL PÚBLICO (source = 'public_signal', vindo de notícia/canal institucional) pode trazer nome de pessoa no
// título («Documento encontrado em nome de <nome completo>»). Antes de gerar o HTML (título da aba, h1, meta,
// Open Graph, JSON-LD e o JSON que o Next embute na página), o nome é trocado por «(nome omitido)».
//
// Objetos de USUÁRIOS e do LEGADO NÃO são tocados: devolve exatamente o mesmo objeto recebido (mesma referência).
import { maskPersonNames } from '@/lib/privacy/maskPersonNames';

interface PublicObjectLike {
  source?: string | null;
  title?: string | null;
  description?: string | null;
  location?: { address?: string | null } | null;
  [k: string]: unknown;
}

export function maskObjectForPublicPage<T extends PublicObjectLike | null | undefined>(obj: T): T {
  if (!obj || obj.source !== 'public_signal') return obj;
  const location = obj.location && typeof obj.location === 'object' && typeof obj.location.address === 'string'
    ? { ...obj.location, address: maskPersonNames(obj.location.address) }
    : obj.location;
  return {
    ...obj,
    title: typeof obj.title === 'string' ? maskPersonNames(obj.title) : obj.title,
    description: typeof obj.description === 'string' ? maskPersonNames(obj.description) : obj.description,
    location,
  } as T;
}
