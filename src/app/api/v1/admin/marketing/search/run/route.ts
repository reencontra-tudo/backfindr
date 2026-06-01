// ARQUIVO: src/app/api/v1/admin/marketing/search/run/route.ts
// Substitui o Apify — busca no Google CSE e salva na marketing_leads

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY!
const GOOGLE_CSE_ID = process.env.GOOGLE_CSE_ID!

// Keywords que indicam intenção de perda/roubo em português
const KEYWORDS_RELEVANCIA = [
  'perdi', 'perdido', 'perdida', 'roubado', 'roubada', 'furtado', 'furtada',
  'sumiu', 'desapareceu', 'achei', 'encontrei', 'achou', 'encontrou',
  'procuro', 'procurando', 'quem achou', 'quem encontrou', 'recompensa',
  'perdemos', 'perdeu', 'stolen', 'lost', 'found'
]

function isRelevante(texto: string): boolean {
  const t = texto.toLowerCase()
  return KEYWORDS_RELEVANCIA.some(k => t.includes(k))
}

function detectarTipoItem(texto: string): string {
  const t = texto.toLowerCase()
  if (t.includes('celular') || t.includes('iphone') || t.includes('samsung') || t.includes('smartphone')) return 'phone'
  if (t.includes('cachorro') || t.includes('gato') || t.includes('pet') || t.includes('animal') || t.includes('cão')) return 'pet'
  if (t.includes('bicicleta') || t.includes('bike') || t.includes('bici')) return 'bike'
  if (t.includes('carro') || t.includes('moto') || t.includes('veículo') || t.includes('veiculo')) return 'vehicle'
  if (t.includes('carteira') || t.includes('documento') || t.includes('rg') || t.includes('cnh')) return 'wallet'
  if (t.includes('chave') || t.includes('chaves')) return 'keys'
  return 'geral'
}

function calcularScore(texto: string): number {
  let score = 5
  const t = texto.toLowerCase()
  if (t.includes('recompensa')) score += 2
  if (t.includes('são paulo') || t.includes('sp') || t.includes('guarulhos') || t.includes('campinas')) score += 1
  if (t.includes('hoje') || t.includes('ontem') || t.includes('agora')) score += 1
  if (t.includes('urgente') || t.includes('preciso muito')) score += 1
  return Math.min(score, 10)
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const keyword: string = body.keyword || 'perdi objeto São Paulo'

    // Buscar no Google CSE restrito ao facebook.com
    const query = encodeURIComponent(`site:facebook.com ${keyword}`)
    const url = `https://www.googleapis.com/customsearch/v1?key=${GOOGLE_API_KEY}&cx=${GOOGLE_CSE_ID}&q=${query}&num=10&lr=lang_pt`

    const googleRes = await fetch(url)
    const googleData = await googleRes.json()

    if (!googleData.items || googleData.items.length === 0) {
      return NextResponse.json({ 
        success: true, 
        salvos: 0, 
        duplicados: 0,
        mensagem: 'Nenhum resultado encontrado para essa keyword' 
      })
    }

    let salvos = 0
    let duplicados = 0
    let irrelevantes = 0

    for (const item of googleData.items) {
      const texto = item.snippet || item.title || ''
      const link = item.link || ''

      // Filtrar irrelevantes
      if (!isRelevante(texto)) {
        irrelevantes++
        continue
      }

      // Deduplicar por link
      const { data: existing } = await supabase
        .from('marketing_leads')
        .select('id')
        .eq('link', link)
        .single()

      if (existing) {
        duplicados++
        continue
      }

      // Salvar lead
      const tipoItem = detectarTipoItem(texto)
      const score = calcularScore(texto)

      await supabase.from('marketing_leads').insert({
        rede: 'facebook',
        keyword: keyword,
        texto: texto,
        link: link,
        usuario: item.pagemap?.metatags?.[0]?.['og:site_name'] || '',
        data_post: new Date().toISOString(),
        comentarios: 0,
        cidade: '',
        tipo_item: tipoItem,
        score: score,
        prioridade: score >= 7 ? 'alta' : score >= 5 ? 'media' : 'baixa',
        status: 'novo',
        novo: true,
        origem: 'google_cse',
        source_url: link,
        resolvido: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })

      salvos++
    }

    return NextResponse.json({ 
      success: true, 
      salvos, 
      duplicados, 
      irrelevantes,
      total_google: googleData.items.length,
      keyword
    })

  } catch (error: any) {
    console.error('Erro Google CSE:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
