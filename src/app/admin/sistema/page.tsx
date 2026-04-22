'use client';

import { useState, useEffect, useCallback } from 'react';
import { Server, Database, Zap, Globe, CheckCircle2, AlertTriangle, XCircle, RefreshCw, Activity, Clock } from 'lucide-react';
import { api, parseApiError } from '@/lib/api';
import { toast } from 'sonner';

interface HealthData { status: string; database?: string; version: string; uptime?: number; services?: { database?: { status: string; latency_ms?: number } } }

const SERVICES = [
  { name: 'API Backend',          url: '/api/health',          key: 'api' },
  { name: 'Banco (Supabase)',      url: null,                   key: 'db' },
  { name: 'Vercel Edge',          url: null,                   key: 'edge' },
  { name: 'Resend (E-mail)',       url: null,                   key: 'email' },
  { name: 'Stripe (Pagamentos)',   url: null,                   key: 'stripe' },
  { name: 'Mapbox',               url: null,                   key: 'mapbox' },
];

const LOGS = [
  { level: 'info',  msg: 'Matching completo executado',           time: '14/04 21:30', detail: '4.231 objetos processados, 18 matches gerados' },
  { level: 'info',  msg: 'Deploy realizado com sucesso',          time: '14/04 18:15', detail: 'Vercel deployment #87 — build OK em 1m42s' },
  { level: 'warn',  msg: 'Rate limit atingido — IP 200.x.x.x',   time: '14/04 15:22', detail: 'Endpoint /auth/login — 5 tentativas em 60s' },
  { level: 'info',  msg: 'Campanha Webjetos lote 3 iniciada',     time: '14/04 10:00', detail: '1.000 e-mails enfileirados no Resend' },
  { level: 'error', msg: 'Falha no pagamento Stripe',             time: '13/04 22:41', detail: 'user_id=abc123 — card_declined' },
  { level: 'info',  msg: 'Backup automático Supabase',            time: '13/04 03:00', detail: 'Snapshot diário gerado — 2.1GB' },
];

const LOG_STYLE: Record<string, string> = {
  info:  'text-teal-400 bg-teal-500/10 border-teal-500/20',
  warn:  'text-yellow-400 bg-yellow-500/10 border-yellow-500/20',
  error: 'text-red-400 bg-red-500/10 border-red-500/20',
};

