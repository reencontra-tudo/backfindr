import { notFound } from 'next/navigation'
import Link from 'next/link'
import type { Metadata } from 'next'
import { query } from '@/lib/db'

export const dynamic = 'force-dynamic'

const CATEGORIES = [
  {
    slug: 'celular',
    label: 'Celular',
    icon: '📱',
    desc: 'iPhone, Android, tablet',
    color: 'from-blue-500 to-blue-600',
    bg: 'hover:bg-blue-50 hover:border-blue-400',
  },
  {
    slug: 'pet',
    label: 'Pet',
    icon: '🐾',
    desc: 'Cão, gato, animal de estimação',
    color: 'from-orange-400 to-orange-500',
    bg: 'hover:bg-orange-50 hover:border-orange-400',
  },
  {
    slug: 'documento',
    label: 'Documento',
    icon: '📄',
    desc: 'RG, CPF, CNH, passaporte',
    color: 'from-purple-500 to-purple-600',
    bg: 'hover:bg-purple-50 hover:border-purple-400',
  },
  {
    slug: 'veiculo',
    label: 'Veículo Roubado',
    icon: '🚗',
    desc: 'Carro, moto, caminhonete',
    color: 'from-red-500 to-red-600',
    bg: 'hover:bg-red-50 hover:border-red-400',
  },
  {
    slug: 'chave',
    label: 'Chave',
    icon: '🔑',
    desc: 'Casa, carro, trabalho',
    color: 'from-yellow-500 to-yellow-600',
    bg: 'hover:bg-yellow-50 hover:border-yellow-400',
  },
  {
    slug: 'bagagem',
    label: 'Bagagem',
    icon: '🧳',
    desc: 'Mala, mochila, bolsa',
    color: 'from-teal-500 to-teal-600',
    bg: 'hover:bg-teal-50 hover:border-teal-400',
  },
  {
    slug: 'geral',
    label: 'Guia Completo',
    icon: '📋',
    desc: 'Todos os canais da cidade',
    color: 'from-gray-600 to-gray-700',
    bg: 'hover:bg-gray-50 hover:border-gray-400',
  },
]

interface Props { params: { cidade: string } }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const result = await query(`SELECT name, state_name FROM municipalities WHERE slug = $1`, [params.cidade])
  const city = result.rows[0]
  if (!city) return {}
  return {
    title: `Achados e Perdidos em ${city.name} (${city.state_name}) | Backfindr`,
    description: `Perdeu algo em ${city.name}? Veja os canais de achados e perdidos por categoria: celular, pet, documento, veículo, chave e bagagem. Registre grátis no Backfindr.`,
    alternates: { canonical: `https://backfindr.com/achados-perdidos/${params.cidade}` }
  }
}

