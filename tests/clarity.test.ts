// Clarity: quando pode carregar (produção real, host oficial, rota pública, variável definida)
// e guardas para que nenhuma rota nova fique sem decisão. Sem dado real: ids e caminhos fictícios.
import { describe, expect, it } from 'vitest';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import {
  CLARITY_EXCLUDED_PREFIXES,
  CLARITY_MASKED_SEGMENTS,
  CLARITY_PUBLIC_PREFIXES,
  isClarityExcludedPath,
  isClarityHost,
  isValidClarityId,
  shouldLoadClarity,
} from '@/lib/clarity';

const ROOT = path.resolve(__dirname, '..');
const APP = path.join(ROOT, 'src/app');
const ok = { projectId: 'abc123xyz9', hostname: 'backfindr.com', pathname: '/', nodeEnv: 'production' };

describe('shouldLoadClarity — só em produção real, host oficial e rota pública', () => {
  it('carrega na home, no flow e no objeto públicos', () => {
    for (const p of ['/', '/flow/lost', '/objeto/ABC123', '/feed', '/pricing', '/blog/qualquer-post']) {
      expect(shouldLoadClarity({ ...ok, pathname: p }), p).toBe(true);
    }
  });
  it('aceita o www do domínio oficial', () => {
    expect(shouldLoadClarity({ ...ok, hostname: 'www.backfindr.com' })).toBe(true);
  });
  it('sem a variável (ou inválida) nada carrega', () => {
    for (const projectId of [undefined, null, '', '   ', 'x', 'abc"><script>', 'a b c d e f g']) {
      expect(shouldLoadClarity({ ...ok, projectId }), String(projectId)).toBe(false);
    }
  });
  it('fora de produção nada carrega', () => {
    for (const nodeEnv of ['development', 'test', undefined, null]) {
      expect(shouldLoadClarity({ ...ok, nodeEnv })).toBe(false);
    }
  });
  it('preview da Vercel, localhost e domínios parecidos não carregam', () => {
    for (const hostname of [
      'backfindr-git-alguma-branch-conta.vercel.app',
      'backfindr.vercel.app',
      'localhost',
      '127.0.0.1',
      'backfindr.com.br',
      'backfindr.com.evil.example',
      'evilbackfindr.com',
      'app.backfindr.com',
      '',
      undefined,
      null,
    ]) {
      expect(shouldLoadClarity({ ...ok, hostname }), String(hostname)).toBe(false);
      expect(isClarityHost(hostname)).toBe(false);
    }
  });
  it('compara o host sem diferenciar maiúsculas', () => {
    expect(isClarityHost('BackFindr.COM')).toBe(true);
  });
});

describe('rotas excluídas', () => {
  const excluidas = [
    '/admin', '/admin/dashboard', '/admin/users/123',
    '/dashboard', '/dashboard/mensagens', '/dashboard/objects/9/edit',
    '/parceiro', '/parceiro/portaria',
    '/portaria/abc', '/auth/login', '/auth/reset-password', '/auth/magic-confirm',
    '/checkout/success', '/custody/tok123', '/delivery/tok123', '/delivery/entregador/cadastro',
    '/b2b/cadastro', '/condominio/meu-condominio',
  ];
  it.each(excluidas)('%s não carrega', (p) => {
    expect(isClarityExcludedPath(p)).toBe(true);
    expect(shouldLoadClarity({ ...ok, pathname: p })).toBe(false);
  });
  it('ignora maiúsculas, barra final, barras duplas e codificação percentual', () => {
    for (const p of ['/ADMIN/dashboard', '/dashboard/', '//admin', '/%61dmin', '/Dashboard/Mensagens/', '/admin//x']) {
      expect(isClarityExcludedPath(p), p).toBe(true);
    }
  });
  it('sem rota conhecida, não grava', () => {
    expect(isClarityExcludedPath(null)).toBe(true);
    expect(isClarityExcludedPath(undefined)).toBe(true);
  });
  it('não exclui rotas públicas só por parecerem com as excluídas', () => {
    for (const p of ['/', '/flow/lost', '/administradores', '/dashboardx', '/authors', '/u/abc']) {
      expect(isClarityExcludedPath(p), p).toBe(false);
    }
  });
  it('caminho malformado (%) não quebra', () => {
    expect(() => isClarityExcludedPath('/%E0%A4%A')).not.toThrow();
  });
});

