'use client';
// Formulário de inscrição do colaborador (E5). Logado. A página entra no ar SEM verificação (sem comissão liberada) e a pessoa recebe o código `BF-XXXX-XXXX`
// para provar que administra o canal. O servidor decide tudo; aqui só ajuda a preencher (disponibilidade do @nome ao digitar, envio da imagem).
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Cookies from 'js-cookie';

type Disp = { tipo: 'vazio' } | { tipo: 'checando' } | { tipo: 'ok' } | { tipo: 'nao'; motivo: string } | { tipo: 'erro' };
type Resultado = { slug: string; codigoVerificacao: string };

const auth = () => { const t = Cookies.get('access_token'); return t ? { Authorization: `Bearer ${t}` } : null; };

export default function FormularioInscricao({ politicaVersao }: { politicaVersao: string }) {
  const [logado, setLogado] = useState<boolean | null>(null);
  const [slug, setSlug] = useState(''); const [nome, setNome] = useState(''); const [descricao, setDescricao] = useState(''); const [canal, setCanal] = useState('');
  const [imagem, setImagem] = useState<string | null>(null); const [enviando, setEnviando] = useState(false); const [aceite, setAceite] = useState(false);
  const [disp, setDisp] = useState<Disp>({ tipo: 'vazio' }); const [erros, setErros] = useState<Record<string, string>>({}); const [erroGeral, setErroGeral] = useState('');
  const [feito, setFeito] = useState<Resultado | null>(null); const [salvando, setSalvando] = useState(false);
  const arquivo = useRef<HTMLInputElement>(null);

  useEffect(() => { setLogado(!!Cookies.get('access_token')); }, []);

  useEffect(() => {
    const s = slug.trim().replace(/^@/, '').toLowerCase();
    if (!s) { setDisp({ tipo: 'vazio' }); return; }
    const h = auth(); if (!h) return;
    setDisp({ tipo: 'checando' });
    const ctl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/v1/colaboradores/disponibilidade?slug=${encodeURIComponent(s)}`, { headers: h, signal: ctl.signal, cache: 'no-store' });
        const j = await r.json();
        setDisp(r.ok && j?.ok ? (j.disponivel ? { tipo: 'ok' } : { tipo: 'nao', motivo: String(j.motivo ?? 'Indisponível.') }) : { tipo: 'erro' });
      } catch (e) { if ((e as Error)?.name !== 'AbortError') setDisp({ tipo: 'erro' }); }
    }, 450);
    return () => { clearTimeout(t); ctl.abort(); };
  }, [slug]);

  async function enviarImagem(f: File | undefined) {
    if (!f) return; const h = auth(); if (!h) return;
    setErros((e) => ({ ...e, imagem_url: '' })); setEnviando(true);
    try {
      const data = await new Promise<string>((ok, no) => { const r = new FileReader(); r.onload = () => ok(String(r.result)); r.onerror = () => no(new Error('leitura')); r.readAsDataURL(f); });
      const r = await fetch('/api/v1/colaboradores/imagem', { method: 'POST', headers: { ...h, 'Content-Type': 'application/json' }, body: JSON.stringify({ imagem: data }) });
      const j = await r.json();
      if (r.ok && j?.ok) setImagem(String(j.url)); else setErros((e) => ({ ...e, imagem_url: String(j?.erro ?? 'Não foi possível enviar a imagem.') }));
    } catch { setErros((e) => ({ ...e, imagem_url: 'Não foi possível enviar a imagem.' })); } finally { setEnviando(false); }
  }

  async function enviar(ev: React.FormEvent) {
    ev.preventDefault(); const h = auth(); if (!h) return;
    setSalvando(true); setErros({}); setErroGeral('');
    try {
      const r = await fetch('/api/v1/colaboradores/inscricao', {
        method: 'POST', headers: { ...h, 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, nome, descricao: descricao || undefined, canal_url: canal, imagem_url: imagem ?? undefined, aceite, politica_versao: politicaVersao }),
      });
      const j = await r.json();
      if (r.ok && j?.ok) setFeito({ slug: j.colaborador.slug, codigoVerificacao: j.verificacao.codigo });
      else { setErros(j?.campos ?? {}); setErroGeral(String(j?.erro ?? 'Não foi possível concluir.')); }
    } catch { setErroGeral('Não foi possível concluir agora. Tente de novo.'); } finally { setSalvando(false); }
  }

  if (feito) {
    return (
      <div className="mt-8 rounded-2xl border border-teal-400/30 bg-teal-500/10 p-5 text-sm text-white/80" data-inscricao-feita>
        <p className="text-base font-semibold text-white">Sua página está no ar</p>
        <p className="mt-2">Ela já existe em <strong className="text-white">backfindr.com/@{feito.slug}</strong>, mas a comissão só é liberada depois que o Backfindr confirmar que você administra o grupo ou perfil informado.</p>
        <p className="mt-3">Para confirmar, publique este código no seu canal (ou coloque o link da página na bio do perfil):</p>
        <p className="mt-2 select-all rounded-lg bg-black/30 px-3 py-2 text-center font-mono text-lg tracking-wider text-teal-200">{feito.codigoVerificacao}</p>
        <p className="mt-3">Comissão: <strong className="text-white">em apuração</strong>.</p>
        <Link href="/dashboard/colaborador" className="mt-4 flex min-h-[44px] items-center justify-center rounded-xl bg-teal-500 px-4 font-semibold text-black hover:bg-teal-400">Ir para o meu painel</Link>
      </div>
    );
  }

  if (logado === false) {
    return (
      <div className="mt-8 rounded-2xl border border-white/10 p-5 text-sm text-white/75">
        <p>Para se inscrever, entre na sua conta do Backfindr (ou crie uma, é grátis).</p>
        <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Link href="/auth/login?next=/colaborador/seja" className="flex min-h-[44px] items-center justify-center rounded-xl bg-teal-500 px-4 font-semibold text-black hover:bg-teal-400">Entrar</Link>
          <Link href="/auth/register?next=/colaborador/seja" className="flex min-h-[44px] items-center justify-center rounded-xl bg-white/10 px-4 font-semibold text-white hover:bg-white/15">Criar conta</Link>
        </div>
      </div>
    );
  }

  const campo = 'mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-3 text-base text-white placeholder:text-white/30 focus:border-teal-400 focus:outline-none';
  return (
    <form onSubmit={enviar} className="mt-8 space-y-5" noValidate data-inscricao>
      <div>
        <label htmlFor="slug" className="block text-sm font-medium text-white">@nome da sua página</label>
        <div className="mt-1 flex items-center gap-2"><span className="text-white/50">backfindr.com/@</span>
          <input id="slug" value={slug} onChange={(e) => setSlug(e.target.value)} className={`${campo} !mt-0`} autoCapitalize="off" autoCorrect="off" maxLength={31} aria-describedby="slug-aviso" />
        </div>
        <p id="slug-aviso" className={`mt-1 text-xs ${disp.tipo === 'ok' ? 'text-teal-300' : disp.tipo === 'nao' ? 'text-red-300' : 'text-white/40'}`} aria-live="polite">
          {disp.tipo === 'ok' ? 'Disponível.' : disp.tipo === 'nao' ? disp.motivo : disp.tipo === 'checando' ? 'Verificando…' : disp.tipo === 'erro' ? 'Não foi possível verificar agora.' : 'De 3 a 30 caracteres: letras minúsculas, números e hífen. Depois de criado, não muda.'}
        </p>
        {erros.slug && <p className="mt-1 text-xs text-red-300">{erros.slug}</p>}
      </div>
      <div>
        <label htmlFor="nome" className="block text-sm font-medium text-white">Nome do grupo, perfil ou página</label>
        <input id="nome" value={nome} onChange={(e) => setNome(e.target.value)} className={campo} maxLength={80} />
        {erros.nome && <p className="mt-1 text-xs text-red-300">{erros.nome}</p>}
      </div>
      <div>
        <label htmlFor="descricao" className="block text-sm font-medium text-white">Descrição (opcional)</label>
        <textarea id="descricao" value={descricao} onChange={(e) => setDescricao(e.target.value)} className={campo} rows={3} maxLength={500} />
        {erros.descricao && <p className="mt-1 text-xs text-red-300">{erros.descricao}</p>}
      </div>
      <div>
        <label htmlFor="canal" className="block text-sm font-medium text-white">Endereço do seu grupo, perfil ou página (https)</label>
        <input id="canal" value={canal} onChange={(e) => setCanal(e.target.value)} className={campo} inputMode="url" autoCapitalize="off" placeholder="https://" />
        {erros.canal_url && <p className="mt-1 text-xs text-red-300">{erros.canal_url}</p>}
      </div>
      <div>
        <p className="text-sm font-medium text-white">Imagem do grupo ou perfil (opcional)</p>
        <input ref={arquivo} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" id="imagem" onChange={(e) => enviarImagem(e.target.files?.[0])} />
        <button type="button" onClick={() => arquivo.current?.click()} className="mt-1 flex min-h-[44px] items-center rounded-xl border border-white/15 px-4 text-sm text-white hover:bg-white/5" disabled={enviando}>
          {enviando ? 'Enviando…' : imagem ? 'Trocar imagem' : 'Escolher imagem (PNG, JPEG ou WebP, até 2 MB)'}
        </button>
        {imagem && <p className="mt-1 text-xs text-teal-300">Imagem enviada.</p>}
        {erros.imagem_url && <p className="mt-1 text-xs text-red-300">{erros.imagem_url}</p>}
      </div>
      <div className="rounded-xl border border-white/10 p-3">
        <label className="flex items-start gap-3 text-sm text-white/80">
          <input type="checkbox" checked={aceite} onChange={(e) => setAceite(e.target.checked)} className="mt-1 h-5 w-5" />
          <span>Li e aceito a <Link href="/colaborador/politica" target="_blank" className="underline underline-offset-2 hover:text-white">Política do Programa de Colaboradores</Link>.</span>
        </label>
        {erros.aceite && <p className="mt-1 text-xs text-red-300">{erros.aceite}</p>}
      </div>
      {erroGeral && <p className="rounded-xl border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-200" role="alert">{erroGeral}</p>}
      <button type="submit" disabled={salvando || !aceite} className="flex min-h-[48px] w-full items-center justify-center rounded-xl bg-teal-500 px-4 font-semibold text-black hover:bg-teal-400 disabled:opacity-50">
        {salvando ? 'Enviando…' : 'Criar minha página'}
      </button>
    </form>
  );
}
