import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { api, setToken } from './api';
export interface Me { id: string; email: string; name: string; role: 'SUPER_ADMIN'|'ADMIN'|'RESELLER'|'USER'; status: string; twoFactorEnabled: boolean; quota?: Record<string, number>; }
const Ctx = createContext<{ me: Me | null; loading: boolean; login: (email: string, password: string, totp?: string) => Promise<Me>; logout: () => Promise<void>; refreshMe: () => Promise<void> }>({ me: null, loading: true, login: async () => { throw new Error(); }, logout: async () => {}, refreshMe: async () => {} });
export const useAuth = () => useContext(Ctx);
export function AuthProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me | null>(null); const [loading, setLoading] = useState(true);
  const refreshMe = async () => { try { setMe((await api.get('/auth/me')).data); } catch { setMe(null); } finally { setLoading(false); } };
  useEffect(() => { void refreshMe(); }, []);
  const login = async (email: string, password: string, totp?: string) => {
    const r = await api.post('/auth/login', { email, password, totp });
    setToken(r.data.accessToken); const m = (await api.get('/auth/me')).data; setMe(m); return m as Me;
  };
  const logout = async () => { await api.post('/auth/logout').catch(() => {}); setToken(null); setMe(null); };
  return <Ctx.Provider value={{ me, loading, login, logout, refreshMe }}>{children}</Ctx.Provider>;
}
export const isAdmin = (me: Me | null) => me?.role === 'SUPER_ADMIN' || me?.role === 'ADMIN';
