'use client';
import { useEffect, useState } from 'react';
import Cookies from 'js-cookie';
import { useRouter } from 'next/navigation';
import { LogOut, Eye } from 'lucide-react';

export function ImpersonationBanner() {
  const [visible, setVisible] = useState(false);
  const router = useRouter();

  useEffect(() => {
    setVisible(!!Cookies.get('admin_token'));
  }, []);

  if (!visible) return null;

  const handleExit = () => {
    const adminToken = Cookies.get('admin_token');
    const adminRefresh = Cookies.get('admin_refresh_token');
    if (adminToken) {
      Cookies.set('access_token', adminToken, { expires: 30, sameSite: 'lax' });
      Cookies.remove('admin_token');
    }
    if (adminRefresh) {
      Cookies.set('refresh_token', adminRefresh, { expires: 30, sameSite: 'lax' });
      Cookies.remove('admin_refresh_token');
    }
    router.push('/admin/users');
  };

  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] bg-orange-500 text-black px-4 py-2 flex items-center justify-between text-sm font-semibold">
      <div className="flex items-center gap-2">
        <Eye className="w-4 h-4" />
        <span>Modo Impersonation ativo — você está visualizando como outro usuário</span>
      </div>
      <button
        onClick={handleExit}
        className="flex items-center gap-1.5 bg-black/20 hover:bg-black/30 px-3 py-1 rounded-lg transition-all"
      >
        <LogOut className="w-3.5 h-3.5" />
        Sair
      </button>
    </div>
  );
}
