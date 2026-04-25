'use client';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/hooks/useAuth';
import { Eye, X, ArrowLeft } from 'lucide-react';

/**
 * Banner fixo no topo da tela quando o super_admin está navegando
 * como outro usuário (impersonation). Exibe o nome do usuário alvo
 * e um botão para encerrar a sessão e voltar ao painel admin.
 */
export default function ImpersonationBanner() {
  const { impersonating, impersonatedUser, impersonatedByEmail, stopImpersonation } = useAuthStore();
  const router = useRouter();

  if (!impersonating || !impersonatedUser) return null;

  function handleStop() {
    stopImpersonation();
    router.replace('/admin/users');
  }

  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] bg-amber-500 text-black flex items-center justify-between px-4 py-2 shadow-lg">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Eye className="w-4 h-4 flex-shrink-0" />
        <span>
          Você está navegando como{' '}
          <strong>{impersonatedUser.name || impersonatedUser.email}</strong>
          {impersonatedByEmail && (
            <span className="font-normal opacity-70"> (iniciado por {impersonatedByEmail})</span>
          )}
        </span>
      </div>
      <button
        onClick={handleStop}
        className="flex items-center gap-1.5 bg-black/20 hover:bg-black/30 text-black text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors flex-shrink-0"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Voltar ao admin
      </button>
    </div>
  );
}
