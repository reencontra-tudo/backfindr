// ARQUIVO: src/app/api/v1/admin/marketing/search/cron/route.ts
// Chamado pelo Vercel Cron Jobs — roda a busca automaticamente
// Configurar no vercel.json:
// { "crons": [{ "path": "/api/v1/admin/marketing/search/cron", "schedule": "0 */6 * * *" }] }

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET() {
  try {
    // Ler configuração
    const { data } = await supabase
      .from('marketing_config')
      .select('valor')
      .eq('chave', 'google_cse_auto')
      .single()

    if (!data) return NextResponse.json({ pulado: true, motivo: 'sem config' })

    const config = JSON.parse(data.valor)

    if (!config.automatico) {
      return NextResponse.json({ pulado: true, motivo: 'modo automático desativado' })
    }

    // Verificar se já passou o intervalo desde a última execução
    if (config.ultima_execucao) {
      const ultima = new Date(config.ultima_execucao)
      const agora = new Date()
      const horasPassadas = (agora.getTime() - ultima.getTime()) / (1000 * 60 * 60)
      if (horasPassadas < config.intervalo_horas) {
        return NextResponse.json({ 
          pulado: true, 
          motivo: `próxima execução em ${(config.intervalo_horas - horasPassadas).toFixed(1)}h` 
        })
      }
    }

    // Rodar busca para cada keyword
    const resultados = []
    for (const keyword of config.keywords) {
      const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/v1/admin/marketing/search/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyword })
      })
      const result = await res.json()
      resultados.push({ keyword, ...result })
    }

    // Atualizar ultima_execucao
    config.ultima_execucao = new Date().toISOString()
    await supabase
      .from('marketing_config')
      .upsert({ 
        chave: 'google_cse_auto', 
        valor: JSON.stringify(config),
        updated_at: new Date().toISOString()
      }, { onConflict: 'chave' })

    return NextResponse.json({ success: true, resultados })

  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
