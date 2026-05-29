'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, Zap, X } from 'lucide-react';
import { toast } from 'sonner';
import Cookies from 'js-cookie';

interface BoostRenewalSuggestionProps {
  objectId: string;
  activeBoost?: {
    id: string;
    type: string;
    expires_at: string;
  };
  onRenew?: () => void;
}

export default function BoostRenewalSuggestion({
  objectId,
  activeBoost,
  onRenew,
}: BoostRenewalSuggestionProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [daysRemaining, setDaysRemaining] = useState(0);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!activeBoost) return;

    const expiresAt = new Date(activeBoost.expires_at);
    const now = new Date();
    const diff = expiresAt.getTime() - now.getTime();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));

    setDaysRemaining(days);

    // Mostrar sugestão se faltam 3 dias ou menos
    if (days <= 3 && days > 0 && !dismissed) {
      setIsVisible(true);
    } else {
      setIsVisible(false);
    }
  }, [activeBoost, dismissed]);

  if (!isVisible || !activeBoost) {
    return null;
  }

  const getBoostLabel = (type: string) => {
    const labels: Record<string, string> = {
      'boost_7': 'Boost 7 dias',
      'boost_30': 'Boost 30 dias',
      'alert_area': 'Alerta de Área',
    };
    return labels[type] || 'Boost';
  };

  const getUrgencyLevel = () => {
    if (daysRemaining === 0) return 'critical';
    if (daysRemaining === 1) return 'urgent';
    return 'warning';
  };

  const urgencyLevel = getUrgencyLevel();
  const bgColor =
    urgencyLevel === 'critical'
      ? 'bg-red-500/10 border-red-500/30'
      : urgencyLevel === 'urgent'
        ? 'bg-orange-500/10 border-orange-500/30'
        : 'bg-yellow-500/10 border-yellow-500/30';

  const textColor =
    urgencyLevel === 'critical'
      ? 'text-red-400'
      : urgencyLevel === 'urgent'
        ? 'text-orange-400'
        : 'text-yellow-400';

  const iconColor =
    urgencyLevel === 'critical'
      ? 'text-red-400'
      : urgencyLevel === 'urgent'
        ? 'text-orange-400'
        : 'text-yellow-400';

  const getMessage = () => {
    if (daysRemaining === 0) {
      return 'Seu boost expira hoje! Renove agora para manter a visibilidade.';
    } else if (daysRemaining === 1) {
      return 'Seu boost expira amanhã! Renove agora para continuar em destaque.';
    } else {
      return `Seu boost expira em ${daysRemaining} dias. Renove agora para manter a visibilidade.`;
    }
  };

  const handleRenew = () => {
    if (onRenew) {
      onRenew();
    }
    setIsVisible(false);
  };

  const handleDismiss = () => {
    setDismissed(true);
    setIsVisible(false);
  };

  return (
    <div
      className={`border rounded-lg p-4 flex items-start gap-4 ${bgColor}`}
    >
      <AlertTriangle className={`w-5 h-5 flex-shrink-0 mt-0.5 ${iconColor}`} />

      <div className="flex-1 min-w-0">
        <h3 className={`font-semibold ${textColor} mb-1`}>
          {getBoostLabel(activeBoost.type)} expirando
        </h3>
        <p className="text-slate-300 text-sm">{getMessage()}</p>
      </div>

      <div className="flex gap-2 flex-shrink-0">
        <button
          onClick={handleRenew}
          className={`flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
            urgencyLevel === 'critical'
              ? 'bg-red-500 hover:bg-red-600 text-white'
              : urgencyLevel === 'urgent'
                ? 'bg-orange-500 hover:bg-orange-600 text-white'
                : 'bg-yellow-500 hover:bg-yellow-600 text-white'
          }`}
        >
          <Zap className="w-4 h-4" />
          Renovar
        </button>

        <button
          onClick={handleDismiss}
          className="p-2 text-slate-400 hover:text-slate-300 transition-colors"
          title="Descartar"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
