// Meta Pixel e GA4 não podem receber URL com token (link mágico, redefinição de senha, /custody, /delivery).
// Tokens e caminhos fictícios; nada de dado real.
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { SENSITIVE_QUERY_PARAMS, TRACKING_BLOCKED_PATHS, isTrackingBlocked } from '@/lib/trackingGuard';

const ROOT = path.resolve(__dirname, '..');
const APP = path.join(ROOT, 'src/app');

describe('isTrackingBlocked — o que bloqueia', () => {
  const bloqueadas: [string, string?][] = [
    ['/auth/magic-confirm', '?token=abc'],
    ['/auth/magic-confirm'],
    ['/auth/reset-password', '?token=abc'],
    ['/auth/reset-password'],
    ['/custody/cst_ABC123'],
    ['/delivery/dlv_ABC123'],
    ['/AUTH/Magic-Confirm/', '?token=abc'],
    ['/%61uth/reset-password'],
    ['//custody/x'],
    // rede de segurança: parâmetro de credencial em qualquer rota
    ['/pricing', '?token=abc'],
    ['/qualquer/coisa', '?x=1&ACCESS_TOKEN=abc'],
    ['/qualquer', '?refresh_token=abc'],
    ['/qualquer', '?id_token=abc&a=b'],
    ['/qualquer', '?otp=123456'],
    ['/qualquer', '?secret=abc'],
    ['/qualquer', '?senha=abc'],
    ['/qualquer', '', '#access_token=abc&token_type=bearer'],
  ];
  it.each(bloqueadas)('%s %s bloqueia', (p, q = '', h = '') => {
    expect(isTrackingBlocked(p, q, h)).toBe(true);
  });
  it('sem rota conhecida, bloqueia', () => {
    expect(isTrackingBlocked(null)).toBe(true);
    expect(isTrackingBlocked(undefined)).toBe(true);
  });
});

describe('isTrackingBlocked — o que NÃO muda (Pixel e GA4 seguem carregando)', () => {
  const livres: [string, string?, string?][] = [
    ['/'], ['/pricing'], ['/comecar'], ['/flow/lost'], ['/objeto/ABC123'], ['/scan/ABC123'],
    ['/auth/login'], ['/auth/login', '?error=magic_link_invalid'], ['/auth/register'], ['/auth/forgot-password'],
    ['/auth/google-success', '?new=1'], ['/auth/magic-success'],
    ['/checkout/success', '?type=boost&ref=x&object_id=abc'], ['/checkout/failure'],
    ['/dashboard'], ['/dashboard/objects/9/sucesso'], ['/admin/dashboard'],
    ['/delivery/entregador/painel'], ['/delivery/entregador/cadastro'], ['/delivery/entregador'],
    ['/custody'], ['/delivery'],
    ['/objeto/ABC', '?aviso=1'], ['/qualquer', '?utm_source=x&code=PROMO&key=abc&t=1'],
    ['/auth/magic-confirmx'], ['/auth/reset-passwordx'],
  ];
  it.each(livres)('%s %s não bloqueia', (p, q = '', h = '') => {
    expect(isTrackingBlocked(p, q, h)).toBe(false);
  });
  it('caminho ou query malformados não quebram', () => {
    expect(() => isTrackingBlocked('/%E0%A4%A', '?%E0%A4%A=1', '#%')).not.toThrow();
  });
  it('a lista de parâmetros não inclui nomes comuns de páginas públicas', () => {
    for (const nome of ['code', 'key', 't', 'ref', 'type', 'utm_source', 'next', 'aviso', 'error']) {
      expect(SENSITIVE_QUERY_PARAMS).not.toContain(nome);
    }
  });
});

// ── Guardas: rota nova com token precisa ser classificada ─────────────────────
function listar(dir: string, acc: string[] = []): string[] {
  for (const n of readdirSync(dir)) {
    const f = path.join(dir, n);
    if (statSync(f).isDirectory()) listar(f, acc);
    else if (/\.(tsx?|jsx?)$/.test(n)) acc.push(f);
  }
  return acc;
}
const rotaDe = (arquivo: string) =>
  '/' + path.relative(APP, path.dirname(arquivo)).split(path.sep).map((s) => s.replace(/^\[\.*(.+?)\]\]?$/, '$1')).join('/');
const paginas = listar(APP).filter((f) => !f.includes(`${path.sep}api${path.sep}`) && !f.endsWith('.bak'));
const LEGADAS_NO_MIDDLEWARE = ['/auth/magic-success', '/auth/google-success'];

