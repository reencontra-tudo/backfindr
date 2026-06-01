// ARQUIVO: src/components/admin/marketing/RadarPanel.tsx
// Painel com botão Disparar manual + toggle Modo Automático
// Adicionar na página: src/app/admin/marketing/leads/page.tsx

'use client'

import { useState, useEffect } from 'react'

interface Config {
  automatico: boolean
  intervalo_horas: number
  keywords: string[]
  ultima_execucao: string | null
}

interface ResultadoBusca {
  success: boolean
  salvos: number
  duplicados: number
  irrelevantes: number
  total_google: number
  keyword: string
  error?: string
}

export default function RadarPanel() {
  const [config, setConfig] = useState<Config>({
    automatico: false,
    intervalo_horas: 6,
    keywords: ['perdi celular São Paulo', 'roubaram minha bike SP', 'perdi cachorro São Paulo'],
    ultima_execucao: null
  })
  const [disparando, setDisparando] = useState(false)
  const [salvandoConfig, setSalvandoConfig] = useState(false)
  const [resultado, setResultado] = useState<ResultadoBusca | null>(null)
  const [novaKeyword, setNovaKeyword] = useState('')
  const [erro, setErro] = useState('')

  useEffect(() => {
    carregarConfig()
  }, [])

  async function carregarConfig() {
    const res = await fetch('/api/v1/admin/marketing/search/config')
    const data = await res.json()
    setConfig(data)
  }

  async function disparar() {
    setDisparando(true)
    setResultado(null)
    setErro('')

    try {
      // Dispara para a primeira keyword (ou todas em sequência)
      const keyword = config.keywords[0] || 'perdi objeto São Paulo'
      const res = await fetch('/api/v1/admin/marketing/search/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyword })
      })
      const data = await res.json()
      setResultado(data)
    } catch (e: any) {
      setErro('Erro ao disparar busca: ' + e.message)
    } finally {
      setDisparando(false)
    }
  }

  async function salvarConfig(novaConfig: Config) {
    setSalvandoConfig(true)
    try {
      await fetch('/api/v1/admin/marketing/search/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(novaConfig)
      })
      setConfig(novaConfig)
    } finally {
      setSalvandoConfig(false)
    }
  }

  function toggleAutomatico() {
    salvarConfig({ ...config, automatico: !config.automatico })
  }

  function adicionarKeyword() {
    if (!novaKeyword.trim()) return
    const atualizado = { ...config, keywords: [...config.keywords, novaKeyword.trim()] }
    salvarConfig(atualizado)
    setNovaKeyword('')
  }

  function removerKeyword(index: number) {
    const atualizado = { ...config, keywords: config.keywords.filter((_, i) => i !== index) }
    salvarConfig(atualizado)
  }

  return (
    <div className="rounded-xl p-6 space-y-6" style={{background:"oklch(0.1 0.015 240)",border:"1px solid oklch(0.18 0.015 240)"}}>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">Radar — Google CSE</h2>
          <p className="text-sm text-gray-400">Captura leads do Facebook via Google Custom Search</p>
        </div>

        {/* Toggle Modo Automático */}
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-400">Modo automático</span>
          <button
            onClick={toggleAutomatico}
            disabled={salvandoConfig}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              config.automatico ? 'bg-green-500' : 'bg-gray-300'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                config.automatico ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
          {config.automatico && (
            <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
              A cada {config.intervalo_horas}h
            </span>
          )}
        </div>
      </div>

      {/* Info última execução */}
      {config.ultima_execucao && (
        <p className="text-xs text-gray-400">
          Última execução automática: {new Date(config.ultima_execucao).toLocaleString('pt-BR')}
        </p>
      )}

      {/* Keywords */}
      <div>
        <p className="text-sm font-medium text-gray-300 mb-2">Keywords de busca</p>
        <div className="space-y-2">
          {config.keywords.map((kw, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="flex-1 text-sm rounded px-3 py-1.5" style={{background:"rgba(255,255,255,0.08)",color:"#fff",border:"1px solid rgba(255,255,255,0.15)"}}>
                {kw}
              </span>
              <button
                onClick={() => removerKeyword(i)}
                className="text-red-400 hover:text-red-600 text-xs"
              >
                remover
              </button>
            </div>
          ))}
        </div>
        <div className="flex gap-2 mt-2">
          <input
            type="text"
            value={novaKeyword}
            onChange={e => setNovaKeyword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && adicionarKeyword()}
            placeholder="ex: perdi meu celular SP"
            className="flex-1 text-sm border border-gray-200 rounded px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400" style={{color:'#ffffff', backgroundColor:'rgba(255,255,255,0.08)', caretColor:'#ffffff'}}
          />
          <button
            onClick={adicionarKeyword}
            className="text-sm px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded border border-gray-200"
          >
            + Adicionar
          </button>
        </div>
      </div>

      {/* Intervalo (quando automático ativo) */}
      {config.automatico && (
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-400">Intervalo:</span>
          {[3, 6, 12, 24].map(h => (
            <button
              key={h}
              onClick={() => salvarConfig({ ...config, intervalo_horas: h })}
              className={`text-sm px-3 py-1 rounded border ${
                config.intervalo_horas === h
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
              }`}
            >
              {h}h
            </button>
          ))}
        </div>
      )}

      {/* Botão Disparar */}
      <button
        onClick={disparar}
        disabled={disparando || config.keywords.length === 0}
        className="w-full py-3 rounded-lg font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {disparando ? '🔍 Buscando...' : '⚡ Disparar agora'}
      </button>

      {/* Resultado */}
      {resultado && (
        <div className={`rounded-lg p-4 text-sm ${resultado.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
          {resultado.success ? (
            <div className="space-y-1 text-green-800">
              <p className="font-medium">✅ Busca concluída</p>
              <p>Keyword: <span className="font-mono">{resultado.keyword}</span></p>
              <p>Resultados Google: {resultado.total_google} | Salvos: <strong>{resultado.salvos}</strong> | Duplicados: {resultado.duplicados} | Irrelevantes: {resultado.irrelevantes}</p>
            </div>
          ) : (
            <p className="text-red-700">❌ {resultado.error}</p>
          )}
        </div>
      )}

      {erro && (
        <div className="rounded-lg p-4 bg-red-50 border border-red-200 text-sm text-red-700">
          {erro}
        </div>
      )}
    </div>
  )
}
