// Quem JÁ está logado e chega em /auth/register (ou /auth/login) com `intent` vai ao formulário de ocorrência com o pré-preenchimento, não ao painel. Sem banco.
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'fs';
import path from 'path';

import { INTENCOES_VALIDAS, PARAMS_DO_FORMULARIO, destinoLogadoComIntent } from '@/lib/intencaoCadastro';
import { PARAMS_QUE_DESLIGAM, deveRedirecionar } from '@/components/auth/PortaDeEntrada';
import { getPostLoginRedirect } from '@/lib/redirectByRole';

const root = path.join(__dirname, '..');
const read = (rel: string) => readFileSync(path.join(root, rel), 'utf8');
const q = (s: string) => new URLSearchParams(s);
const destino = (s: string) => destinoLogadoComIntent(q(s));

describe('destino de quem já está logado e veio com intent', () => {
  it('fluxo «lost» do relato: intent + título + local vão ao formulário, re-codificados', () => {
    const d = destino('intent=lost&prefill_title=Meu%20cachorrinho%20pequin%C3%AAs%20sumiu&prefill_location=Rua%20boa%20vista');
    expect(d).toBe('/dashboard/objects/new?intent=lost&prefill_title=Meu+cachorrinho+pequin%C3%AAs+sumiu&prefill_location=Rua+boa+vista');
    const u = new URL(d!, 'https://x.test'); expect(u.pathname).toBe('/dashboard/objects/new');
    expect(u.searchParams.get('prefill_title')).toBe('Meu cachorrinho pequinês sumiu'); expect(u.searchParams.get('prefill_location')).toBe('Rua boa vista');
  });
  it('todos os parâmetros permitidos, na ordem da lista fechada', () => {
    const d = destino('prefill_color=caramelo&prefill_breed=pequin%C3%AAs&prefill_location=Centro&prefill_category=pet&prefill_title=Rex&intent=lost');
    expect(d).toBe('/dashboard/objects/new?intent=lost&prefill_title=Rex&prefill_category=pet&prefill_location=Centro&prefill_breed=pequin%C3%AAs&prefill_color=caramelo');
    expect([...new URL(d!, 'https://x.test').searchParams.keys()]).toEqual(['intent', 'prefill_title', 'prefill_category', 'prefill_location', 'prefill_breed', 'prefill_color']);
  });
  it('as 5 intenções que o formulário entende valem; intenção desconhecida, vazia ou ausente → null (comportamento de sempre)', () => {
    for (const i of INTENCOES_VALIDAS) expect(destino(`intent=${i}`), i).toBe(`/dashboard/objects/new?intent=${i}`);
    for (const s of ['intent=roubo', 'intent=', 'intent=LOST', 'intent=lost%20', 'intent=../admin', 'intent=lost;x', 'prefill_title=Rex', '', 'ref=feed']) {
      const r = destino(s); if (s === 'intent=lost%20') expect(r).toBe('/dashboard/objects/new?intent=lost'); else expect(r, s).toBeNull();
    }
  });
  it('parâmetros extras são descartados (inclusive prefill_name, token e destinos), sem token na saída', () => {
    const d = destino('intent=found&prefill_title=Chave&x=1&next=%2Fadmin&redirect=https%3A%2F%2Fmau.com&access_token=abc&refresh_token=def&token=ghi&prefill_name=Maria&plan=pro&de=ABC12345')!;
    expect([...new URL(d, 'https://x.test').searchParams.keys()]).toEqual(['intent', 'prefill_title']);
    for (const proibido of ['token', 'next', 'redirect', 'mau.com', 'prefill_name', 'plan', 'abc', 'Maria']) expect(d).not.toContain(proibido);
  });
  it('NUNCA redirecionamento aberto: o destino começa sempre em /dashboard/objects/new?, mesmo com valores hostis', () => {
    for (const s of ['intent=lost&prefill_title=https://mau.com', 'intent=lost&prefill_location=//mau.com', 'intent=lost&prefill_title=%0d%0aLocation:%20https://mau.com', 'intent=lost&prefill_title=javascript:alert(1)', 'intent=lost&prefill_category=../../x']) {
      const d = destino(s)!; expect(d.startsWith('/dashboard/objects/new?intent=lost'), s).toBe(true);
      const u = new URL(d, 'https://site.test'); expect(u.origin).toBe('https://site.test'); expect(u.pathname).toBe('/dashboard/objects/new');
    }
    expect(destino('intent=lost&prefill_category=../../x')).toBe('/dashboard/objects/new?intent=lost');   // categoria é um slug simples
    expect(destino('intent=lost&prefill_title=%0d%0aX')).not.toMatch(/%0[dD]|\r|\n/);                       // sem caracteres de controle
  });
  it('limite de tamanho por valor (por caractere: não corta emoji ao meio) e valor vazio/branco some', () => {
    const t = new URL(destino(`intent=lost&prefill_title=${'a'.repeat(500)}`)!, 'https://x.test').searchParams.get('prefill_title')!; expect(t.length).toBe(200);
    const l = new URL(destino(`intent=lost&prefill_location=${'b'.repeat(900)}`)!, 'https://x.test').searchParams.get('prefill_location')!; expect(l.length).toBe(300);
    const e = new URL(destino(`intent=lost&prefill_title=${encodeURIComponent('🐶'.repeat(300))}`)!, 'https://x.test').searchParams.get('prefill_title')!; expect(Array.from(e).length).toBe(200); expect(e).not.toMatch(/�/);
    expect(destino('intent=lost&prefill_title=%20%20&prefill_location=')).toBe('/dashboard/objects/new?intent=lost');
  });
});

