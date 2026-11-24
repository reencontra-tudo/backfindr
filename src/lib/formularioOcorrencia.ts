// Regras de passos e de erros do formulário «Registrar Ocorrência» (/dashboard/objects/new), em funções puras e testáveis.
// Passos: 0 Categoria · 1 Status · 2 Detalhes · 3 Localização.

export type ModoFormulario = 'choose' | 'protect' | 'report';
export interface PresetIntencao { category?: string; status?: string; startStep?: number; mode?: 'protect' | 'report' }

export const PASSO_CATEGORIA = 0, PASSO_STATUS = 1, PASSO_DETALHES = 2, PASSO_LOCALIZACAO = 3, TOTAL_PASSOS = 4;

/** O intent (found/lost/stolen/pet) já define o status: o passo Status não é perguntado de novo (como no modo protect). */
export const statusDefinidoPeloIntent = (p: PresetIntencao): boolean => p.mode === 'report' && Boolean(p.status);

/**
 * Passo em que o formulário abre. Sem intent: o de sempre (`startStep`). Com intent de «reportar» que define o status:
 * Categoria (ainda desconhecida) ou, se a categoria já veio do fluxo (keys, wallet, vehicle, pet…), direto em Detalhes.
 */
export function passoInicial(preset: PresetIntencao, categoriaConhecida: boolean): number {
  if (statusDefinidoPeloIntent(preset)) return categoriaConhecida || Boolean(preset.category) ? PASSO_DETALHES : PASSO_CATEGORIA;
  return preset.startStep ?? 0;
}

const pulaStatus = (modo: ModoFormulario, statusDoIntent: boolean) => modo === 'protect' || statusDoIntent;
export const proximoPasso = (atual: number, modo: ModoFormulario, statusDoIntent: boolean): number => {
  const prox = atual + 1;
  if (pulaStatus(modo, statusDoIntent) && prox === PASSO_STATUS) return PASSO_DETALHES;
  return Math.min(prox, TOTAL_PASSOS - 1);
};
export const passoAnterior = (atual: number, modo: ModoFormulario, statusDoIntent: boolean): number => {
  const ant = atual - 1;
  if (pulaStatus(modo, statusDoIntent) && ant === PASSO_STATUS) return PASSO_CATEGORIA;
  return Math.max(ant, 0);
};

/** Descrição pré-preenchida com o título que veio de um fluxo, só se já tiver o mínimo do formulário (10 caracteres); senão, vazia (o aviso explica). */
export const DESCRICAO_MIN = 10;
export function descricaoDoTitulo(titulo: string): string {
  const t = (titulo ?? '').trim();
  return t.length >= DESCRICAO_MIN ? t : '';
}

// ─── Envio inválido nunca é silencioso ───────────────────────────────────────
const PASSO_DO_CAMPO: Record<string, number> = {
  category: PASSO_CATEGORIA, status: PASSO_STATUS, title: PASSO_DETALHES, description: PASSO_DETALHES,
  lat: PASSO_LOCALIZACAO, lng: PASSO_LOCALIZACAO, address: PASSO_LOCALIZACAO,
};
const MENSAGEM_DO_CAMPO: Record<string, string> = {
  category: 'Falta escolher a categoria',
  status: 'Falta escolher o que aconteceu (perdi, encontrei ou roubado)',
  title: 'Falta o título (mínimo 3 letras)',
  description: 'Falta a descrição (mínimo 10 letras)',
};

export interface ErroDeEnvio { passo: number; mensagens: string[]; campoParaFocar: 'title' | 'description' | null }

/** Do conjunto de campos com erro: a que passo levar (o primeiro que tem erro), o que dizer e qual campo focar. */
export function resumirErros(erros: Record<string, { message?: string } | undefined>, modo: ModoFormulario, statusDoIntent: boolean): ErroDeEnvio {
  const campos = Object.keys(erros).filter((c) => erros[c]);
  const passoDe = (c: string) => {
    const p = PASSO_DO_CAMPO[c] ?? PASSO_DETALHES;                     // campo extra (pet, documento, recompensa…) vive em Detalhes
    return p === PASSO_STATUS && pulaStatus(modo, statusDoIntent) ? PASSO_CATEGORIA : p;   // status nunca é perguntado nesses modos: leva à Categoria
  };
  const ORDEM = ['category', 'status', 'title', 'description'];   // dentro do mesmo passo: na ordem em que aparecem na tela
  const pos = (c: string) => { const i = ORDEM.indexOf(c); return i < 0 ? ORDEM.length : i; };
  const ordenados = [...campos].sort((a, b) => passoDe(a) - passoDe(b) || pos(a) - pos(b));
  const primeiro = ordenados[0];
  const passo = primeiro ? passoDe(primeiro) : PASSO_DETALHES;
  const mensagens = ordenados.map((c) => MENSAGEM_DO_CAMPO[c] ?? erros[c]?.message ?? 'Revise os campos');
  const campoParaFocar = passo === PASSO_DETALHES && (primeiro === 'title' || primeiro === 'description') ? primeiro : null;
  return { passo, mensagens: [...new Set(mensagens)], campoParaFocar };
}

// ─── Categoria «Animal» (criação/trabalho): espécie e cor/pelagem são essenciais ─────────────────────────────────
/** Só para a categoria `animal`. Devolve os campos que faltam (no formato de erros do formulário) ou null. Qualquer outra categoria: sempre null (nada muda para elas). */
export function faltasDoAnimal(categoria: string | undefined, valores: Record<string, unknown>): Record<string, { message: string }> | null {
  if (categoria !== 'animal') return null;
  const vazio = (v: unknown) => typeof v !== 'string' || v.trim() === '';
  const faltas: Record<string, { message: string }> = {};
  if (vazio(valores.animal_species)) faltas.animal_species = { message: 'Falta a espécie do animal' };
  if (vazio(valores.animal_color)) faltas.animal_color = { message: 'Falta a cor ou pelagem do animal' };
  return Object.keys(faltas).length ? faltas : null;
}

// ─── Campos específicos da categoria no ENVIO (PR A, 24/11/2026) ───────────────────────────────────────────────
// Histórico: o formulário mostra os campos de `config/categoryFields.ts` desde 20/05/2026, mas o envio só levava os de pet e documento; marca, modelo, IMEI, placa etc.
// se perdiam em silêncio. Agora TODOS os campos exibidos de uma categoria vão no corpo (o servidor guarda o que não é campo conhecido em `category_fields`).
// Documento fica de fora: tem envio próprio (`document_*`, com regras de privacidade).
import { getAllFieldsForCategory } from '@/config/categoryFields';

/** Valor a enviar: texto não vazio (aparado) ou número finito. Vazio, nulo e indefinido = não envia (como sempre). */
const valorParaEnvio = (v: unknown): string | number | null => {
  if (typeof v === 'string') { const t = v.trim(); return t === '' ? null : t; }
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  return null;
};

/** Campos específicos da categoria que têm valor, no formato do corpo do envio. Categoria sem configuração ou `document`: `{}`. */
export function camposEspecificosParaEnvio(categoria: string | undefined, valores: Record<string, unknown>): Record<string, string | number> {
  if (!categoria || categoria === 'document') return {};
  const out: Record<string, string | number> = {};
  for (const f of getAllFieldsForCategory(categoria)) {
    const v = valorParaEnvio(valores[f.name]);
    if (v !== null) out[f.name] = v;
  }
  return out;
}