export default async function CidadePage({ params }: Props) {
  const result = await query(`SELECT * FROM municipalities WHERE slug = $1`, [params.cidade])
  const city = result.rows[0]
  if (!city) notFound()

  // Buscar contagem de páginas publicadas para esta cidade
  const pagesResult = await query(
    `SELECT COUNT(*) as total FROM local_pages WHERE municipality_id = $1 AND status = 'published'`,
    [city.id]
  )
  const totalPages = parseInt(pagesResult.rows[0]?.total || '0')

  return (
    <main className="min-h-screen bg-gray-50">

      {/* HERO */}
      <div className="bg-gradient-to-br from-blue-700 via-blue-600 to-indigo-700 text-white">
        <div className="container mx-auto px-4 py-10 max-w-5xl">
          {/* Breadcrumb */}
          <nav className="text-blue-200 text-sm mb-6 flex items-center gap-1">
            <Link href="/achados-perdidos" className="hover:text-white transition-colors">
              Achados e Perdidos
            </Link>
            <span className="text-blue-400">›</span>
            <span className="text-white font-medium">{city.name}</span>
          </nav>

          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
            <div>
              <p className="text-blue-200 text-sm font-medium uppercase tracking-widest mb-2">
                {city.state_name}
              </p>
              <h1 className="text-4xl md:text-5xl font-extrabold leading-tight mb-3">
                Achados e Perdidos<br />
                em <span className="text-yellow-300">{city.name}</span>
              </h1>
              <p className="text-blue-100 text-lg max-w-xl">
                Guias locais com telefones, endereços e canais oficiais para recuperar o que você perdeu na cidade.
              </p>
            </div>

            {/* Stats */}
            <div className="flex gap-4 shrink-0">
              <div className="bg-white/10 backdrop-blur rounded-2xl px-5 py-4 text-center border border-white/20">
                <div className="text-3xl font-black text-yellow-300">{CATEGORIES.length}</div>
                <div className="text-blue-100 text-xs mt-1">categorias</div>
              </div>
              <div className="bg-white/10 backdrop-blur rounded-2xl px-5 py-4 text-center border border-white/20">
                <div className="text-3xl font-black text-yellow-300">100%</div>
                <div className="text-blue-100 text-xs mt-1">gratuito</div>
              </div>
            </div>
          </div>

          {/* CTA rápido */}
          <div className="flex gap-3 mt-8">
            <Link
              href="/perdi"
              className="bg-red-500 hover:bg-red-400 text-white font-semibold px-6 py-3 rounded-xl transition-all shadow-lg shadow-red-900/30 text-sm"
            >
              🔍 Perdi algo
            </Link>
            <Link
              href="/achei"
              className="bg-green-500 hover:bg-green-400 text-white font-semibold px-6 py-3 rounded-xl transition-all shadow-lg shadow-green-900/30 text-sm"
            >
              ✅ Achei algo
            </Link>
          </div>
        </div>
      </div>

      {/* CATEGORIAS */}
      <div className="container mx-auto px-4 py-10 max-w-5xl">

        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-800">O que você perdeu?</h2>
          <span className="text-sm text-gray-400">{CATEGORIES.length} categorias disponíveis</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {CATEGORIES.map(cat => (
            <Link
              key={cat.slug}
              href={`/achados-perdidos/${params.cidade}/${cat.slug}`}
              className={`group relative bg-white border-2 border-gray-100 rounded-2xl p-4 transition-all duration-200 shadow-sm hover:shadow-md ${cat.bg}`}
            >
              {/* Ícone com fundo colorido */}
              <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${cat.color} flex items-center justify-center text-2xl mb-3 shadow-sm group-hover:scale-110 transition-transform duration-200`}>
                {cat.icon}
              </div>
              <div className="font-semibold text-gray-800 text-sm leading-tight mb-1">
                {cat.label}
              </div>
              <div className="text-xs text-gray-400 leading-tight">
                {cat.desc}
              </div>
              {/* Seta */}
              <div className="absolute top-4 right-4 text-gray-300 group-hover:text-blue-400 transition-colors text-lg">
                →
              </div>
            </Link>
          ))}
        </div>

        {/* BANNER COMO FUNCIONA */}
        <div className="mt-10 bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
          <h3 className="font-bold text-gray-800 mb-4 text-lg">Como o Backfindr funciona</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="flex gap-3 items-start">
              <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-black text-sm shrink-0">1</div>
              <div>
                <div className="font-semibold text-gray-700 text-sm">Cadastre o objeto</div>
                <div className="text-xs text-gray-400 mt-0.5">Descreva o que perdeu e onde. Leva menos de 1 minuto.</div>
              </div>
            </div>
            <div className="flex gap-3 items-start">
              <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-black text-sm shrink-0">2</div>
              <div>
                <div className="font-semibold text-gray-700 text-sm">QR Code gerado</div>
                <div className="text-xs text-gray-400 mt-0.5">Cada cadastro gera um QR Code único para identificação.</div>
              </div>
            </div>
            <div className="flex gap-3 items-start">
              <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-black text-sm shrink-0">3</div>
              <div>
                <div className="font-semibold text-gray-700 text-sm">Notificação imediata</div>
                <div className="text-xs text-gray-400 mt-0.5">Quando alguém encontrar, você é avisado na hora.</div>
              </div>
            </div>
          </div>
        </div>

        {/* CTA FINAL */}
        <div className="mt-6 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-6 text-white text-center shadow-lg">
          <h3 className="text-xl font-bold mb-1">Perdeu algo em {city.name}?</h3>
          <p className="text-blue-100 text-sm mb-5">
            Cadastre agora no Backfindr — gratuito, sem instalar nada.
          </p>
          <div className="flex gap-3 justify-center flex-wrap">
            <Link
              href="/perdi"
              className="bg-white text-blue-600 font-bold px-6 py-2.5 rounded-xl hover:bg-blue-50 transition-colors text-sm shadow"
            >
              🔍 Quero cadastrar o que perdi
            </Link>
            <Link
              href="/achei"
              className="bg-blue-500 text-white border border-white/30 font-semibold px-6 py-2.5 rounded-xl hover:bg-blue-400 transition-colors text-sm"
            >
              ✅ Encontrei um objeto
            </Link>
          </div>
        </div>

      </div>
    </main>
  )
}
