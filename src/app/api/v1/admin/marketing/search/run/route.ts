export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/adminGuard'
import { executarBuscaMarketing } from '@/lib/marketingSearch'
export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req)
  if (auth instanceof NextResponse) return auth
  try {
    const body = await req.json()
    const { status, body: out } = await executarBuscaMarketing(body.keyword)
    return NextResponse.json(out, { status })
  } catch(error:any){ return NextResponse.json({success:false,error:error.message},{status:500}) }
}
