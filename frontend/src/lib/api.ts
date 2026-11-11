import axios from 'axios';
/** API client: relative base URL (works behind nginx/preview proxy). Access token in memory+localStorage; refresh via httpOnly cookie. */
export const api = axios.create({ baseURL: '/api/v1', withCredentials: true });
const KEY = 'portal_access_token';
export const getToken = () => localStorage.getItem(KEY);
export const setToken = (t: string | null) => { if (t) localStorage.setItem(KEY, t); else localStorage.removeItem(KEY); };
api.interceptors.request.use((c) => { const t = getToken(); if (t) c.headers.Authorization = `Bearer ${t}`; return c; });
let refreshing: Promise<string> | null = null;
api.interceptors.response.use((r) => r, async (err) => {
  const orig = err.config;
  if (err.response?.status === 401 && !orig._retry && !String(orig.url).includes('/auth/')) {
    orig._retry = true;
    try {
      refreshing = refreshing || api.post('/auth/refresh').then((r) => { setToken(r.data.accessToken); return r.data.accessToken; }).finally(() => { refreshing = null; });
      orig.headers.Authorization = `Bearer ${await refreshing}`;
      return api(orig);
    } catch { setToken(null); if (!location.pathname.startsWith('/login')) location.href = '/login'; }
  }
  return Promise.reject(err);
});
export const errMsg = (e: unknown) => (e as { response?: { data?: { message?: string | string[] } }; message?: string })?.response?.data?.message?.toString() || (e as Error)?.message || 'Request failed';
