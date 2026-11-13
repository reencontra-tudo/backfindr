// Feed: restaurar a posição ao voltar pelo botão «voltar» do navegador. Lógica pura (src/lib/feed/estado.ts) + regras do código.
// O comportamento com navegador de verdade (voltar, F5, nova aba) é conferido em tools/feed-voltar-check.mjs.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';
import {
  ESTADO_CHAVE, ESTADO_IDADE_MAX_MS, ESTADO_MAX_CARDS, JANELA_VOLTAR_MS, compactar, criarEstado, descartarEstado, deveRestaurar, escolherCorte,
  expandir, lerEstado, salvarEstado, validarEstado, type Marco,
} from '@/lib/feed/estado';
import type { FeedItem } from '@/lib/feed/query';

const read = (rel: string) => readFileSync(path.join(__dirname, '..', rel), 'utf8');
const client = read('src/app/feed/FeedClient.tsx');
const mk = (i: number, o: Partial<FeedItem> = {}): FeedItem => ({
  code: `T${String(i).padStart(7, '0')}`, title: `Ocorrência ${i}`, status: 'lost', status_label: 'Perdido', category: 'phone', category_label: 'Celular',
  origin: 'usuario', location_label: 'Boa Viagem, Recife - PE', has_photo: i % 2 === 0, photo_url: i % 2 === 0 ? 'https://pub-test.r2.dev/a.jpg' : null,
  created_at: '2026-11-10T10:00:00.000Z', source_url: null, source_name: null, can_report_found: true, ...o,
});
const lista = (n: number) => Array.from({ length: n }, (_, i) => mk(i + 1));
const FILTROS = { status: 'all', category: 'all', region: 'todas', geo: null };
const AGORA = 1_800_000_000_000;
const ctx = { agora: AGORA, pagina: 1, regioes: ['PE', 'SP'] };
const estado = (o: Record<string, unknown> = {}) => ({ ...criarEstado({ agora: AGORA, pagina: 1, itens: lista(24), cursor: 'cur24', temMais: true, autoLotes: 1, filtros: FILTROS, scrollY: 5317.4 }), ...o });
/** sessionStorage de mentira */
const fake = (ini: Record<string, string> = {}) => { const m = new Map(Object.entries(ini)); return { m, getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v); }, removeItem: (k: string) => { m.delete(k); } }; };
const quebrado = { getItem: () => { throw new Error('SecurityError'); }, setItem: () => { throw new Error('QuotaExceededError'); }, removeItem: () => { throw new Error('SecurityError'); } };

describe('salvar: só o necessário e no máximo 36 cards', () => {
  it('guarda só os campos que a tela usa (sem category_label nem has_photo; recalculados ao restaurar)', () => {
    const c = compactar(mk(2));
    expect(Object.keys(c).sort()).toEqual(['can_report_found', 'category', 'code', 'created_at', 'location_label', 'origin', 'photo_url', 'source_name', 'source_url', 'status', 'status_label', 'title']);
    expect(expandir(c)).toEqual(mk(2));                                   // volta idêntico ao item original (foto)
    expect(expandir(compactar(mk(1)))).toEqual(mk(1));                    // e sem foto
  });
  it('criarEstado: versão 1, hora, página, rolagem arredondada, nunca mais que 36 cards', () => {
    const e = criarEstado({ agora: AGORA, pagina: 3, itens: lista(60), cursor: 'c', temMais: true, autoLotes: 2, filtros: FILTROS, scrollY: 1234.6 });
    expect(e.v).toBe(1); expect(e.t).toBe(AGORA); expect(e.pagina).toBe(3); expect(e.scrollY).toBe(1235); expect(e.itens.length).toBe(ESTADO_MAX_CARDS);
  });
  it('a chave é versionada', () => { expect(ESTADO_CHAVE).toBe('feed-state-v1'); });
  it('escolherCorte: até 36 usa a lista inteira; passou de 36 (clicou em «Ver mais») volta ao último ponto que cabe, com o cursor DESSE ponto', () => {
    const marcos: Marco[] = [{ n: 12, cursor: 'c12', temMais: true }, { n: 24, cursor: 'c24', temMais: true }, { n: 36, cursor: 'c36', temMais: true }, { n: 48, cursor: 'c48', temMais: true }];
    expect(escolherCorte(lista(24), marcos, { cursor: 'c24', temMais: true })).toMatchObject({ cursor: 'c24', temMais: true });
    expect(escolherCorte(lista(24), marcos, { cursor: 'c24', temMais: true })!.itens.length).toBe(24);
    const c = escolherCorte(lista(48), marcos, { cursor: 'c48', temMais: true })!;
    expect(c.itens.length).toBe(36); expect(c.cursor).toBe('c36'); expect(c.itens[35].code).toBe(lista(48)[35].code);
    expect(escolherCorte([], marcos, { cursor: null, temMais: false })).toBeNull();
    expect(escolherCorte(lista(60), [{ n: 60, cursor: 'x', temMais: true }], { cursor: 'x', temMais: true })).toBeNull(); // sem ponto de corte que caiba: não guarda
  });
});