describe('integração com a PortaDeEntrada (precedência) — código', () => {
  const porta = read('src/components/auth/PortaDeEntrada.tsx');
  it('logado: destino guardado (aviso/QR) primeiro, depois o do intent, depois o destino por perfil', () => {
    expect(porta).toContain('router.replace(consumirProximaPagina() ?? destinoLogadoComIntent(params) ?? getPostLoginRedirect(role))');
    expect(porta).toContain("import { destinoLogadoComIntent } from '@/lib/intencaoCadastro'");
  });
  it('plan, error e de continuam desligando a porta; `intent` e `prefill_*` NÃO desligam (o visitante segue com o formulário)', () => {
    expect(PARAMS_QUE_DESLIGAM).toEqual(['error', 'plan', 'de']);
    for (const s of ['plan=pro', 'error=x', 'de=ABC12345', 'intent=lost&plan=pro', 'intent=lost&de=ABC']) expect(deveRedirecionar(q(s)), s).toBe(false);
    for (const s of ['', 'intent=lost', 'intent=lost&prefill_title=Rex&prefill_location=Centro', 'ref=feed']) expect(deveRedirecionar(q(s)), s).toBe(true);
  });
  it('sem intent o destino por perfil é o de sempre (usuário, admin, parceiro)', () => {
    expect(destino('ref=feed')).toBeNull(); expect(destino('')).toBeNull();
    expect(getPostLoginRedirect('user')).toBe('/dashboard'); expect(getPostLoginRedirect('admin')).toBe('/admin/dashboard'); expect(getPostLoginRedirect('b2b_admin')).toBe('/parceiro');
  });
  it('o destino é o MESMO para admin e usuário comum (o helper não olha o perfil)', () => {
    expect(destinoLogadoComIntent.length).toBe(1);
    expect(read('src/lib/intencaoCadastro.ts').replace(/\/\/.*$/gm, '')).not.toMatch(/\brole\b|getPostLoginRedirect|admin/);   // código (sem comentários): não olha o perfil
  });
  it('visitante: a tela de entrada não ganhou nada (sem sessão a porta mostra o formulário e o cadastro redireciona como antes)', () => {
    const reg = read('src/app/auth/register/page.tsx');
    expect(reg).toContain("router.push(`/dashboard/objects/new?${params.toString()}`);");
    expect(reg).toContain("params.set('intent', intentSlug);");
    expect(porta).toContain('return <>{children}</>;');
  });
});

