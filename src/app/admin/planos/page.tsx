'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Settings, Zap, CreditCard, Save, RefreshCw, Plus, Edit2,
  ToggleLeft, ToggleRight, Eye, EyeOff, Bell, CheckCircle2,
  AlertTriangle, Package, Gift, Building2
} from 'lucide-react';
import { toast } from 'sonner';
import Cookies from 'js-cookie';

// ─── Types ────────────────────────────────────────────────────────────────────

interface PlanConfig {
  id?: number;
  slug: string;
  name: string;
  price_brl: number;
  max_objects: number;
  features: string[];
  is_active: boolean;
  stripe_price_id?: string;
  mp_plan_id?: string;
}

interface PaymentSetting {
  key: string;
  value: string;
  description: string;
  is_secret: boolean;
}

interface BoostPreview {
  day: number;
  count: number;
}

// ─── Default data ─────────────────────────────────────────────────────────────

const DEFAULT_PLANS: PlanConfig[] = [
  { slug: 'free',     name: 'Grátis',   price_brl: 0,      max_objects: 3,   features: ['3 objetos', 'QR Code permanente', 'Busca manual', 'Suporte comunidade'], is_active: true },
  { slug: 'pro',      name: 'Pro',      price_brl: 29.00,  max_objects: 50,  features: ['50 objetos', 'Matching automático', 'Notificações push e email', 'QR Code personalizado', 'Suporte por email'], is_active: true },
  { slug: 'business', name: 'Business', price_brl: 149.00, max_objects: 500, features: ['500 objetos', 'Matching prioritário', 'Notificações push, email e SMS', 'QR Code bulk', '5 usuários', 'Relatórios completos', 'API'], is_active: true },
];

