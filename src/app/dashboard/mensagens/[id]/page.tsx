'use client';
// Uma conversa entre quem achou e o dono. O dono decide: Aceitar ou «Não é meu»; aberta, os dois trocam mensagens;
// «É o meu» (só o dono) marca o objeto como «achado pendente»; «Confirmar devolução» usa o caminho que já existia e encerra.
import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, Send, Package, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { conversasApi, objectsApi, parseApiError } from '@/lib/api';

interface Msg { id: string; texto: string; tipo: 'texto' | 'sistema'; criada_em: string; autor: 'eu' | 'outro' | 'sistema' }
interface Detalhe {
  id: string; papel: 'dono' | 'achador'; estado: string; estado_visivel: string; objeto_titulo: string | null; object_id: string | null;
  confirmado_dono_em: string | null; acoes: Record<string, boolean>; mensagens: Msg[]; textos: { aguardando: string; aceitar: string };
}

export default function ConversaPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [d, setD] = useState<Detalhe | null>(null);
  const [naoAchou, setNaoAchou] = useState(false);
  const [texto, setTexto] = useState('');
  const [ocupado, setOcupado] = useState<string | null>(null);
  const fim = useRef<HTMLDivElement>(null);
  const ultimaLida = useRef('');
  const abertaRef = useRef(false);

  const carregar = useCallback(async (silencioso = false) => {
    try {
      const { data } = await conversasApi.get(id);
      setD(data);
      if (!abertaRef.current) { abertaRef.current = true; conversasApi.lida(id).catch(() => {}); }   // abrir a conversa zera o sino dela
      const ultima = [...(data.mensagens as Msg[])].reverse().find((m) => m.autor === 'outro')?.id;
      if (ultima && ultima !== ultimaLida.current) { ultimaLida.current = ultima; conversasApi.lida(id).catch(() => { ultimaLida.current = ''; }); }
    } catch (e) {
      const status = (e as { response?: { status?: number } })?.response?.status;
      if (status === 404) setNaoAchou(true); else if (!silencioso) toast.error(parseApiError(e));
    }
  }, [id]);

  useEffect(() => {
    carregar();
    const t = setInterval(() => carregar(true), 5000);
    return () => clearInterval(t);
  }, [carregar]);
  useEffect(() => { fim.current?.scrollIntoView({ behavior: 'smooth' }); }, [d?.mensagens.length]);

  const agir = async (nome: string, fn: () => Promise<unknown>, ok?: string) => {
    setOcupado(nome);
    try { await fn(); if (ok) toast.success(ok); await carregar(true); } catch (e) { toast.error(parseApiError(e)); } finally { setOcupado(null); }
  };
  const enviar = async () => {
    const t = texto.trim(); if (!t || ocupado) return;
    setOcupado('enviar');
    try { await conversasApi.enviar(id, t); setTexto(''); await carregar(true); } catch (e) { toast.error(parseApiError(e)); } finally { setOcupado(null); }
  };
  const confirmarDevolucao = () => agir('devolucao', async () => {
    // mesmo caminho do banner de hoje («Confirmar devolução»), depois encerra a conversa
    if (d?.object_id) await objectsApi.update(d.object_id, { status: 'returned', found_pending_confirmation: false });
    await conversasApi.encerrar(id, 'devolvido');
  }, 'Devolução confirmada.');

  if (naoAchou) return (
    <div className="p-10 text-center" data-conversa-nao-achada>
      <p className="font-semibold text-white mb-2">Conversa não encontrada</p>
      <Link href="/dashboard/mensagens" className="text-teal-400 text-sm underline">Voltar para Mensagens</Link>
    </div>
  );
  if (!d) return <div className="p-8"><div className="h-24 bg-surface-card rounded-2xl animate-pulse" /></div>;

  const a = d.acoes;
  const botao = 'min-h-[44px] px-4 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50';
  return (
    <div className="flex flex-col h-full" data-conversa={d.id} data-estado={d.estado}>
      <div className="flex items-center gap-3 px-4 sm:px-6 py-4 border-b border-white/[0.06] flex-shrink-0">
        <button onClick={() => router.push('/dashboard/mensagens')} aria-label="Voltar para Mensagens" className="w-9 h-9 flex items-center justify-center text-white/50 hover:text-white"><ChevronLeft className="w-5 h-5" /></button>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-white text-sm truncate">{d.objeto_titulo?.trim() || 'Objeto'}</p>
          <p className="text-xs text-white/40">{d.papel === 'dono' ? 'Alguém avisou sobre o seu objeto' : 'Seu aviso'}</p>
        </div>
        {d.papel === 'dono' && d.object_id && <Link href={`/dashboard/objects/${d.object_id}`} className="text-teal-400 text-xs flex items-center gap-1"><Package className="w-3.5 h-3.5" aria-hidden />Ver objeto</Link>}
      </div>

      {/* Situação e decisões */}
      <div className="px-4 sm:px-6 py-3 border-b border-white/[0.06] space-y-3 flex-shrink-0">
        {d.estado === 'aguardando' && d.papel === 'achador' && (
          <div data-aguardando-dono>
            <p className="text-white text-sm font-semibold">{d.estado_visivel === 'sem_resposta' ? 'Sem resposta até agora' : 'Aguardando o dono'}</p>
            <p className="text-white/60 text-sm">{d.textos.aguardando}</p>
            {a.cancelar && <button onClick={() => agir('cancelar', () => conversasApi.cancelar(id), 'Aviso cancelado.')} disabled={!!ocupado} data-acao="cancelar" className={`${botao} mt-2 border border-white/20 text-white/80 hover:bg-white/10`}>Cancelar aviso</button>}
          </div>
        )}
        {d.estado === 'aguardando' && d.papel === 'dono' && (
          <div data-aguardando-voce>
            <p className="text-white text-sm font-semibold">Alguém avisou que pode ter encontrado “{d.objeto_titulo?.trim() || 'seu objeto'}”. Veja o aviso e decida se quer conversar.</p>
            <p className="text-white/50 text-xs mt-1">{d.textos.aceitar}</p>
            <div className="flex flex-wrap gap-2 mt-3">
              {a.aceitar && <button onClick={() => agir('aceitar', () => conversasApi.aceitar(id))} disabled={!!ocupado} data-acao="aceitar" className={`${botao} bg-teal-500 hover:bg-teal-400 text-white`}>Aceitar conversa</button>}
              {a.recusar && <button onClick={() => agir('recusar', () => conversasApi.recusar(id))} disabled={!!ocupado} data-acao="recusar" className={`${botao} border border-white/20 text-white/80 hover:bg-white/10`}>Não é meu</button>}
            </div>
          </div>
        )}
        {d.estado === 'aberta' && (
          <div className="flex flex-wrap gap-2" data-acoes-aberta>
            {a.e_o_meu && <button onClick={() => agir('e_o_meu', () => conversasApi.eOMeu(id), 'Marcado como seu.')} disabled={!!ocupado} data-acao="e_o_meu" className={`${botao} bg-teal-500 hover:bg-teal-400 text-white`}>É o meu</button>}
            {a.encerrar_devolvido && <button onClick={confirmarDevolucao} disabled={!!ocupado} data-acao="devolvido" className={`${botao} bg-green-500 hover:bg-green-400 text-white`}>{ocupado === 'devolucao' ? <Loader2 className="w-4 h-4 animate-spin inline" /> : 'Confirmar devolução'}</button>}
            {a.recusar && <button onClick={() => agir('recusar', () => conversasApi.recusar(id))} disabled={!!ocupado} data-acao="recusar" className={`${botao} border border-white/20 text-white/80 hover:bg-white/10`}>Não é meu</button>}
            {a.encerrar_desisti && <button onClick={() => agir('desisti', () => conversasApi.encerrar(id, 'desisti'))} disabled={!!ocupado} data-acao="desisti" className={`${botao} border border-white/20 text-white/80 hover:bg-white/10`}>Encerrar conversa</button>}
          </div>
        )}
        {d.estado !== 'aguardando' && d.estado !== 'aberta' && <p className="text-white/60 text-sm" data-conversa-fechada>{d.estado === 'recusada' ? 'Conversa recusada.' : d.estado === 'cancelada' ? 'Aviso cancelado.' : d.estado === 'arquivada' ? 'Conversa arquivada por inatividade.' : 'Conversa encerrada.'}</p>}
        {d.papel === 'achador' && (d.estado === 'aguardando' || d.estado === 'aberta') && <p className="text-white/40 text-xs" data-orientacao>Dica: não conte na primeira mensagem o detalhe que só o dono saberia; o dono consegue descrevê-lo. Não envie telefone, e-mail nem endereço.</p>}
      </div>

      {/* Mensagens */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 space-y-2">
        {d.mensagens.map((m) => m.tipo === 'sistema' ? (
          <div key={m.id} className="flex justify-center"><span className="text-xs text-white/40 bg-white/[0.04] px-3 py-1 rounded-full border border-white/[0.06]">{m.texto}</span></div>
        ) : (
          <div key={m.id} className={`flex ${m.autor === 'eu' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap break-words ${m.autor === 'eu' ? 'bg-teal-500 text-white rounded-br-sm' : 'bg-white/[0.06] border border-white/[0.08] text-white/80 rounded-bl-sm'}`}>
              {m.texto}
              <span className={`block text-[10px] mt-1 ${m.autor === 'eu' ? 'text-white/70' : 'text-white/30'}`}>{format(new Date(m.criada_em), "dd/MM · HH:mm", { locale: ptBR })}</span>
            </div>
          </div>
        ))}
        <div ref={fim} />
      </div>

      {a.enviar && (
        // A bolha flutuante do assistente fica no canto inferior direito e cobria o botão de enviar: espaço só nesta tela (nada global).
        <div className="px-4 sm:px-6 pt-3 pb-24 border-t border-white/[0.06] flex-shrink-0" data-composer>
          <div className="flex items-end gap-3">
            <textarea value={texto} onChange={(e) => setTexto(e.target.value)} maxLength={2000} rows={1} placeholder="Digite sua mensagem..." aria-label="Mensagem"
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void enviar(); } }}
              className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-white placeholder-white/20 text-sm outline-none focus:border-teal-500/50 resize-none max-h-32" />
            <button onClick={() => void enviar()} disabled={!texto.trim() || !!ocupado} aria-label="Enviar" data-widget-safe-zone className="w-11 h-11 bg-teal-500 hover:bg-teal-400 disabled:opacity-40 rounded-xl flex items-center justify-center flex-shrink-0"><Send className="w-4 h-4 text-white" /></button>
          </div>
        </div>
      )}
    </div>
  );
}
