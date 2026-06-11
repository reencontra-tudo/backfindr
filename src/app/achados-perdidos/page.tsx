import Link from 'next/link'
import type { Metadata } from 'next'
import { query } from '@/lib/db'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Achados e Perdidos no Brasil | Backfindr',
  description: 'Encontre o serviço de achados e perdidos da sua cidade. Cadastre objetos perdidos ou achados e ajude a devolver o que é de cada um.',
  alternates: { canonical: 'https://backfindr.com/achados-perdidos' }
}

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
     WHERE slug IN ('sao-bernardo-do-campo', 'santo-andre', 'osasco', 'guarulhos', 'campinas', 'sao-jose-dos-campos', 'ribeirao-preto', 'sorocaba', 'mogi-das-cruzes', 'santo-andre', 'diadema', 'carapicuiba', 'barueri', 'itaquaquecetuba', 'suzano', 'taboao-da-serra', 'cotia', 'jandira', 'embu-das-artes', 'itapevi', 'francisco-morato', 'franco-da-rocha', 'mairipora', 'santana-de-parnaiba', 'caieiras', 'pirapora-do-bom-jesus')
     ORDER BY population DESC`
  )
  const grandeSP = grandeSPResult.rows

  return (
    <main className="container mx-auto px-4 py-8 max-w-5xl">
      <h1 className="text-3xl font-bold mb-2">Achados e Perdidos no Brasil</h1>
      <p className="text-gray-600 mb-8">Serviço gratuito de achados e perdidos para todos os municípios brasileiros.</p>
      <section className="mb-10">
        <h2 className="text-xl font-semibold mb-4">Capitais</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {capitals.map((city: any) => (
            <Link key={city.slug} href={`/achados-perdidos/${city.slug}`}
              className="p-3 border rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors">
              <div className="font-medium text-sm">{city.name}</div>
              <div className="text-xs text-gray-500">{city.state_code}</div>
            </Link>
          ))}
        </div>
      </section>

      {grandeSP.length > 0 && (
        <section className="mb-10">
          <h2 className="text-xl font-semibold mb-4">Grande São Paulo</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {grandeSP.map((city: any) => (
              <Link key={city.slug} href={`/achados-perdidos/${city.slug}`}
                className="p-3 border rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors">
                <div className="font-medium text-sm">{city.name}</div>
                <div className="text-xs text-gray-500">{city.state_code}</div>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="bg-blue-50 border border-blue-200 rounded-xl p-6 text-center">
        <h2 className="text-lg font-semibold mb-2">Perdeu ou achou algo?</h2>
        <div className="flex gap-3 justify-center mt-4">
          <Link href="/perdi" className="bg-red-500 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-red-600">Perdi algo</Link>
          <Link href="/achei" className="bg-green-500 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-green-600">Achei algo</Link>
        </div>
      </section>
    </main>
  )
}
