import { query } from '@/lib/db'
const SERPAPI_KEY = process.env.SERPAPI_KEY!
const KEYWORDS_RELEVANCIA = ['perdi','perdido','perdida','roubado','roubada','furtado','furtada','sumiu','desapareceu','achei','encontrei','achou','encontrou','procuro','procurando','recompensa','perdemos','perdeu']
function isRelevante(t: string) { return KEYWORDS_RELEVANCIA.some(k => t.toLowerCase().includes(k)) }
function detectarTipoItem(t: string) { const s=t.toLowerCase(); if(s.includes('celular')||s.includes('iphone')||s.includes('samsung'))return 'phone'; if(s.includes('cachorro')||s.includes('gato')||s.includes('pet'))return 'pet'; if(s.includes('bicicleta')||s.includes('bike'))return 'bike'; if(s.includes('carro')||s.includes('moto'))return 'vehicle'; if(s.includes('carteira')||s.includes('documento'))return 'wallet'; if(s.includes('chave'))return 'keys'; return 'geral' }
function calcularScore(t: string) { let s=5; const x=t.toLowerCase(); if(x.includes('recompensa'))s+=2; if(x.includes('são paulo')||x.includes('guarulhos'))s+=1; if(x.includes('hoje')||x.includes('ontem'))s+=1; if(x.includes('urgente'))s+=1; return Math.min(s,10) }

/** Busca no SerpAPI e grava leads; mesma lógica que estava em search/run, agora compartilhada com search/cron
 *  (o cron deixa de chamar a rota por HTTP, que agora exige admin). Devolve o corpo e o status HTTP. */
export async function executarBuscaMarketing(keywordEntrada?: string): Promise<{ status: number; body: any }> {
  try {
    const keyword: string = keywordEntrada || 'perdi objeto São Paulo'
    const q = encodeURIComponent(`site:facebook.com ${keyword}`)
    const url = `https://serpapi.com/search?engine=google&q=${q}&api_key=${SERPAPI_KEY}&num=10&hl=pt&gl=br`
    const data = await (await fetch(url)).json()
    if (data.error) return { status: 500, body: {success:false,error:data.error} }
    const items = data.organic_results || []
    if (!items.length) return { status: 200, body: {success:true,salvos:0,duplicados:0,mensagem:'Nenhum resultado'} }
    let salvos=0,duplicados=0,irrelevantes=0
    for (const item of items) {
      const texto=item.snippet||item.title||'', link=item.link||''
      if (!isRelevante(texto)){irrelevantes++;continue}
      const ex = await query('SELECT id FROM marketing_leads WHERE link=$1 LIMIT 1',[link])
      if (ex.rows.length){duplicados++;continue}
      const tipo=detectarTipoItem(texto), score=calcularScore(texto)
      await query(`INSERT INTO marketing_leads (rede,keyword,texto,link,usuario,data_post,comentarios,cidade,tipo_item,score,prioridade,status,origem,source_url,resolvido,arquivado,ciclo,created_at,updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,false,(SELECT COALESCE(MAX(ciclo),1) FROM marketing_leads),NOW(),NOW())`,['facebook',keyword,texto,link,'',new Date().toISOString(),0,'',tipo,score,score>=7?'alta':score>=5?'media':'baixa','novo','serpapi',link,false])
      salvos++
    }
    return { status: 200, body: {success:true,salvos,duplicados,irrelevantes,total:items.length,keyword} }
  } catch(error:any){ return { status: 500, body: {success:false,error:error.message} } }
}
