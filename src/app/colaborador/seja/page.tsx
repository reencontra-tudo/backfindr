// /colaborador/seja — inscrição do colaborador. SÓ POR LINK: `noindex`, fora de menu, rodapé e sitemap; só existe com COLABORADORES_ATIVO=1 e COLABORADORES_INSCRICAO=1
// (até a revisão jurídica). Textos de produto: política oficial (seções 1 e 2, literais) + link para o texto completo.
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { inscricaoAtiva } from '@/lib/colaboradores/inscricao';
import { POLITICA_SECOES, POLITICA_VERSAO } from '@/content/politicaColaboradores';
import FormularioInscricao from '@/components/colaboradores/FormularioInscricao';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Seja colaborador', robots: { index: false, follow: false } };

export default function SejaColaboradorPage() {
  if (!inscricaoAtiva()) notFound();
  const [objetivo, recebe] = POLITICA_SECOES;
  return (
    <main className="mx-auto max-w-2xl px-4 pb-16 pt-8">
      <h1 className="text-2xl font-bold text-white">Seja colaborador do Backfindr</h1>
      <section className="mt-5 space-y-2 text-sm leading-relaxed text-white/75" aria-labelledby="objetivo">
        <h2 id="objetivo" className="text-base font-semibold text-white">{objetivo.titulo}</h2>
        {objetivo.blocos.map((b, i) => <p key={i}>{b.texto.replace(/\*\*/g, '')}</p>)}
      </section>
      <section className="mt-5 space-y-2 text-sm leading-relaxed text-white/75" aria-labelledby="recebe">
        <h2 id="recebe" className="text-base font-semibold text-white">{recebe.titulo}</h2>
        {recebe.blocos.filter((b) => b.tipo === 'p').slice(0, 1).map((b, i) => <p key={i}>{b.texto.replace(/\*\*/g, '')}</p>)}
        <ul className="space-y-1">{recebe.blocos.filter((b) => b.tipo === 'li').map((b, i) => <li key={i} className="ml-5 list-disc pl-1">{b.texto.replace(/\*\*/g, '')}</li>)}</ul>
        {recebe.blocos.filter((b) => b.tipo === 'p').slice(1).map((b, i) => <p key={i}>{b.texto.replace(/\*\*/g, '')}</p>)}
      </section>
      <p className="mt-5 text-sm text-white/60">
        Leia a <Link href="/colaborador/politica" className="underline underline-offset-2 hover:text-white" target="_blank">Política do Programa de Colaboradores</Link> completa antes de se inscrever.
      </p>
      <FormularioInscricao politicaVersao={POLITICA_VERSAO} />
    </main>
  );
}
