import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { User } from '@/types';
import { authApi, setTokens, clearTokens, parseApiError } from '@/lib/api';
import Cookies from 'js-cookie';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  // Impersonation
  impersonating: boolean;
  impersonatedUser: User | null;
  impersonatedByEmail: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (p: { name: string; email: string; password: string; phone?: string }) => Promise<void>;
  logout: () => Promise<void>;
  fetchMe: () => Promise<void>;
  clearError: () => void;
  // Impersonation actions
  startImpersonation: (userId: string) => Promise<void>;
  stopImpersonation: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null, isAuthenticated: false, isLoading: false, error: null,
      impersonating: false, impersonatedUser: null, impersonatedByEmail: null,

      login: async (email, password) => {
        set({ isLoading: true, error: null });
        try {
          const { data: tokens } = await authApi.login(email, password);
          setTokens(tokens);
          await get().fetchMe();
          set({ isAuthenticated: true });
        } catch (e) { set({ error: parseApiError(e) }); throw e; }
        finally { set({ isLoading: false }); }
      },

      register: async (p) => {
        set({ isLoading: true, error: null });
        try { await authApi.register(p); await get().login(p.email, p.password); }
        catch (e) { set({ error: parseApiError(e) }); throw e; }
        finally { set({ isLoading: false }); }
      },

      logout: async () => {
        // Se estiver em impersonation, parar antes de fazer logout real
        if (get().impersonating) {
          get().stopImpersonation();
          return;
        }
        try { await authApi.logout(); } finally { clearTokens(); set({ user: null, isAuthenticated: false }); }
      },

      fetchMe: async () => {
        try { const { data } = await authApi.me(); set({ user: data, isAuthenticated: true }); }
        catch { clearTokens(); set({ user: null, isAuthenticated: false }); }
      },

      clearError: () => set({ error: null }),

      /**
       * Inicia impersonation de um usuário.
       * Salva o token original do super_admin e substitui pelo token temporário do alvo.
       */
      startImpersonation: async (userId: string) => {
        set({ isLoading: true });
        try {
          const currentToken = Cookies.get('access_token');
          const currentRefresh = Cookies.get('refresh_token');

          const res = await fetch('/api/v1/admin/impersonate', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${currentToken}`,
            },
            body: JSON.stringify({ user_id: userId }),
          });

          if (!res.ok) {
            const err = await res.json();
            throw new Error(err.detail || 'Erro ao iniciar impersonation');
          }

          const data = await res.json() as {
            access_token: string;
            target_user: User;
          };

          // Salvar tokens originais do super_admin
          if (currentToken) {
            sessionStorage.setItem('impersonation_original_token', currentToken);
          }
          if (currentRefresh) {
            sessionStorage.setItem('impersonation_original_refresh', currentRefresh);
          }
          sessionStorage.setItem('impersonation_original_user', JSON.stringify(get().user));

          // Decodificar o token para obter o email do super_admin que iniciou
          let impersonatedByEmail: string | null = null;
          try {
            const payload = JSON.parse(atob(data.access_token.split('.')[1]));
            impersonatedByEmail = payload.impersonated_by_email ?? null;
          } catch { /* ignora */ }

          // Substituir token pelo token de impersonation
          Cookies.set('access_token', data.access_token, { expires: 1/12 }); // 2h
          Cookies.remove('refresh_token');

          set({
            impersonating: true,
            impersonatedUser: data.target_user,
            impersonatedByEmail,
            user: data.target_user,
          });
        } catch (e) {
          throw e;
        } finally {
          set({ isLoading: false });
        }
      },

      /**
       * Para a impersonation e restaura a sessão original do super_admin.
       */
      stopImpersonation: () => {
        const originalToken   = sessionStorage.getItem('impersonation_original_token');
        const originalRefresh = sessionStorage.getItem('impersonation_original_refresh');
        const originalUserStr = sessionStorage.getItem('impersonation_original_user');

        sessionStorage.removeItem('impersonation_original_token');
        sessionStorage.removeItem('impersonation_original_refresh');
        sessionStorage.removeItem('impersonation_original_user');

        if (originalToken) {
          Cookies.set('access_token', originalToken, { expires: 1 });
        }
        if (originalRefresh) {
          Cookies.set('refresh_token', originalRefresh, { expires: 30 });
        }

        let originalUser: User | null = null;
        if (originalUserStr) {
          try { originalUser = JSON.parse(originalUserStr); } catch { /* ignora */ }
        }

        set({
          impersonating: false,
          impersonatedUser: null,
          impersonatedByEmail: null,
          user: originalUser,
          isAuthenticated: !!originalUser,
        });
      },
    }),
    {
      name: 'backfindr-auth',
      partialize: (s) => ({ user: s.user, isAuthenticated: s.isAuthenticated }),
    }
  )
);
