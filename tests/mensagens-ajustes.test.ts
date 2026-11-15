// Ajustes depois do teste do Marcos no preview: e-mail do aviso, aba inicial, bolha do assistente, painel «alguém pode ter encontrado».
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';

const h = vi.hoisted(() => ({ enviados: [] as { to: string; subject: string; html: string }[] }));
vi.mock('@/lib/emailSend', async (orig) => ({ ...(await orig<Record<string, unknown>>()), deliverEmail: vi.fn(async (o: { to: string; subject: string; html: string }) => { h.enviados.push(o); return { ok: true }; }) }));

import { sendObjectFoundEmail } from '@/lib/email';
import { abaInicial, sinalizadosReais } from '@/lib/conversasCliente';
const r = (f: string) => readFileSync(path.join(__dirname, '..', f), 'utf8');
beforeEach(() => { h.enviados.length = 0; });

describe('e-mail do aviso com conversa', () => {
  const dono = { name: 'Marcos Teste', email: 'dono@teste.local' };
  const enviar = async (titulo: string, categoria = 'pet') => { await sendObjectFoundEmail(dono, { id: 'o1', title: titulo, category: categoria, conversaId: 'c-123' }); return h.enviados[0]; };
  it('tom neutro: sem festa, sem «pet» fixo, sem frase de proteção de identidade, sem «quem clicou»/QR', async () => {
    const m = await enviar('Gatinho doméstico '); const t = `${m.subject}\n${m.html}`;
    expect(t).not.toMatch(/🎉|Boa notícia|🔒|identidade|protege|quem clicou|clicou|QR Code|escaneou|\bpet\b/i);
    expect(m.subject).toBe('Alguém avisou sobre Gatinho doméstico');
    expect(m.html).toContain('Alguém avisou que pode ter encontrado <strong style="color:white;">Gatinho doméstico</strong>. Você decide se quer conversar.'); expect(m.html).toContain('Olá, Marcos');
  });
  it('o botão leva direto à conversa; o conteúdo da mensagem do achador não entra (a função nem recebe)', async () => {
    const m = await enviar('Mochila'); expect(m.html).toMatch(/href="[^"]*\/dashboard\/mensagens\/c-123"/); expect(m.html).toContain('Ver o aviso');
    expect(r('src/lib/conversasAviso.ts')).not.toMatch(/sendObjectFoundEmail\([^)]*(msg|mensagem|primeira)/i);
  });
  it('título vazio vira «seu objeto» e título longo é cortado no assunto; categoria não aparece', async () => {
    expect((await enviar('   ', 'wallet')).subject).toBe('Alguém avisou sobre seu objeto');
    h.enviados.length = 0; expect((await enviar('x'.repeat(120))).subject.length).toBeLessThanOrEqual('Alguém avisou sobre '.length + 70);
  });
  it('sem conversa (função desligada) o e-mail antigo continua exatamente como era', async () => {
    await sendObjectFoundEmail(dono, { id: 'o1', title: 'Gatinho', category: 'pet' }); const m = h.enviados[0];
    expect(m.subject).toBe('🎉 Alguém pode ter encontrado seu pet'); expect(m.html).toContain('Boa notícia, Marcos!'); expect(m.html).toContain('/dashboard/objects/o1');
  });
  it('o domínio do link vem de APP_URL (NEXT_PUBLIC_APP_URL ou https://backfindr.com)', () => {
    expect(r('src/lib/constants.ts')).toContain("process.env.NEXT_PUBLIC_APP_URL?.trim() || DEFAULT_APP_URL"); expect(r('src/lib/email.ts')).toContain('${APP_URL}/dashboard/mensagens/${obj.conversaId}');
  });
});

describe('aba inicial da lista «Mensagens»', () => {
  const c = (estado: string, papel: string, nao_lidas = 0) => ({ estado, papel, nao_lidas });
  it('aviso esperando o dono → «Aguardando você»', () => expect(abaInicial([c('aberta', 'achador', 3), c('aguardando', 'dono')])).toBe('aguardando_voce'));
  it('achador com mensagem não lida numa aberta → «Abertas»', () => expect(abaInicial([c('aguardando', 'achador'), c('aberta', 'achador', 1)])).toBe('abertas'));
  it('nada novo → comportamento de sempre («Aguardando você»), com ou sem conversas', () => {
    expect(abaInicial([])).toBe('aguardando_voce'); expect(abaInicial([c('aguardando', 'achador'), c('aberta', 'dono', 0), c('encerrada', 'dono', 2)])).toBe('aguardando_voce');
  });
  it('mensagem não lida em conversa encerrada não puxa a aba «Abertas»', () => expect(abaInicial([c('encerrada', 'achador', 5)])).toBe('aguardando_voce'));
  it('a tela só escolhe a aba depois de consultar; falha = «Aguardando você»', () => {
    const t = r('src/app/dashboard/mensagens/page.tsx'); expect(t).toContain('abaInicial('); expect(t).toContain("catch(() => { if (vivo) setAba('aguardando_voce'); })");
  });
});

describe('links diretos para a conversa', () => {
  it('push, sino e e-mail do aviso usam /dashboard/mensagens/<id>', () => {
    const c = r('src/lib/conversasAviso.ts'); expect(c).toContain('const url = `/dashboard/mensagens/${conversaId}`'); expect(c).toMatch(/url,\s*tag:/); expect(c).toContain("conversaId });");
    expect(r('src/lib/conversas.ts')).toContain('const url = `/dashboard/mensagens/${n.conversaId}`');
  });
  it('a página de notificações abre o campo url', () => expect(r('src/app/dashboard/notifications/page.tsx')).toContain('if (notif.url) router.push(notif.url)'));
});

describe('bolha do assistente na tela da conversa (escopo restrito)', () => {
  it('espaço no rodapé só na tela da conversa; o botão continua na zona segura; nada global mudou', () => {
    const t = r('src/app/dashboard/mensagens/[id]/page.tsx'); expect(t).toMatch(/pt-3 pb-24[^"]*"[^>]*data-composer/); expect(t).toContain('data-widget-safe-zone');
    expect(r('src/components/AssistantWidget.tsx')).not.toContain('data-composer'); expect(r('src/app/globals.css')).not.toMatch(/data-composer/);
  });
});

describe('painel: «Alguém pode ter encontrado um dos seus objetos»', () => {
  const o = (status: string, f?: boolean | null) => ({ status, found_pending_confirmation: f });
  it('conta só sinalização real: marca ligada em objeto que NÃO é «encontrei» da própria pessoa', () => {
    expect(sinalizadosReais([o('found', false), o('found', null), o('found')])).toBe(0);        // quem só registrou achados não vê o aviso (o bug)
    expect(sinalizadosReais([o('lost', true), o('stolen', true), o('protected', true), o('lost', false)])).toBe(3);
    expect(sinalizadosReais([o('found', true)])).toBe(0); expect(sinalizadosReais([])).toBe(0);
  });
  it('o painel usa essa contagem e a lista do dono traz a marca', () => {
    expect(r('src/app/dashboard/page.tsx')).toContain('foundCount={sinalizadosReais(objects)}'); expect(r('src/app/dashboard/page.tsx')).not.toContain("foundCount={objects.filter(o => o.status === 'found')");
    expect(r('src/app/api/v1/objects/route.ts')).toContain('found_pending_confirmation: row.found_pending_confirmation === true');
  });
});