describe('guarda: toda rota com token na URL está classificada', () => {
  it('pastas dinâmicas chamadas [token] são bloqueadas', () => {
    const dirs = new Set(paginas.map((f) => path.dirname(f)).filter((d) => /\[token\]/.test(d)));
    expect(dirs.size).toBeGreaterThan(0);
    for (const d of dirs) {
      const rota = '/' + path.relative(APP, d).split(path.sep).map((s) => (s === '[token]' ? 'tokenficticio' : s)).join('/');
      expect(isTrackingBlocked(rota), rota).toBe(true);
    }
  });
  it('página que lê token/access_token/refresh_token da URL é bloqueada (ou é legada tratada no middleware)', () => {
    // qualquer .get('token'...) exceto de cookies e de headers (access_token também é nome de cookie)
    const re = /(?<![Cc]ookies|[Hh]eaders|cookieStore)\.get\(\s*['"](token|access_token|refresh_token|id_token|otp|secret)['"]\s*\)/;
    const middleware = readFileSync(path.join(ROOT, 'src/middleware.ts'), 'utf8');
    const lendo = paginas.filter((f) => re.test(readFileSync(f, 'utf8')));
    expect(lendo.length).toBeGreaterThanOrEqual(3);
    for (const f of lendo) {
      const rota = rotaDe(f);
      if (LEGADAS_NO_MIDDLEWARE.includes(rota)) {
        expect(middleware, rota).toContain(`'${rota}'`); // o middleware limpa a query antes de a página renderizar
      } else {
        expect(isTrackingBlocked(rota, ''), `${rota} lê credencial da URL e não está em TRACKING_BLOCKED_PATHS`).toBe(true);
      }
    }
  });
  it('a lista de rotas bloqueadas não tem caminho que não exista', () => {
    const rotas = new Set(paginas.map(rotaDe));
    for (const alvo of ['/auth/magic-confirm', '/auth/reset-password', '/custody/tokenficticio', '/delivery/tokenficticio']) {
      expect([...rotas].some((r) => r === alvo || r.replace('/token', '/tokenficticio') === alvo), alvo).toBe(true);
    }
    expect(TRACKING_BLOCKED_PATHS.length).toBe(4);
  });
  it('nenhum <Link> do Next leva a /delivery/<token> ou /custody/<token> (navegação interna enviaria o token ao Pixel)', () => {
    const achados = paginas
      .filter((f) => /<Link[^>]*href=\{[`'"]\/(delivery|custody)\/\$\{/.test(readFileSync(f, 'utf8')))
      .map((f) => path.relative(ROOT, f));
    expect(achados).toEqual([]);
  });
});

describe('layout raiz e TrackingScripts', () => {
  const layout = readFileSync(path.join(APP, 'layout.tsx'), 'utf8');
  const comp = readFileSync(path.join(ROOT, 'src/components/TrackingScripts.tsx'), 'utf8');
  it('o layout usa TrackingScripts e não tem mais GA4 nem Pixel inline', () => {
    expect(layout).toContain('<TrackingScripts');
    expect(layout).toContain('NEXT_PUBLIC_GA_MEASUREMENT_ID');
    expect(layout).toContain('NEXT_PUBLIC_META_PIXEL_ID');
    for (const proibido of ['googletagmanager', 'fbevents', "id=\"google-analytics\"", "id=\"meta-pixel\""]) {
      expect(layout).not.toContain(proibido);
    }
  });
  it('TrackingScripts mantém os mesmos scripts, ids e estratégias de antes', () => {
    expect(comp).toContain('https://www.googletagmanager.com/gtag/js?id=${gaId}');
    expect(comp).toMatch(/id="google-analytics" strategy="lazyOnload"/);
    expect(comp).toMatch(/id="meta-pixel" strategy="afterInteractive"/);
    expect(comp).toContain("fbq('init', '${pixelId}')");
    expect(comp).toContain("fbq('track', 'PageView')");
    expect(comp).toContain('send_page_view: true');
    expect(comp).toContain('isTrackingBlocked(');
  });
  it('o service worker e o Clarity continuam no layout', () => {
    expect(layout).toContain('id="register-sw"');
    expect(layout).toContain('<ClarityLoader');
  });
  it('os eventos de conversão continuam no código, sem alteração de disparo', () => {
    const lê = (p: string) => readFileSync(path.join(ROOT, p), 'utf8');
    expect(lê('src/app/auth/register/page.tsx')).toContain("fbq('track', 'Lead')");
    expect(lê('src/app/checkout/success/client.tsx')).toContain("fbq('track', 'Purchase'");
    expect(lê('src/app/comecar/TrackViewContent.tsx')).toContain("'ViewContent'");
    expect(lê('src/app/dashboard/objects/[id]/sucesso/page.tsx')).toContain("'ocorrencia_publicada'");
  });
});
