'use client';
// Ícone de perfil no topo do Feed (decisão do Marcos: ícone de silhueta, sem texto «Entrar»).
// O HTML do servidor é o MESMO para todos: um link comum para /auth/login?ref=feed (existe sem JavaScript e o Feed segue indexável).
// Só no cliente, depois de montar, quem tem sessão válida passa a ver o link do painel do seu perfil (mesmo hook e mesma função de destino
// da tela de entrada: useSessaoExistente + getPostLoginRedirect). Em «indefinido»/«verificando» o ícone é o neutro (destino: entrar); nada se move.
import Link from 'next/link';
import { User } from 'lucide-react';
import { useSessaoExistente } from '@/hooks/useSessaoExistente';
import { getPostLoginRedirect } from '@/lib/redirectByRole';

export const PERFIL_HREF_VISITANTE = '/auth/login?ref=feed';

export function PerfilIcone() {
  const { estado, role } = useSessaoExistente();
  const logado = estado === 'logado';
  return (
    <Link
      href={logado ? getPostLoginRedirect(role) : PERFIL_HREF_VISITANTE}
      prefetch={false}
      aria-label={logado ? 'Meu painel' : 'Entrar'}
      data-feed-perfil={logado ? 'painel' : 'entrar'}
      className="inline-flex h-11 w-11 items-center justify-center rounded-full text-white/85 hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
    >
      <User className="h-5 w-5" aria-hidden="true" />
    </Link>
  );
}
