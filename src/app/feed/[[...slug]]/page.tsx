// /feed — «Feed de ocorrências» (Fase 1). INDEXÁVEL pelo Google; renderizada no servidor.
//
// Cache: renderização estática incremental com revalidação a cada 5 min (sem force-dynamic, sem no-store).
// Rotas: /feed (1ª página, a única indexável) e /feed/pagina/N (links «Ver mais» que funcionam sem JavaScript).
// Filtros NÃO geram URL: são só estado da tela (o endpoint /api/v1/feed atende o cliente). Logo não existem
// URLs de filtro para o Google indexar.
// Variações: canonical sempre aponta para /feed; as páginas numeradas levam também noindex,follow — o Google
// segue os links dos cards, mas só a página principal compete no índice (todos os /objeto/[code] já estão no sitemap).
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { MapPin } from 'lucide-react';
import FeedClient from '../FeedClient';
import { RegisterMenu, TopoBotoes } from '../FeedCta';
import { APP_URL } from '@/lib/constants';
import { getRankedFeed, pageByNumber } from '@/lib/feed/query';
import { temaStyle } from '../tema';

export const revalidate = 300;
export const dynamicParams = true;
export function generateStaticParams() { return []; } // nada é gerado no build; cada página nasce no 1º acesso e é guardada

const MAX_PAGE = 500;

function pageFromSlug(slug?: string[]): number | null {
  if (!slug || slug.length === 0) return 1;
  if (slug.length === 2 && slug[0] === 'pagina' && /^\d{1,3}$/.test(slug[1])) {
    const n = parseInt(slug[1], 10);
    return n >= 2 && n <= MAX_PAGE ? n : null;
  }
  return null;
}

const TITLE = 'Feed de ocorrências de objetos perdidos e achados'; // o layout já acrescenta «| Backfindr»
const DESCRIPTION = 'Veja as ocorrências mais recentes de objetos, documentos e pets perdidos, achados ou roubados registradas no Backfindr, e compartilhe para ajudar na devolução.';

export function generateMetadata({ params }: { params: { slug?: string[] } }): Metadata {
  const page = pageFromSlug(params.slug) ?? 1;
  return {
    title: TITLE,
    description: DESCRIPTION,
    alternates: { canonical: `${APP_URL}/feed` },
    robots: page === 1 ? { index: true, follow: true } : { index: false, follow: true },
    openGraph: { title: `${TITLE} | Backfindr`, description: DESCRIPTION, url: `${APP_URL}/feed`, type: 'website', locale: 'pt_BR', siteName: 'Backfindr' },
  };
}

export default async function FeedPage({ params }: { params: { slug?: string[] } }) {
  const page = pageFromSlug(params.slug);
  if (page === null) notFound();

  const ranked = await getRankedFeed({}); // visão padrão: sem localização (a reordenação regional acontece no cliente)
  const pg = pageByNumber(ranked.items, page);
  if (page > 1 && pg.items.length === 0) notFound();

  return (
    <main className="min-h-screen bg-[color:var(--f-folha)] text-[color:var(--f-t1)]" style={temaStyle()}>
      {/* Faixa escura do topo (cabeçalho + título + apresentação + atalhos) e, por cima dela, a «folha» clara com a lista */}
      <div className="bg-[color:var(--f-faixa)] pb-9 text-[color:var(--f-faixa-t)]">
      <header className="border-b border-white/10">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
          <Link href="/" className="flex min-h-[44px] items-center gap-2 font-semibold">
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-teal-500"><MapPin className="h-3.5 w-3.5 text-white" aria-hidden /></span>
            Backfindr
          </Link>
          <nav aria-label="Atalhos" className="flex items-center gap-1 text-sm">
            <Link href="/map" className="inline-flex min-h-[44px] items-center px-3 text-white/85 hover:text-white">Mapa</Link>
            <Link href="/buscar" className="inline-flex min-h-[44px] items-center px-3 text-white/85 hover:text-white">Buscar</Link>
            <RegisterMenu variant="header" pagina={page} />
          </nav>
        </div>
      </header>

      <div className="mx-auto max-w-2xl px-4 pt-3">
        <h1 className="text-xl font-bold leading-tight">Feed de ocorrências</h1>

        {/* Chamada curta com os dois atalhos (só na página 1). O texto explicativo longo que ficava aqui agora está no bloco «O Backfindr vai além das publicações» (após o 3º card). */}
        {page === 1 && (
          <section aria-label="Cadastrar ocorrência" className="mt-1">
            <p className="text-sm font-medium leading-snug text-[color:var(--f-faixa-t)]">Perdeu ou encontrou algo?</p>
            <TopoBotoes pagina={page} />
          </section>
        )}
      </div>
      </div>

      <div className="relative -mt-6 rounded-t-[28px] bg-[color:var(--f-folha)] px-4 pb-32 pt-5 shadow-[0_-8px_24px_rgba(15,23,42,0.18)] sm:pb-6">
        <FeedClient initialItems={pg.items} initialNextCursor={pg.nextCursor} initialHasMore={pg.hasMore} page={page} regions={ranked.ufs} />
      </div>

      {/* Balão do assistente (componente global, sem mudar posição nem comportamento): nesta página o fundo é claro e a classe de fundo dele não existe,
          então o ícone branco ficava invisível. Só aqui (a regra some com a página): fundo sólido, anel branco e sombra. */}
      <style dangerouslySetInnerHTML={{ __html: 'button[aria-label="Abrir assistente"]{background-color:#0f766e !important;box-shadow:0 0 0 2px #fff,0 4px 14px rgba(15,23,42,.35) !important}' }} />

      {/* Botão fixo (só celular): canto inferior esquerdo, longe do chat (direito) */}
      <RegisterMenu variant="fixed" pagina={page} />
    </main>
  );
}
