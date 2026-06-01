export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server'
import { query } from '@/lib/db'
export async function GET() {
  try {
    const result = await query("SELECT valor FROM marketing_config WHERE chave='google_cse_auto' LIMIT 1")
    if (!result.rows.length) return NextResponse.json({pulado:true,motivo:'sem config'})
    const config = JSON.parse(result.rows[0].valor)
    if (!config.automatico) return NextResponse.json({pulado:true,motivo:'modo automático desativado'})
    if (config.ultima_execucao) {
      const horas=(Date.now()-new Date(config.ultima_execucao).getTime())/(1000*60*60)
      if (horas<config.intervalo_horas) return NextResponse.json({pulado:true,motivo:`próxima em ${(config.intervalo_horas-horas).toFixed(1)}h`})
    }
    const appUrl=process.env.NEXT_PUBLIC_APP_URL||'https://backfindr.com'
    const resultados=[]
    for (const keyword of config.keywords) {
      const res=await fetch(`${appUrl}/api/v1/admin/marketing/search/run`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({keyword})})
      resultados.push({keyword,...(await res.json())})
    }
    config.ultima_execucao=new Date().toISOString()
    await query(`UPDATE marketing_config SET valor=$1,updated_at=NOW() WHERE chave='google_cse_auto'`,[JSON.stringify(config)])
    return NextResponse.json({success:true,resultados})
  } catch(error:any){ return NextResponse.json({success:false,error:error.message},{status:500}) }
}
