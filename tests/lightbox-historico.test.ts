// Foto ampliada × histórico: abrir, fechar por X/ESC/toque fora, fechar pelo gesto de voltar, repetir sem acumular entradas; deslize sem foto invisível. Sem banco.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';
import { BORDA_GESTO_PX, LIGHTBOX_CHAVE, abrirEntradaLightbox, decidirDeslize } from '@/lib/lightboxHistorico';

const read = (rel: string) => readFileSync(path.join(__dirname, '..', rel), 'utf8');

/** Navegador falso: pilha de histórico com state, pushState, back() e popstate, no estilo do Next (estado com __NA e árvore). */
function janelaFalsa() {
  const pilha: { state: unknown; url: string }[] = [{ state: { __NA: true, __PRIVATE_NEXTJS_INTERNALS_TREE: ['arvore'] }, url: '/objeto/ABC12345' }];
  let i = 0; const ouvintes = new Set<() => void>();
  const w = {
    history: {
      get state() { return pilha[i].state; },
      pushState(data: unknown, _u: string, url?: string | URL | null) { pilha.splice(i + 1); pilha.push({ state: data, url: url ? String(url) : pilha[i].url }); i++; },
      back() { if (i > 0) { i--; [...ouvintes].forEach((f) => f()); } },
    },
    addEventListener(_t: 'popstate', f: () => void) { ouvintes.add(f); },
    removeEventListener(_t: 'popstate', f: () => void) { ouvintes.delete(f); },
  };
  return { w, pilha, indice: () => i, ouvintes: () => ouvintes.size, avancar() { if (i < pilha.length - 1) { i++; [...ouvintes].forEach((f) => f()); } } };
}

describe('entrada de histórico da foto', () => {
  it('abrir: UMA entrada nova, mesma URL, estado do Next preservado (__NA e árvore) + marca da foto', () => {
    const j = janelaFalsa(); abrirEntradaLightbox(() => {}, j.w);
    expect(j.pilha.length).toBe(2); expect(j.indice()).toBe(1);
    expect(j.pilha[1].url).toBe('/objeto/ABC12345');
    const st = j.pilha[1].state as Record<string, unknown>;
    expect(st.__NA).toBe(true); expect(st.__PRIVATE_NEXTJS_INTERNALS_TREE).toEqual(['arvore']); expect(typeof st[LIGHTBOX_CHAVE]).toBe('string');
  });
  it('gesto/botão de voltar (popstate): fecha só a foto, não deixa ouvinte nem entrada para trás', () => {
    const j = janelaFalsa(); let fechou = 0; abrirEntradaLightbox(() => fechou++, j.w);
    j.w.history.back();
    expect(fechou).toBe(1); expect(j.indice()).toBe(0); expect(j.ouvintes()).toBe(0);
  });
  it('fechar pelo X, toque fora ou ESC (desmontagem): desfaz a entrada, sem fechar duas vezes', () => {
    const j = janelaFalsa(); let fechou = 0; const encerrar = abrirEntradaLightbox(() => fechou++, j.w);
    encerrar();
    expect(fechou).toBe(0); expect(j.indice()).toBe(0); expect(j.ouvintes()).toBe(0);
    encerrar(); expect(j.indice()).toBe(0); // idempotente: não volta uma segunda vez
  });
  it('abrir e fechar várias vezes (X, gesto, X, gesto…) não acumula entradas', () => {
    const j = janelaFalsa();
    for (let n = 0; n < 6; n++) {
      let fechou = 0; const encerrar = abrirEntradaLightbox(() => fechou++, j.w);
      expect(j.indice(), `abrir ${n}`).toBe(1);
      if (n % 2 === 0) encerrar(); else { j.w.history.back(); expect(fechou).toBe(1); encerrar(); /* desmontagem depois do gesto: nada a desfazer */ }
      expect(j.indice(), `fechar ${n}`).toBe(0); expect(j.ouvintes()).toBe(0);
    }
    expect(j.pilha[0].state).toEqual({ __NA: true, __PRIVATE_NEXTJS_INTERNALS_TREE: ['arvore'] }); // a entrada da página nunca foi alterada
  });
  it('não desfaz entrada de OUTRA tela: se a entrada atual não é a da foto (ex.: navegação no meio), não chama back()', () => {
    const j = janelaFalsa(); const encerrar = abrirEntradaLightbox(() => {}, j.w);
    j.w.history.pushState({ __NA: true, outra: 1 }, '', '/dashboard'); // a página navegou por cima da foto
    const antes = j.indice(); encerrar();
    expect(j.indice()).toBe(antes);
  });
  it('popstate que cai na própria entrada da foto (avançar) é ignorado', () => {
    const j = janelaFalsa(); let fechou = 0; abrirEntradaLightbox(() => fechou++, j.w);
    j.w.history.state && void 0; // estado atual é o da foto
    j.avancar(); // sem entrada à frente: nada acontece
    expect(fechou).toBe(0);
    j.w.history.back(); expect(fechou).toBe(1);
  });
  it('sem window (servidor) ou com pushState que falha: não lança erro; X e toque fora seguem valendo', () => {
    expect(() => abrirEntradaLightbox(() => {}, null)()).not.toThrow();
    const j = janelaFalsa(); (j.w.history as { pushState: () => void }).pushState = () => { throw new Error('x'); };
    const encerrar = abrirEntradaLightbox(() => {}, j.w); expect(() => encerrar()).not.toThrow(); expect(j.indice()).toBe(0);
  });
});

