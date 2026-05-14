"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, Loader2, CheckCircle2, Truck,
  Upload, Camera, FileText, Car, Clock
} from "lucide-react";
import Cookies from "js-cookie";

type VeiculoTipo = "moto" | "carro" | "van" | "bicicleta";

const VEICULO_LABELS: Record<VeiculoTipo, string> = {
  moto: "🏍️ Moto",
  carro: "🚗 Carro",
  van: "🚐 Van",
  bicicleta: "🚲 Bicicleta",
};

interface FileUpload {
  file: File | null;
  preview: string;
  uploading: boolean;
  url: string;
  error: string;
}

function FileField({
  label, icon, value, onChange, accept
}: {
  label: string;
  icon: React.ReactNode;
  value: FileUpload;
  onChange: (v: FileUpload) => void;
  accept: string;
}) {
  const ref = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    const preview = URL.createObjectURL(file);
    onChange({ file, preview, uploading: true, url: "", error: "" });

    try {
      const token = Cookies.get("access_token");
      const formData = new FormData();
      formData.append("file", file);
      formData.append("folder", "entregadores");

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      const res = await fetch("/api/v1/delivery/entregador/upload", {
        signal: controller.signal,
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      if (!res.ok) throw new Error("Falha no upload");
      const data = await res.json();
      onChange({ file, preview, uploading: false, url: data.url ?? data.urls?.[0] ?? "", error: "" });
    } catch {
      onChange({ file, preview, uploading: false, url: "", error: "Erro no upload. Tente novamente." });
    }
  };

  return (
    <div>
      <label className="text-white/50 text-xs mb-1.5 block">{label}</label>
      <div
        onClick={() => ref.current?.click()}
        className={`relative flex items-center gap-3 px-4 py-3 border rounded-xl cursor-pointer transition-all ${
          value.url
            ? "border-teal-500/40 bg-teal-500/[0.06]"
            : "border-white/[0.08] bg-white/[0.04] hover:border-white/20"
        }`}
      >
        <input
          ref={ref}
          type="file"
          accept={accept}
          className="hidden"
          onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}
        />
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
          value.url ? "bg-teal-500/20" : "bg-white/[0.06]"
        }`}>
          {value.uploading
            ? <Loader2 className="w-4 h-4 text-white/40 animate-spin" />
            : value.url
              ? <CheckCircle2 className="w-4 h-4 text-teal-400" />
              : icon}
        </div>
        <div className="flex-1 min-w-0">
          {value.url ? (
            <p className="text-teal-300 text-sm font-medium">Enviado com sucesso</p>
          ) : value.uploading ? (
            <p className="text-white/40 text-sm">Enviando...</p>
          ) : (
            <p className="text-white/40 text-sm">Clique para selecionar</p>
          )}
          {value.error && <p className="text-red-400 text-xs mt-0.5">{value.error}</p>}
        </div>
        {value.preview && !value.uploading && (
          <img src={value.preview} alt="" className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
        )}
      </div>
    </div>
  );
}

const emptyFile = (): FileUpload => ({ file: null, preview: "", uploading: false, url: "", error: "" });

export default function EntregadorCadastroPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    nome: "",
    phone: "",
    veiculo_tipo: "" as VeiculoTipo | "",
    veiculo_placa: "",
  });
  const [cnh, setCnh] = useState<FileUpload>(emptyFile());
  const [veiculoDoc, setVeiculoDoc] = useState<FileUpload>(emptyFile());
  const [selfie, setSelfie] = useState<FileUpload>(emptyFile());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [jaEntregador, setJaEntregador] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const token = Cookies.get("access_token");
    if (!token) { setChecking(false); return; }
    fetch("/api/v1/delivery/entregador/perfil", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => { if (r.ok) setJaEntregador(true); })
      .catch(() => {})
      .finally(() => setChecking(false));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!form.nome || !form.phone || !form.veiculo_tipo) {
      setError("Nome, telefone e tipo de veículo são obrigatórios.");
      return;
    }
    if (cnh.uploading || veiculoDoc.uploading || selfie.uploading) {
      setError("Aguarde o upload dos documentos terminar.");
      return;
    }

    setLoading(true);
    try {
      const token = Cookies.get("access_token");
      const res = await fetch("/api/v1/delivery/entregador/cadastro", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...form,
          cnh_url: cnh.url || null,
          veiculo_doc_url: veiculoDoc.url || null,
          selfie_url: selfie.url || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.detail ?? "Erro ao cadastrar.");
        return;
      }
      setSuccess(true);
    } catch {
      setError("Erro de conexão. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  if (checking) {
    return (
      <div className="min-h-screen bg-[#080b0f] flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-teal-400 animate-spin" />
      </div>
    );
  }

  if (jaEntregador) {
    return (
      <div className="min-h-screen bg-[#080b0f] flex items-center justify-center p-6">
        <div className="text-center space-y-5 max-w-sm">
          <div className="w-16 h-16 rounded-2xl bg-teal-500/15 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-8 h-8 text-teal-400" />
          </div>
          <div>
            <h2 className="text-white font-bold text-xl">Você já é entregador!</h2>
            <p className="text-white/40 text-sm mt-1">Acesse o painel para ver as entregas.</p>
          </div>
          <Link href="/delivery/entregador/painel"
            className="inline-flex items-center gap-2 bg-teal-500 text-white text-sm font-bold px-6 py-3 rounded-xl">
            <Truck className="w-4 h-4" /> Ir para o painel
          </Link>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-[#080b0f] flex items-center justify-center p-6">
        <div className="text-center space-y-5 max-w-sm">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/15 flex items-center justify-center mx-auto">
            <Clock className="w-8 h-8 text-amber-400" />
          </div>
          <div>
            <h2 className="text-white font-bold text-xl">Cadastro enviado!</h2>
            <p className="text-white/40 text-sm mt-1 leading-relaxed">
              Seus documentos foram recebidos e estão em análise.
              Você receberá uma notificação assim que for aprovado.
            </p>
          </div>
          <Link href="/dashboard"
            className="inline-flex items-center gap-2 border border-white/[0.10] text-white/60 text-sm font-medium px-6 py-3 rounded-xl hover:border-white/20 transition-colors">
            Voltar ao dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#080b0f] flex flex-col">
      <nav className="border-b border-white/[0.06] px-5 h-14 flex items-center justify-between flex-shrink-0">
        <Link href="/dashboard/delivery" className="flex items-center gap-2 text-white/40 hover:text-white transition-colors">
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm">Voltar</span>
        </Link>
        <span className="text-white/40 text-sm">Cadastro de Entregador</span>
      </nav>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-sm mx-auto p-6 space-y-6">

          <div>
            <h1 className="text-white font-bold text-2xl">Seja um entregador</h1>
            <p className="text-white/40 text-sm mt-1">
              Preencha seus dados e envie os documentos para análise.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">

            {/* Dados pessoais */}
            <div className="space-y-3">
              <p className="text-white/40 text-xs font-mono uppercase tracking-wider">Dados pessoais</p>
              <div>
                <label className="text-white/50 text-xs mb-1.5 block">Nome completo *</label>
                <input
                  value={form.nome}
                  onChange={e => setForm(f => ({ ...f, nome: e.target.value }))}
                  placeholder="João Silva"
                  className="w-full px-4 py-3 bg-white/[0.04] border border-white/[0.08] rounded-xl text-white text-sm placeholder-white/20 focus:outline-none focus:border-teal-500/40"
                />
              </div>
              <div>
                <label className="text-white/50 text-xs mb-1.5 block">WhatsApp *</label>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                  placeholder="(11) 99999-0000"
                  className="w-full px-4 py-3 bg-white/[0.04] border border-white/[0.08] rounded-xl text-white text-sm placeholder-white/20 focus:outline-none focus:border-teal-500/40"
                />
              </div>
            </div>

            {/* Veículo */}
            <div className="space-y-3">
              <p className="text-white/40 text-xs font-mono uppercase tracking-wider">Veículo</p>
              <div className="grid grid-cols-2 gap-2">
                {(Object.keys(VEICULO_LABELS) as VeiculoTipo[]).map(tipo => (
                  <button
                    key={tipo}
                    type="button"
                    onClick={() => setForm(f => ({ ...f, veiculo_tipo: tipo }))}
                    className={`py-2.5 rounded-xl text-sm font-medium transition-all border ${
                      form.veiculo_tipo === tipo
                        ? "bg-teal-500/10 border-teal-500/40 text-teal-300"
                        : "bg-white/[0.03] border-white/[0.08] text-white/40 hover:border-white/20"
                    }`}
                  >
                    {VEICULO_LABELS[tipo]}
                  </button>
                ))}
              </div>
              {form.veiculo_tipo && form.veiculo_tipo !== "bicicleta" && (
                <div>
                  <label className="text-white/50 text-xs mb-1.5 block">Placa do veículo</label>
                  <input
                    value={form.veiculo_placa}
                    onChange={e => setForm(f => ({ ...f, veiculo_placa: e.target.value.toUpperCase() }))}
                    placeholder="ABC-1234"
                    maxLength={8}
                    className="w-full px-4 py-3 bg-white/[0.04] border border-white/[0.08] rounded-xl text-white text-sm placeholder-white/20 focus:outline-none focus:border-teal-500/40 uppercase font-mono"
                  />
                </div>
              )}
            </div>

            {/* Documentos */}
            <div className="space-y-3">
              <p className="text-white/40 text-xs font-mono uppercase tracking-wider">Documentos</p>
              <FileField
                label="CNH (frente)"
                icon={<FileText className="w-4 h-4 text-white/30" />}
                value={cnh}
                onChange={setCnh}
                accept="image/*,.pdf"
              />
              <FileField
                label="Documento do veículo (CRLV)"
                icon={<Car className="w-4 h-4 text-white/30" />}
                value={veiculoDoc}
                onChange={setVeiculoDoc}
                accept="image/*,.pdf"
              />
              <FileField
                label="Selfie segurando a CNH"
                icon={<Camera className="w-4 h-4 text-white/30" />}
                value={selfie}
                onChange={setSelfie}
                accept="image/*"
              />
              <p className="text-white/20 text-xs">
                Documentos são usados apenas para verificação de identidade e ficam protegidos.
              </p>
            </div>

            {error && (
              <p className="text-red-400 text-xs bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading || cnh.uploading || veiculoDoc.uploading || selfie.uploading}
              className="w-full py-3.5 bg-teal-500 hover:bg-teal-400 disabled:opacity-50 rounded-xl text-white text-sm font-bold transition-all flex items-center justify-center gap-2"
            >
              {loading
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Enviando...</>
                : "Enviar para análise"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
