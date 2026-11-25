'use client';
// Admin do Programa de Colaboradores (E7 + E8): lista com métricas do mês (inclui visitas), fila de verificação de canais, fila de saques (pagar/recusar), análises de antifraude, regras, auditoria e exportação CSV.
// Sem COLABORADORES_ATIVO as APIs respondem 404 e a tela mostra «indisponível». Toda ação é registrada em `auditoria` (só INSERT). Dados de pagamento sempre MASCARADOS.
import { useCallback, useEffect, useState } from 'react';

type Aba = 'colaboradores' | 'verificacoes' | 'saques' | 'analises' | 'regras' | 'auditoria';
interface Sinal { id: string; tipo: string; pagamento_ref: string | null; bloqueia: boolean; detalhe: Record<string, unknown>; criado_em: string; slug: string; nome: string }
interface Registro { id: string; acao: string; alvo_tipo: string; alvo_id: string; motivo: string | null; criado_em: string; antes: unknown; depois: unknown }
const ROTULO_SINAL: Record<string, string> = { pagador_igual_colaborador: 'Pagador com o mesmo e-mail do colaborador', pagador_repetido: 'Mesmo pagador comprou várias vezes', contas_novas_com_codigo: 'Muitas ocorrências de contas recém-criadas', pico_de_ocorrencias: 'Pico de ocorrências em 24 horas' };
interface Colab { id: string; visitas_no_mes: number | null; slug: string; nome: string; estado: string; interno: boolean; verificado: boolean; ocorrencias_no_mes: number; compras_no_mes: number; comissao_no_mes_centavos: number; saldo_total_centavos: number }
interface Verif { id: string; codigo: string; canal_url: string; slug: string; nome: string; criado_em: string }
interface Saque { id: string; valor_centavos: number; slug: string; nome: string; verificado: boolean; tipo_chave: string | null; chave_final: string | null; titular_nome: string | null; documento_final: string | null; solicitado_em: string }
interface Regra { chave: string; valor: string; vigente_desde: string }

