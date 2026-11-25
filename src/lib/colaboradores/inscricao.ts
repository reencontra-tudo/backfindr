// Programa de Colaboradores (E5): inscrição e autoatendimento. SOMENTE SERVIDOR. Textos de produto vêm da política oficial (`src/content/politicaColaboradores.ts`).
// INTERRUPTOR: `COLABORADORES_INSCRICAO=1` (além de `COLABORADORES_ATIVO=1`). Ausente = DESLIGADO: nenhuma rota da inscrição responde (404).
// Inscrição só por link, `noindex`, fora de menu e de sitemap até a revisão jurídica (decisão do fundador, 24/11/2026).
// Comissão: até a E4 existir, o colaborador vê «Comissão em apuração», sem valores.
import { randomInt } from 'node:crypto';
import { SLUG_REGEX } from './rota';
import { urlSegura } from './pagina';
import { POLITICA_VERSAO } from '@/content/politicaColaboradores';
import { auditar } from './auditoria';

export const ALFABETO = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'; // sem 0, O, 1, I
export const TEXTO_COMISSAO_EM_APURACAO = 'Comissão em apuração';

export function inscricaoAtiva(env: Record<string, string | undefined> = process.env): boolean {
  return env.COLABORADORES_ATIVO === '1' && env.COLABORADORES_INSCRICAO === '1';
}

/** @nomes que ninguém pode pegar (rotas do site, marca e palavras de autoridade). */
export const SLUGS_RESERVADOS: ReadonlySet<string> = new Set([
  'backfindr', 'backfindr-oficial', 'oficial', 'admin', 'administrador', 'api', 'app', 'www', 'feed', 'map', 'mapa', 'achei', 'perdi', 'encontrei', 'roubaram',
  'auth', 'login', 'logout', 'cadastro', 'register', 'dashboard', 'painel', 'pricing', 'precos', 'planos', 'faq', 'ajuda', 'suporte', 'contato', 'sobre',
  'blog', 'terms', 'termos', 'privacy', 'privacidade', 'politica', 'colaborador', 'colaboradores', 'seja', 'parceiro', 'parceiros', 'business', 'b2b',
  'flow', 'scan', 'objeto', 'objetos', 'u', 'checkout', 'boost', 'support', 'help', 'status', 'security', 'seguranca', 'imprensa', 'equipe', 'time',
]);

export interface DadosInscricao { slug: string; nome: string; descricao: string | null; canalUrl: string; imagemUrl: string | null }
export type ChaveErro = 'slug' | 'nome' | 'descricao' | 'canal_url' | 'imagem_url' | 'aceite';
export type ErrosInscricao = Partial<Record<ChaveErro, string>>;

const semControle = (t: string) => t.replace(/[\u0000-\u001F\u007F‪-‮⁦-⁩]/g, '').replace(/\s+/g, ' ').trim();

/** Hosts aceitos para a imagem: o arquivo PRÓPRIO do Backfindr (R2 do projeto ou backfindr.com). Nunca link externo (DESENHO §3.8). */
export function imagemPropria(url: string, env: Record<string, string | undefined> = process.env): boolean {
  const seguro = urlSegura(url); if (!seguro) return false;
  const host = new URL(seguro).host.toLowerCase();
  if (host === 'backfindr.com' || host === 'www.backfindr.com') return true;
  const r2 = env.R2_PUBLIC_URL ? urlSegura(env.R2_PUBLIC_URL) : null;
  return !!r2 && host === new URL(r2).host.toLowerCase();
}

export function normalizarSlugDeInscricao(texto: unknown): string {
  return typeof texto === 'string' ? texto.trim().replace(/^@/, '').toLowerCase() : '';
}

export function problemaDoSlug(slug: string): string | null {
  if (!SLUG_REGEX.test(slug)) return 'Use de 3 a 30 caracteres: letras minúsculas, números e hífen (sem começar nem terminar com hífen).';
  if (SLUGS_RESERVADOS.has(slug)) return 'Este @nome é reservado. Escolha outro.';
  return null;
}

