// Funções puras da área de mensagens usadas pela tela (sem banco; seguras para o navegador).
export type FiltroAba = 'aguardando_voce' | 'aguardando_dono' | 'abertas' | 'encerradas';

/**
 * Aba inicial da lista «Mensagens»: a que tem algo novo ou pendente.
 * 1º «Aguardando você» (aviso esperando a decisão do dono); 2º «Abertas» com mensagem não lida; senão, a de sempre («Aguardando você»).
 */
export function abaInicial(conversas: { estado: string; papel: string; nao_lidas: number }[]): FiltroAba {
  if (conversas.some((c) => c.estado === 'aguardando' && c.papel === 'dono')) return 'aguardando_voce';
  if (conversas.some((c) => c.estado === 'aberta' && c.nao_lidas > 0)) return 'abertas';
  return 'aguardando_voce';
}

/**
 * Quantos objetos do usuário têm sinalização REAL de «alguém pode ter encontrado» (marca found_pending_confirmation, que vem do «É o meu» do dono).
 * Objetos com status «found» são os que a própria pessoa registrou como «encontrei»: não contam (o aviso dizia, por engano, que alguém encontrou algo dela).
 */
export function sinalizadosReais(objetos: { status: string; found_pending_confirmation?: boolean | null }[]): number {
  return objetos.filter((o) => o.status !== 'found' && o.found_pending_confirmation === true).length;
}
