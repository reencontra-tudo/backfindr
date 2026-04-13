import axios, { AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import Cookies from 'js-cookie';
import { AuthTokens } from '@/types';

// URL relativa: funciona em todos os domínios (backfindr.app, backfindr.com, backfindr.com.br, etc.)
const API_URL = '';

export const api: AxiosInstance = axios.create({
  baseURL: `${API_URL}/api/v1`,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = Cookies.get('access_token');
  if (token && config.headers) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

let isRefreshing = false;
let queue: { resolve: (v: string) => void; reject: (e: unknown) => void }[] = [];

const processQueue = (error: unknown, token: string | null = null) => {
  queue.forEach(({ resolve, reject }) => error ? reject(error) : resolve(token!));
  queue = [];
};

api.interceptors.response.use(
  (r) => r,
  async (error) => {
    const original = error.config as InternalAxiosRequestConfig & { _retry?: boolean };
    if (error.response?.status === 401 && !original._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => queue.push({ resolve, reject }))
          .then((token) => { original.headers.Authorization = `Bearer ${token}`; return api(original); });
      }
      original._retry = true;
      isRefreshing = true;
      const refresh = Cookies.get('refresh_token');
      if (!refresh) { clearTokens(); if (typeof window !== 'undefined') window.location.href = '/auth/login'; return Promise.reject(error); }
      try {
        const { data } = await axios.post<AuthTokens>(`${API_URL}/api/v1/auth/refresh`, { refresh_token: refresh });
        setTokens(data);
        processQueue(null, data.access_token);
        original.headers.Authorization = `Bearer ${data.access_token}`;
        return api(original);
      } catch (e) {
        processQueue(e, null);
        clearTokens();
        if (typeof window !== 'undefined') window.location.href = '/auth/login';
        return Promise.reject(e);
      } finally {
        isRefreshing = false;
      }
    }
    return Promise.reject(error);
  }
);

export const setTokens = (t: AuthTokens) => {
  Cookies.set('access_token', t.access_token, { expires: 1, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' });
  Cookies.set('refresh_token', t.refresh_token, { expires: 30, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' });
};
export const clearTokens = () => { Cookies.remove('access_token'); Cookies.remove('refresh_token'); };
export const parseApiError = (e: unknown): string => {
  if (axios.isAxiosError(e)) return e.response?.data?.detail ?? e.message;
  if (e instanceof Error) return e.message;
  return 'Erro desconhecido';
};

export const authApi = {
  login: (email: string, password: string) => api.post<AuthTokens>('/auth/login', { username: email, password }),
  register: (p: { name: string; email: string; password: string; phone?: string }) => api.post('/auth/register', p),
  me: () => api.get('/users/me'),
  logout: () => api.post('/auth/logout').finally(clearTokens),
};

export const objectsApi = {
  list: (params?: object) => api.get('/objects', { params }),
  get: (id: string) => api.get(`/objects/${id}`),
  create: (payload: FormData | Record<string, unknown>) => {
    if (payload instanceof FormData) {
      return api.post('/objects', payload, { headers: { 'Content-Type': 'multipart/form-data' } });
    }
    return api.post('/objects', payload);
  },
  update: (id: string, payload: object) => api.patch(`/objects/${id}`, payload),
  delete: (id: string) => api.delete(`/objects/${id}`),
  uploadImages: (id: string, images: string[]) => api.post(`/objects/${id}/images`, { images }),
  deleteImages: (id: string) => api.delete(`/objects/${id}/images`),
  scan: (code: string) => api.get(`/objects/scan/${code}`),
  notify: (code: string) => api.post(`/objects/scan/${code}/notify`),
  listPublic: (params?: object) => api.get('/objects/public', { params }),
};

export const matchesApi = {
  list: () => api.get('/matches'),
  confirm: (id: string) => api.post(`/matches/${id}/confirm`),
  reject: (id: string) => api.post(`/matches/${id}/reject`),
};

export const matchingApi = {
  runForObject: (objectId: string) => api.post(`/matching/run/${objectId}`),
  runAll: () => api.post('/matching/run-all'),
  scores: (objectId: string) => api.get(`/matching/scores/${objectId}`),
};

export const adminApi = {
  stats: () => api.get('/admin/stats'),
};

export const publicApi = {
  getObject: (code: string) => api.get(`/objects/scan/${code}`),
  notifyOwner: (code: string) => api.post(`/objects/scan/${code}/notify`),
  getUserProfile: (id: string) => api.get(`/users/${id}/public`),
  listPublic: (params?: object) => api.get('/objects/public', { params }),
};

export const chatApi = {
  history: (matchId: string) => api.get(`/chat/${matchId}/messages`),
};

export const notificationsApi = {
  list: () => api.get('/notifications'),
  markRead: (id: string) => api.patch(`/notifications/${id}/read`),
  markAllRead: () => api.post('/notifications/read-all'),
  delete: (id: string) => api.delete(`/notifications/${id}`),
  subscribe: (sub: object) => api.post('/notifications/subscribe', sub),
  unsubscribe: (endpoint: string) => api.post('/notifications/unsubscribe', { endpoint }),
};
// Force rebuild 1776022871
// Deploy trigger Sun Apr 12 16:00:33 EDT 2026
