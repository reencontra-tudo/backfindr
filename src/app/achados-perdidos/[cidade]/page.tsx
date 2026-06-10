import { notFound } from 'next/navigation'
import Link from 'next/link'
import type { Metadata } from 'next'

const CATEGORIES = [
  { slug: 'celular', label: 'Celular', icon: '📱' },
  { slug: 'pet', label: 'Pet', icon: '🐾' },
  { slug: 'documento', label: 'Documento', icon: '📄' },
  { slug: 'veiculo', label: 'Veículo', icon: '🚗' },
  { slug: 'chave', label: 'Chave', icon: '🔑' },
  { slug: 'bagagem', label: 'Bagagem', icon: '🧳' },
]

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

interface Props { params: { cidade: string } }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const city = await getCity(params.cidade)
  if (!city) return {}
  return {
    title: `Achados e Perdidos em ${city.name} (${city.state_name}) | Backfindr`,
    description: `Serviço gratuito de achados e perdidos em ${city.name}. Recupere objetos perdidos ou devolva o que você achou com ajuda do Backfindr.`,
    alternates: { canonical: `https://backfindr.com/achados-perdidos/${params.cidade}` }
  }
}

export default async function CidadePage({ params }: Props) {
  const city = await getCity(params.cidade)
  if (!city) notFound()

  return (
    <main className="container mx-auto px-4 py-8 max-w-5xl">
      <nav className="text-sm text-gray-500 mb-4">
        <Link href="/achados-perdidos" className="hover:underline">Achados e Perdidos</Link>
        {' › '}<span>{city.name}</span>
      </nav>
      <h1 className="text-3xl font-bold mb-6">Achados e Perdidos em {city.name}</h1>
      <section className="mb-10">
        <h2 className="text-xl font-semibold mb-4">Categorias</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {CATEGORIES.map(cat => (
            <Link key={cat.slug} href={`/achados-perdidos/${params.cidade}/${cat.slug}`}
              className="p-4 border rounded-xl flex items-center gap-3 hover:border-blue-500 hover:bg-blue-50 transition-colors">
              <span className="text-2xl">{cat.icon}</span>
              <span className="font-medium">{cat.label}</span>
            </Link>
          ))}
        </div>
      </section>
      <section className="bg-blue-50 border border-blue-200 rounded-xl p-6 text-center">
        <h2 className="text-lg font-semibold mb-2">Perdeu ou achou algo em {city.name}?</h2>
        <div className="flex gap-3 justify-center mt-4">
          <Link href="/perdi" className="bg-red-500 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-red-600">Perdi algo</Link>
          <Link href="/achei" className="bg-green-500 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-green-600">Achei algo</Link>
        </div>
      </section>
    </main>
  )
}
