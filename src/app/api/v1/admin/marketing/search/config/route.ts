export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { requireAdmin } from '@/lib/adminGuard'
export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req)
  if (auth instanceof NextResponse) return auth
  try {
    const result = await query("SELECT valor FROM marketing_config WHERE chave='google_cse_auto' LIMIT 1")
    if (!result.rows.length) return NextResponse.json({automatico:false,intervalo_horas:6,keywords:['perdi celular São Paulo','roubaram minha bike SP','perdi cachorro São Paulo'],ultima_execucao:null})
    return NextResponse.json(JSON.parse(result.rows[0].valor))
  } catch(error:any){ return NextResponse.json({success:false,error:error.message},{status:500}) }
}
export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req)
  if (auth instanceof NextResponse) return auth
  try {
    const body = await req.json()
    const config = {automatico:body.automatico??false,intervalo_horas:body.intervalo_horas??6,keywords:body.keywords??[],ultima_execucao:body.ultima_execucao??null}
    await query(`INSERT INTO marketing_config (chave,valor,updated_at) VALUES ('google_cse_auto',$1,NOW()) ON CONFLICT (chave) DO UPDATE SET valor=$1,updated_at=NOW()`,[JSON.stringify(config)])
    return NextResponse.json({success:true,config})
  } catch(error:any){ return NextResponse.json({success:false,error:error.message},{status:500}) }
}
