"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2, CheckCircle2, Copy, Search, Clock } from "lucide-react";
import Cookies from "js-cookie";

interface EnderecoSalvo {
  endereco_destino: string;
  destinatario_nome: string;
}

export default function NovaEntregaPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    destinatario_nome: "",
    destinatario_phone: "",
    entregador_phone: "",
    cep: "",
    logradouro: "",
    numero: "",
    complemento: "",
    bairro: "",
    cidade: "",
    estado: "",
  });
  const [cepLoading, setCepLoading] = useState(false);
  const [cepError, setCepError] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [resultado, setResultado] = useState<{ token: string } | null>(null);
  const [historico, setHistorico] = useState<EnderecoSalvo[]>([]);

  // Buscar histórico de entregas anteriores
  useEffect(() => {
    const token = Cookies.get("access_token");
    if (!token) return;
    fetch("/api/v1/delivery/minhas-entregas", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.ok ? r.json() : { items: [] })
      .then(d => {
        const items: EnderecoSalvo[] = (d.items ?? [])
          .filter((e: EnderecoSalvo) => e.endereco_destino)
          .slice(0, 5);
        setHistorico(items);
      })
      .catch(() => {});
  }, []);

  // Buscar CEP via ViaCEP
  const buscarCep = async (cep: string) => {
    const limpo = cep.replace(/\D/g, "");
    if (limpo.length !== 8) return;
    setCepLoading(true);
    setCepError("");
    try {
      const res = await fetch(`https://viacep.com.br/ws/${limpo}/json/`);
      const data = await res.json();
      if (data.erro) {
        setCepError("CEP não encontrado.");
        return;
      }
      setForm(f => ({
        ...f,
        logradouro: data.logradouro ?? "",
        bairro: data.bairro ?? "",
        cidade: data.localidade ?? "",
        estado: data.uf ?? "",
      }));
    } catch {
      setCepError("Erro ao buscar CEP. Tente novamente.");
    } finally {
      setCepLoading(false);
    }
  };

  const enderecoCompleto = [
    form.logradouro,
    form.numero ? `${form.numero}` : "",
    form.complemento,
    form.bairro,
    form.cidade,
    form.estado,
  ].filter(Boolean).join(", ");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!form.destinatario_nome || !form.destinatario_phone) {
      setError("Preencha nome e telefone do destinatário.");
      return;
    }
    if (!enderecoCompleto) {
      setError("Informe o endereço de entrega.");
      return;
    }

    setLoading(true);
    try {
      const token = Cookies.get("access_token");
      const res = await fetch("/api/v1/delivery/minhas-entregas", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          destinatario_nome: form.destinatario_nome,
          destinatario_phone: form.destinatario_phone,
          endereco_destino: enderecoCompleto,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.detail ?? "Erro ao criar entrega.");
        return;
      }

      setResultado({ token: data.token });
    } catch {
      setError("Erro de conexão. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  const usarEnderecoHistorico = (item: EnderecoSalvo) => {
    setForm(f => ({
      ...f,
      destinatario_nome: item.destinatario_nome,
      logradouro: item.endereco_destino,
      numero: "",
      complemento: "",
      bairro: "",
      cidade: "",
      estado: "",
      cep: "",
    }));
  };

  if (resultado) {
    const link = typeof window !== "undefined"
      ? `${window.location.origin}/delivery/${resultado.token}`
      : `/delivery/${resultado.token}`;

    return (
      <div className="p-6 md:p-8 max-w-lg">
        <div className="text-center space-y-5">
          <div className="w-16 h-16 rounded-2xl bg-teal-500/15 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-8 h-8 text-teal-400" />
          </div>
          <div>
            <h2 className="text-white font-bold text-xl">Entrega criada!</h2>
            <p className="text-white/40 text-sm mt-1">Compartilhe o link de rastreio com o destinatário.</p>
          </div>

          <div className="bg-white/[0.04] border border-white/[0.08] rounded-xl p-4 text-left">
            <p className="text-white/40 text-xs mb-2">Link de rastreio</p>
            <div className="flex items-center gap-2">
              <p className="text-teal-400 text-sm font-mono flex-1 truncate">{link}</p>
              <button
                onClick={() => navigator.clipboard.writeText(link)}
                className="flex-shrink-0 text-white/30 hover:text-white/60 transition-colors"
              >
                <Copy className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="flex gap-3">
            <Link href="/dashboard/delivery"
              className="flex-1 py-3 border border-white/[0.10] rounded-xl text-white/60 text-sm font-semibold hover:border-white/20 transition-colors text-center">
              Ver entregas
            </Link>
            <Link href={`/delivery/${resultado.token}`}
              className="flex-1 py-3 bg-teal-500 hover:bg-teal-400 rounded-xl text-white text-sm font-bold transition-colors text-center">
              Acompanhar
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 max-w-lg space-y-6">

      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/dashboard/delivery" className="text-white/30 hover:text-white transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-white font-bold text-xl">Nova entrega</h1>
          <p className="text-white/30 text-sm mt-0.5">Informe os dados do destinatário</p>
        </div>
      </div>

      {/* Histórico de endereços */}
      {historico.length > 0 && (
        <div>
          <p className="text-white/40 text-xs font-mono uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Clock className="w-3 h-3" /> Entregas recentes
          </p>
          <div className="space-y-1.5">
            {historico.map((item, i) => (
              <button key={i} onClick={() => usarEnderecoHistorico(item)}
                className="w-full text-left px-3 py-2.5 bg-white/[0.03] border border-white/[0.06] hover:border-white/[0.15] rounded-xl transition-all">
                <p className="text-white/60 text-sm truncate">{item.destinatario_nome}</p>
                <p className="text-white/30 text-xs truncate">{item.endereco_destino}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Formulário */}
      <form onSubmit={handleSubmit} className="space-y-4">

        {/* Destinatário */}
        <div className="space-y-3">
          <p className="text-white/40 text-xs font-mono uppercase tracking-wider">Destinatário</p>

          <div>
            <label className="text-white/50 text-xs mb-1.5 block">Nome *</label>
            <input
              value={form.destinatario_nome}
              onChange={e => setForm(f => ({ ...f, destinatario_nome: e.target.value }))}
              placeholder="João Silva"
              className="w-full px-4 py-3 bg-white/[0.04] border border-white/[0.08] rounded-xl text-white text-sm placeholder-white/20 focus:outline-none focus:border-teal-500/40"
            />
          </div>

          <div>
            <label className="text-white/50 text-xs mb-1.5 block">WhatsApp *</label>
            <input
              type="tel"
              value={form.destinatario_phone}
              onChange={e => setForm(f => ({ ...f, destinatario_phone: e.target.value }))}
              placeholder="(11) 99999-0000"
              className="w-full px-4 py-3 bg-white/[0.04] border border-white/[0.08] rounded-xl text-white text-sm placeholder-white/20 focus:outline-none focus:border-teal-500/40"
            />
          </div>
        </div>

        <div>
          <label className="text-white/50 text-xs mb-1.5 block">WhatsApp do entregador</label>
          <input
            type="tel"
            value={form.entregador_phone}
            onChange={e => setForm(f => ({ ...f, entregador_phone: e.target.value }))}
            placeholder="(11) 99999-0000 — opcional"
            className="w-full px-4 py-3 bg-white/[0.04] border border-white/[0.08] rounded-xl text-white text-sm placeholder-white/20 focus:outline-none focus:border-teal-500/40"
          />
          <p className="text-white/20 text-xs mt-1">O entregador precisa estar cadastrado na plataforma.</p>
        </div>

        {/* Endereço via CEP */}
        <div className="space-y-3">
          <p className="text-white/40 text-xs font-mono uppercase tracking-wider">Endereço de entrega</p>

          {/* CEP */}
          <div>
            <label className="text-white/50 text-xs mb-1.5 block">CEP</label>
            <div className="relative">
              <input
                value={form.cep}
                onChange={e => {
                  const v = e.target.value.replace(/\D/g, "").substring(0, 8);
                  const fmt = v.length > 5 ? `${v.slice(0, 5)}-${v.slice(5)}` : v;
                  setForm(f => ({ ...f, cep: fmt }));
                  if (v.length === 8) buscarCep(v);
                }}
                placeholder="00000-000"
                className="w-full pl-4 pr-10 py-3 bg-white/[0.04] border border-white/[0.08] rounded-xl text-white text-sm placeholder-white/20 focus:outline-none focus:border-teal-500/40"
              />
              <div className="absolute right-3 top-3">
                {cepLoading
                  ? <Loader2 className="w-4 h-4 text-white/30 animate-spin" />
                  : <Search className="w-4 h-4 text-white/20" />}
              </div>
            </div>
            {cepError && <p className="text-red-400 text-xs mt-1">{cepError}</p>}
          </div>

          {/* Campos preenchidos pelo CEP */}
          <div>
            <label className="text-white/50 text-xs mb-1.5 block">Rua / Logradouro</label>
            <input
              value={form.logradouro}
              onChange={e => setForm(f => ({ ...f, logradouro: e.target.value }))}
              placeholder="Rua das Flores"
              className="w-full px-4 py-3 bg-white/[0.04] border border-white/[0.08] rounded-xl text-white text-sm placeholder-white/20 focus:outline-none focus:border-teal-500/40"
            />
          </div>

          <div className="flex gap-3">
            <div className="w-28">
              <label className="text-white/50 text-xs mb-1.5 block">Número</label>
              <input
                value={form.numero}
                onChange={e => setForm(f => ({ ...f, numero: e.target.value }))}
                placeholder="123"
                className="w-full px-4 py-3 bg-white/[0.04] border border-white/[0.08] rounded-xl text-white text-sm placeholder-white/20 focus:outline-none focus:border-teal-500/40"
              />
            </div>
            <div className="flex-1">
              <label className="text-white/50 text-xs mb-1.5 block">Complemento</label>
              <input
                value={form.complemento}
                onChange={e => setForm(f => ({ ...f, complemento: e.target.value }))}
                placeholder="Apto 42, Bloco B"
                className="w-full px-4 py-3 bg-white/[0.04] border border-white/[0.08] rounded-xl text-white text-sm placeholder-white/20 focus:outline-none focus:border-teal-500/40"
              />
            </div>
          </div>

          <div className="flex gap-3">
            <div className="flex-1">
              <label className="text-white/50 text-xs mb-1.5 block">Cidade</label>
              <input
                value={form.cidade}
                onChange={e => setForm(f => ({ ...f, cidade: e.target.value }))}
                placeholder="São Paulo"
                className="w-full px-4 py-3 bg-white/[0.04] border border-white/[0.08] rounded-xl text-white text-sm placeholder-white/20 focus:outline-none focus:border-teal-500/40"
              />
            </div>
            <div className="w-20">
              <label className="text-white/50 text-xs mb-1.5 block">Estado</label>
              <input
                value={form.estado}
                onChange={e => setForm(f => ({ ...f, estado: e.target.value }))}
                placeholder="SP"
                maxLength={2}
                className="w-full px-4 py-3 bg-white/[0.04] border border-white/[0.08] rounded-xl text-white text-sm placeholder-white/20 focus:outline-none focus:border-teal-500/40 uppercase"
              />
            </div>
          </div>

          {/* Preview do endereço */}
          {enderecoCompleto && (
            <div className="bg-teal-500/[0.06] border border-teal-500/20 rounded-xl px-4 py-3">
              <p className="text-white/40 text-xs mb-1">Endereço completo</p>
              <p className="text-teal-300 text-sm">{enderecoCompleto}</p>
            </div>
          )}
        </div>

        {error && (
          <p className="text-red-400 text-xs bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3.5 bg-teal-500 hover:bg-teal-400 disabled:opacity-50 rounded-xl text-white text-sm font-bold transition-all flex items-center justify-center gap-2"
        >
          {loading
            ? <><Loader2 className="w-4 h-4 animate-spin" /> Criando entrega...</>
            : "Criar entrega"}
        </button>
      </form>
    </div>
  );
}
