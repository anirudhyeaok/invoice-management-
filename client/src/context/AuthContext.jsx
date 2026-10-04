import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import api from '../lib/api';

const AuthContext = createContext(null);
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    api.get('/auth/me').then(({ data }) => setUser(data.data.user)).catch(() => {
      localStorage.removeItem('ap_token');
    }).finally(() => setLoading(false));
  }, []);
  const value = useMemo(() => ({
    user, loading,
    async signIn(credentials) {
      const { data } = await api.post('/auth/login', credentials);
      localStorage.setItem('ap_token', data.data.token);
      setUser(data.data.user);
      return data.data.user;
    },
    async signOut() {
      try { await api.post('/auth/logout'); } finally {
        localStorage.removeItem('ap_token');
        setUser(null);
      }
    },
  }), [user, loading]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
