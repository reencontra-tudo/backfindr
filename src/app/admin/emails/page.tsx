'use client';
import { useEffect, useState } from 'react';
import { Mail, Send, Users, CheckCircle2, Eye, RefreshCw, Plus, X, AlertCircle } from 'lucide-react';
import { api, parseApiError } from '@/lib/api';
import { toast } from 'sonner';

interface Campaign {
  id: string; type: string; subject: string; status: string;
  sent_count: number; failed_count: number; created_at: string; sent_at?: string;
}
interface Stats { total_users: number; resend_connected: boolean; }

const TEMPLATE_WEBJETOS = `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;background:#0a0f1a;color:#fff;padding:32px;border-radius:16px">
  <h2 style="color:#14b8a6;margin-bottom:8px">Olá, {{name}}!</h2>
  <p style="color:rgba(255,255,255,0.7);line-height:1.6">Você tem objetos registrados no Webjetos que agora fazem parte do <strong>Backfindr</strong> — a plataforma mais completa para recuperar itens perdidos no Brasil.</p>
  <p style="color:rgba(255,255,255,0.7);line-height:1.6">Acesse sua conta e veja se algum dos seus objetos foi encontrado.</p>
  <a href="https://backfindr.com/dashboard" style="display:inline-block;background:#14b8a6;color:#fff;padding:12px 24px;border-radius:10px;text-decoration:none;font-weight:600;margin-top:16px">Acessar minha conta →</a>
</div>`;

const STATUS_STYLE: Record<string, string> = {
  sent:    'text-green-400 bg-green-500/10 border-green-500/20',
  sending: 'text-teal-400 bg-teal-500/10 border-teal-500/20',
  failed:  'text-red-400 bg-red-500/10 border-red-500/20',
  draft:   'text-white/30 bg-white/[0.04] border-white/[0.08]',
};
const STATUS_LABEL: Record<string, string> = {
  sent: 'Enviado', sending: 'Enviando', failed: 'Falhou', draft: 'Rascunho',
};
const TYPE_LABEL: Record<string, string> = {
  webjetos_reativacao: 'Reativação Webjetos',
  custom: 'Personalizado',
  transacional: 'Transacional',
};

