// Menu do painel do usuário: item «Feed» (/feed, mesma aba) sem mexer nos demais; admin e home intactos. Sem banco.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';

const read = (rel: string) => readFileSync(path.join(__dirname, '..', rel), 'utf8');
const layout = read('src/app/dashboard/layout.tsx');
const nav = layout.slice(layout.indexOf('const NAV = ['), layout.indexOf('];', layout.indexOf('const NAV = [')));
const itens = [...nav.matchAll(/\{ href: '([^']+)',\s+icon: (\w+),\s+label: '([^']+)',\s+superOnly: (true|false),\s+requiresObjects: (true|false)/g)]
  .map((m) => ({ href: m[1], icon: m[2], label: m[3], superOnly: m[4] === 'true', requiresObjects: m[5] === 'true' }));

describe('item «Feed» no menu do painel do usuário', () => {
  it('existe, aponta para /feed, ícone Newspaper (o mesmo do admin), visível a todos e sem exigir objetos', () => {
    const feed = itens.find((i) => i.href === '/feed');
    expect(feed).toEqual({ href: '/feed', icon: 'Newspaper', label: 'Feed', superOnly: false, requiresObjects: false });
    expect(layout).toMatch(/Lock, MessageSquare, Newspaper,\n\} from 'lucide-react'/);
  });
  it('os demais itens ficam na MESMA ordem e com as MESMAS regras; o Feed entra logo depois de «Mapa»', () => {
    expect(itens.map((i) => i.label)).toEqual(['Visão Geral', 'Meus Objetos', 'Mapa', 'Feed', 'Matches', 'Mensagens', 'Notificações', 'Encomendas', 'Delivery', 'Plano', 'Configurações']);
    const semFeed = itens.filter((i) => i.href !== '/feed');
    expect(semFeed.map((i) => `${i.href}|${i.superOnly}|${i.requiresObjects}`)).toEqual([
      '/dashboard|false|false', '/dashboard/objects|false|true', '/dashboard/mapa|false|false', '/dashboard/matches|false|true', '/dashboard/mensagens|false|false',
      '/dashboard/notifications|false|false', '/dashboard/encomendas|true|false', '/dashboard/delivery|true|false', '/dashboard/billing|false|false', '/dashboard/settings|false|false']);
    expect(nav).toContain("soComMensagens: true"); // «Mensagens» continua condicionada
  });
  it('abre na MESMA aba: o menu usa <Link> sem target nem rel externos (o app instalado não abre aba nova)', () => {
    expect(layout).not.toMatch(/target=|_blank|window\.open/);
    expect(layout).toMatch(/<Link\s+key=\{href\}\s+href=\{href\}\s+className=\{`flex items-center gap-3/);
  });
  it('o mesmo menu serve ao desktop (lateral) e ao celular (gaveta): há um só NAV renderizado nas duas', () => {
    expect((layout.match(/NAV\s*\n\s*\.filter/g) ?? []).length).toBe(1);
    expect(layout).toContain('hidden md:flex w-60'); expect(layout).toMatch(/fixed inset-y-0 left-0 z-50 w-72/);
    expect((layout.match(/<SidebarContent|\{sidebar\}|renderSidebar/g) ?? []).length).toBeGreaterThanOrEqual(2);
  });
});

describe('o que NÃO muda', () => {
  it('menu do admin: o item Feed continua como estava (abre em nova aba, é atalho do admin)', () => {
    const adm = read('src/app/admin/layout.tsx');
    expect(adm).toContain("{ href: '/feed',            icon: Newspaper,       label: 'Feed',        badge: null,              superOnly: false, external: true }");
    expect(adm).toContain('atalho para uma página pública: abre em nova aba');
  });
  it('Navbar da home: sem link para /feed (decisão: visitante vê a mesma home; no celular não há espaço; logado chega pelo «Meu painel»)', () => {
    expect(read('src/components/home/Navbar.tsx')).not.toContain('/feed');
  });
  it('o guard do painel e o «Meu painel» do Feed (ciclo) usam o mesmo destino por perfil', () => {
    expect(read('src/lib/redirectByRole.ts')).toContain("return '/dashboard'");
    expect(read('src/app/feed/FeedClient.tsx')).not.toContain('/dashboard');
  });
});
