// Texto OFICIAL da política (src/content/politicaColaboradores.ts, copiado de docs/programa-colaboradores/POLITICA.md). Só renderiza; não altera nada.
import { POLITICA_SECOES, POLITICA_TITULO, POLITICA_VERSAO, type BlocoPolitica } from '@/content/politicaColaboradores';

/** Negrito `**texto**` do documento oficial (único recurso de formatação usado); o resto é texto puro, sempre escapado pelo React. */
function comNegrito(t: string) {
  return t.split(/(\*\*[^*]+\*\*)/g).map((p, i) => (p.startsWith('**') && p.endsWith('**') ? <strong key={i} className="font-semibold text-white">{p.slice(2, -2)}</strong> : <span key={i}>{p}</span>));
}

function Bloco({ b }: { b: BlocoPolitica }) {
  if (b.tipo === 'li') return <li className="ml-5 list-disc pl-1">{comNegrito(b.texto)}</li>;
  if (b.tipo === 'check') return <li className="ml-5 list-none pl-1 text-white/50">☐ {comNegrito(b.texto)}</li>;
  return <p>{comNegrito(b.texto)}</p>;
}

export default function PoliticaTexto({ ids = false }: { ids?: boolean }) {
  return (
    <article className="space-y-6 text-sm leading-relaxed text-white/75" data-politica data-versao={POLITICA_VERSAO}>
      <h1 className="text-2xl font-bold text-white">{POLITICA_TITULO}</h1>
      {POLITICA_SECOES.map((s, i) => {
        const itens = s.blocos.filter((b) => b.tipo !== 'p');
        return (
          <section key={s.titulo} id={ids ? `secao-${i + 1}` : undefined} className="space-y-2">
            <h2 className="text-base font-semibold text-white">{s.titulo}</h2>
            {s.blocos.map((b, j) => (b.tipo === 'p' ? <Bloco key={j} b={b} /> : j === s.blocos.findIndex((x) => x.tipo !== 'p') ? <ul key={j} className="space-y-1">{itens.map((it, k) => <Bloco key={k} b={it} />)}</ul> : null))}
          </section>
        );
      })}
    </article>
  );
}
