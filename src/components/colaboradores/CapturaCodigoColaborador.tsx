'use client';
// Guarda, só nesta aba, o código do colaborador que chegou na URL (`?colab=`), para sobreviver ao cadastro/login (inclusive login com Google, que volta
// à mesma aba). Não renderiza nada. Só é montado no layout raiz quando o programa está ligado (NEXT_PUBLIC_COLABORADORES_ATIVO=1); desligado, não existe.
// Roda a cada mudança de página (o layout raiz continua montado quando a pessoa navega por um link do site, ex.: do botão da página do colaborador
// para /flow/found?colab=…); `usePathname` não exige limite de Suspense, então não afeta a renderização estática das páginas.
import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { codigoDaUrl, guardarCodigo } from '@/lib/colaboradores/cliente';

export default function CapturaCodigoColaborador() {
  const caminho = usePathname();
  useEffect(() => {
    const c = codigoDaUrl(window.location.search);
    if (c) guardarCodigo(c);
  }, [caminho]);
  return null;
}
