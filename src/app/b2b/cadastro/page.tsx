"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Building2, ArrowRight, Loader2, Eye, EyeOff, CheckCircle2 } from "lucide-react";
import { useAuthStore } from "@/hooks/useAuth";

export default function B2BCadastroPage() {
  const router = useRouter();
  const { login } = useAuthStore();

  const [form, setForm] = useState({
    nome: "",
    email: "",
    password: "",
    phone: "",
  });
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!form.nome || !form.email || !form.password) {
      setError("Preencha todos os campos obrigatórios.");
      return;
    }
    if (form.password.length < 8) {
      setError("Senha deve ter no mínimo 8 caracteres.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/v1/b2b/cadastro", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.detail ?? "Erro ao criar conta.");
        return;
      }

      // Login automático após cadastro
      await login(form.email, form.password);
      setSuccess(true);
      setTimeout(() => router.push("/parceiro"), 1500);
    } catch {
      setError("Erro de conexão. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-[#080b0f] flex items-center justify-center p-6">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-teal-500/15 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-8 h-8 text-teal-400" />
          </div>
          <h1 className="text-white text-xl font-bold">Conta criada!</h1>
          <p className="text-white/40 text-sm">Redirecionando para o portal...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#080b0f] flex flex-col">

      {/* Header */}
      <nav className="border-b border-white/[0.06] px-5 h-14 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-teal-500 flex items-center justify-center">
            <Building2 className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="text-white font-bold text-sm">Backfindr</span>
          <span className="text-white/30 text-xs ml-1">for Business</span>
        </Link>
        <Link href="/auth/login" className="text-white/30 hover:text-white text-xs transition-colors">
          Já tenho conta
        </Link>
      </nav>

      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-sm space-y-6">

          {/* Header */}
          <div>
            <h1 className="text-white text-2xl font-bold">Criar conta B2B</h1>
            <p className="text-white/40 text-sm mt-1">
              Acesse o portal do parceiro e gerencie objetos da sua empresa.
            </p>
          </div>

          {/* Benefícios */}
          <div className="space-y-2">
            {[
              "Portal exclusivo com objetos da sua empresa",
              "QR Codes para proteger patrimônio",
              "Relatórios de recuperação",
              "Equipe com múltiplos acessos",
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-2.5 text-sm text-white/50">
                <div className="w-1.5 h-1.5 rounded-full bg-teal-500 flex-shrink-0" />
                {item}
              </div>
            ))}
          </div>

          {/* Formulário */}
          <form onSubmit={handleSubmit} className="space-y-3">

            <div>
              <label className="text-white/50 text-xs mb-1.5 block">Nome da empresa *</label>
              <input
                value={form.nome}
                onChange={e => setForm(f => ({ ...f, nome: e.target.value }))}
                placeholder="Empresa Ltda"
                className="w-full px-4 py-3 bg-white/[0.04] border border-white/[0.08] rounded-xl text-white text-sm placeholder-white/20 focus:outline-none focus:border-teal-500/40"
              />
            </div>

            <div>
              <label className="text-white/50 text-xs mb-1.5 block">E-mail *</label>
              <input
                type="email"
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                placeholder="contato@empresa.com"
                className="w-full px-4 py-3 bg-white/[0.04] border border-white/[0.08] rounded-xl text-white text-sm placeholder-white/20 focus:outline-none focus:border-teal-500/40"
              />
            </div>

            <div>
              <label className="text-white/50 text-xs mb-1.5 block">WhatsApp</label>
              <input
                type="tel"
                value={form.phone}
                onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                placeholder="(11) 99999-0000"
                className="w-full px-4 py-3 bg-white/[0.04] border border-white/[0.08] rounded-xl text-white text-sm placeholder-white/20 focus:outline-none focus:border-teal-500/40"
              />
            </div>

            <div className="relative">
              <label className="text-white/50 text-xs mb-1.5 block">Senha *</label>
              <input
                type={showPass ? "text" : "password"}
                value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                placeholder="Mínimo 8 caracteres"
                className="w-full px-4 py-3 bg-white/[0.04] border border-white/[0.08] rounded-xl text-white text-sm placeholder-white/20 focus:outline-none focus:border-teal-500/40 pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPass(p => !p)}
                className="absolute right-3 bottom-3 text-white/30 hover:text-white/60"
              >
                {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {error && (
              <p className="text-red-400 text-xs bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 bg-teal-500 hover:bg-teal-400 disabled:opacity-50 rounded-xl text-white text-sm font-bold transition-all flex items-center justify-center gap-2 mt-2"
            >
              {loading ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Criando conta...</>
              ) : (
                <>Criar conta e acessar portal <ArrowRight className="w-4 h-4" /></>
              )}
            </button>
          </form>

          <p className="text-white/20 text-xs text-center">
            Ao criar uma conta você concorda com os{" "}
            <Link href="/terms" className="text-white/40 hover:text-white/60 transition-colors">
              Termos de Uso
            </Link>
          </p>

        </div>
      </div>
    </div>
  );
}