describe('validar: versão, idade, página, formato, filtros', () => {
  it('estado bom é aceito', () => { expect(validarEstado(estado(), ctx)).not.toBeNull(); });
  it('versão errada → descarta', () => { expect(validarEstado(estado({ v: 2 }), ctx)).toBeNull(); expect(validarEstado(estado({ v: undefined }), ctx)).toBeNull(); });
  it('expirado (mais de 30 min) → descarta; 30 min exatos ainda vale', () => {
    expect(ESTADO_IDADE_MAX_MS).toBe(30 * 60 * 1000);
    expect(validarEstado(estado(), { ...ctx, agora: AGORA + ESTADO_IDADE_MAX_MS })).not.toBeNull();
    expect(validarEstado(estado(), { ...ctx, agora: AGORA + ESTADO_IDADE_MAX_MS + 1 })).toBeNull();
    expect(validarEstado(estado({ t: AGORA + 10 * 60_000 }), ctx)).toBeNull();     // hora no futuro (relógio errado)
  });
  it('outra página do Feed (/feed/pagina/2) → descarta', () => { expect(validarEstado(estado(), { ...ctx, pagina: 2 })).toBeNull(); });
  it('filtros: estado (UF) só vale se existir na lista de regiões; categoria e situação só as conhecidas', () => {
    expect(validarEstado(estado({ filtros: { ...FILTROS, region: 'PE' } }), ctx)).not.toBeNull();
    expect(validarEstado(estado({ filtros: { ...FILTROS, region: 'RJ' } }), ctx)).toBeNull();
    expect(validarEstado(estado({ filtros: { ...FILTROS, category: 'foguete' } }), ctx)).toBeNull();
    expect(validarEstado(estado({ filtros: { ...FILTROS, status: 'arquivado' } }), ctx)).toBeNull();
    expect(validarEstado(estado({ filtros: { ...FILTROS, category: 'wallet', status: 'stolen' } }), ctx)).not.toBeNull();
  });
  it('«Só a minha cidade» / «Perto de mim» só vale com a região já guardada (para não chamar /geo ao restaurar)', () => {
    expect(validarEstado(estado({ filtros: { ...FILTROS, region: 'cidade', geo: null } }), ctx)).toBeNull();
    expect(validarEstado(estado({ filtros: { ...FILTROS, region: 'auto', geo: null } }), ctx)).toBeNull();
    expect(validarEstado(estado({ filtros: { ...FILTROS, region: 'cidade', geo: { city: null, uf: 'PE' } } }), ctx)).toBeNull();
    expect(validarEstado(estado({ filtros: { ...FILTROS, region: 'cidade', geo: { city: 'Recife', uf: 'PE' } } }), ctx)).not.toBeNull();
    expect(validarEstado(estado({ filtros: { ...FILTROS, region: 'auto', geo: { city: null, uf: 'PE' } } }), ctx)).not.toBeNull();
    expect(validarEstado(estado({ filtros: { ...FILTROS, region: 'cidade', geo: { city: 'Recife', uf: 'pe' } } }), ctx)).toBeNull(); // UF inválida
  });
  it('lista corrompida: vazia, mais de 36, duplicada, item sem campo, status/categoria inventados, foto que não é http(s)', () => {
    const base = estado(); const it0 = base.itens[0];
    expect(validarEstado({ ...base, itens: [] }, ctx)).toBeNull();
    expect(validarEstado({ ...base, itens: lista(37).map(compactar) }, ctx)).toBeNull();
    expect(validarEstado({ ...base, itens: [it0, it0] }, ctx)).toBeNull();
    expect(validarEstado({ ...base, itens: [{ ...it0, title: undefined }] }, ctx)).toBeNull();
    expect(validarEstado({ ...base, itens: [{ ...it0, status: 'sumido' }] }, ctx)).toBeNull();
    expect(validarEstado({ ...base, itens: [{ ...it0, category: 'x' }] }, ctx)).toBeNull();
    expect(validarEstado({ ...base, itens: [{ ...it0, photo_url: 'javascript:alert(1)' }] }, ctx)).toBeNull();
    expect(validarEstado({ ...base, itens: [{ ...it0, source_url: 'data:text/html,x' }] }, ctx)).toBeNull();
  });
  it('cursor, rolagem e lotes: tipos e limites', () => {
    expect(validarEstado(estado({ temMais: true, cursor: null }), ctx)).toBeNull();       // «tem mais» sem cursor não se sustenta
    expect(validarEstado(estado({ temMais: false, cursor: null }), ctx)).not.toBeNull();
    expect(validarEstado(estado({ scrollY: -1 }), ctx)).toBeNull();
    expect(validarEstado(estado({ scrollY: 'alto' }), ctx)).toBeNull();
    expect(validarEstado(estado({ scrollY: Number.NaN }), ctx)).toBeNull();
    expect(validarEstado(estado({ autoLotes: 1.5 }), ctx)).toBeNull();
    expect(validarEstado(estado({ autoLotes: -1 }), ctx)).toBeNull();
  });
  it('lixo que não é objeto → null e nunca lança', () => {
    for (const v of [null, undefined, 42, 'texto', [], true]) expect(validarEstado(v, ctx)).toBeNull();
  });
});

