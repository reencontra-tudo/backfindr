"use client";

import { Clock, ArrowRight, Mail } from "lucide-react";
import Link from "next/link";

export default function CheckoutPendingPage() {
  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="flex justify-center">
          <div className="w-20 h-20 bg-yellow-500/20 rounded-full flex items-center justify-center">
            <Clock className="w-10 h-10 text-yellow-400" />
          </div>
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-white">Pagamento em processamento</h1>
          <p className="text-gray-400">
            Recebemos seu pedido! Agora estamos aguardando a confirmação do banco.
          </p>
        </div>

        <div className="bg-gray-900 border border-yellow-800/30 rounded-xl p-6 space-y-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-yellow-500/10 rounded-full flex items-center justify-center flex-shrink-0">
              <Clock className="w-5 h-5 text-yellow-400" />
            </div>
            <div className="text-left">
              <p className="text-sm font-medium text-white">Aguardando confirmação</p>
              <p className="text-xs text-gray-400 mt-0.5">
                Pagamentos via Pix costumam ser confirmados em até 5 minutos. Não se preocupe se o dinheiro já saiu da sua conta, o sistema processará automaticamente.
              </p>
            </div>
          </div>
          
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-emerald-500/10 rounded-full flex items-center justify-center flex-shrink-0">
              <Mail className="w-5 h-5 text-emerald-400" />
            </div>
            <div className="text-left">
              <p className="text-sm font-medium text-white">Aviso por E-mail</p>
              <p className="text-xs text-gray-400 mt-0.5">
                Enviaremos uma confirmação para o seu e-mail assim que o plano for ativado.
              </p>
            </div>
          </div>
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
