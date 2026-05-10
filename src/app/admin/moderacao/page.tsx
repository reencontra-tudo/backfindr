'use client';

import { useState, useEffect, useCallback } from 'react';
import { Shield, AlertTriangle, Trash2, UserX, CheckCircle2, Flag, RefreshCw, Loader2 } from 'lucide-react';
import { api, parseApiError } from '@/lib/api';
import { toast } from 'sonner';

interface Report {
  id: string;
  type: string;
  reason: string | null;
  status: string;
  created_at: string;
  object_title: string | null;
  reporter_email: string | null;
}

const TYPE_STYLE: Record<string, string> = {
  spam:           'text-red-400 bg-red-500/10 border-red-500/20',
  fake:           'text-orange-400 bg-orange-500/10 border-orange-500/20',
  suspicious:     'text-yellow-400 bg-yellow-500/10 border-yellow-500/20',
  inappropriate:  'text-purple-400 bg-purple-500/10 border-purple-500/20',
  other:          'text-white/40 bg-white/[0.04] border-white/[0.08]',
};

const STATUS_STYLE: Record<string, string> = {
  pending:  'text-yellow-400',
  reviewed: 'text-blue-400',
  resolved: 'text-green-400',
};

const TYPE_LABEL: Record<string, string> = {
  spam: 'Spam', fake: 'Falso', suspicious: 'Suspeito', inappropriate: 'Inapropriado', other: 'Outro',
};

export default function AdminModeracao() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('pending');
  const [total, setTotal] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);
  const [acting, setActing] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (filter !== 'all') params.status = filter;
      const { data } = await api.get('/admin/moderacao', { params });
      setReports(data?.items ?? []);
      setTotal(data?.total ?? 0);
      setPendingCount(data?.pending ?? 0);
    } catch {
      setReports([]);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  const handleAction = async (
    reportId: string,
    action: 'dismiss' | 'remove_object' | 'block_user',
    label: string
  ) => {
    if (!confirm(`Confirmar: ${label}?`)) return;
    setActing(reportId);
    try {
      await api.post('/admin/moderacao', { report_id: reportId, action });
      toast.success(`Ação executada: ${label}`);
      load();
    } catch (e) {
      toast.error(parseApiError(e));
    } finally {
      setActing(null);
    }
  };

  const resolved = reports.filter(r => r.status === 'resolved').length;

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Moderação</h1>
          <p className="text-white/30 text-sm mt-0.5">Reports, bloqueios e conteúdo flagado</p>
        </div>
        <div className="flex items-center gap-2">
          {pendingCount > 0 && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-500/10 border border-red-500/20">
              <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
              <span className="text-red-400 text-xs font-medium">{pendingCount} pendente{pendingCount > 1 ? 's' : ''}</span>
            </div>
          )}
          <button onClick={load} className="w-9 h-9 flex items-center justify-center text-white/30 hover:text-white rounded-xl border border-white/[0.07] hover:bg-white/[0.04] transition-all">
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Pendentes',  value: pendingCount, color: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20', icon: AlertTriangle },
          { label: 'Resolvidos', value: resolved,     color: 'text-green-400 bg-green-500/10 border-green-500/20',   icon: CheckCircle2 },
          { label: 'Total',      value: total,        color: 'text-white/40 bg-white/[0.04] border-white/[0.08]',    icon: Shield },
        ].map(({ label, value, color, icon: Icon }) => (
          <div key={label} className={`flex items-center gap-3 p-4 rounded-2xl border ${color}`}>
            <Icon className="w-5 h-5 flex-shrink-0" />
            <div>
              <p className="text-xl font-bold text-white">{value}</p>
              <p className="text-xs opacity-60">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div className="flex gap-2">
        {[
          { key: 'all',      label: 'Todos' },
          { key: 'pending',  label: 'Pendentes' },
          { key: 'resolved', label: 'Resolvidos' },
        ].map(f => (
          <button key={f.key} onClick={() => setFilter(f.key)}
            className={`px-3 py-2 rounded-xl text-xs font-medium transition-all ${filter === f.key ? 'bg-teal-500/15 text-teal-400 border border-teal-500/30' : 'text-white/40 border border-white/[0.07] hover:text-white'}`}>
            {f.label}
          </button>
        ))}
      </div>

      {/* Lista */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 text-teal-500 animate-spin" />
        </div>
      ) : reports.length === 0 ? (
        <div className="text-center py-16 text-white/20">
          <Shield className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>Nenhuma denúncia {filter !== 'all' ? `com status "${filter}"` : ''}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {reports.map(r => (
            <div key={r.id} className={`bg-white/[0.02] border rounded-2xl p-4 transition-all ${r.status === 'pending' ? 'border-yellow-500/20' : 'border-white/[0.07]'}`}>
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-xl bg-red-500/10 flex items-center justify-center flex-shrink-0">
                    <Flag className="w-4 h-4 text-red-400" />
                  </div>
                  <div>
                    <p className="text-white text-sm font-medium">{r.object_title ?? 'Objeto removido'}</p>
                    <div className="flex items-center gap-3 mt-1">
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${TYPE_STYLE[r.type] ?? TYPE_STYLE.other}`}>
                        {TYPE_LABEL[r.type] ?? r.type}
                      </span>
                      {r.reporter_email && (
                        <span className="text-white/20 text-xs">por {r.reporter_email}</span>
                      )}
                      <span className="text-white/20 text-xs">
                        {new Date(r.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    {r.reason && (
                      <p className="text-white/30 text-xs mt-1 truncate max-w-xs">{r.reason}</p>
                    )}
                  </div>
                </div>
                <span className={`text-xs font-medium capitalize ${STATUS_STYLE[r.status] ?? 'text-white/30'}`}>
                  {r.status === 'pending' ? 'Pendente' : r.status === 'resolved' ? 'Resolvido' : r.status}
                </span>
              </div>

              {r.status === 'pending' && (
                <div className="flex flex-wrap gap-2 pt-2 border-t border-white/[0.06]">
                  <button
                    onClick={() => handleAction(r.id, 'dismiss', 'Ignorar denúncia')}
                    disabled={acting === r.id}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-green-400 bg-green-500/10 border border-green-500/20 hover:bg-green-500/20 transition-all disabled:opacity-50">
                    <CheckCircle2 className="w-3 h-3" /> Ignorar
                  </button>
                  {r.object_title && (
                    <button
                      onClick={() => handleAction(r.id, 'remove_object', 'Remover objeto')}
                      disabled={acting === r.id}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-red-400 bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 transition-all disabled:opacity-50">
                      <Trash2 className="w-3 h-3" /> Remover objeto
                    </button>
                  )}
                  <button
                    onClick={() => handleAction(r.id, 'block_user', 'Bloquear usuário')}
                    disabled={acting === r.id}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-orange-400 bg-orange-500/10 border border-orange-500/20 hover:bg-orange-500/20 transition-all disabled:opacity-50">
                    <UserX className="w-3 h-3" /> Bloquear usuário
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {total > reports.length && (
        <p className="text-center text-white/20 text-xs">
          Mostrando {reports.length} de {total} denúncias
        </p>
      )}
    </div>
  );
}
