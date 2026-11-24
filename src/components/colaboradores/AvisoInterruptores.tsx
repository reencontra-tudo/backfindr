'use client';
// Aviso no painel do admin quando COLABORADORES_ATIVO e NEXT_PUBLIC_COLABORADORES_ATIVO estão diferentes. Não renderiza NADA quando estão iguais
// (ou quando a consulta falha, ou quando a pessoa não é admin): nenhum comportamento existente do painel muda.
// Uma consulta leve por aba a cada 10 minutos (sessionStorage), só para o painel do admin.
import { useEffect, useState } from 'react';
import { textoDoAviso, type EstadoInterruptores } from '@/lib/colaboradores/interruptores';

const CHAVE = 'bf_colab_interruptores';
const VALIDADE_MS = 10 * 60 * 1000;

function lerCache(): EstadoInterruptores | null {
  try {
    const bruto = sessionStorage.getItem(CHAVE); if (!bruto) return null;
    const j = JSON.parse(bruto) as { em: number; e: EstadoInterruptores };
    return Date.now() - j.em < VALIDADE_MS ? j.e : null;
  } catch { return null; }
}

export default function AvisoInterruptores() {
  const [estado, setEstado] = useState<EstadoInterruptores | null>(null);
  useEffect(() => {
    const c = lerCache(); if (c) { setEstado(c); return; }
    let vivo = true;
    fetch('/api/v1/admin/colaboradores/interruptores', { cache: 'no-store', credentials: 'same-origin' })
      .then((r) => (r.ok ? r.json() : null))
      .then((e: EstadoInterruptores | null) => {
        if (!e || typeof e.divergente !== 'boolean') return;
        try { sessionStorage.setItem(CHAVE, JSON.stringify({ em: Date.now(), e })); } catch { /* sem cache */ }
        if (vivo) setEstado(e);
      })
      .catch(() => { /* silencioso: o painel segue como sempre */ });
    return () => { vivo = false; };
  }, []);
  if (!estado?.divergente) return null;
  return (
    <div role="alert" data-aviso-interruptores className="mx-4 mt-4 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-200 md:mx-6">
      {textoDoAviso(estado)}
    </div>
  );
}
