import { notFound } from 'next/navigation'
import Link from 'next/link'
import type { Metadata } from 'next'
import { query } from '@/lib/db'

export const dynamic = 'force-dynamic'

const CATEGORIES = [
  { slug: 'celular', label: 'Celular', icon: '📱' },
  { slug: 'pet', label: 'Pet', icon: '🐾' },
  { slug: 'documento', label: 'Documento', icon: '📄' },
  { slug: 'veiculo', label: 'Veículo', icon: '🚗' },
  { slug: 'chave', label: 'Chave', icon: '🔑' },
  { slug: 'bagagem', label: 'Bagagem', icon: '🧳' },
]

interface Props { params: { cidade: string } }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const result = await query(`SELECT name, state_name FROM municipalities WHERE slug = $1`, [params.cidade])
  const city = result.rows[0]
  if (!city) return {}
  return {
    title: `Achados e Perdidos em ${city.name} (${city.state_name}) | Backfindr`,
    description: `Serviço gratuito de achados e perdidos em ${city.name}.`,
    alternates: { canonical: `https://backfindr.com/achados-perdidos/${params.cidade}` }
  }
}

export default async function CidadePage({ params }: Props) {
  const result = await query(`SELECT * FROM municipalities WHERE slug = $1`, [params.cidade])
  const city = result.rows[0]
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
