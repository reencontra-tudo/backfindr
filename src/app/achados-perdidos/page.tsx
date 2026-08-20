import Link from 'next/link'
import type { Metadata } from 'next'
import { query } from '@/lib/db'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  // Sem "| Backfindr" manual — mesmo bug/causa das páginas de cidade/categoria.
  title: 'Achados e Perdidos no Brasil',
  description: 'Encontre o serviço de achados e perdidos da sua cidade. Cadastre objetos perdidos ou achados e ajude a devolver o que é de cada um.',
  alternates: { canonical: 'https://backfindr.com/achados-perdidos' }
}

const CATEGORIES = [
  { slug: 'celular', label: 'Celular', icon: '📱' },
  { slug: 'pet', label: 'Pet', icon: '🐾' },
  { slug: 'documento', label: 'Documento', icon: '📄' },
  { slug: 'veiculo', label: 'Veículo', icon: '🚗' },
  { slug: 'chave', label: 'Chave', icon: '🔑' },
  { slug: 'bagagem', label: 'Bagagem', icon: '🧳' },
]

export default async function AchadosPerdidosHub() {
  const result = await query(
    `SELECT name, slug, state_code, total_objects_registered 
     FROM municipalities WHERE is_capital = true 
     ORDER BY population DESC`
  )
  const capitals = result.rows

  const grandeSPResult = await query(
    `SELECT name, slug, state_code, total_objects_registered
     FROM municipalities
     WHERE is_capital = false AND state_code = 'SP'
     ORDER BY name ASC`
  )
  const grandeSP = grandeSPResult.rows

  return (
    <main style={{ backgroundColor: '#0B0F14', minHeight: '100vh' }} className="text-white">
      <div className="container mx-auto px-4 py-12 max-w-5xl">

        {/* HERO */}
        <div className="text-center mb-14">
          <div
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-medium mb-6"
            style={{ backgroundColor: '#14B8A61A', color: '#14B8A6', border: '1px solid #14B8A633' }}
          >
            <span>🔍</span>
            <span>Serviço gratuito para todo o Brasil</span>
          </div>

          <h1 className="text-4xl sm:text-5xl font-black mb-4 leading-tight">
            Achados e Perdidos<br />
            <span style={{ color: '#14B8A6' }}>no Brasil</span>
          </h1>

          <p className="text-lg max-w-xl mx-auto mb-8" style={{ color: '#9CA3AF' }}>
            Cadastre objetos perdidos ou achados e ajude a devolver o que é de cada um.
            Rápido, gratuito e com IA.
          </p>

          <div className="flex flex-wrap gap-3 justify-center">
            <Link
              href="/perdi"
              className="px-6 py-3 rounded-xl font-semibold text-white transition-opacity hover:opacity-90"
              style={{ background: 'linear-gradient(135deg, #14B8A6, #0D9488)' }}
            >
              Perdi algo
            </Link>
            <Link
              href="/achei"
              className="px-6 py-3 rounded-xl font-semibold transition-colors"
              style={{ backgroundColor: '#111827', color: '#FFFFFF', border: '1px solid #1f2937' }}
            >
              Achei algo
            </Link>
          </div>
        </div>

        {/* CATEGORIAS */}
        <section className="mb-14">
          <h2 className="text-sm font-semibold uppercase tracking-widest mb-4" style={{ color: '#9CA3AF' }}>
            Buscar por categoria
          </h2>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
            {CATEGORIES.map(cat => (
              <Link
                key={cat.slug}
                href={`/achados-perdidos/sao-paulo/${cat.slug}`}
                className="flex flex-col items-center gap-2 p-4 rounded-xl text-center transition-colors"
                style={{ backgroundColor: '#111827', border: '1px solid #1f2937' }}
              >
                <span className="text-2xl">{cat.icon}</span>
                <span className="text-xs font-medium" style={{ color: '#9CA3AF' }}>{cat.label}</span>
              </Link>
            ))}
          </div>
        </section>

        {/* CAPITAIS */}
        <section className="mb-14">
          <h2 className="text-xl font-bold mb-5">Capitais</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {capitals.map((city: any) => (
              <Link
                key={city.slug}
                href={`/achados-perdidos/${city.slug}`}
                className="p-4 rounded-xl flex items-center justify-between transition-colors"
                style={{ backgroundColor: '#111827', border: '1px solid #1f2937' }}
              >
                <div>
                  <div className="font-semibold text-sm text-white">{city.name}</div>
                  <div className="text-xs mt-0.5" style={{ color: '#9CA3AF' }}>{city.state_code}</div>
                </div>
                <span className="text-xs" style={{ color: '#14B8A6' }}>→</span>
              </Link>
            ))}
          </div>
        </section>

        {/* GRANDE SP */}
        {grandeSP.length > 0 && (
          <section className="mb-14">
            <div className="flex items-center gap-3 mb-5">
              <h2 className="text-xl font-bold">Grande São Paulo</h2>
              <span
                className="px-2 py-0.5 rounded-full text-xs font-medium"
                style={{ backgroundColor: '#14B8A61A', color: '#14B8A6' }}
              >
                {grandeSP.length} municípios
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {grandeSP.map((city: any) => (
                <Link
                  key={city.slug}
                  href={`/achados-perdidos/${city.slug}`}
                  className="p-4 rounded-xl flex items-center justify-between transition-colors"
                  style={{ backgroundColor: '#111827', border: '1px solid #1f2937' }}
                >
                  <div>
                    <div className="font-semibold text-sm text-white">{city.name}</div>
                    <div className="text-xs mt-0.5" style={{ color: '#9CA3AF' }}>SP</div>
                  </div>
                  <span className="text-xs" style={{ color: '#14B8A6' }}>→</span>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* CTA FINAL */}
        <section
          className="rounded-2xl p-8 text-center"
          style={{ background: 'linear-gradient(135deg, #14B8A6, #0D9488)' }}
        >
          <h2 className="text-2xl font-bold text-white mb-2">
            Perdeu ou achou algo?
          </h2>
          <p className="mb-6" style={{ color: 'rgba(255,255,255,0.8)' }}>
            Cada registro aumenta as chances de reencontro. É grátis e leva menos de 2 minutos.
          </p>
          <div className="flex flex-wrap gap-3 justify-center">
            <Link
              href="/perdi"
              className="px-6 py-3 rounded-xl font-semibold transition-colors"
              style={{ backgroundColor: '#FFFFFF', color: '#0D9488' }}
            >
              Perdi algo
            </Link>
            <Link
              href="/achei"
              className="px-6 py-3 rounded-xl font-semibold"
              style={{ backgroundColor: 'rgba(255,255,255,0.15)', color: '#FFFFFF', border: '1px solid rgba(255,255,255,0.3)' }}
            >
              Achei algo
            </Link>
          </div>
        </section>

      </div>
    </main>
  )
}