export function validarInscricao(corpo: unknown, env: Record<string, string | undefined> = process.env): { ok: true; dados: DadosInscricao } | { ok: false; erros: ErrosInscricao } {
  const b = (corpo && typeof corpo === 'object' ? corpo : {}) as Record<string, unknown>;
  const erros: ErrosInscricao = {};
  const slug = normalizarSlugDeInscricao(b.slug);
  const pSlug = problemaDoSlug(slug); if (pSlug) erros.slug = pSlug;
  const nome = typeof b.nome === 'string' ? semControle(b.nome) : '';
  if (nome.length < 2 || nome.length > 80) erros.nome = 'O nome do grupo, perfil ou página deve ter de 2 a 80 caracteres.';
  let descricao: string | null = null;
  if (b.descricao !== undefined && b.descricao !== null && b.descricao !== '') {
    descricao = typeof b.descricao === 'string' ? semControle(b.descricao) : '';
    if (!descricao || descricao.length > 500) { erros.descricao = 'A descrição pode ter até 500 caracteres.'; descricao = null; }
  }
  const canal = typeof b.canal_url === 'string' ? urlSegura(b.canal_url) : null;
  if (!canal) erros.canal_url = 'Informe o endereço (https) do seu grupo, perfil ou página de origem.';
  else if (/(^|\.)backfindr\.com$/i.test(new URL(canal).hostname)) erros.canal_url = 'O link de origem deve ser do seu grupo, perfil ou página, não do Backfindr.';
  let imagemUrl: string | null = null;
  if (b.imagem_url !== undefined && b.imagem_url !== null && b.imagem_url !== '') {
    if (typeof b.imagem_url === 'string' && imagemPropria(b.imagem_url, env)) imagemUrl = urlSegura(b.imagem_url);
    else erros.imagem_url = 'Envie a imagem pelo próprio formulário (não é possível usar link externo).';
  }
  // Aceite da política: precisa ser explícito e da versão vigente (nunca presumido).
  if (b.aceite !== true || b.politica_versao !== POLITICA_VERSAO) erros.aceite = 'É preciso ler e aceitar a Política do Programa de Colaboradores.';
  if (Object.keys(erros).length > 0) return { ok: false, erros };
  return { ok: true, dados: { slug, nome, descricao, canalUrl: canal as string, imagemUrl } };
}

const sorteia = (n: number) => Array.from({ length: n }, () => ALFABETO[randomInt(ALFABETO.length)]).join('');
export const gerarCodigoCurto = (tamanho = 4) => sorteia(tamanho);
export const gerarCodigoVerificacao = () => `BF-${sorteia(4)}-${sorteia(4)}`;

// ─── banco ────────────────────────────────────────────────────────────────────────────────────────────────────────────
type Linha = Record<string, unknown>;
export type Consulta = (texto: string, params?: unknown[]) => Promise<{ rows: Linha[]; rowCount?: number | null }>;
/** O que a inscrição precisa de uma conexão de transação (o `PoolClient` do `pg` serve). */
export interface Transacao { query: Consulta; }

export async function disponibilidadeDoSlug(consulta: Consulta, slugBruto: unknown): Promise<{ disponivel: boolean; slug: string; motivo?: string }> {
  const slug = normalizarSlugDeInscricao(slugBruto);
  const p = problemaDoSlug(slug); if (p) return { disponivel: false, slug, motivo: p };
  const r = await consulta('SELECT 1 FROM colaboradores WHERE lower(slug) = $1 LIMIT 1', [slug]);
  return r.rows.length > 0 ? { disponivel: false, slug, motivo: 'Este @nome já está em uso.' } : { disponivel: true, slug };
}

export type ResultadoInscricao =
  | { ok: true; colaborador: { id: string; slug: string; codigoCurto: string; nome: string }; verificacao: { codigo: string; estado: string } }
  | { ok: false; erro: 'JA_E_COLABORADOR' | 'SLUG_INDISPONIVEL' };

const codigoDe = (e: unknown) => (e as { code?: string })?.code;
const restricaoDe = (e: unknown) => String((e as { constraint?: string })?.constraint ?? '');

