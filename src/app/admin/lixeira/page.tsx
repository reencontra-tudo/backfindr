'use client';

/** Lixeira (admin): ocorrências excluídas logicamente, com motivo, prazo de retenção e botão Restaurar. */
import { useCallback, useEffect, useState } from 'react';
import { Trash2, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { api, parseApiError } from '@/lib/api';
import { ADMIN_REASONS, OWNER_REASONS } from '@/lib/governance';
import AdminAnonymizeModal from '@/components/admin/AdminAnonymizeModal';

interface TrashItem {
  id: string; title: string; status: string; category: string | null; is_legacy: boolean | null;
  deleted_at: string; deleted_reason: string | null; deleted_reason_text: string | null; anonymize_after: string; anonymized_at: string | null; macro_region: string | null;
}

const REASON_LABEL: Record<string, string> = Object.fromEntries([
  ...OWNER_REASONS.map((r) => [r.code, `Dono: ${r.label}`]),
  ...ADMIN_REASONS.map((r) => [r.code, `Admin: ${r.label}`]),
]);

export default function TrashPage() {
  const [items, setItems] = useState<TrashItem[]>([]);
  const [total, setTotal] = useState(0);
  const [days, setDays] = useState(90);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [anonTarget, setAnonTarget] = useState<TrashItem | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/admin/objects/trash', { params: { limit: 100 } });
      setItems(data?.items ?? []); setTotal(data?.total ?? 0); setDays(data?.retention_days ?? 90);
    } catch (e) { toast.error(parseApiError(e)); setItems([]); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const restore = async (id: string) => {
    setBusyId(id);
    try { await api.post(`/admin/objects/${id}/restore`); toast.success('Ocorrência restaurada'); await load(); }
    catch (e) { toast.error(parseApiError(e)); }
    finally { setBusyId(null); }
  };

  const anonymize = async (reason: string) => {
    if (!anonTarget) return;
    try {
      await api.post(`/admin/objects/${anonTarget.id}/anonymize`, { reason, confirm: true, confirm_text: 'ANONIMIZAR' });
    } catch (e) { throw new Error(parseApiError(e)); }
    toast.success('Ocorrência anonimizada');
    setAnonTarget(null);
    await load();
  };

  return (
    <div className="p-5 md:p-7 max-w-6xl mx-auto space-y-5">
      <AdminAnonymizeModal open={!!anonTarget} title={anonTarget?.title} onClose={() => setAnonTarget(null)} onConfirm={anonymize} />
      <div className="flex items-center gap-3">
        <Trash2 className="w-5 h-5 text-white/60" />
        <div>
          <h1 className="text-white font-semibold text-lg">Lixeira</h1>
          <p className="text-white/50 text-xs">{total} ocorrência(s) excluída(s). Ficam {days} dias e podem ser restauradas. Ao fim do prazo a ocorrência é <b>anonimizada, não apagada</b> (rotina separada, desligada por padrão); pedido de apagamento (LGPD) anonimiza na hora.</p>
        </div>
      </div>
      {loading ? <p className="text-white/50 text-sm">Carregando…</p> : items.length === 0 ? (
        <p className="text-white/50 text-sm">A lixeira está vazia.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-white/10">
          <table className="w-full text-sm">
            <thead className="text-white/40 text-xs text-left"><tr>
              <th className="p-3">Ocorrência</th><th className="p-3">Excluída em</th><th className="p-3">Motivo</th><th className="p-3">Anonimiza em</th><th className="p-3" />
            </tr></thead>
            <tbody>
              {items.map((it) => (
                <tr key={it.id} className="border-t border-white/5 text-white/80">
                  <td className="p-3 max-w-[260px] truncate" title={it.title}>{it.title}<span className="block text-white/40 text-xs">{it.status}{it.is_legacy ? ' · legado' : ''}</span></td>
                  <td className="p-3 whitespace-nowrap">{new Date(it.deleted_at).toLocaleString('pt-BR')}</td>
                  <td className="p-3">{REASON_LABEL[it.deleted_reason ?? ''] ?? it.deleted_reason ?? '—'}{it.deleted_reason_text ? <span className="block text-white/40 text-xs">“{it.deleted_reason_text}”</span> : null}</td>
                  <td className="p-3 whitespace-nowrap">{it.anonymized_at ? `Anonimizada${it.macro_region ? ' · ' + it.macro_region : ''}` : new Date(it.anonymize_after).toLocaleDateString('pt-BR')}</td>
                  <td className="p-3 text-right">
                    {it.anonymized_at ? <span className="text-white/40 text-xs">sem restauração</span> : (
                      <div className="inline-flex gap-2">
                        <button onClick={() => restore(it.id)} disabled={busyId === it.id}
                                className="inline-flex items-center gap-1 min-h-[44px] px-3 rounded-lg border border-white/10 text-white/80 hover:bg-white/5 disabled:opacity-50">
                          <RotateCcw className="w-4 h-4" /> Restaurar
                        </button>
                        {!it.is_legacy && (
                          <button onClick={() => setAnonTarget(it)} className="inline-flex items-center min-h-[44px] px-3 rounded-lg border border-red-500/30 text-red-300 hover:bg-red-500/10">
                            Anonimizar agora
                          </button>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
