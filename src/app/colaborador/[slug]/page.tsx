// /colaborador/[slug] — destino interno da URL pública `/@nome` (Programa de Colaboradores, E2). Renderizada no servidor, estática com revalidação de 5 min
// (como o Feed). Sem COLABORADORES_ATIVO=1 responde 404 ANTES de qualquer consulta ao banco, como se a rota não existisse.
//
// Estados: ativo = página; suspenso ou saiu = 307 para o Feed (PC-13: o colaborador pode voltar); excluído = 308 para o Feed; nunca existiu = 404.
// Indexação (PC-03): só ativa + verificada + com ao menos uma ocorrência cadastrada com o código; qualquer outra: noindex (e fora do sitemap).
// Canônica sempre `/@nome` (o acesso direto a /colaborador/<nome> mostra o mesmo conteúdo, com a canônica apontando para a URL pública).
import { cache } from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, permanentRedirect, redirect } from 'next/navigation';
import RegistroDeVisita from '@/components/colaboradores/RegistroDeVisita';
import { visitasAtivas } from '@/lib/colaboradores/visitas';
import { query } from '@/lib/db';
import { APP_URL } from '@/lib/constants';
import { colaboradoresAtivo, slugValido } from '@/lib/colaboradores/rota';
import { carregarColaborador, caminhoPagina, linksDeCadastro, paginaIndexavel, type ColaboradorPagina, type ResultadoPagina } from '@/lib/colaboradores/pagina';
import { feedDoColaborador, type FeedDoColaborador } from '@/lib/colaboradores/feed';
import CartaoOcorrencia from '@/components/colaboradores/CartaoOcorrencia';

export const revalidate = 300;
export const dynamicParams = true;
export function generateStaticParams() { return []; }

interface Dados { resultado: ResultadoPagina; feed: FeedDoColaborador | null }

// Uma só leitura por renderização (generateMetadata e a página usam a mesma).
const obterDados = cache(async (slug: string): Promise<Dados> => {
  if (!colaboradoresAtivo() || !slugValido(slug)) return { resultado: { tipo: 'nao-existe' }, feed: null };
  const resultado = await carregarColaborador(query, slug);
  if (resultado.tipo !== 'pagina') return { resultado, feed: null };
  const c = resultado.colaborador;
  const feed = await feedDoColaborador(query, c.id, { lat: c.regiaoLat, lng: c.regiaoLng, raioKm: c.raioKm });
  return { resultado, feed };
});

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const { resultado, feed } = await obterDados(params.slug);
  if (resultado.tipo !== 'pagina') return { title: 'Página não encontrada', robots: { index: false, follow: false } };
  const c = resultado.colaborador;
  const indexar = paginaIndexavel(c, feed?.comCodigo ?? 0);
  const titulo = `${c.nome} — ocorrências de perdidos e achados`;
  const descricao = (c.descricao ?? `Veja as ocorrências de objetos, documentos e pets perdidos, achados ou roubados registradas por ${c.nome} no Backfindr.`).slice(0, 200);
  const url = `${APP_URL}${caminhoPagina(c.slug)}`;
  return {
    title: titulo,
    description: descricao,
    alternates: { canonical: url },
    robots: indexar ? { index: true, follow: true } : { index: false, follow: true },
    openGraph: { title: `${titulo} | Backfindr`, description: descricao, url, type: 'website', locale: 'pt_BR', siteName: 'Backfindr', ...(c.imagemUrl ? { images: [c.imagemUrl] } : {}) },
  };
}

