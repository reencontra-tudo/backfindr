'use client';
// Campo opcional e discreto «Código do colaborador» do cadastro de ocorrência (Programa de Colaboradores, E1).
// Ao digitar (ou vir preenchido pelo link), valida no servidor e mostra o nome para confirmação. Nunca bloqueia o cadastro por conta própria:
// o servidor é quem decide; um código inválido é recusado lá, com mensagem clara, e a pessoa pode apagar o campo.
import { useEffect, useState } from 'react';
import { codigoValido } from '@/lib/colaboradores/cliente';

type Estado = { tipo: 'vazio' } | { tipo: 'checando' } | { tipo: 'ok'; nome: string } | { tipo: 'invalido' } | { tipo: 'erro' };

export default function CampoCodigoColaborador({ valor, onChange, erroServidor }: { valor: string; onChange: (v: string) => void; erroServidor?: boolean }) {
  const [estado, setEstado] = useState<Estado>({ tipo: 'vazio' });

  useEffect(() => {
    const v = (valor ?? '').trim();
    if (!v) { setEstado({ tipo: 'vazio' }); return; }
    if (!codigoValido(v)) { setEstado({ tipo: 'invalido' }); return; }
    setEstado({ tipo: 'checando' });
    const ctl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/v1/colaboradores/validar?codigo=${encodeURIComponent(v)}`, { signal: ctl.signal, cache: 'no-store' });
        if (!r.ok) { setEstado({ tipo: 'erro' }); return; }
        const j = await r.json();
        setEstado(j?.ok && typeof j.nome === 'string' ? { tipo: 'ok', nome: j.nome } : { tipo: 'invalido' });
      } catch (e) { if ((e as Error)?.name !== 'AbortError') setEstado({ tipo: 'erro' }); }
    }, 400);
    return () => { clearTimeout(t); ctl.abort(); };
  }, [valor]);

  const mostrarInvalido = estado.tipo === 'invalido' || (erroServidor && estado.tipo !== 'ok');
  return (
    <div className="mt-6 rounded-xl border border-surface-border p-3" data-campo-colaborador>
      <label htmlFor="colaborador_codigo" className="block text-xs text-slate-400">Código do colaborador (opcional)</label>
      <input
        id="colaborador_codigo"
        name="colaborador_codigo"
        type="text"
        inputMode="text"
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        maxLength={31}
        value={valor ?? ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder="@nome ou código curto"
        className="mt-1 w-full rounded-lg border border-surface-border bg-transparent px-3 py-2 text-sm text-white placeholder:text-slate-600"
        aria-describedby="colaborador_codigo_estado"
      />
      <p id="colaborador_codigo_estado" role="status" className="mt-1 min-h-[1rem] text-xs">
        {estado.tipo === 'checando' && <span className="text-slate-500">Conferindo…</span>}
        {estado.tipo === 'ok' && <span className="text-emerald-300">Colaborador: {estado.nome}</span>}
        {mostrarInvalido && <span className="text-red-300">Código não encontrado ou inativo. Confira ou apague o campo.</span>}
        {estado.tipo === 'erro' && !mostrarInvalido && <span className="text-slate-500">Não foi possível conferir agora. O servidor confere de novo ao registrar.</span>}
      </p>
    </div>
  );
}
