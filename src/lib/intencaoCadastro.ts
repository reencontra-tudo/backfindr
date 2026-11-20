// Quem JÁ está logado e chega numa tela de entrada (/auth/register, /auth/login) com `intent` (vindo dos fluxos /flow/*, da home e do Feed) deve ir ao
// formulário de ocorrência com a intenção e o pré-preenchimento preservados, e não ao painel (onde tudo se perdia).
// SEGURANÇA: o destino NUNCA vem da URL. É sempre `/dashboard/objects/new?` + parâmetros de uma lista fechada, re-codificados aqui, com valores limitados.

/** Intenções que o formulário entende (as chaves de INTENT_MAP em src/app/dashboard/objects/new/page.tsx; um teste confere). Outra intenção: comportamento de sempre. */
export const INTENCOES_VALIDAS = ['lost', 'found', 'stolen', 'protect', 'pet'] as const;

/** Os ÚNICOS parâmetros repassados, nesta ordem (os mesmos que o formulário lê). Qualquer outro (inclusive `prefill_name`, que só o cadastro usa) é descartado. */
export const PARAMS_DO_FORMULARIO = ['intent', 'prefill_title', 'prefill_category', 'prefill_location', 'prefill_breed', 'prefill_color'] as const;

const LIMITE: Record<(typeof PARAMS_DO_FORMULARIO)[number], number> = {
  intent: 20, prefill_title: 200, prefill_category: 30, prefill_location: 300, prefill_breed: 80, prefill_color: 40,
};

// eslint-disable-next-line no-control-regex
const CONTROLE = /[\u0000-\u001f\u007f]/g;

function limpo(valor: string | null, max: number): string {
  if (typeof valor !== 'string') return '';
  return Array.from(valor.replace(CONTROLE, ' ').trim()).slice(0, max).join('').trim();   // por caractere (não corta um emoji ao meio)
}

/**
 * Destino de quem já tem sessão e chegou com `intent`; `null` se não houver `intent` ou se ele não for conhecido (aí vale o comportamento de sempre).
 * Ex.: ?intent=lost&prefill_title=Meu%20cachorro&x=1 → /dashboard/objects/new?intent=lost&prefill_title=Meu+cachorro
 */
export function destinoLogadoComIntent(params: { get: (nome: string) => string | null }): string | null {
  const intent = limpo(params.get('intent'), LIMITE.intent);
  if (!(INTENCOES_VALIDAS as readonly string[]).includes(intent)) return null;
  const q = new URLSearchParams();
  q.set('intent', intent);
  for (const nome of PARAMS_DO_FORMULARIO) {
    if (nome === 'intent') continue;
    let v = limpo(params.get(nome), LIMITE[nome]);
    if (nome === 'prefill_category' && !/^[A-Za-z_-]{1,30}$/.test(v)) v = '';   // categoria é um slug simples
    if (v) q.set(nome, v);
  }
  return `/dashboard/objects/new?${q.toString()}`;
}
