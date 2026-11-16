// Vigia das rotinas agendadas: confere a IDADE da última marca de vida de cada rotina esperada (src/lib/rotinasEsperadas.ts) e avisa os administradores.
// Só vigia a PRESENÇA da marca e o resultado 'erro'. Não repete a lógica de nenhuma rotina (por exemplo, do matching).
// Roda fora do n8n: quem chama a rota é um workflow do GitHub Actions a cada 30 minutos.
import { query } from '@/lib/db';
import { sendPushToUser } from '@/lib/pushNotification';
import { deliverEmail } from '@/lib/emailSend';
import { ROTINAS_ESPERADAS, HORAS_ATE_AVISAR_ROTINA_SEM_MARCA, HORAS_ENTRE_AVISOS_DA_MESMA_ROTINA, type RotinaEsperada } from '@/lib/rotinasEsperadas';

export type EstadoRotina = 'ok' | 'desligada' | 'atrasada' | 'erro' | 'sem_marca_ainda' | 'nunca_registrou';
export type AcaoAviso = 'falha' | 'normalizada' | null;

export interface MarcaResumo { iniciou_em: Date; resultado: 'ok' | 'erro' | 'desligada' }
export interface AlertaResumo { tipo: 'falha' | 'normalizada'; criado_em: Date }

export interface AvaliacaoRotina {
  rotina: RotinaEsperada;
  estado: EstadoRotina;
  /** Idade da última marca (ou, sem marca, desde a marca mais antiga da tabela), em minutos. */
  idadeMinutos: number | null;
  aviso: AcaoAviso;
}

const MIN = 60_000;
const HORA = 60 * MIN;

/**
 * Decisão pura (sem banco): para cada rotina esperada, o estado e se deve haver aviso agora.
 * `maisAntigaDaTabela`: a marca mais antiga de QUALQUER rotina (ou null se a tabela está vazia).
 */
export function avaliar(
  agora: Date,
  marcas: Map<string, MarcaResumo>,
  alertas: Map<string, { ultimaFalha: AlertaResumo | null; ultimoQualquer: AlertaResumo | null }>,
  maisAntigaDaTabela: Date | null,
  rotinas: readonly RotinaEsperada[] = ROTINAS_ESPERADAS,
): AvaliacaoRotina[] {
  return rotinas.map((rotina) => {
    const marca = marcas.get(rotina.id) ?? null;
    const al = alertas.get(rotina.id) ?? { ultimaFalha: null, ultimoQualquer: null };
    let estado: EstadoRotina;
    let idade: number | null = null;

    if (!marca) {
      if (!maisAntigaDaTabela) { estado = 'sem_marca_ainda'; }
      else {
        idade = Math.floor((agora.getTime() - maisAntigaDaTabela.getTime()) / MIN);
        estado = agora.getTime() - maisAntigaDaTabela.getTime() >= HORAS_ATE_AVISAR_ROTINA_SEM_MARCA * HORA ? 'nunca_registrou' : 'sem_marca_ainda';
      }
    } else {
      idade = Math.floor((agora.getTime() - marca.iniciou_em.getTime()) / MIN);
      if (marca.resultado === 'erro') estado = 'erro';
      else if (idade > rotina.limiteMinutos) estado = 'atrasada';
      else estado = marca.resultado === 'desligada' ? 'desligada' : 'ok'; // «desligada» conta como viva
    }

    const falhando = estado === 'erro' || estado === 'atrasada' || estado === 'nunca_registrou';
    let aviso: AcaoAviso = null;
    if (falhando) {
      const ultima = al.ultimaFalha?.criado_em.getTime() ?? null;
      if (ultima === null || agora.getTime() - ultima >= HORAS_ENTRE_AVISOS_DA_MESMA_ROTINA * HORA) aviso = 'falha';
    } else if (estado === 'ok' || estado === 'desligada') {
      // voltou ao normal: um único aviso, e só se o último aviso desta rotina foi de falha
      if (al.ultimoQualquer?.tipo === 'falha') aviso = 'normalizada';
    }
    return { rotina, estado, idadeMinutos: idade, aviso };
  });
}

