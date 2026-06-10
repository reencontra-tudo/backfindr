import { notFound } from 'next/navigation'
import Link from 'next/link'
import type { Metadata } from 'next'

export const dynamic = 'force-dynamic'

const SUPA = () => ({
  url: process.env.NEXT_PUBLIC_SUPABASE_URL!,
  headers: {
    apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
    Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY!}`,
  }
})

async function getCity(slug: string) {
  const { url, headers } = SUPA()
  const res = await fetch(`${url}/rest/v1/municipalities?slug=eq.${slug}&select=*&limit=1`, { headers, next: { revalidate: 3600 } })
  const data = await res.json()
  return data?.[0] ?? null
}

async function getPage(municipalityId: number, categorySlug: string) {
  const { url, headers } = SUPA()
  const res = await fetch(`${url}/rest/v1/local_pages?municipality_id=eq.${municipalityId}&category_slug=eq.${categorySlug}&status=eq.published&limit=1`, { headers, next: { revalidate: 3600 } })
  const data = await res.json()
  return data?.[0] ?? null
}

interface Props { params: { cidade: string; categoria: string } }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const city = await getCity(params.cidade)
  if (!city) return {}
  return {
    title: `${params.categoria} Perdido em ${city.name} | Backfindr`,
    description: `Perdeu ou achou um ${params.categoria} em ${city.name}? Cadastre agora no Backfindr gratuitamente.`,
    alternates: { canonical: `https://backfindr.com/achados-perdidos/${params.cidade}/${params.categoria}` }
  }
}

export default async function CidadeCategoria({ params }: Props) {
  const city = await getCity(params.cidade)
  if (!city) notFound()

  const page = await getPage(city.id, params.categoria)
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
          <Link href="/perdi" className="bg-white text-blue-600 px-5 py-2 rounded-lg font-medium hover:bg-blue-50">
            Perdi um {params.categoria}
          </Link>
          <Link href="/achei" className="bg-blue-500 text-white border border-white px-5 py-2 rounded-lg font-medium hover:bg-blue-400">
            Achei um {params.categoria}
          </Link>
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