/** Cria colaborador + aceite + verificação na MESMA transação (o chamador abre e fecha a conexão). `BEGIN`/`COMMIT` ficam aqui. */
export async function criarInscricao(tx: Transacao, userId: string, d: DadosInscricao): Promise<ResultadoInscricao> {
  await tx.query('BEGIN');
  try {
    const jaTem = await tx.query('SELECT 1 FROM colaboradores WHERE user_id = $1 LIMIT 1', [userId]);
    if (jaTem.rows.length > 0) { await tx.query('ROLLBACK'); return { ok: false, erro: 'JA_E_COLABORADOR' }; }

    let colab: Linha | null = null;
    for (let tentativa = 0; tentativa < 8 && !colab; tentativa++) {
      await tx.query('SAVEPOINT tentativa');
      try {
        const tamanho = tentativa < 6 ? 4 : 5; // cresce para 5 se faltar espaço (DESENHO §3.2)
        const r = await tx.query(
          `INSERT INTO colaboradores (user_id, slug, codigo_curto, nome, descricao, imagem_url, canal_url, modalidade, estado, interno)
           VALUES ($1, $2, $3, $4, $5, $6, $7, 'comunidade_criador', 'ativo', FALSE)
           RETURNING id, slug, codigo_curto, nome`,
          [userId, d.slug, gerarCodigoCurto(tamanho), d.nome, d.descricao, d.imagemUrl, d.canalUrl],
        );
        colab = r.rows[0] ?? null;
        await tx.query('RELEASE SAVEPOINT tentativa');
      } catch (e) {
        await tx.query('ROLLBACK TO SAVEPOINT tentativa');
        if (codigoDe(e) !== '23505') throw e;
        const c = restricaoDe(e);
        if (c.includes('slug')) { await tx.query('ROLLBACK'); return { ok: false, erro: 'SLUG_INDISPONIVEL' }; }
        if (c.includes('_user')) { await tx.query('ROLLBACK'); return { ok: false, erro: 'JA_E_COLABORADOR' }; }
        // código curto repetido: tenta de novo com outro sorteio
      }
    }
    if (!colab) throw new Error('não foi possível gerar um código curto único');

    await tx.query(`INSERT INTO politica_aceites (user_id, versao) VALUES ($1, $2) ON CONFLICT (user_id, versao) DO NOTHING`, [userId, POLITICA_VERSAO]);
    const verificacao = await novaVerificacao(tx, String(colab.id), d.canalUrl);
    await auditar(tx, { ator: userId, acao: 'inscricao_criada', alvoTipo: 'colaborador', alvoId: String(colab.id), depois: { slug: String(colab.slug), politicaVersao: POLITICA_VERSAO } });
    await tx.query('COMMIT');
    return { ok: true, colaborador: { id: String(colab.id), slug: String(colab.slug), codigoCurto: String(colab.codigo_curto), nome: String(colab.nome) }, verificacao };
  } catch (e) {
    try { await tx.query('ROLLBACK'); } catch { /* já encerrada */ }
    throw e;
  }
}

async function novaVerificacao(tx: Transacao, colaboradorId: string, canalUrl: string): Promise<{ codigo: string; estado: string }> {
  for (let i = 0; i < 8; i++) {
    const codigo = gerarCodigoVerificacao();
    await tx.query('SAVEPOINT verif');
    try {
      await tx.query(`INSERT INTO colaborador_verificacoes (colaborador_id, codigo, canal_url) VALUES ($1, $2, $3)`, [colaboradorId, codigo, canalUrl]);
      await tx.query('RELEASE SAVEPOINT verif');
      return { codigo, estado: 'pendente' };
    } catch (e) {
      await tx.query('ROLLBACK TO SAVEPOINT verif');
      if (codigoDe(e) !== '23505') throw e;
    }
  }
  throw new Error('não foi possível gerar um código de verificação único');
}

export interface MinhaColaboracao {
  id: string; slug: string; codigoCurto: string; nome: string; descricao: string | null; imagemUrl: string | null; canalUrl: string | null;
  estado: string; verificado: boolean; interno: boolean;
  verificacao: { codigo: string; estado: string; canalUrl: string; motivo: string | null } | null;
  /** Até a E4 existir: sem valores. */
  comissao: typeof TEXTO_COMISSAO_EM_APURACAO;
  linkPublico: string;
}