function duracao(min: number | null): string {
  if (min === null) return 'tempo desconhecido';
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60); const m = min % 60;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

/** Texto curto do aviso: qual rotina, há quanto tempo e o que olhar primeiro. Sem segredos e sem dado pessoal. */
export function textoDoAviso(a: AvaliacaoRotina): { titulo: string; mensagem: string } {
  const { rotina, estado, idadeMinutos } = a;
  if (a.aviso === 'normalizada') {
    return { titulo: `✅ Rotina normalizada: ${rotina.nome}`, mensagem: `A rotina «${rotina.nome}» voltou a registrar marca de vida.` };
  }
  if (estado === 'erro') {
    return {
      titulo: `⚠️ Rotina com erro: ${rotina.nome}`,
      mensagem: `A última execução de «${rotina.nome}» terminou com erro (há ${duracao(idadeMinutos)}). Olhe primeiro: ${rotina.oQueOlhar}.`,
    };
  }
  if (estado === 'nunca_registrou') {
    return {
      titulo: `⚠️ Rotina sem marca: ${rotina.nome}`,
      mensagem: `A rotina «${rotina.nome}» (${rotina.frequencia}) ainda não registrou nenhuma marca de vida, ${duracao(idadeMinutos)} depois da primeira marca de outra rotina. Olhe primeiro: ${rotina.oQueOlhar}.`,
    };
  }
  return {
    titulo: `⚠️ Rotina parada: ${rotina.nome}`,
    mensagem: `A rotina «${rotina.nome}» (${rotina.frequencia}) está sem marca de vida há ${duracao(idadeMinutos)} (limite: ${duracao(rotina.limiteMinutos)}). Olhe primeiro: ${rotina.oQueOlhar}.`,
  };
}

async function administradores(): Promise<{ id: string; email: string | null }[]> {
  const r = await query(
    `SELECT id, email FROM users
      WHERE role IN ('admin', 'super_admin') AND is_system_account = false AND b2b_partner_id IS NULL AND is_legacy IS NOT TRUE`,
  );
  return r.rows as { id: string; email: string | null }[];
}

/** Destinatários do e-mail: a variável opcional VIGIA_EMAILS (lista separada por vírgula) ou, sem ela, o e-mail dos administradores. Nada fixo no código. */
export function destinosDeEmail(admins: { email: string | null }[], env: string | undefined = process.env.VIGIA_EMAILS): string[] {
  const lista = (env ?? '').split(',').map((e) => e.trim()).filter(Boolean);
  const base = lista.length > 0 ? lista : admins.map((a) => a.email ?? '').filter(Boolean);
  return Array.from(new Set(base));
}

/** Sino + push para os administradores (como a ingestão já faz) e e-mail pelo Resend. Cada canal falha sozinho, sem derrubar os outros. */
export async function avisarAdmins(a: AvaliacaoRotina): Promise<void> {
  const { titulo, mensagem } = textoDoAviso(a);
  const admins = await administradores();
  await Promise.allSettled(admins.map(async ({ id }) => {
    await query(`INSERT INTO notifications (user_id, title, message, type, created_at) VALUES ($1, $2, $3, 'rotina_vigia', NOW())`, [id, titulo, mensagem]);
    await sendPushToUser(id, { title: titulo, body: mensagem, url: '/admin/sistema', tag: `vigia-${a.rotina.id}` });
  }));
  const html = `<div style="font-family:Arial,sans-serif;max-width:520px"><h2 style="margin:0 0 12px">${titulo}</h2><p style="font-size:15px;line-height:1.5">${mensagem}</p><p style="font-size:13px;color:#666">Aviso automático do vigia das rotinas do Backfindr. No máximo um aviso de falha por rotina a cada ${HORAS_ENTRE_AVISOS_DA_MESMA_ROTINA} horas.</p></div>`;
  await Promise.allSettled(destinosDeEmail(admins).map((to) => deliverEmail({ to, subject: titulo, html, category: 'service', source: 'vigia_rotinas' })));
}

