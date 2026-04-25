"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle, ArrowRight, Loader2 } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

const PLAN_NAMES: Record<string, string> = { pro: "Pro", business: "Business" };
const BOOST_NAMES: Record<string, string> = {
  "7d":         "Boost 7 dias",
  "30d":        "Boost 30 dias",
  boost_7:      "Boost 7 dias",
  boost_30:     "Boost 30 dias",
  alert_area:   "Alerta de Área",
};

function SuccessContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const type = searchParams.get("type");
  const ref  = searchParams.get("ref");

  const [checking, setChecking] = useState(true);
  const [planConfirmed, setPlanConfirmed] = useState(false);

  // Verificar se o plano foi ativado (polling por até 15s)
  useEffect(() => {
    if (type !== "plan") {
      setChecking(false);
      return;
    }

    let attempts = 0;
    const maxAttempts = 5;

    const check = async () => {
      try {
        const token = localStorage.getItem("token") || sessionStorage.getItem("token");
        if (!token) { setChecking(false); return; }

        const res = await fetch("/api/v1/billing/status", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          if (data.plan === ref || data.plan === "business" || data.is_paid) {
            setPlanConfirmed(true);
            setChecking(false);
            return;
          }
        }
      } catch { /* ignorar */ }

      attempts++;
      if (attempts < maxAttempts) {
        setTimeout(check, 3000);
      } else {
        setChecking(false);
      }
    };

    setTimeout(check, 2000); // aguardar 2s para o webhook processar
  }, [type, ref]);

  // Redirecionar para dashboard após 8 segundos
  useEffect(() => {
    const timer = setTimeout(() => {
      router.push("/dashboard/billing");
    }, 8000);
    return () => clearTimeout(timer);
  }, [router]);

  const getMessage = () => {
    if (type === "plan") {
      const planName = PLAN_NAMES[ref || ""] || ref || "Premium";
      return {
        title: `Plano ${planName} ativado!`,
        description: "Seu plano foi ativado com sucesso. Aproveite todos os recursos disponíveis.",
        badge: planName,
      };
    }
    if (type === "boost") {
      const boostName = BOOST_NAMES[ref || ""] || "Boost";
      return {
        title: `${boostName} ativado!`,
        description: "Seu objeto agora está em destaque. Mais pessoas vão vê-lo na rede.",
        badge: null,
      };
    }
    return {
      title: "Pagamento confirmado!",
      description: "Sua compra foi processada com sucesso.",
      badge: null,
    };
  };

  const { title, description, badge } = getMessage();

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center space-y-6">
        {/* Ícone de sucesso */}
        <div className="flex justify-center">
          <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center">
            <CheckCircle className="w-10 h-10 text-green-400" />
          </div>
        </div>

        {/* Título e descrição */}
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-white">{title}</h1>
          <p className="text-gray-400">{description}</p>
          {badge && (
            <span className="inline-block mt-2 px-3 py-1 bg-emerald-500/20 text-emerald-400 text-sm font-semibold rounded-full border border-emerald-500/30">
              Plano {badge} ativo
            </span>
          )}
        </div>

        {/* Status de verificação */}
        {type === "plan" && (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            {checking ? (
              <div className="flex items-center justify-center gap-2 text-gray-400 text-sm">
                <Loader2 className="w-4 h-4 animate-spin" />
                Confirmando ativação do plano...
              </div>
            ) : planConfirmed ? (
              <div className="flex items-center justify-center gap-2 text-emerald-400 text-sm">
                <CheckCircle className="w-4 h-4" />
                Plano confirmado no sistema
              </div>
            ) : (
              <p className="text-sm text-gray-500">
                O plano pode levar alguns minutos para ser ativado. Verifique em{" "}
                <Link href="/dashboard/billing" className="text-emerald-400 hover:underline">
                  Plano & Billing
                </Link>
                .
              </p>
            )}
          </div>
        )}

        {type !== "plan" && (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <p className="text-sm text-gray-500">
              Você será redirecionado automaticamente em alguns segundos...
            </p>
          </div>
        )}

        {/* Ações */}
        <div className="flex flex-col gap-3">
          <Link
            href="/dashboard/billing"
            className="flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-black font-semibold py-3 px-6 rounded-xl transition-colors"
          >
            Ver meu plano
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            href="/dashboard"
            className="text-gray-500 hover:text-gray-300 text-sm transition-colors"
          >
            Ir para o Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function CheckoutSuccessPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-gray-400">Carregando...</div>
      </div>
    }>
      <SuccessContent />
    </Suspense>
  );
}