export default function AdminSistema() {
  const [health, setHealth] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [statuses, setStatuses] = useState<Record<string, 'ok' | 'degraded' | 'down' | 'checking'>>({
    api: 'checking', db: 'checking', edge: 'ok', email: 'ok', stripe: 'ok', mapbox: 'ok',
  });

  const runMatching = useCallback(async () => {
    setActionLoading('matching');
    try {
      const { data } = await api.post('/admin/matching/run-all');
      toast.success(data?.message ?? 'Matching concluído com sucesso');
    } catch (e) {
      toast.error(parseApiError(e));
    } finally {
      setActionLoading(null);
    }
  }, []);

  const checkHealth = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/health', { cache: 'no-store' });
      const data: HealthData = await res.json();
      setHealth(data);
      const dbOk = data.services?.database?.status === 'ok' || data.database === 'connected';
      setStatuses(prev => ({
        ...prev,
        api: res.ok ? 'ok' : 'down',
        db: dbOk ? 'ok' : 'down',
      }));
    } catch {
      setStatuses(prev => ({ ...prev, api: 'down', db: 'down' }));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { checkHealth(); }, []);

  const StatusIcon = ({ status }: { status: string }) => {
    if (status === 'ok')       return <CheckCircle2 className="w-4 h-4 text-green-400" />;
    if (status === 'degraded') return <AlertTriangle className="w-4 h-4 text-yellow-400" />;
    if (status === 'down')     return <XCircle className="w-4 h-4 text-red-400" />;
    return <RefreshCw className="w-4 h-4 text-white/30 animate-spin" />;
  };

  const StatusText = ({ status }: { status: string }) => {
    const map: Record<string, [string, string]> = {
      ok:       ['Operacional', 'text-green-400'],
      degraded: ['Degradado',   'text-yellow-400'],
      down:     ['Offline',     'text-red-400'],
      checking: ['Verificando', 'text-white/30'],
    };
    const [label, color] = map[status] ?? ['Desconhecido', 'text-white/30'];
    return <span className={`text-xs ${color}`}>{label}</span>;
  };

  const allOk = Object.values(statuses).every(s => s === 'ok');

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Sistema</h1>
          <p className="text-white/30 text-sm mt-0.5">Saúde da infraestrutura e logs</p>
        </div>
        <div className="flex items-center gap-3">
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border ${allOk ? 'bg-green-500/10 border-green-500/20' : 'bg-yellow-500/10 border-yellow-500/20'}`}>
            <div className={`w-1.5 h-1.5 rounded-full animate-pulse ${allOk ? 'bg-green-400' : 'bg-yellow-400'}`} />
            <span className={`text-xs font-medium ${allOk ? 'text-green-400' : 'text-yellow-400'}`}>
              {allOk ? 'Todos os sistemas OK' : 'Atenção necessária'}
            </span>
          </div>
          <button onClick={checkHealth} className="w-9 h-9 flex items-center justify-center text-white/30 hover:text-white rounded-xl border border-white/[0.07] hover:bg-white/[0.04] transition-all">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Services status */}
      <div className="bg-white/[0.02] border border-white/[0.07] rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-white/[0.06]">
          <p className="text-white font-semibold text-sm">Status dos serviços</p>
        </div>
        <div className="divide-y divide-white/[0.04]">
          {SERVICES.map(svc => (
            <div key={svc.key} className="flex items-center justify-between px-5 py-3.5">
              <div className="flex items-center gap-3">
                <Server className="w-4 h-4 text-white/20" />
                <span className="text-white/70 text-sm">{svc.name}</span>
              </div>
              <div className="flex items-center gap-2">
                <StatusText status={statuses[svc.key]} />
                <StatusIcon status={statuses[svc.key]} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* API health */}
      {health && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { icon: Globe,    label: 'API Version',  value: health.version ?? '1.0.0' },
            { icon: Database, label: 'Banco',         value: (health.services?.database?.status === 'ok' || health.database === 'connected') ? 'Conectado' : 'Offline' },
            { icon: Activity, label: 'Status',        value: health.status ?? 'ok' },
            { icon: Clock,    label: 'Uptime',        value: health.uptime ? `${Math.floor(health.uptime / 3600)}h` : '—' },
          ].map(({ icon: Icon, label, value }) => (
            <div key={label} className="bg-white/[0.02] border border-white/[0.07] rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Icon className="w-3.5 h-3.5 text-white/30" />
                <span className="text-white/30 text-xs uppercase tracking-wider">{label}</span>
              </div>
              <p className="text-white font-semibold text-sm">{value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Logs */}
      <div className="bg-white/[0.02] border border-white/[0.07] rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-white/[0.06] flex items-center justify-between">
          <p className="text-white font-semibold text-sm">Log de atividades</p>
          <span className="text-white/20 text-xs">Últimas 24h</span>
        </div>
        <div className="divide-y divide-white/[0.03]">
          {LOGS.map((log, i) => (
            <div key={i} className="px-5 py-3.5 hover:bg-white/[0.02] transition-colors">
              <div className="flex items-start gap-3">
                <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border flex-shrink-0 mt-0.5 ${LOG_STYLE[log.level]}`}>
                  {log.level}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-white/80 text-sm">{log.msg}</p>
                    <span className="text-white/20 text-[10px] flex-shrink-0">{log.time}</span>
                  </div>
                  <p className="text-white/30 text-xs mt-0.5 truncate">{log.detail}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Ações de manutenção */}
      <div className="bg-white/[0.02] border border-white/[0.07] rounded-2xl p-5">
        <p className="text-white font-semibold text-sm mb-4">Ações de manutenção</p>
        <div className="grid sm:grid-cols-2 gap-2">
          {[
            { icon: Zap,       label: 'Rodar matching completo',    action: runMatching,                          color: 'text-teal-400', key: 'matching' },
            { icon: Database,  label: 'Verificar integridade do banco', action: () => { checkHealth(); },         color: 'text-blue-400',   key: 'db' },
            { icon: RefreshCw, label: 'Recarregar status dos serviços', action: () => { checkHealth(); },           color: 'text-yellow-400', key: 'refresh' },
            { icon: Activity,  label: 'Verificar API health',          action: () => { checkHealth(); },           color: 'text-purple-400', key: 'health' },
          ].map(({ icon: Icon, label, color, key, action }) => (
            <button key={label} onClick={action} disabled={actionLoading === key}
              className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.07] text-left transition-all group disabled:opacity-50">
              <Icon className={`w-4 h-4 ${color} flex-shrink-0 ${actionLoading === key ? 'animate-spin' : ''}`} />
              <span className="text-white/50 group-hover:text-white text-sm transition-colors">{label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