describe('guarda: toda pasta de src/app tem decisão', () => {
  const pastas = readdirSync(APP).filter((n) => statSync(path.join(APP, n)).isDirectory() && n !== 'api');
  const decididas = new Set(
    [...CLARITY_EXCLUDED_PREFIXES, ...CLARITY_PUBLIC_PREFIXES].map((p) => p.replace(/^\//, '')),
  );
  it('nenhuma pasta nova fica sem decisão (entra em excluídas ou em públicas)', () => {
    const semDecisao = pastas.filter((n) => !decididas.has(n));
    expect(semDecisao).toEqual([]);
  });
  it('as listas não se sobrepõem e só citam pastas que existem', () => {
    const exc = CLARITY_EXCLUDED_PREFIXES.map((p) => p.slice(1));
    const pub = CLARITY_PUBLIC_PREFIXES.map((p) => p.slice(1));
    expect(exc.filter((n) => pub.includes(n))).toEqual([]);
    expect([...exc, ...pub].filter((n) => !pastas.includes(n))).toEqual([]);
  });
  it('as áreas pedidas pelo Marcos estão excluídas', () => {
    for (const p of ['/dashboard', '/admin', '/parceiro', '/portaria']) {
      expect(CLARITY_EXCLUDED_PREFIXES).toContain(p);
    }
  });
});

describe('mascaramento por segmento público', () => {
  it('só segmentos públicos, e cada um tem layout com <ClarityMask>', () => {
    for (const s of CLARITY_MASKED_SEGMENTS) {
      expect(CLARITY_PUBLIC_PREFIXES).toContain(`/${s.split('/')[0]}`);
      const f = path.join(APP, s, 'layout.tsx');
      expect(existsSync(f), f).toBe(true);
      expect(readFileSync(f, 'utf8')).toContain('<ClarityMask>');
    }
  });
  it('todo fluxo de /flow tem a máscara (um fluxo novo não passa sem decisão)', () => {
    const fluxos = readdirSync(path.join(APP, 'flow')).filter((n) => statSync(path.join(APP, 'flow', n)).isDirectory());
    expect(fluxos.map((n) => `flow/${n}`).sort()).toEqual(CLARITY_MASKED_SEGMENTS.filter((x) => x.startsWith('flow/')).sort());
  });
  it('nenhum layout de área excluída recebe a máscara (não muda o que já existe)', () => {
    for (const p of CLARITY_EXCLUDED_PREFIXES) {
      const f = path.join(APP, p.slice(1), 'layout.tsx');
      if (existsSync(f)) expect(readFileSync(f, 'utf8')).not.toContain('ClarityMask');
    }
  });
  it('o wrapper não cria caixa e usa o atributo documentado do Clarity', () => {
    const src = readFileSync(path.join(ROOT, 'src/components/ClarityMask.tsx'), 'utf8');
    expect(src).toContain('data-clarity-mask="True"');
    expect(src).toContain('className="contents"');
  });
});

describe('ponto único de carregamento', () => {
  it('o layout raiz usa o ClarityLoader e não tem mais o script inline', () => {
    const layout = readFileSync(path.join(APP, 'layout.tsx'), 'utf8');
    expect(layout).toContain('<ClarityLoader');
    expect(layout).not.toMatch(/clarity\.ms/);
    expect(layout).not.toContain('microsoft-clarity');
  });
  it('o endereço do script do Clarity só existe no ClarityLoader', () => {
    const achados: string[] = [];
    const varre = (dir: string) => {
      for (const n of readdirSync(dir)) {
        const f = path.join(dir, n);
        if (statSync(f).isDirectory()) varre(f);
        else if (/\.(tsx?|jsx?|html)$/.test(n) && readFileSync(f, 'utf8').includes('clarity.ms/tag')) {
          achados.push(path.relative(ROOT, f));
        }
      }
    };
    varre(path.join(ROOT, 'src'));
    expect(achados).toEqual(['src/components/ClarityLoader.tsx']);
  });
  it('o id vem só da variável de ambiente (nenhum id fixo no código)', () => {
    const loader = readFileSync(path.join(ROOT, 'src/components/ClarityLoader.tsx'), 'utf8');
    expect(loader).not.toMatch(/['"`][a-z0-9]{10}['"`]\s*\)/);
    expect(isValidClarityId('abc123xyz9')).toBe(true);
  });
});
