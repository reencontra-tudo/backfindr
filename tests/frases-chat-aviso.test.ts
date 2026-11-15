// Fim da frase «a conversa acontece pelo chat da plataforma» onde ela falava de quem achou e o dono (não existe chat entre eles; o chat é só das correspondências confirmadas).
// Texto fiel: o aviso fica registrado na ocorrência; push e e-mail só quando o dono não é legado; sem garantia de resposta.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';
import { aplicarFiltroDeLinguagem, T1, T3 } from '@/lib/assistantFilter';
const read = (f: string) => readFileSync(path.join(__dirname, '..', f), 'utf8');

describe('lugares da frase antiga', () => {
  const lugares = ['src/app/page.tsx', 'src/components/AssistantWidget.tsx', 'src/app/api/v1/assistant/chat/route.ts', 'src/lib/assistantFilter.ts', 'src/app/faq/client.tsx', 'src/app/blog/[slug]/page.tsx', 'src/app/encontrei/page.tsx',
    'src/components/flow/FlowLayout.tsx', 'src/app/flow/found/client.tsx', 'src/app/flow/pet/client.tsx', 'src/app/flow/wallet/client.tsx', 'src/app/flow/keys/client.tsx', 'src/app/flow/protect/client.tsx', 'src/app/auth/register/page.tsx', 'src/lib/email.ts'];
  for (const f of lugares) it(`${f}: sem «pelo chat da plataforma» sobre achador e dono`, () => {
    const c = read(f);
    const sobra = (c.match(/[^\n]*pelo chat da plataforma[^\n]*/gi) ?? []).filter((l) => !/match|Match|correspond/.test(l) && !/FRASE_FIXA|trocada em 14\/11\/2026/.test(l));
    expect(sobra, f).toEqual([]);
    expect(c, f).not.toMatch(/chat interno|Converse com segurança/);
  });
  it('o chat das correspondências confirmadas (existe) segue com o texto dele', () => {
    expect(read('src/lib/chatUnreadEmail.ts')).toContain('A conversa acontece pelo chat da plataforma.');
    expect(read('src/lib/pushNotification.ts')).toContain('Combine a devolução pelo chat.');
  });
  it('textos novos presentes e sem promessa (alerta imediato, chat protegido, resposta)', () => {
    expect(read('src/app/faq/client.tsx')).toContain('push e e-mail saem só quando o dono não é legado');
    expect(read('src/app/page.tsx')).toContain('O aviso fica registrado na ocorrência; não há garantia de resposta.');
    expect(read('src/app/encontrei/page.tsx')).toContain('O aviso ao dono fica registrado na ocorrência; não há garantia de resposta.');
    expect(read('src/app/blog/[slug]/page.tsx')).toContain('não há garantia de resposta');
    expect(read('src/components/AssistantWidget.tsx')).not.toMatch(/ele pode responder|notificação imediata\\n3\./i);
  });
});

describe('filtro de linguagem do assistente: o texto fixo novo passa limpo e o filtro segue agindo', () => {
  it('T1 e T3 não disparam o próprio filtro', () => {
    expect(aplicarFiltroDeLinguagem(T1).disparou).toBe(false); expect(aplicarFiltroDeLinguagem(T3).disparou).toBe(false);
    expect(T1).toBe('O aviso fica registrado na ocorrência; não há garantia de resposta.');
  });
  it('promessa de contato protegido continua sendo cortada', () => {
    const r = aplicarFiltroDeLinguagem('Pode ficar tranquilo: seu telefone fica totalmente protegido.'); expect(r.disparou).toBe(true);
  });
});