export default function AdminEmails() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [stats, setStats] = useState<Stats>({ total_users: 0, resend_connected: false });
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [sending, setSending] = useState(false);

  // Form state
  const [type, setType] = useState<'webjetos_reativacao' | 'custom' | 'transacional'>('webjetos_reativacao');
  const [subject, setSubject] = useState('');
  const [bodyHtml, setBodyHtml] = useState('');
  const [filterPlan, setFilterPlan] = useState('');
  const [filterLegacy, setFilterLegacy] = useState(false);
  const [testEmail, setTestEmail] = useState('');
  const [limit, setLimit] = useState(50);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/admin/emails');
      setCampaigns(data.campaigns ?? []);
      setStats(data.stats ?? { total_users: 0, resend_connected: false });
    } catch {
      toast.error('Erro ao carregar campanhas');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (type === 'webjetos_reativacao') {
      setSubject('Seus objetos do Webjetos estão no Backfindr');
      setBodyHtml(TEMPLATE_WEBJETOS);
      setFilterLegacy(true);
    } else {
      setSubject('');
      setBodyHtml('');
      setFilterLegacy(false);
    }
  }, [type]);

  const handleSend = async (isTest: boolean) => {
    if (!subject.trim() || !bodyHtml.trim()) { toast.error('Preencha o assunto e o corpo'); return; }
    if (isTest && !testEmail.trim()) { toast.error('Informe um e-mail para o teste'); return; }
    setSending(true);
    try {
      const payload: Record<string, unknown> = {
        type, subject, body_html: bodyHtml, limit,
        filter: {
          ...(filterPlan ? { plan: filterPlan } : {}),
          ...(filterLegacy ? { is_legacy: true } : {}),
        },
      };
      if (isTest) payload.test_email = testEmail;
      const { data } = await api.post('/admin/emails', payload);
      toast.success(isTest
        ? `Teste enviado para ${testEmail}`
        : `Campanha enviada: ${data.sent} enviados, ${data.failed} falhas`
      );
      setShowForm(false);
      load();
    } catch (e) {
      toast.error(parseApiError(e));
    } finally {
      setSending(false);
    }
  };

  const totalSent = campaigns.reduce((a, c) => a + (c.sent_count ?? 0), 0);
  const totalFailed = campaigns.reduce((a, c) => a + (c.failed_count ?? 0), 0);

  return (
    <div className="p-5 md:p-7 max-w-7xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-white text-xl font-bold tracking-tight">E-mails</h1>
          <p className="text-white/25 text-xs mt-0.5">Campanhas e comunicações</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} disabled={loading}
            className="w-9 h-9 flex items-center justify-center bg-white/[0.04] hover:bg-white/[0.07] border border-white/[0.07] rounded-xl text-white/40 hover:text-white transition-all disabled:opacity-40">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button onClick={() => setShowForm(true)}
            className="flex items-center gap-2 bg-teal-500 hover:bg-teal-400 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-all">
            <Plus className="w-4 h-4" /> Nova campanha
          </button>
        </div>
      </div>

      {/* Aviso Resend */}
      {!stats.resend_connected && (
        <div className="flex items-center gap-3 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-xl text-yellow-400 text-xs">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>Resend não configurado — adicione <code className="font-mono bg-yellow-500/10 px-1 rounded">RESEND_API_KEY</code> na Vercel para enviar e-mails reais.</span>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Usuários cadastrados', value: stats.total_users.toLocaleString('pt-BR'), icon: Users,        color: 'text-blue-400 bg-blue-500/10' },
          { label: 'Total enviados',       value: totalSent.toLocaleString('pt-BR'),         icon: Send,         color: 'text-white/50 bg-white/[0.06]' },
          { label: 'Campanhas',            value: campaigns.length,                          icon: Mail,         color: 'text-teal-400 bg-teal-500/10' },
          { label: 'Falhas de envio',      value: totalFailed,                               icon: AlertCircle,  color: totalFailed > 0 ? 'text-red-400 bg-red-500/10' : 'text-white/20 bg-white/[0.04]' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-4">
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center mb-3 ${color}`}>
              <Icon className="w-4 h-4" />
            </div>
            <p className="text-xl font-bold text-white">{value}</p>
            <p className="text-white/25 text-xs mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Lista de campanhas */}
      <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-white/[0.06]">
          <h3 className="text-white font-semibold text-sm">Histórico de campanhas</h3>
        </div>
        {loading ? (
          <div className="p-5 space-y-3">
            {[1,2,3].map(i => <div key={i} className="h-14 bg-white/[0.03] rounded-xl animate-pulse" />)}
          </div>
        ) : campaigns.length === 0 ? (
          <div className="py-16 text-center">
            <Mail className="w-8 h-8 text-white/10 mx-auto mb-2" />
            <p className="text-white/20 text-sm">Nenhuma campanha enviada ainda</p>
            <button onClick={() => setShowForm(true)}
              className="mt-4 text-teal-400/60 hover:text-teal-400 text-xs underline transition-colors">
              Criar primeira campanha
            </button>
          </div>
        ) : (
          <div className="divide-y divide-white/[0.04]">
            {campaigns.map(c => {
              const date = new Date(c.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: '2-digit' });
              return (
                <div key={c.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-white/[0.02] transition-colors">
                  <div className="flex-1 min-w-0">
                    <p className="text-white/75 text-sm font-medium truncate">{c.subject}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-white/25 text-xs">{TYPE_LABEL[c.type] ?? c.type}</span>
                      <span className="text-white/10">·</span>
                      <span className="text-white/20 text-xs">{date}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 flex-shrink-0">
                    <div className="text-right hidden sm:block">
                      <p className="text-white/50 text-sm font-semibold">{(c.sent_count ?? 0).toLocaleString('pt-BR')}</p>
                      <p className="text-white/20 text-[10px]">enviados</p>
                    </div>
                    {(c.failed_count ?? 0) > 0 && (
                      <div className="text-right hidden sm:block">
                        <p className="text-red-400 text-sm font-semibold">{c.failed_count}</p>
                        <p className="text-white/20 text-[10px]">falhas</p>
                      </div>
                    )}
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${STATUS_STYLE[c.status] ?? STATUS_STYLE.draft}`}>
                      {STATUS_LABEL[c.status] ?? c.status}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal: Nova campanha */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-[#0d1420] border border-white/[0.1] rounded-3xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-white font-bold text-base">Nova campanha</h3>
              <button onClick={() => setShowForm(false)} className="text-white/30 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div>
              <label className="text-white/40 text-xs font-medium block mb-1.5">Tipo</label>
              <select value={type} onChange={e => setType(e.target.value as typeof type)}
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2.5 text-white text-sm outline-none focus:border-teal-500/40 transition-all">
                <option value="webjetos_reativacao">Reativação Webjetos</option>
                <option value="custom">Personalizado</option>
                <option value="transacional">Transacional</option>
              </select>
            </div>

            <div>
              <label className="text-white/40 text-xs font-medium block mb-1.5">Assunto</label>
              <input value={subject} onChange={e => setSubject(e.target.value)}
                placeholder="Assunto do e-mail..."
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2.5 text-white text-sm placeholder-white/20 outline-none focus:border-teal-500/40 transition-all" />
            </div>

            <div>
              <label className="text-white/40 text-xs font-medium block mb-1.5">Corpo HTML — use {'{{name}}'} para personalizar</label>
              <textarea value={bodyHtml} onChange={e => setBodyHtml(e.target.value)}
                rows={6} placeholder="<html>...</html>"
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2.5 text-white text-xs font-mono placeholder-white/20 outline-none focus:border-teal-500/40 transition-all resize-none" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-white/40 text-xs font-medium block mb-1.5">Filtrar por plano</label>
                <select value={filterPlan} onChange={e => setFilterPlan(e.target.value)}
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2.5 text-white text-sm outline-none focus:border-teal-500/40 transition-all">
                  <option value="">Todos os planos</option>
                  <option value="free">Free</option>
                  <option value="pro">Pro</option>
                  <option value="business">Business</option>
                </select>
              </div>
              <div>
                <label className="text-white/40 text-xs font-medium block mb-1.5">Limite de envios</label>
                <input type="number" value={limit} onChange={e => setLimit(Number(e.target.value))} min={1} max={500}
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2.5 text-white text-sm outline-none focus:border-teal-500/40 transition-all" />
              </div>
            </div>

            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={filterLegacy} onChange={e => setFilterLegacy(e.target.checked)}
                className="w-4 h-4 rounded accent-teal-500" />
              <span className="text-white/50 text-sm">Apenas usuários Webjetos (legado)</span>
            </label>

            <div className="border-t border-white/[0.06] pt-4">
              <label className="text-white/40 text-xs font-medium block mb-1.5">E-mail de teste (opcional)</label>
              <div className="flex gap-2">
                <input value={testEmail} onChange={e => setTestEmail(e.target.value)}
                  placeholder="seu@email.com"
                  className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2.5 text-white text-sm placeholder-white/20 outline-none focus:border-teal-500/40 transition-all" />
                <button onClick={() => handleSend(true)} disabled={sending || !testEmail}
                  className="px-4 py-2.5 bg-white/[0.06] hover:bg-white/[0.10] border border-white/[0.08] rounded-xl text-white/60 hover:text-white text-sm transition-all disabled:opacity-40">
                  Testar
                </button>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button onClick={() => setShowForm(false)}
                className="flex-1 py-2.5 bg-white/[0.04] hover:bg-white/[0.07] border border-white/[0.08] rounded-xl text-white/50 hover:text-white text-sm transition-all">
                Cancelar
              </button>
              <button onClick={() => handleSend(false)} disabled={sending}
                className="flex-1 py-2.5 bg-teal-500 hover:bg-teal-400 text-white text-sm font-semibold rounded-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                {sending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                {sending ? 'Enviando...' : `Enviar para ${limit} usuários`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
