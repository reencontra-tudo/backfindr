// Área de mensagens: retorno seguro à página pretendida, textos oficiais, entrada no menu só com a função ligada, nada de promessa proibida.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';
import { proximaPaginaSegura } from '@/lib/proximaPagina';
import { TEXTOS } from '@/lib/conversas';

const r = (f: string) => readFileSync(path.join(__dirname, '..', f), 'utf8');

describe('retorno à página pretendida (next): só caminhos seguros', () => {
  const ok = ['/objeto/YFNMFR2O', '/scan/YFNMFR2O', '/objeto/YFNMFR2O?aviso=1', '/dashboard/mensagens', '/dashboard/mensagens/123e4567-e89b-12d3-a456-426614174000'];
  for (const c of ok) it(`aceita ${c}`, () => expect(proximaPaginaSegura(c)).toBe(c));
  const ruins = ['https://evil.com', '//evil.com', '/\\evil.com', 'javascript:alert(1)', '/objeto/../admin', '/admin', '/dashboard', '/dashboard/objects/new', '/objeto/ab', '/objeto/X%2F..', '/objeto/YFNMFR2O?x=1', '/objeto/YFNMFR2O#a',
    '/objeto/YFNMFR2O\n/x', '/objeto/YFNMFR2O\u0000', '', ' ', 'objeto/YFNMFR2O', '/auth/login?next=/x', '/dashboard/mensagens/não-uuid', '/objeto/' + 'A'.repeat(300), null, undefined, 42, {}];
  for (const c of ruins) it(`recusa ${JSON.stringify(c)?.slice(0, 40)}`, () => expect(proximaPaginaSegura(c)).toBeNull());
  it('login, cadastro, Google, link mágico e o painel usam o destino; sem destino válido nada muda', () => {
    expect(r('src/app/auth/login/page.tsx')).toContain("consumirProximaPagina() ?? getPostLoginRedirect(user?.role)");
    expect(r('src/app/auth/register/page.tsx')).toContain('consumirProximaPagina()');
    for (const f of ['google-success', 'magic-success', 'magic-confirm']) expect(r(`src/app/auth/${f}/page.tsx`)).toContain('consumirProximaPagina() ?? getPostLoginRedirect');
    expect(r('src/app/dashboard/layout.tsx')).toContain('/auth/login?next=');
  });
});

describe('textos oficiais (sem promessa proibida)', () => {
  it('as frases combinadas', () => {
    expect(TEXTOS.avisoDono('Mochila')).toBe('Alguém avisou que pode ter encontrado "Mochila". Veja o aviso e decida se quer conversar.');
    expect(TEXTOS.aceitar).toBe('Ao aceitar, vocês trocam mensagens aqui, dentro do Backfindr. Não envie telefone, e-mail nem endereço.');
    expect(TEXTOS.recusadaParaAchador).toBe('A pessoa informou que este objeto não é dela.');
    expect(TEXTOS.encerrada).toBe('Conversa encerrada.');
    expect(TEXTOS.aguardando).toBe('Seu aviso foi registrado. Não há garantia de resposta.');
  });
  const arquivos = ['src/lib/conversas.ts', 'src/lib/conversasAviso.ts', 'src/app/dashboard/mensagens/page.tsx', 'src/app/dashboard/mensagens/[id]/page.tsx', 'src/app/api/v1/cron/found-pending-reminders/route.ts'];
  for (const f of arquivos) it(`${f}: nenhuma promessa de chat protegido, dados protegidos, alerta imediato, SMS, resposta, nem a frase do «chat da plataforma»`, () => {
    const c = r(f);
    expect(c).not.toMatch(/chat da plataforma|a conversa acontece|protegid[oa]|dados n[ãa]o s[ãa]o expostos|alerta imediato|notifica[çc][ãa]o imediata|avisado imediatamente|\bSMS\b|responder[áa]|vai responder|garantimos|com seguran[çc]a/i);
  });
  it('o texto de «encerrada» não cita prazo de guarda (espera a revisão jurídica)', () => {
    expect(r('src/app/dashboard/mensagens/[id]/page.tsx')).not.toMatch(/12 meses|guardad[ao]s? por|prazo de guarda|apagad/i);
  });
  it('/objeto: o texto de aguardando e a orientação de prova de dono', () => {
    const c = r('src/app/objeto/[code]/client.tsx');
    expect(c).toContain('Seu aviso foi registrado. Não há garantia de resposta.'); expect(c).toContain('Não conte o detalhe que só o dono saberia'); expect(c).toContain('até 280 caracteres');
  });
});

