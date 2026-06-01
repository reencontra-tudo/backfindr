export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY!
const GOOGLE_CSE_ID = process.env.GOOGLE_CSE_ID!
const KEYWORDS_RELEVANCIA = ['perdi','perdido','perdida','roubado','roubada','furtado','furtada','sumiu','desapareceu','achei','encontrei','achou','encontrou','procuro','procurando','recompensa','perdemos','perdeu']
function isRelevante(t: string) { return KEYWORDS_RELEVANCIA.some(k => t.toLowerCase().includes(k)) }
function detectarTipoItem(t: string) { const s=t.toLowerCase(); if(s.includes('celular')||s.includes('iphone')||s.includes('samsung'))return 'phone'; if(s.includes('cachorro')||s.includes('gato')||s.includes('pet'))return 'pet'; if(s.includes('bicicleta')||s.includes('bike'))return 'bike'; if(s.includes('carro')||s.includes('moto'))return 'vehicle'; if(s.includes('carteira')||s.includes('documento'))return 'wallet'; if(s.includes('chave'))return 'keys'; return 'geral' }
function calcularScore(t: string) { let s=5; const x=t.toLowerCase(); if(x.includes('recompensa'))s+=2; if(x.includes('são paulo')||x.includes('guarulhos'))s+=1; if(x.includes('hoje')||x.includes('ontem'))s+=1; if(x.includes('urgente'))s+=1; return Math.min(s,10) }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const keyword: string = body.keyword || 'perdi objeto São Paulo'
    const q = encodeURIComponent(`site:facebook.com ${keyword}`)
    const url = `https://www.googleapis.com/customsearch/v1?key=${GOOGLE_API_KEY}&cx=${GOOGLE_CSE_ID}&q=${q}&num=10&lr=lang_pt`
    const googleData = await (await fetch(url)).json()
    if (!googleData.items?.length) return NextResponse.json({ success: true, salvos: 0, duplicados: 0, mensagem: 'Nenhum resultado' })
    let salvos=0,duplicados=0,irrelevantes=0
    for (const item of googleData.items) {
      const texto=item.snippet||item.title||'', link=item.link||''
      if (!isRelevante(texto)){irrelevantes++;continue}
      const ex = await query('SELECT id FROM marketing_leads WHERE link=$1 LIMIT 1',[link])
      if (ex.rows.length){duplicados++;continue}
      const tipo=detectarTipoItem(texto), score=calcularScore(texto)
      await query(`INSERT INTO marketing_leads (rede,keyword,texto,link,usuario,data_post,comentarios,cidade,tipo_item,score,prioridade,status,novo,origem,source_url,resolvido,created_at,updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,NOW(),NOW())`,['facebook',keyword,texto,link,'',new Date().toISOString(),0,'',tipo,score,score>=7?'alta':score>=5?'media':'baixa','novo',true,'google_cse',link,false])
      salvos++
    }
    return NextResponse.json({success:true,salvos,duplicados,irrelevantes,total_google:googleData.items.length,keyword})
  } catch(error:any){ return NextResponse.json({success:false,error:error.message},{status:500}) }
}
