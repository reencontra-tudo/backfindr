'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSessaoExistente } from '@/hooks/useSessaoExistente';
import { getPostLoginRedirect } from '@/lib/redirectByRole';
import { consumirProximaPagina } from '@/lib/proximaPagina';
import { destinoLogadoComIntent } from '@/lib/intencaoCadastro';

/** Parâmetros que indicam um fluxo em andamento (erro de login, plano, contexto de «achei»): nesses casos a tela segue como sempre.
 *  `ref` NÃO entra: é só a origem do clique (ex.: ?ref=feed do ícone de perfil); nenhuma tela de entrada muda por causa dele. */
export const PARAMS_QUE_DESLIGAM = ['error', 'plan', 'de'] as const;

export function deveRedirecionar(params: { has: (nome: string) => boolean }): boolean {
  return !PARAMS_QUE_DESLIGAM.some((p) => params.has(p));
}

/**
 * Tela de entrada (login, cadastro): quem já tem sessão válida vai direto ao destino por perfil, sem ver o formulário.
 * Sem sessão, com 401 ou com falha de rede: o formulário de sempre. O estado é decidido só no cliente, depois de montar
 * (servidor e primeira renderização iguais); com cookie de login o formulário nem chega a ser pintado.
 */
export function PortaDeEntrada({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const params = useSearchParams();
  const ativo = deveRedirecionar(params);
  const { estado, role } = useSessaoExistente(ativo);

  useEffect(() => {
    // Quem já está logado e veio de um fluxo (`intent`) vai ao formulário de ocorrência com o pré-preenchimento; sem `intent`, ao destino por perfil.
    // Precedência: o destino guardado de aviso/QR (proximaPagina) continua valendo primeiro; plan/error/de desligam a porta (ativo = false).
    if (ativo && estado === 'logado') router.replace(consumirProximaPagina() ?? destinoLogadoComIntent(params) ?? getPostLoginRedirect(role));
  }, [ativo, estado, role, router, params]);

  if (ativo && (estado === 'verificando' || estado === 'logado')) {
    return (
      <div className="min-h-screen bg-[#080b0f] flex items-center justify-center" data-porta-de-entrada="verificando">
        <div className="w-8 h-8 border-2 border-teal-400 border-t-transparent rounded-full animate-spin" role="status" aria-label="Entrando" />
      </div>
    );
  }
  return <>{children}</>;
}
