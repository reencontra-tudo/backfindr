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
  },
  {
    slug: 'pet',
    label: 'Pet',
    icon: '🐾',
    desc: 'Cão, gato, animal de estimação',
  },
  {
    slug: 'documento',
    label: 'Documento',
    icon: '📄',
    desc: 'RG, CPF, CNH, passaporte',
  },
  {
    slug: 'veiculo',
    label: 'Veículo Roubado',
    icon: '🚗',
    desc: 'Carro, moto, caminhonete',
  },
  {
    slug: 'chave',
    label: 'Chave',
    icon: '🔑',
    desc: 'Casa, carro, trabalho',
  },
  {
    slug: 'bagagem',
    label: 'Bagagem',
    icon: '🧳',
    desc: 'Mala, mochila, bolsa',
  },
  {
    slug: 'geral',
    label: 'Guia Completo',
    icon: '📋',
    desc: 'Todos os canais da cidade',
  },
]

interface Props { params: { cidade: string } }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const result = await query(`SELECT name, state_name FROM municipalities WHERE slug = $1`, [params.cidade])
  const city = result.rows[0]
  if (!city) return {}
  return {
    // Sem "| Backfindr" manual — ver comentário equivalente em
    // achados-perdidos/[cidade]/[categoria]/page.tsx (mesmo bug, mesma causa).
    title: `Achados e Perdidos em ${city.name} (${city.state_name})`,
    description: `Perdeu algo em ${city.name}? Veja os canais de achados e perdidos por categoria: celular, pet, documento, veículo, chave e bagagem. Registre grátis no Backfindr.`,
    alternates: { canonical: `https://backfindr.com/achados-perdidos/${params.cidade}` }
  }
}

