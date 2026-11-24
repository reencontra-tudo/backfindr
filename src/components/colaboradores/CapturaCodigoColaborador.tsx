'use client';
// Guarda, só nesta aba, o código do colaborador que chegou na URL (`?colab=`), para sobreviver ao cadastro/login (inclusive login com Google, que volta
// à mesma aba). Não renderiza nada. Só é montado no layout raiz quando o programa está ligado (COLABORADORES_ATIVO=1); desligado, não existe.
import { useEffect } from 'react';
import { codigoDaUrl, guardarCodigo } from '@/lib/colaboradores/cliente';

export default function CapturaCodigoColaborador() {
  useEffect(() => {
    const c = codigoDaUrl(window.location.search);
    if (c) guardarCodigo(c);
  }, []);
  return null;
}
