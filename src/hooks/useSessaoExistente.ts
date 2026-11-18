'use client';

import { useEffect, useLayoutEffect, useState } from 'react';
import Cookies from 'js-cookie';
import { useAuthStore } from '@/hooks/useAuth';

const useIsoLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

/** Há cookie de login neste aparelho? (só olha se existe; não lê nem expõe o valor) */
export function temCookieDeLogin(): boolean {
  try { return !!(Cookies.get('access_token') || Cookies.get('refresh_token')); } catch { return false; }
}

export type EstadoSessao = 'indefinido' | 'verificando' | 'logado' | 'visitante';

/**
 * Descobre, SÓ NO CLIENTE e depois de montar, se já existe uma sessão válida.
 * - 'indefinido': servidor e primeira renderização do cliente (idênticos para todos: sem diferença de hidratação).
 * - sem cookie: 'visitante', sem nenhuma chamada.
 * - com cookie: 'verificando' (antes da pintura) e confirma no servidor (fetchMe; a renovação com o refresh_token é automática no interceptor).
 *   401 → o fetchMe limpa os tokens → 'visitante' (comportamento de hoje).
 */
export function useSessaoExistente(ativo = true): { estado: EstadoSessao; role: string | null } {
  const [estado, setEstado] = useState<EstadoSessao>('indefinido');
  const [role, setRole] = useState<string | null>(null);

  useIsoLayoutEffect(() => {
    if (!ativo || !temCookieDeLogin()) { setEstado('visitante'); return; }
    setEstado('verificando');
    let vivo = true;
    useAuthStore.getState().fetchMe().finally(() => {
      if (!vivo) return;
      const { isAuthenticated, user } = useAuthStore.getState();
      if (isAuthenticated && user) { setRole(user.role ?? null); setEstado('logado'); } else setEstado('visitante');
    });
    return () => { vivo = false; };
  }, [ativo]);

  return { estado, role };
}
