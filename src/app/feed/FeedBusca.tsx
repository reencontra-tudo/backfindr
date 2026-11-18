'use client';
// Campo de busca do Feed (só aparece depois que a pessoa toca em «Buscar»; fechado, não ocupa nada no topo) e o link «Buscar» do topo.
// O texto digitado fica SÓ neste estado: nunca na URL, nunca em evento de analítica.
import type { RefObject } from 'react';
import { Search, X } from 'lucide-react';
import { T } from './tema';
import { BUSCA_MAX_CARACTERES, abrirBuscaDoFeed } from '@/lib/feed/consulta';

/** Link «Buscar» do topo: abre/foca o campo (sem JavaScript, leva ao topo do Feed). O HTML do servidor é o mesmo para todos. */
export function BuscarLinkTopo() {
  return (
    <a href="/feed#busca" onClick={(e) => { e.preventDefault(); abrirBuscaDoFeed(); }} data-feed-buscar-topo
      className="inline-flex min-h-[44px] items-center px-3 text-white/85 hover:text-white">Buscar</a>
  );
}

export function FeedBuscaCampo({ valor, onChange, onFechar, inputRef }: {
  valor: string; onChange: (v: string) => void; onFechar: () => void; inputRef: RefObject<HTMLInputElement>;
}) {
  return (
    <form role="search" id="busca" data-feed-busca onSubmit={(e) => e.preventDefault()}
      className={`mb-2 flex items-center gap-2 rounded-xl border px-3 ${T.borda} bg-[color:var(--f-campo)] focus-within:ring-2 focus-within:ring-[color:var(--f-foco)]`}>
      <Search className={`h-5 w-5 shrink-0 ${T.t3}`} aria-hidden />
      <input ref={inputRef} type="search" value={valor} maxLength={BUSCA_MAX_CARACTERES} enterKeyHint="search"
        autoComplete="off" autoCorrect="off" spellCheck={false}
        aria-label="Buscar ocorrências" placeholder="Ex.: óculos de grau, chave com chaveiro"
        onChange={(e) => onChange(e.target.value)} onKeyDown={(e) => { if (e.key === 'Escape') onFechar(); }}
        className={`min-h-[44px] min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-[color:var(--f-t3)] [&::-webkit-search-cancel-button]:hidden ${T.t1}`} />
      <button type="button" onClick={onFechar} aria-label="Fechar busca"
        className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg focus:outline-none focus:ring-2 ${T.t2} ${T.hover} ${T.foco}`}>
        <X className="h-5 w-5" aria-hidden />
      </button>
    </form>
  );
}