describe('a função só aparece com MENSAGENS_ATIVO=1', () => {
  it('o menu «Mensagens» só entra se o servidor diz ativo', () => {
    const c = r('src/app/dashboard/layout.tsx');
    expect(c).toContain("label: 'Mensagens'"); expect(c).toContain("soComMensagens: true"); expect(c).toMatch(/\.filter\(item => !\('soComMensagens' in item\) \|\| mensagensAtivas\)/);
    expect(c).toContain('/api/v1/conversas/config'); expect(c).toContain('/api/v1/conversas/resumo');
  });
  it('/objeto e /scan perguntam à configuração; desligada, a tela de antes (endpoint antigo)', () => {
    const o = r('src/app/objeto/[code]/client.tsx');
    expect(o).toContain("api.get('/conversas/config')"); expect(o).toContain('await api.post(`/objects/scan/${obj.unique_code}/notify`)');
    expect(r('src/app/scan/[code]/client.tsx')).toContain("window.location.replace(`/objeto/");
  });
  it('toda rota de conversas passa por exigirLogin (que responde 404 com a função desligada)', () => {
    const base = 'src/app/api/v1/conversas';
    for (const f of ['route.ts', 'resumo/route.ts', '[id]/route.ts', '[id]/aceitar/route.ts', '[id]/recusar/route.ts', '[id]/e-o-meu/route.ts', '[id]/enviar/route.ts', '[id]/encerrar/route.ts', '[id]/cancelar/route.ts', '[id]/lida/route.ts'])
      expect(r(`${base}/${f}`), f).toMatch(/exigirLogin|exigirParte/);
  });
  it('a rota antiga de aviso só muda com a função ligada; o resto do arquivo segue igual', () => {
    const c = r('src/app/api/v1/objects/scan/[code]/notify/route.ts');
    expect(c).toContain('if (MENSAGENS_ATIVO()) {'); expect(c).toContain("UPDATE objects SET found_pending_confirmation = true, found_pending_since = NOW()");
  });
  it('o banner do dono não diz mais que quem achou é anônimo e sem contato', () => {
    expect(r('src/app/dashboard/objects/[id]/page.tsx')).not.toMatch(/finder é anônimo|sem contato direto/);
  });
});

describe('push e analytics', () => {
  it('push de aviso e de mensagem: texto fixo e evento que sai sempre (chat_message); aviso ao dono usa qr_scan', () => {
    const c = r('src/lib/conversasAviso.ts') + r('src/app/api/v1/conversas/[id]/enviar/route.ts');
    expect(c).toContain("{ event: 'chat_message' }"); expect(c).toContain("{ event: 'qr_scan' }"); expect(c).not.toMatch(/body:\s*(t\.texto|texto|mensagem)/);
  });
  it('eventos conversa_* e os de sempre (qr_scanned, owner_notified)', () => {
    const c = r('src/lib/conversasAviso.ts');
    for (const e of ['Events.qrScanned', 'owner_notified', 'conversa_aviso']) expect(c).toContain(e);
    const todos = ['aceitar', 'recusar', 'e-o-meu', 'encerrar', 'cancelar'].map((x) => r(`src/app/api/v1/conversas/[id]/${x}/route.ts`)).join('');
    for (const e of ['conversa_aceita', 'conversa_recusada', 'conversa_confirmada_dono', 'conversa_encerrada', 'conversa_cancelada']) expect(todos).toContain(e);
  });
  it('nenhum apagamento: retencao_ate é gravada, mas não existe DELETE de conversas/mensagens no código', () => {
    const arquivos = ['src/lib/conversas.ts', 'src/lib/conversasAviso.ts', 'src/app/api/v1/cron/found-pending-reminders/route.ts', ...['aceitar', 'recusar', 'e-o-meu', 'enviar', 'encerrar', 'cancelar', 'lida'].map((x) => `src/app/api/v1/conversas/[id]/${x}/route.ts`)];
    for (const f of arquivos) expect(r(f), f).not.toMatch(/DELETE\s+FROM\s+(conversas|mensagens_conversa)/i);
    expect(r('src/app/api/v1/conversas/[id]/encerrar/route.ts')).toContain('retencao_ate');
  });
});

describe('migração 025: só cria; nada de ALTER/UPDATE/DELETE em tabela existente', () => {
  const sql = r('src/db/migrations/025_conversas.sql').replace(/--.*$/gm, '');
  it('aditiva', () => { expect(sql).not.toMatch(/ALTER\s+TABLE\s+(?!conversas|mensagens_conversa)\w+|UPDATE\s+\w+\s+SET|DELETE\s+FROM|DROP\s+TABLE|TRUNCATE/i); });
  it('exclusão de conta anula (SET NULL), nunca cascata por usuário', () => {
    expect(sql).not.toMatch(/REFERENCES users\(id\) ON DELETE CASCADE/); expect(sql.match(/REFERENCES users\(id\) ON DELETE SET NULL/g)?.length).toBeGreaterThanOrEqual(5);
  });
  it('RLS com política das partes e WITH CHECK; estados e campos previstos (denúncia, disputa, retenção)', () => {
    expect(sql).toContain('ENABLE ROW LEVEL SECURITY'); expect(sql).toContain('WITH CHECK'); expect(sql).toMatch(/denunciada_em/); expect(sql).toMatch(/em_disputa/); expect(sql).toMatch(/retencao_ate/); expect(sql).toMatch(/'bloqueada'/);
  });
});
