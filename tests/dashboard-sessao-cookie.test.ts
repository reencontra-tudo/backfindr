// Guard do /dashboard: com cookie de login válido e estado salvo vazio (ex.: app instalado reaberto), confirma a sessão no servidor ANTES de ir ao login. Sem banco.
// Comportamento verificado também no navegador (cookies válidos + localStorage vazio → fica em /dashboard).
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';

const src = readFileSync(path.join(__dirname, '..', 'src/app/dashboard/layout.tsx'), 'utf8');
const efeitoInicial = src.slice(src.indexOf('// Após hidratação: se não autenticado mas tem cookie'), src.indexOf('// Redireciona se perder autenticação'));
const efeitoRedirect = src.slice(src.indexOf('// Redireciona se perder autenticação'), src.indexOf('// Buscar contagem de objetos'));

describe('guard do dashboard com cookie e sem estado salvo', () => {
  it('com cookie: marca «verificando», espera o fetchMe terminar e só então decide', () => {
    expect(efeitoInicial).toContain("Cookies.get('access_token') || Cookies.get('refresh_token')");
    expect(efeitoInicial).toMatch(/verificando\.current = true;\s*fetchMe\(\)\.finally\(\(\) => \{\s*verificando\.current = false;\s*if \(!useAuthStore\.getState\(\)\.isAuthenticated\) irParaLogin\(\);/);
  });
  it('o efeito de redirecionamento NÃO manda ao login enquanto a sessão está sendo confirmada', () => {
    expect(efeitoRedirect).toContain('hydrated && !isAuthenticated && initDone.current && !verificando.current');
  });
  it('sem cookie nenhum: vai direto ao login (como antes); o destino pretendido continua sendo guardado', () => {
    expect(efeitoInicial).toMatch(/\} else \{\s*irParaLogin\(\);/);
    expect(src).toContain('proximaPaginaSegura(pathname)');
  });
  it('sessão inválida (401) continua levando ao login: fetchMe limpa os tokens e o finally redireciona', () => {
    const auth = readFileSync(path.join(__dirname, '..', 'src/hooks/useAuth.ts'), 'utf8');
    expect(auth).toMatch(/if \(isInvalidSessionError\(e\)\) \{ clearTokens\(\); set\(\{ user: null, isAuthenticated: false \}\); \}/);
  });
  it('o guard do admin já esperava o fetchMe (não tinha o problema)', () => {
    const adm = readFileSync(path.join(__dirname, '..', 'src/app/admin/layout.tsx'), 'utf8');
    expect(adm).toMatch(/if \(!isAuthenticated\) await fetchMe\(\)\.catch\(\(\) => \{\}\);\s*setChecking\(false\)/);
  });
});
