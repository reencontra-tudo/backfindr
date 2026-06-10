import { createClient } from '@/lib/supabase/server'
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

interface Props { params: { cidade: string } }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const supabase = createClient()
  const { data: city } = await supabase.from('municipalities').select('name, state_name').eq('slug', params.cidade).single()
  if (!city) return {}
  return {
    title: `Achados e Perdidos em ${city.name} (${city.state_name}) | Backfindr`,
    description: `Serviço gratuito de achados e perdidos em ${city.name}. Recupere objetos perdidos ou devolva o que você achou com ajuda do Backfindr.`,
    alternates: { canonical: `https://backfindr.com/achados-perdidos/${params.cidade}` }
  }
}

export default async function CidadePage({ params }: Props) {
  const supabase = createClient()
  const { data: city } = await supabase.from('municipalities').select('*').eq('slug', params.cidade).single()
  if (!city) notFound()

  const { data: recentObjects } = await supabase
    .from('objects').select('id, name, category, status, created_at')
    .ilike('city', `%${city.name}%`).order('created_at', { ascending: false }).limit(6)

  return (
    <main className="container mx-auto px-4 py-8 max-w-5xl">
      <nav className="text-sm text-gray-500 mb-4">
        <Link href="/achados-perdidos" className="hover:underline">Achados e Perdidos</Link>
        {' › '}<span>{city.name}</span>
      </nav>
      <h1 className="text-3xl font-bold mb-2">Achados e Perdidos em {city.name}</h1>
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
      {recentObjects && recentObjects.length > 0 && (
        <section className="mb-10">
          <h2 className="text-xl font-semibold mb-4">Objetos recentes em {city.name}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {recentObjects.map(obj => (
              <Link key={obj.id} href={`/objeto/${obj.id}`}
                className="p-3 border rounded-lg hover:border-blue-400 transition-colors">
                <div className="font-medium text-sm">{obj.name}</div>
                <div className="text-xs text-gray-500 mt-1">
                  {obj.status === 'lost' ? '🔴 Perdido' : '🟢 Achado'} · {obj.category}
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
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
