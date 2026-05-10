'use client';
import { useState } from 'react';
import {
  FileDown, FileText, Users, Package, Megaphone,
  Calendar, Filter, ChevronDown, Loader2, CheckCircle2
} from 'lucide-react';
import Cookies from 'js-cookie';

// ── Types ─────────────────────────────────────────────────────────────────────
type ReportType = 'objects' | 'users' | 'publications';
type ExportFormat = 'csv' | 'pdf';

interface Filters {
  category: string;
  status: string;
  plan: string;
  date_from: string;
  date_to: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────
const CATEGORIES = [
  { value: '', label: 'Todas as categorias' },
  { value: 'phone', label: 'Celular' },
  { value: 'wallet', label: 'Carteira' },
  { value: 'keys', label: 'Chaves' },
  { value: 'pet', label: 'Pet' },
  { value: 'electronics', label: 'Eletrônicos' },
  { value: 'document', label: 'Documento' },
  { value: 'bike', label: 'Bicicleta' },
  { value: 'vehicle', label: 'Veículo' },
  { value: 'other', label: 'Outros' },
];

const STATUSES = [
  { value: '', label: 'Todos os status' },
  { value: 'lost', label: 'Perdido' },
  { value: 'found', label: 'Encontrado' },
  { value: 'stolen', label: 'Roubado' },
  { value: 'returned', label: 'Devolvido' },
  { value: 'protected', label: 'Protegido' },
];

const PLANS = [
  { value: '', label: 'Todos os planos' },
  { value: 'free', label: 'Free' },
  { value: 'pro', label: 'Pro' },
  { value: 'business', label: 'Business' },
  { value: 'inactive', label: 'Inativos' },
];

const REPORT_TYPES = [
  {
    id: 'objects' as ReportType,
    label: 'Objetos',
    description: 'Todos os objetos cadastrados com categoria, status, dono e boost',
    icon: Package,
    color: 'teal',
  },
  {
    id: 'users' as ReportType,
    label: 'Usuários',
    description: 'Base de usuários com plano, papel e data de cadastro',
    icon: Users,
    color: 'blue',
  },
  {
    id: 'publications' as ReportType,
    label: 'Publicações',
    description: 'Ocorrências e alertas com status, localização e matches',
    icon: Megaphone,
    color: 'purple',
  },
];

// ── Select component ──────────────────────────────────────────────────────────
function Select({
  value, onChange, options, label,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  label: string;
}) {
  return (
    <div className="relative">
      <label className="block text-[10px] text-white/30 uppercase tracking-wider mb-1.5 font-medium">{label}</label>
      <div className="relative">
        <select
          value={value}
          onChange={e => onChange(e.target.value)}
          className="w-full appearance-none bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white/80 focus:outline-none focus:border-teal-500/50 focus:bg-white/[0.06] transition-all pr-8"
        >
          {options.map(o => (
            <option key={o.value} value={o.value} className="bg-[#0d1117] text-white">
              {o.label}
            </option>
          ))}
        </select>
        <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30 pointer-events-none" />
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function RelatoriosPage() {
  const [selectedType, setSelectedType] = useState<ReportType>('objects');
  const [filters, setFilters] = useState<Filters>({
    category: '',
    status: '',
    plan: '',
    date_from: '',
    date_to: '',
  });
  const [loading, setLoading] = useState<ExportFormat | null>(null);
  const [lastExport, setLastExport] = useState<{ format: ExportFormat; type: ReportType } | null>(null);

  function setFilter(key: keyof Filters, value: string) {
    setFilters(prev => ({ ...prev, [key]: value }));
  }

  async function handleExport(format: ExportFormat) {
    setLoading(format);
    try {
      const token = Cookies.get('sb-access-token') ?? Cookies.get('access_token') ?? '';
      const params = new URLSearchParams({ type: selectedType, format });
      if (filters.category) params.set('category', filters.category);
      if (filters.status) params.set('status', filters.status);
      if (filters.plan) params.set('plan', filters.plan);
      if (filters.date_from) params.set('date_from', filters.date_from);
      if (filters.date_to) params.set('date_to', filters.date_to);

      const res = await fetch(`/api/v1/admin/reports/export?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(`Erro ao gerar relatório: ${err.error ?? res.statusText}`);
        return;
      }

      if (format === 'csv') {
        // Download CSV
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${selectedType}_${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } else {
        // Open HTML in new tab for print/save as PDF
        const html = await res.text();
        const blob = new Blob([html], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
        // Revoke after delay
        setTimeout(() => URL.revokeObjectURL(url), 30000);
      }

      setLastExport({ format, type: selectedType });
    } catch (err) {
      console.error(err);
      alert('Erro inesperado ao gerar relatório.');
    } finally {
      setLoading(null);
    }
  }

  const currentType = REPORT_TYPES.find(t => t.id === selectedType)!;

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-lg font-semibold text-white">Relatórios</h1>
        <p className="text-white/30 text-sm mt-0.5">
          Exporte dados da plataforma em CSV ou PDF com filtros personalizados
        </p>
      </div>

      {/* Report type selector */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        {REPORT_TYPES.map(rt => {
          const Icon = rt.icon;
          const active = selectedType === rt.id;
          return (
            <button
              key={rt.id}
              onClick={() => setSelectedType(rt.id)}
              className={`relative flex flex-col gap-2 p-4 rounded-xl border text-left transition-all ${
                active
                  ? 'bg-teal-500/10 border-teal-500/40 shadow-[0_0_20px_rgba(20,184,166,0.08)]'
                  : 'bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.04] hover:border-white/10'
              }`}
            >
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                active ? 'bg-teal-500/20' : 'bg-white/[0.05]'
              }`}>
                <Icon className={`w-4 h-4 ${active ? 'text-teal-400' : 'text-white/40'}`} />
              </div>
              <div>
                <div className={`text-sm font-semibold ${active ? 'text-white' : 'text-white/60'}`}>
                  {rt.label}
                </div>
                <div className="text-[11px] text-white/30 mt-0.5 leading-relaxed">
                  {rt.description}
                </div>
              </div>
              {active && (
                <div className="absolute top-3 right-3 w-2 h-2 bg-teal-400 rounded-full" />
              )}
            </button>
          );
        })}
      </div>

      {/* Filters */}
      <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4 mb-5">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="w-3.5 h-3.5 text-white/30" />
          <span className="text-xs text-white/40 font-medium uppercase tracking-wider">Filtros</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Category — only for objects */}
          {selectedType === 'objects' && (
            <Select
              label="Categoria"
              value={filters.category}
              onChange={v => setFilter('category', v)}
              options={CATEGORIES}
            />
          )}

