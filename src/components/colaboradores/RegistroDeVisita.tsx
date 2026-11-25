'use client';
// Soma uma visita à página do colaborador (E8). SEM cookie (`credentials: 'omit'`), SEM identificador, SEM IP guardado: só o @nome vai no pedido. Roda uma vez por abertura da página.
import { useEffect } from 'react';

export default function RegistroDeVisita({ slug }: { slug: string }) {
  useEffect(() => {
    try { void fetch('/api/v1/colaboradores/visita', { method: 'POST', credentials: 'omit', keepalive: true, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ slug }) }); } catch { /* contagem é opcional */ }
  }, [slug]);
  return null;
}