export async function minhaColaboracao(consulta: Consulta, userId: string, appUrl = 'https://backfindr.com'): Promise<MinhaColaboracao | null> {
  const r = await consulta(
    `SELECT id, slug, codigo_curto, nome, descricao, imagem_url, canal_url, estado, (verificado_em IS NOT NULL) AS verificado, interno FROM colaboradores WHERE user_id = $1 LIMIT 1`,
    [userId],
  );
  const c = r.rows[0]; if (!c) return null;
  const v = await consulta(
    `SELECT codigo, estado, canal_url, motivo FROM colaborador_verificacoes WHERE colaborador_id = $1 AND estado <> 'substituida' ORDER BY criado_em DESC LIMIT 1`,
    [c.id],
  );
  const vr = v.rows[0];
  return {
    id: String(c.id), slug: String(c.slug), codigoCurto: String(c.codigo_curto), nome: String(c.nome),
    descricao: (c.descricao as string | null) ?? null, imagemUrl: (c.imagem_url as string | null) ?? null, canalUrl: (c.canal_url as string | null) ?? null,
    estado: String(c.estado), verificado: c.verificado === true, interno: c.interno === true,
    verificacao: vr ? { codigo: String(vr.codigo), estado: String(vr.estado), canalUrl: String(vr.canal_url), motivo: (vr.motivo as string | null) ?? null } : null,
    comissao: TEXTO_COMISSAO_EM_APURACAO,
    linkPublico: `${appUrl.replace(/\/$/, '')}/@${String(c.slug)}`,
  };
}

/** Saída voluntária: a página passa a redirecionar para o Feed (307); a linha nunca é apagada (PC-13, POLÍTICA §8). */
export async function sairDoPrograma(consulta: Consulta, userId: string): Promise<boolean> {
  // Uma só instrução: a mudança e a linha de auditoria acontecem juntas ou nenhuma.
  const r = await consulta(
    `WITH alterada AS (UPDATE colaboradores SET estado = 'saiu', saiu_em = NOW(), atualizado_em = NOW() WHERE user_id = $1 AND estado = 'ativo' AND interno = FALSE RETURNING id)
     INSERT INTO auditoria (ator_id, acao, alvo_tipo, alvo_id, antes, depois) SELECT $1, 'colaborador_saiu', 'colaborador', id::text, '{"estado":"ativo"}'::jsonb, '{"estado":"saiu"}'::jsonb FROM alterada RETURNING alvo_id`, [userId]);
  return r.rows.length > 0;
}

/** Reativação PELO PRÓPRIO colaborador que saiu por vontade própria (PC-13). Suspenso e excluído NÃO se reativam sozinhos. */
export async function reativarPagina(consulta: Consulta, userId: string): Promise<boolean> {
  const r = await consulta(
    `WITH alterada AS (UPDATE colaboradores SET estado = 'ativo', saiu_em = NULL, atualizado_em = NOW() WHERE user_id = $1 AND estado = 'saiu' AND interno = FALSE RETURNING id)
     INSERT INTO auditoria (ator_id, acao, alvo_tipo, alvo_id, antes, depois) SELECT $1, 'colaborador_reativou', 'colaborador', id::text, '{"estado":"saiu"}'::jsonb, '{"estado":"ativo"}'::jsonb FROM alterada RETURNING alvo_id`, [userId]);
  return r.rows.length > 0;
}

