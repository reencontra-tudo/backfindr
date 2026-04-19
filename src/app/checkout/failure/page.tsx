"use client";

import { XCircle, ArrowLeft, RefreshCw } from "lucide-react";
import Link from "next/link";

export default function CheckoutFailurePage() {
  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="flex justify-center">
          <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center">
            <XCircle className="w-10 h-10 text-red-400" />
          </div>
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-white">Pagamento não concluído</h1>
          <p className="text-gray-400">
            Houve um problema ao processar seu pagamento. Nenhum valor foi cobrado.
          </p>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-left space-y-2">
          <p className="text-sm font-medium text-gray-300">Possíveis motivos:</p>
          <ul className="text-sm text-gray-500 space-y-1 list-disc list-inside">
            <li>Dados do cartão incorretos</li>
            <li>Saldo insuficiente</li>
            <li>Pagamento recusado pelo banco</li>
            <li>Tempo de sessão expirado</li>
          </ul>
        </div>

        <div className="flex flex-col gap-3">
          <Link
            href="/pricing"
            className="flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-black font-semibold py-3 px-6 rounded-xl transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Tentar novamente
          </Link>
          <Link
            href="/"
            className="flex items-center justify-center gap-2 text-gray-500 hover:text-gray-300 text-sm transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar para o início
          </Link>
        </div>
      </div>
    </div>
  );
}
