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
    // Sem "| Backfindr" aqui — o layout raiz (src/app/layout.tsx) já aplica
    // esse sufixo via `template: '%s | Backfindr'`. Repetir manualmente
    // duplicava no <title> das 434 páginas ("... | Backfindr | Backfindr"),
    // achado na auditoria de SEO de 20/08/2026.
    title: `${cat?.label ?? params.categoria} Perdido em ${city.name}`,
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

  // ── Dados locais reais (item A/B da diversificação de conteúdo,
  // 20/08/2026) — renderizado direto de municipalities, SEM passar por
  // LLM. É a garantia estrutural de especificidade: mesmo que
  // tips_content/intro_text não tenham sido regenerados ainda, esta
  // seção já muda de verdade por cidade, porque a fonte é um SELECT, não
  // prosa. category_breakdown já vem gravado nos slugs de SEO (ver
  // src/app/api/v1/admin/municipalities/refresh-stats/route.ts) — sem
  // mapeamento adicional aqui.
  const breakdown = (city.category_breakdown ?? {}) as Record<string, number>
  const categoryCount = breakdown[params.categoria] ?? 0
  const totalCount = city.total_objects_registered ?? 0
  const topCategorySlug = Object.entries(breakdown).sort(([, a], [, b]) => b - a)[0]?.[0]
  const topCategoryLabel = topCategorySlug ? (CATEGORY_LABELS[topCategorySlug]?.label ?? topCategorySlug) : null
  const landmarks: string[] = Array.isArray(city.main_landmarks) ? city.main_landmarks : []
  const hasLocalData = totalCount > 0 || landmarks.length > 0 || Boolean(city.police_contact)

  // ── Evento aplicável (item C/D, 21/08/2026) — municipality_events já
  // populado pras 63 cidades. Escolhe 1 evento "do momento" (mês atual)
  // quando existe; senão cai pra founding_date, que é fato histórico
  // sempre aplicável, não depende de época do ano.
  const eventsResult = await query(
    `SELECT event_type, name, description, date_text, month, day
     FROM municipality_events WHERE municipality_id = $1 ORDER BY event_type`,
    [city.id]
  )
  const events = eventsResult.rows as Array<{
    event_type: string; name: string; description: string | null
    date_text: string | null; month: number | null; day: number | null
  }>
  const currentMonth = new Date().getMonth() + 1
  const applicableEvent =
    events.find(e => e.month === currentMonth) ??
    events.find(e => e.event_type === 'founding_date') ??
    events[0] ??
    null
  const EVENT_TYPE_LABEL: Record<string, string> = {
    founding_date: 'Fundação',
    municipal_holiday: 'Feriado municipal',
    festival: 'Festa tradicional',
  }

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

        {/* DADOS LOCAIS REAIS — renderizado direto do banco, sem LLM (item D, 21/08/2026) */}
        {hasLocalData && (
          <section
            className="rounded-2xl p-5 mb-8"
            style={{ backgroundColor: '#111827', border: '1px solid #1f2937' }}
          >
            <h2 className="text-sm font-semibold mb-4" style={{ color: '#9CA3AF' }}>
              {city.name} em números
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-1">
              {totalCount > 0 && (
                <div>
                  <p className="text-2xl font-black" style={{ color: '#14B8A6' }}>{totalCount}</p>
                  <p className="text-xs" style={{ color: '#9CA3AF' }}>objetos registrados na região</p>
                </div>
              )}
              {topCategoryLabel && (
                <div>
                  <p className="text-lg font-black leading-snug" style={{ color: '#14B8A6' }}>{topCategoryLabel}</p>
                  <p className="text-xs" style={{ color: '#9CA3AF' }}>categoria mais comum</p>
                </div>
              )}
              {landmarks.length > 0 && (
                <div>
                  <p className="text-sm font-bold leading-snug" style={{ color: '#FFFFFF' }}>{landmarks.join(' · ')}</p>
                  <p className="text-xs" style={{ color: '#9CA3AF' }}>pontos de referência</p>
                </div>
              )}
            </div>

            {applicableEvent && (
              <p className="text-xs mt-4 pt-4" style={{ color: '#9CA3AF', borderTop: '1px solid #1f2937' }}>
                📅 {EVENT_TYPE_LABEL[applicableEvent.event_type] ?? 'Data local'}: {' '}
                <strong style={{ color: '#FFFFFF' }}>{applicableEvent.name}</strong>
                {applicableEvent.date_text ? ` — ${applicableEvent.date_text}` : ''}
              </p>
            )}

            {city.police_contact ? (
              <p className="text-xs mt-4 pt-4" style={{ color: '#9CA3AF', borderTop: '1px solid #1f2937' }}>
                📞 Delegacia de referência: <strong style={{ color: '#FFFFFF' }}>{city.police_contact}</strong>
                {city.police_contact_source_url && (
                  <>
                    {' '}—{' '}
                    <a
                      href={city.police_contact_source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: '#14B8A6' }}
                      className="hover:underline"
                    >
                      fonte oficial
                    </a>
                  </>
                )}
              </p>
            ) : (
              <p className="text-xs mt-4 pt-4" style={{ color: '#9CA3AF', borderTop: '1px solid #1f2937' }}>
                📞 Procure a delegacia mais próxima ou a Polícia Civil de {city.state_name} pra registrar boletim de ocorrência.
              </p>
            )}
          </section>
        )}

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
