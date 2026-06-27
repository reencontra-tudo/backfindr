'use client';
import Link from 'next/link';
import { Activity, ArrowRight, CheckCircle2, Clock, Radar, Zap } from 'lucide-react';

interface ActivitySummaryProps {
  objectsCount?: number;
  activeCount?: number;
  pendingMatches?: number;
  loading?: boolean;
}

export default function ActivitySummary({
  objectsCount = 0,
  activeCount = 0,
  pendingMatches = 0,
  loading = false,
}: ActivitySummaryProps) {
  const hasObjects = objectsCount > 0;
  const hasActive = activeCount > 0;
  const hasMatches = pendingMatches > 0;
  return (
    <div className="rounded-2xl border border-teal-500/20 bg-teal-500/[0.05] p-4">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center flex-shrink-0">
            <Activity className="w-4 h-4 text-teal-400" />
          </div>
          <div>
            <p className="text-white text-sm font-semibold">Enquanto você esteve fora</p>
            <p className="text-white/40 text-xs mt-0.5">
              O Backfindr continua trabalhando pelos seus objetos.
            </p>
          </div>
        </div>
      </div>
      <div className="space-y-2.5">
        <div className="flex items-start gap-2 text-xs text-white/55">
          <CheckCircle2 className="w-3.5 h-3.5 text-teal-400 flex-shrink-0 mt-0.5" />
          <span>
            {loading
              ? 'Verificando atividade recente...'
              : hasObjects
                ? `${objectsCount} objeto${objectsCount > 1 ? 's' : ''} monitorado${objectsCount > 1 ? 's' : ''} na sua conta.`
                : 'Você ainda não possui objetos monitorados.'}
          </span>
        </div>
        <div className="flex items-start gap-2 text-xs text-white/55">
          <Radar className="w-3.5 h-3.5 text-teal-400 flex-shrink-0 mt-0.5" />
          <span>
            {hasActive
              ? `${activeCount} ocorrência${activeCount > 1 ? 's' : ''} ativa${activeCount > 1 ? 's' : ''} com acompanhamento contínuo.`
              : hasObjects
                ? 'Nenhuma ocorrência ativa neste momento.'
                : 'Cadastre um objeto para iniciar o monitoramento.'}
          </span>
        </div>
        <div className="flex items-start gap-2 text-xs text-white/55">
          <Zap className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-0.5" />
          <span>
            {hasMatches
              ? `${pendingMatches} match${pendingMatches > 1 ? 'es' : ''} de IA aguardando sua análise.`
              : 'Nenhum novo match pendente agora.'}
          </span>
        </div>
        <div className="flex items-start gap-2 text-xs text-white/55">
          <Clock className="w-3.5 h-3.5 text-white/35 flex-shrink-0 mt-0.5" />
          <span>Novas verificações continuam acontecendo automaticamente.</span>
        </div>
      </div>
      <div className="mt-4 pt-3 border-t border-teal-500/10 flex items-center justify-between gap-3">
        <p className="text-[11px] text-white/35">
          Acompanhe detalhes em cada objeto.
        </p>
        <Link
          href="/dashboard/objects"
          className="inline-flex items-center gap-1 text-xs text-teal-400 hover:text-teal-300 transition-colors"
        >
          Ver objetos
          <ArrowRight className="w-3 h-3" />
        </Link>
      </div>
    </div>
  );
}