function Topo({ c }: { c: ColaboradorPagina }) {
  return (
    <header className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
      <div className="flex items-start gap-4">
        {c.imagemUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={c.imagemUrl} alt="" width={64} height={64} referrerPolicy="no-referrer" className="h-16 w-16 flex-shrink-0 rounded-2xl object-cover" />
        ) : (
          <span aria-hidden="true" className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-2xl bg-teal-500/20 text-2xl font-bold text-teal-200">{c.nome.slice(0, 1).toUpperCase()}</span>
        )}
        <div className="min-w-0">
          <h1 className="break-words text-xl font-bold leading-tight text-white">{c.nome}</h1>
          <p className="mt-0.5 text-xs text-white/40">por Backfindr</p>
        </div>
      </div>
      {c.descricao && <p className="mt-4 whitespace-pre-line break-words text-sm leading-relaxed text-white/70">{c.descricao}</p>}
      {c.canalUrl && (
        <a href={c.canalUrl} target="_blank" rel="nofollow noopener noreferrer"
          className="mt-4 flex min-h-[44px] items-center justify-center rounded-xl border border-teal-400/40 bg-teal-500/10 px-4 text-sm font-semibold text-teal-200 hover:bg-teal-500/20">
          Voltar ao grupo ou perfil de {c.nome}
        </a>
      )}
    </header>
  );
}

export default async function ColaboradorPage({ params }: { params: { slug: string } }) {
  const { resultado, feed } = await obterDados(params.slug);
  if (resultado.tipo === 'nao-existe') notFound();
  if (resultado.tipo === 'redirecionar') { if (resultado.permanente) permanentRedirect('/feed'); else redirect('/feed'); }
  if (resultado.tipo !== 'pagina') notFound();
  const c = resultado.colaborador;
  const links = linksDeCadastro(c.codigoCurto);
  const itens = feed?.itens ?? [];
  const comCodigo = feed?.comCodigo ?? 0;
  const delaRegiao = itens.slice(comCodigo);
  return (
    <main className="mx-auto max-w-2xl px-4 pb-16 pt-6" data-colaborador-pagina>
      {visitasAtivas() && <RegistroDeVisita slug={c.slug} />}
      <Topo c={c} />

      <section aria-labelledby="registrar" className="mt-6">
        <h2 id="registrar" className="text-base font-semibold text-white">Registrar uma ocorrência</h2>
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
          <Link href={links.perdi} className="flex min-h-[48px] items-center justify-center rounded-xl bg-teal-500 px-4 font-semibold text-black hover:bg-teal-400">Perdi algo</Link>
          <Link href={links.achei} className="flex min-h-[48px] items-center justify-center rounded-xl bg-white/10 px-4 font-semibold text-white hover:bg-white/15">Encontrei algo</Link>
          <Link href={links.roubado} className="flex min-h-[48px] items-center justify-center rounded-xl bg-white/10 px-4 font-semibold text-white hover:bg-white/15">Roubaram algo meu</Link>
        </div>
      </section>

      <section aria-labelledby="ocorrencias" className="mt-8">
        <h2 id="ocorrencias" className="text-base font-semibold text-white">Ocorrências registradas por esta página</h2>
        {comCodigo === 0 ? (
          <p className="mt-3 rounded-2xl border border-white/10 p-4 text-sm text-white/60">Ainda não há ocorrências registradas por aqui.</p>
        ) : (
          <ul className="mt-3 space-y-3">{itens.slice(0, comCodigo).map((it, i) => <CartaoOcorrencia key={it.code} item={it} prioridade={i < 2} />)}</ul>
        )}
      </section>

      {delaRegiao.length > 0 && (
        <section aria-labelledby="regiao" className="mt-8">
          <h2 id="regiao" className="text-base font-semibold text-white">Ocorrências na região{c.regiaoCidade ? ` de ${c.regiaoCidade}` : ''}</h2>
          <ul className="mt-3 space-y-3">{delaRegiao.map((it) => <CartaoOcorrencia key={it.code} item={it} prioridade={false} />)}</ul>
        </section>
      )}

      <p className="mt-10 text-center text-sm text-white/50">
        <Link href="/feed" className="underline underline-offset-2 hover:text-white">Ver o Feed de ocorrências</Link>
        <span className="mx-2" aria-hidden="true">·</span>
        <Link href="/" className="underline underline-offset-2 hover:text-white">Backfindr</Link>
      </p>
    </main>
  );
}
