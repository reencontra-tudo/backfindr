// /feed — «Ocorrências recentes» (Fase 1). INDEXÁVEL pelo Google; renderizada no servidor.
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
import { IntroButtons, RegisterMenu } from '../FeedCta';
import { APP_URL } from '@/lib/constants';
import { getRankedFeed, pageByNumber } from '@/lib/feed/query';

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

const TITLE = 'Ocorrências recentes de objetos perdidos e achados'; // o layout já acrescenta «| Backfindr»
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
    <main className="min-h-screen bg-[#080b0f] text-white">
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

      <div className="mx-auto max-w-2xl px-4 py-6 pb-32 sm:pb-6">
        <h1 className="text-2xl font-bold leading-tight">Ocorrências recentes</h1>

        {/* Apresentação (só na página 1; no HTML do servidor, igual para todos). NÃO é um segundo h1. */}
        {page === 1 && (
          <section aria-label="Sobre o Backfindr" className="mt-3">
            <p className="text-base font-semibold leading-snug text-white">Perdeu algo? Encontrou alguma coisa?</p>
            <p className="mt-1 text-sm leading-relaxed text-white/80">
              O Backfindr conecta pessoas que perderam e encontraram objetos, documentos, animais e veículos. Cadastre uma ocorrência e descubra possíveis correspondências.
            </p>
            <IntroButtons pagina={page} />
          </section>
        )}

        <p className="mt-3 text-xs leading-relaxed text-white/70">
          Os registros mais recentes de objetos, documentos e pets perdidos, achados ou roubados. É só um recorte recente:{' '}
          <Link href="/map" className="inline-flex min-h-[44px] items-center font-medium underline underline-offset-2 hover:text-white">Ver histórico no mapa</Link>
        </p>

        <div className="mt-2">
          <FeedClient initialItems={pg.items} initialNextCursor={pg.nextCursor} initialHasMore={pg.hasMore} page={page} regions={ranked.ufs} />
        </div>
      </div>

      {/* Botão fixo (só celular): canto inferior esquerdo, longe do chat (direito) */}
      <RegisterMenu variant="fixed" pagina={page} />
    </main>
  );
}