/** Troca de canal: nova verificação; a liberação (verificado_em) fica suspensa até a confirmação (POLÍTICA §3). */
export async function trocarCanal(tx: Transacao, userId: string, canalUrlBruto: unknown): Promise<{ ok: true; verificacao: { codigo: string; estado: string } } | { ok: false; erro: 'CANAL_INVALIDO' | 'NAO_ENCONTRADO' }> {
  const canal = typeof canalUrlBruto === 'string' ? urlSegura(canalUrlBruto) : null;
  if (!canal || /(^|\.)backfindr\.com$/i.test(new URL(canal).hostname)) return { ok: false, erro: 'CANAL_INVALIDO' };
  await tx.query('BEGIN');
  try {
    const c = await tx.query(`SELECT id FROM colaboradores WHERE user_id = $1 AND estado = 'ativo' AND interno = FALSE FOR UPDATE`, [userId]);
    if (c.rows.length === 0) { await tx.query('ROLLBACK'); return { ok: false, erro: 'NAO_ENCONTRADO' }; }
    const id = String(c.rows[0].id);
    const anterior = await tx.query('SELECT canal_url FROM colaboradores WHERE id = $1', [id]);
    await tx.query(`UPDATE colaborador_verificacoes SET estado = 'substituida', decidido_em = NOW() WHERE colaborador_id = $1 AND estado = 'pendente'`, [id]);
    await tx.query(`UPDATE colaboradores SET canal_url = $2, verificado_em = NULL, verificado_por = NULL, atualizado_em = NOW() WHERE id = $1`, [id, canal]);
    const verificacao = await novaVerificacao(tx, id, canal);
    await auditar(tx, { ator: userId, acao: 'canal_trocado', alvoTipo: 'colaborador', alvoId: id, antes: { canalUrl: anterior.rows[0]?.canal_url ?? null }, depois: { canalUrl: canal, verificado: false } });
    await tx.query('COMMIT');
    return { ok: true, verificacao };
  } catch (e) {
    try { await tx.query('ROLLBACK'); } catch { /* já encerrada */ }
    throw e;
  }
}

// ─── fila de verificação (admin; a tela vem na E7) ────────────────────────────────────────────────────────────────────
export async function listarVerificacoes(consulta: Consulta, estado: string = 'pendente'): Promise<Linha[]> {
  const r = await consulta(
    `SELECT v.id, v.codigo, v.estado, v.canal_url, v.criado_em, c.slug, c.nome, c.estado AS estado_colaborador
       FROM colaborador_verificacoes v JOIN colaboradores c ON c.id = v.colaborador_id
      WHERE v.estado = $1 ORDER BY v.criado_em ASC LIMIT 200`,
    [estado],
  );
  return r.rows;
}

export async function decidirVerificacao(tx: Transacao, verificacaoId: string, decisao: 'aprovar' | 'recusar', adminId: string, motivo: string | null):
  Promise<{ ok: true } | { ok: false; erro: 'NAO_ENCONTRADA' | 'JA_DECIDIDA' | 'MOTIVO_OBRIGATORIO' }> {
  const m = motivo ? semControle(motivo).slice(0, 500) : null;
  if (decisao === 'recusar' && !m) return { ok: false, erro: 'MOTIVO_OBRIGATORIO' };
  await tx.query('BEGIN');
  try {
    const v = await tx.query(`SELECT id, colaborador_id, estado FROM colaborador_verificacoes WHERE id = $1 FOR UPDATE`, [verificacaoId]);
    if (v.rows.length === 0) { await tx.query('ROLLBACK'); return { ok: false, erro: 'NAO_ENCONTRADA' }; }
    if (v.rows[0].estado !== 'pendente') { await tx.query('ROLLBACK'); return { ok: false, erro: 'JA_DECIDIDA' }; }
    await tx.query(`UPDATE colaborador_verificacoes SET estado = $2, decidido_em = NOW(), decidido_por = $3, motivo = $4 WHERE id = $1`,
      [verificacaoId, decisao === 'aprovar' ? 'aprovada' : 'recusada', adminId, m]);
    if (decisao === 'aprovar') {
      await tx.query(`UPDATE colaboradores SET verificado_em = NOW(), verificado_por = $2, atualizado_em = NOW() WHERE id = $1`, [v.rows[0].colaborador_id, adminId]);
    }
    await auditar(tx, { ator: adminId, acao: decisao === 'aprovar' ? 'verificacao_aprovada' : 'verificacao_recusada', alvoTipo: 'verificacao', alvoId: verificacaoId, antes: { estado: 'pendente' }, depois: { estado: decisao === 'aprovar' ? 'aprovada' : 'recusada', colaboradorId: String(v.rows[0].colaborador_id) }, motivo: m });
    await tx.query('COMMIT');
    return { ok: true };
  } catch (e) {
    try { await tx.query('ROLLBACK'); } catch { /* já encerrada */ }
    throw e;
  }
}
