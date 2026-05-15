'use client';
export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { ExternalLink, RefreshCw, AlertCircle, Maximize2, Zap, Settings, Copy, Check } from 'lucide-react';

// ─── URL do n8n via variável de ambiente ──────────────────────────────────────
// Configure NEXT_PUBLIC_N8N_URL no Vercel para apontar para sua instância n8n
// Ex: https://seu-n8n.railway.app ou https://n8n.seudominio.com
const N8N_URL = process.env.NEXT_PUBLIC_N8N_URL ?? '';

export default function MarketingAutomacaoPage() {
  const [online, setOnline] = useState<boolean | null>(null);
  const [key, setKey] = useState(0);
  const [copied, setCopied] = useState(false);

  const n8nUrl = N8N_URL.trim();
  const hasUrl = n8nUrl.length > 0;

  const checkOnline = () => {
    if (!hasUrl) {
      setOnline(false);
      return;
    }
    setOnline(null);
    // Tenta verificar se o n8n está acessível via healthz
    const healthUrl = n8nUrl.replace(/\/$/, '') + '/healthz';
    fetch(healthUrl, { mode: 'no-cors' })
      .then(() => setOnline(true))
      .catch(() => {
        // no-cors pode falhar mesmo se online; tenta com iframe
        setOnline(true);
      });
  };

  useEffect(() => {
    checkOnline();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-52px)]">
      {/* ── Barra superior ── */}
      <div
        className="flex items-center justify-between px-4 py-2.5 border-b flex-shrink-0"
        style={{ background: '#060a12', borderColor: 'oklch(0.14 0.015 240)' }}
      >
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-purple-400" />
            <span className="text-white/60 text-sm font-medium">n8n Workflows</span>
          </div>
          <div
            className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium ${
              !hasUrl
                ? 'bg-yellow-500/10 border border-yellow-500/20 text-yellow-400'
                : online === null
                  ? 'bg-white/5 text-white/30'
                  : online
                    ? 'bg-green-500/10 border border-green-500/20 text-green-400'
                    : 'bg-red-500/10 border border-red-500/20 text-red-400'
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                !hasUrl
                  ? 'bg-yellow-400'
                  : online === null
                    ? 'bg-white/30'
                    : online
                      ? 'bg-green-400 animate-pulse'
                      : 'bg-red-400'
              }`}
            />
            {!hasUrl
              ? 'URL nao configurada'
              : online === null
                ? 'verificando...'
                : online
                  ? 'online'
                  : 'offline'}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => { checkOnline(); setKey((k) => k + 1); }}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-white/30 hover:text-white/70 hover:bg-white/[0.04] text-xs transition-all"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Recarregar
          </button>
          {hasUrl && (
            <a
              href={n8nUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-white/30 hover:text-purple-400 hover:bg-purple-500/[0.06] text-xs transition-all"
            >
              <Maximize2 className="w-3.5 h-3.5" />
              Abrir em janela
            </a>
          )}
        </div>
      </div>

      {/* ── Conteudo ── */}
      {!hasUrl ? (
        /* Estado: URL nao configurada */
        <div className="flex-1 flex flex-col items-center justify-center gap-6 p-6">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center"
            style={{ background: '#A78BFA15', border: '1px solid #A78BFA30' }}
          >
            <Settings className="w-7 h-7 text-purple-400" />
          </div>

          <div className="text-center max-w-md">
            <p className="text-white/80 font-semibold text-lg mb-2">n8n nao configurado</p>
            <p className="text-white/40 text-sm leading-relaxed">
              Para usar os workflows de automacao, hospede o n8n e configure a variavel de ambiente
              <code className="mx-1 px-1.5 py-0.5 rounded text-purple-300/80 text-xs" style={{ background: '#A78BFA15' }}>
                NEXT_PUBLIC_N8N_URL
              </code>
              no Vercel.
            </p>
          </div>

          {/* Card de instrucoes */}
          <div
            className="w-full max-w-lg rounded-2xl p-5 space-y-4"
            style={{ background: 'oklch(0.09 0.015 240)', border: '1px solid oklch(0.16 0.015 240)' }}
          >
            <div className="text-xs font-semibold tracking-widest text-white/30 uppercase">
              Como configurar
            </div>

            {[
              {
                step: '1',
                title: 'Hospede o n8n',
                desc: 'Recomendamos Railway, Render ou um VPS proprio. O n8n tem plano gratuito no Railway.',
                link: 'https://railway.app',
                linkLabel: 'railway.app',
              },
              {
                step: '2',
                title: 'Configure a variavel de ambiente',
                desc: 'No painel do Vercel, adicione a variavel:',
                code: 'NEXT_PUBLIC_N8N_URL=https://seu-n8n.railway.app',
              },
              {
                step: '3',
                title: 'Redeploy',
                desc: 'Apos salvar a variavel, faca um redeploy no Vercel para aplicar a configuracao.',
              },
            ].map(({ step, title, desc, link, linkLabel, code }) => (
              <div key={step} className="flex gap-3">
                <div
                  className="flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold shrink-0 mt-0.5"
                  style={{ background: '#A78BFA20', color: '#A78BFA', border: '1px solid #A78BFA30' }}
                >
                  {step}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white/70 mb-0.5">{title}</p>
                  <p className="text-xs text-white/40 leading-relaxed">{desc}</p>
                  {link && (
                    <a
                      href={link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-purple-400 hover:text-purple-300 mt-1"
                    >
                      <ExternalLink size={10} /> {linkLabel}
                    </a>
                  )}
                  {code && (
                    <div className="flex items-center gap-2 mt-1.5">
                      <code
                        className="flex-1 px-2.5 py-1.5 rounded-lg text-xs font-mono text-purple-300/80 truncate"
                        style={{ background: '#A78BFA10', border: '1px solid #A78BFA20' }}
                      >
                        {code}
                      </code>
                      <button
                        onClick={() => handleCopy(code)}
                        className="p-1.5 rounded-lg text-white/20 hover:text-purple-400 transition-all"
                      >
                        {copied ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Link para documentacao do n8n */}
          <a
            href="https://docs.n8n.io/hosting/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-xs text-white/30 hover:text-white/50 transition-all"
          >
            <ExternalLink size={11} /> Documentacao de hospedagem do n8n
          </a>
        </div>
      ) : online === false ? (
        /* Estado: URL configurada mas offline */
        <div className="flex-1 flex flex-col items-center justify-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
            <AlertCircle className="w-6 h-6 text-red-400" />
          </div>
          <div className="text-center">
            <p className="text-white/70 font-medium">n8n inacessivel</p>
            <p className="text-white/30 text-sm mt-1">
              Nao foi possivel conectar em:
            </p>
            <code
              className="block mt-2 px-4 py-2 rounded-lg text-purple-300/70 text-xs font-mono max-w-sm truncate"
              style={{ background: '#A78BFA10', border: '1px solid #A78BFA20' }}
            >
              {n8nUrl}
            </code>
            <p className="text-white/20 text-xs mt-2">
              Verifique se o servico esta rodando e se a URL esta correta.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={checkOnline}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm text-purple-400 transition-all"
              style={{ background: '#A78BFA10', border: '1px solid #A78BFA25' }}
            >
              <RefreshCw className="w-4 h-4" />
              Tentar novamente
            </button>
            <button
              onClick={() => setOnline(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm text-white/40 hover:text-white/60 transition-all"
            >
              Carregar mesmo assim
            </button>
          </div>
        </div>
      ) : (
        /* Estado: online — exibe iframe */
        <iframe
          key={key}
          src={n8nUrl}
          className="flex-1 w-full border-0"
          title="n8n Workflows"
          allow="clipboard-read; clipboard-write"
        />
      )}
    </div>
  );
}
