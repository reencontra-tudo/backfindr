// Página /objeto/[code] de um SINAL PÚBLICO (ocorrência extraída de notícia pública): não há dono cadastrado no Backfindr,
// então a tela NÃO oferece «Avisar o dono» e diz de onde veio o conteúdo, com o link da fonte à vista.
// Sem promessa de contato protegido, SMS, chat protegido, resposta da fonte ou aviso a dono. Objetos de usuário e do legado não usam este arquivo.
import Link from 'next/link';
import { ExternalLink, Newspaper } from 'lucide-react';
import type { SignalSource } from '@/lib/feed/signalSource';

export const SINAL_TITULO = 'Ocorrência extraída de notícia pública';
export const SINAL_TITULO_SEM_FONTE = 'Ocorrência extraída de publicação pública';
export const SINAL_TEXTO = 'Este conteúdo foi extraído de uma notícia pública. Não há dono cadastrado no Backfindr para este registro. Se quiser tentar contato, procure a fonte original e, se a notícia citar uma autoridade ou instituição, procure por ela.';
export const SINAL_TEXTO_SEM_FONTE = 'Este conteúdo foi extraído de uma publicação pública que não conseguimos identificar. Não há dono cadastrado no Backfindr para este registro.';
export const SINAL_BOTAO_FONTE = 'Ver a notícia original';
export const SINAL_BOTAO_AGREGADOR = 'Abrir no Google Notícias';
export const SINAL_BOTAO_CADASTRAR = 'Cadastrar minha ocorrência';

/** Cadastro da PRÓPRIA ocorrência (fluxo que já existe, com conta): quem vê um «achado» pode ter perdido algo, e vice-versa. Só a categoria é preenchida. */
export function cadastroHref(status: string, category: string): string {
  const intent = status === 'found' ? 'lost' : 'found';
  return `/auth/register?intent=${intent}&prefill_category=${encodeURIComponent(category || 'other')}`;
}

const botaoPrincipal = 'w-full flex items-center justify-center gap-3 bg-teal-500 hover:bg-teal-400 active:bg-teal-600 text-white font-bold py-4 rounded-xl transition-all text-base';
const botaoSecundario = 'w-full flex items-center justify-center gap-2 bg-white/[0.05] border border-white/[0.1] hover:bg-white/[0.08] text-white/80 font-semibold py-3 rounded-xl transition-colors text-sm';

/** Faixa no topo (no lugar de «Objeto registrado na rede Backfindr… avisar o dono»). */
export function SinalPublicoBanner({ source }: { source: SignalSource | null }) {
  return (
    <div className="bg-teal-500/[0.08] border border-teal-500/[0.18] rounded-2xl px-5 py-4 mb-6 flex items-start gap-3" data-sinal-publico>
      <div className="w-8 h-8 rounded-lg bg-teal-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
        <Newspaper className="w-4 h-4 text-teal-400" aria-hidden />
      </div>
      <div>
        <p className="text-teal-300 text-sm font-semibold mb-0.5">{source ? SINAL_TITULO : SINAL_TITULO_SEM_FONTE}</p>
        <p className="text-white/60 text-sm leading-relaxed">{source ? SINAL_TEXTO : SINAL_TEXTO_SEM_FONTE}</p>
      </div>
    </div>
  );
}

/** Ações (no lugar do botão «Avisar o dono que encontrei» e da nota «O dono recebe um aviso»). */
export function SinalPublicoAcao({ source, status, category }: { source: SignalSource | null; status: string; category: string }) {
  const cadastrar = cadastroHref(status, category);
  if (!source) {
    return (
      <div className="space-y-3">
        <Link href={cadastrar} prefetch={false} className={botaoPrincipal} data-sinal-cadastrar>{SINAL_BOTAO_CADASTRAR}</Link>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      <a href={source.url} target="_blank" rel="noopener noreferrer nofollow" className={botaoPrincipal} data-sinal-fonte-link>
        <ExternalLink className="w-5 h-5" aria-hidden />
        {source.agregador ? SINAL_BOTAO_AGREGADOR : SINAL_BOTAO_FONTE}
      </a>
      {source.name && <p className="text-white/50 text-xs text-center" data-sinal-fonte-nome>Fonte: {source.name}</p>}
      <Link href={cadastrar} prefetch={false} className={botaoSecundario} data-sinal-cadastrar>{SINAL_BOTAO_CADASTRAR}</Link>
    </div>
  );
}
