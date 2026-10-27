export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { requireAdmin } from '@/lib/adminGuard'
import { hasValidCronSecret } from '@/lib/cronAuth'
import { executarBuscaMarketing } from '@/lib/marketingSearch'
export async function GET(req: NextRequest) {
  // Admin logado OU agendador com `Authorization: Bearer <CRON_SECRET>` (nunca na URL).
  if (!hasValidCronSecret(req)) {
    const auth = await requireAdmin(req)
    if (auth instanceof NextResponse) return auth
  }
  try {
    const result = await query("SELECT valor FROM marketing_config WHERE chave='google_cse_auto' LIMIT 1")
    if (!result.rows.length) return NextResponse.json({pulado:true,motivo:'sem config'})
    const config = JSON.parse(result.rows[0].valor)
    if (!config.automatico) return NextResponse.json({pulado:true,motivo:'modo automático desativado'})
    if (config.ultima_execucao) {
      const horas=(Date.now()-new Date(config.ultima_execucao).getTime())/(1000*60*60)
      if (horas<config.intervalo_horas) return NextResponse.json({pulado:true,motivo:`próxima em ${(config.intervalo_horas-horas).toFixed(1)}h`})
    }
    const resultados=[]
    for (const keyword of config.keywords) {
      const res=await executarBuscaMarketing(keyword)
      resultados.push({keyword,...res.body})
    }
    config.ultima_execucao=new Date().toISOString()
    await query(`UPDATE marketing_config SET valor=$1,updated_at=NOW() WHERE chave='google_cse_auto'`,[JSON.stringify(config)])
    return NextResponse.json({success:true,resultados})
  } catch(error:any){ return NextResponse.json({success:false,error:error.message},{status:500}) }
}
