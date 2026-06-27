"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle, ArrowRight, Loader2, Download, Share2 } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { toast } from "sonner";
import Cookies from "js-cookie";

const PLAN_NAMES: Record<string, string> = { pro: "Pro", business: "Business" };
const BOOST_NAMES: Record<string, string> = {
  "7d":         "Alcance Essencial",
  "30d":        "Busca Intensiva",
  boost_7:      "Alcance Essencial",
  boost_30:     "Busca Intensiva",
  alert_area:   "Alerta Regional",
};

function SuccessContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const type = searchParams.get("type");
  const ref  = searchParams.get("ref");
  const objectId = searchParams.get("object_id");

  const [checking, setChecking] = useState(true);
  const [planConfirmed, setPlanConfirmed] = useState(false);
  const [boostData, setBoostData] = useState<any>(null);
  const [objectData, setObjectData] = useState<any>(null);

  // Verificar se o plano foi ativado (polling por até 15s)
  useEffect(() => {
    if (type === "boost" && objectId) {
      // Verificar boost ativado
      let attempts = 0;
      const maxAttempts = 10;

      const checkBoost = async () => {
        try {
          const token = Cookies.get("access_token");
          if (!token) { setChecking(false); return; }

          const res = await fetch(`/api/v1/boost?object_id=${objectId}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (res.ok) {
            const data = await res.json();
            if (data.data?.active_boost) {
              setBoostData(data.data.active_boost);
              setPlanConfirmed(true);
              setChecking(false);
              return;
            }
          }
        } catch { /* ignorar */ }

        attempts++;
        if (attempts < maxAttempts) {
          setTimeout(checkBoost, 3000);
        } else {
          setChecking(false);
        }
      };

      setTimeout(checkBoost, 3000);
      return;
    }

    if (type !== "plan") {
      setChecking(false);
      return;
    }

    let attempts = 0;
    const maxAttempts = 10; // Aumentado para 30s total

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

    setTimeout(check, 3000); // aguardar 3s para o webhook processar
  }, [type, ref, objectId]);

  // Redirecionar para dashboard após 8 segundos (apenas para planos)
  useEffect(() => {
    if (type === "plan") {
      const timer = setTimeout(() => {
        router.push("/dashboard/billing");
      }, 8000);
      return () => clearTimeout(timer);
    }
  }, [router, type]);

  // Buscar dados do objeto para boost
  useEffect(() => {
    if (type === "boost" && objectId) {
      const fetchObjectData = async () => {
        try {
          const token = Cookies.get("access_token");
          if (!token) return;

          const res = await fetch(`/api/v1/objects/${objectId}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (res.ok) {
            const data = await res.json();
            setObjectData(data.data || data);
          }
        } catch { /* ignorar */ }
      };

      fetchObjectData();
    }
  }, [type, objectId]);

  const downloadPoster = async () => {
    try {
      const format = "vertical";
      const response = await fetch(
        `/api/v1/objects/${objectId}/poster?format=${format}&template=rich`,
        { method: "GET" }
      );

      if (!response.ok) throw new Error("Erro ao baixar pôster");

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `cartaz-${objectData?.qr_code || "backfindr"}-${format}-rich.png`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success("Pôster baixado com sucesso!");
    } catch (err) {
      console.error("Erro ao baixar pôster:", err);
      toast.error("Erro ao baixar pôster");
    }
  };

  const sharePoster = () => {
    if (!objectData?.qr_code) {
      toast.error("Dados do objeto não disponíveis");
      return;
    }

    const scanUrl = `${process.env.NEXT_PUBLIC_APP_URL || "https://backfindr.com"}/scan/${objectData.qr_code}`;
    const message = `Encontrei um objeto perdido! Ajude a encontrar o dono: ${scanUrl}`;

    if (navigator.share) {
      navigator.share({
        title: "Backfindr - Objeto Perdido",
        text: message,
        url: scanUrl,
      }).catch(() => {});
    } else {
      navigator.clipboard.writeText(message);
      toast.success("Link copiado para compartilhar!");
    }
  };

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
              <div className="space-y-2">
                <p className="text-sm text-gray-400">
                  O pagamento foi recebido, mas a ativação via Pix pode levar de 1 a 5 minutos.
                </p>
                <p className="text-xs text-gray-500">
                  Não se preocupe, você receberá um e-mail assim que estiver tudo pronto. Você já pode navegar pelo{" "}
                  <Link href="/dashboard" className="text-emerald-400 hover:underline">
                    Dashboard
                  </Link>
                  .
                </p>
              </div>
            )}
          </div>
        )}

        {type === "boost" && (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            {checking ? (
              <div className="flex items-center justify-center gap-2 text-gray-400 text-sm">
                <Loader2 className="w-4 h-4 animate-spin" />
                Ativando seu boost...
              </div>
            ) : planConfirmed ? (
              <div className="flex items-center justify-center gap-2 text-emerald-400 text-sm">
                <CheckCircle className="w-4 h-4" />
                Boost confirmado no sistema
              </div>
            ) : (
              <p className="text-sm text-gray-400">
                Processando seu pagamento...
              </p>
            )}
          </div>
        )}

        {type === "boost" && planConfirmed && (
          <div className="mt-2 rounded-xl border border-teal-500/20 bg-teal-500/5 p-4 text-left">
            <p className="text-teal-300 text-sm font-semibold mb-2">
              O Backfindr continua trabalhando por você.
            </p>
            <div className="space-y-2 text-xs text-slate-300">
              <div>✓ Sua ocorrência recebeu prioridade de divulgação.</div>
              <div>✓ A IA continuará comparando novos registros automaticamente.</div>
              <div>✓ Novas atividades aparecerão no Centro de Atividade do objeto.</div>
            </div>
            <p className="mt-3 text-[11px] text-slate-500">
              Você poderá acompanhar todas as novas comparações, eventos e atualizações diretamente na página do objeto.
            </p>
          </div>
        )}

        {type !== "plan" && type !== "boost" && (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <p className="text-sm text-gray-500">
              Você será redirecionado automaticamente em alguns segundos...
            </p>
          </div>
        )}

        {/* Ações */}
        <div className="flex flex-col gap-3">
          {type === "boost" && objectId ? (
            <>
              <button
                onClick={downloadPoster}
                className="flex items-center justify-center gap-2 bg-blue-500 hover:bg-blue-600 text-white font-semibold py-3 px-6 rounded-xl transition-colors"
              >
                <Download className="w-4 h-4" />
                Baixar cartaz
              </button>
              <button
                onClick={sharePoster}
                className="flex items-center justify-center gap-2 bg-purple-500 hover:bg-purple-600 text-white font-semibold py-3 px-6 rounded-xl transition-colors"
              >
                <Share2 className="w-4 h-4" />
                Compartilhar ocorrência
              </button>
              <Link
                href={`/dashboard/objects/${objectId}`}
                className="text-gray-500 hover:text-gray-300 text-sm transition-colors"
              >
                Acompanhar atividade do objeto
              </Link>
            </>
          ) : (
            <>
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
            </>
          )}
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
