import { notFound } from 'next/navigation'
import Link from 'next/link'
import type { Metadata } from 'next'
import { query } from '@/lib/db'

export const dynamic = 'force-dynamic'

const CATEGORY_LABELS: Record<string, { label: string; icon: string }> = {
  celular:   { label: 'Celular',         icon: '📱' },
  pet:       { label: 'Pet',             icon: '🐾' },
  documento: { label: 'Documento',       icon: '📄' },
  veiculo:   { label: 'Veículo Roubado', icon: '🚗' },
  chave:     { label: 'Chave',           icon: '🔑' },
  bagagem:   { label: 'Bagagem',         icon: '🧳' },
  geral:     { label: 'Guia Completo',   icon: '📋' },
}

interface Props { params: { cidade: string; categoria: string } }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const result = await query(`SELECT name, state_name FROM municipalities WHERE slug = $1`, [params.cidade])
  const city = result.rows[0]
  if (!city) return {}
  const cat = CATEGORY_LABELS[params.categoria]
  return {
    title: `${cat?.label ?? params.categoria} Perdido em ${city.name} | Backfindr`,
    description: `Perdeu ${cat?.label ?? params.categoria} em ${city.name}? Veja canais oficiais, telefones e orientações locais. Registre grátis no Backfindr.`,
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
  const cat = CATEGORY_LABELS[params.categoria] ?? { label: params.categoria, icon: '📦' }

  const isVeiculo = params.categoria === 'veiculo'
  const isGeral   = params.categoria === 'geral'

  const sectionTitle =
    isVeiculo  ? `O que fazer se seu veículo foi roubado ou furtado em ${city.name}` :
    params.categoria === 'pet'       ? `O que fazer quando seu pet desaparece em ${city.name}` :
    params.categoria === 'celular'   ? `O que fazer quando perde o celular em ${city.name}` :
    params.categoria === 'documento' ? `O que fazer quando perde um documento em ${city.name}` :
    params.categoria === 'chave'     ? `O que fazer quando perde uma chave em ${city.name}` :
    params.categoria === 'bagagem'   ? `O que fazer quando perde bagagem em ${city.name}` :
    `Canais de achados e perdidos em ${city.name}`

  return (
    <main className="min-h-screen" style={{ backgroundColor: '#0B0F14', color: '#FFFFFF' }}>

      {/* HERO */}
      <div style={{ backgroundColor: '#111827', borderBottom: '1px solid #1f2937' }}>
        <div className="container mx-auto px-4 py-10 max-w-3xl">

          {/* Breadcrumb + botão voltar */}
          <nav className="text-base mb-4 flex items-center gap-2 flex-wrap font-medium" style={{ color: '#14B8A6' }}>
            <Link href="/achados-perdidos" className="hover:underline" style={{ color: '#14B8A6' }}>
              Achados e Perdidos
            </Link>
            <span style={{ color: '#4B5563' }}>›</span>
            <Link href={`/achados-perdidos/${params.cidade}`} className="hover:underline" style={{ color: '#14B8A6' }}>
              {city.name}
            </Link>
            <span style={{ color: '#4B5563' }}>›</span>
            <span style={{ color: '#FFFFFF' }}>{cat.label}</span>
          </nav>

          {/* Botão voltar */}
          <div className="mb-6">
            <Link
              href={`/achados-perdidos/${params.cidade}`}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all"
              style={{ backgroundColor: '#14B8A615', color: '#14B8A6', border: '1px solid #14B8A630' }}
            >
              ← Voltar para {city.name}
            </Link>
          </div>

          <div className="flex items-start gap-4 mb-4">
            {/* Ícone da categoria */}
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl shrink-0"
              style={{ backgroundColor: '#14B8A615', border: '1px solid #14B8A630' }}
            >
              {cat.icon}
            </div>
            <div>
              <p className="text-sm font-medium mb-1" style={{ color: '#14B8A6' }}>
                {city.name} · {city.state_name}
              </p>
              <h1 className="text-3xl md:text-4xl font-black leading-tight" style={{ letterSpacing: '-0.02em' }}>
                {page?.hero_headline ?? `${cat.label} Perdido em ${city.name}`}
              </h1>
            </div>
          </div>

          {page?.intro_text && (
            <div
              className="text-base leading-relaxed mt-4"
              style={{ color: '#9CA3AF' }}
              dangerouslySetInnerHTML={{ __html: page.intro_text }}
            />
          )}
        </div>
      </div>

      {/* CONTEÚDO */}
      <div className="container mx-auto px-4 py-8 max-w-3xl">

        {/* CTA PRINCIPAL */}
        <div
          className="rounded-2xl p-6 mb-8 text-center"
          style={{ background: 'linear-gradient(135deg, #14B8A6 0%, #0D9488 100%)' }}
        >
          <p className="font-bold text-lg mb-4" style={{ color: '#0B0F14' }}>
            {page?.cta_text ?? (isGeral
              ? `Perdeu ou achou algo em ${city.name}?`
              : `Perdeu ou achou ${isVeiculo ? 'um veículo' : `um ${cat.label.toLowerCase()}`} em ${city.name}?`
            )}
          </p>
          <div className="flex gap-3 justify-center flex-wrap">
            {isVeiculo ? (
              <>
                <Link href="/roubado"
                  className="font-bold px-5 py-2.5 rounded-xl text-sm transition-all"
                  style={{ backgroundColor: '#0B0F14', color: '#14B8A6' }}>
                  🚨 Meu veículo foi roubado
                </Link>
                <Link href="/achei"
                  className="font-semibold px-5 py-2.5 rounded-xl text-sm"
                  style={{ backgroundColor: '#0B0F1430', color: '#0B0F14', border: '1px solid #0B0F1440' }}>
                  ✅ Encontrei um veículo
                </Link>
              </>
            ) : (
              <>
                <Link href="/perdi"
                  className="font-bold px-5 py-2.5 rounded-xl text-sm transition-all"
                  style={{ backgroundColor: '#0B0F14', color: '#14B8A6' }}>
                  🔍 {isGeral ? 'Perdi algo' : `Perdi um ${cat.label.toLowerCase()}`}
                </Link>
                <Link href="/achei"
                  className="font-semibold px-5 py-2.5 rounded-xl text-sm"
                  style={{ backgroundColor: '#0B0F1430', color: '#0B0F14', border: '1px solid #0B0F1440' }}>
                  ✅ {isGeral ? 'Achei algo' : `Achei um ${cat.label.toLowerCase()}`}
                </Link>
              </>
            )}
          </div>
        </div>

        {/* GUIA LOCAL */}
        {page?.tips_content && (
          <section className="mb-8">
            <h2 className="text-xl font-bold mb-4" style={{ color: '#14B8A6' }}>
              {sectionTitle}
            </h2>
            <div
              className="leading-relaxed space-y-4"
              style={{ color: '#D1D5DB' }}
            >
              <style>{`
                .tips-content h3 {
                  font-size: 1.1rem;
                  font-weight: 700;
                  color: #FFFFFF;
                  margin-top: 1.5rem;
                  margin-bottom: 0.5rem;
                  padding-bottom: 0.5rem;
                  border-bottom: 1px solid #1f2937;
                }
                .tips-content p {
                  color: #D1D5DB;
                  margin-bottom: 0.75rem;
                  line-height: 1.7;
                }
                .tips-content strong {
                  color: #FFFFFF;
                }
                .tips-content a {
                  color: #14B8A6;
                  text-decoration: underline;
                }
                .tips-content a:hover {
                  color: #0D9488;
                }
              `}</style>
              <div
                className="tips-content"
                dangerouslySetInnerHTML={{ __html: page.tips_content }}
              />
            </div>
          </section>
        )}

        {/* FAQ */}
        {faq.length > 0 && (
          <section className="mb-8">
            <h2 className="text-xl font-bold mb-4">Perguntas frequentes</h2>
            <div className="space-y-3">
              {faq.map((item: any, i: number) => (
                <details
                  key={i}
                  className="rounded-xl p-4 group"
                  style={{ backgroundColor: '#111827', border: '1px solid #1f2937' }}
                >
                  <summary
                    className="font-semibold cursor-pointer text-sm leading-snug"
                    style={{ color: '#FFFFFF' }}
                  >
                    {item.question}
                  </summary>
                  <p className="mt-3 text-sm leading-relaxed" style={{ color: '#9CA3AF' }}>
                    {item.answer}
                  </p>
                </details>
              ))}
            </div>
          </section>
        )}

        {/* OUTRAS CATEGORIAS */}
        <section
          className="rounded-2xl p-5"
          style={{ backgroundColor: '#111827', border: '1px solid #1f2937' }}
        >
          <h2 className="text-sm font-semibold mb-3" style={{ color: '#9CA3AF' }}>
            Outras categorias em {city.name}
          </h2>
          <div className="flex flex-wrap gap-2">
            {Object.entries(CATEGORY_LABELS)
              .filter(([slug]) => slug !== params.categoria)
              .map(([slug, info]) => (
                <Link
                  key={slug}
                  href={`/achados-perdidos/${params.cidade}/${slug}`}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors"
                  style={{
                    backgroundColor: '#0B0F14',
                    border: '1px solid #1f2937',
                    color: '#9CA3AF',
                  }}
                >
                  <span>{info.icon}</span>
                  <span>{info.label}</span>
                </Link>
              ))}
          </div>
        </section>

      </div>
    </main>
  )
}
