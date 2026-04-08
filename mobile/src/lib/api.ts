import axios, { AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import * as SecureStore from 'expo-secure-store';
import { AuthTokens } from '../types';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8000';

export const api: AxiosInstance = axios.create({
  baseURL: `${API_URL}/api/v1`,
  timeout: 15_000,
  headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
});

// ─── Request interceptor ──────────────────────────────────────────────────────
api.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  const token = await SecureStore.getItemAsync('access_token');
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ─── Response interceptor — refresh token ────────────────────────────────────
api.interceptors.response.use(
  (r) => r,
  async (error) => {
    if (error.response?.status === 401) {
      const refresh = await SecureStore.getItemAsync('refresh_token');
      if (refresh) {
        try {
          const { data } = await axios.post<AuthTokens>(
            `${API_URL}/api/v1/auth/refresh`,
            { refresh_token: refresh }
          );
          await setTokens(data);
          error.config.headers.Authorization = `Bearer ${data.access_token}`;
          return api(error.config);
        } catch {
          await clearTokens();
        }
      }
    }
    return Promise.reject(error);
  }
);

// ─── Token helpers ────────────────────────────────────────────────────────────
export const setTokens = async (tokens: AuthTokens) => {
  await SecureStore.setItemAsync('access_token', tokens.access_token);
  await SecureStore.setItemAsync('refresh_token', tokens.refresh_token);
};

export const clearTokens = async () => {
  await SecureStore.deleteItemAsync('access_token');
  await SecureStore.deleteItemAsync('refresh_token');
};

// ─── Auth ─────────────────────────────────────────────────────────────────────
export const authApi = {
  login:    (email: string, password: string) =>
    api.post<AuthTokens>('/auth/login', { username: email, password }),
  register: (payload: { name: string; email: string; password: string; phone?: string }) =>
    api.post('/auth/register', payload),
  me:       () => api.get('/users/me'),
};

// ─── Objects ──────────────────────────────────────────────────────────────────
export const objectsApi = {
  list:   (params?: object) => api.get('/objects', { params }),
  get:    (id: string)      => api.get(`/objects/${id}`),
  scan:   (code: string)    => api.get(`/objects/scan/${code}`),
  create: (form: FormData)  =>
    api.post('/objects', form, { headers: { 'Content-Type': 'multipart/form-data' } }),
  update: (id: string, payload: object) => api.patch(`/objects/${id}`, payload),
  delete: (id: string)      => api.delete(`/objects/${id}`),
  notify: (code: string)    => api.post(`/objects/scan/${code}/notify`),
};

// ─── Matches ──────────────────────────────────────────────────────────────────
export const matchesApi = {
  list:    () => api.get('/matches'),
  confirm: (id: string) => api.post(`/matches/${id}/confirm`),
  reject:  (id: string) => api.post(`/matches/${id}/reject`),
};

export const parseApiError = (error: unknown): string => {
  if (axios.isAxiosError(error)) return error.response?.data?.detail ?? error.message;
  if (error instanceof Error) return error.message;
  return 'Erro desconhecido';
};