describe('ler / salvar / descartar no sessionStorage (com falhas)', () => {
  it('salvar e ler de volta o mesmo estado', () => {
    const s = fake(); const e = estado();
    expect(salvarEstado(s, e)).toBe(true);
    expect(lerEstado(s, ctx)).toEqual(e);
  });
  it('JSON inválido → null e apaga o lixo, em silêncio', () => {
    const s = fake({ [ESTADO_CHAVE]: '{isto não é json' });
    expect(lerEstado(s, ctx)).toBeNull(); expect(s.m.has(ESTADO_CHAVE)).toBe(false);
  });
  it('versão errada, expirado ou filtros diferentes → null e apaga', () => {
    for (const ruim of [estado({ v: 9 }), estado({ t: AGORA - ESTADO_IDADE_MAX_MS - 1 }), estado({ filtros: { ...FILTROS, region: 'RJ' } })]) {
      const s = fake({ [ESTADO_CHAVE]: JSON.stringify(ruim) });
      expect(lerEstado(s, ctx)).toBeNull(); expect(s.m.has(ESTADO_CHAVE)).toBe(false);
    }
  });
  it('nada guardado → null (sem apagar nada)', () => { expect(lerEstado(fake(), ctx)).toBeNull(); });
  it('sessionStorage indisponível (null) ou que lança erro (modo privado, cota cheia): nada lança', () => {
    expect(lerEstado(null, ctx)).toBeNull(); expect(salvarEstado(null, estado())).toBe(false); expect(() => descartarEstado(null)).not.toThrow();
    expect(lerEstado(quebrado, ctx)).toBeNull();
    expect(salvarEstado(quebrado, estado())).toBe(false);
    expect(() => descartarEstado(quebrado)).not.toThrow();
  });
  it('descartar apaga a chave', () => { const s = fake({ [ESTADO_CHAVE]: '1' }); descartarEstado(s); expect(s.m.size).toBe(0); });
});

describe('quando restaurar: só em voltar/avançar', () => {
  it('voltar em navegação interna (popstate logo antes) → restaura, mesmo com o tipo do documento «navigate»', () => {
    expect(deveRestaurar({ tipoNavegacao: 'navigate', primeiraMontagem: false, voltouAgora: true })).toBe(true);
    expect(deveRestaurar({ tipoNavegacao: 'navigate', primeiraMontagem: true, voltouAgora: true })).toBe(true);
  });
  it('carga nova por «voltar» (back_forward) → restaura, mas só na primeira montagem do documento', () => {
    expect(deveRestaurar({ tipoNavegacao: 'back_forward', primeiraMontagem: true, voltouAgora: false })).toBe(true);
    expect(deveRestaurar({ tipoNavegacao: 'back_forward', primeiraMontagem: false, voltouAgora: false })).toBe(false);
  });
  it('abertura normal, link novo, F5 (reload), nova aba (navigate) e prerender → NÃO restaura', () => {
    for (const t of ['navigate', 'reload', 'prerender', null]) expect(deveRestaurar({ tipoNavegacao: t, primeiraMontagem: true, voltouAgora: false }), String(t)).toBe(false);
  });
  it('a janela de «acabei de voltar» é curta', () => { expect(JANELA_VOLTAR_MS).toBeLessThanOrEqual(10_000); });
});