const reais = (c: number) => (c / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const mesAtual = () => { const d = new Date(); return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`; };
const ROTULO_REGRA: Record<string, string> = { comissao_percentual: 'Comissão (%)', comissao_arredondamento: 'Arredondamento (baixo, cima, meio)', prazo_liberacao_dias: 'Prazo de liberação (dias)', saque_minimo_centavos: 'Saque mínimo (centavos)', prazo_saque_dias_uteis: 'Prazo do saque (dias úteis)', exclusao_cancela_saldo: 'Exclusão cancela o saldo (sim/nao)' };

async function chamar(url: string, metodo = 'GET', corpo?: unknown) {
  const r = await fetch(url, { method: metodo, credentials: 'include', headers: corpo ? { 'Content-Type': 'application/json' } : undefined, body: corpo ? JSON.stringify(corpo) : undefined, cache: 'no-store' });
  let j: Record<string, unknown> = {}; try { j = await r.json(); } catch { /* sem corpo */ }
  return { status: r.status, ok: r.ok && j.ok !== false, j };
}

export default function AdminColaboradores() {
  const [aba, setAba] = useState<Aba>('colaboradores'); const [mes, setMes] = useState(mesAtual());
  const [lista, setLista] = useState<Colab[]>([]); const [verifs, setVerifs] = useState<Verif[]>([]); const [saques, setSaques] = useState<Saque[]>([]);
  const [regras, setRegras] = useState<{ vigentes: Regra[]; agendadas: Regra[] }>({ vigentes: [], agendadas: [] });
  const [sinais, setSinais] = useState<Sinal[]>([]); const [registros, setRegistros] = useState<Registro[]>([]); const [desligada, setDesligada] = useState(false);
  const [indisponivel, setIndisponivel] = useState(false); const [msg, setMsg] = useState(''); const [ocupado, setOcupado] = useState(false);
  const [novaRegra, setNovaRegra] = useState({ chave: 'comissao_percentual', valor: '', motivo: '' });

  const carregar = useCallback(async () => {
    setMsg('');
    const u = aba === 'colaboradores' ? `/api/v1/admin/colaboradores/lista?mes=${mes}` : aba === 'verificacoes' ? '/api/v1/admin/colaboradores/verificacoes?estado=pendente' : aba === 'saques' ? '/api/v1/admin/colaboradores/saques?estado=solicitado' : aba === 'analises' ? '/api/v1/admin/colaboradores/sinais?estado=aberto' : aba === 'auditoria' ? '/api/v1/admin/colaboradores/auditoria' : '/api/v1/admin/colaboradores/regras';
    setDesligada(false);
    const r = await chamar(u); if (r.status === 404) { if (aba === 'analises') { setDesligada(true); return; } setIndisponivel(true); return; }
    if (!r.ok) { setMsg(String(r.j.erro ?? 'Não foi possível carregar.')); return; }
    if (aba === 'colaboradores') setLista((r.j.colaboradores as Colab[]) ?? []); else if (aba === 'verificacoes') setVerifs((r.j.verificacoes as Verif[]) ?? []);
    else if (aba === 'saques') setSaques((r.j.saques as Saque[]) ?? []); else if (aba === 'analises') setSinais((r.j.sinais as Sinal[]) ?? []); else if (aba === 'auditoria') setRegistros((r.j.auditoria as Registro[]) ?? []); else setRegras({ vigentes: (r.j.vigentes as Regra[]) ?? [], agendadas: (r.j.agendadas as Regra[]) ?? [] });
  }, [aba, mes]);
  useEffect(() => { carregar(); }, [carregar]);

  async function agir(url: string, corpo: unknown, ok = 'Feito.') {
    setOcupado(true); setMsg('');
    try { const r = await chamar(url, 'POST', corpo); setMsg(r.ok ? ok : String(r.j.erro ?? 'Não foi possível concluir.')); if (r.ok) await carregar(); } finally { setOcupado(false); }
  }
  const pedirMotivo = (texto: string) => { const m = window.prompt(texto); return m && m.trim() ? m.trim() : null; };

  if (indisponivel) return <div className="p-6 text-sm text-white/60">O Programa de Colaboradores não está ligado.</div>;
  const btn = 'min-h-[36px] rounded-lg border border-white/15 px-3 text-xs text-white hover:bg-white/5 disabled:opacity-50';
  return (
    <div className="space-y-4 p-4 text-sm text-white/75" data-admin-colaboradores>
      <h1 className="text-xl font-bold text-white">Colaboradores</h1>
      <nav className="flex flex-wrap gap-2" aria-label="Seções">
        {(['colaboradores', 'verificacoes', 'saques', 'analises', 'regras', 'auditoria'] as Aba[]).map((a) => (
          <button key={a} type="button" onClick={() => setAba(a)} className={`min-h-[40px] rounded-xl px-4 font-medium ${aba === a ? 'bg-teal-500 text-black' : 'bg-white/10 text-white hover:bg-white/15'}`}>
            {a === 'colaboradores' ? 'Colaboradores' : a === 'verificacoes' ? 'Verificações' : a === 'saques' ? 'Saques' : a === 'analises' ? 'Análises' : a === 'regras' ? 'Regras' : 'Auditoria'}
          </button>
        ))}
      </nav>
      {msg && <p className="rounded-lg bg-white/5 p-2 text-white" role="status">{msg}</p>}

      {aba === 'colaboradores' && (
        <section>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <label htmlFor="mes" className="text-white/60">Mês</label>
            <input id="mes" type="month" value={mes} onChange={(e) => setMes(e.target.value)} className="min-h-[36px] rounded-lg border border-white/15 bg-white/5 px-2 text-white" />
            <a className={btn + ' inline-flex items-center'} href={`/api/v1/admin/colaboradores/export?mes=${mes}`}>Exportar CSV</a>
          </div>
          <div className="overflow-x-auto"><table className="w-full min-w-[720px] text-left">
            <thead className="text-white/50"><tr><th className="p-2">@nome</th><th>Estado</th><th>Verif.</th><th>Visitas no mês</th><th>Ocorr. no mês</th><th>Compras</th><th>Comissão no mês</th><th>Saldo (livro)</th><th>Ações</th></tr></thead>
            <tbody>{lista.map((c) => (
              <tr key={c.id} className="border-t border-white/10"><td className="p-2 text-white">@{c.slug}{c.interno ? ' (interno)' : ''}</td><td>{c.estado}</td><td>{c.verificado ? 'sim' : 'não'}</td><td>{c.visitas_no_mes ?? '—'}</td><td>{c.ocorrencias_no_mes}</td><td>{c.compras_no_mes}</td><td>{reais(c.comissao_no_mes_centavos)}</td><td>{reais(c.saldo_total_centavos)}</td>
                <td className="space-x-1 py-1">{!c.interno && <>
                  {c.estado === 'ativo' && <button className={btn} disabled={ocupado} onClick={() => { const m = pedirMotivo('Motivo da suspensão:'); if (m) agir(`/api/v1/admin/colaboradores/${c.id}/estado`, { acao: 'suspender', motivo: m }); }}>Suspender</button>}
                  {(c.estado === 'suspenso' || c.estado === 'saiu') && <button className={btn} disabled={ocupado} onClick={() => agir(`/api/v1/admin/colaboradores/${c.id}/estado`, { acao: 'reativar', motivo: pedirMotivo('Motivo da reativação (opcional):') })}>Reativar</button>}
                  {c.estado !== 'excluido' && <button className={btn} disabled={ocupado} onClick={() => { const m = pedirMotivo('EXCLUIR por transgressão: a página sai do ar e o saldo não pago pode ser cancelado. Motivo:'); if (m) agir(`/api/v1/admin/colaboradores/${c.id}/estado`, { acao: 'excluir', motivo: m }); }}>Excluir</button>}
                  <button className={btn} disabled={ocupado} onClick={() => agir('/api/v1/admin/colaboradores/analise', { colaborador_id: c.id }, 'Análise de sinais feita (veja a aba Análises).')}>Analisar</button>
                  <button className={btn} disabled={ocupado} onClick={() => { const v = window.prompt('Ajuste em CENTAVOS (com sinal, ex.: -500):'); const m = v ? pedirMotivo('Motivo do ajuste:') : null; if (v && m) agir(`/api/v1/admin/colaboradores/${c.id}/ajuste`, { valor_centavos: Number(v), motivo: m }); }}>Ajuste</button></>}
                </td></tr>))}
              {lista.length === 0 && <tr><td colSpan={9} className="p-3 text-white/50">Nenhum colaborador.</td></tr>}
            </tbody></table></div>
        </section>
      )}

      {aba === 'verificacoes' && (
        <section><ul className="space-y-2">{verifs.map((v) => (
          <li key={v.id} className="rounded-xl border border-white/10 p-3"><p className="text-white">@{v.slug} · {v.nome}</p>
            <p className="break-all text-white/60">Canal: <a className="underline" href={v.canal_url} target="_blank" rel="nofollow noopener noreferrer">{v.canal_url}</a></p>
            <p>Procure no canal o código: <strong className="font-mono text-teal-200">{v.codigo}</strong></p>
            <div className="mt-2 space-x-2"><button className={btn} disabled={ocupado} onClick={() => agir(`/api/v1/admin/colaboradores/verificacoes/${v.id}`, { decisao: 'aprovar' }, 'Canal aprovado.')}>Aprovar</button>
              <button className={btn} disabled={ocupado} onClick={() => { const m = pedirMotivo('Motivo da recusa:'); if (m) agir(`/api/v1/admin/colaboradores/verificacoes/${v.id}`, { decisao: 'recusar', motivo: m }, 'Verificação recusada.'); }}>Recusar</button></div></li>))}
          {verifs.length === 0 && <li className="text-white/50">Nenhuma verificação pendente.</li>}</ul></section>
      )}

      {aba === 'saques' && (
        <section><p className="mb-2 text-white/60">O repasse é feito por PIX FORA do sistema, manualmente, em até 10 dias úteis. Marque como pago depois de pagar. Os dados de pagamento aparecem mascarados.</p>
          <ul className="space-y-2">{saques.map((s) => (
            <li key={s.id} className="rounded-xl border border-white/10 p-3"><p className="text-white">@{s.slug} · {reais(s.valor_centavos)} · pedido em {new Date(s.solicitado_em).toLocaleDateString('pt-BR')}</p>
              <p className="text-white/60">Titular: {s.titular_nome ?? '—'} · chave PIX ({s.tipo_chave ?? '—'}) terminada em {s.chave_final ?? '—'} · documento terminado em {s.documento_final ?? '—'} · canal {s.verificado ? 'verificado' : 'NÃO verificado'}</p>
              <div className="mt-2 space-x-2"><button className={btn} disabled={ocupado} onClick={() => agir(`/api/v1/admin/colaboradores/saques/${s.id}`, { decisao: 'pagar', comprovante: window.prompt('Comprovante (opcional):') ?? undefined }, 'Marcado como pago.')}>Marcar como pago</button>
                <button className={btn} disabled={ocupado} onClick={() => { const m = pedirMotivo('Motivo da recusa (o valor volta ao saldo):'); if (m) agir(`/api/v1/admin/colaboradores/saques/${s.id}`, { decisao: 'recusar', motivo: m }, 'Saque recusado.'); }}>Recusar</button></div></li>))}
            {saques.length === 0 && <li className="text-white/50">Nenhum saque pendente.</li>}</ul></section>
      )}

      {aba === 'analises' && (
        <section>
          {desligada ? <p className="text-white/60">A análise de sinais está desligada (COLABORADORES_ANTIFRAUDE).</p> : (
            <>
              <p className="mb-2 text-white/60">Sinais são para ANÁLISE MANUAL: nenhum bloqueia uma pessoa sozinho. Um sinal de compra mantém aquela comissão retida (fora do disponível) até você decidir: «Descartar» libera, «Confirmar» mantém retida.</p>
              <ul className="space-y-2">{sinais.map((x) => (
                <li key={x.id} className="rounded-xl border border-white/10 p-3"><p className="text-white">@{x.slug} · {ROTULO_SINAL[x.tipo] ?? x.tipo}{x.bloqueia ? ' · comissão retida' : ' · só aviso'}</p>
                  <p className="text-white/60">{Object.entries(x.detalhe).map(([k, v]) => `${k.replace(/_/g, ' ')}: ${String(v)}`).join(' · ')} · {new Date(x.criado_em).toLocaleDateString('pt-BR')}</p>
                  <div className="mt-2 space-x-2"><button className={btn} disabled={ocupado} onClick={() => { const m = pedirMotivo('Motivo para DESCARTAR (a comissão é liberada):'); if (m) agir(`/api/v1/admin/colaboradores/sinais/${x.id}`, { decisao: 'descartar', motivo: m }, 'Sinal descartado.'); }}>Descartar</button>
                    <button className={btn} disabled={ocupado} onClick={() => { const m = pedirMotivo('Motivo para CONFIRMAR (a comissão continua retida):'); if (m) agir(`/api/v1/admin/colaboradores/sinais/${x.id}`, { decisao: 'confirmar', motivo: m }, 'Sinal confirmado.'); }}>Confirmar</button></div></li>))}
                {sinais.length === 0 && <li className="text-white/50">Nenhum sinal em aberto.</li>}</ul>
            </>
          )}
        </section>
      )}

      {aba === 'auditoria' && (
        <section><p className="mb-2 text-white/60">Trilha de tudo o que foi feito (só consulta; ninguém altera nem apaga). As 200 mais recentes.</p>
          <div className="overflow-x-auto"><table className="w-full min-w-[640px] text-left"><thead className="text-white/50"><tr><th className="p-2">Quando</th><th>Ação</th><th>Sobre</th><th>Motivo</th></tr></thead>
            <tbody>{registros.map((x) => <tr key={x.id} className="border-t border-white/10"><td className="p-2">{new Date(x.criado_em).toLocaleString('pt-BR')}</td><td className="text-white">{x.acao}</td><td className="break-all">{x.alvo_tipo} {x.alvo_id.slice(0, 8)}</td><td>{x.motivo ?? '—'}</td></tr>)}
              {registros.length === 0 && <tr><td colSpan={4} className="p-3 text-white/50">Nenhum registro.</td></tr>}</tbody></table></div></section>
      )}

      {aba === 'regras' && (
        <section className="space-y-4">
          <p className="text-white/60">Uma mudança só vale daqui para frente: a compra usa a regra vigente na hora em que acontece. O histórico fica guardado.</p>
          <table className="w-full text-left"><thead className="text-white/50"><tr><th className="p-2">Regra</th><th>Valor vigente</th><th>Desde</th></tr></thead>
            <tbody>{regras.vigentes.map((r) => <tr key={r.chave} className="border-t border-white/10"><td className="p-2 text-white">{ROTULO_REGRA[r.chave] ?? r.chave}</td><td>{r.valor}</td><td>{new Date(r.vigente_desde).toLocaleDateString('pt-BR')}</td></tr>)}</tbody></table>
          {regras.agendadas.length > 0 && <p>Agendadas: {regras.agendadas.map((r) => `${r.chave} = ${r.valor} (${new Date(r.vigente_desde).toLocaleDateString('pt-BR')})`).join('; ')}</p>}
          <div className="grid max-w-md grid-cols-1 gap-2">
            <label htmlFor="regra-chave" className="sr-only">Regra</label>
            <select id="regra-chave" value={novaRegra.chave} onChange={(e) => setNovaRegra({ ...novaRegra, chave: e.target.value })} className="min-h-[40px] rounded-lg border border-white/15 bg-white/5 px-2 text-white">{Object.keys(ROTULO_REGRA).map((k) => <option key={k} value={k}>{ROTULO_REGRA[k]}</option>)}</select>
            <input aria-label="Novo valor" placeholder="Novo valor" value={novaRegra.valor} onChange={(e) => setNovaRegra({ ...novaRegra, valor: e.target.value })} className="min-h-[40px] rounded-lg border border-white/15 bg-white/5 px-2 text-white" />
            <input aria-label="Motivo" placeholder="Motivo da mudança (obrigatório)" value={novaRegra.motivo} onChange={(e) => setNovaRegra({ ...novaRegra, motivo: e.target.value })} className="min-h-[40px] rounded-lg border border-white/15 bg-white/5 px-2 text-white" />
            <button className={btn} disabled={ocupado || !novaRegra.valor || !novaRegra.motivo} onClick={() => agir('/api/v1/admin/colaboradores/regras', novaRegra, 'Regra registrada (vale daqui para frente).')}>Registrar mudança</button>
          </div>
        </section>
      )}
    </div>
  );
}