export default async function CidadePage({ params }: Props) {
  const result = await query(`SELECT * FROM municipalities WHERE slug = $1`, [params.cidade])
  const city = result.rows[0]
  if (!city) notFound()

  return (
    <main className="min-h-screen" style={{ backgroundColor: '#0B0F14', color: '#FFFFFF' }}>

      {/* HERO — fundo escuro com acento teal */}
      <div style={{ backgroundColor: '#111827', borderBottom: '1px solid #1f2937' }}>
        <div className="container mx-auto px-4 py-10 max-w-5xl">

          {/* Breadcrumb + botão voltar */}
          <nav className="text-base mb-4 flex items-center gap-2 font-medium" style={{ color: '#14B8A6' }}>
            <Link href="/achados-perdidos" className="hover:underline transition-colors" style={{ color: '#14B8A6' }}>
              Achados e Perdidos
            </Link>
            <span style={{ color: '#4B5563' }}>›</span>
            <span style={{ color: '#FFFFFF' }}>{city.name}</span>
          </nav>

          {/* Botão voltar */}
          <div className="mb-6">
            <Link
              href="/achados-perdidos"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all"
              style={{ backgroundColor: '#14B8A615', color: '#14B8A6', border: '1px solid #14B8A630' }}
            >
              ← Todas as cidades
            </Link>
          </div>

          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-8">
            <div className="flex-1">
              {/* Eyebrow */}
              <div className="flex items-center gap-2 mb-3">
                <span
                  className="text-xs font-semibold uppercase tracking-widest px-3 py-1 rounded-full"
                  style={{ backgroundColor: '#14B8A615', color: '#14B8A6', border: '1px solid #14B8A630' }}
                >
                  {city.state_name}
                </span>
                <span className="text-xs" style={{ color: '#9CA3AF' }}>• Guia local gratuito</span>
              </div>

              <h1 className="text-4xl md:text-5xl font-black leading-tight mb-4" style={{ letterSpacing: '-0.02em' }}>
                Perdeu algo em<br />
                <span style={{ color: '#14B8A6' }}>{city.name}</span>?
              </h1>
              <p className="text-lg max-w-lg" style={{ color: '#9CA3AF' }}>
                Canais oficiais, telefones verificados e orientações locais para recuperar o que é seu.
              </p>
            </div>

            {/* Stats cards */}
            <div className="flex gap-3 shrink-0">
              <div
                className="rounded-2xl px-5 py-5 text-center"
                style={{ backgroundColor: '#0B0F14', border: '1px solid #1f2937' }}
              >
                <div className="text-3xl font-black" style={{ color: '#14B8A6' }}>7</div>
                <div className="text-xs mt-1" style={{ color: '#9CA3AF' }}>categorias</div>
              </div>
              <div
                className="rounded-2xl px-5 py-5 text-center"
                style={{ backgroundColor: '#0B0F14', border: '1px solid #1f2937' }}
              >
                <div className="text-3xl font-black" style={{ color: '#14B8A6' }}>100%</div>
                <div className="text-xs mt-1" style={{ color: '#9CA3AF' }}>gratuito</div>
              </div>
            </div>
          </div>

          {/* CTAs */}
          <div className="flex gap-3 mt-8 flex-wrap">
            <Link
              href="/perdi"
              className="font-semibold px-6 py-3 rounded-xl transition-all text-sm"
              style={{ backgroundColor: '#F59E0B', color: '#0B0F14' }}
            >
              🔍 Perdi algo em {city.name}
            </Link>
            <Link
              href="/achei"
              className="font-semibold px-6 py-3 rounded-xl transition-all text-sm"
              style={{ backgroundColor: '#22C55E', color: '#0B0F14' }}
            >
              ✅ Encontrei um objeto
            </Link>
          </div>
        </div>
      </div>

      {/* CATEGORIAS */}
      <div className="container mx-auto px-4 py-10 max-w-5xl">

        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold">O que você perdeu?</h2>
          <span className="text-sm" style={{ color: '#9CA3AF' }}>Escolha a categoria</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {CATEGORIES.map(cat => (
            <Link
              key={cat.slug}
              href={`/achados-perdidos/${params.cidade}/${cat.slug}`}
              className="group rounded-2xl p-4 transition-all duration-200"
              style={{
                backgroundColor: '#111827',
                border: '1px solid #1f2937',
              }}

            >
              {/* Ícone */}
              <div
                className="w-11 h-11 rounded-xl flex items-center justify-center text-xl mb-3"
                style={{ backgroundColor: '#14B8A615', border: '1px solid #14B8A630' }}
              >
                {cat.icon}
              </div>
              <div className="font-semibold text-sm leading-tight mb-1" style={{ color: '#FFFFFF' }}>
                {cat.label}
              </div>
              <div className="text-xs leading-tight" style={{ color: '#9CA3AF' }}>
                {cat.desc}
              </div>
              {/* Seta teal */}
              <div className="mt-3 text-xs font-medium flex items-center gap-1" style={{ color: '#14B8A6' }}>
                Ver guia <span>→</span>
              </div>
            </Link>
          ))}
        </div>

        {/* COMO FUNCIONA */}
        <div
          className="mt-10 rounded-2xl p-6"
          style={{ backgroundColor: '#111827', border: '1px solid #1f2937' }}
        >
          <h3 className="font-bold text-lg mb-6">Como o Backfindr funciona</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {[
              { n: '1', title: 'Cadastre o objeto', desc: 'Descreva o que perdeu, onde e quando. Menos de 1 minuto.' },
              { n: '2', title: 'QR Code gerado', desc: 'Cada cadastro gera um QR Code único para identificação imediata.' },
              { n: '3', title: 'Notificação na hora', desc: 'Quando alguém encontrar e escanear, você é avisado imediatamente.' },
            ].map(step => (
              <div key={step.n} className="flex gap-4 items-start">
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center font-black text-sm shrink-0"
                  style={{ backgroundColor: '#14B8A620', color: '#14B8A6', border: '1px solid #14B8A640' }}
                >
                  {step.n}
                </div>
                <div>
                  <div className="font-semibold text-sm mb-1">{step.title}</div>
                  <div className="text-xs leading-relaxed" style={{ color: '#9CA3AF' }}>{step.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* CTA FINAL */}
        <div
          className="mt-6 rounded-2xl p-7 text-center"
          style={{
            background: 'linear-gradient(135deg, #14B8A6 0%, #0D9488 100%)',
          }}
        >
          <h3 className="text-xl font-bold mb-2" style={{ color: '#0B0F14' }}>
            Registre agora. É gratuito.
          </h3>
          <p className="text-sm mb-6" style={{ color: '#0B0F1499' }}>
            Cada compartilhamento em {city.name} é uma chance a mais de reencontro.
          </p>
          <div className="flex gap-3 justify-center flex-wrap">
            <Link
              href="/perdi"
              className="font-bold px-6 py-3 rounded-xl text-sm transition-all"
              style={{ backgroundColor: '#0B0F14', color: '#14B8A6' }}
            >
              🔍 Perdi algo
            </Link>
            <Link
              href="/achei"
              className="font-semibold px-6 py-3 rounded-xl text-sm transition-all"
              style={{ backgroundColor: '#0B0F1430', color: '#0B0F14', border: '1px solid #0B0F1440' }}
            >
              ✅ Achei algo
            </Link>
          </div>
        </div>

      </div>
    </main>
  )
}
