"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle, ArrowRight } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

function SuccessContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const type = searchParams.get("type");
  const ref = searchParams.get("ref");

  useEffect(() => {
    // Redirecionar para dashboard após 5 segundos
    const timer = setTimeout(() => {
      router.push("/dashboard");
    }, 5000);
    return () => clearTimeout(timer);
  }, [router]);

  const getMessage = () => {
    if (type === "plan") {
      const planNames: Record<string, string> = { pro: "Pro", business: "Business" };
      return {
        title: `Plano ${planNames[ref || ""] || ref} ativado!`,
        description: "Seu plano foi ativado com sucesso. Aproveite todos os recursos disponíveis.",
      };
    }
    if (type === "boost") {
      const boostNames: Record<string, string> = {
        boost_7: "Boost 7 dias",
        boost_30: "Boost 30 dias",
        alert_area: "Alerta de Área",
      };
      return {
        title: `${boostNames[ref || ""] || "Boost"} ativado!`,
        description: "Seu objeto agora está em destaque. Mais pessoas vão vê-lo na rede.",
      };
    }
    return {
      title: "Pagamento confirmado!",
      description: "Sua compra foi processada com sucesso.",
    };
  };

  const { title, description } = getMessage();

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="flex justify-center">
          <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center">
            <CheckCircle className="w-10 h-10 text-green-400" />
          </div>
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-white">{title}</h1>
          <p className="text-gray-400">{description}</p>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <p className="text-sm text-gray-500">
            Você será redirecionado para o dashboard em alguns segundos...
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <Link
            href="/dashboard"
            className="flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-black font-semibold py-3 px-6 rounded-xl transition-colors"
          >
            Ir para o Dashboard
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            href="/"
            className="text-gray-500 hover:text-gray-300 text-sm transition-colors"
          >
            Voltar para o início
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
