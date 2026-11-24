'use client';
// Painel mínimo do colaborador (E5): estado da página e da verificação, kit de divulgação, troca de canal e saída. O painel completo (ocorrências, saldo, saque) vem na E6.
// Comissão: «em apuração», SEM valores até a E4 existir. Sem COLABORADORES_INSCRICAO a API responde 404 e esta tela mostra «indisponível».
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import Cookies from 'js-cookie';

interface Minha {
  slug: string; codigoCurto: string; nome: string; estado: string; verificado: boolean; interno: boolean; linkPublico: string; comissao: string; canalUrl: string | null;
  verificacao: { codigo: string; estado: string; canalUrl: string; motivo: string | null } | null;
}

const hdr = () => { const t = Cookies.get('access_token'); return t ? { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' } : null; };

// Kit de divulgação: textos prontos SEM promessa de resultado, de contato protegido ou de resposta (POLÍTICA §3: «informar com veracidade, sem prometer resultado»).
const kit = (link: string) => [
  `Perdeu, achou ou teve algo roubado? Registre a ocorrência pela nossa página no Backfindr: ${link}`,
  `Se você achou um objeto, documento ou animal, pode registrar o achado no Backfindr, e quem perdeu pode encontrar o aviso: ${link}`,
  `Ajude a divulgar: ao registrar uma ocorrência pela nossa página, ela aparece também no Backfindr inteiro, o que amplia o alcance do aviso. ${link}`,
];

export default function PainelColaborador() {
  const [dados, setDados] = useState<Minha | null | undefined>(undefined);
  const [indisponivel, setIndisponivel] = useState(false);
  const [msg, setMsg] = useState(''); const [novoCanal, setNovoCanal] = useState(''); const [ocupado, setOcupado] = useState(false);
  const [copiado, setCopiado] = useState<number | null>(null);

  const carregar = useCallback(async () => {
    const h = hdr(); if (!h) { setDados(null); return; }
    try {
      const r = await fetch('/api/v1/colaboradores/minha', { headers: h, cache: 'no-store' });
      if (r.status === 404) { setIndisponivel(true); return; }
      const j = await r.json(); setDados(j?.colaborador ?? null);
    } catch { setMsg('Não foi possível carregar agora.'); setDados(null); }
  }, []);
  useEffect(() => { carregar(); }, [carregar]);

  async function acao(caminho: string, corpo?: unknown, confirmar?: string) {
    const h = hdr(); if (!h) return; if (confirmar && !window.confirm(confirmar)) return;
    setOcupado(true); setMsg('');
    try {
      const r = await fetch(`/api/v1/colaboradores/minha/${caminho}`, { method: 'POST', headers: h, body: corpo ? JSON.stringify(corpo) : undefined });
      const j = await r.json(); if (!r.ok || !j?.ok) setMsg(String(j?.erro ?? 'Não foi possível concluir.')); else { setNovoCanal(''); await carregar(); }
    } catch { setMsg('Não foi possível concluir agora.'); } finally { setOcupado(false); }
  }

  if (indisponivel) return <main className="mx-auto max-w-2xl px-4 py-10 text-sm text-white/60">O Programa de Colaboradores ainda não está disponível.</main>;
  if (dados === undefined) return <main className="mx-auto max-w-2xl px-4 py-10 text-sm text-white/60">Carregando…</main>;
  if (dados === null) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-10 text-sm text-white/75">
        <h1 className="text-xl font-bold text-white">Programa de Colaboradores</h1>
        <p className="mt-3">Você ainda não tem uma página de colaborador.</p>
        <Link href="/colaborador/seja" className="mt-4 flex min-h-[44px] items-center justify-center rounded-xl bg-teal-500 px-4 font-semibold text-black hover:bg-teal-400">Quero ser colaborador</Link>
        {msg && <p className="mt-3 text-red-300">{msg}</p>}
      </main>
    );
  }

  const ativo = dados.estado === 'ativo'; const saiu = dados.estado === 'saiu';
  const estadoTexto = ativo ? 'No ar' : saiu ? 'Encerrada por você' : dados.estado === 'suspenso' ? 'Suspensa' : 'Encerrada';
  return (
    <main className="mx-auto max-w-2xl space-y-6 px-4 py-8 text-sm text-white/75" data-painel-colaborador>
      <header>
        <h1 className="text-xl font-bold text-white">{dados.nome}</h1>
        <p className="mt-1 text-white/50">Página: <a className="underline underline-offset-2 hover:text-white" href={dados.linkPublico}>{dados.linkPublico.replace(/^https?:\/\//, '')}</a> · Código curto: <strong className="text-white">{dados.codigoCurto}</strong></p>
        <p className="mt-1">Situação: <strong className="text-white">{estadoTexto}</strong></p>
      </header>

      <section className="rounded-2xl border border-white/10 p-4" aria-labelledby="comissao">
        <h2 id="comissao" className="text-base font-semibold text-white">Comissão</h2>
        <p className="mt-1"><strong className="text-white">{dados.comissao}</strong>. Os valores aparecem aqui quando o cálculo estiver disponível.</p>
      </section>

      <section className="rounded-2xl border border-white/10 p-4" aria-labelledby="verificacao">
        <h2 id="verificacao" className="text-base font-semibold text-white">Verificação do canal</h2>
        {dados.verificado ? <p className="mt-1 text-teal-300">Canal verificado.</p> : (
          <>
            <p className="mt-1">A comissão só é liberada depois que o Backfindr confirmar que você administra o grupo ou perfil informado. A confirmação é feita por um código publicado no canal ou pelo link da página na bio do perfil.</p>
            {dados.verificacao?.estado === 'recusada' && <p className="mt-2 text-red-300">A última verificação foi recusada{dados.verificacao.motivo ? `: ${dados.verificacao.motivo}` : ''}. Troque o canal ou entre em contato.</p>}
            {dados.verificacao && dados.verificacao.estado !== 'recusada' && (
              <><p className="mt-2">Publique este código no canal:</p><p className="mt-1 select-all rounded-lg bg-black/30 px-3 py-2 text-center font-mono text-lg tracking-wider text-teal-200">{dados.verificacao.codigo}</p><p className="mt-1 text-white/40">Aguardando confirmação.</p></>
            )}
          </>
        )}
      </section>

      {ativo && (
        <section className="rounded-2xl border border-white/10 p-4" aria-labelledby="kit">
          <h2 id="kit" className="text-base font-semibold text-white">Kit de divulgação</h2>
          <p className="mt-1">Textos prontos para postar no seu grupo ou perfil. Informe sempre com veracidade e sem prometer resultado; use a marca Backfindr apenas como fornecida.</p>
          <ul className="mt-3 space-y-3">
            {kit(dados.linkPublico).map((t, i) => (
              <li key={i} className="rounded-xl bg-white/5 p-3">
                <p className="whitespace-pre-line break-words">{t}</p>
                <button type="button" className="mt-2 min-h-[40px] rounded-lg border border-white/15 px-3 text-xs text-white hover:bg-white/5" onClick={async () => { try { await navigator.clipboard.writeText(t); setCopiado(i); } catch { setCopiado(null); } }}>
                  {copiado === i ? 'Copiado' : 'Copiar texto'}
                </button>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-white/50">A imagem de divulgação de cada ocorrência cadastrada pelo seu link leva a sua marca: baixe o cartaz na página da ocorrência.</p>
        </section>
      )}

      {ativo && !dados.interno && (
        <section className="rounded-2xl border border-white/10 p-4" aria-labelledby="canal">
          <h2 id="canal" className="text-base font-semibold text-white">Trocar o canal de origem</h2>
          <p className="mt-1">O novo canal passa pela verificação de novo, e a liberação de comissão fica suspensa até a confirmação.</p>
          <label htmlFor="novo-canal" className="sr-only">Endereço do novo grupo, perfil ou página</label>
          <input id="novo-canal" value={novoCanal} onChange={(e) => setNovoCanal(e.target.value)} placeholder="https://" inputMode="url" autoCapitalize="off" className="mt-2 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-3 text-base text-white placeholder:text-white/30" />
          <button type="button" disabled={ocupado || !novoCanal} onClick={() => acao('canal', { canal_url: novoCanal })} className="mt-2 min-h-[44px] rounded-xl bg-white/10 px-4 font-semibold text-white hover:bg-white/15 disabled:opacity-50">Trocar canal</button>
        </section>
      )}

      {!dados.interno && (ativo || saiu) && (
        <section className="rounded-2xl border border-white/10 p-4" aria-labelledby="saida">
          <h2 id="saida" className="text-base font-semibold text-white">{ativo ? 'Sair do programa' : 'Reativar minha página'}</h2>
          {ativo
            ? <><p className="mt-1">A sua página sai do ar e o endereço passa a levar ao Feed do Backfindr. As ocorrências cadastradas continuam no Backfindr. Você pode reativar o seu @nome a qualquer momento.</p>
                <button type="button" disabled={ocupado} onClick={() => acao('sair', undefined, 'Sair do Programa de Colaboradores? A sua página sairá do ar.')} className="mt-2 min-h-[44px] rounded-xl border border-red-400/40 px-4 font-semibold text-red-200 hover:bg-red-500/10 disabled:opacity-50">Sair do programa</button></>
            : <><p className="mt-1">Você pode reativar o seu @nome a qualquer momento.</p>
                <button type="button" disabled={ocupado} onClick={() => acao('reativar')} className="mt-2 min-h-[44px] rounded-xl bg-teal-500 px-4 font-semibold text-black hover:bg-teal-400 disabled:opacity-50">Reativar minha página</button></>}
        </section>
      )}
      {msg && <p className="text-red-300" role="alert">{msg}</p>}
    </main>
  );
}