          {/* Status — for objects and publications */}
          {(selectedType === 'objects' || selectedType === 'publications') && (
            <Select
              label="Status"
              value={filters.status}
              onChange={v => setFilter('status', v)}
              options={STATUSES}
            />
          )}

          {/* Plan — only for users */}
          {selectedType === 'users' && (
            <Select
              label="Plano"
              value={filters.plan}
              onChange={v => setFilter('plan', v)}
              options={PLANS}
            />
          )}

          {/* Date from */}
          <div>
            <label className="block text-[10px] text-white/30 uppercase tracking-wider mb-1.5 font-medium">
              Data inicial
            </label>
            <div className="relative">
              <input
                type="date"
                value={filters.date_from}
                onChange={e => setFilter('date_from', e.target.value)}
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white/80 focus:outline-none focus:border-teal-500/50 focus:bg-white/[0.06] transition-all [color-scheme:dark]"
              />
            </div>
          </div>

          {/* Date to */}
          <div>
            <label className="block text-[10px] text-white/30 uppercase tracking-wider mb-1.5 font-medium">
              Data final
            </label>
            <div className="relative">
              <input
                type="date"
                value={filters.date_to}
                onChange={e => setFilter('date_to', e.target.value)}
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white/80 focus:outline-none focus:border-teal-500/50 focus:bg-white/[0.06] transition-all [color-scheme:dark]"
              />
            </div>
          </div>
        </div>

