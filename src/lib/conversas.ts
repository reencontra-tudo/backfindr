// Área de mensagens entre quem achou (achador, SEMPRE com conta) e o dono. Fase 1.
//
// Regras (decisões do Marcos): sem aceite do dono não há conversa; o objeto NÃO muda quando o aviso chega nem quando o dono
// aceita — só quando o dono diz «É o meu» (aí o objeto vira «achado pendente»); legado pode ser dono (a linha nova aponta,
// nada do legado é alterado); nada é enviado a dono legado (sem push, sem e-mail, sem notificação no sino).
// Funciona só com MENSAGENS_ATIVO=1 (e as tabelas da migration 025). Sem a chave, o aviso «encontrei» segue como antes.
import { query } from '@/lib/db';

export const MENSAGENS_ATIVO = (): boolean => process.env.MENSAGENS_ATIVO === '1';

/** Título sem espaços nas pontas, só para montar textos (o título gravado no banco não é alterado). Vazio vira «seu objeto». */
export const tituloLimpo = (t: string | null | undefined): string => (typeof t === 'string' ? t.trim() : '') || 'seu objeto';

// Limites básicos (Fase 1)
export const LIMITE_PRIMEIRA_MENSAGEM = 280;
export const LIMITE_MENSAGEM = 2000;
export const LIMITE_AVISOS_NOVOS_POR_DIA = 5;
export const LIMITE_MENSAGENS_POR_MINUTO = 20;
export const PAUSA_POR_OBJETO_MIN = 15;
// Prazos
export const DIAS_SEM_RESPOSTA = 30;          // o achador passa a ver «sem resposta»
export const MESES_PARA_DONO_ACEITAR = 12;    // o dono ainda pode aceitar
export const DIAS_ABERTA_PARADA = 30;         // conversa aberta parada vira arquivada
export const MESES_GUARDA_APOS_ENCERRAR = 12; // retencao_ate (nenhum apagamento nesta fase)
export const MESES_GUARDA_DISPUTA = 36;

export type Estado = 'aguardando' | 'aberta' | 'recusada' | 'encerrada' | 'cancelada' | 'arquivada' | 'bloqueada';
export const ESTADOS_ATIVOS: Estado[] = ['aguardando', 'aberta'];
export type Filtro = 'aguardando_voce' | 'aguardando_dono' | 'abertas' | 'encerradas';

export const TEXTOS = {
  avisoDono: (titulo: string) => `Alguém avisou que pode ter encontrado "${tituloLimpo(titulo)}". Veja o aviso e decida se quer conversar.`,
  tituloAvisoDono: '🔔 Aviso sobre o seu objeto',
  aceitar: 'Ao aceitar, vocês trocam mensagens aqui, dentro do Backfindr. Não envie telefone, e-mail nem endereço.',
  recusadaParaAchador: 'A pessoa informou que este objeto não é dela.',
  encerrada: 'Conversa encerrada.',
  aguardando: 'Seu aviso foi registrado. Não há garantia de resposta.',
  aceitaParaAchador: 'O dono aceitou conversar. Vocês podem trocar mensagens agora.',
  pushMensagem: 'Você tem uma nova mensagem no Backfindr.',
  tituloMensagem: '💬 Nova mensagem',
  tituloEOMeu: 'O dono respondeu ao seu aviso',
  eOMeu: 'O dono confirmou que o objeto é dele.',
  tituloCancelado: 'Aviso cancelado',
  cancelado: (titulo: string) => `Quem avisou cancelou o aviso sobre "${tituloLimpo(titulo)}".`,
  tituloEncerrada: 'Conversa encerrada',
  encerradaDevolvido: 'O dono confirmou a devolução. Conversa encerrada.',
} as const;

export const ehTabelaAusente = (e: unknown): boolean => {
  const code = typeof e === 'object' && e !== null ? (e as { code?: string }).code : undefined;
  return code === '42P01';
};

export interface Conversa {
  id: string; object_id: string | null; objeto_titulo: string | null; achador_id: string | null; dono_id: string | null;
  estado: Estado; primeira_mensagem: string; criada_em: string; aceita_em: string | null; confirmado_dono_em: string | null;
  encerrada_em: string | null; motivo: string | null; ultima_atividade: string; retencao_ate: string | null; em_disputa: boolean;
}

export const meses = (n: number): string => `NOW() + INTERVAL '${Math.trunc(n)} months'`;

/** Papel do usuário na conversa: 'dono', 'achador' ou null (não é parte). */
export function papelNaConversa(c: Pick<Conversa, 'achador_id' | 'dono_id'>, userId: string): 'dono' | 'achador' | null {
  if (c.dono_id && c.dono_id === userId) return 'dono';
  if (c.achador_id && c.achador_id === userId) return 'achador';
  return null;
}

/** Estado que o usuário VÊ (derivado): aguardando há mais de 30 dias aparece como «sem resposta» para o achador. */
export function estadoVisivel(c: Pick<Conversa, 'estado' | 'criada_em'>, agora: Date = new Date()): Estado | 'sem_resposta' {
  if (c.estado === 'aguardando' && agora.getTime() - new Date(c.criada_em).getTime() > DIAS_SEM_RESPOSTA * 86400000) return 'sem_resposta';
  return c.estado;
}