describe('deslizar para passar de foto', () => {
  it('uma foto só: nunca passa (antes deixava a foto invisível e o «carregando» para sempre)', () => {
    expect(decidirDeslize({ x: 150, y: 400 }, { x: 300, y: 400 }, 1)).toBeNull();
    expect(decidirDeslize({ x: 300, y: 400 }, { x: 100, y: 400 }, 1)).toBeNull();
  });
  it('começar na borda esquerda (gesto de voltar do iOS) não passa de foto', () => {
    expect(BORDA_GESTO_PX).toBeGreaterThan(10);
    expect(decidirDeslize({ x: 2, y: 400 }, { x: 200, y: 400 }, 4)).toBeNull();
    expect(decidirDeslize({ x: BORDA_GESTO_PX, y: 400 }, { x: 200, y: 400 }, 4)).toBeNull();
  });
  it('com 2+ fotos, deslize horizontal fora da borda continua passando (esquerda = próxima, direita = anterior); vertical e curto não', () => {
    expect(decidirDeslize({ x: 300, y: 400 }, { x: 200, y: 410 }, 3)).toBe('proxima');
    expect(decidirDeslize({ x: 100, y: 400 }, { x: 200, y: 410 }, 3)).toBe('anterior');
    expect(decidirDeslize({ x: 150, y: 400 }, { x: 170, y: 400 }, 3)).toBeNull();
    expect(decidirDeslize({ x: 150, y: 300 }, { x: 200, y: 600 }, 3)).toBeNull();
  });
});

describe('componente e pontos de uso', () => {
  const src = read('src/components/ImageLightbox.tsx');
  it('usa o módulo do histórico e decidirDeslize; toque cancelado pelo sistema zera o gesto', () => {
    expect(src).toContain('useEffect(() => abrirEntradaLightbox(() => onCloseRef.current()), []);');
    expect(src).toContain('decidirDeslize('); expect(src).toContain('onTouchCancel={handleTouchCancel}');
    expect(src).not.toMatch(/history\.(pushState|back)\(/); // o histórico fica só no módulo
  });
  it('X de 44 px, área segura, toque fora, ESC e setas continuam', () => {
    expect(src).toMatch(/bf-lightbox-fechar[^"]*w-11 h-11/); expect(src).toContain('aria-label="Fechar"');
    expect(src).toMatch(/onClick=\{onClose\}\s*\n\s*onTouchStart/); expect(src).toContain("e.key === 'Escape'");
    expect(read('src/app/globals.css')).toContain('.bf-lightbox-fechar');
  });
  it('os 6 pontos de uso continuam abrindo e fechando com o mesmo par open/close', () => {
    for (const f of ['src/app/admin/objects/[id]/page.tsx', 'src/app/objeto/[code]/client.tsx', 'src/app/scan/[code]/client.tsx', 'src/app/dashboard/objects/[id]/page.tsx', 'src/app/achei/client.tsx', 'src/app/buscar/client.tsx'])
      expect(read(f), f).toContain('<ImageLightbox images={lightbox.images} initialIndex={lightbox.index} onClose={closeLightbox} />');
  });
  it('«Voltar» da ocorrência e a marca de origem do Feed não foram alterados', () => {
    expect(read('src/components/VoltarAoFeed.tsx')).toContain('window.history.back()');
    expect(read('src/lib/voltarFeed.ts')).toContain("ORIGEM_FEED_CHAVE = 'bf-origem-feed-v1'");
  });
});
