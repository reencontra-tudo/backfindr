// Lista ÚNICA das rotinas agendadas que o vigia confere. Para vigiar mais uma, acrescente um item aqui, grave a marca na rota (comMarca em src/lib/rotinaMarca.ts)
// e confirme que alguém realmente a agenda: o vigia alerta quando a marca fica velha, então vigiar uma rotina SEM agendador geraria aviso permanente.
//
// Hoje só estão aqui as rotinas AGENDADAS (decisão do Marcos): matching, lembretes de «encontrei» e ingestão de sinais.
// Rotinas sem agendador (lifecycle, reactivation, social-posts, chat-unread-email, analytics/snapshot, marketing/search/cron, emails/boost-expiration) NÃO entram:
// reagendá-las é decisão do Marcos, à parte.

export interface RotinaEsperada {
  /** Nome curto e estável gravado na marca (não mude depois: as marcas antigas ficam com o nome antigo). */
  id: string;
  /** Nome em português, para o texto do aviso. */
  nome: string;
  /** Rota chamada pelo agendador. */
  rota: string;
  /** Frequência esperada, só para documentação e texto. */
  frequencia: string;
  /** Idade máxima da última marca, em minutos, antes de o vigia avisar. */
  limiteMinutos: number;
  /** O que olhar primeiro, em português simples (entra no aviso). */
  oQueOlhar: string;
}

const HORA = 60;

export const ROTINAS_ESPERADAS: readonly RotinaEsperada[] = [
  {
    id: 'matching',
    nome: 'Matching automático',
    rota: '/api/v1/cron/matching',
    frequencia: 'a cada 15 minutos',
    limiteMinutos: 45,
    oQueOlhar: 'o fluxo «Backfindr Matching - Cron 15 min» no n8n (está ativo? a última execução deu erro?), a credencial do n8n e o CRON_SECRET na Vercel',
  },
  {
    id: 'found-pending-reminders',
    nome: 'Lembretes de «encontrei»',
    rota: '/api/v1/cron/found-pending-reminders',
    frequencia: 'uma vez por dia',
    limiteMinutos: 36 * HORA,
    oQueOlhar: 'o fluxo «Backfindr Found Pending — Lembretes e Timeout» no n8n, a credencial do n8n e o CRON_SECRET na Vercel',
  },
  {
    id: 'ingestao-sinais',
    nome: 'Ingestão diária de sinais públicos',
    rota: '/api/v1/admin/public-signals/ingest',
    frequencia: 'uma vez por dia',
    limiteMinutos: 36 * HORA,
    oQueOlhar: 'o fluxo «Backfindr Public Signals — Ingestão Diária» no n8n, a credencial do n8n e o SIGNALS_CRON_SECRET na Vercel',
  },
];

/** Depois de quanto tempo uma rotina que NUNCA registrou marca vira aviso (contado desde a marca mais antiga da tabela). */
export const HORAS_ATE_AVISAR_ROTINA_SEM_MARCA = 48;
/** Intervalo mínimo entre dois avisos de FALHA da mesma rotina. */
export const HORAS_ENTRE_AVISOS_DA_MESMA_ROTINA = 6;

export type RotinaId = (typeof ROTINAS_ESPERADAS)[number]['id'];
