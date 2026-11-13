"use client";
// Cartão do Dashboard: quantos cards o Feed pode mostrar hoje (somente leitura). Os números vêm de /api/v1/admin/feed/stats,
// que usa a mesma regra de elegibilidade do Feed. O número é lido na hora; o Feed público pode levar até 5 minutos para refletir.
import { useEffect, useState } from "react";
import { ExternalLink, Newspaper } from "lucide-react";

interface PorStatus { total: number; lost: number; found: number; stolen: number }
interface FeedCounts { total: number; usuarios: PorStatus; sinais_publicos: PorStatus; por_status: PorStatus; teto_do_feed: number; acima_do_teto: boolean }

const fmt = (n: number) => n.toLocaleString("pt-BR");

export default function FeedStatsCard() {
  const [data, setData] = useState<FeedCounts | null>(null);
  const [erro, setErro] = useState(false);

  useEffect(() => {
    let vivo = true;
    fetch("/api/v1/admin/feed/stats")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d) => { if (vivo) setData(d); })
      .catch(() => { if (vivo) setErro(true); });
    return () => { vivo = false; };
  }, []);

  return (
    <section aria-label="Feed: ocorrências elegíveis" className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5" data-admin-feed-stats>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-white">
          <Newspaper className="h-4 w-4 text-teal-400" aria-hidden />
          Feed: ocorrências elegíveis
        </h2>
        <a href="/feed" target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs text-white/40 transition-colors hover:text-teal-300">
          Abrir o Feed <ExternalLink className="h-3 w-3" aria-hidden />
        </a>
      </div>
      {erro ? (
        <p className="text-xs text-amber-300">Não foi possível carregar a contagem agora.</p>
      ) : !data ? (
        <p className="text-xs text-white/30">Carregando…</p>
      ) : (
        <div className="space-y-4">
          <div>
            <p className="text-3xl font-bold text-white" data-feed-total>{fmt(data.total)}</p>
            <p className="mt-0.5 text-xs text-white/35">
              cards que o Feed pode mostrar (públicos, perdidos, achados ou roubados, sem legado)
            </p>
          </div>
          <dl className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-5">
            <Item rotulo="Usuários" valor={data.usuarios.total} />
            <Item rotulo="Sinais públicos" valor={data.sinais_publicos.total} />
            <Item rotulo="Perdidos" valor={data.por_status.lost} />
            <Item rotulo="Achados" valor={data.por_status.found} />
            <Item rotulo="Roubados" valor={data.por_status.stolen} />
          </dl>
          <div className="grid gap-1 text-[11px] text-white/35">
            <p>Usuários: {fmt(data.usuarios.lost)} perdidos · {fmt(data.usuarios.found)} achados · {fmt(data.usuarios.stolen)} roubados</p>
            <p>Sinais públicos: {fmt(data.sinais_publicos.lost)} perdidos · {fmt(data.sinais_publicos.found)} achados · {fmt(data.sinais_publicos.stolen)} roubados</p>
          </div>
          {data.acima_do_teto && (
            <p className="text-xs text-amber-300">O Feed lê no máximo {fmt(data.teto_do_feed)} cards por vez; os mais antigos ficam de fora da lista.</p>
          )}
        </div>
      )}
    </section>
  );
}

function Item({ rotulo, valor }: { rotulo: string; valor: number }) {
  return (
    <div className="rounded-xl bg-white/[0.03] px-3 py-2">
      <dt className="text-white/35">{rotulo}</dt>
      <dd className="mt-0.5 text-base font-semibold text-white">{fmt(valor)}</dd>
    </div>
  );
}
