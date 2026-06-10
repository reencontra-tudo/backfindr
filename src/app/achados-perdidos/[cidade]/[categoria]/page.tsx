import { notFound } from 'next/navigation'
import Link from 'next/link'
import type { Metadata } from 'next'
import { query } from '@/lib/db'

export const dynamic = 'force-dynamic'

interface Props { params: { cidade: string; categoria: string } }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const result = await query(`SELECT name, state_name FROM municipalities WHERE slug = $1`, [params.cidade])
  const city = result.rows[0]
  if (!city) return {}
  return {
    title: `${params.categoria} Perdido em ${city.name} | Backfindr`,
    description: `Perdeu ou achou um ${params.categoria} em ${city.name}? Cadastre agora no Backfindr gratuitamente.`,
    alternates: { canonical: `https://backfindr.com/achados-perdidos/${params.cidade}/${params.categoria}` }
  }
}

export default async function CidadeCategoria({ params }: Props) {
  const cityResult = await query(`SELECT * FROM municipalities WHERE slug = $1`, [params.cidade])
  const city = cityResult.rows[0]
  if (!city) notFound()

  const pageResult = await query(
    `SELECT * FROM local_pages WHERE municipality_id = $1 AND category_slug = $2 AND status = 'published' LIMIT 1`,
    [city.id, params.categoria]
  )
  const page = pageResult.rows[0] ?? null
  const faq = page?.faq_content ?? []

  return (
    <main className="container mx-auto px-4 py-8 max-w-3xl">
      <nav className="text-sm text-gray-500 mb-4">
        <Link href="/achados-perdidos" className="hover:underline">Achados e Perdidos</Link>
        {' › '}
        <Link href={`/achados-perdidos/${params.cidade}`} className="hover:underline">{city.name}</Link>
        {' › '}
        <span className="capitalize">{params.categoria}</span>
      </nav>

      <h1 className="text-3xl font-bold mb-3">
        {page?.hero_headline ?? `${params.categoria} Perdido em ${city.name}`}
      </h1>

      {page?.intro_text && (
        <div className="text-gray-600 leading-relaxed mb-8"
          dangerouslySetInnerHTML={{ __html: page.intro_text }} />
      )}

      <div className="bg-blue-600 text-white rounded-xl p-6 mb-8 text-center">
        <p className="text-lg font-semibold mb-3">
          {page?.cta_text ?? `Perdeu ou achou um ${params.categoria} em ${city.name}?`}
        </p>
        <div className="flex gap-3 justify-center">
          {params.categoria === 'veiculo' ? (
            <>
              <Link href="/roubado" className="bg-white text-blue-600 px-5 py-2 rounded-lg font-medium hover:bg-blue-50">
                Registrar veículo roubado
              </Link>
              <Link href="/achei" className="bg-blue-500 text-white border border-white px-5 py-2 rounded-lg font-medium hover:bg-blue-400">
                Encontrei um veículo
              </Link>
            </>
          ) : (
            <>
              <Link href="/perdi" className="bg-white text-blue-600 px-5 py-2 rounded-lg font-medium hover:bg-blue-50">
                Perdi um {params.categoria}
              </Link>
              <Link href="/achei" className="bg-blue-500 text-white border border-white px-5 py-2 rounded-lg font-medium hover:bg-blue-400">
                Achei um {params.categoria}
              </Link>
            </>
          )}
        </div>
      </div>

      {page?.tips_content && (
        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-3">O que fazer em {city.name}</h2>
          <div className="prose prose-sm max-w-none text-gray-700"
            dangerouslySetInnerHTML={{ __html: page.tips_content }} />
        </section>
      )}

      {faq.length > 0 && (
        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-4">Perguntas frequentes</h2>
          <div className="space-y-4">
            {faq.map((item: any, i: number) => (
              <details key={i} className="border rounded-lg p-4">
                <summary className="font-medium cursor-pointer">{item.question}</summary>
                <p className="text-gray-600 mt-2 text-sm leading-relaxed">{item.answer}</p>
              </details>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="text-lg font-semibold mb-3">Outras categorias em {city.name}</h2>
        <div className="flex flex-wrap gap-2">
          {['celular','pet','documento','veiculo','chave','bagagem']
            .filter(c => c !== params.categoria)
            .map(cat => (
              <Link key={cat} href={`/achados-perdidos/${params.cidade}/${cat}`}
                className="px-3 py-1 border rounded-full text-sm hover:border-blue-500 hover:text-blue-600 capitalize">
                {cat}
              </Link>
            ))}
        </div>
      </section>
    </main>
  )
}
