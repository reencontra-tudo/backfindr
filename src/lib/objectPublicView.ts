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

// Textos que viram IMAGEM ou texto de compartilhamento (cartaz / pré-visualização no WhatsApp e redes).
// Mesma regra: só SINAL PÚBLICO tem o nome de pessoa mascarado; usuário e legado recebem o MESMO objeto de volta.
// A máscara é aplicada ANTES de qualquer corte de tamanho (o cartaz corta o título em 40 caracteres).
export function maskSharedTexts<T extends { title?: string | null; description?: string | null; location?: unknown }>(
  source: string | null | undefined, texts: T,
): T {
  if (source !== 'public_signal') return texts;
  return {
    ...texts,
    title: typeof texts.title === 'string' ? maskPersonNames(texts.title) : texts.title,
    description: typeof texts.description === 'string' ? maskPersonNames(texts.description) : texts.description,
    location: typeof texts.location === 'string' ? maskPersonNames(texts.location) : texts.location,
  };
}

/**
 * SINAL PÚBLICO: a descrição vem da ingestão terminando em «Fonte: <endereço da notícia>». O endereço pode trazer nome de pessoa no próprio
 * caminho («…documento-em-nome-de-<nome>…»), que a máscara de nomes (feita para texto com espaços) não reconhece. Para o TEXTO VISÍVEL da página,
 * o endereço sai: quem quer a fonte usa o botão «Ver a notícia original» (com o nome do veículo). Usuário e legado: não use esta função.
 * Só tira endereços http(s) e o rótulo «Fonte:» que os antecede; o resto da descrição fica como está.
 */
export function semEnderecoDeFonte(description: string | null | undefined): string {
  if (!description) return '';
  return String(description)
    .replace(/\s*Fonte:\s*https?:\/\/\S*/gi, '')
    .replace(/https?:\/\/\S+/gi, '')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

/**
 * Saída das APIs públicas de LISTA (/api/v1/objects/public e o apoio do passo 2): para SINAL PÚBLICO devolve título, descrição e endereço do local
 * com a máscara de nome de pessoa e SEM o «Fonte: <endereço da notícia>» (o endereço pode trazer nome no caminho).
 * Regra de uso: chamar DEPOIS de filtrar, pontuar, ordenar e cortar a lista. O casamento da busca e a pontuação usam o texto ORIGINAL no servidor;
 * só o que sai na resposta é mascarado. Usuário e legado: devolve o MESMO objeto (mesma referência).
 */
export function maskSignalForPublicApi<T extends object>(item: T): T {
  if (!item || (item as { source?: unknown }).source !== 'public_signal') return item;
  const m = maskObjectForPublicPage(item as unknown as PublicObjectLike) as PublicObjectLike;
  return { ...m, description: typeof m.description === 'string' ? semEnderecoDeFonte(m.description) : m.description } as T;
}
