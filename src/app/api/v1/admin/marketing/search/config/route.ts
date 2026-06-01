// ARQUIVO: src/app/api/v1/admin/marketing/search/config/route.ts
// Salva e lê configuração do modo automático

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// GET — lê configuração atual
export async function GET() {
  const { data, error } = await supabase
    .from('marketing_config')
    .select('*')
    .eq('chave', 'google_cse_auto')
    .single()

  if (error || !data) {
    // Retorna padrão se não existir ainda
    return NextResponse.json({
      automatico: false,
      intervalo_horas: 6,
      keywords: ['perdi celular São Paulo', 'roubaram minha bike SP', 'perdi cachorro São Paulo'],
      ultima_execucao: null
    })
  }

  return NextResponse.json(JSON.parse(data.valor))
}

// POST — salva configuração
export async function POST(req: NextRequest) {
  const body = await req.json()

  const config = {
    automatico: body.automatico ?? false,
    intervalo_horas: body.intervalo_horas ?? 6,
    keywords: body.keywords ?? [],
    ultima_execucao: body.ultima_execucao ?? null
  }

  const { error } = await supabase
    .from('marketing_config')
    .upsert({
      chave: 'google_cse_auto',
      valor: JSON.stringify(config),
      updated_at: new Date().toISOString()
    }, { onConflict: 'chave' })

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, config })
}
