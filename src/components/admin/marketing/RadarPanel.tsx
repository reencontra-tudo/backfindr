'use client'

import { useState, useEffect } from 'react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

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

function SortableKeyword({ id, keyword, onRemover }: { id: string; keyword: string; onRemover: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }
  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-2">
      <div
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing px-1 py-1.5 text-gray-500 hover:text-gray-300"
        title="Arraste para reordenar"
      >
        ⠿
      </div>
      <span className="flex-1 text-sm rounded px-3 py-1.5" style={{background:"rgba(255,255,255,0.08)",color:"#fff",border:"1px solid rgba(255,255,255,0.15)"}}>
        {keyword}
      </span>
      <button onClick={onRemover} className="text-red-400 hover:text-red-600 text-xs">
        remover
      </button>
    </div>
  )
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

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  useEffect(() => { carregarConfig() }, [])

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

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (over && active.id !== over.id) {
      const oldIndex = config.keywords.indexOf(active.id as string)
      const newIndex = config.keywords.indexOf(over.id as string)
      const novasKeywords = arrayMove(config.keywords, oldIndex, newIndex)
      salvarConfig({ ...config, keywords: novasKeywords })
    }
  }

  function adicionarKeyword() {
    if (!novaKeyword.trim()) return
    salvarConfig({ ...config, keywords: [...config.keywords, novaKeyword.trim()] })
    setNovaKeyword('')
  }

  function removerKeyword(index: number) {
    salvarConfig({ ...config, keywords: config.keywords.filter((_, i) => i !== index) })
  }

  return (
    <div className="rounded-xl p-6 space-y-6" style={{background:"oklch(0.1 0.015 240)",border:"1px solid oklch(0.18 0.015 240)"}}>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">Radar — Google CSE</h2>
          <p className="text-sm text-gray-400">Captura leads do Facebook via Google Custom Search</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-400">Modo automático</span>
          <button
            onClick={() => salvarConfig({ ...config, automatico: !config.automatico })}
            disabled={salvandoConfig}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${config.automatico ? 'bg-green-500' : 'bg-gray-600'}`}
          >
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${config.automatico ? 'translate-x-6' : 'translate-x-1'}`} />
          </button>
          {config.automatico && (
            <span className="text-xs bg-green-900 text-green-300 px-2 py-0.5 rounded-full">
              A cada {config.intervalo_horas}h
            </span>
          )}
        </div>
      </div>

      {config.ultima_execucao && (
        <p className="text-xs text-gray-500">
          Última execução: {new Date(config.ultima_execucao).toLocaleString('pt-BR')}
        </p>
      )}

      <div>
        <p className="text-sm font-medium text-gray-300 mb-2">Keywords de busca <span className="text-gray-500 text-xs">(arraste para reordenar)</span></p>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={config.keywords} strategy={verticalListSortingStrategy}>
            <div className="space-y-2">
              {config.keywords.map((kw, i) => (
                <SortableKeyword key={kw} id={kw} keyword={kw} onRemover={() => removerKeyword(i)} />
              ))}
            </div>
          </SortableContext>
        </DndContext>
        <div className="flex gap-2 mt-2">
          <input
            type="text"
            value={novaKeyword}
            onChange={e => setNovaKeyword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && adicionarKeyword()}
            placeholder="ex: perdi meu celular SP"
            className="flex-1 text-sm rounded px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
            style={{background:"rgba(255,255,255,0.08)",color:"#fff",border:"1px solid rgba(255,255,255,0.15)",caretColor:"#fff"}}
          />
          <button onClick={adicionarKeyword} className="text-sm px-3 py-1.5 rounded text-gray-300 hover:text-white" style={{background:"rgba(255,255,255,0.1)",border:"1px solid rgba(255,255,255,0.15)"}}>
            + Adicionar
          </button>
        </div>
      </div>

      {config.automatico && (
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-400">Intervalo:</span>
          {[3, 6, 12, 24].map(h => (
            <button key={h} onClick={() => salvarConfig({ ...config, intervalo_horas: h })}
              className={`text-sm px-3 py-1 rounded border ${config.intervalo_horas === h ? 'bg-blue-600 text-white border-blue-600' : 'text-gray-400 border-gray-600 hover:border-gray-400'}`}>
              {h}h
            </button>
          ))}
        </div>
      )}


      {/* Sugestões rápidas */}
      <div>
        <p className="text-xs font-medium text-gray-500 mb-2 uppercase tracking-widest">Sugestões rápidas</p>
        <div className="flex flex-wrap gap-1.5">
          {[
            'celular roubado São Paulo',
            'perdi meu celular Guarulhos',
            'cachorro perdido Guarulhos',
            'gato perdido São Paulo',
            'documento encontrado São Paulo',
            'bicicleta roubada Zona Leste',
            'perdi minha carteira SP',
            'mochila roubada metrô SP',
            'site:facebook.com cachorro perdido Guarulhos',
            'site:instagram.com celular roubado São Paulo',
            'site:olx.com.br documento encontrado',
          ].map(s => (
            <button
              key={s}
              onClick={() => setNovaKeyword(s)}
              className="text-xs px-2.5 py-1 rounded-full transition-all"
              style={{background:'rgba(99,102,241,0.15)',border:'1px solid rgba(99,102,241,0.3)',color:'oklch(0.75 0.12 255)'}}
            >
              + {s}
            </button>
          ))}
        </div>
      </div>

      <button onClick={disparar} disabled={disparando || config.keywords.length === 0}
        className="w-full py-3 rounded-lg font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
        {disparando ? '🔍 Buscando...' : '⚡ Disparar agora'}
      </button>

      {resultado && (
        <div className={`rounded-lg p-4 text-sm ${resultado.success ? 'border border-green-800' : 'border border-red-800'}`}
          style={{background: resultado.success ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)'}}>
          {resultado.success ? (
            <div className="space-y-1 text-green-300">
              <p className="font-medium">✅ Busca concluída</p>
              <p>Keyword: <span className="font-mono">{resultado.keyword}</span></p>
              <p>Total: {resultado.total_google} | Salvos: <strong>{resultado.salvos}</strong> | Duplicados: {resultado.duplicados} | Irrelevantes: {resultado.irrelevantes}</p>
            </div>
          ) : (
            <p className="text-red-400">❌ {resultado.error}</p>
          )}
        </div>
      )}

      {erro && <div className="rounded-lg p-4 text-sm text-red-400" style={{background:'rgba(239,68,68,0.1)',border:'1px solid rgba(239,68,68,0.3)'}}>{erro}</div>}
    </div>
  )
}