/** O dono ainda pode aceitar até 12 meses depois do aviso. */
export function donoAindaPodeAceitar(c: Pick<Conversa, 'criada_em'>, agora: Date = new Date()): boolean {
  const limite = new Date(c.criada_em); limite.setMonth(limite.getMonth() + MESES_PARA_DONO_ACEITAR);
  return agora.getTime() <= limite.getTime();
}

export type Acao = 'aceitar' | 'recusar' | 'e_o_meu' | 'enviar' | 'encerrar_devolvido' | 'encerrar_desisti' | 'cancelar';
/** Matriz estado × ator: quem pode fazer o quê. Fonte única usada pelas rotas e pelos testes. */
export function podeFazer(c: Pick<Conversa, 'estado' | 'confirmado_dono_em'>, papel: 'dono' | 'achador', acao: Acao): boolean {
  switch (acao) {
    case 'aceitar': return papel === 'dono' && c.estado === 'aguardando';
    case 'recusar': return papel === 'dono' && (c.estado === 'aguardando' || (c.estado === 'aberta' && !c.confirmado_dono_em));
    case 'e_o_meu': return papel === 'dono' && c.estado === 'aberta' && !c.confirmado_dono_em;
    case 'enviar': return c.estado === 'aberta';
    case 'encerrar_devolvido': return papel === 'dono' && c.estado === 'aberta' && !!c.confirmado_dono_em;
    case 'encerrar_desisti': return c.estado === 'aberta';
    case 'cancelar': return papel === 'achador' && c.estado === 'aguardando';
  }
}

export async function carregarConversa(id: string): Promise<Conversa | null> {
  const r = await query(`SELECT * FROM conversas WHERE id = $1`, [id]);
  return (r.rows[0] as Conversa | undefined) ?? null;
}

export async function registrarSistema(conversaId: string, texto: string): Promise<void> {
  await query(`INSERT INTO mensagens_conversa (conversa_id, autor_id, texto, tipo) VALUES ($1, NULL, $2, 'sistema')`, [conversaId, texto]);
}

/** Dono ou objeto legado, ou conta de sistema: nada é enviado (nem push, nem e-mail, nem sino). */
export async function donoRecebeAvisos(donoId: string | null, objectId: string | null): Promise<boolean> {
  if (!donoId) return false;
  const r = await query(
    `SELECT NOT (COALESCE(u.is_legacy, false) OR COALESCE(u.is_system_account, false)
             OR COALESCE((SELECT o.is_legacy FROM objects o WHERE o.id = $2), false)) AS ok
       FROM users u WHERE u.id = $1`,
    [donoId, objectId],
  );
  return r.rows[0]?.ok === true;
}

/** Limpa o texto: tira espaços nas pontas e recusa vazio ou acima do limite. */
export function validarTexto(raw: unknown, limite: number): { ok: true; texto: string } | { ok: false; erro: string } {
  if (typeof raw !== 'string') return { ok: false, erro: 'Escreva uma mensagem.' };
  const texto = raw.replace(/\r\n/g, '\n').trim();
  if (texto.length === 0) return { ok: false, erro: 'Escreva uma mensagem.' };
  if (texto.length > limite) return { ok: false, erro: `A mensagem pode ter no máximo ${limite} caracteres.` };
  return { ok: true, texto };
}

/**
 * Linha no sino (tabela notifications) com texto FIXO, nunca com o conteúdo da mensagem. `unicaNaoLida`: se já existe uma
 * linha não lida do mesmo tipo e da mesma conversa para esta pessoa, não cria outra (o contador não infla). Falha não derruba nada.
 * Quem chama decide se a pessoa pode receber (donoRecebeAvisos): legado e conta de sistema ficam de fora.
 */
export async function notificarSino(userId: string, n: { tipo: string; titulo: string; texto: string; conversaId: string; unicaNaoLida?: boolean }): Promise<void> {
  const url = `/dashboard/mensagens/${n.conversaId}`;
  try {
    if (n.unicaNaoLida) {
      const ja = await query(`SELECT 1 FROM notifications WHERE user_id = $1 AND type = $2 AND url = $3 AND read IS NOT TRUE LIMIT 1`, [userId, n.tipo, url]);
      if (ja.rows.length > 0) return;
    }
    await query(`INSERT INTO notifications (user_id, title, message, type, url, created_at) VALUES ($1, $2, $3, $4, $5, NOW())`, [userId, n.titulo, n.texto, n.tipo, url]);
  } catch (e) { console.error('[conversas] notificação falhou:', e); }
}

/** Marca como lidas as notificações desta conversa para esta pessoa (abrir a conversa zera o sino dela). */
export async function marcarSinoLido(userId: string, conversaId: string, tipo?: string): Promise<void> {
  try {
    await query(`UPDATE notifications SET read = true WHERE user_id = $1 AND url = $2 AND read IS NOT TRUE${tipo ? ' AND type = $3' : ''}`, tipo ? [userId, `/dashboard/mensagens/${conversaId}`, tipo] : [userId, `/dashboard/mensagens/${conversaId}`]);
  } catch (e) { console.error('[conversas] marcar lido falhou:', e); }
}
