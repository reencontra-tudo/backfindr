import { create } from 'zustand';
import { User } from '../types';
import { authApi, setTokens, clearTokens, parseApiError } from '../lib/api';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (payload: { name: string; email: string; password: string; phone?: string }) => Promise<void>;
  logout: () => Promise<void>;
  fetchMe: () => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,

  login: async (email, password) => {
    set({ isLoading: true, error: null });
    try {
      const { data: tokens } = await authApi.login(email, password);
      await setTokens(tokens);
      await get().fetchMe();
      set({ isAuthenticated: true });
    } catch (err) {
      set({ error: parseApiError(err), isAuthenticated: false });
      throw err;
    } finally {
      set({ isLoading: false });
    }
  },

  register: async (payload) => {
    set({ isLoading: true, error: null });
    try {
      await authApi.register(payload);
      await get().login(payload.email, payload.password);
    } catch (err) {
      set({ error: parseApiError(err) });
      throw err;
    } finally {
      set({ isLoading: false });
    }
  },

  logout: async () => {
    await clearTokens();
    set({ user: null, isAuthenticated: false });
  },

  fetchMe: async () => {
    try {
      const { data } = await authApi.me();
      set({ user: data, isAuthenticated: true });
    } catch {
      await clearTokens();
      set({ user: null, isAuthenticated: false });
    }
  },

  clearError: () => set({ error: null }),
}));
