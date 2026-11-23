// Cartão de uma ocorrência na página do colaborador (componente de servidor). Mostra só os campos públicos do Feed (FeedItem) e leva à página
// de detalhes de sempre (/objeto/<código>). Sem dado pessoal, sem endereço exato, sem informação do colaborador.
import Link from 'next/link';
import { relativeTimeLabel } from '@/lib/feed/time';
import type { FeedItem } from '@/lib/feed/query';

const COR_SITUACAO: Record<string, string> = { lost: 'bg-amber-500/15 text-amber-200', found: 'bg-emerald-500/15 text-emerald-200', stolen: 'bg-red-500/15 text-red-200' };

export default function CartaoOcorrencia({ item, prioridade }: { item: FeedItem; prioridade: boolean }) {
  return (
    <li>
      <Link href={`/objeto/${encodeURIComponent(item.code)}`} className="flex min-h-[44px] gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3 hover:bg-white/[0.06]">
        {item.photo_url && (
          <span className="relative h-20 w-20 flex-shrink-0 overflow-hidden rounded-xl bg-white/5">
            {/* Miniatura própria (o componente de moldura do Feed é só do Feed, regra do teste feed-foto-moldura). */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={item.photo_url} alt={`Foto: ${item.title}`} loading={prioridade ? 'eager' : 'lazy'} decoding="async" referrerPolicy="no-referrer" className="h-full w-full object-cover" />
          </span>
        )}
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2 text-xs">
            <span className={`rounded-full px-2 py-0.5 font-medium ${COR_SITUACAO[item.status] ?? 'bg-white/10 text-white/70'}`}>{item.status_label}</span>
            <span className="text-white/50">{item.category_label}</span>
          </span>
          <span className="mt-1 block break-words font-medium leading-snug text-white">{item.title}</span>
          <span className="mt-1 block text-xs text-white/50">{item.location_label} · {relativeTimeLabel(item.created_at)}</span>
        </span>
      </Link>
    </li>
  );
}
