// Medição do Feed (PostHog). NENHUM dado pessoal: sem código de objeto, título, local, cidade ou usuário.
// Só valores de um conjunto pequeno e fixo. Falha em silêncio (PostHog ausente/bloqueado não quebra a tela).
import posthog from 'posthog-js';

type Props = Record<string, string | number | boolean>;

function send(event: string, props?: Props) {
  try {
    if (typeof window === 'undefined' || !(posthog as unknown as { __loaded?: boolean }).__loaded) return;
    posthog.capture(event, props);
  } catch { /* sem medição, sem problema */ }
}

export type FeedOrigemItem = 'usuario' | 'sinal_publico';

/** Origem da visita: ?ref=... (só letras/números curtos) ou o tipo do referrer; nunca a URL inteira. */
export function feedOrigin(): string {
  try {
    const ref = new URLSearchParams(window.location.search).get('ref');
    if (ref && /^[a-z0-9_-]{1,24}$/i.test(ref)) return ref.toLowerCase();
    if (!document.referrer) return 'direto';
    const host = new URL(document.referrer).hostname;
    if (host === window.location.hostname) return 'interno';
    if (/(^|\.)(google|bing|duckduckgo|yahoo)\./.test(host)) return 'busca';
    return 'externo';
  } catch { return 'direto'; }
}

export type FeedCtaPosicao = 'topo' | 'fixo' | 'cabecalho' | 'fim';

// Cliques nos acessos ao cadastro (sem dado pessoal): `origem` = como a pessoa chegou (igual ao feed_aberto),
// `posicao` = onde na página clicou, `pagina` = número da página do Feed.
const cta = (event: string, posicao: FeedCtaPosicao, pagina: number) => send(event, { origem: feedOrigin(), posicao, pagina });

export const feedEvents = {
  ctaPerdi: (posicao: FeedCtaPosicao, pagina: number) => cta('feed_cta_perdi', posicao, pagina),
  ctaEncontrei: (posicao: FeedCtaPosicao, pagina: number) => cta('feed_cta_encontrei', posicao, pagina),
  ctaRoubado: (posicao: FeedCtaPosicao, pagina: number) => cta('feed_cta_roubado', posicao, pagina),
  /** Botão «+ Cadastrar ocorrência» (fixo no celular / no cabeçalho no desktop): conta ao ABRIR o menu. */
  ctaCadastrar: (posicao: FeedCtaPosicao, pagina: number) => cta('feed_cta_cadastrar', posicao, pagina),

  aberto: (origem: string) => send('feed_aberto', { origem }),
  filtroAplicado: (filtro: 'situacao' | 'categoria' | 'regiao', valor: string) => send('feed_filtro_aplicado', { filtro, valor }),
  cardAberto: (origem_item: FeedOrigemItem) => send('feed_card_aberto', { origem_item }),
  compartilhar: (origem_item: FeedOrigemItem) => send('feed_compartilhar', { origem_item }),
  informarEncontreiClique: () => send('feed_informar_encontrei_clique', { origem_item: 'usuario' }),
};
