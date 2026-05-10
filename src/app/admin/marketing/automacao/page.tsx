'use client';
export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { ExternalLink, RefreshCw, AlertCircle, Maximize2, Zap } from 'lucide-react';

export default function MarketingAutomacaoPage() {
  const [online, setOnline] = useState<boolean | null>(null);
  const [key, setKey] = useState(0);

  const checkOnline = () => {
    setOnline(null);
    fetch('http://localhost:5678/healthz')
      .then(() => setOnline(true))
      .catch(() => setOnline(false));
  };

  useEffect(() => { checkOnline(); }, []);

  return (
    <div className="flex flex-col h-[calc(100vh-52px)]">

      {/* Barra superior */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/[0.05] bg-[#060a12] flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-purple-400" />
            <span className="text-white/60 text-sm font-medium">n8n Workflows</span>
          </div>
          <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium ${
            online === null ? 'bg-white/5 text-white/30' :
            online ? 'bg-green-500/10 border border-green-500/20 text-green-400' :
                     'bg-red-500/10 border border-red-500/20 text-red-400'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${
              online === null ? 'bg-white/30' :
              online ? 'bg-green-400 animate-pulse' : 'bg-red-400'
            }`} />
            {online === null ? 'verificando' : online ? 'online · :5678' : 'offline'}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => { checkOnline(); setKey(k => k + 1); }}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-white/30 hover:text-white/70 hover:bg-white/[0.04] text-xs transition-all"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Recarregar
          </button>
          <a
            href="http://localhost:5678"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-white/30 hover:text-purple-400 hover:bg-purple-500/[0.06] text-xs transition-all"
          >
            <Maximize2 className="w-3.5 h-3.5" />
            Abrir em janela
          </a>
        </div>
      </div>

      {/* Conteúdo */}
      {online === false ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
            <AlertCircle className="w-6 h-6 text-red-400" />
          </div>
          <div className="text-center">
            <p className="text-white/70 font-medium">n8n offline</p>
            <p className="text-white/30 text-sm mt-1">Inicie o n8n na sessão do terminal dedicada.</p>
            <p className="text-white/20 text-xs mt-2">Porta esperada: <code className="text-purple-300/60">5678</code></p>
          </div>
          <button
            onClick={checkOnline}
            className="flex items-center gap-2 px-4 py-2 bg-purple-500/10 border border-purple-500/20 rounded-xl text-purple-400 text-sm hover:bg-purple-500/20 transition-all"
          >
            <RefreshCw className="w-4 h-4" />
            Verificar novamente
          </button>
        </div>
      ) : (
        <iframe
          key={key}
          src={process.env.NEXT_PUBLIC_N8N_URL || "http://localhost:5678"}
          className="flex-1 w-full border-0"
          title="n8n Workflows"
          allow="clipboard-read; clipboard-write"
        />
      )}
    </div>
  );
}
