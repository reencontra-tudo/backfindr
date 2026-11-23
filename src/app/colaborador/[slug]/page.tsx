// /colaborador/[slug] — destino interno da URL pública `/@nome` (Programa de Colaboradores, etapa E0).
// ETAPA E0 = PROVA TÉCNICA: esta página só mostra que a reescrita do middleware chega até aqui. A página real (topo, botões, feed) é a E2.
// Sem o interruptor `COLABORADORES_ATIVO=1`, responde 404 (igual a hoje). Sem banco, sem dados, sem texto promocional.
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { colaboradoresAtivo, slugValido } from '@/lib/colaboradores/rota';

// Mesmo regime do Feed: renderização estática incremental, nada gerado no build, cada página nasce no 1º acesso.
export const revalidate = 300;
export const dynamicParams = true;
export function generateStaticParams() { return []; }

export function generateMetadata(): Metadata {
  // Nunca indexável nesta etapa (e nunca enquanto o colaborador não estiver verificado: regra do fundador, PC-03).
  return { title: 'Colaborador', robots: { index: false, follow: false } };
}

export default function ColaboradorPage({ params }: { params: { slug: string } }) {
  if (!colaboradoresAtivo() || !slugValido(params.slug)) notFound();
  return (
    <main className="mx-auto max-w-2xl px-4 py-10" data-colaborador-prova="e0">
      <p className="text-sm text-white/60">Prova técnica da rota (etapa E0).</p>
      <h1 className="text-xl font-bold">@{params.slug}</h1>
    </main>
  );
}
