import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { User } from '@/types';
import { authApi, setTokens, clearTokens, parseApiError } from '@/lib/api';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (p: { name: string; email: string; password: string; phone?: string }) => Promise<void>;
  logout: () => Promise<void>;
  fetchMe: () => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null, isAuthenticated: false, isLoading: false, error: null,
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
        try { await authApi.logout(); } finally { clearTokens(); set({ user: null, isAuthenticated: false }); }
      },
      fetchMe: async () => {
        try { const { data } = await authApi.me(); set({ user: data, isAuthenticated: true }); }
        catch { clearTokens(); set({ user: null, isAuthenticated: false }); }
      },
      clearError: () => set({ error: null }),
    }),
    { name: 'backfindr-auth', partialize: (s) => ({ user: s.user, isAuthenticated: s.isAuthenticated }) }
  )
);
