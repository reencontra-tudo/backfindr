// /colaborador/politica — texto oficial da Política do Programa de Colaboradores. Só por link: `noindex`, fora de menu, rodapé e sitemap, e só existe com a inscrição ligada.
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import PoliticaTexto from '@/components/colaboradores/PoliticaTexto';
import { inscricaoAtiva } from '@/lib/colaboradores/inscricao';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Política do Programa de Colaboradores', robots: { index: false, follow: false } };

export default function PoliticaPage() {
  if (!inscricaoAtiva()) notFound();
  return (
    <main className="mx-auto max-w-2xl px-4 pb-16 pt-8">
      <PoliticaTexto ids />
      <p className="mt-10 text-sm text-white/50">
        <Link href="/colaborador/seja" className="underline underline-offset-2 hover:text-white">Voltar para a inscrição</Link>
      </p>
    </main>
  );
}