describe('alcance: tudo que manda para /auth/register com intent usa só valores aceitos', () => {
  const formulario = read('src/app/dashboard/objects/new/page.tsx');
  it('as intenções válidas são exatamente as chaves de INTENT_MAP do formulário', () => {
    const bloco = formulario.slice(formulario.indexOf('const INTENT_MAP'), formulario.indexOf('};', formulario.indexOf('const INTENT_MAP')));
    const chaves = [...bloco.matchAll(/^\s{2}([a-z]+):\s/gm)].map((m) => m[1]).sort();
    expect(chaves).toEqual([...INTENCOES_VALIDAS].sort());
  });
  it('o formulário lê exatamente os parâmetros da lista fechada (menos o que só o cadastro usa)', () => {
    for (const p of PARAMS_DO_FORMULARIO) expect(formulario, p).toContain(`searchParams.get('${p}')`);
  });
  const arquivos: string[] = [];
  const ler = (d: string) => { for (const n of readdirSync(d)) { const p = path.join(d, n); if (statSync(p).isDirectory()) ler(p); else if (/\.(ts|tsx)$/.test(n)) arquivos.push(p); } };
  ler(path.join(root, 'src'));
  const emissores = arquivos.filter((p) => /auth\/register\?(\$\{|intent=)|\/auth\/register\?\$\{/.test(readFileSync(p, 'utf8')) && !p.includes(`${path.sep}auth${path.sep}register${path.sep}`)).map((p) => path.relative(root, p)).sort();
  it('lista de emissores conhecida (fluxos, home, página do objeto de sinal, contexto do Feed): se surgir outro, revisar', () => {
    expect(emissores).toEqual([
      'src/app/flow/bike/client.tsx', 'src/app/flow/found/client.tsx', 'src/app/flow/keys/client.tsx', 'src/app/flow/lost/client.tsx', 'src/app/flow/pet/client.tsx', 'src/app/flow/phone/client.tsx',
      'src/app/flow/protect/client.tsx', 'src/app/flow/stolen/client.tsx', 'src/app/flow/vehicle/client.tsx', 'src/app/flow/wallet/client.tsx',
      'src/app/objeto/[code]/SinalPublico.tsx', 'src/components/HomeLiveMap.tsx', 'src/lib/feed/contexto.ts',
    ].sort());
  });
  it('cada emissor só usa intenções válidas (lost, found, stolen, protect) e parâmetros permitidos (prefill_name só no «protect», que o cadastro usa)', () => {
    const permitidos = new Set<string>(PARAMS_DO_FORMULARIO); permitidos.add('prefill_name');
    for (const rel of emissores) {
      const src = readFileSync(path.join(root, rel), 'utf8');
      for (const m of src.matchAll(/intent[=:'",\s]+\s*'?(\w+)'?/g)) { const v = m[1]; if (['lost', 'found', 'stolen', 'protect', 'pet', 'intent'].includes(v) || /^\$\{?\w*/.test(v)) continue; }
      for (const m of src.matchAll(/(?:params\.set\(|new URLSearchParams\(\{[^}]*?)'?(intent|prefill_\w+)'?/g)) expect(permitidos.has(m[1]), `${rel}: ${m[1]}`).toBe(true);
      for (const m of src.matchAll(/'intent',\s*'(\w+)'|intent:\s*'(\w+)'|intent=(\w+)/g)) { const v = m[1] || m[2] || m[3]; if (!/^\$/.test(v)) expect((INTENCOES_VALIDAS as readonly string[]).includes(v), `${rel}: intent ${v}`).toBe(true); }
    }
  });
  it('sem eventos de rastreamento novos nem token na URL no helper e na porta', () => {
    for (const f of ['src/lib/intencaoCadastro.ts', 'src/components/auth/PortaDeEntrada.tsx']) expect(read(f), f).not.toMatch(/analytics|posthog|gtag|fbq|clarity|access_token|refresh_token/i);
  });
});
