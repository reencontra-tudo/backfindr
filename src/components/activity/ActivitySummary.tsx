'use client';

import Link from 'next/link';
import { Activity, ArrowRight, CheckCircle2, Clock, RotateCcw, Zap } from 'lucide-react';

interface ActivitySummaryProps {
  objectsCount?: number;
  activeCount?: number;
  foundCount?: number;
  pendingMatches?: number;
  loading?: boolean;
}

function nextHourlyCheck(): string {
  const now = new Date();
  const next = new Date(now);
  next.setHours(now.getHours() + 1, 0, 0, 0);
  return next.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

export default function ActivitySummary({
  objectsCount = 0,
  activeCount = 0,
  foundCount = 0,
  pendingMatches = 0,
  loading = false,
}: ActivitySummaryProps) {
  const hasObjects = objectsCount > 0;
  const hasActive = activeCount > 0;
  const hasFound = foundCount > 0;
  const hasMatches = pendingMatches > 0;
  const nextCheck = nextHourlyCheck();

  return (
    <div className="rounded-2xl border border-teal-500/20 bg-teal-500/[0.05] p-4">
      <div className="flex items-start gap-3 mb-3">
        <div className="w-9 h-9 rounded-xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center flex-shrink-0">
          <Activity className="w-4 h-4 text-teal-400" />
        </div>
        <div>
          <p className="text-white text-sm font-semibold">Enquanto você esteve fora</p>
          <p className="text-white/40 text-xs mt-0.5">
            O Backfindr continuou trabalhando pelos seus objetos.
          </p>
        </div>
      </div>

      <div className="space-y-2.5">
        {hasFound && (
          <div className="flex items-start gap-2 text-xs text-amber-300 font-medium">
            <Zap className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-0.5" />
            <span>
              {foundCount === 1
                ? 'Alguém pode ter encontrado um dos seus objetos! Confira e confirme.'
                : `Alguém pode ter encontrado ${foundCount} dos seus objetos! Confira e confirme.`}
            </span>
          </div>
        )}

        <div className="flex items-start gap-2 text-xs text-white/55">
          <CheckCircle2 className="w-3.5 h-3.5 text-teal-400 flex-shrink-0 mt-0.5" />
          <span>
            {loading
              ? 'Verificando status dos objetos...'
              : hasActive
                ? 'Seus objetos continuam sendo monitorados.'
                : hasObjects
                  ? 'Nenhuma ocorrência ativa no momento.'
                  : 'Cadastre um objeto para iniciar o monitoramento.'}
          </span>
        </div>

        <div className="flex items-start gap-2 text-xs text-white/55">
          <Zap className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-0.5" />
          <span>
            {hasMatches
              ? `${pendingMatches} match${pendingMatches > 1 ? 'es' : ''} de IA aguardando sua análise.`
              : 'Nenhum novo match encontrado até o momento.'}
          </span>
        </div>

        <div className="flex items-start gap-2 text-xs text-white/55">
          <CheckCircle2 className="w-3.5 h-3.5 text-teal-400 flex-shrink-0 mt-0.5" />
          <span>A plataforma continuará verificando automaticamente novos registros.</span>
        </div>

        {hasActive && (
          <div className="flex items-start gap-2 text-xs text-white/55">
            <RotateCcw className="w-3.5 h-3.5 text-white/35 flex-shrink-0 mt-0.5" />
            <span>Próxima verificação automática prevista para as {nextCheck}.</span>
          </div>
        )}
      </div>

      <div className="mt-4 pt-3 border-t border-teal-500/10 flex items-center justify-between gap-3">
        <p className="text-[11px] text-white/35">
          Acompanhe os detalhes no Centro de Atividade de cada objeto.
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