describe('regras no código (FeedClient)', () => {
  it('restaura só dentro do navegador (efeito de layout), sem tocar no HTML do servidor: estado inicial = props do servidor', () => {
    expect(client).toContain('const [items, setItems] = useState<FeedItem[]>(initialItems);');
    expect(client).toContain("const useIsoLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;");
    expect(client).toContain('if (!voltou) { descartarEstado(storage); return; }');           // abertura normal/F5/nova aba: descarta
    expect(client).toContain('lerEstado(storage, { agora: Date.now(), pagina: page, regioes: regions })');
  });
  it('não chama /geo nem /api/v1/feed ao restaurar: o efeito de restauração não usa fetch, reload nem detectGeo', () => {
    const bloco = client.slice(client.indexOf('useIsoLayoutEffect(() => {'), client.indexOf('// devolve o valor original'));
    expect(bloco).not.toMatch(/fetch|reload\(|detectGeo|chooseRegion|loadMore/);
  });
  it('o carregamento automático espera a restauração e o limite de 36 continua (autoLotes volta junto)', () => {
    expect(client).toMatch(/if \(!el \|\| !hasMore \|\| autoParou \|\| restaurando \|\| typeof IntersectionObserver === 'undefined'\) return;/);
    expect(client).toContain('setAutoLoads(est.autoLotes)');
    expect(client).toContain('export const podeCarregarAutomatico');
  });
  it('rolagem restaurada com requestAnimationFrame, sem animação, e a pessoa pode interromper (toque, roda, tecla)', () => {
    expect(client).toContain('requestAnimationFrame(tentar)');
    expect(client).toContain("behavior: 'instant'");
    for (const ev of ['touchstart', 'wheel', 'keydown']) expect(client).toContain(`'${ev}'`);
  });
  it('history.scrollRestoration só é desligado ao restaurar e volta ao valor original ao desmontar', () => {
    expect(client).toContain("window.history.scrollRestoration = 'manual'");
    expect(client).toContain('window.history.scrollRestoration = scrollAntes.current');
  });
  it('grava durante a rolagem (throttle), ao esconder/sair da página e no clique de um link; depois do clique que sai, congela (o Next zera a rolagem)', () => {
    expect(client).toContain('const SALVAR_A_CADA_MS = 400;');
    for (const ev of ["'scroll'", "'pagehide'", "'visibilitychange'", "'click'"]) expect(client).toContain(ev);
    expect(client).toContain('congelado.current = true');
    expect(client).toContain('if (restaurandoRef.current || congelado.current) return;');
  });
  it('grava os filtros que GERARAM a lista (não os que a pessoa acabou de escolher e ainda carregam)', () => {
    expect(client).toContain('filtrosDaLista.current = { status: s, category: c, region: r, geo: g };');
    expect(client).toContain('filtros: filtrosDaLista.current');
  });
  it('evento opcional feed_state_restored: só a quantidade de cards (sem dado pessoal)', () => {
    const an = read('src/lib/feed/analytics.ts');
    expect(an).toContain("estadoRestaurado: (cards: number) => send('feed_state_restored', { cards }),");
    expect(client).toContain('feedEvents.estadoRestaurado(foto.current.items.length)');
  });
  it('o que não mudou: «Ver mais» real, limite de lotes, bloco explicativo, botão fixo, página do servidor', () => {
    expect(client).toContain('export const LOTES_AUTOMATICOS = 3;');
    expect(client).toContain("onClick={(e) => { e.preventDefault(); void loadMore('manual'); }}");
    expect(client).toContain('page === 1 && i === 2 ? [card, <FeedAbout');
    const p = read('src/app/feed/[[...slug]]/page.tsx');
    expect(p).toContain('export const revalidate = 300');
    expect(p).toContain("alternates: { canonical: `${APP_URL}/feed` }");
    expect(p).toContain("robots: page === 1 ? { index: true, follow: true } : { index: false, follow: true }");
    expect(read('src/lib/feed/query.ts')).toContain('is_legacy');
  });
});
