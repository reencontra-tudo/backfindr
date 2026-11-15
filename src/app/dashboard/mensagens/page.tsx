'use client';
// Lista de conversas entre quem achou e o dono (área «Mensagens»). Filtros: Aguardando você, Aguardando o dono, Abertas, Encerradas.
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { MessageSquare, Clock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { conversasApi, parseApiError, type FiltroConversas } from '@/lib/api';

interface Item { id: string; estado: string; estado_visivel: string; papel: 'dono' | 'achador'; objeto_titulo: string | null; primeira_mensagem: string; ultima_atividade: string; nao_lidas: number }

const ABAS: { id: FiltroConversas; rotulo: string; vazio: string }[] = [
  { id: 'aguardando_voce', rotulo: 'Aguardando você', vazio: 'Nenhum aviso esperando a sua decisão.' },
  { id: 'aguardando_dono', rotulo: 'Aguardando o dono', vazio: 'Você não tem avisos esperando resposta do dono.' },
  { id: 'abertas', rotulo: 'Abertas', vazio: 'Nenhuma conversa aberta.' },
  { id: 'encerradas', rotulo: 'Encerradas', vazio: 'Nenhuma conversa encerrada.' },
];
const ROTULO_ESTADO: Record<string, string> = {
  aguardando: 'Aguardando', sem_resposta: 'Sem resposta até agora', aberta: 'Aberta', recusada: 'Recusada', encerrada: 'Encerrada', cancelada: 'Cancelada', arquivada: 'Arquivada', bloqueada: 'Bloqueada',
};

export default function MensagensPage() {
  const [aba, setAba] = useState<FiltroConversas>('aguardando_voce');
  const [itens, setItens] = useState<Item[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true; setItens(null); setErro(null);
    conversasApi.list(aba).then(({ data }) => { if (vivo) setItens(data?.conversas ?? []); }).catch((e) => { if (vivo) { setItens([]); setErro(parseApiError(e)); } });
    return () => { vivo = false; };
  }, [aba]);

  const atual = ABAS.find((a) => a.id === aba)!;
  return (
    <div className="p-4 sm:p-8" data-mensagens-lista>
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold text-white flex items-center gap-2"><MessageSquare className="w-6 h-6 text-teal-400" aria-hidden />Mensagens</h1>
        <p className="text-slate-400 text-sm mt-0.5">Avisos de quem achou algo e conversas com o dono.</p>
      </div>
      <div role="tablist" aria-label="Filtro de mensagens" className="flex flex-wrap gap-2 mb-5">
        {ABAS.map((a) => (
          <button key={a.id} role="tab" aria-selected={aba === a.id} data-aba={a.id} onClick={() => setAba(a.id)}
            className={`min-h-[44px] px-4 rounded-xl border text-sm font-medium transition-colors ${aba === a.id ? 'border-teal-400 bg-teal-500/15 text-teal-200' : 'border-white/15 text-white/60 hover:bg-white/10'}`}>
            {a.rotulo}
          </button>
        ))}
      </div>
      {erro && <p className="text-amber-300 text-sm mb-3">{erro}</p>}
      {itens === null ? (
        <div className="space-y-3">{[1, 2, 3].map((i) => <div key={i} className="h-20 bg-surface-card rounded-2xl animate-pulse" />)}</div>
      ) : itens.length === 0 ? (
        <div className="text-center py-16" data-mensagens-vazio><MessageSquare className="w-10 h-10 text-white/20 mx-auto mb-3" aria-hidden /><p className="text-white/50 text-sm">{atual.vazio}</p></div>
      ) : (
        <ul className="space-y-3">
          {itens.map((c) => (
            <li key={c.id}>
              <Link href={`/dashboard/mensagens/${c.id}`} data-conversa={c.id} className="block glass rounded-2xl p-4 hover:bg-white/[0.06] transition-colors">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-white font-semibold text-sm truncate">{c.objeto_titulo ?? 'Objeto'}</p>
                    <p className="text-white/40 text-xs mt-0.5">{c.papel === 'dono' ? 'Alguém avisou sobre o seu objeto' : 'Seu aviso'}</p>
                    <p className="text-white/60 text-sm mt-2 line-clamp-2">{c.primeira_mensagem}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    {c.nao_lidas > 0 && <span className="min-w-5 h-5 px-1.5 rounded-full bg-amber-500 text-white text-xs font-bold flex items-center justify-center" aria-label={`${c.nao_lidas} mensagens novas`}>{c.nao_lidas}</span>}
                    <span className="text-xs text-white/40">{ROTULO_ESTADO[c.estado_visivel] ?? c.estado_visivel}</span>
                  </div>
                </div>
                <p className="text-white/30 text-xs mt-2 flex items-center gap-1"><Clock className="w-3 h-3" aria-hidden />{formatDistanceToNow(new Date(c.ultima_atividade), { addSuffix: true, locale: ptBR })}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