export interface RelatorioVigia {
  status: 'sem_dados' | 'ok' | 'com_alerta';
  motivo?: string;
  rotinas: { rotina: string; estado: EstadoRotina; idade_minutos: number | null; aviso_enviado: AcaoAviso }[];
}

/** Lê as marcas e os avisos, decide e avisa. Sem as tabelas (migration 026 ainda não aplicada) ou sem nenhuma marca: «sem dados», sem avisar ninguém. */
export async function rodarVigia(agora: Date = new Date()): Promise<RelatorioVigia> {
  let ultimas, antiga, avisos;
  try {
    ultimas = await query(`SELECT DISTINCT ON (rotina) rotina, iniciou_em, resultado FROM rotina_execucoes ORDER BY rotina, iniciou_em DESC`);
    antiga = await query(`SELECT MIN(iniciou_em) AS primeira FROM rotina_execucoes`);
    avisos = await query(`SELECT rotina, tipo, criado_em FROM rotina_alertas ORDER BY criado_em DESC`);
  } catch (err) {
    if ((err as { code?: string })?.code === '42P01') return { status: 'sem_dados', motivo: 'tabelas das marcas ainda não existem', rotinas: [] };
    throw err; // outro erro (banco fora, por exemplo): a rota responde 500 e o GitHub avisa que o job falhou
  }
  const primeira = (antiga.rows[0] as { primeira: Date | null } | undefined)?.primeira ?? null;
  if (!primeira) return { status: 'sem_dados', motivo: 'nenhuma marca registrada ainda', rotinas: [] };

  const marcas = new Map<string, MarcaResumo>();
  for (const r of ultimas.rows as { rotina: string; iniciou_em: Date; resultado: MarcaResumo['resultado'] }[]) marcas.set(r.rotina, { iniciou_em: new Date(r.iniciou_em), resultado: r.resultado });
  const alertas = new Map<string, { ultimaFalha: AlertaResumo | null; ultimoQualquer: AlertaResumo | null }>();
  for (const r of avisos.rows as { rotina: string; tipo: AlertaResumo['tipo']; criado_em: Date }[]) {
    const cur = alertas.get(r.rotina) ?? { ultimaFalha: null, ultimoQualquer: null };
    const item = { tipo: r.tipo, criado_em: new Date(r.criado_em) };
    if (!cur.ultimoQualquer) cur.ultimoQualquer = item;            // as linhas vêm da mais nova para a mais antiga
    if (r.tipo === 'falha' && !cur.ultimaFalha) cur.ultimaFalha = item;
    alertas.set(r.rotina, cur);
  }

  const avaliacoes = avaliar(agora, marcas, alertas, new Date(primeira));
  const enviados = new Map<string, AcaoAviso>();
  for (const a of avaliacoes) {
    if (!a.aviso) continue;
    // Grava o aviso ANTES de enviar: se o envio demorar ou falhar, o limite de frequência já vale (melhor perder um aviso do que repetir).
    await query(`INSERT INTO rotina_alertas (rotina, tipo, criado_em) VALUES ($1, $2, $3)`, [a.rotina.id, a.aviso, agora.toISOString()]);
    try { await avisarAdmins(a); } catch (err) { console.error('[vigia-rotinas] falha ao avisar', a.rotina.id, (err as { code?: string })?.code ?? 'erro'); }
    enviados.set(a.rotina.id, a.aviso);
  }
  const falhando = avaliacoes.some((a) => a.estado === 'erro' || a.estado === 'atrasada' || a.estado === 'nunca_registrou');
  return {
    status: falhando ? 'com_alerta' : 'ok',
    rotinas: avaliacoes.map((a) => ({ rotina: a.rotina.id, estado: a.estado, idade_minutos: a.idadeMinutos, aviso_enviado: enviados.get(a.rotina.id) ?? null })),
  };
}