        {/* Active filters summary */}
        {(filters.category || filters.status || filters.plan || filters.date_from || filters.date_to) && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {filters.category && (
              <span className="px-2 py-0.5 bg-teal-500/10 border border-teal-500/20 rounded-full text-[11px] text-teal-400">
                Categoria: {CATEGORIES.find(c => c.value === filters.category)?.label}
              </span>
            )}
            {filters.status && (
              <span className="px-2 py-0.5 bg-teal-500/10 border border-teal-500/20 rounded-full text-[11px] text-teal-400">
                Status: {STATUSES.find(s => s.value === filters.status)?.label}
              </span>
            )}
            {filters.plan && (
              <span className="px-2 py-0.5 bg-teal-500/10 border border-teal-500/20 rounded-full text-[11px] text-teal-400">
                Plano: {PLANS.find(p => p.value === filters.plan)?.label}
              </span>
            )}
            {filters.date_from && (
              <span className="px-2 py-0.5 bg-teal-500/10 border border-teal-500/20 rounded-full text-[11px] text-teal-400">
                De: {filters.date_from}
              </span>
            )}
            {filters.date_to && (
              <span className="px-2 py-0.5 bg-teal-500/10 border border-teal-500/20 rounded-full text-[11px] text-teal-400">
                Até: {filters.date_to}
              </span>
            )}
            <button
              onClick={() => setFilters({ category: '', status: '', plan: '', date_from: '', date_to: '' })}
              className="px-2 py-0.5 bg-white/[0.04] border border-white/[0.08] rounded-full text-[11px] text-white/30 hover:text-white/60 transition-colors"
            >
              Limpar filtros
            </button>
          </div>
        )}
      </div>

      {/* Export buttons */}
      <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4">
        <div className="flex items-center gap-2 mb-4">
          <FileDown className="w-3.5 h-3.5 text-white/30" />
          <span className="text-xs text-white/40 font-medium uppercase tracking-wider">Exportar</span>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          {/* CSV */}
          <button
            onClick={() => handleExport('csv')}
            disabled={loading !== null}
            className="flex-1 flex items-center justify-center gap-2.5 px-5 py-3 bg-teal-500/10 hover:bg-teal-500/15 border border-teal-500/25 hover:border-teal-500/40 rounded-xl text-teal-400 font-medium text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading === 'csv' ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <FileText className="w-4 h-4" />
            )}
            {loading === 'csv' ? 'Gerando CSV...' : 'Exportar CSV'}
          </button>

          {/* PDF */}
          <button
            onClick={() => handleExport('pdf')}
            disabled={loading !== null}
            className="flex-1 flex items-center justify-center gap-2.5 px-5 py-3 bg-white/[0.04] hover:bg-white/[0.06] border border-white/[0.08] hover:border-white/[0.14] rounded-xl text-white/70 hover:text-white font-medium text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading === 'pdf' ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <FileDown className="w-4 h-4" />
            )}
            {loading === 'pdf' ? 'Gerando PDF...' : 'Exportar PDF'}
          </button>
        </div>

        {/* Success feedback */}
        {lastExport && (
          <div className="mt-3 flex items-center gap-2 text-[12px] text-green-400/80">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>
              {lastExport.format === 'csv'
                ? 'CSV baixado com sucesso!'
                : 'PDF aberto em nova aba — use Ctrl+P para salvar'}
            </span>
          </div>
        )}

        {/* Help text */}
        <p className="mt-3 text-[11px] text-white/20 leading-relaxed">
          <strong className="text-white/30">CSV</strong> — planilha compatível com Excel e Google Sheets, ideal para análise de dados.
          {' '}<strong className="text-white/30">PDF</strong> — abre em nova aba com layout profissional pronto para impressão.
        </p>
      </div>

      {/* Info cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-5">
        {[
          {
            icon: Package,
            title: 'Objetos',
            desc: 'ID, título, categoria, status, dono, e-mail, plano, boost, data',
          },
          {
            icon: Users,
            title: 'Usuários',
            desc: 'ID, usuário, e-mail, plano, papel, ativo, data de cadastro',
          },
          {
            icon: Megaphone,
            title: 'Publicações',
            desc: 'ID, objeto, categoria, status, local, matches, usuário, data',
          },
        ].map(card => {
          const Icon = card.icon;
          return (
            <div key={card.title} className="p-3 bg-white/[0.015] border border-white/[0.05] rounded-lg">
              <div className="flex items-center gap-2 mb-1.5">
                <Icon className="w-3.5 h-3.5 text-white/25" />
                <span className="text-xs font-medium text-white/50">{card.title}</span>
              </div>
              <p className="text-[11px] text-white/25 leading-relaxed">{card.desc}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