const PLAN_ICONS: Record<string, React.ReactNode> = {
  free:     <Gift className="w-4 h-4" />,
  pro:      <Zap className="w-4 h-4" />,
  business: <Building2 className="w-4 h-4" />,
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function AdminPlanosPage() {
  const [tab, setTab] = useState<'plans' | 'settings' | 'boost'>('plans');
  const [plans, setPlans] = useState<PlanConfig[]>(DEFAULT_PLANS);
  const [settings, setSettings] = useState<PaymentSetting[]>([]);
  const [boostPreview, setBoostPreview] = useState<BoostPreview[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingPlan, setEditingPlan] = useState<PlanConfig | null>(null);
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
  const [settingEdits, setSettingEdits] = useState<Record<string, string>>({});
  const [boostRunning, setBoostRunning] = useState(false);

  const getToken = () => Cookies.get('access_token') ?? '';

  const fetchPlans = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/admin/plan-configs', {
        headers: { 'Authorization': `Bearer ${getToken()}` },
      });
      const data = await res.json();
      if (data.plans?.length > 0) {
        // Normalizar features: pode vir como string JSON do banco
        const normalized = data.plans.map((p: PlanConfig) => ({
          ...p,
          features: Array.isArray(p.features) ? p.features : (typeof p.features === 'string' ? JSON.parse(p.features) : []),
          price_brl: Number(p.price_brl) || 0,
          max_objects: Number(p.max_objects) || 0,
        }));
        setPlans(normalized);
      }
    } catch { /* usa defaults */ }
    finally { setLoading(false); }
  }, []);

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/admin/payment-settings', {
        headers: { 'Authorization': `Bearer ${getToken()}` },
      });
      const data = await res.json();
      if (data.settings?.length > 0) {
        setSettings(data.settings);
        const edits: Record<string, string> = {};
        data.settings.forEach((s: PaymentSetting) => { edits[s.key] = s.is_secret ? '' : s.value; });
        setSettingEdits(edits);
      }
    } catch { /* silencioso */ }
  }, []);

  const fetchBoostPreview = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/admin/boost-notifications', {
        headers: { 'Authorization': `Bearer ${getToken()}` },
      });
      const data = await res.json();
      if (data.preview) setBoostPreview(data.preview);
    } catch { /* silencioso */ }
  }, []);

  useEffect(() => {
    fetchPlans();
    fetchSettings();
    fetchBoostPreview();
  }, [fetchPlans, fetchSettings, fetchBoostPreview]);

  // ── Salvar plano ─────────────────────────────────────────────────────────────
  const savePlan = async (plan: PlanConfig) => {
    setSaving(true);
    try {
      const res = await fetch('/api/v1/admin/plan-configs', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getToken()}`,
        },
        body: JSON.stringify(plan),
      });
      const data = await res.json();
      if (data.plan) {
        setPlans(prev => prev.map(p => p.slug === plan.slug ? { ...p, ...data.plan } : p));
        toast.success('Plano atualizado!');
        setEditingPlan(null);
      } else {
        toast.error(data.error || 'Erro ao salvar plano');
      }
    } catch {
      toast.error('Erro de conexão');
    } finally {
      setSaving(false);
    }
  };

  // ── Salvar configurações ─────────────────────────────────────────────────────
  const saveSettings = async () => {
    setSaving(true);
    try {
      const updates = Object.entries(settingEdits)
        .filter(([, v]) => v !== '')
        .map(([key, value]) => ({ key, value }));

      const res = await fetch('/api/v1/admin/payment-settings', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getToken()}`,
        },
        body: JSON.stringify({ updates }),
      });
      const data = await res.json();
      if (data.results) {
        toast.success('Configurações salvas!');
        fetchSettings();
      } else {
        toast.error(data.error || 'Erro ao salvar');
      }
    } catch {
      toast.error('Erro de conexão');
    } finally {
      setSaving(false);
    }
  };

  // ── Executar job de boost ────────────────────────────────────────────────────
  const runBoostJob = async () => {
    setBoostRunning(true);
    try {
      const res = await fetch('/api/v1/admin/boost-notifications', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${getToken()}` },
      });
      const data = await res.json();
      toast.success(`${data.sent_count} notificações enviadas, ${data.skipped_count} ignoradas`);
      fetchBoostPreview();
    } catch {
      toast.error('Erro ao executar job');
    } finally {
      setBoostRunning(false);
    }
  };

  // ── Toggle plano ativo ───────────────────────────────────────────────────────
  const togglePlan = async (plan: PlanConfig) => {
    await savePlan({ ...plan, is_active: !plan.is_active });
  };

  return (
    <div className="p-6 space-y-5 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Planos & Pagamentos</h1>
          <p className="text-white/30 text-sm mt-0.5">Configure planos, preços, gateways e notificações de boost</p>
        </div>
        <button
          onClick={() => { fetchPlans(); fetchSettings(); fetchBoostPreview(); }}
          className="flex items-center gap-1.5 text-white/40 hover:text-white text-sm transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Atualizar
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-white/5 rounded-xl p-1 w-fit">
        {([
          { key: 'plans',    label: 'Planos',         icon: <Package className="w-3.5 h-3.5" /> },
          { key: 'settings', label: 'Configurações',  icon: <Settings className="w-3.5 h-3.5" /> },
          { key: 'boost',    label: 'Boost / Notif.', icon: <Bell className="w-3.5 h-3.5" /> },
        ] as const).map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === t.key ? 'bg-teal-500/15 text-teal-400 border border-teal-500/20' : 'text-white/40 hover:text-white'
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Tab: Planos ─────────────────────────────────────────────────────── */}
      {tab === 'plans' && (
        <div className="space-y-4">
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="w-6 h-6 border-2 border-teal-500/30 border-t-teal-500 rounded-full animate-spin" />
            </div>
          ) : (
            plans.map(plan => (
              <div key={plan.slug} className="border border-white/[0.08] rounded-2xl bg-white/[0.02] overflow-hidden">
                {editingPlan?.slug === plan.slug ? (
                  /* ── Editor inline ── */
                  <div className="p-5 space-y-4">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="text-teal-400">{PLAN_ICONS[plan.slug]}</div>
                      <h3 className="font-semibold text-white">Editando: {plan.name}</h3>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div>
                        <label className="text-white/40 text-xs mb-1 block">Nome</label>
                        <input
                          value={editingPlan.name}
                          onChange={e => setEditingPlan({ ...editingPlan, name: e.target.value })}
                          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-teal-500/50"
                        />
                      </div>
                      <div>
                        <label className="text-white/40 text-xs mb-1 block">Preço (R$)</label>
                        <input
                          type="number"
                          step="0.01"
                          value={editingPlan.price_brl}
                          onChange={e => setEditingPlan({ ...editingPlan, price_brl: parseFloat(e.target.value) || 0 })}
                          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-teal-500/50"
                        />
                      </div>
                      <div>
                        <label className="text-white/40 text-xs mb-1 block">Máx. objetos</label>
                        <input
                          type="number"
                          value={editingPlan.max_objects}
                          onChange={e => setEditingPlan({ ...editingPlan, max_objects: parseInt(e.target.value) || 0 })}
                          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-teal-500/50"
                        />
                      </div>
                      <div>
                        <label className="text-white/40 text-xs mb-1 block">Stripe Price ID</label>
                        <input
                          value={editingPlan.stripe_price_id || ''}
                          onChange={e => setEditingPlan({ ...editingPlan, stripe_price_id: e.target.value })}
                          placeholder="price_xxx"
                          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white/60 focus:outline-none focus:border-teal-500/50 font-mono"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-white/40 text-xs mb-1 block">Features (uma por linha)</label>
                      <textarea
                        rows={4}
                        value={editingPlan.features.join('\n')}
                        onChange={e => setEditingPlan({ ...editingPlan, features: e.target.value.split('\n').filter(Boolean) })}
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-teal-500/50 resize-none"
                      />
                    </div>

                    <div>
                      <label className="text-white/40 text-xs mb-1 block">Mercado Pago Plan ID</label>
                      <input
                        value={editingPlan.mp_plan_id || ''}
                        onChange={e => setEditingPlan({ ...editingPlan, mp_plan_id: e.target.value })}
                        placeholder="2c938084..."
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white/60 focus:outline-none focus:border-teal-500/50 font-mono"
                      />
                    </div>

                    <div className="flex gap-2 pt-1">
                      <button
                        onClick={() => savePlan(editingPlan)}
                        disabled={saving}
                        className="flex items-center gap-1.5 bg-teal-500 hover:bg-teal-400 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
                      >
                        {saving ? <div className="w-3.5 h-3.5 border border-white/30 border-t-white rounded-full animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                        Salvar
                      </button>
                      <button
                        onClick={() => setEditingPlan(null)}
                        className="text-white/40 hover:text-white text-sm px-4 py-2 rounded-lg transition-colors"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  /* ── Visualização ── */
                  <div className="p-5 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-xl ${plan.slug === 'pro' ? 'bg-teal-500/20 text-teal-400' : plan.slug === 'business' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-white/10 text-white/50'}`}>
                        {PLAN_ICONS[plan.slug]}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-white text-sm">{plan.name}</span>
                          {!plan.is_active && (
                            <span className="text-xs bg-red-500/10 text-red-400 border border-red-500/20 px-2 py-0.5 rounded-full">Inativo</span>
                          )}
                        </div>
                        <p className="text-white/40 text-xs mt-0.5">
                          {plan.price_brl === 0 ? 'Grátis' : `R$ ${plan.price_brl.toFixed(2).replace('.', ',')}/mês`}
                          {' · '}
                          {plan.max_objects.toLocaleString('pt-BR')} objetos
                          {' · '}
                          {plan.features.length} features
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={() => togglePlan(plan)}
                        className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-all ${
                          plan.is_active
                            ? 'border-green-500/20 bg-green-500/10 text-green-400 hover:bg-green-500/20'
                            : 'border-white/10 bg-white/5 text-white/40 hover:text-white'
                        }`}
                      >
                        {plan.is_active ? <ToggleRight className="w-3.5 h-3.5" /> : <ToggleLeft className="w-3.5 h-3.5" />}
                        {plan.is_active ? 'Ativo' : 'Inativo'}
                      </button>
                      <button
                        onClick={() => setEditingPlan({ ...plan })}
                        className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-white/10 bg-white/5 text-white/50 hover:text-white transition-all"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                        Editar
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* ── Tab: Configurações ──────────────────────────────────────────────── */}
      {tab === 'settings' && (
        <div className="space-y-4">
          <div className="border border-white/[0.08] rounded-2xl bg-white/[0.02] p-5 space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <CreditCard className="w-4 h-4 text-teal-400" />
              <h3 className="font-semibold text-white text-sm">Gateways de Pagamento</h3>
            </div>

            {settings.length === 0 ? (
              <div className="text-center py-8 text-white/30 text-sm">
                <Settings className="w-8 h-8 mx-auto mb-2 opacity-40" />
                Execute a migração do banco para carregar as configurações.
              </div>
            ) : (
              <div className="space-y-3">
                {settings.map(setting => (
                  <div key={setting.key} className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="text-white/60 text-xs font-mono">{setting.key}</label>
                      {setting.is_secret && (
                        <button
                          onClick={() => setShowSecrets(prev => ({ ...prev, [setting.key]: !prev[setting.key] }))}
                          className="text-white/30 hover:text-white transition-colors"
                        >
                          {showSecrets[setting.key] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      )}
                    </div>
                    <p className="text-white/30 text-xs">{setting.description}</p>
                    <input
                      type={setting.is_secret && !showSecrets[setting.key] ? 'password' : 'text'}
                      value={settingEdits[setting.key] ?? ''}
                      onChange={e => setSettingEdits(prev => ({ ...prev, [setting.key]: e.target.value }))}
                      placeholder={setting.is_secret ? '••••••••' : 'Não configurado'}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-teal-500/50 font-mono"
                    />
                  </div>
                ))}

                <button
                  onClick={saveSettings}
                  disabled={saving}
                  className="flex items-center gap-1.5 bg-teal-500 hover:bg-teal-400 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors disabled:opacity-50 mt-2"
                >
                  {saving ? <div className="w-3.5 h-3.5 border border-white/30 border-t-white rounded-full animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  Salvar configurações
                </button>
              </div>
            )}
          </div>

          {/* Status dos gateways */}
          <div className="border border-white/[0.08] rounded-2xl bg-white/[0.02] p-5">
            <h3 className="font-semibold text-white text-sm mb-4">Status dos Gateways</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {[
                { name: 'Stripe', desc: 'Cartão internacional', configured: false },
                { name: 'Mercado Pago', desc: 'PIX e cartão BR', configured: false },
              ].map(gw => (
                <div key={gw.name} className="flex items-center justify-between border border-white/[0.08] rounded-xl p-3">
                  <div>
                    <p className="text-white text-sm font-medium">{gw.name}</p>
                    <p className="text-white/30 text-xs">{gw.desc}</p>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full border ${gw.configured ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'}`}>
                    {gw.configured ? 'Configurado' : 'Modo teste'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Tab: Boost / Notificações ────────────────────────────────────────── */}
      {tab === 'boost' && (
        <div className="space-y-4">
          {/* Preview */}
          <div className="border border-white/[0.08] rounded-2xl bg-white/[0.02] p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-orange-400" />
                <h3 className="font-semibold text-white text-sm">Notificações de Reengajamento</h3>
              </div>
              <button
                onClick={fetchBoostPreview}
                className="text-white/30 hover:text-white transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>

            <p className="text-white/40 text-xs mb-4">
              Usuários com objetos perdidos/roubados que ainda não receberam notificação nos dias abaixo:
            </p>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
              {boostPreview.map(item => (
                <div key={item.day} className="border border-white/[0.08] rounded-xl p-3 text-center">
                  <p className="text-2xl font-bold text-white">{item.count}</p>
                  <p className="text-white/40 text-xs mt-1">Dia {item.day}</p>
                </div>
              ))}
              {boostPreview.length === 0 && [3, 7, 15, 30].map(d => (
                <div key={d} className="border border-white/[0.08] rounded-xl p-3 text-center">
                  <p className="text-2xl font-bold text-white/20">—</p>
                  <p className="text-white/30 text-xs mt-1">Dia {d}</p>
                </div>
              ))}
            </div>

            <button
              onClick={runBoostJob}
              disabled={boostRunning}
              className="flex items-center gap-1.5 bg-orange-500/15 hover:bg-orange-500/25 border border-orange-500/20 text-orange-400 text-sm font-medium px-4 py-2.5 rounded-xl transition-all disabled:opacity-50"
            >
              {boostRunning ? (
                <div className="w-4 h-4 border border-orange-400/30 border-t-orange-400 rounded-full animate-spin" />
              ) : (
                <Zap className="w-4 h-4" />
              )}
              Executar job agora
            </button>
          </div>

          {/* Preços de Boost */}
          <div className="border border-white/[0.08] rounded-2xl bg-white/[0.02] p-5">
            <h3 className="font-semibold text-white text-sm mb-4">Preços de Boost</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {[
                { key: 'boost_price_7d',    label: 'Boost 7 dias',   default: 'R$ 9,90' },
                { key: 'boost_price_30d',   label: 'Boost 30 dias',  default: 'R$ 24,90' },
                { key: 'boost_alert_price', label: 'Alerta de Área', default: 'R$ 14,90' },
              ].map(b => (
                <div key={b.key}>
                  <label className="text-white/40 text-xs mb-1 block">{b.label}</label>
                  <div className="flex items-center gap-2">
                    <span className="text-white/30 text-sm">R$</span>
                    <input
                      type="number"
                      step="0.01"
                      value={settingEdits[b.key] ?? ''}
                      onChange={e => setSettingEdits(prev => ({ ...prev, [b.key]: e.target.value }))}
                      placeholder={b.default}
                      className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-teal-500/50"
                    />
                  </div>
                </div>
              ))}
            </div>
            <button
              onClick={saveSettings}
              disabled={saving}
              className="flex items-center gap-1.5 bg-teal-500 hover:bg-teal-400 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors disabled:opacity-50 mt-4"
            >
              {saving ? <div className="w-3.5 h-3.5 border border-white/30 border-t-white rounded-full animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              Salvar preços
            </button>
          </div>

          {/* Timing das notificações */}
          <div className="border border-white/[0.08] rounded-2xl bg-white/[0.02] p-5">
            <h3 className="font-semibold text-white text-sm mb-3">Calendário de Notificações</h3>
            <div className="space-y-2">
              {[
                { day: 3,  msg: 'Seu item ainda não foi encontrado. Quer aumentar as chances?' },
                { day: 7,  msg: 'Já faz uma semana. Um Boost pode colocar sua publicação em destaque.' },
                { day: 15, msg: 'Sua publicação está menos visível. Renove o destaque por R$ 9,90.' },
                { day: 30, msg: 'Último aviso. Mantenha sua busca ativa por mais 30 dias.' },
              ].map(n => (
                <div key={n.day} className="flex items-start gap-3 border border-white/[0.06] rounded-xl p-3">
                  <div className="w-8 h-8 rounded-lg bg-orange-500/10 border border-orange-500/20 flex items-center justify-center flex-shrink-0">
                    <span className="text-orange-400 text-xs font-bold">D{n.day}</span>
                  </div>
                  <p className="text-white/50 text-xs leading-relaxed pt-1">{n.msg}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
